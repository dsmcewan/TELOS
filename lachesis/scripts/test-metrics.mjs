// test-metrics.mjs — discriminating oracle for Lachesis. Synthetic fixtures pin each semantic;
// GOLDEN values + independent tallies from the committed snapshot pin loader field-mapping and
// orientation to reality; ingestion negatives isolate each rejection branch (with message checks).
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWeave, EDGE_KINDS } from "../ingest.mjs";
import { dependencies, blastRadius, relevance, riskClass, assess } from "../measure.mjs";
import { canonicalize } from "../../merkle-dag/vendor.mjs"; // fixtures must be canonical for the loader

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
let passes = 0, fails = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { fails++; console.error("FAIL:", msg); } };
const throws = (fn, msg, re) => {
  try { fn(); fails++; console.error("FAIL (expected throw):", msg); }
  catch (e) { if (re && !re.test(String(e.message))) { fails++; console.error(`FAIL (wrong error for ${msg}):`, e.message); } else passes++; }
};

const hid = (i) => i.toString(16).padStart(64, "0");
const e = (from, to, kind) => ({ edge_kind: kind, from: hid(from), to: hid(to) });
const wv = (edges) => {
  const nodes = new Map();
  for (const ed of edges) { nodes.set(ed.from, { kind: "code-symbol", locator: { n: ed.from } }); nodes.set(ed.to, { kind: "code-symbol", locator: { n: ed.to } }); }
  return { header: { pub_key: "x" }, nodes, edges };
};

