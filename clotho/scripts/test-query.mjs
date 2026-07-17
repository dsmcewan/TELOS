#!/usr/bin/env node
// test-query.mjs — Task 5. The frozen query-clause unit surface (plan v15
// sha256:05a48700…, authz-008): touching-edge grouping; malformed input
// rejection; all four depends-on endpoint shapes including traversal through
// repository-file -> code-symbol; BFS depth zero and larger depths; cycles;
// stable node descriptors; forward-dependency non-inclusion; shared-test
// non-propagation; the truncation source (unvisited inverse-dependency
// neighbors only, never evidence attachment); true and false truncation;
// complete why traversal with the two-hop discharge walk; missing target
// concern/documentation/obligation; obligation without clause discharge;
// changed/deleted/ambiguous/unchanged document sections; model-proposal
// default exclusion and opt-in marked inclusion; effective status resolution;
// rejection of model self-promotion and status-of-status records; never
// returning status records or rejected/superseded facts; coverage-unknown vs
// missing-edge; rejection of edges asserted by non-executed weavers; the
// missing-manifest error; the D35/AM-37 closed coverage schema (positive and
// negative); and stable gap ordering. Plain node:assert/strict, no I/O.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { deriveNodeId, canonicalJson, docAddressKey } from "../registry.mjs";
import { threadsOf, blastRadius, why, reportGaps, assertCoverageSchema, CONSULTED_PRODUCERS } from "../query.mjs";

let UNITS = 0;
function unit(name, fn) {
  try { fn(); } catch (e) {
    console.error(`FAILED unit: ${name}`);
    throw e;
  }
  UNITS++;
}

// ---- fixture substrate -------------------------------------------------------

const H40 = "0123456789abcdef0123456789abcdef01234567";
const REPO = "git-root:" + H40;
const SR = "git:" + H40;
const WOVEN = "2026-07-17T00:00:00.000Z";
const hex = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
let seq = 0;
const nextHash = () => hex("record-" + seq++);

const cs = (symbol) => ({ kind: "code-symbol", locator: { repository_ref: REPO, path: "clotho/x.mjs", symbol, blob_sha: H40 } });
const rf = (p) => ({ kind: "repository-file", locator: { repository_ref: REPO, path: p, blob_sha: H40 } });
const tn = (p) => ({ kind: "test", locator: { repository_ref: REPO, path: p, blob_sha: H40 } });
const commitLoc = { kind: "commit", locator: { sha: H40 } };
const concernLoc = (h) => ({ kind: "concern", locator: { repository_ref: REPO, ledger_path: "ledger/concerns.jsonl", entry_hash: h } });
const obligationLoc = (h) => ({ kind: "obligation", locator: { repository_ref: REPO, ledger_path: "ledger/obligations.jsonl", entry_hash: h } });
const docLoc = (p, hp, h) => ({ kind: "doc-section", locator: { repository_ref: REPO, path: p, heading_path: hp, text_sha256: h } });
const clauseLoc = (p, hp, h) => ({ kind: "contract-clause", locator: { repository_ref: REPO, path: p, heading_path: hp, text_sha256: h } });
const runLoc = (h) => ({ kind: "run-evidence", locator: { repository_ref: REPO, path: "docs/runs/demo/summary.json", summary_sha256: h } });
const nid = (loc) => deriveNodeId(loc);

const PRODUCER = {
  "introduced-by": "clotho-git-weaver", "depends-on": "clotho-code-weaver",
  "verified-by": "clotho-test-weaver", "documented-in": "clotho-doc-weaver",
  "motivated-by": "clotho-ledger-weaver", "evidenced-by": "clotho-ledger-weaver",
  "discharges": "clotho-ledger-weaver"
};
function edge(kind, fromLoc, toLoc, patch = {}) {
  const asserted_by = patch.asserted_by ?? (kind === "supersedes" ? "human" : PRODUCER[kind]);
  const assertion_status = patch.assertion_status ??
    (asserted_by === "human" ? "human-authorized" : asserted_by.startsWith("model:") ? "model-proposal" : "deterministic-extraction");
  return {
    edge_kind: kind, from_node: nid(fromLoc), to_node: nid(toLoc),
    from_locator: fromLoc, to_locator: toLoc,
    source_ref: patch.source_ref ?? SR, asserted_by, assertion_status,
    woven_at: patch.woven_at ?? WOVEN, prev_hash: nextHash(), record_hash: nextHash(), signature: "c2ln"
  };
}
const statusRec = (target, new_status, patch = {}) => ({
  status_of: patch.status_of ?? target.record_hash, new_status,
  asserted_by: patch.asserted_by ?? "human",
  assertion_status: patch.assertion_status ?? "human-authorized",
  source_ref: SR, woven_at: WOVEN, prev_hash: nextHash(), record_hash: nextHash(), signature: "c2ln"
});

const WEAVERS = ["clotho-git-weaver", "clotho-code-weaver", "clotho-test-weaver", "clotho-doc-weaver", "clotho-ledger-weaver"];
const REQ = {
  "clotho-git-weaver": ["package-files", "package-symbols"],
  "clotho-code-weaver": ["package-modules"],
  "clotho-test-weaver": ["package-manifests", "test-files"],
  "clotho-doc-weaver": ["doc-files"],
  "clotho-ledger-weaver": ["contract-files", "ledger-sources", "run-sources"]
};
function manifest(states = {}) {
  const w = (id) => {
    const state = states[id] ?? "executed";
    return {
      id, version: 1, implementation_refs: ["file:clotho/weavers/w.mjs@" + H40], state,
      inspected_source_counts: REQ[id].map((inv) => ({ inventory_id: inv, count: state === "executed" ? 1 : 0 }))
    };
  };
  return { weavers: WEAVERS.map(w), orchestrator_refs: ["file:clotho/weave.mjs@" + H40], inventories_consumed: [] };
}
const gapSort = (arr) => [...arr].sort((a, b) => (canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0));

