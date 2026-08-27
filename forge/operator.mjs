// operator.mjs — the ops plane: bounded autonomy for long-lived loops.
//
// TELOS launches things; an operator RUNS them (ad campaigns, monitoring,
// content ops) under the same trust spine. The contract, earned by the
// meta-ads prototype and two quota fuse-burns:
//
//   RULEBOOK   every action must trace to a certified rule — the operator
//              executes a rulebook, it never freelances
//   BOUNDS     enforced HERE and again at the action server (belt+braces, as
//              meta-ads already refuses over-cap budgets) — an out-of-bounds
//              action becomes a needs-human record and a HALT, never a retry
//   LEDGER     every decision appends an Ed25519-SIGNED line {snapshot, rule,
//              action, result} carrying sequence + parent_hash (a hash chain
//              over full signed records, modeled on merkle-dag/proposal-ledger)
//              plus an atomically rewritten head sidecar — so deletion
//              (including tail deletion), reordering, and truncation are all
//              detectable, not just per-line tampering. Appends go through a
//              lockfile + fsync. Verification is STRICT: an unreadable or
//              malformed ledger is a distinct FAILURE, never an empty ledger.
//              (Residual, documented: an actor who can rewrite BOTH the ledger
//              and its same-directory sidecar/keys defeats detection — the
//              chain detects accident and naive tampering, not a co-located
//              key-holding adversary.)
//   QUOTA HALT quota/billing-class errors (credit balance, insufficient_quota,
//              rate limits) HALT the pass with a needs-human record — retrying
//              a billing failure burns fuses and buys nothing (learned twice)
//   INBOX      needs-human decisions accumulate in needs-human.jsonl and a
//              rendered INBOX.md — the human is the final approver, never the
//              operator
//
// Zero-dep; rules and bounds are plain data + functions; actions are injected
// (e.g. thin wrappers over the meta-ads loadout server).

import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash, createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from "node:crypto";
import path from "node:path";
import { generateKeypair } from "../merkle-dag/crypto.mjs";

// Deterministic canonical JSON (sorted keys, recursively) — the exact bytes
// signed and verified must agree regardless of key insertion order.
function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}
const entryBytes = (entry) => {
  const { sig, ...rest } = entry;
  return Buffer.from(canonical(rest));
};

export const QUOTA_ERROR = /credit balance|insufficient_quota|quota exceeded|rate limit|429|billing/i;

export const entryHash = (record) => "sha256:" + createHash("sha256").update(Buffer.from(canonical(record))).digest("hex");

// Strict state reader: absent is a normal state; corrupt/unreadable THROWS.
// (The tolerant read-or-fallback shape silently regenerated signing keys on a
// corrupt keys.json, orphaning every previously signed ledger line.)
const loadState = (p) => {
  try { return { exists: true, value: JSON.parse(readFileSync(p, "utf8")) }; }
  catch (e) {
    if (e?.code === "ENOENT") return { exists: false, value: null };
    throw new Error(`operator state file corrupt/unreadable (refusing the silent-reset): ${p}: ${e?.message || e}`);
  }
};

