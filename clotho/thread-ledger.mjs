// thread-ledger.mjs — Clotho's signed, append-only thread ledger (plan v12
// Task 3). Zero dependencies: Node stdlib only.
//
// A weave owns ONE timestamp and ONE Ed25519 keypair, and owns every envelope
// and accounting fact (D5): weavers never emit time, signatures, record hashes,
// chain fields, or counts. Records are canonical-JSON lines chained by hash and
// signed over the raw record-hash digest.
//
// Signing uses node:crypto directly rather than merkle-dag/crypto.mjs, whose
// envelope (sig:{alg,value,signed_fields}) and non-chained records do not
// implement the normative bytes here (v12 Task 3). The single-writer append +
// fsync discipline follows the proposal-ledger pattern in merkle-dag/crypto.mjs.
//
// Task 3 validates GENERIC ledger integrity only — schema, signatures, chain,
// content-reference shapes, published states, record/coverage consistency —
// against injected fixture coverage; it depends on no committed inventory (D19).
// Equality of coverage refs/counts with committed inventories is the Task 5
// driver's job.

import { createHash, generateKeyPairSync, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";
import { openSync, writeSync, fsyncSync, closeSync, mkdirSync, createReadStream } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  canonicalJson, validateEdgeInput, validateSourceRef, deriveRepositoryRef
} from "./registry.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const REPO_REF = /^git-root:[0-9a-f]{40}$/;
const HEADER_FIELDS = ["pub_key", "woven_at", "repo_head", "repository_ref", "weave_version"];
const PUBLISHED_STATES = new Set(["executed", "skipped"]);
const STATUS_TRANSITIONS = new Set(["human-authorized", "rejected", "superseded"]);
// The five weaver ids in their stable declared (inventory) order. Task 3's
// coverage carries exactly these five, in this order (v12 Task 3).
const WEAVER_ORDER = ["clotho-git-weaver", "clotho-code-weaver", "clotho-test-weaver", "clotho-doc-weaver", "clotho-ledger-weaver"];
// The frozen per-weaver required inventory-id table (v12 D24/D26/D31), sorted.
// Task 3 requires each weaver's inspected_source_counts to carry EXACTLY these
// ids (structure only — count cardinalities and committed-inventory equality are
// the Task 5 driver's job, D19/D26/D29).
const REQUIRED_INVENTORY_IDS = {
  "clotho-git-weaver": ["package-files", "package-symbols"],
  "clotho-code-weaver": ["package-modules"],
  "clotho-test-weaver": ["package-manifests", "test-files"],
  "clotho-doc-weaver": ["doc-files"],
  "clotho-ledger-weaver": ["contract-files", "ledger-sources", "run-sources"]
};

// ---- crypto + line helpers ---------------------------------------------------

const hexOf = (str) => createHash("sha256").update(Buffer.from(str, "utf8")).digest("hex");
const hexOfBytes = (buf) => createHash("sha256").update(buf).digest("hex");
const publicKeyB64 = (pub) => pub.export({ type: "spki", format: "der" }).toString("base64");
const publicKeyFromB64 = (b64) => createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
// Decode `str` only if it is CANONICAL standard base64 of exactly `expectedLen`
// bytes (Buffer.from is lenient — it silently ignores whitespace and accepts
// non-canonical encodings), else null.
function decodeCanonicalB64(str, expectedLen) {
  if (typeof str !== "string") return null;
  const buf = Buffer.from(str, "base64");
  if (buf.length !== expectedLen || buf.toString("base64") !== str) return null;
  return buf;
}

