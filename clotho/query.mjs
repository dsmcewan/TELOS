// query.mjs — Clotho's pure query surface (plan v15 Task 5): `threadsOf`,
// `blastRadius`, `why`, and `reportGaps` over the trusted edge and status
// records returned by a successful `verifyLedger`, plus the closed D35/AM-37
// coverage schema. Zero dependencies: Node stdlib only.
//
// NO I/O and NO mutation: every function reads its arguments and returns fresh
// structures; records, manifests, and currentDocs maps are never altered.
// Fail-closed: malformed records, malformed manifests, conflicting descriptors
// for one node id (every stated node id is re-derived from its locator, so a
// descriptor that conflicts with its id throws), unknown kinds, unknown
// statuses, invalid semantic endpoints, invalid node ids, invalid status
// transitions, invalid arguments, and any edge asserted by a weaver whose
// supplied manifest state is not `executed` all throw.
//
// Status records are control records: they resolve effective edge statuses and
// are never returned as facts. Only a valid human-authorized status record may
// override its target edge's initial status; the latest such transition in
// chain order wins. Model- or weaver-authored transition records are malformed.
//
// Coverage (D35/AM-37, closed schema): every `threadsOf`/`blastRadius` result
// carries `coverage: "verified" | "unverified"` — never optional, never
// defaulted. `coverageUnknown: []` is legal ONLY under `coverage: "verified"`
// with a validated manifest proving every consulted producer `executed`; a
// missing manifest yields `coverage: "unverified"` with EVERY consulted
// producer reported unknown — never silently complete. `why`/`reportGaps`
// express coverage through `{gap: "coverage-unknown", weaver, expected_kind}`
// gap records and require a manifest when `expectedKinds` is nonempty.

import { canonicalJson, validateEdgeInput, validateSourceRef, docAddressKey } from "./registry.mjs";
import { validateWeaveManifest } from "./weavers/util.mjs";

const HEX64 = /^[0-9a-f]{64}$/;

// The five weaver ids in their stable declared order (v12 Task 3); consulted
// producers and coverageUnknown are always reported in this order.
const WEAVER_ORDER = [
  "clotho-git-weaver", "clotho-code-weaver", "clotho-test-weaver",
  "clotho-doc-weaver", "clotho-ledger-weaver"
];
const WEAVER_IDS = new Set(WEAVER_ORDER);

// Designated producing weaver per weaver-produced edge kind (`supersedes` is
// human/model-asserted and has no producing weaver).
const KIND_PRODUCER = {
  "introduced-by": "clotho-git-weaver",
  "depends-on": "clotho-code-weaver",
  "verified-by": "clotho-test-weaver",
  "documented-in": "clotho-doc-weaver",
  "motivated-by": "clotho-ledger-weaver",
  "evidenced-by": "clotho-ledger-weaver",
  "discharges": "clotho-ledger-weaver"
};

// `threadsOf` consults every weaver-produced edge kind; `blastRadius` consults
// `depends-on` (traversal) and `verified-by` (evidence) only.
const THREADS_CONSULTED = Object.freeze([...WEAVER_ORDER]);
const BLAST_CONSULTED = Object.freeze(["clotho-code-weaver", "clotho-test-weaver"]);
export const CONSULTED_PRODUCERS = Object.freeze({ threadsOf: THREADS_CONSULTED, blastRadius: BLAST_CONSULTED });

// The closed `expectedKinds` subset (other values, including other registered
// edge kinds, throw) and why's default expected set.
const EXPECTED_KINDS = new Set(["introduced-by", "motivated-by", "documented-in", "evidenced-by", "discharges"]);
const WHY_DEFAULT_EXPECTED = Object.freeze(["introduced-by", "motivated-by", "discharges"]);
const DIRECT_WHY_KINDS = new Set(["introduced-by", "motivated-by", "documented-in", "evidenced-by"]);

const STATUS_TRANSITIONS = new Set(["human-authorized", "rejected", "superseded"]);
const EDGE_RECORD_FIELDS = [
  "edge_kind", "from_node", "to_node", "from_locator", "to_locator",
  "source_ref", "asserted_by", "assertion_status",
  "woven_at", "prev_hash", "record_hash", "signature"
];
const STATUS_RECORD_FIELDS = [
  "status_of", "new_status", "asserted_by", "assertion_status", "source_ref",
  "woven_at", "prev_hash", "record_hash", "signature"
];