// ---- shared why graph --------------------------------------------------------

const XL = cs("alpha");
const Xid = nid(XL);
const OB1 = obligationLoc(hex("ob1"));
const OB2 = obligationLoc(hex("ob2"));
const DOC_HASH = hex("doc-bytes");
const CLAUSE_HASH = hex("clause-bytes");
const docSecL = docLoc("docs/spec.md", ["Spec", "Alpha"], DOC_HASH);
const clauseSecL = clauseLoc("contracts/core.md", ["Contract", "Alpha clause"], CLAUSE_HASH);
const introduced = edge("introduced-by", XL, commitLoc);
const motivated = edge("motivated-by", XL, concernLoc(hex("concern1")));
const documented = edge("documented-in", XL, docSecL);
const evidenced = edge("evidenced-by", XL, runLoc(hex("run1")));
const disOb1 = edge("discharges", XL, OB1);
const ob1Clause = edge("discharges", OB1, clauseSecL);
const unrelatedDep = edge("depends-on", cs("beta"), cs("gamma"));
const whyRecords = [introduced, motivated, documented, evidenced, disOb1, ob1Clause, unrelatedDep];
const docKey = docAddressKey({ path: "docs/spec.md", heading_path: ["Spec", "Alpha"] });
const clauseKey = docAddressKey({ path: "contracts/core.md", heading_path: ["Contract", "Alpha clause"] });

// ---- 1. threadsOf ------------------------------------------------------------

unit("threadsOf groups every touching edge by kind (from- and to-side)", () => {
  const rfA = rf("clotho/a.mjs");
  const rfB = rf("clotho/bb.mjs");
  const depOut = edge("depends-on", XL, rfA);   // X touching as from
  const depIn = edge("depends-on", rfB, XL);    // X touching as to
  const recs = [introduced, depOut, depIn, motivated, unrelatedDep];
  const r = threadsOf(recs, Xid, { manifest: manifest() });
  assert.ok(r.byKind instanceof Map);
  assert.deepEqual([...r.byKind.keys()].sort(), ["depends-on", "introduced-by", "motivated-by"]);
  assert.deepEqual(new Set(r.byKind.get("depends-on").map((e) => e.record_hash)), new Set([depOut.record_hash, depIn.record_hash]));
  assert.deepEqual(r.byKind.get("introduced-by").map((e) => e.record_hash), [introduced.record_hash]);
  for (const group of r.byKind.values()) {
    assert.ok(!group.some((e) => e.record_hash === unrelatedDep.record_hash), "untouching edge excluded");
  }
});

unit("threadsOf sorts each group by the canonical edge tuple, independent of input order", () => {
  const m1 = edge("motivated-by", XL, concernLoc(hex("c-one")));
  const m2 = edge("motivated-by", XL, concernLoc(hex("c-two")));
  const expected = m1.to_node < m2.to_node ? [m1, m2] : [m2, m1];
  const reversed = [expected[1], expected[0]];
  const r = threadsOf(reversed, Xid, { manifest: manifest() });
  assert.deepEqual(r.byKind.get("motivated-by").map((e) => e.record_hash), expected.map((e) => e.record_hash));
});

unit("threadsOf on an untouched node yields an empty byKind with the coverage field still present", () => {
  const r = threadsOf(whyRecords, "e".repeat(64), { manifest: manifest() });
  assert.equal(r.byKind.size, 0);
  assert.equal(r.coverage, "verified");
  assert.deepEqual(r.coverageUnknown, []);
});

// ---- 2. malformed input rejection --------------------------------------------

