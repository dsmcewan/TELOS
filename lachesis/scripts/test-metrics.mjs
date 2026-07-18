// test-metrics.mjs — discriminating oracle for Lachesis. Synthetic fixtures pin each
// semantic; GOLDEN values from the committed snapshot pin loader field-mapping + orientation
// against reality; ingestion negatives isolate each rejection branch.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWeave, EDGE_KINDS } from "../ingest.mjs";
import { dependencies, blastRadius, relevance, riskClass, assess } from "../measure.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
let passes = 0, fails = 0;
const ok = (cond, msg) => { if (cond) { passes++; } else { fails++; console.error("FAIL:", msg); } };
const throws = (fn, msg) => { try { fn(); fails++; console.error("FAIL (expected throw):", msg); } catch { passes++; } };

const hid = (i) => i.toString(16).padStart(64, "0");
const e = (from, to, kind) => ({ edge_kind: kind, from: hid(from), to: hid(to) });
const wv = (edges) => {
  const nodes = new Map();
  for (const ed of edges) { nodes.set(ed.from, { kind: "code-symbol", payload: "{}" }); nodes.set(ed.to, { kind: "code-symbol", payload: "{}" }); }
  return { header: { pub_key: "x" }, nodes, edges };
};

// ---- direction: depends-on from=dependent -> to=dependency ----
{
  const w = wv([e(1, 2, "depends-on")]);
  ok([...dependencies(w, hid(1))].join() === hid(2), "direction: dependencies(1)={2}");
  ok(dependencies(w, hid(2)).size === 0, "direction: dependencies(2)={}");
  ok([...blastRadius(w, hid(2)).nodes].join() === hid(1), "direction: blastRadius(2)={1}");
  ok(blastRadius(w, hid(1)).count === 0, "direction: blastRadius(1)=0");
}
// ---- transitivity: membership ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 2 && d.has(hid(2)) && d.has(hid(3)), "transitivity: dependencies(1)={2,3}");
  const b = blastRadius(w, hid(3)).nodes;
  ok(b.size === 2 && b.has(hid(1)) && b.has(hid(2)), "transitivity: blastRadius(3)={1,2}");
}
// ---- cycle: self-excluded + terminating, forward AND reverse ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 1, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 1 && d.has(hid(2)) && !d.has(hid(1)), "cycle: dependencies(1)={2}");
  const b = blastRadius(w, hid(1)).nodes;
  ok(b.size === 1 && b.has(hid(2)) && !b.has(hid(1)), "cycle: blastRadius(1)={2}, terminates");
}
// ---- relevance = normalized depends-on in-degree ----
{
  const w = wv([e(1, 10, "depends-on"), e(2, 10, "depends-on"), e(3, 20, "depends-on")]); // indeg: 10->2, 20->1, max 2
  ok(relevance(w, hid(10)) === 1, "relevance: max in-degree -> 1.0");
  ok(relevance(w, hid(20)) === 0.5, "relevance: half in-degree -> 0.5");
  ok(relevance(w, hid(1)) === 0, "relevance: no depends-on-in -> 0");
}
// ---- blast DRIVES the class: three distinct classes from blast alone (attested-complete, no floor) ----
{
  const edges = [];
  for (let k = 0; k < 20; k++) edges.push(e(800 + k, 500, "depends-on")); // dominant, keeps others distinct
  edges.push(e(700, 2, "depends-on"), e(701, 2, "depends-on"));           // T2: blast 2
  for (let k = 0; k < 3; k++) edges.push(e(710 + k, 3, "depends-on"));    // T3: blast 3
  for (let k = 0; k < 10; k++) edges.push(e(720 + k, 4, "depends-on"));   // T10: blast 10
  const w = wv(edges);
  ok(blastRadius(w, hid(2)).count === 2 && riskClass(w, hid(2), "attested-complete").class === "low", "blast 2 -> low (attested)");
  ok(blastRadius(w, hid(3)).count === 3 && riskClass(w, hid(3), "attested-complete").class === "medium", "blast 3 -> medium (>=3)");
  ok(blastRadius(w, hid(4)).count === 10 && riskClass(w, hid(4), "attested-complete").class === "high", "blast 10 -> high (>=10)");
  ok(riskClass(w, hid(2), "unverified").class === "medium", "coverage floor: blast-2 unverified -> medium");
}
// ---- finite-depth blastRadius: membership, not just count ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on"), e(3, 4, "depends-on")]); // dependents of 4: 3,2,1
  ok(blastRadius(w, hid(4)).count === 3, "finite-depth: full blast(4)=3");
  const d1 = blastRadius(w, hid(4), 1).nodes; ok(d1.size === 1 && d1.has(hid(3)), "finite-depth: depth1={3}");
  const d2 = blastRadius(w, hid(4), 2).nodes; ok(d2.size === 2 && d2.has(hid(3)) && d2.has(hid(2)), "finite-depth: depth2={3,2}");
}
// ---- fail-closed: absent node id + invalid depth ----
{
  const w = wv([e(1, 2, "depends-on")]);
  throws(() => assess(w, hid(999)), "assess on absent node -> throws");
  throws(() => dependencies(w, hid(999)), "dependencies on absent node -> throws");
  throws(() => blastRadius(w, hid(2), -1), "blastRadius depth -1 -> throws");
  throws(() => blastRadius(w, hid(2), 1.5), "blastRadius fractional depth -> throws");
}
// ---- assess() shape ----
{
  const a = assess(wv([e(1, 2, "depends-on")]), hid(2));
  ok(a.node === hid(2) && typeof a.dependencies === "number" && ["low", "medium", "high"].includes(a.class)
    && typeof a.blast_radius === "number" && typeof a.relevance === "number", "assess(): full advisory shape");
}