// ---- direction ----
{
  const w = wv([e(1, 2, "depends-on")]);
  ok([...dependencies(w, hid(1))].join() === hid(2), "direction: dependencies(1)={2}");
  ok(dependencies(w, hid(2)).size === 0, "direction: dependencies(2)={}");
  ok([...blastRadius(w, hid(2)).nodes].join() === hid(1), "direction: blastRadius(2)={1}");
  ok(blastRadius(w, hid(1)).count === 0, "direction: blastRadius(1)=0");
}
// ---- transitivity (membership) ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 2 && d.has(hid(2)) && d.has(hid(3)), "transitivity: dependencies(1)={2,3}");
  const b = blastRadius(w, hid(3)).nodes;
  ok(b.size === 2 && b.has(hid(1)) && b.has(hid(2)), "transitivity: blastRadius(3)={1,2}");
}
// ---- cycle (2-cycle, 3-cycle), self-excluded + terminating ----
{
  const w2 = wv([e(1, 2, "depends-on"), e(2, 1, "depends-on")]);
  ok(dependencies(w2, hid(1)).size === 1 && dependencies(w2, hid(1)).has(hid(2)), "2-cycle: dependencies(1)={2}");
  ok(blastRadius(w2, hid(1)).nodes.size === 1 && blastRadius(w2, hid(1)).nodes.has(hid(2)), "2-cycle: blastRadius(1)={2}");
  const w3 = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on"), e(3, 1, "depends-on")]);
  const d = dependencies(w3, hid(1));
  ok(d.size === 2 && d.has(hid(2)) && d.has(hid(3)) && !d.has(hid(1)), "3-cycle: dependencies(1)={2,3}, terminates");
}
// ---- diamond (multi-path, unique-node counting) ----
{
  const w = wv([e(1, 2, "depends-on"), e(1, 3, "depends-on"), e(2, 4, "depends-on"), e(3, 4, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 3 && d.has(hid(2)) && d.has(hid(3)) && d.has(hid(4)), "diamond: dependencies(1)={2,3,4} (4 counted once)");
  ok(blastRadius(w, hid(4)).count === 3, "diamond: blastRadius(4)=3");
}
// ---- relevance orientation (codex formula: depends-on->TO, verified-by/introduced-by->FROM; others 0) ----
{
  const w = wv([e(1, 2, "depends-on"), e(3, 4, "verified-by"), e(5, 6, "introduced-by"),
    e(7, 8, "documented-in"), e(9, 10, "motivated-by"), e(11, 12, "evidenced-by"), e(13, 14, "discharges"), e(15, 16, "supersedes")]);
  ok(relevance(w, hid(2)) === 1, "relevance: depends-on credits TO (node2 raw3, M3 -> 1.0)");
  ok(Math.abs(relevance(w, hid(3)) - 2 / 3) < 1e-12, "relevance: verified-by credits FROM (node3 raw2 -> 2/3)");
  ok(Math.abs(relevance(w, hid(5)) - 1 / 3) < 1e-12, "relevance: introduced-by credits FROM (node5 raw1 -> 1/3)");
  ok(relevance(w, hid(1)) === 0, "relevance: depends-on FROM endpoint gets 0");
  ok(relevance(w, hid(4)) === 0, "relevance: verified-by TO endpoint gets 0");
  // EVERY other edge kind contributes 0 on BOTH endpoints (catches a count-all-kinds regression)
  for (const n of [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) ok(relevance(w, hid(n)) === 0, `relevance: zero-weight kind endpoint ${n} -> 0`);
}
// ---- blast DRIVES the class; relevance does NOT feed it ----
{
  const edges = [];
  for (let k = 0; k < 20; k++) edges.push(e(800 + k, 500, "depends-on"));
  edges.push(e(700, 2, "depends-on"), e(701, 2, "depends-on"));
  for (let k = 0; k < 3; k++) edges.push(e(710 + k, 3, "depends-on"));
  for (let k = 0; k < 6; k++) edges.push(e(730 + k, 6, "depends-on"));    // T6: blast 6 (mid-interval)
  for (let k = 0; k < 10; k++) edges.push(e(720 + k, 4, "depends-on"));
  const w = wv(edges);
  ok(blastRadius(w, hid(2)).count === 2 && riskClass(w, hid(2), "attested-complete").class === "low", "blast 2 -> low (attested)");
  ok(blastRadius(w, hid(3)).count === 3 && riskClass(w, hid(3), "attested-complete").class === "medium", "blast 3 -> medium (lower bound)");
  ok(blastRadius(w, hid(6)).count === 6 && riskClass(w, hid(6), "attested-complete").class === "medium", "blast 6 -> medium (mid 3-9, pins interval)");
  ok(blastRadius(w, hid(4)).count === 10 && riskClass(w, hid(4), "attested-complete").class === "high", "blast 10 -> high");
  ok(riskClass(w, hid(2), "unverified").class === "medium", "coverage floor: blast-2 unverified -> medium");
  // relevance does NOT change class: a high-relevance verified-by SUBJECT (from) with blast 0 stays low
  const w2 = wv([e(2, 1, "verified-by"), e(2, 3, "verified-by")]); // node2 is the FROM (subject) -> relevance 1.0, blast 0
  ok(relevance(w2, hid(2)) === 1 && riskClass(w2, hid(2), "attested-complete").class === "low", "relevance does not feed risk (blast 0 -> low even at relevance 1.0)");
}
// ---- finite-depth (membership) + depth 0 ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on"), e(3, 4, "depends-on")]);
  ok(blastRadius(w, hid(4)).count === 3, "finite-depth: full=3");
  ok(blastRadius(w, hid(4), 0).count === 0, "finite-depth: depth0=0");
  const d1 = blastRadius(w, hid(4), 1).nodes; ok(d1.size === 1 && d1.has(hid(3)), "finite-depth: depth1={3}");
  const d2 = blastRadius(w, hid(4), 2).nodes; ok(d2.size === 2 && d2.has(hid(3)) && d2.has(hid(2)), "finite-depth: depth2={3,2}");
}
// ---- fail-closed: absent node + invalid depth ----
{
  const w = wv([e(1, 2, "depends-on")]);
  throws(() => assess(w, hid(999)), "assess absent node", /unknown node/);
  throws(() => blastRadius(w, hid(2), -1), "blastRadius depth -1", /depth/);
  throws(() => blastRadius(w, hid(2), 1.5), "blastRadius fractional depth", /depth/);
}
// ---- assess() shape ----
{
  const a = assess(wv([e(1, 2, "depends-on")]), hid(2));
  ok(a.node === hid(2) && typeof a.dependencies === "number" && ["low", "medium", "high"].includes(a.class) && typeof a.blast_radius === "number" && typeof a.relevance === "number", "assess(): full shape");
}

// ---- GOLDEN + independent tallies from the committed snapshot ----
{
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "lachesis/config/snapshot-manifest.json"), "utf8"));
  const w = loadWeave(manifest, ROOT);
  ok(w.edges.length === 4001, `golden: 4001 edges (${w.edges.length})`);
  ok(w.nodes.size === 944, `golden tally: 944 distinct nodes (${w.nodes.size})`);
  const dependsOn = w.edges.filter((x) => x.edge_kind === "depends-on").length;
  ok(dependsOn === 1673, `golden tally: 1673 depends-on edges (${dependsOn})`);
  const indeg = new Map();
  for (const x of w.edges) if (x.edge_kind === "depends-on") indeg.set(x.to, (indeg.get(x.to) || 0) + 1);
  let maxInd = 0; for (const v of indeg.values()) if (v > maxInd) maxInd = v;
  ok(maxInd === 131, `golden tally: max depends-on in-degree 131 (${maxInd})`);
  const HUB = "0fcf5ff72e47d79ef80d99630502551aefca0459db2fdcc16c706bf07e6dfc19";
  const G2 = "0328b9ce74868e03071be1e4f5c21cbb310e7110c4601495c1199a3a4b9f8656";
  ok(dependencies(w, HUB).size === 0, "golden HUB: dependencies=0");
  ok(blastRadius(w, HUB).count === 177, "golden HUB: blastRadius=177");
  ok(relevance(w, HUB) === 1, "golden HUB: relevance=1.0 (raw 430/430)");
  ok(assess(w, HUB).class === "high", "golden HUB: class=high");
  ok(dependencies(w, G2).size === 1, "golden G2: dependencies=1");
  ok(blastRadius(w, G2).count === 21, "golden G2: blastRadius=21");
  ok(Math.abs(relevance(w, G2) - 81 / 430) < 1e-9, "golden G2: relevance=81/430");
  ok(dependencies(w, HUB).size !== blastRadius(w, HUB).count, "golden: HUB deps != blast (orientation pinned)");
  // digest stamp: a measurement is bound to the checked bytes
  ok(assess(w, HUB).snapshot_digest === manifest.snapshot_digest, "golden: assess() stamps the snapshot_digest");
}