unit("records must be an array", () => {
  assert.throws(() => threadsOf(null, Xid), /must be an array/);
  assert.throws(() => threadsOf({}, Xid), /must be an array/);
});
unit("a record must be a plain object", () => {
  assert.throws(() => threadsOf([42], Xid), /plain object/);
});
unit("headers and trailers are not query records", () => {
  assert.throws(() => threadsOf([{ clotho_weave_header: {} }], Xid), /headers and trailers/);
  assert.throws(() => threadsOf([{ clotho_weave_trailer: {} }], Xid), /headers and trailers/);
});
unit("unknown edge kinds are rejected", () => {
  assert.throws(() => threadsOf([{ ...introduced, edge_kind: "references" }], Xid), /unknown edge_kind/);
});
unit("unknown assertion statuses are rejected", () => {
  assert.throws(() => threadsOf([{ ...introduced, assertion_status: "approved" }], Xid), /unknown status/);
});
unit("assertor/status coupling is enforced (a weaver edge cannot be human-authorized)", () => {
  assert.throws(() => threadsOf([{ ...introduced, assertion_status: "human-authorized" }], Xid), /requires deterministic-extraction/);
});
unit("invalid semantic endpoints are rejected", () => {
  const bad = { ...edge("depends-on", XL, cs("other")), edge_kind: "introduced-by" };
  assert.throws(() => threadsOf([bad], Xid), /not a valid introduced-by endpoint/);
});
unit("a stated node id conflicting with its descriptor is rejected", () => {
  assert.throws(() => threadsOf([{ ...introduced, from_node: "0".repeat(64) }], Xid), /does not match derived/);
});
unit("extra record fields are rejected", () => {
  assert.throws(() => threadsOf([{ ...introduced, extra: 1 }], Xid), /unexpected field/);
});
unit("a missing signature is rejected", () => {
  const { signature, ...rest } = introduced;
  assert.throws(() => threadsOf([rest], Xid), /signature|missing field/);
});
unit("duplicate record hashes are rejected", () => {
  assert.throws(() => threadsOf([introduced, introduced], Xid), /duplicate record_hash/);
});
unit("woven_at must be canonical and uniform across records", () => {
  assert.throws(() => threadsOf([{ ...introduced, woven_at: "2026-01-01" }], Xid), /woven_at/);
  const other = edge("motivated-by", XL, concernLoc(hex("cw")), { woven_at: "2026-07-16T00:00:00.000Z" });
  assert.throws(() => threadsOf([introduced, other], Xid), /woven_at differs/);
});
unit("conflicting repository_ref values across records are rejected", () => {
  const REPO2 = "git-root:" + "f".repeat(40);
  const cs2 = { kind: "code-symbol", locator: { repository_ref: REPO2, path: "clotho/x.mjs", symbol: "zeta", blob_sha: H40 } };
  const foreign = edge("introduced-by", cs2, commitLoc);
  assert.throws(() => threadsOf([introduced, foreign], Xid), /conflicting repository_ref/);
});
unit("invalid node ids are rejected", () => {
  for (const bad of ["xyz", Xid.toUpperCase(), Xid.slice(1), 42, null]) {
    assert.throws(() => threadsOf(whyRecords, bad), /64-hex node id/);
  }
});
unit("invalid depth arguments are rejected", () => {
  for (const bad of [-1, 1.5, "2", NaN, Infinity, 2 ** 53]) {
    assert.throws(() => blastRadius(whyRecords, Xid, bad, { manifest: manifest() }), /nonnegative safe integer/);
  }
});
unit("unexpected options are rejected", () => {
  assert.throws(() => threadsOf(whyRecords, Xid, { bogus: 1 }), /unexpected option/);
  assert.throws(() => why(whyRecords, Xid, { depth: 1 }), /unexpected option/);
});
unit("includeProposals must be a boolean", () => {
  assert.throws(() => threadsOf(whyRecords, Xid, { includeProposals: 1 }), /includeProposals/);
});
unit("manifest: null is a malformed manifest, not an absent one", () => {
  assert.throws(() => threadsOf(whyRecords, Xid, { manifest: null }), /plain object/);
});
unit("a manifest omitting a consulted producer's entry is malformed and rejected (D35 negative)", () => {
  const m = manifest(); m.weavers = m.weavers.slice(0, 4);
  assert.throws(() => threadsOf(whyRecords, Xid, { manifest: m }), /exactly five/);
  assert.throws(() => blastRadius(whyRecords, Xid, 1, { manifest: m }), /exactly five/);
});
unit("a manifest with wrong weaver order is rejected", () => {
  const m = manifest(); const t = m.weavers[0]; m.weavers[0] = m.weavers[1]; m.weavers[1] = t;
  assert.throws(() => threadsOf(whyRecords, Xid, { manifest: m }), /expected id/);
});
unit("a manifest with a non-published state is rejected (failed never reaches queries)", () => {
  const m = manifest(); m.weavers[1].state = "failed";
  assert.throws(() => threadsOf(whyRecords, Xid, { manifest: m }), /executed\|skipped/);
});
unit("a skipped weaver carrying nonzero counts is rejected", () => {
  const m = manifest({ "clotho-code-weaver": "skipped" });
  m.weavers[1].inspected_source_counts = [{ inventory_id: "package-modules", count: 3 }];
  assert.throws(() => threadsOf([introduced], Xid, { manifest: m }), /zero counts/);
});
unit("a manifest missing a required field is rejected", () => {
  const m = manifest(); delete m.orchestrator_refs;
  assert.throws(() => threadsOf(whyRecords, Xid, { manifest: m }), /missing field 'orchestrator_refs'/);
});
unit("an edge asserted by a non-executed weaver invalidates the records/manifest pair everywhere", () => {
  const m = manifest({ "clotho-git-weaver": "skipped" });
  assert.throws(() => threadsOf([introduced], Xid, { manifest: m }), /skipped.*asserted an edge/);
  assert.throws(() => blastRadius([introduced], Xid, 1, { manifest: m }), /skipped.*asserted an edge/);
  assert.throws(() => why([introduced], Xid, { manifest: m }), /skipped.*asserted an edge/);
  assert.throws(() => reportGaps([introduced], Xid, [], { manifest: m }), /skipped.*asserted an edge/);
});

// status-record rejections
unit("model self-promotion is rejected (a model cannot author a transition)", () => {
  const prop = edge("documented-in", XL, docLoc("docs/o.md", ["O"], hex("d0")), { asserted_by: "model:grok" });
  assert.throws(() => threadsOf([prop, statusRec(prop, "human-authorized", { asserted_by: "model:grok", assertion_status: "model-proposal" })], Xid), /'human'/);
  assert.throws(() => threadsOf([prop, statusRec(prop, "human-authorized", { asserted_by: "model:grok" })], Xid), /'human'/);
});
unit("weaver-authored transitions are rejected", () => {
  assert.throws(() => threadsOf([introduced, statusRec(introduced, "rejected", { asserted_by: "clotho-git-weaver" })], Xid), /'human'/);
});
unit("a human transition with a non-human-authorized assertion_status is rejected", () => {
  assert.throws(() => threadsOf([introduced, statusRec(introduced, "rejected", { assertion_status: "model-proposal" })], Xid), /'human'/);
});
unit("unknown status transitions are rejected", () => {
  assert.throws(() => threadsOf([introduced, statusRec(introduced, "approved")], Xid), /unknown status transition/);
});
unit("status-of-status records are rejected", () => {
  const s1 = statusRec(introduced, "rejected");
  const s2 = statusRec(introduced, "rejected", { status_of: s1.record_hash });
  assert.throws(() => threadsOf([introduced, s1, s2], Xid), /earlier edge record/);
});
unit("a transition referencing an unknown or later edge is rejected", () => {
  assert.throws(() => threadsOf([introduced, statusRec(introduced, "rejected", { status_of: "a".repeat(64) })], Xid), /earlier edge record/);
  assert.throws(() => threadsOf([statusRec(introduced, "rejected"), introduced], Xid), /earlier edge record/);
});

