// test-metrics.mjs — discriminating oracle for Lachesis. Each fixture pins ONE semantic
// so a wrong implementation fails; ingestion negatives isolate each rejection branch; a
// non-tautological smoke test runs against the REAL committed snapshot.
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
const wv = (edges) => ({ header: { pub_key: "x" }, nodes: new Map(), edges });

// ---- direction: depends-on from=dependent -> to=dependency ----
{
  const w = wv([e(1, 2, "depends-on")]);
  ok([...dependencies(w, hid(1))].join() === hid(2), "direction: dependencies(1)={2}");
  ok(dependencies(w, hid(2)).size === 0, "direction: dependencies(2)={}");
  ok([...blastRadius(w, hid(2)).nodes].join() === hid(1), "direction: blastRadius(2)={1}");
  ok(blastRadius(w, hid(1)).count === 0, "direction: blastRadius(1)=0");
}
// ---- transitivity: membership, not just cardinality ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 2 && d.has(hid(2)) && d.has(hid(3)), "transitivity: dependencies(1)={2,3} (membership)");
  const b = blastRadius(w, hid(3)).nodes;
  ok(b.size === 2 && b.has(hid(1)) && b.has(hid(2)), "transitivity: blastRadius(3)={1,2} (membership)");
}
// ---- cycle: self-excluded and terminating, on BOTH forward and reverse ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 1, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 1 && d.has(hid(2)) && !d.has(hid(1)), "cycle: dependencies(1)={2}, self excluded");
  const b = blastRadius(w, hid(1)).nodes;
  ok(b.size === 1 && b.has(hid(2)) && !b.has(hid(1)), "cycle: blastRadius(1)={2}, self excluded, terminates");
}
// ---- weighted normalization: MAX_RAW is weighted, not max degree ----
{
  const w = wv([e(1, 10, "depends-on"), e(2, 20, "introduced-by"), e(3, 20, "introduced-by")]);
  ok(relevance(w, hid(10)) === 1, "normalization: relevance(P)=3/3=1 (weighted MAX_RAW)");
  ok(Math.abs(relevance(w, hid(20)) - 2 / 3) < 1e-12, "normalization: relevance(Q)=2/3 (not 2/2)");
}
// ---- blast thresholds, isolated from relevance via a dominant distractor ----
{
  const edges = [];
  for (let k = 0; k < 10; k++) edges.push(e(600 + k, 500, "depends-on")); // D(500): blast 10, raw 30 = MAX_RAW
  edges.push(e(710, 3, "depends-on"), e(711, 3, "depends-on"));           // T2(3): blast 2, rel 0.2
  for (let k = 0; k < 3; k++) edges.push(e(720 + k, 4, "depends-on"));    // T3(4): blast 3, rel 0.3
  const w = wv(edges);
  ok(blastRadius(w, hid(3)).count === 2 && riskClass(w, hid(3)).class !== "high", "threshold: blast 2 -> not high");
  ok(blastRadius(w, hid(4)).count === 3 && riskClass(w, hid(4)).class === "medium", "threshold: blast 3 -> medium (>=3 inclusive)");
  ok(blastRadius(w, hid(500)).count === 10 && riskClass(w, hid(500)).class === "high", "threshold: blast 10 -> high (>=10 inclusive)");
}
// ---- relevance DRIVES the class (verified-by/introduced-by raise relevance, NOT blast) ----
// discriminates: wrong byRel cutoff, wrong max(byBlast,byRel) combine, or relevance omitted entirely.
{
  const edges = [
    e(600, 500, "verified-by"), e(601, 500, "verified-by"), // D(500): raw 4 = MAX_RAW, blast 0
    e(602, 4, "verified-by"), e(603, 4, "introduced-by"),   // Y(4): raw 3 -> rel 0.75, blast 0
    e(604, 5, "verified-by")                                // X(5): raw 2 -> rel 0.5, blast 0
  ];
  const w = wv(edges);
  ok(blastRadius(w, hid(500)).count === 0 && riskClass(w, hid(500)).class === "high", "relevance drives high (blast 0, rel 1.0) — omitted relevance would floor to medium");
  ok(riskClass(w, hid(4)).class === "high", "relevance 0.75 >= 0.66 -> high");
  ok(riskClass(w, hid(5)).class !== "high", "relevance 0.5 < 0.66 -> not high (pins the 0.66 cutoff)");
}
// ---- coverage floor: a genuinely-low node floors to medium unless attested-complete ----
{
  const edges = [];
  for (let k = 0; k < 10; k++) edges.push(e(600 + k, 500, "depends-on")); // dominant D -> MAX_RAW 30
  edges.push(e(700, 2, "depends-on"));                                     // L(2): blast 1, raw 3, rel 0.1 -> low
  const w = wv(edges);
  ok(riskClass(w, hid(2), "unverified").class === "medium", "coverage: unverified floors low -> medium");
  ok(riskClass(w, hid(2), "attested-complete").class === "low", "coverage: attested-complete stays low");
}
// ---- finite-depth blastRadius (hop limit) ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on"), e(3, 4, "depends-on")]); // dependents of 4: 3,2,1
  ok(blastRadius(w, hid(4)).count === 3, "finite-depth: full blast(4)=3");
  ok(blastRadius(w, hid(4), 1).count === 1, "finite-depth: depth1 blast(4)=1");
  ok(blastRadius(w, hid(4), 2).count === 2, "finite-depth: depth2 blast(4)=2");
}
// ---- assess() advisory shape ----
{
  const a = assess(wv([e(1, 2, "depends-on")]), hid(2));
  ok(a.node === hid(2) && typeof a.dependencies === "number" && ["low", "medium", "high"].includes(a.class)
    && typeof a.blast_radius === "number" && typeof a.relevance === "number", "assess(): full advisory shape");
}