// Atomic write: temp + wx + fsync + rename, cleanup on failure.
const atomicWrite = (p, data) => {
  const tmp = `${p}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
  let fd = null;
  try {
    fd = openSync(tmp, "wx");
    writeFileSync(fd, data);
    fsyncSync(fd);
    closeSync(fd); fd = null;
    renameSync(tmp, p);
  } catch (e) {
    if (fd !== null) try { closeSync(fd); } catch {}
    try { rmSync(tmp, { force: true }); } catch {}
    throw e;
  }
};
const saveJson = (p, v) => atomicWrite(p, JSON.stringify(v, null, 2) + "\n");

/**
 * Strict ops-ledger reader with distinct outcomes:
 *   { status: "missing" } | { status: "unreadable", error } |
 *   { status: "malformed", errors } | { status: "ok", entries }
 * A torn/unparseable interior line is malformed, never silently skipped.
 */
export function readOpsLedgerStrict(ledgerPath) {
  let raw;
  try { raw = readFileSync(ledgerPath, "utf8"); }
  catch (e) {
    if (e?.code === "ENOENT") return { status: "missing", entries: [] };
    return { status: "unreadable", entries: [], error: String(e?.message || e) };
  }
  const entries = [];
  const errors = [];
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (t.trim() === "") { if (i !== lines.length - 1) errors.push(`blank line at ${i}`); continue; }
    try { entries.push(JSON.parse(t)); } catch { errors.push(`unparseable/torn line at ${i}`); }
  }
  if (errors.length) return { status: "malformed", entries, errors };
  return { status: "ok", entries };
}

/**
 * @param {object} cfg
 *   workdir     state directory (ledger, keys, inbox live here)
 *   rulebook    [{id, description, when(snapshot)->bool, act(snapshot)->{action, args}}]
 *               — evaluated in order; first matching rule per pass wins unless
 *               `multi: true` on the rule
 *   bounds      { [actionName]: (args, snapshot) -> true | string }  — a string
 *               is the violation reason (fail-closed)
 *   actions     { [actionName]: async (args) -> result } — the executors
 *   signerName  ledger signer identity (default "operator")
 */
export function createOperator({ workdir, rulebook, bounds = {}, actions, signerName = "operator" }) {
  mkdirSync(workdir, { recursive: true });
  const ledgerPath = path.join(workdir, "ops-ledger.jsonl");
  const headPath = path.join(workdir, "ops-ledger.head.json");
  const inboxPath = path.join(workdir, "needs-human.jsonl");
  const keysPath = path.join(workdir, "operator-keys.json");

  const keysState = loadState(keysPath); // corrupt keys THROW — never silently regenerate
  let keys = keysState.value;
  if (!keysState.exists) {
    keys = generateKeypair();
    saveJson(keysPath, keys);
  }

  // Audit the chain from disk. Returns the verifyLedger v2 shape plus headHash.
  function auditChain() {
    const read = readOpsLedgerStrict(ledgerPath);
    const headState = loadState(headPath);
    const head = headState.exists ? headState.value : null;
    if (read.status === "missing") {
      if (head === null) return { ok: true, total: 0, invalid: 0, code: "missing", errors: [], headHash: null };
      return { ok: false, total: 0, invalid: 0, code: "chain-broken", errors: ["ledger missing but head sidecar present — whole-file deletion detected"], headHash: null };
    }
    if (read.status === "unreadable") return { ok: false, total: 0, invalid: 0, code: "unreadable", errors: [read.error], headHash: null };
    if (read.status === "malformed") return { ok: false, total: read.entries.length, invalid: 0, code: "malformed", errors: read.errors, headHash: null };
    const entries = read.entries;
    if (entries.length === 0) return { ok: true, total: 0, invalid: 0, code: "missing", errors: [], headHash: null };
    // Chainless entries are a distinct state regardless of signature validity —
    // a pre-chain ledger cannot prove deletion/reorder even when every line signs.
    if (entries.some((r) => typeof r.sequence !== "number" || r.parent_hash === undefined)) {
      return { ok: false, total: entries.length, invalid: 0, code: "legacy-chainless",
        errors: ["entries lack sequence/parent_hash — a chainless ledger cannot prove deletion/reorder; rotate it and start a chained one"], headHash: null };
    }
    const errors = [];
    const pub = createPublicKey({ key: keys.publicJwk, format: "jwk" });
    let invalid = 0;
    for (let i = 0; i < entries.length; i++) {
      let sigOk = false;
      try { sigOk = edVerify(null, entryBytes(entries[i]), pub, Buffer.from(entries[i].sig.value, "base64")); } catch { /* counted below */ }
      if (!sigOk) { invalid++; errors.push(`entry ${i}: bad signature`); }
    }
    if (invalid) return { ok: false, total: entries.length, invalid, code: "bad-signature", errors, headHash: null };
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].sequence !== i + 1) errors.push(`entry ${i}: sequence ${entries[i].sequence}, expected ${i + 1}`);
      const expectedParent = i === 0 ? null : entryHash(entries[i - 1]);
      if ((entries[i].parent_hash ?? null) !== expectedParent) errors.push(`entry ${i}: parent_hash does not chain`);
    }
    const last = entries[entries.length - 1];
    const lastHash = entryHash(last);
    let healedHead = false;
    if (errors.length === 0) {
      if (head === null) {
        errors.push("head sidecar missing for a chained ledger — tail deletion undetectable without it");
      } else if (head.sequence === last.sequence && head.entry_hash === lastHash) {
        // clean
      } else if (head.sequence === last.sequence - 1 && entries.length >= 2 && head.entry_hash === entryHash(entries[entries.length - 2])) {
        // Crash window: append fsynced but the sidecar rewrite didn't land. The
        // extra entry signature+chain-verified above, so heal forward — this is
        // recovery of a legitimately recorded action, not tamper acceptance.
        saveJson(headPath, { sequence: last.sequence, entry_hash: lastHash });
        healedHead = true;
      } else {
        errors.push(`head sidecar mismatch (sidecar seq ${head.sequence} vs ledger seq ${last.sequence}) — tail deletion or reorder detected`);
      }
    }
    if (errors.length) return { ok: false, total: entries.length, invalid: 0, code: "chain-broken", errors, headHash: null };
    return { ok: true, total: entries.length, invalid: 0, code: null, errors: [], headHash: lastHash, healedHead };
  }

  function ledger(entry) {
    const payload = { kind: "ops-decision", at: new Date().toISOString(), signer: signerName, ...entry };
    // Lock + strict-read + chain-verify + fsync append + sidecar rewrite: two
    // writers can never both extend the same head, and a dirty chain refuses
    // to grow. A stale lock after a crash is a conscious manual-recovery step
    // (delete the .lock after confirming no writer is alive) — silent lock
    // stealing would reintroduce the fork risk the lock exists to prevent.
    const lock = ledgerPath + ".lock";
    let acquired = false;
    for (let i = 0; i < 200 && !acquired; i++) {
      try { closeSync(openSync(lock, "wx")); acquired = true; } catch { /* held */ }
    }
    if (!acquired) throw new Error("ops-ledger lock held — concurrent writer or stale lock (single-writer invariant; remove the .lock only after confirming no writer is alive)");
    try {
      const chain = auditChain();
      if (!chain.ok) throw new Error(`ops ledger not clean (${chain.code}), refusing to append: ${chain.errors.join("; ")}`);
      const sequence = chain.total + 1;
      const parent_hash = chain.headHash;
      const body = { ...payload, sequence, parent_hash };
      const record = {
        ...body,
        sig: { alg: "Ed25519", value: edSign(null, entryBytes(body), createPrivateKey(keys.privatePem)).toString("base64"), signed_fields: "all-minus-sig" }
      };
      const fd = openSync(ledgerPath, "a");
      try { writeFileSync(fd, JSON.stringify(record) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
      saveJson(headPath, { sequence, entry_hash: entryHash(record) });
      return record;
    } finally { try { rmSync(lock, { force: true }); } catch {} }
  }

  function needsHuman(question, context) {
    const rec = {
      id: `nh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      question,
      context,
      resolution: null
    };
    const fd = openSync(inboxPath, "a");
    try { writeFileSync(fd, JSON.stringify(rec) + "\n"); fsyncSync(fd); } finally { closeSync(fd); }
    renderInbox(workdir);
    return rec;
  }

  return {
    ledgerPath, inboxPath,
    publicJwk: keys.publicJwk,

    /**
     * One bounded pass: evaluate the rulebook against a metrics snapshot.
     * Every decision point is ledgered with a distinct outcome:
     *   rule-error | act-error | bounds-error | needs-human | executed |
     *   quota-halt | action-error
     * A throwing bound HALTS without executing (fail-closed); an executed
     * action whose ledger append fails RETHROWS (an unrecorded side effect
     * must never look like a clean pass).
     */
    async runPass(snapshot) {
      const decisions = [];
      for (const rule of rulebook) {
        let matched = false;
        try { matched = !!rule.when(snapshot); } catch (e) {
          decisions.push(ledger({ rule: rule.id, outcome: "rule-error", error: String(e?.message || e) }));
          continue;
        }
        if (!matched) continue;

        let acted;
        try { acted = rule.act(snapshot); } catch (e) {
          decisions.push(ledger({ rule: rule.id, outcome: "act-error", error: String(e?.message || e).slice(0, 300) }));
          continue;
        }
        if (!acted || typeof acted.action !== "string") {
          decisions.push(ledger({ rule: rule.id, outcome: "act-error", error: `rule.act returned ${JSON.stringify(acted)?.slice(0, 120)} — need {action, args}` }));
          continue;
        }
        const { action, args } = acted;
        const bound = bounds[action];
        let verdict;
        if (!bound) {
          verdict = `no bounds declared for action "${action}"`;
        } else {
          try { verdict = bound(args, snapshot); } catch (e) {
            // A throwing bound can never authorize execution — halt.
            const msg = String(e?.message || e).slice(0, 300);
            const nh = needsHuman(`Bounds check for ${action} threw (${msg}) — refusing to execute`, { rule: rule.id, action, args });
            decisions.push(ledger({ rule: rule.id, action, args, outcome: "bounds-error", inbox_id: nh.id, error: msg }));
            return { halted: true, reason: `bounds-error: ${msg}`, decisions };
          }
        }
        if (verdict !== true) {
          // Fail-closed: unbounded or out-of-bounds actions are never executed.
          const nh = needsHuman(
            `Rule ${rule.id} wants ${action}(${JSON.stringify(args).slice(0, 200)}) but: ${verdict}`,
            { rule: rule.id, action, args, snapshot_summary: summarize(snapshot) }
          );
          decisions.push(ledger({ rule: rule.id, action, args, outcome: "needs-human", inbox_id: nh.id, reason: String(verdict) }));
          return { halted: true, reason: `needs-human: ${verdict}`, decisions };
        }

        let result, failed = null;
        try { result = await actions[action](args); } catch (e) { failed = e; }
        if (failed) {
          const msg = String(failed?.message || failed);
          if (QUOTA_ERROR.test(msg)) {
            // Quota/billing failures halt — retrying buys nothing (learned twice).
            const nh = needsHuman(`Quota/billing failure during ${action}: ${msg.slice(0, 300)}`, { rule: rule.id, action });
            decisions.push(ledger({ rule: rule.id, action, args, outcome: "quota-halt", inbox_id: nh.id, error: msg.slice(0, 300) }));
            return { halted: true, reason: "quota-halt", decisions };
          }
          decisions.push(ledger({ rule: rule.id, action, args, outcome: "action-error", error: msg.slice(0, 300) }));
        } else {
          // The action SUCCEEDED: its record must land. summarize() is total,
          // so serialization can never flip an executed action to an error;
          // a failing append is an unrecorded side effect and must halt loudly.
          try {
            decisions.push(ledger({ rule: rule.id, action, args, outcome: "executed", result_summary: summarize(result) }));
          } catch (e) {
            throw new Error(`operator ledger append failed AFTER ${action} executed — unrecorded side effect; halting: ${e?.message || e}`);
          }
        }
        if (!rule.multi) break;
      }
      return { halted: false, decisions };
    },

    /**
     * Audit the full ledger chain (v2, fail-closed):
     *   { ok, total, invalid, code, errors }
     *   code: null | "missing" | "unreadable" | "malformed" | "bad-signature" |
     *         "chain-broken" | "legacy-chainless"
     * Only a clean chain (or a never-created ledger on a fresh operator,
     * code "missing") is ok — everything else is a distinct failure.
     */
    verifyLedger() {
      const { ok, total, invalid, code, errors } = auditChain();
      return { ok, total, invalid, code, errors };
    }
  };
}