// ---- 3. blastRadius ----------------------------------------------------------

const hubL = cs("hub");
const hubId = nid(hubL);
const consumerAL = cs("consumerA");
const fileBL = rf("clotho/b.mjs");
const consumerCL = cs("consumerC");
const fileDL = rf("clotho/d.mjs");
const deepGL = cs("deepG");
const fwdL = rf("clotho/fwd.mjs");
const sibL = cs("sibling");
const depA = edge("depends-on", consumerAL, hubL);   // cs -> cs
const depB = edge("depends-on", fileBL, hubL);       // rf -> cs
const depC = edge("depends-on", consumerCL, fileBL); // cs -> rf
const depD = edge("depends-on", fileDL, fileBL);     // rf -> rf
const depG = edge("depends-on", deepGL, consumerCL); // beyond depth 2
const depFwd = edge("depends-on", hubL, fwdL);       // hub's OWN dependency (forward)
const evHub = edge("verified-by", hubL, tn("clotho/scripts/t0.test.mjs"));
const evA = edge("verified-by", consumerAL, tn("clotho/scripts/t1.test.mjs"));
const evSib = edge("verified-by", sibL, tn("clotho/scripts/t1.test.mjs")); // shares hub's consumer's test
const blastRecords = [depA, depB, depC, depD, depG, depFwd, evHub, evA, evSib];
const mAll = manifest();

unit("all four depends-on endpoint shapes traverse, including through repository-file -> code-symbol", () => {
  const r = blastRadius(blastRecords, hubId, 2, { manifest: mAll });
  assert.deepEqual(new Set(r.affected.map((a) => a.node)),
    new Set([hubId, nid(consumerAL), nid(fileBL), nid(consumerCL), nid(fileDL)]));
  assert.deepEqual(new Set(r.edges.map((e) => e.record_hash)),
    new Set([depA, depB, depC, depD, evHub, evA].map((e) => e.record_hash)));
});

unit("BFS depth zero: only the target, evidence still attaches, edges carry evidence only", () => {
  const r = blastRadius(blastRecords, hubId, 0, { manifest: mAll });
  assert.deepEqual(r.affected.map((a) => a.node), [hubId]);
  assert.deepEqual(r.evidence.map((e) => e.record_hash), [evHub.record_hash]);
  assert.deepEqual(r.edges.map((e) => e.record_hash), [evHub.record_hash]);
  assert.equal(r.truncated, true, "unvisited inverse neighbors beyond depth 0");
});

unit("larger depths reach transitively and clear truncation at the fixed point", () => {
  const r = blastRadius(blastRecords, hubId, 3, { manifest: mAll });
  assert.ok(r.affected.some((a) => a.node === nid(deepGL)), "depth 3 reaches deepG");
  assert.equal(r.truncated, false);
});

unit("cycles terminate with each member exactly once", () => {
  const cxL = cs("cycX"); const cyL = cs("cycY");
  const recs = [edge("depends-on", cxL, cyL), edge("depends-on", cyL, cxL)];
  const r = blastRadius(recs, nid(cyL), 9, { manifest: mAll });
  assert.deepEqual(new Set(r.affected.map((a) => a.node)), new Set([nid(cxL), nid(cyL)]));
  assert.equal(r.affected.length, 2);
  assert.equal(r.truncated, false);
});

unit("stable node descriptors: unique, sorted, fresh copies, input-order independent", () => {
  const dxL = cs("diaX"), dbL = cs("diaB"), dcL = cs("diaC"), ddL = cs("diaD");
  const recs = [edge("depends-on", dbL, dxL), edge("depends-on", dcL, dxL), edge("depends-on", ddL, dbL), edge("depends-on", ddL, dcL)];
  const r = blastRadius(recs, nid(dxL), 2, { manifest: mAll });
  const expected = [dxL, dbL, dcL, ddL].map((l) => ({ node: nid(l), kind: l.kind, locator: l.locator }))
    .sort((a, b) => (a.node < b.node ? -1 : 1));
  assert.deepEqual(r.affected, expected);
  assert.equal(r.affected.filter((a) => a.node === nid(ddL)).length, 1, "diamond-reached node appears once");
  const dEntry = r.affected.find((a) => a.node === nid(dxL));
  assert.notEqual(dEntry.locator, dxL.locator, "descriptor locators are fresh copies, never the caller's objects");
  const r2 = blastRadius([...recs].reverse(), nid(dxL), 2, { manifest: mAll });
  assert.deepEqual(r2.affected, r.affected);
  assert.deepEqual(r2.edges.map((e) => e.record_hash), r.edges.map((e) => e.record_hash), "stable union order is input-order independent");
});