// ---- GOLDEN values from the committed snapshot: pin loader field-mapping + orientation to REALITY ----
{
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "lachesis/config/snapshot-manifest.json"), "utf8"));
  const w = loadWeave(manifest, ROOT);
  ok(w.edges.length === 4001, `golden: 4001 edges (${w.edges.length})`);
  const HUB = "0fcf5ff72e47d79ef80d99630502551aefca0459db2fdcc16c706bf07e6dfc19";
  const G2 = "0328b9ce74868e03071be1e4f5c21cbb310e7110c4601495c1199a3a4b9f8656";
  ok(dependencies(w, HUB).size === 0, "golden HUB: dependencies=0 (leaf dependency)");
  ok(blastRadius(w, HUB).count === 177, "golden HUB: blastRadius=177");
  ok(relevance(w, HUB) === 1, "golden HUB: relevance=1.0");
  ok(assess(w, HUB).class === "high", "golden HUB: class=high");
  ok(dependencies(w, G2).size === 1, "golden G2: dependencies=1");
  ok(blastRadius(w, G2).count === 21, "golden G2: blastRadius=21");
  ok(Math.abs(relevance(w, G2) - 18 / 131) < 1e-9, "golden G2: relevance=18/131");
  // orientation guard: swapping from/to would flip these two numbers
  ok(dependencies(w, HUB).size !== blastRadius(w, HUB).count, "golden: HUB deps != blast (from/to orientation pinned)");
}