// ---- structural helpers ------------------------------------------------------

function isPlainObject(v) {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

// Exactly the expected OWN ENUMERABLE string keys — rejects own symbols, own
// non-enumerable fields, extra fields, and enumerable fields inherited through
// a polluted prototype (registry.requireExactKeys' rigor).
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

function requireNodeId(nodeId, label) {
  if (typeof nodeId !== "string" || !HEX64.test(nodeId)) {
    throw new TypeError(`${label}: nodeId must be a lowercase 64-hex node id, got ${JSON.stringify(nodeId)}`);
  }
}

function readOptions(options, allowed, label) {
  if (options === undefined) return {};
  if (!isPlainObject(options)) throw new TypeError(`${label}: options must be a plain object`);
  if (Object.getOwnPropertySymbols(options).length > 0) throw new TypeError(`${label}: symbol-keyed options are not permitted`);
  for (const k of Object.getOwnPropertyNames(options)) {
    if (!allowed.includes(k)) throw new TypeError(`${label}: unexpected option '${k}'`);
  }
  if (options.includeProposals !== undefined && typeof options.includeProposals !== "boolean") {
    throw new TypeError(`${label}: includeProposals must be a boolean`);
  }
  return options;
}

// ---- record validation -------------------------------------------------------
// `records` must be the trusted edge and status records of ONE successful
// verifyLedger, in chain order: headers/trailers are not query records, every
// stated node id must re-derive from its locator, all records share one
// woven_at and one repository_ref, record hashes are unique, and every status
// record is a human-authorized transition referencing an EARLIER edge record
// (a status-of-status or unknown back-reference is malformed).

function validateRecords(records) {
  if (!Array.isArray(records)) throw new TypeError("query: records must be an array of trusted edge/status records");
  const edges = [];
  const statuses = [];
  const edgeHashes = new Set();
  const allHashes = new Set();
  const repoRefs = new Set();
  let wovenAt;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const label = `records[${i}]`;
    if (!isPlainObject(r)) throw new TypeError(`${label}: must be a plain object`);
    if (Object.prototype.hasOwnProperty.call(r, "clotho_weave_header") || Object.prototype.hasOwnProperty.call(r, "clotho_weave_trailer")) {
      throw new TypeError(`${label}: headers and trailers are not query records`);
    }
    const isStatus = Object.prototype.hasOwnProperty.call(r, "status_of");
    requireExactOwnKeys(r, isStatus ? STATUS_RECORD_FIELDS : EDGE_RECORD_FIELDS, label);

    // envelope fields (chain/signing shape; signatures are not re-verified —
    // trust is conferred by verifyLedger, structure is still fail-closed here)
    for (const field of ["prev_hash", "record_hash"]) {
      if (typeof r[field] !== "string" || !HEX64.test(r[field])) throw new TypeError(`${label}: ${field} must be lowercase 64-hex`);
    }
    if (typeof r.signature !== "string" || r.signature.length === 0) throw new TypeError(`${label}: signature must be a nonempty string`);
    if (allHashes.has(r.record_hash)) throw new TypeError(`${label}: duplicate record_hash`);
    allHashes.add(r.record_hash);
    let iso = null;
    if (typeof r.woven_at === "string") { try { iso = new Date(r.woven_at).toISOString(); } catch { iso = null; } }
    if (iso !== r.woven_at) throw new TypeError(`${label}: woven_at must be a canonical ISO timestamp`);
    if (wovenAt === undefined) wovenAt = r.woven_at;
    else if (r.woven_at !== wovenAt) throw new TypeError(`${label}: woven_at differs across records (one weave owns one timestamp)`);

    if (isStatus) {
      if (typeof r.status_of !== "string" || !HEX64.test(r.status_of)) throw new TypeError(`${label}: status_of must be a 64-hex record hash`);
      if (!STATUS_TRANSITIONS.has(r.new_status)) throw new TypeError(`${label}: unknown status transition ${JSON.stringify(r.new_status)}`);
      if (r.asserted_by !== "human" || r.assertion_status !== "human-authorized") {
        throw new TypeError(`${label}: status transitions must be asserted by 'human' as 'human-authorized' (model- or weaver-authored transitions are malformed)`);
      }
      if (!edgeHashes.has(r.status_of)) {
        throw new TypeError(`${label}: status_of must reference an earlier edge record (a status-of-status or unknown back-reference is malformed)`);
      }
      validateSourceRef(r.source_ref);
      statuses.push(r);
    } else {
      // validateEdgeInput re-derives from_node/to_node from the locators and
      // rejects unknown kinds/statuses, invalid endpoints, malformed locators,
      // and any id/descriptor conflict.
      validateEdgeInput({
        edge_kind: r.edge_kind, from_node: r.from_node, to_node: r.to_node,
        from_locator: r.from_locator, to_locator: r.to_locator,
        source_ref: r.source_ref, asserted_by: r.asserted_by, assertion_status: r.assertion_status
      });
      for (const side of [r.from_locator, r.to_locator]) {
        const ref = side.locator.repository_ref;
        if (ref !== undefined) repoRefs.add(ref);
      }
      edges.push(r);
      edgeHashes.add(r.record_hash);
    }
  }
  if (repoRefs.size > 1) throw new TypeError("query: conflicting repository_ref values across records (records must come from one weave)");
  return { edges, statuses };
}

