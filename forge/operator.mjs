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
//              action, result} — auditable, tamper-evident, same machinery as
//              build settlement (merkle-dag/crypto.mjs)
//   QUOTA HALT quota/billing-class errors (credit balance, insufficient_quota,
//              rate limits) HALT the pass with a needs-human record — retrying
//              a billing failure burns fuses and buys nothing (learned twice)
//   INBOX      needs-human decisions accumulate in needs-human.jsonl and a
//              rendered INBOX.md — the human is the final approver, never the
//              operator
//
// Zero-dep; rules and bounds are plain data + functions; actions are injected
// (e.g. thin wrappers over the meta-ads loadout server).

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify } from "node:crypto";
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

const loadJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const saveJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n");

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
  const inboxPath = path.join(workdir, "needs-human.jsonl");
  const keysPath = path.join(workdir, "operator-keys.json");

  let keys = loadJson(keysPath, null);
  if (!keys) {
    keys = generateKeypair();
    saveJson(keysPath, keys);
  }

  function ledger(entry) {
    const payload = { kind: "ops-decision", at: new Date().toISOString(), signer: signerName, ...entry };
    const record = {
      ...payload,
      sig: { alg: "Ed25519", value: edSign(null, entryBytes(payload), createPrivateKey(keys.privatePem)).toString("base64"), signed_fields: "all-minus-sig" }
    };
    appendFileSync(ledgerPath, JSON.stringify(record) + "\n");
    return record;
  }

  function needsHuman(question, context) {
    const rec = {
      id: `nh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      question,
      context,
      resolution: null
    };
    appendFileSync(inboxPath, JSON.stringify(rec) + "\n");
    renderInbox(workdir);
    return rec;
  }

  return {
    ledgerPath, inboxPath,
    publicJwk: keys.publicJwk,

    /** One bounded pass: evaluate the rulebook against a metrics snapshot. */
    async runPass(snapshot) {
      const decisions = [];
      for (const rule of rulebook) {
        let matched = false;
        try { matched = !!rule.when(snapshot); } catch (e) {
          decisions.push(ledger({ rule: rule.id, outcome: "rule-error", error: String(e?.message || e) }));
          continue;
        }
        if (!matched) continue;

        const { action, args } = rule.act(snapshot);
        const bound = bounds[action];
        const verdict = bound ? bound(args, snapshot) : `no bounds declared for action "${action}"`;
        if (verdict !== true) {
          // Fail-closed: unbounded or out-of-bounds actions are never executed.
          const nh = needsHuman(
            `Rule ${rule.id} wants ${action}(${JSON.stringify(args).slice(0, 200)}) but: ${verdict}`,
            { rule: rule.id, action, args, snapshot_summary: summarize(snapshot) }
          );
          decisions.push(ledger({ rule: rule.id, action, args, outcome: "needs-human", inbox_id: nh.id, reason: String(verdict) }));
          return { halted: true, reason: `needs-human: ${verdict}`, decisions };
        }

        try {
          const result = await actions[action](args);
          decisions.push(ledger({ rule: rule.id, action, args, outcome: "executed", result_summary: summarize(result) }));
        } catch (e) {
          const msg = String(e?.message || e);
          if (QUOTA_ERROR.test(msg)) {
            // Quota/billing failures halt — retrying buys nothing (learned twice).
            const nh = needsHuman(`Quota/billing failure during ${action}: ${msg.slice(0, 300)}`, { rule: rule.id, action });
            decisions.push(ledger({ rule: rule.id, action, args, outcome: "quota-halt", inbox_id: nh.id, error: msg.slice(0, 300) }));
            return { halted: true, reason: "quota-halt", decisions };
          }
          decisions.push(ledger({ rule: rule.id, action, args, outcome: "action-error", error: msg.slice(0, 300) }));
        }
        if (!rule.multi) break;
      }
      return { halted: false, decisions };
    },

    /** Verify every ledger line's signature (audit). */
    verifyLedger() {
      let lines = [];
      try { lines = readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { /* empty */ }
      const pub = createPublicKey({ key: keys.publicJwk, format: "jwk" });
      const bad = lines.filter((r) => {
        try { return !edVerify(null, entryBytes(r), pub, Buffer.from(r.sig.value, "base64")); } catch { return true; }
      });
      return { total: lines.length, invalid: bad.length, ok: bad.length === 0 };
    }
  };
}

function summarize(v) {
  const s = JSON.stringify(v);
  return s && s.length > 400 ? s.slice(0, 400) + "…" : v;
}

/** Render needs-human.jsonl as a human-readable INBOX.md. */
export function renderInbox(workdir) {
  const inboxPath = path.join(workdir, "needs-human.jsonl");
  let lines = [];
  try { lines = readFileSync(inboxPath, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { /* empty */ }
  const open = lines.filter((r) => !r.resolution);
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