unit("forward-dependency non-inclusion: the target's own dependency never breaks", () => {
  const r = blastRadius(blastRecords, hubId, 5, { manifest: mAll });
  assert.ok(!r.affected.some((a) => a.node === nid(fwdL)), "forward depends-on target absent from affected");
  assert.ok(!r.edges.some((e) => e.record_hash === depFwd.record_hash), "forward edge never traversed");
});

unit("shared-test non-propagation: a test node contributes evidence but is never expanded", () => {
  const r = blastRadius(blastRecords, hubId, 5, { manifest: mAll });
  assert.ok(!r.affected.some((a) => a.node === nid(sibL)), "test co-coverage cannot pull sibling artifacts into affected");
  assert.ok(!r.evidence.some((e) => e.record_hash === evSib.record_hash), "only affected artifacts' evidence is attached");
  assert.deepEqual(new Set(r.evidence.map((e) => e.record_hash)), new Set([evHub.record_hash, evA.record_hash]));
  assert.ok(!r.affected.some((a) => a.kind === "test"), "test nodes never enter affected");
});

unit("truncation source: set only by unvisited inverse-dependency neighbors (true and false truncation)", () => {
  assert.equal(blastRadius(blastRecords, hubId, 1, { manifest: mAll }).truncated, true);
  assert.equal(blastRadius(blastRecords, hubId, 2, { manifest: mAll }).truncated, true, "deepG unvisited beyond depth 2");
  assert.equal(blastRadius(blastRecords, hubId, 3, { manifest: mAll }).truncated, false);
});

unit("truncated is not set when only evidence attachment remains", () => {
  const qL = cs("evTargetQ"); const pL = cs("evConsumerP");
  const depPQ = edge("depends-on", pL, qL);
  const evP = edge("verified-by", pL, tn("clotho/scripts/tev.test.mjs"));
  const r = blastRadius([depPQ, evP], nid(qL), 1, { manifest: mAll });
  assert.equal(r.truncated, false);
  assert.deepEqual(r.evidence.map((e) => e.record_hash), [evP.record_hash]);
});

unit("false truncation: an already-visited neighbor at the boundary does not truncate", () => {
  const x3L = cs("bndX"); const a3L = cs("bndA");
  const recs = [edge("depends-on", a3L, x3L), edge("depends-on", x3L, a3L)];
  const r = blastRadius(recs, nid(x3L), 1, { manifest: mAll });
  assert.equal(r.truncated, false, "the boundary neighbor is the visited target itself");
});

unit("an unknown (but well-formed) target yields empty results, never an error", () => {
  const r = blastRadius(blastRecords, "e".repeat(64), 3, { manifest: mAll });
  assert.deepEqual(r.affected, []);
  assert.deepEqual(r.evidence, []);
  assert.deepEqual(r.edges, []);
  assert.equal(r.truncated, false);
  assert.equal(r.coverage, "verified");
});

// ---- 4. why + reportGaps -----------------------------------------------------

unit("complete why traversal including the two-hop discharge walk (code-symbol -> obligation -> contract-clause)", () => {
  const r = why(whyRecords, Xid, { manifest: manifest() });
  assert.deepEqual(new Set(r.chain.map((e) => e.record_hash)),
    new Set([introduced, motivated, documented, evidenced, disOb1, ob1Clause].map((e) => e.record_hash)));
  assert.ok(!r.chain.some((e) => e.record_hash === unrelatedDep.record_hash));
  assert.ok(!r.chain.some((e) => "status_of" in e));
  assert.deepEqual(r.gaps, []);
});

unit("the chain is stable and input-order independent", () => {
  const a = why(whyRecords, Xid, { manifest: manifest() });
  const b = why([...whyRecords].reverse(), Xid, { manifest: manifest() });
  assert.deepEqual(b.chain.map((e) => e.record_hash), a.chain.map((e) => e.record_hash));
});

unit("the discharge walk is cycle-safe: a twice-reached obligation is expanded once", () => {
  const disOb1b = edge("discharges", XL, OB1, { source_ref: "git:" + "f".repeat(40) });
  const r = why([disOb1, disOb1b, ob1Clause], Xid, { manifest: manifest() });
  assert.deepEqual(new Set(r.chain.map((e) => e.record_hash)),
    new Set([disOb1, disOb1b, ob1Clause].map((e) => e.record_hash)));
  assert.equal(r.chain.filter((e) => e.record_hash === ob1Clause.record_hash).length, 1);
});

unit("a missing target concern produces a stable missing-edge gap (why defaults)", () => {
  const recs = [introduced, documented, evidenced, disOb1, ob1Clause];
  const r = why(recs, Xid, { manifest: manifest() });
  assert.deepEqual(r.gaps, [{ gap: "missing-edge", expected_kind: "motivated-by", at_node: Xid }]);
});

unit("missing target documentation produces a missing-edge gap", () => {
  const gaps = reportGaps([introduced, motivated], Xid, ["documented-in"], { manifest: manifest() });
  assert.deepEqual(gaps, [{ gap: "missing-edge", expected_kind: "documented-in", at_node: Xid }]);
});

unit("a missing target obligation produces a missing-edge gap at the target", () => {
  const gaps = reportGaps([introduced, motivated], Xid, ["discharges"], { manifest: manifest() });
  assert.deepEqual(gaps, [{ gap: "missing-edge", expected_kind: "discharges", at_node: Xid }]);
});

unit("an obligation without a clause discharge produces a missing-edge gap at the obligation", () => {
  const disOb2 = edge("discharges", XL, OB2);
  const gaps = reportGaps([disOb1, ob1Clause, disOb2], Xid, ["discharges"], { manifest: manifest() });
  assert.deepEqual(gaps, [{ gap: "missing-edge", expected_kind: "discharges", at_node: nid(OB2) }]);
});