function defaultGit(args) {
  return execFileSync("git", args, { shell: false, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// Default file handle: exclusive create (wx is the sole atomic existence gate —
// no TOCTOU pre-check), fsync on every write, single close.
function defaultOpenFile(ledgerPath) {
  let fd;
  try {
    fd = openSync(ledgerPath, "wx");
  } catch (e) {
    if (e && e.code === "EEXIST") throw new Error(`createLedger: refusing to overwrite existing path ${ledgerPath}`);
    throw e;
  }
  return {
    write(line) {
      // All-or-error: write every byte of the complete LF-terminated line (a
      // short write is a failure, not a silently-truncated record), then fsync.
      const buf = Buffer.from(line + "\n", "utf8");
      let off = 0;
      while (off < buf.length) {
        const n = writeSync(fd, buf, off, buf.length - off);
        if (!(n > 0)) throw new Error("short write to ledger");
        off += n;
      }
      fsyncSync(fd);
    },
    close() { closeSync(fd); }
  };
}

// ---- schema validators -------------------------------------------------------

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

// Exactly the expected OWN ENUMERABLE string keys — rejects own symbols, own
// non-enumerable fields, extra fields, and enumerable fields inherited through a
// polluted prototype (matching registry.requireExactKeys' rigor).
function requireExactOwnKeys(obj, expected, label) {
  if (!isPlainObject(obj)) throw new TypeError(`${label}: expected a plain object`);
  if (Object.getOwnPropertySymbols(obj).length > 0) throw new TypeError(`${label}: symbol-keyed fields are not permitted`);
  for (const k of Object.getOwnPropertyNames(obj)) if (!expected.includes(k)) throw new TypeError(`${label}: unexpected field '${k}'`);
  for (const k of expected) {
    const d = Object.getOwnPropertyDescriptor(obj, k);
    if (!d) throw new TypeError(`${label}: missing field '${k}'`);
    if (!d.enumerable) throw new TypeError(`${label}: field '${k}' must be own-enumerable`);
  }
  for (const k in obj) if (!Object.prototype.hasOwnProperty.call(obj, k)) throw new TypeError(`${label}: inherited enumerable field '${k}' is not permitted`);
}

// A content-address ref must be a 'file:<repo-relative-path>@<40-hex>' with a
// canonical POSIX path (no absolute/traversal/backslash/NUL) — delegated to
// registry.validateSourceRef, the single authoritative source-ref validator.
function requireFileRef(ref, label) {
  if (typeof ref !== "string" || !ref.startsWith("file:")) throw new TypeError(`${label}: expected a 'file:' content address, got ${JSON.stringify(ref)}`);
  try { validateSourceRef(ref); } catch (e) { throw new TypeError(`${label}: ${e.message}`); }
}

function requireInspectedSourceCounts(counts, state, requiredIds, label) {
  if (!Array.isArray(counts)) throw new TypeError(`${label}: inspected_source_counts must be an array`);
  let prevId = null;
  for (const entry of counts) {
    requireExactOwnKeys(entry, ["inventory_id", "count"], `${label} count entry`);
    if (typeof entry.inventory_id !== "string" || entry.inventory_id.length === 0) throw new TypeError(`${label}: inventory_id must be a nonempty string`);
    if (!Number.isSafeInteger(entry.count) || entry.count < 0) throw new TypeError(`${label}: count must be a nonnegative safe integer`);
    if (prevId !== null && entry.inventory_id <= prevId) throw new TypeError(`${label}: inspected_source_counts must be sorted and unique by inventory_id`);
    prevId = entry.inventory_id;
    if (state === "skipped" && entry.count !== 0) throw new TypeError(`${label}: skipped weaver must carry zero counts`);
  }
  // Exactly the weaver's frozen required inventory ids — no missing, no extra
  // (the ids are already proven sorted+unique above, so a length + positional
  // match is exact). Count cardinalities remain out of scope here (Task 5).
  const ids = counts.map((e) => e.inventory_id);
  if (ids.length !== requiredIds.length || ids.some((id, i) => id !== requiredIds[i])) {
    throw new TypeError(`${label}: inspected_source_counts must carry exactly [${requiredIds.join(", ")}], got [${ids.join(", ")}]`);
  }
}

// Structure-only coverage validation (D19). `weaverEdgeIds` is the set of weaver
// ids that asserted an edge; a weaver with edges may not be recorded 'skipped'.
function validateCoverage(coverage, weaverEdgeIds) {
  requireExactOwnKeys(coverage, ["weavers", "orchestrator_refs", "inventories_consumed"], "coverage");

  const { weavers, orchestrator_refs, inventories_consumed } = coverage;
  if (!Array.isArray(weavers) || weavers.length !== 5) throw new TypeError("coverage.weavers: must be exactly five entries");
  for (let i = 0; i < 5; i++) {
    const w = weavers[i];
    requireExactOwnKeys(w, ["id", "version", "implementation_refs", "state", "inspected_source_counts"], "coverage weaver");
    if (w.id !== WEAVER_ORDER[i]) throw new TypeError(`coverage weaver[${i}]: expected id ${WEAVER_ORDER[i]}, got ${JSON.stringify(w.id)}`);
    if (!Number.isSafeInteger(w.version)) throw new TypeError(`coverage weaver[${w.id}].version: safe integer`);
    if (!PUBLISHED_STATES.has(w.state)) throw new TypeError(`coverage weaver[${w.id}].state: must be executed|skipped, got ${JSON.stringify(w.state)}`);
    if (!Array.isArray(w.implementation_refs) || w.implementation_refs.length === 0) throw new TypeError(`coverage weaver[${w.id}].implementation_refs: nonempty array`);
    for (const r of w.implementation_refs) requireFileRef(r, `coverage weaver[${w.id}].implementation_refs`);
    requireInspectedSourceCounts(w.inspected_source_counts, w.state, REQUIRED_INVENTORY_IDS[w.id], `coverage weaver[${w.id}]`);
    if (w.state === "skipped" && weaverEdgeIds.has(w.id)) throw new TypeError(`coverage weaver[${w.id}]: recorded 'skipped' but asserted an edge in this ledger`);
  }
  if (!Array.isArray(orchestrator_refs) || orchestrator_refs.length === 0) throw new TypeError("coverage.orchestrator_refs: nonempty array");
  for (const r of orchestrator_refs) requireFileRef(r, "coverage.orchestrator_refs");
  if (!Array.isArray(inventories_consumed)) throw new TypeError("coverage.inventories_consumed: must be an array");
  for (const inv of inventories_consumed) {
    requireExactOwnKeys(inv, ["id", "source_ref"], "inventories_consumed entry");
    if (typeof inv.id !== "string" || inv.id.length === 0) throw new TypeError("inventories_consumed.id: nonempty string");
    requireFileRef(inv.source_ref, "inventories_consumed.source_ref");
  }
}

function validateStatusInput(statusInput, edgeHashes) {
  requireExactOwnKeys(statusInput, ["status_of", "new_status", "asserted_by", "assertion_status", "source_ref"], "statusInput");
  if (typeof statusInput.status_of !== "string" || !HEX64.test(statusInput.status_of)) throw new TypeError("statusInput.status_of: 64-hex record hash");
  if (!edgeHashes.has(statusInput.status_of)) throw new TypeError("statusInput.status_of: must reference an earlier edge record in this ledger");
  if (!STATUS_TRANSITIONS.has(statusInput.new_status)) throw new TypeError(`statusInput.new_status: must be one of ${[...STATUS_TRANSITIONS].join("|")}`);
  if (statusInput.asserted_by !== "human") throw new TypeError("statusInput.asserted_by: status transitions must be asserted by 'human'");
  if (statusInput.assertion_status !== "human-authorized") throw new TypeError("statusInput.assertion_status: must be 'human-authorized'");
  validateSourceRef(statusInput.source_ref);
}

// ---- createLedger ------------------------------------------------------------

export function createLedger(ledgerPath, { signKey, wovenAt, repoHead, repositoryRef, git = defaultGit, openFile = defaultOpenFile } = {}) {
  let privateKey;
  if (signKey !== undefined) {
    privateKey = (typeof signKey === "string" || Buffer.isBuffer(signKey)) ? createPrivateKey(signKey) : signKey;
    if (!privateKey || privateKey.asymmetricKeyType !== "ed25519") throw new TypeError("createLedger: signKey must be an Ed25519 private key");
  } else {
    privateKey = generateKeyPairSync("ed25519").privateKey;
  }
  const pubB64 = publicKeyB64(createPublicKey(privateKey));

  let woven_at;
  try { woven_at = new Date(wovenAt ?? Date.now()).toISOString(); }
  catch { throw new TypeError(`createLedger: invalid wovenAt ${JSON.stringify(wovenAt)}`); }
  const repo_head = repoHead ?? String(git(["rev-parse", "HEAD"])).trim();
  if (typeof repo_head !== "string" || !HEX40.test(repo_head)) throw new TypeError(`createLedger: repo_head must be a 40-hex commit string, got ${JSON.stringify(repo_head)}`);
  const repo_ref = repositoryRef ?? deriveRepositoryRef(git);
  if (typeof repo_ref !== "string" || !REPO_REF.test(repo_ref)) throw new TypeError(`createLedger: repository_ref must be a 'git-root:<40-hex>' string, got ${JSON.stringify(repo_ref)}`);

  // Only the default handle owns filesystem I/O; it creates parent directories
  // for its requested file. An injected openFile owns its own path pre-existence.
  if (openFile === defaultOpenFile) mkdirSync(path.dirname(path.resolve(ledgerPath)), { recursive: true });
  const handle = openFile(ledgerPath); // wx is the atomic existence gate

  const state = { open: true, closed: false, poisoned: false, closeResult: null, prevLine: null, edgeHashes: new Set(), weaverEdgeIds: new Set() };

  const closeHandle = () => { if (state.open) { try { handle.close(); } finally { state.open = false; } } };
  const poison = (err) => { state.poisoned = true; closeHandle(); return err; };
  const guard = () => { if (state.poisoned) throw new Error("ledger is poisoned/aborted"); if (state.closed) throw new Error("ledger is closed"); };
  const writeLine = (obj) => { const line = canonicalJson(obj); handle.write(line); state.prevLine = line; };
  const chainAndSign = (payload) => {
    const prev_hash = hexOf(state.prevLine);
    const record_hash = hexOf(canonicalJson({ ...payload, prev_hash }));
    const signature = edSign(null, Buffer.from(record_hash, "hex"), privateKey).toString("base64");
    return { ...payload, prev_hash, record_hash, signature };
  };

  const header = { clotho_weave_header: { pub_key: pubB64, woven_at, repo_head, repository_ref: repo_ref, weave_version: 1 } };
  try { writeLine(header); } catch (e) { throw poison(e); }

  return {
    header,
    appendEdge(edgeInput) {
      guard();
      try {
        // validateEdgeInput re-derives from_node/to_node from the supplied
        // locators via deriveNodeId and rejects any mismatch (never silently
        // overwrites — the mismatch is the thing to detect).
        validateEdgeInput(edgeInput, { repositoryRef: repo_ref });
        const record = chainAndSign({ ...edgeInput, woven_at });
        writeLine(record);
        state.edgeHashes.add(record.record_hash);
        if (edgeInput.assertion_status === "deterministic-extraction") state.weaverEdgeIds.add(edgeInput.asserted_by);
        return record;
      } catch (e) { throw poison(e); }
    },
    appendStatus(statusInput) {
      guard();
      try {
        validateStatusInput(statusInput, state.edgeHashes);
        const record = chainAndSign({ ...statusInput, woven_at });
        writeLine(record);
        return record;
      } catch (e) { throw poison(e); }
    },
    close(coverage) {
      if (state.closed) return state.closeResult; // idempotent ONLY after a successful close
      guard();                                    // still throws after abort/poison
      try {
        validateCoverage(coverage, state.weaverEdgeIds);
        const record = chainAndSign({ clotho_weave_trailer: coverage, woven_at });
        writeLine(record);   // write trailer + fsync
        closeHandle();       // flush + close the descriptor — must succeed first
        state.closeResult = record;   // report success ONLY after the close succeeds
        state.closed = true;          // (a close failure leaves the ledger poisoned, never "closed")
        return record;
      } catch (e) { throw poison(e); }
    },
    abort() {
      if (state.closed) return;               // no-op after a successful close
      state.poisoned = true;
      closeHandle();
    }
  };
}

// ---- verifyLedger ------------------------------------------------------------
// `records` contains ONLY trusted signed edge and status records (never the
// header or trailer). On the first failing line it stops conferring trust: no
// record on or after that line is added, and ok is false.

export async function verifyLedger(ledgerPath, { openReadStream } = {}) {
  const errors = [];
  const records = [];
  let header = null;
  let manifest = null;
  let trustBroken = false;
  const fail = (m) => { errors.push(m); trustBroken = true; };

  let pubKey = null;
  let repoRef = null;
  let prevBytes = null;
  let lineIndex = 0;
  const edgeHashes = new Set();
  const weaverEdgeIds = new Set();
  let trailerSeen = false;

  // Process exactly one complete line as RAW BYTES (no trailing LF). Strict
  // UTF-8 (no replacement); the chain hashes the exact prior line bytes. Never
  // throws.
  const processLine = (lineBuf) => {
    const i = lineIndex++;
    // CR is detected at the line level (a canonical JSON line never contains a
    // raw CR), so a CRLF/embedded-CR failure is attributed to its exact line and
    // truncates trust at the first failing line like any other defect.
    if (lineBuf.includes(0x0d)) { fail(`line ${i + 1}: contains a raw CR (CRLF not permitted; lines end in LF)`); prevBytes = lineBuf; return; }
    let line;
    try { line = new TextDecoder("utf-8", { fatal: true }).decode(lineBuf); } catch { fail(`line ${i + 1}: invalid UTF-8`); prevBytes = lineBuf; return; }
    let obj;
    try { obj = JSON.parse(line); } catch { fail(`line ${i + 1}: not valid JSON`); prevBytes = lineBuf; return; }
    if (obj === null || typeof obj !== "object" || Array.isArray(obj)) { fail(`line ${i + 1}: record must be a JSON object`); prevBytes = lineBuf; return; }
    let canon;
    try { canon = canonicalJson(obj); } catch { fail(`line ${i + 1}: not canonicalizable`); prevBytes = lineBuf; return; }
    if (canon !== line) { fail(`line ${i + 1}: not canonical JSON`); prevBytes = lineBuf; return; }

    if (i === 0) {
      const h = obj.clotho_weave_header;
      if (Object.keys(obj).length !== 1 || h === null || typeof h !== "object" || Array.isArray(h)) { fail("line 1: header envelope must be exactly {clotho_weave_header:{...}}"); prevBytes = lineBuf; return; }
      try {
        for (const k of Object.keys(h)) if (!HEADER_FIELDS.includes(k)) throw new Error(`unexpected field '${k}'`);
        for (const k of HEADER_FIELDS) if (!(k in h)) throw new Error(`missing field '${k}'`);
        if (typeof h.repository_ref !== "string" || !REPO_REF.test(h.repository_ref)) throw new Error("repository_ref must be a 'git-root:<40-hex>' string");
        if (typeof h.pub_key !== "string") throw new Error("pub_key must be a string");
        pubKey = publicKeyFromB64(h.pub_key);
        if (pubKey.asymmetricKeyType !== "ed25519") throw new Error("pub_key must be an Ed25519 SPKI key");
        if (publicKeyB64(pubKey) !== h.pub_key) throw new Error("pub_key is not canonical SPKI base64");
        if (h.weave_version !== 1) throw new Error("weave_version must be 1");
        if (typeof h.repo_head !== "string" || !HEX40.test(h.repo_head)) throw new Error("repo_head must be a 40-hex string");
        if (typeof h.woven_at !== "string" || new Date(h.woven_at).toISOString() !== h.woven_at) throw new Error("woven_at not canonical ISO");
        header = h; repoRef = h.repository_ref;
      } catch (e) { fail(`header: ${e.message}`); }
      prevBytes = lineBuf;
      return;
    }

    if (header === null) { fail(`line ${i + 1}: record precedes a valid header`); prevBytes = lineBuf; return; }
    if (obj.clotho_weave_header) { fail(`line ${i + 1}: duplicate header`); prevBytes = lineBuf; return; }
    if (trailerSeen) { fail(`line ${i + 1}: record after trailer (trailer must be final)`); prevBytes = lineBuf; return; }

    const { prev_hash, record_hash, signature, ...payload } = obj;
    let lineOk = true;
    const bad = (m) => { fail(m); lineOk = false; };
    if (typeof prev_hash !== "string" || prev_hash !== hexOfBytes(prevBytes)) bad(`line ${i + 1}: broken chain (prev_hash mismatch)`);
    let expectHash = null;
    try { expectHash = hexOf(canonicalJson({ ...payload, prev_hash })); } catch { /* payload not canonicalizable */ }
    if (typeof record_hash !== "string" || record_hash !== expectHash) bad(`line ${i + 1}: record_hash mismatch`);
    let sigOk = false;
    const sigBuf = decodeCanonicalB64(signature, 64); // Ed25519 sig = 64 bytes, canonical base64
    try { sigOk = !!sigBuf && !!pubKey && edVerify(null, Buffer.from(record_hash || "", "hex"), pubKey, sigBuf); } catch { sigOk = false; }
    if (!sigOk) bad(`line ${i + 1}: invalid or non-canonical signature`);
    if (payload.woven_at !== header.woven_at) bad(`line ${i + 1}: woven_at does not equal the header woven_at`);

    if (obj.clotho_weave_trailer) {
      try { requireExactOwnKeys(payload, ["clotho_weave_trailer", "woven_at"], `line ${i + 1}: trailer envelope`); } catch (e) { bad(e.message); }
      try { validateCoverage(obj.clotho_weave_trailer, weaverEdgeIds); } catch (e) { bad(`trailer: ${e.message}`); }
      if (lineOk && !trustBroken) manifest = obj.clotho_weave_trailer;
      trailerSeen = true; // the trailer is never added to `records`
    } else if ("status_of" in payload) {
      try { validateStatusInput(payload_forStatus(payload), edgeHashes); } catch (e) { bad(`line ${i + 1}: ${e.message}`); }
      if (lineOk && !trustBroken) records.push(obj);
    } else {
      try { validateEdgeInput(withoutWovenAt(payload), { repositoryRef: repoRef }); } catch (e) { bad(`line ${i + 1}: ${e.message}`); }
      if (lineOk && !trustBroken) {          // freeze ALL trust state at the first failure
        edgeHashes.add(record_hash);
        if (payload.assertion_status === "deterministic-extraction") weaverEdgeIds.add(payload.asserted_by);
        records.push(obj);
      }
    }
    prevBytes = lineBuf;
  };

  // Consume the ledger incrementally as raw bytes; split on the LF byte and
  // buffer only a partial line. Never throws.
  let buf = Buffer.alloc(0);
  try {
    const stream = openReadStream ? openReadStream(ledgerPath) : createReadStream(ledgerPath);
    for await (const chunk of stream) {
      const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      buf = buf.length ? Buffer.concat([buf, b]) : b;
      let nl;
      while ((nl = buf.indexOf(0x0a)) !== -1) {
        processLine(buf.subarray(0, nl));
        buf = buf.subarray(nl + 1);
      }
    }
  } catch (e) {
    return { ok: false, header, manifest: null, records, errors: [...errors, `read failed: ${e.message}`] };
  }

  // Stream-level defects flow through the SAME fail() channel as per-line
  // defects. `records` holds only the trusted edge/status records that appeared
  // before the first failing line or trailer-level invariant; a tail defect
  // (missing trailer, partial final line) leaves those prior trusted records in
  // `records` with ok:false, per the spec's "or trailer-level invariant" clause.
  if (buf.length > 0) fail("ledger must end with a final LF (unterminated final record is never trusted)");
  if (lineIndex === 0 && buf.length === 0) fail("empty ledger");
  if (!trailerSeen) fail("ledger has no final trailer");
  if (errors.length > 0) manifest = null;
  return { ok: errors.length === 0, header, manifest, records, errors };
}

// a status payload includes woven_at; validateStatusInput expects exactly the
// 5 caller fields, so drop the ledger-owned woven_at before structural checks.
function payload_forStatus(payload) {
  const { woven_at, ...rest } = payload;
  return rest;
}
function withoutWovenAt(payload) {
  const { woven_at, ...rest } = payload;
  return rest;
}

// ---- readEdges ---------------------------------------------------------------
// Streams the ledger via fs.createReadStream (or an injected stream) with an
// incremental line splitter, skips ONLY the header, and yields every subsequent
// signed record (edges, status records, and the trailer) without buffering the
// whole file. Structural parsing only — not trust-conferring; callers query a
// successful verifyLedger result.

export async function* readEdges(ledgerPath, { openReadStream } = {}) {
  const stream = openReadStream ? openReadStream(ledgerPath) : createReadStream(ledgerPath);
  let buf = Buffer.alloc(0);
  let lineNo = 0;
  for await (const chunk of stream) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
    buf = buf.length ? Buffer.concat([buf, b]) : b;
    let nl;
    while ((nl = buf.indexOf(0x0a)) !== -1) {
      const lineBuf = buf.subarray(0, nl);
      buf = buf.subarray(nl + 1);
      lineNo++;
      if (lineNo === 1) continue; // skip header
      let line;
      try { line = new TextDecoder("utf-8", { fatal: true }).decode(lineBuf); } catch { continue; }
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      yield obj;
    }
  }
  // A well-formed ledger ends in LF, so any trailing partial line is malformed
  // and is not yielded.
}