// ---- effective statuses + fact selection -------------------------------------

function effectiveFacts(edges, statuses, includeProposals) {
  const eff = new Map();
  for (const e of edges) eff.set(e.record_hash, e.assertion_status);
  for (const s of statuses) eff.set(s.status_of, s.new_status); // chain order: latest wins
  const facts = [];
  for (const e of edges) {
    const st = eff.get(e.record_hash);
    if (st === "rejected" || st === "superseded") continue;   // never returned as facts
    if (st === "model-proposal") {
      if (includeProposals) facts.push({ ...e, proposal: true }); // marked copy, never mutated
      continue;
    }
    facts.push(e); // deterministic-extraction | human-authorized
  }
  return facts;
}

// ---- manifest handling (D35/AM-37) -------------------------------------------

// Validate a supplied manifest (structure, states) and its consistency with the
// records: an edge asserted by a weaver whose manifest state is not `executed`
// makes the records/manifest pair invalid. Returns Map<weaverId, state>.
function validateManifestForRecords(manifest, edges) {
  const weaverEdgeIds = new Set();
  for (const e of edges) if (e.assertion_status === "deterministic-extraction") weaverEdgeIds.add(e.asserted_by);
  validateWeaveManifest(manifest, { weaverEdgeIds });
  const stateOf = new Map(manifest.weavers.map((w) => [w.id, w.state]));
  for (const e of edges) {
    if (e.assertion_status !== "deterministic-extraction") continue;
    if (stateOf.get(e.asserted_by) !== "executed") {
      throw new Error(`query: edge asserted by ${e.asserted_by} whose manifest state is not 'executed' makes the records/manifest pair invalid`);
    }
  }
  return stateOf;
}

function resolveCoverage(manifest, edges, consulted) {
  if (manifest === undefined) {
    // A missing manifest never reads as complete: conservatively report EVERY
    // consulted producer unknown.
    return { coverage: "unverified", coverageUnknown: [...consulted] };
  }
  const stateOf = validateManifestForRecords(manifest, edges);
  return { coverage: "verified", coverageUnknown: consulted.filter((w) => stateOf.get(w) !== "executed") };
}