// Total: never throws, never returns undefined — an unserializable action
// result must not flip an executed action into an error path.
function summarize(v) {
  let s;
  try { s = JSON.stringify(v); } catch { return `<unserializable:${typeof v}>`; }
  if (s === undefined) return `<unserializable:${typeof v}>`;
  return s.length > 400 ? s.slice(0, 400) + "…" : v;
}

/**
 * Render needs-human.jsonl as a human-readable INBOX.md. Lines fold into a
 * map by id — the documented "append {id, resolution}" flow now actually
 * CLOSES the original record. STRICT: an unparseable inbox throws; a silently
 * empty inbox would hide exactly the decisions this system exists to surface.
 */
export function renderInbox(workdir) {
  const inboxPath = path.join(workdir, "needs-human.jsonl");
  let raw = null;
  try { raw = readFileSync(inboxPath, "utf8"); }
  catch (e) { if (e?.code !== "ENOENT") throw new Error(`inbox unreadable (refusing to render an empty inbox over corruption): ${e?.message || e}`); }
  const byId = new Map();
  if (raw !== null) {
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i];
      if (t.trim() === "") { if (i !== lines.length - 1) throw new Error(`inbox corrupt: blank interior line at ${i}`); continue; }
      let rec;
      try { rec = JSON.parse(t); } catch { throw new Error(`inbox corrupt: unparseable line at ${i} — refusing to render an empty inbox over corruption`); }
      if (!rec || typeof rec.id !== "string" || !rec.id) throw new Error(`inbox corrupt: line ${i} has no id`);
      const prev = byId.get(rec.id);
      if (prev) Object.assign(prev, rec);
      else byId.set(rec.id, { ...rec });
    }
  }
  const open = [...byId.values()].filter((r) => !r.resolution);
  const md = [
    "# Operator Inbox — decisions only a human can make",
    "",
    open.length ? `**${open.length} open** — resolve by appending {id, resolution} lines to needs-human.jsonl` : "_Nothing needs you._",
    "",
    ...open.map((r) => `## ${r.id} (${r.at})\n${r.question}\n\n\`\`\`json\n${JSON.stringify(r.context, null, 2).slice(0, 1000)}\n\`\`\``)
  ].join("\n");
  writeFileSync(path.join(workdir, "INBOX.md"), md + "\n");
  return { open: open.length };
}
