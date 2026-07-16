// thread-ledger.mjs — Clotho's signed, append-only thread ledger (plan v12
// Task 3). Zero dependencies: Node stdlib only.
//
// A weave owns ONE timestamp and ONE Ed25519 keypair, and owns every envelope
// and accounting fact (D5): weavers never emit time, signatures, hashes, chain
// fields, or counts. Records are canonical-JSON lines chained by hash and signed
// over the raw record-hash digest.
//
// Signing uses node:crypto directly rather than merkle-dag/crypto.mjs, whose
// envelope (sig:{alg,value,signed_fields}) and non-chained records do not
// implement the normative bytes here (v12 Task 3). The single-writer append +
// fsync discipline follows the proposal-ledger pattern in merkle-dag/crypto.mjs.
//
// Task 3 validates GENERIC ledger integrity only — schema, signatures, chain,
// content-reference shapes, published states, record/coverage consistency —
// against injected fixture coverage; it depends on no committed inventory (D19),
// which cannot exist until Task 4a.

import { createHash, generateKeyPairSync, sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";
import { openSync, writeSync, fsyncSync, closeSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  canonicalJson, validateEdgeInput, validateSourceRef, deriveRepositoryRef, ASSERTION_STATUS
} from "./registry.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const PUBLISHED_STATES = new Set(["executed", "skipped"]);
const STATUS_TRANSITIONS = new Set(["human-authorized", "rejected", "superseded"]);
const FILE_REF = /^file:(.+)@([0-9a-f]{40})$/;

// ---- crypto helpers ----------------------------------------------------------

function digestOf(str) {
  return createHash("sha256").update(Buffer.from(str, "utf8")).digest(); // 32-byte Buffer
}
function hexOf(str) {
  return createHash("sha256").update(Buffer.from(str, "utf8")).digest("hex");
}
function publicKeyB64(publicKey) {
  return publicKey.export({ type: "spki", format: "der" }).toString("base64");
}
function publicKeyFromB64(b64) {
  return createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
}

// ---- default git identity (injected in tests / by the Task 5 driver) --------
// The weaver-facing no-shell git wrapper is a separate Task 4a deliverable; here
// we only need the ledger's own identity when the caller does not inject it.
function defaultGit(args) {
  return execFileSync("git", args, { shell: false, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// ---- validation helpers ------------------------------------------------------

function requireFileRef(ref, label) {
  if (typeof ref !== "string" || !FILE_REF.test(ref)) {
    throw new TypeError(`${label}: expected 'file:<path>@<40-hex>', got ${JSON.stringify(ref)}`);
  }
}

function requireInspectedSourceCounts(counts, state, label) {
  if (!Array.isArray(counts)) throw new TypeError(`${label}: inspected_source_counts must be an array`);
  let prevId = null;
  for (const entry of counts) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError(`${label}: count entry must be an object`);
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !("inventory_id" in entry) || !("count" in entry)) {
      throw new TypeError(`${label}: count entry must be exactly {inventory_id, count}`);
    }
    if (typeof entry.inventory_id !== "string" || entry.inventory_id.length === 0) throw new TypeError(`${label}: inventory_id must be a nonempty string`);
    if (!Number.isSafeInteger(entry.count) || entry.count < 0) throw new TypeError(`${label}: count must be a nonnegative safe integer`);
    if (prevId !== null && entry.inventory_id <= prevId) throw new TypeError(`${label}: inspected_source_counts must be sorted and unique by inventory_id`);
    prevId = entry.inventory_id;
    if (state === "skipped" && entry.count !== 0) throw new TypeError(`${label}: skipped weaver must carry zero counts`);
  }
}

// Validate the structure of a coverage object (D19: generic — no committed
// inventory dependency). `weaverEdgeIds` is the set of weaver ids that actually
// asserted an edge in this ledger; a skipped weaver may not have produced edges.
function validateCoverage(coverage, weaverEdgeIds) {
  if (coverage === null || typeof coverage !== "object" || Array.isArray(coverage)) throw new TypeError("coverage: must be an object");
  const keys = Object.keys(coverage);
  const expected = ["weavers", "orchestrator_refs", "inventories_consumed"];
  for (const k of keys) if (!expected.includes(k)) throw new TypeError(`coverage: unexpected field '${k}'`);
  for (const k of expected) if (!(k in coverage)) throw new TypeError(`coverage: missing field '${k}'`);

  const { weavers, orchestrator_refs, inventories_consumed } = coverage;
  if (!Array.isArray(weavers) || weavers.length !== 5) throw new TypeError("coverage.weavers: must be exactly five entries");
  const seenIds = new Set();
  for (const w of weavers) {
    if (w === null || typeof w !== "object" || Array.isArray(w)) throw new TypeError("coverage weaver: must be an object");
    const wkeys = Object.keys(w);
    const wexpected = ["id", "version", "implementation_refs", "state", "inspected_source_counts"];
    for (const k of wkeys) if (!wexpected.includes(k)) throw new TypeError(`coverage weaver: unexpected field '${k}'`);
    for (const k of wexpected) if (!(k in w)) throw new TypeError(`coverage weaver: missing field '${k}'`);
    if (typeof w.id !== "string" || w.id.length === 0) throw new TypeError("coverage weaver.id: nonempty string");
    if (seenIds.has(w.id)) throw new TypeError(`coverage weaver.id: duplicate ${w.id}`);
    seenIds.add(w.id);
    if (!Number.isSafeInteger(w.version)) throw new TypeError("coverage weaver.version: safe integer");
    if (!PUBLISHED_STATES.has(w.state)) throw new TypeError(`coverage weaver.state: must be executed|skipped, got ${JSON.stringify(w.state)}`);
    if (!Array.isArray(w.implementation_refs) || w.implementation_refs.length === 0) throw new TypeError("coverage weaver.implementation_refs: nonempty array");
    for (const r of w.implementation_refs) requireFileRef(r, "coverage weaver.implementation_refs");
    requireInspectedSourceCounts(w.inspected_source_counts, w.state, `coverage weaver[${w.id}]`);
    // A weaver that produced edges in this ledger cannot be recorded skipped.
    if (w.state === "skipped" && weaverEdgeIds.has(w.id)) {
      throw new TypeError(`coverage weaver[${w.id}]: recorded 'skipped' but produced edges in this ledger`);
    }
  }
  if (!Array.isArray(orchestrator_refs) || orchestrator_refs.length === 0) throw new TypeError("coverage.orchestrator_refs: nonempty array");
  for (const r of orchestrator_refs) requireFileRef(r, "coverage.orchestrator_refs");
  if (!Array.isArray(inventories_consumed)) throw new TypeError("coverage.inventories_consumed: must be an array");
  for (const inv of inventories_consumed) {
    if (inv === null || typeof inv !== "object" || Array.isArray(inv)) throw new TypeError("inventories_consumed entry: object");
    const ikeys = Object.keys(inv);
    if (ikeys.length !== 2 || !("id" in inv) || !("source_ref" in inv)) throw new TypeError("inventories_consumed entry: exactly {id, source_ref}");
    if (typeof inv.id !== "string" || inv.id.length === 0) throw new TypeError("inventories_consumed.id: nonempty string");
    requireFileRef(inv.source_ref, "inventories_consumed.source_ref");
  }
}

// ---- createLedger ------------------------------------------------------------

export function createLedger(ledgerPath, { signKey, wovenAt, repoHead, repositoryRef, git = defaultGit } = {}) {
  if (existsSync(ledgerPath)) throw new Error(`createLedger: refusing to overwrite existing path ${ledgerPath}`);

  // one signing keypair
  let privateKey;
  if (signKey !== undefined) {
    privateKey = typeof signKey === "string" || Buffer.isBuffer(signKey) ? createPrivateKey(signKey) : signKey;
    if (!privateKey || privateKey.asymmetricKeyType !== "ed25519") throw new TypeError("createLedger: signKey must be an Ed25519 private key");
  } else {
    privateKey = generateKeyPairSync("ed25519").privateKey;
  }
  const publicKey = createPublicKey(privateKey);
  const pubB64 = publicKeyB64(publicKey);

  // one canonical timestamp, one head, one ref
  const woven_at = new Date(wovenAt ?? Date.now()).toISOString();
  const repo_head = (repoHead ?? String(git(["rev-parse", "HEAD"])).trim());
  if (!HEX40.test(repo_head)) throw new TypeError(`createLedger: repo_head must be a 40-hex commit, got ${JSON.stringify(repo_head)}`);
  const repo_ref = repositoryRef ?? deriveRepositoryRef(git);

  mkdirSync(path.dirname(path.resolve(ledgerPath)), { recursive: true });
  const fd = openSync(ledgerPath, "wx");

  const state = { fd, open: true, closed: false, poisoned: false, prevLine: null, edgeHashes: new Set(), weaverEdgeIds: new Set(), woven_at, repo_ref };

  function closeFd() {
    if (state.open) { try { closeSync(fd); } finally { state.open = false; } }
  }
  function poison(err) {
    state.poisoned = true;
    closeFd();
    return err;
  }
  function guard() {
    if (state.poisoned) throw new Error("ledger is poisoned/aborted");
    if (state.closed) throw new Error("ledger is closed");
  }
  function writeLine(obj) {
    const line = canonicalJson(obj);
    writeSync(fd, line + "\n");
    fsyncSync(fd);
    state.prevLine = line;
  }
  function chainAndSign(payload) {
    const prev_hash = hexOf(state.prevLine);
    const record_hash = hexOf(canonicalJson({ ...payload, prev_hash }));
    const signature = edSign(null, Buffer.from(record_hash, "hex"), privateKey).toString("base64");
    return { ...payload, prev_hash, record_hash, signature };
  }

  // header — first line, immediately
  const header = { clotho_weave_header: { pub_key: pubB64, woven_at, repo_head, repository_ref: repo_ref, weave_version: 1 } };
  try {
    writeLine(header);
  } catch (e) { throw poison(e); }

  return {
    header,
    appendEdge(edgeInput) {
      guard();
      try {
        validateEdgeInput(edgeInput, { repositoryRef: repo_ref });
        const payload = { ...edgeInput, woven_at };
        const record = chainAndSign(payload);
        writeLine(record);
        state.edgeHashes.add(record.record_hash);
        if (edgeInput.assertion_status === "deterministic-extraction") state.weaverEdgeIds.add(edgeInput.asserted_by);
        return record;
      } catch (e) { throw poison(e); }
    },
    appendStatus(statusInput) {
      guard();
      try {
        if (statusInput === null || typeof statusInput !== "object" || Array.isArray(statusInput)) throw new TypeError("statusInput: object");
        const keys = Object.keys(statusInput);
        const expected = ["status_of", "new_status", "asserted_by", "assertion_status", "source_ref"];
        for (const k of keys) if (!expected.includes(k)) throw new TypeError(`statusInput: unexpected field '${k}'`);
        for (const k of expected) if (!(k in statusInput)) throw new TypeError(`statusInput: missing field '${k}'`);
        if (typeof statusInput.status_of !== "string" || !HEX64.test(statusInput.status_of)) throw new TypeError("statusInput.status_of: 64-hex record hash");
        if (!state.edgeHashes.has(statusInput.status_of)) throw new TypeError("statusInput.status_of: must reference an earlier edge record in this ledger");
        if (!STATUS_TRANSITIONS.has(statusInput.new_status)) throw new TypeError(`statusInput.new_status: must be one of ${[...STATUS_TRANSITIONS].join("|")}`);
        if (statusInput.asserted_by !== "human") throw new TypeError("statusInput.asserted_by: status transitions must be asserted by 'human'");
        if (statusInput.assertion_status !== "human-authorized") throw new TypeError("statusInput.assertion_status: must be 'human-authorized'");
        validateSourceRef(statusInput.source_ref);
        const payload = { ...statusInput, woven_at };
        const record = chainAndSign(payload);
        writeLine(record);
        return record;
      } catch (e) { throw poison(e); }
    },
    close(coverage) {
      guard();
      try {
        validateCoverage(coverage, state.weaverEdgeIds);
        const payload = { clotho_weave_trailer: coverage, woven_at };
        const record = chainAndSign(payload);
        writeLine(record);
        state.closed = true;
        closeFd();
        return record;
      } catch (e) { throw poison(e); }
    },
    abort() {
      if (state.closed) return; // no-op after a successful close
      state.poisoned = true;
      closeFd();
    }
  };
}

// ---- verifyLedger ------------------------------------------------------------

export async function verifyLedger(ledgerPath) {
  const errors = [];
  const records = [];
  let header = null;
  let manifest = null;
  const push = (m) => errors.push(m);

  let raw;
  try { raw = readFileSync(ledgerPath, "utf8"); } catch (e) { return { ok: false, records, errors: [`read failed: ${e.message}`] }; }

  if (raw.includes("\r")) push("CRLF is not permitted; lines must end in LF");
  if (raw.length === 0 || !raw.endsWith("\n")) push("ledger must end with a final LF");
  const lines = raw.length ? raw.replace(/\n$/, "").split("\n") : [];

  let pubKey = null;
  let repoRef = null;
  let prevLine = null;
  const edgeHashes = new Set();
  let trailerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let obj;
    try { obj = JSON.parse(line); } catch { push(`line ${i + 1}: not valid JSON`); continue; }
    if (canonicalJson(obj) !== line) { push(`line ${i + 1}: not canonical JSON`); continue; }

    if (i === 0) {
      if (!obj.clotho_weave_header) { push("line 1: missing header"); break; }
      const h = obj.clotho_weave_header;
      header = h;
      try {
        pubKey = publicKeyFromB64(h.pub_key);
        repoRef = h.repository_ref;
        if (h.weave_version !== 1) push("header: weave_version must be 1");
        if (!HEX40.test(h.repo_head)) push("header: repo_head must be 40-hex");
        if (new Date(h.woven_at).toISOString() !== h.woven_at) push("header: woven_at not canonical ISO");
      } catch (e) { push(`header: ${e.message}`); }
      prevLine = line;
      continue;
    }
    if (obj.clotho_weave_header) { push(`line ${i + 1}: duplicate header`); continue; }
    if (trailerSeen) { push(`line ${i + 1}: record after trailer (trailer must be final)`); continue; }

    // chain + signature envelope
    const { prev_hash, record_hash, signature, ...payload } = obj;
    if (typeof prev_hash !== "string" || prev_hash !== hexOf(prevLine)) push(`line ${i + 1}: broken chain (prev_hash mismatch)`);
    if (typeof record_hash !== "string" || record_hash !== hexOf(canonicalJson({ ...payload, prev_hash }))) push(`line ${i + 1}: record_hash mismatch`);
    let sigOk = false;
    try { sigOk = typeof signature === "string" && pubKey && edVerify(null, Buffer.from(record_hash, "hex"), pubKey, Buffer.from(signature, "base64")); } catch { sigOk = false; }
    if (!sigOk) push(`line ${i + 1}: invalid signature`);

    if (obj.clotho_weave_trailer) {
      manifest = obj.clotho_weave_trailer;
      try { validateCoverage(manifest, new Set()); } catch (e) { push(`trailer: ${e.message}`); }
      trailerSeen = true;
    } else if ("status_of" in payload) {
      if (!edgeHashes.has(payload.status_of)) push(`line ${i + 1}: status_of does not reference an earlier edge`);
      if (payload.asserted_by !== "human" || payload.assertion_status !== "human-authorized") push(`line ${i + 1}: status must be human-authorized adjudication`);
      if (!STATUS_TRANSITIONS.has(payload.new_status)) push(`line ${i + 1}: invalid new_status`);
    } else {
      // edge record: re-validate structure/endpoints against the header repo ref
      try {
        const { woven_at, ...edgeInput } = payload;
        validateEdgeInput(edgeInput, { repositoryRef: repoRef });
      } catch (e) { push(`line ${i + 1}: ${e.message}`); }
      edgeHashes.add(record_hash);
    }
    records.push(obj);
    prevLine = line;
  }

  if (lines.length > 0 && !trailerSeen) push("ledger has no final trailer");
  return { ok: errors.length === 0, header, manifest, records, errors };
}

// ---- readEdges ---------------------------------------------------------------
// Yields edge records structurally (not trust-conferring — callers verify).

export async function* readEdges(ledgerPath, { openReadStream } = {}) {
  let text;
  if (openReadStream) {
    let buf = "";
    for await (const chunk of openReadStream(ledgerPath)) buf += chunk.toString("utf8");
    text = buf;
  } else {
    text = readFileSync(ledgerPath, "utf8");
  }
  const lines = text.length ? text.replace(/\n$/, "").split("\n") : [];
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.clotho_weave_header || obj.clotho_weave_trailer) continue;
    if ("status_of" in obj) continue;
    yield obj;
  }
}
