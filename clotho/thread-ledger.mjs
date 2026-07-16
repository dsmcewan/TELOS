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
import { openSync, writeSync, fsyncSync, closeSync, readFileSync, mkdirSync, createReadStream } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  canonicalJson, validateEdgeInput, validateSourceRef, deriveRepositoryRef
} from "./registry.mjs";

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const FILE_REF = /^file:(.+)@([0-9a-f]{40})$/;
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
const publicKeyB64 = (pub) => pub.export({ type: "spki", format: "der" }).toString("base64");
const publicKeyFromB64 = (b64) => createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });

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
    write(line) { writeSync(fd, line + "\n"); fsyncSync(fd); },
    close() { closeSync(fd); }
  };
}

// ---- schema validators -------------------------------------------------------

function requireFileRef(ref, label) {
  if (typeof ref !== "string" || !FILE_REF.test(ref)) throw new TypeError(`${label}: expected 'file:<path>@<40-hex>', got ${JSON.stringify(ref)}`);
}

function requireInspectedSourceCounts(counts, state, requiredIds, label) {
  if (!Array.isArray(counts)) throw new TypeError(`${label}: inspected_source_counts must be an array`);
  let prevId = null;
  for (const entry of counts) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw new TypeError(`${label}: count entry must be an object`);
    const keys = Object.keys(entry);
    if (keys.length !== 2 || !("inventory_id" in entry) || !("count" in entry)) throw new TypeError(`${label}: count entry must be exactly {inventory_id, count}`);
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
  if (coverage === null || typeof coverage !== "object" || Array.isArray(coverage)) throw new TypeError("coverage: must be an object");
  const expected = ["weavers", "orchestrator_refs", "inventories_consumed"];
  for (const k of Object.keys(coverage)) if (!expected.includes(k)) throw new TypeError(`coverage: unexpected field '${k}'`);
  for (const k of expected) if (!(k in coverage)) throw new TypeError(`coverage: missing field '${k}'`);

  const { weavers, orchestrator_refs, inventories_consumed } = coverage;
  if (!Array.isArray(weavers) || weavers.length !== 5) throw new TypeError("coverage.weavers: must be exactly five entries");
  for (let i = 0; i < 5; i++) {
    const w = weavers[i];
    if (w === null || typeof w !== "object" || Array.isArray(w)) throw new TypeError("coverage weaver: must be an object");
    const wexpected = ["id", "version", "implementation_refs", "state", "inspected_source_counts"];
    for (const k of Object.keys(w)) if (!wexpected.includes(k)) throw new TypeError(`coverage weaver: unexpected field '${k}'`);
    for (const k of wexpected) if (!(k in w)) throw new TypeError(`coverage weaver: missing field '${k}'`);
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
    if (inv === null || typeof inv !== "object" || Array.isArray(inv)) throw new TypeError("inventories_consumed entry: object");
    const ikeys = Object.keys(inv);
    if (ikeys.length !== 2 || !("id" in inv) || !("source_ref" in inv)) throw new TypeError("inventories_consumed entry: exactly {id, source_ref}");
    if (typeof inv.id !== "string" || inv.id.length === 0) throw new TypeError("inventories_consumed.id: nonempty string");
    requireFileRef(inv.source_ref, "inventories_consumed.source_ref");
  }
}