// The closed-schema check (D35 rule 5): a result whose `coverage` is missing,
// outside the two closed values, or contradictory with the consulted producers
// (`"unverified"` not conservatively listing every consulted producer — which
// includes `"unverified"` with an empty `coverageUnknown` while any producer
// was consulted) throws. `threadsOf`/`blastRadius` run their own results
// through this before returning, so such a result cannot be constructed;
// downstream consumers use it to reject fixture results.
export function assertCoverageSchema(result, consultedProducers) {
  if (!isPlainObject(result)) throw new TypeError("assertCoverageSchema: result must be a plain object");
  if (!Array.isArray(consultedProducers)) throw new TypeError("assertCoverageSchema: consultedProducers must be an array of weaver ids");
  const consulted = new Set();
  for (const w of consultedProducers) {
    if (!WEAVER_IDS.has(w)) throw new TypeError(`assertCoverageSchema: unknown consulted producer ${JSON.stringify(w)}`);
    consulted.add(w);
  }
  if (!Object.prototype.hasOwnProperty.call(result, "coverage")) {
    throw new Error("coverage schema violation: the coverage field is missing (it is never optional and never defaults)");
  }
  const c = result.coverage;
  if (c !== "verified" && c !== "unverified") {
    throw new Error(`coverage schema violation: coverage must be exactly "verified" or "unverified", got ${JSON.stringify(c)}`);
  }
  const cu = result.coverageUnknown;
  if (!Array.isArray(cu)) throw new Error("coverage schema violation: coverageUnknown must be an array of weaver ids");
  const listed = new Set();
  for (const w of cu) {
    if (!WEAVER_IDS.has(w)) throw new Error(`coverage schema violation: unknown weaver id ${JSON.stringify(w)} in coverageUnknown`);
    if (listed.has(w)) throw new Error(`coverage schema violation: duplicate weaver id ${JSON.stringify(w)} in coverageUnknown`);
    if (!consulted.has(w)) throw new Error(`coverage schema violation: ${JSON.stringify(w)} is not a consulted producer`);
    listed.add(w);
  }
  if (c === "unverified") {
    for (const w of consulted) {
      if (!listed.has(w)) {
        throw new Error(`coverage schema violation: "unverified" must conservatively list every consulted producer in coverageUnknown (missing ${JSON.stringify(w)})`);
      }
    }
  }
}

// ---- ordering ----------------------------------------------------------------
// The canonical edge tuple orders every returned record group/union/chain; the
// record hash is the final tiebreak so ordering is total and input-order-free.

const tupleOf = (r) => canonicalJson([r.edge_kind, r.from_node, r.to_node, r.source_ref, r.asserted_by, r.assertion_status, r.record_hash]);
const byTuple = (a, b) => { const x = tupleOf(a); const y = tupleOf(b); return x < y ? -1 : x > y ? 1 : 0; };

function dedupByHash(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) { if (!seen.has(r.record_hash)) { seen.add(r.record_hash); out.push(r); } }
  return out;
}

// ---- threadsOf ---------------------------------------------------------------

export function threadsOf(records, nodeId, options = {}) {
  const opts = readOptions(options, ["manifest", "includeProposals"], "threadsOf");
  requireNodeId(nodeId, "threadsOf");
  const { edges, statuses } = validateRecords(records);
  const cov = resolveCoverage(opts.manifest, edges, THREADS_CONSULTED);
  const facts = effectiveFacts(edges, statuses, opts.includeProposals === true);
  const byKind = new Map();
  for (const f of facts) {
    if (f.from_node !== nodeId && f.to_node !== nodeId) continue;
    if (!byKind.has(f.edge_kind)) byKind.set(f.edge_kind, []);
    byKind.get(f.edge_kind).push(f);
  }
  for (const group of byKind.values()) group.sort(byTuple);
  const result = { byKind, coverage: cov.coverage, coverageUnknown: cov.coverageUnknown };
  assertCoverageSchema(result, THREADS_CONSULTED);
  return result;
}

// ---- blastRadius -------------------------------------------------------------
// `affected` is the inverse transitive closure of `depends-on`: cycle-safe BFS
// from the target following `depends-on` edges ONLY in the inverse direction
// (changed dependency -> its consumers). Forward `depends-on` is never
// followed. Evidence is the outgoing `verified-by` set of affected artifacts
// (including the target); a test node contributes evidence but is never
// expanded. `truncated` is true exactly when an inverse-dependency neighbor
// remains unvisited beyond the requested depth — evidence attachment never
// sets it.