unit("a fully discharged obligation chain produces no discharge gap; gaps never stop other branches", () => {
  assert.deepEqual(reportGaps([disOb1, ob1Clause], Xid, ["discharges"], { manifest: manifest() }), []);
  const disOb2 = edge("discharges", XL, OB2);
  const gaps = reportGaps([disOb2], Xid, ["discharges", "motivated-by"], { manifest: manifest() });
  assert.deepEqual(gapSort([
    { gap: "missing-edge", expected_kind: "discharges", at_node: nid(OB2) },
    { gap: "missing-edge", expected_kind: "motivated-by", at_node: Xid }
  ]), gaps);
});

unit("coverage-unknown gaps for skipped weavers versus missing-edge for executed ones", () => {
  const skipLedger = manifest({ "clotho-ledger-weaver": "skipped" });
  const a = reportGaps([introduced], Xid, ["introduced-by", "motivated-by"], { manifest: skipLedger });
  assert.deepEqual(a, [{ gap: "coverage-unknown", weaver: "clotho-ledger-weaver", expected_kind: "motivated-by" }]);
  const b = reportGaps([introduced], Xid, ["introduced-by", "motivated-by"], { manifest: manifest() });
  assert.deepEqual(b, [{ gap: "missing-edge", expected_kind: "motivated-by", at_node: Xid }]);
});

unit("a skipped doc-weaver yields the flagship coverage-unknown shape, never a missing-edge claim", () => {
  const gaps = reportGaps([introduced], Xid, ["documented-in"], { manifest: manifest({ "clotho-doc-weaver": "skipped" }) });
  assert.deepEqual(gaps, [{ gap: "coverage-unknown", weaver: "clotho-doc-weaver", expected_kind: "documented-in" }]);
});

unit("a non-consulted skipped weaver is not reported by reportGaps", () => {
  const gaps = reportGaps([motivated], Xid, ["motivated-by"], { manifest: manifest({ "clotho-git-weaver": "skipped" }) });
  assert.deepEqual(gaps, []);
});

unit("the missing-manifest error for expected-kind queries (and its empty-set exemption)", () => {
  assert.throws(() => why(whyRecords, Xid, {}), /verified manifest is required/);
  assert.throws(() => reportGaps(whyRecords, Xid, ["motivated-by"], {}), /verified manifest is required/);
  assert.deepEqual(reportGaps(whyRecords, Xid, [], {}), []);
});

unit("expectedKinds is a closed subset: other values, including other registered kinds, throw", () => {
  for (const bad of [["depends-on"], ["verified-by"], ["supersedes"], ["bogus"], [1], "introduced-by", null]) {
    assert.throws(() => reportGaps(whyRecords, Xid, bad, { manifest: manifest() }), /expectedKinds/);
  }
  assert.throws(() => why(whyRecords, Xid, { expectedKinds: ["depends-on"], manifest: manifest() }), /expectedKinds/);
});

unit("expectedKinds is deduplicated: a repeated kind yields one gap", () => {
  const gaps = reportGaps([introduced], Xid, ["motivated-by", "motivated-by"], { manifest: manifest() });
  assert.deepEqual(gaps, [{ gap: "missing-edge", expected_kind: "motivated-by", at_node: Xid }]);
});

unit("why defaults are introduced-by, motivated-by, and discharges — not the flagship extras", () => {
  const r = why([], Xid, { manifest: manifest() });
  assert.deepEqual(r.chain, []);
  assert.deepEqual(r.gaps, [
    { gap: "missing-edge", expected_kind: "discharges", at_node: Xid },
    { gap: "missing-edge", expected_kind: "introduced-by", at_node: Xid },
    { gap: "missing-edge", expected_kind: "motivated-by", at_node: Xid }
  ]);
  assert.ok(!r.gaps.some((g) => g.expected_kind === "documented-in" || g.expected_kind === "evidenced-by"));
});

unit("doc drift: an unchanged section emits no gap", () => {
  const docs = new Map([[docKey, DOC_HASH], [clauseKey, CLAUSE_HASH]]);
  assert.deepEqual(reportGaps(whyRecords, Xid, [], { currentDocs: docs }), []);
});
unit("doc drift: a changed section hash emits doc-drift", () => {
  const docs = new Map([[docKey, hex("changed")], [clauseKey, CLAUSE_HASH]]);
  assert.deepEqual(reportGaps(whyRecords, Xid, [], { currentDocs: docs }),
    [{ gap: "doc-drift", node: nid(docSecL), last_woven_hash: DOC_HASH }]);
});
unit("doc drift: a deleted section (missing key) emits doc-drift", () => {
  const docs = new Map([[clauseKey, CLAUSE_HASH]]);
  assert.deepEqual(reportGaps(whyRecords, Xid, [], { currentDocs: docs }),
    [{ gap: "doc-drift", node: nid(docSecL), last_woven_hash: DOC_HASH }]);
});
unit("doc drift: an ambiguous section (null value) emits doc-drift", () => {
  const docs = new Map([[docKey, null], [clauseKey, CLAUSE_HASH]]);
  assert.deepEqual(reportGaps(whyRecords, Xid, [], { currentDocs: docs }),
    [{ gap: "doc-drift", node: nid(docSecL), last_woven_hash: DOC_HASH }]);
});
unit("doc drift reaches contract clauses through the discharge walk", () => {
  const docs = new Map([[docKey, DOC_HASH], [clauseKey, hex("clause-changed")]]);
  assert.deepEqual(reportGaps(whyRecords, Xid, [], { currentDocs: docs }),
    [{ gap: "doc-drift", node: nid(clauseSecL), last_woven_hash: CLAUSE_HASH }]);
});
unit("malformed currentDocs are rejected", () => {
  assert.throws(() => reportGaps(whyRecords, Xid, [], { currentDocs: { [docKey]: DOC_HASH } }), /currentDocs/);
  assert.throws(() => reportGaps(whyRecords, Xid, [], { currentDocs: new Map([[docKey, "not-hex"]]) }), /currentDocs/);
  assert.throws(() => reportGaps(whyRecords, Xid, [], { currentDocs: new Map([["not-a-key", DOC_HASH]]) }), /currentDocs/);
});