function validateStatusInput(statusInput, edgeHashes) {
  if (statusInput === null || typeof statusInput !== "object" || Array.isArray(statusInput)) throw new TypeError("statusInput: object");
  const expected = ["status_of", "new_status", "asserted_by", "assertion_status", "source_ref"];
  for (const k of Object.keys(statusInput)) if (!expected.includes(k)) throw new TypeError(`statusInput: unexpected field '${k}'`);
  for (const k of expected) if (!(k in statusInput)) throw new TypeError(`statusInput: missing field '${k}'`);
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

  const woven_at = new Date(wovenAt ?? Date.now()).toISOString();
  const repo_head = repoHead ?? String(git(["rev-parse", "HEAD"])).trim();
  if (!HEX40.test(repo_head)) throw new TypeError(`createLedger: repo_head must be a 40-hex commit, got ${JSON.stringify(repo_head)}`);
  const repo_ref = repositoryRef ?? deriveRepositoryRef(git);

  if (openFile === defaultOpenFile) mkdirSync(path.dirname(path.resolve(ledgerPath)), { recursive: true });
  const handle = openFile(ledgerPath); // wx is the atomic existence gate

  const state = { open: true, closed: false, poisoned: false, prevLine: null, edgeHashes: new Set(), weaverEdgeIds: new Set() };

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
      guard();
      try {
        validateCoverage(coverage, state.weaverEdgeIds);
        const record = chainAndSign({ clotho_weave_trailer: coverage, woven_at });
        writeLine(record);
        state.closed = true;
        closeHandle();
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

export async function verifyLedger(ledgerPath) {
  const errors = [];
  const records = [];
  let header = null;
  let manifest = null;
  let trustBroken = false;
  const fail = (m) => { errors.push(m); trustBroken = true; };

  let raw;
  try { raw = readFileSync(ledgerPath, "utf8"); } catch (e) { return { ok: false, header: null, manifest: null, records, errors: [`read failed: ${e.message}`] }; }

  if (raw.length === 0) return { ok: false, header: null, manifest: null, records, errors: ["empty ledger"] };
  if (raw.includes("\r")) errors.push("CRLF is not permitted; lines must end in LF");
  if (!raw.endsWith("\n")) errors.push("ledger must end with a final LF");
  const lines = raw.replace(/\n$/, "").split("\n");

  let pubKey = null;
  let repoRef = null;
  let prevLine = null;
  const edgeHashes = new Set();
  const weaverEdgeIds = new Set();
  let trailerSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let obj;
    try { obj = JSON.parse(line); } catch { fail(`line ${i + 1}: not valid JSON`); continue; }
    if (canonicalJson(obj) !== line) { fail(`line ${i + 1}: not canonical JSON`); continue; }

    if (i === 0) {
      if (!obj.clotho_weave_header) { fail("line 1: missing header"); break; }
      header = obj.clotho_weave_header;
      try {
        pubKey = publicKeyFromB64(header.pub_key);
        repoRef = header.repository_ref;
        if (header.weave_version !== 1) fail("header: weave_version must be 1");
        if (!HEX40.test(header.repo_head)) fail("header: repo_head must be 40-hex");
        if (new Date(header.woven_at).toISOString() !== header.woven_at) fail("header: woven_at not canonical ISO");
      } catch (e) { fail(`header: ${e.message}`); }
      prevLine = line;
      continue;
    }
    if (obj.clotho_weave_header) { fail(`line ${i + 1}: duplicate header`); continue; }
    if (trailerSeen) { fail(`line ${i + 1}: record after trailer (trailer must be final)`); continue; }

    const { prev_hash, record_hash, signature, ...payload } = obj;
    let lineOk = true;
    const bad = (m) => { fail(m); lineOk = false; };
    if (typeof prev_hash !== "string" || prev_hash !== hexOf(prevLine)) bad(`line ${i + 1}: broken chain (prev_hash mismatch)`);
    if (typeof record_hash !== "string" || record_hash !== hexOf(canonicalJson({ ...payload, prev_hash }))) bad(`line ${i + 1}: record_hash mismatch`);
    let sigOk = false;
    try { sigOk = typeof signature === "string" && !!pubKey && edVerify(null, Buffer.from(record_hash || "", "hex"), pubKey, Buffer.from(signature, "base64")); } catch { sigOk = false; }
    if (!sigOk) bad(`line ${i + 1}: invalid signature`);
    // every record's woven_at must equal the header's single canonical timestamp
    if (payload.woven_at !== header.woven_at) bad(`line ${i + 1}: woven_at does not equal the header woven_at`);

    if (obj.clotho_weave_trailer) {
      manifest = obj.clotho_weave_trailer;
      try { validateCoverage(manifest, weaverEdgeIds); } catch (e) { bad(`trailer: ${e.message}`); }
      trailerSeen = true;
      // trailer is never added to `records`
    } else if ("status_of" in payload) {
      try { validateStatusInput(payload_forStatus(payload), edgeHashes); } catch (e) { bad(`line ${i + 1}: ${e.message}`); }
      if (lineOk && !trustBroken) records.push(obj);
    } else {
      try {
        const edgeInput = withoutWovenAt(payload);
        validateEdgeInput(edgeInput, { repositoryRef: repoRef });
        if (lineOk) {
          edgeHashes.add(record_hash);
          if (payload.assertion_status === "deterministic-extraction") weaverEdgeIds.add(payload.asserted_by);
        }
      } catch (e) { bad(`line ${i + 1}: ${e.message}`); }
      if (lineOk && !trustBroken) records.push(obj);
    }
    prevLine = line;
  }

  if (!trailerSeen) errors.push("ledger has no final trailer");
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
  const stream = openReadStream ? openReadStream(ledgerPath) : createReadStream(ledgerPath, { encoding: "utf8" });
  let buf = "";
  let lineNo = 0;
  for await (const chunk of stream) {
    buf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      lineNo++;
      if (lineNo === 1) continue; // skip header
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      yield obj;
    }
  }
  // A well-formed ledger ends in LF, so any trailing partial line is malformed
  // and is not yielded.
}