export function blastRadius(records, nodeId, depth, options = {}) {
  const opts = readOptions(options, ["manifest", "includeProposals"], "blastRadius");
  requireNodeId(nodeId, "blastRadius");
  if (!Number.isSafeInteger(depth) || depth < 0) {
    throw new TypeError(`blastRadius: depth must be a nonnegative safe integer, got ${JSON.stringify(depth)}`);
  }
  const { edges, statuses } = validateRecords(records);
  const cov = resolveCoverage(opts.manifest, edges, BLAST_CONSULTED);
  const facts = effectiveFacts(edges, statuses, opts.includeProposals === true);

  const inverse = new Map(); // dependency node -> depends-on records pointing at it
  for (const f of facts) {
    if (f.edge_kind !== "depends-on") continue;
    if (!inverse.has(f.to_node)) inverse.set(f.to_node, []);
    inverse.get(f.to_node).push(f);
  }
  for (const list of inverse.values()) list.sort(byTuple);

  const visited = new Set([nodeId]);
  let frontier = [nodeId];
  const traversed = [];
  for (let level = 0; level < depth && frontier.length > 0; level++) {
    const next = [];
    for (const n of frontier) {
      for (const e of inverse.get(n) ?? []) {
        traversed.push(e);
        if (!visited.has(e.from_node)) { visited.add(e.from_node); next.push(e.from_node); }
      }
    }
    frontier = next;
  }
  let truncated = false;
  for (const n of frontier) {
    for (const e of inverse.get(n) ?? []) {
      if (!visited.has(e.from_node)) truncated = true;
    }
  }

  const evidence = facts.filter((f) => f.edge_kind === "verified-by" && visited.has(f.from_node)).sort(byTuple);
  const edgesOut = dedupByHash([...traversed, ...evidence]).sort(byTuple);

  // Unique stable node descriptors for every affected node whose descriptor
  // appears in the records (locators are returned as fresh copies).
  const descriptorOf = new Map();
  for (const e of edges) {
    if (!descriptorOf.has(e.from_node)) descriptorOf.set(e.from_node, e.from_locator);
    if (!descriptorOf.has(e.to_node)) descriptorOf.set(e.to_node, e.to_locator);
  }
  const affected = [];
  for (const id of visited) {
    const d = descriptorOf.get(id);
    if (d === undefined) continue; // a node id absent from every record has no provable descriptor
    const copy = JSON.parse(canonicalJson({ kind: d.kind, locator: d.locator }));
    affected.push({ node: id, kind: copy.kind, locator: copy.locator });
  }
  affected.sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : 0));

  const result = { affected, evidence, edges: edgesOut, truncated, coverage: cov.coverage, coverageUnknown: cov.coverageUnknown };
  assertCoverageSchema(result, BLAST_CONSULTED);
  return result;
}

// ---- why + reportGaps --------------------------------------------------------