unit("gaps are deduplicated and stably ordered, independent of input order", () => {
  const docs = new Map([[clauseKey, CLAUSE_HASH]]); // doc section deleted
  const opts = { manifest: manifest({ "clotho-ledger-weaver": "skipped" }), currentDocs: docs };
  const kinds = ["motivated-by", "discharges", "documented-in", "evidenced-by"];
  const recs = [introduced, documented];
  const a = reportGaps(recs, Xid, kinds, opts);
  const expected = gapSort([
    { gap: "coverage-unknown", weaver: "clotho-ledger-weaver", expected_kind: "motivated-by" },
    { gap: "coverage-unknown", weaver: "clotho-ledger-weaver", expected_kind: "discharges" },
    { gap: "coverage-unknown", weaver: "clotho-ledger-weaver", expected_kind: "evidenced-by" },
    { gap: "doc-drift", node: nid(docSecL), last_woven_hash: DOC_HASH }
  ]);
  assert.deepEqual(a, expected);
  assert.deepEqual(reportGaps([...recs].reverse(), Xid, [...kinds].reverse(), opts), a);
});

// ---- 5. status filtering -----------------------------------------------------

const doc2L = docLoc("docs/other.md", ["Other"], hex("doc2"));
const propEdge = edge("documented-in", XL, doc2L, { asserted_by: "model:grok" });

unit("model-proposal records are excluded by default", () => {
  const r = threadsOf([propEdge], Xid, { manifest: manifest() });
  assert.equal(r.byKind.size, 0);
  const w = why([propEdge], Xid, { expectedKinds: [], manifest: manifest() });
  assert.deepEqual(w.chain, []);
});

unit("includeProposals: true includes unresolved proposals marked proposal: true, without mutating the record", () => {
  const r = threadsOf([propEdge], Xid, { includeProposals: true, manifest: manifest() });
  const group = r.byKind.get("documented-in");
  assert.equal(group.length, 1);
  assert.equal(group[0].proposal, true);
  assert.equal(group[0].record_hash, propEdge.record_hash);
  assert.notEqual(group[0], propEdge, "a marked copy is returned");
  assert.ok(!Object.prototype.hasOwnProperty.call(propEdge, "proposal"), "the caller's record is never mutated");
});

unit("effective status resolution: a human-accepted proposal is an ordinary fact", () => {
  const r = threadsOf([propEdge, statusRec(propEdge, "human-authorized")], Xid, { manifest: manifest() });
  const group = r.byKind.get("documented-in");
  assert.equal(group.length, 1);
  assert.equal(group[0], propEdge, "accepted proposals are returned as ordinary facts");
  assert.ok(!Object.prototype.hasOwnProperty.call(group[0], "proposal"));
});

unit("effective status resolution: a rejected edge is excluded and reads as missing", () => {
  const recs = [motivated, statusRec(motivated, "rejected")];
  const r = threadsOf(recs, Xid, { manifest: manifest() });
  assert.equal(r.byKind.size, 0);
  const gaps = reportGaps(recs, Xid, ["motivated-by"], { manifest: manifest() });
  assert.deepEqual(gaps, [{ gap: "missing-edge", expected_kind: "motivated-by", at_node: Xid }]);
});

unit("the latest human transition in chain order wins", () => {
  const accepted = [propEdge, statusRec(propEdge, "rejected"), statusRec(propEdge, "human-authorized")];
  assert.equal(threadsOf(accepted, Xid, { manifest: manifest() }).byKind.get("documented-in").length, 1);
  const rejected = [propEdge, statusRec(propEdge, "human-authorized"), statusRec(propEdge, "rejected")];
  assert.equal(threadsOf(rejected, Xid, { manifest: manifest(), includeProposals: true }).byKind.size, 0,
    "rejected edges are never returned, even with includeProposals");
});

unit("superseded facts are never returned", () => {
  const recs = [motivated, statusRec(motivated, "superseded")];
  assert.equal(threadsOf(recs, Xid, { manifest: manifest() }).byKind.size, 0);
});

unit("status records are never returned as facts by any query", () => {
  const recs = [motivated, depA, evA, statusRec(motivated, "human-authorized")];
  const t = threadsOf(recs, Xid);
  for (const group of t.byKind.values()) assert.ok(!group.some((e) => "status_of" in e));
  const b = blastRadius(recs, hubId, 2);
  assert.ok(![...b.evidence, ...b.edges].some((e) => "status_of" in e));
  const w = why(recs, Xid, { expectedKinds: [] });
  assert.ok(!w.chain.some((e) => "status_of" in e));
});

// ---- 6. D35/AM-37 closed coverage schema -------------------------------------

unit("D35 positive: threadsOf with a verified manifest and all consulted producers executed", () => {
  const r = threadsOf(whyRecords, Xid, { manifest: manifest() });
  assert.equal(r.coverage, "verified");
  assert.deepEqual(r.coverageUnknown, []);
});