// ---- ingestion: positive + per-branch negatives (real-format fixtures, distinct locators) ----
const loc = (kind, tag) => ({ kind, locator: { n: tag } });
const H64 = (c) => c.repeat(64);
const rec = (from, to, kind, extra = {}) => ({ edge_kind: kind, from_node: hid(from), to_node: hid(to), from_locator: loc("code-symbol", from), to_locator: loc("code-symbol", to), prev_hash: H64("a"), record_hash: H64("b"), signature: "c2ln", ...extra });
const HEADER = { clotho_weave_header: { pub_key: "x", woven_at: "t", repo_head: "h", repository_ref: "r", weave_version: 1 } };
const TRAILER = { clotho_weave_trailer: {}, prev_hash: H64("a"), record_hash: H64("b"), signature: "c2ln" };
const tmp = mkdtempSync(path.join(tmpdir(), "lachesis-fx-"));
let fxN = 0;
function fixture(objs) {
  const name = `fx${fxN++}.jsonl`;
  writeFileSync(path.join(tmp, name), objs.map((o) => canonicalize(o)).join("\n") + "\n"); // canonical lines
  const digest = "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex");
  return { manifest: { snapshot_path: name, snapshot_digest: digest } };
}
const load = (objs, mutate) => { const { manifest } = fixture(objs); if (mutate) mutate(manifest); return loadWeave(manifest, tmp); };
const neg = (objs, mutate) => () => load(objs, mutate);
try {
  // POSITIVE + end-to-end field mapping
  {
    const w = load([HEADER, rec(1, 2, "depends-on", { source_ref: "sha256:" + H64("a") }), rec(2, 3, "verified-by"), rec(3, 4, "introduced-by"), rec(4, 5, "documented-in"), TRAILER]);
    ok(w.edges.length === 4, "ingest positive: 4 edges");
    ok(EDGE_KINDS.includes("supersedes"), "ingest: complete edge-kind set (frozen array)");
    ok(dependencies(w, hid(1)).has(hid(2)) && dependencies(w, hid(1)).size === 1, "e2e: from->dependent, to->dependency");
    ok(blastRadius(w, hid(2)).nodes.has(hid(1)), "e2e: blastRadius(to) includes from");
  }
  // canonical-JSON enforcement: a non-canonical line (keys out of canonical order) is rejected.
  // (This also guarantees the bijection's order-insensitivity upstream — locators are always canonical.)
  throws(() => {
    const name = "noncanon.jsonl";
    const l = [canonicalize(HEADER), '{"b":2,"a":1}', canonicalize(TRAILER)].join("\n") + "\n";
    writeFileSync(path.join(tmp, name), l);
    const digest = "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex");
    loadWeave({ snapshot_path: name, snapshot_digest: digest }, tmp);
  }, "non-canonical line rejected", /not canonical/);
  // returned weave is frozen: cannot mutate edges before measurement
  {
    const w = load([HEADER, rec(1, 2, "depends-on"), TRAILER]);
    let mutated = false;
    try { w.edges.push({ edge_kind: "depends-on", from: hid(9), to: hid(8) }); mutated = true; } catch { /* frozen */ }
    ok(!mutated && w.edges.length === 1, "frozen return: edges array cannot be mutated");
    ok(Object.isFrozen(w.header) && Object.isFrozen(w.edges[0]), "frozen return: header + edge objects deep-frozen");
  }
  // duplicate (from,to) with DIFFERENT edge_kind is NOT a duplicate (pins (kind,from,to) identity)
  {
    const w = load([HEADER, rec(1, 2, "depends-on"), rec(1, 2, "verified-by"), TRAILER]);
    ok(w.edges.length === 2, "edge identity: same (from,to) different kind -> both accepted");
  }
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), edge_kind: "bogus" }, TRAILER]), "unknown edge_kind", /edge_kind/);
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_node: "NOTHEX" }, TRAILER]), "non-hex node id", /64-hex/);
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_locator: { kind: "bogus", locator: {} } }, TRAILER]), "unknown locator kind", /locator kind/);
  throws(neg([HEADER, rec(1, 1, "depends-on") /*self*/, TRAILER]), "self-edge", /self-edge/);
  throws(neg([HEADER, rec(1, 2, "depends-on"), { ...rec(1, 3, "verified-by"), from_locator: loc("code-symbol", 999) }, TRAILER]), "same id / different locator", /structurally-unequal/);
  throws(neg([HEADER, rec(1, 2, "depends-on"), { ...rec(5, 6, "verified-by"), from_locator: loc("code-symbol", 1) }, TRAILER]), "same locator / different ids", /two node ids/);
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), prev_hash: undefined }, TRAILER]), "edge missing signed fields", /signed-ledger/);
  throws(neg([HEADER, rec(1, 2, "depends-on"), { clotho_weave_trailer: {} }]), "trailer missing signed fields", /trailer missing/);
  throws(neg([HEADER, rec(1, 2, "depends-on", { source_ref: "http://evil" }), TRAILER]), "disallowed source_ref", /source_ref/);
  throws(neg([HEADER, rec(1, 2, "depends-on"), rec(1, 2, "depends-on"), TRAILER]), "duplicate edge", /duplicate edge/);
  throws(neg([HEADER, rec(1, 2, "depends-on"), TRAILER], (m) => { m.snapshot_digest = "sha256:" + H64("0"); }), "digest mismatch", /digest mismatch/);
  throws(neg([HEADER, rec(1, 2, "depends-on"), TRAILER], (m) => { m.snapshot_digest = "deadbeef"; }), "malformed digest syntax", /sha256:<64hex>/);
  throws(neg([rec(1, 2, "depends-on"), TRAILER]), "first record not header", /lone clotho_weave_header/);
  throws(neg([{ clotho_weave_header: { pub_key: "x", weave_version: 1 }, extra: 1 }, rec(1, 2, "depends-on"), TRAILER]), "header not a lone key", /lone/);
  throws(neg([{ clotho_weave_header: { pub_key: "x", weave_version: 2 } }, rec(1, 2, "depends-on"), TRAILER]), "unsupported weave_version", /weave_version/);
  throws(neg([HEADER, HEADER, rec(1, 2, "depends-on"), TRAILER]), "duplicate header", /header/);
  throws(neg([HEADER, TRAILER, rec(1, 2, "depends-on")]), "trailer not last", /last record/);
  throws(neg([HEADER, rec(1, 2, "depends-on")]), "missing trailer", /trailer/);
  throws(neg([HEADER, null, TRAILER]), "null middle record", /JSON object/);
  // path containment via ".." escape
  {
    const sib = path.join(tmpdir(), `lachesis-escape-${process.pid}.jsonl`);
    writeFileSync(sib, [HEADER, rec(1, 2, "depends-on"), TRAILER].map((o) => JSON.stringify(o)).join("\n") + "\n");
    const digest = "sha256:" + createHash("sha256").update(readFileSync(sib)).digest("hex");
    throws(() => loadWeave({ snapshot_path: `../${path.basename(sib)}`, snapshot_digest: digest }, tmp), "path containment escape", /escapes rootDir/);
    rmSync(sib, { force: true });
  }
  throws(() => { const name = "bad.jsonl"; writeFileSync(path.join(tmp, name), "{not json\n"); loadWeave({ snapshot_path: name, snapshot_digest: "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex") }, tmp); }, "unparseable line", /unparseable/);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`test-metrics: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