function normalizeExpectedKinds(expectedKinds, label) {
  if (!Array.isArray(expectedKinds)) throw new TypeError(`${label}: expectedKinds must be an array`);
  const seen = new Set();
  const out = [];
  for (const k of expectedKinds) {
    if (typeof k !== "string" || !EXPECTED_KINDS.has(k)) {
      throw new TypeError(`${label}: expectedKinds must be a subset of introduced-by|motivated-by|documented-in|evidenced-by|discharges, got ${JSON.stringify(k)}`);
    }
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function validateCurrentDocs(currentDocs, label) {
  if (!(currentDocs instanceof Map)) {
    throw new TypeError(`${label}: currentDocs must be a Map of docAddressKey -> current text_sha256 | null`);
  }
  for (const [key, value] of currentDocs) {
    let ok = false;
    if (typeof key === "string") {
      try {
        const parsed = JSON.parse(key);
        ok = isPlainObject(parsed) && docAddressKey({ path: parsed.path, heading_path: parsed.heading_path }) === key;
      } catch { ok = false; }
    }
    if (!ok) throw new TypeError(`${label}: currentDocs key is not a canonical docAddressKey: ${JSON.stringify(key)}`);
    if (!(value === null || (typeof value === "string" && HEX64.test(value)))) {
      throw new TypeError(`${label}: currentDocs value must be null or lowercase 64-hex, got ${JSON.stringify(value)}`);
    }
  }
}

// The exact spec v2.3 two-hop discharge walk: target `code-symbol ->
// obligation` discharges, then each reached obligation's `obligation ->
// contract-clause` discharges. Cycle-safe (each obligation expanded once);
// direct why kinds are collected alongside.
function whyWalk(facts, nodeId) {
  const direct = [];
  const hop1 = [];
  for (const f of facts) {
    if (f.from_node !== nodeId) continue;
    if (DIRECT_WHY_KINDS.has(f.edge_kind)) direct.push(f);
    else if (f.edge_kind === "discharges" && f.from_locator.kind === "code-symbol") hop1.push(f);
  }
  const obligations = [];
  const seen = new Set();
  for (const e of hop1) if (!seen.has(e.to_node)) { seen.add(e.to_node); obligations.push(e.to_node); }
  const hop2 = [];
  for (const ob of obligations) {
    for (const f of facts) {
      if (f.edge_kind === "discharges" && f.from_node === ob && f.from_locator.kind === "obligation") hop2.push(f);
    }
  }
  return { direct, hop1, obligations, hop2 };
}

export function why(records, nodeId, options = {}) {
  const opts = readOptions(options, ["expectedKinds", "currentDocs", "manifest", "includeProposals"], "why");
  requireNodeId(nodeId, "why");
  const expected = opts.expectedKinds === undefined ? [...WHY_DEFAULT_EXPECTED] : opts.expectedKinds;
  const gaps = reportGaps(records, nodeId, expected, {
    currentDocs: opts.currentDocs, manifest: opts.manifest, includeProposals: opts.includeProposals
  });
  const { edges, statuses } = validateRecords(records);
  const facts = effectiveFacts(edges, statuses, opts.includeProposals === true);
  const walk = whyWalk(facts, nodeId);
  const chain = dedupByHash([...walk.direct, ...walk.hop1, ...walk.hop2]).sort(byTuple);
  return { chain, gaps };
}

export function reportGaps(records, nodeId, expectedKinds, options = {}) {
  const opts = readOptions(options, ["currentDocs", "manifest", "includeProposals"], "reportGaps");
  requireNodeId(nodeId, "reportGaps");
  const kinds = normalizeExpectedKinds(expectedKinds, "reportGaps");
  const { edges, statuses } = validateRecords(records);
  let stateOf = null;
  if (opts.manifest !== undefined) stateOf = validateManifestForRecords(opts.manifest, edges);
  if (kinds.length > 0 && stateOf === null) {
    throw new Error("reportGaps: a verified manifest is required when expectedKinds is nonempty (naming a specific missing relationship requires knowing coverage)");
  }
  if (opts.currentDocs !== undefined) validateCurrentDocs(opts.currentDocs, "reportGaps");
  const facts = effectiveFacts(edges, statuses, opts.includeProposals === true);
  const walk = whyWalk(facts, nodeId);

  const gaps = [];
  for (const k of kinds) {
    const producer = KIND_PRODUCER[k];
    if (stateOf.get(producer) !== "executed") {
      // Missing coverage never becomes a missing-edge claim.
      gaps.push({ gap: "coverage-unknown", weaver: producer, expected_kind: k });
      continue;
    }
    if (k === "discharges") {
      if (walk.hop1.length === 0) {
        gaps.push({ gap: "missing-edge", expected_kind: "discharges", at_node: nodeId });
        continue;
      }
      for (const ob of walk.obligations) {
        if (!walk.hop2.some((f) => f.from_node === ob)) {
          gaps.push({ gap: "missing-edge", expected_kind: "discharges", at_node: ob });
        }
      }
    } else if (!facts.some((f) => f.edge_kind === k && f.from_node === nodeId)) {
      gaps.push({ gap: "missing-edge", expected_kind: k, at_node: nodeId });
    }
  }

  if (opts.currentDocs !== undefined) {
    // Every reached doc-section/contract-clause: documented-in targets plus the
    // discharge walk's clause targets. A missing key, null value (a deleted or
    // ambiguous current address), or changed hash is drift.
    const reached = [];
    for (const f of facts) {
      if (f.edge_kind === "documented-in" && f.from_node === nodeId) reached.push([f.to_node, f.to_locator]);
    }
    for (const f of walk.hop2) reached.push([f.to_node, f.to_locator]);
    for (const [id, desc] of reached) {
      if (desc.kind !== "doc-section" && desc.kind !== "contract-clause") continue;
      const key = docAddressKey({ path: desc.locator.path, heading_path: desc.locator.heading_path });
      const woven = desc.locator.text_sha256;
      const current = currentDocsGet(opts.currentDocs, key);
      if (current !== woven) gaps.push({ gap: "doc-drift", node: id, last_woven_hash: woven });
    }
  }

  const seen = new Set();
  const out = [];
  for (const g of gaps) {
    const cj = canonicalJson(g);
    if (!seen.has(cj)) { seen.add(cj); out.push(g); }
  }
  out.sort((a, b) => { const x = canonicalJson(a); const y = canonicalJson(b); return x < y ? -1 : x > y ? 1 : 0; });
  return out;
}

function currentDocsGet(currentDocs, key) {
  return currentDocs.has(key) ? currentDocs.get(key) : undefined;
}