unit("D35 positive: blastRadius verified with exactly its consulted producers executed", () => {
  const depOnly = [depA, depB];
  const m = manifest({ "clotho-git-weaver": "skipped", "clotho-doc-weaver": "skipped", "clotho-ledger-weaver": "skipped" });
  const r = blastRadius(depOnly, hubId, 1, { manifest: m });
  assert.equal(r.coverage, "verified");
  assert.deepEqual(r.coverageUnknown, [], "non-consulted skipped producers never pollute blastRadius coverage");
  const t = threadsOf(depOnly, hubId, { manifest: m });
  assert.equal(t.coverage, "verified");
  assert.deepEqual(t.coverageUnknown, ["clotho-git-weaver", "clotho-doc-weaver", "clotho-ledger-weaver"],
    "threadsOf consults every producer, in stable weaver order");
});

unit("D35 positive: one consulted producer skipped appears in coverageUnknown under verified", () => {
  const depOnly = [depA, depB];
  const r = blastRadius(depOnly, hubId, 1, { manifest: manifest({ "clotho-test-weaver": "skipped" }) });
  assert.equal(r.coverage, "verified");
  assert.deepEqual(r.coverageUnknown, ["clotho-test-weaver"]);
  const t = threadsOf([introduced], Xid, { manifest: manifest({ "clotho-doc-weaver": "skipped" }) });
  assert.equal(t.coverage, "verified");
  assert.deepEqual(t.coverageUnknown, ["clotho-doc-weaver"]);
});

unit("D35 negative: a missing manifest yields unverified with EVERY consulted producer — never empty", () => {
  const t = threadsOf(whyRecords, Xid);
  assert.equal(t.coverage, "unverified");
  assert.deepEqual(t.coverageUnknown, WEAVERS);
  assert.ok(t.coverageUnknown.length > 0, "asserted non-empty: producers were consulted");
  const b = blastRadius([depA, depB], hubId, 1);
  assert.equal(b.coverage, "unverified");
  assert.deepEqual(b.coverageUnknown, ["clotho-code-weaver", "clotho-test-weaver"]);
  assert.ok(b.coverageUnknown.length > 0);
});

unit("D35 negative: fixture results with a missing, unknown, or contradictory coverage value fail schema validation", () => {
  const consulted = ["clotho-code-weaver", "clotho-test-weaver"];
  // positives first: the validator accepts what the queries construct
  assertCoverageSchema({ coverage: "verified", coverageUnknown: [] }, consulted);
  assertCoverageSchema({ coverage: "verified", coverageUnknown: ["clotho-test-weaver"] }, consulted);
  assertCoverageSchema({ coverage: "unverified", coverageUnknown: consulted }, consulted);
  // missing / unknown values
  assert.throws(() => assertCoverageSchema({ coverageUnknown: [] }, consulted), /coverage schema violation.*missing/);
  assert.throws(() => assertCoverageSchema({ coverage: "complete", coverageUnknown: [] }, consulted), /coverage schema violation/);
  assert.throws(() => assertCoverageSchema({ coverage: "Verified", coverageUnknown: [] }, consulted), /coverage schema violation/);
  assert.throws(() => assertCoverageSchema({ coverage: true, coverageUnknown: [] }, consulted), /coverage schema violation/);
  // the impossible pairing: unverified + empty coverageUnknown while producers were consulted
  assert.throws(() => assertCoverageSchema({ coverage: "unverified", coverageUnknown: [] }, consulted), /conservatively list every consulted producer/);
  assert.throws(() => assertCoverageSchema({ coverage: "unverified", coverageUnknown: ["clotho-code-weaver"] }, consulted), /conservatively list every consulted producer/);
  // structural contradictions
  assert.throws(() => assertCoverageSchema({ coverage: "verified", coverageUnknown: ["clotho-doc-weaver"] }, consulted), /not a consulted producer/);
  assert.throws(() => assertCoverageSchema({ coverage: "verified", coverageUnknown: "none" }, consulted), /must be an array/);
  assert.throws(() => assertCoverageSchema({ coverage: "verified", coverageUnknown: ["nope"] }, consulted), /unknown weaver id/);
  assert.throws(() => assertCoverageSchema({ coverage: "unverified", coverageUnknown: [...consulted, "clotho-code-weaver"] }, consulted), /duplicate/);
});

unit("the exported consulted-producer sets match the query semantics", () => {
  assert.deepEqual([...CONSULTED_PRODUCERS.threadsOf], WEAVERS);
  assert.deepEqual([...CONSULTED_PRODUCERS.blastRadius], ["clotho-code-weaver", "clotho-test-weaver"]);
});

// ---- 7. no mutation ----------------------------------------------------------

unit("queries never mutate records, manifests, or currentDocs", () => {
  const recs = [...whyRecords, propEdge, statusRec(propEdge, "human-authorized")];
  const m = manifest();
  const docs = new Map([[docKey, DOC_HASH], [clauseKey, CLAUSE_HASH]]);
  const before = canonicalJson(recs) + "|" + canonicalJson(m) + "|" + canonicalJson([...docs]);
  threadsOf(recs, Xid, { manifest: m, includeProposals: true });
  blastRadius(recs, Xid, 3, { manifest: m });
  why(recs, Xid, { manifest: m, currentDocs: docs, includeProposals: true });
  reportGaps(recs, Xid, ["introduced-by", "documented-in"], { manifest: m, currentDocs: docs });
  const after = canonicalJson(recs) + "|" + canonicalJson(m) + "|" + canonicalJson([...docs]);
  assert.equal(after, before);
});

console.log(`test-query: all assertions passed (${UNITS} units)`);