// ---- ingestion: positive + per-branch negatives (real-format fixtures) ----
const loc = (kind) => ({ kind, locator: {} });
const H64 = (c) => c.repeat(64);
const rec = (from, to, kind, extra = {}) => ({ edge_kind: kind, from_node: hid(from), to_node: hid(to), from_locator: loc("code-symbol"), to_locator: loc("code-symbol"), prev_hash: H64("a"), record_hash: H64("b"), signature: "c2ln", ...extra });
const HEADER = { clotho_weave_header: { pub_key: "x", woven_at: "t", repo_head: "h", repository_ref: "r", weave_version: 1 } };
const TRAILER = { clotho_weave_trailer: {}, prev_hash: H64("a"), record_hash: H64("b"), signature: "c2ln" };
const tmp = mkdtempSync(path.join(tmpdir(), "lachesis-fx-"));
let fxN = 0;
function fixture(objs) {
  const name = `fx${fxN++}.jsonl`;
  writeFileSync(path.join(tmp, name), objs.map((o) => JSON.stringify(o)).join("\n") + "\n");
  const digest = "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex");
  return { manifest: { snapshot_path: name, snapshot_digest: digest } };
}
try {
  // POSITIVE + end-to-end field mapping through loadWeave
  {
    const objs = [HEADER,
      rec(1, 2, "depends-on", { source_ref: "sha256:" + H64("a") }),
      rec(2, 3, "verified-by", { source_ref: "file:x/y.mjs@" + "b".repeat(40) }),
      rec(3, 4, "introduced-by", { source_ref: "git:" + "c".repeat(40) }),
      rec(4, 5, "documented-in", { source_ref: "ledger:z#" + H64("d") }),
      TRAILER];
    const { manifest } = fixture(objs);
    const w = loadWeave(manifest, tmp);
    ok(w.edges.length === 4, "ingest positive: 4 edges (incl. metric-irrelevant)");
    ok(EDGE_KINDS.has("supersedes"), "ingest: complete edge-kind set present");
    // e2e: loadWeave maps from_node->from(dependent), to_node->to(dependency)
    ok(dependencies(w, hid(1)).has(hid(2)) && dependencies(w, hid(1)).size === 1, "e2e: from->dependent, to->dependency");
    ok(blastRadius(w, hid(2)).nodes.has(hid(1)), "e2e: blastRadius(to) includes from");
  }
  const neg = (objs, mutate) => { const { manifest } = fixture(objs); if (mutate) mutate(manifest); return () => loadWeave(manifest, tmp); };
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), edge_kind: "bogus" }, TRAILER]), "unknown edge_kind");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_node: "NOTHEX" }, TRAILER]), "non-hex node id");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_locator: loc("bogus") }, TRAILER]), "unknown locator kind");
  throws(neg([HEADER, rec(1, 2, "depends-on"), { ...rec(1, 3, "verified-by"), from_locator: loc("test") }, TRAILER]), "locator conflict on reused id");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), prev_hash: undefined }, TRAILER]), "missing signed-ledger fields");
  throws(neg([HEADER, rec(1, 2, "depends-on", { source_ref: "http://evil" }), TRAILER]), "disallowed source_ref scheme");
  throws(neg([HEADER, rec(1, 2, "depends-on"), rec(1, 2, "depends-on"), TRAILER]), "duplicate edge");
  throws(neg([HEADER, rec(1, 2, "depends-on"), TRAILER], (m) => { m.snapshot_digest = "sha256:" + H64("0"); }), "digest mismatch");
  throws(neg([rec(1, 2, "depends-on"), TRAILER]), "structure: first record not header");
  throws(neg([{ clotho_weave_header: { pub_key: "x", weave_version: 1 }, extra: 1 }, rec(1, 2, "depends-on"), TRAILER]), "structure: header not a lone key");
  throws(neg([{ clotho_weave_header: { pub_key: "x", weave_version: 2 } }, rec(1, 2, "depends-on"), TRAILER]), "structure: unsupported weave_version");
  throws(neg([HEADER, HEADER, rec(1, 2, "depends-on"), TRAILER]), "structure: duplicate header");
  throws(neg([HEADER, TRAILER, rec(1, 2, "depends-on")]), "structure: trailer not last");
  throws(neg([HEADER, rec(1, 2, "depends-on")]), "structure: missing trailer");
  throws(neg([HEADER, null, TRAILER]), "structure: null middle record -> Error (not TypeError)");
  throws(() => { const name = "bad.jsonl"; writeFileSync(path.join(tmp, name), "{not json\n"); loadWeave({ snapshot_path: name, snapshot_digest: "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex") }, tmp); }, "unparseable line");
  // path containment: a sibling OUTSIDE rootDir via ".." must be rejected even with a matching digest
  {
    const sib = path.join(tmpdir(), `lachesis-escape-${process.pid}.jsonl`);
    writeFileSync(sib, [HEADER, rec(1, 2, "depends-on"), TRAILER].map((o) => JSON.stringify(o)).join("\n") + "\n");
    const digest = "sha256:" + createHash("sha256").update(readFileSync(sib)).digest("hex");
    throws(() => loadWeave({ snapshot_path: `../${path.basename(sib)}`, snapshot_digest: digest }, tmp), "path containment: ../ escape rejected");
    rmSync(sib, { force: true });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(`test-metrics: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