// ---- ingestion: positive + per-branch negatives (real-format fixtures) ----
const loc = (kind) => ({ kind, locator: {} });
const rec = (from, to, kind, extra = {}) => ({ edge_kind: kind, from_node: hid(from), to_node: hid(to), from_locator: loc("code-symbol"), to_locator: loc("code-symbol"), ...extra });
const HEADER = { clotho_weave_header: { pub_key: "x", woven_at: "t", repo_head: "h", repository_ref: "r", weave_version: 1 } };
const TRAILER = { clotho_weave_trailer: {} };
const tmp = mkdtempSync(path.join(tmpdir(), "lachesis-fx-"));
let fxN = 0;
function fixture(objs) {
  const name = `fx${fxN++}.jsonl`;
  const jsonl = objs.map((o) => JSON.stringify(o)).join("\n") + "\n";
  writeFileSync(path.join(tmp, name), jsonl);
  const digest = "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex");
  return { manifest: { snapshot_path: name, snapshot_digest: digest } };
}
try {
  // POSITIVE: header + metric-irrelevant kind + all metric kinds + all source_ref schemes -> loads
  {
    const objs = [HEADER,
      rec(1, 2, "depends-on", { source_ref: "sha256:" + "a".repeat(64) }),
      rec(2, 3, "verified-by", { source_ref: "file:x/y.mjs@" + "b".repeat(40) }),
      rec(3, 4, "introduced-by", { source_ref: "git:" + "c".repeat(40) }),
      rec(4, 5, "documented-in", { source_ref: "ledger:z#" + "d".repeat(64) }), // metric-irrelevant, still accepted
      TRAILER];
    const { manifest } = fixture(objs);
    const w = loadWeave(manifest, tmp);
    ok(w.edges.length === 4, "ingest positive: 4 edges accepted (incl. metric-irrelevant)");
    ok(EDGE_KINDS.has("supersedes"), "ingest: complete edge-kind set present");
  }
  const neg = (objs, mutate) => { const { manifest } = fixture(objs); if (mutate) mutate(manifest); return () => loadWeave(manifest, tmp); };
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), edge_kind: "bogus-kind" }, TRAILER]), "unknown edge_kind");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_node: "NOTHEX" }, TRAILER]), "non-hex node id");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_locator: loc("bogus-node-kind") }, TRAILER]), "unknown locator kind");
  throws(neg([HEADER, rec(1, 2, "depends-on"), { ...rec(1, 3, "verified-by"), from_locator: loc("test") }, TRAILER]), "locator-kind conflict for a reused node id");
  throws(neg([HEADER, rec(1, 2, "depends-on", { source_ref: "http://evil" }), TRAILER]), "disallowed source_ref scheme");
  throws(neg([HEADER, rec(1, 2, "depends-on"), rec(1, 2, "depends-on"), TRAILER]), "duplicate edge (kind,from,to)");
  throws(neg([HEADER, rec(1, 2, "depends-on"), TRAILER], (m) => { m.snapshot_digest = "sha256:" + "0".repeat(64); }), "snapshot digest mismatch");
  throws(neg([rec(1, 2, "depends-on"), TRAILER]), "structure: first record not header");
  throws(neg([HEADER, HEADER, rec(1, 2, "depends-on"), TRAILER]), "structure: duplicate/misplaced header");
  throws(neg([HEADER, TRAILER, rec(1, 2, "depends-on")]), "structure: trailer not last");
  throws(neg([HEADER, rec(1, 2, "depends-on")]), "structure: missing trailer");
  throws(() => { const name = "bad.jsonl"; writeFileSync(path.join(tmp, name), "{not json\n"); loadWeave({ snapshot_path: name, snapshot_digest: "sha256:" + createHash("sha256").update(readFileSync(path.join(tmp, name))).digest("hex") }, tmp); }, "unparseable line");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---- SMOKE: real committed snapshot, NON-tautological structural assertions ----
{
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "lachesis/config/snapshot-manifest.json"), "utf8"));
  const w = loadWeave(manifest, ROOT);
  ok(w.edges.length === 4001, `smoke: real snapshot loads 4001 edges (got ${w.edges.length})`);
  ok(w.nodes.size > 100, `smoke: real snapshot has many nodes (${w.nodes.size})`);
  // hub = the node most depended-upon; its blast radius must be a real, non-trivial number > 1
  const indeg = new Map();
  for (const x of w.edges) if (x.edge_kind === "depends-on") indeg.set(x.to, (indeg.get(x.to) || 0) + 1);
  let hub = null, max = 0;
  for (const [k, v] of indeg) if (v > max) { max = v; hub = k; }
  const hubBlast = blastRadius(w, hub).count;
  ok(hubBlast > 1 && hubBlast >= max, `smoke: hub blast radius > 1 and >= its in-degree (in=${max}, blast=${hubBlast})`);
  // normalization sanity: the max relevance over real targets is exactly 1.0
  let maxRel = 0;
  for (const t of indeg.keys()) { const r = relevance(w, t); if (r > maxRel) maxRel = r; }
  ok(Math.abs(maxRel - 1) < 1e-9, `smoke: max relevance == 1.0 (got ${maxRel})`);
  const rc = riskClass(w, hub);
  ok(["low", "medium", "high"].includes(rc.class) && rc.relevance >= 0 && rc.relevance <= 1, "smoke: hub riskClass sane");
}

console.log(`test-metrics: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
