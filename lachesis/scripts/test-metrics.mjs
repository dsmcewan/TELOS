// test-metrics.mjs — discriminating oracle for Lachesis. Each metric fixture pins
// ONE semantic so a wrong implementation fails; ingestion negatives isolate each
// rejection branch; a smoke test runs against the REAL committed snapshot.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadWeave, EDGE_KINDS } from "../ingest.mjs";
import { dependencies, blastRadius, relevance, riskClass } from "../measure.mjs";

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
  const w = wv([e(1, 2, "depends-on")]); // 1 depends on 2
  ok([...dependencies(w, hid(1))].join() === hid(2), "direction: dependencies(1)={2}");
  ok(dependencies(w, hid(2)).size === 0, "direction: dependencies(2)={}");
  ok([...blastRadius(w, hid(2)).nodes].join() === hid(1), "direction: blastRadius(2)={1}");
  ok(blastRadius(w, hid(1)).count === 0, "direction: blastRadius(1)=0");
}
// ---- transitivity: 1->2->3 ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 3, "depends-on")]);
  ok(dependencies(w, hid(1)).size === 2, "transitivity: dependencies(1) has 2 (one-hop-only fails)");
  ok(blastRadius(w, hid(3)).count === 2, "transitivity: blastRadius(3)=2");
}
// ---- cycle: 1->2->1, exclude self, terminate ----
{
  const w = wv([e(1, 2, "depends-on"), e(2, 1, "depends-on")]);
  const d = dependencies(w, hid(1));
  ok(d.size === 1 && d.has(hid(2)) && !d.has(hid(1)), "cycle: dependencies(1)={2}, self excluded");
}
// ---- weighted normalization: max RAW is weighted, not max degree ----
{
  // P(=10): one depends-on-in -> raw 3, degree 1. Q(=20): two introduced-by-in -> raw 2, degree 2.
  const w = wv([e(1, 10, "depends-on"), e(2, 20, "introduced-by"), e(3, 20, "introduced-by")]);
  ok(relevance(w, hid(10)) === 1, "normalization: relevance(P)=3/3=1 (weighted MAX_RAW)");
  ok(Math.abs(relevance(w, hid(20)) - 2 / 3) < 1e-12, "normalization: relevance(Q)=2/3 (not 2/2)");
}
// ---- threshold inclusivity, isolated from relevance via a dominant distractor ----
// (blastRadius and depends-on relevance are coupled — a node's depends-on dependents
// also raise its raw — so a dominant node D holds MAX_RAW and keeps test nodes' relevance low.)
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
// ---- coverage floor: a genuinely-low node floors to medium unless attested-complete ----
{
  const edges = [];
  for (let k = 0; k < 10; k++) edges.push(e(600 + k, 500, "depends-on")); // dominant D -> MAX_RAW 30
  edges.push(e(700, 2, "depends-on"));                                     // L(2): blast 1, raw 3, rel 0.1 -> low
  const w = wv(edges);
  ok(riskClass(w, hid(2), "unverified").class === "medium", "coverage: unverified floors low -> medium");
  ok(riskClass(w, hid(2), "attested-complete").class === "low", "coverage: attested-complete stays low");
}

// ---- ingestion: positive + per-branch negatives (real-format fixtures) ----
const loc = (kind) => ({ kind, locator: {} });
const rec = (from, to, kind, extra = {}) => ({ edge_kind: kind, from_node: hid(from), to_node: hid(to), from_locator: loc("code-symbol"), to_locator: loc("code-symbol"), ...extra });
const HEADER = { clotho_weave_header: { pub_key: "x", woven_at: "t", repo_head: "h", repository_ref: "r", weave_version: 1 } };
const TRAILER = { clotho_weave_trailer: {} };
const tmp = mkdtempSync(path.join(tmpdir(), "lachesis-fx-"));
function fixture(objs) {
  const jsonl = objs.map((o) => JSON.stringify(o)).join("\n") + "\n";
  const p = path.join(tmp, "fx.jsonl");
  writeFileSync(p, jsonl);
  const digest = "sha256:" + createHash("sha256").update(readFileSync(p)).digest("hex");
  return { p, manifest: { snapshot_path: "fx.jsonl", snapshot_digest: digest } };
}
try {
  // POSITIVE: header + one metric-irrelevant kind + all metric kinds + valid source_ref schemes -> loads
  {
    const objs = [HEADER,
      rec(1, 2, "depends-on", { source_ref: "sha256:" + "a".repeat(64) }),
      rec(2, 3, "verified-by", { source_ref: "file:x/y.mjs@" + "b".repeat(40) }),
      rec(3, 4, "introduced-by", { source_ref: "git:" + "c".repeat(40) }),
      rec(4, 5, "documented-in", { source_ref: "ledger:z#" + "d".repeat(64) }), // metric-irrelevant, still accepted
      TRAILER];
    const { p, manifest } = fixture(objs);
    const w = loadWeave(p, manifest);
    ok(w.edges.length === 4, "ingest positive: 4 edges accepted (incl. metric-irrelevant)");
    ok(EDGE_KINDS.has("supersedes"), "ingest: complete edge-kind set present");
  }
  // NEGATIVES (each isolates one branch)
  const neg = (objs, extraDigest) => { const { p, manifest } = fixture(objs); if (extraDigest) manifest.snapshot_digest = extraDigest; return () => loadWeave(p, manifest); };
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), edge_kind: "bogus-kind" }, TRAILER]), "unknown edge_kind");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_node: "NOTHEX" }, TRAILER]), "non-hex node id");
  throws(neg([HEADER, { ...rec(1, 2, "depends-on"), from_locator: loc("bogus-node-kind") }, TRAILER]), "unknown locator kind");
  throws(neg([HEADER, rec(1, 2, "depends-on", { source_ref: "http://evil" }), TRAILER]), "disallowed source_ref scheme");
  throws(neg([HEADER, rec(1, 2, "depends-on"), rec(1, 2, "depends-on"), TRAILER]), "duplicate edge (kind,from,to)");
  throws(neg([HEADER, rec(1, 2, "depends-on"), TRAILER], "sha256:" + "0".repeat(64)), "snapshot digest mismatch");
  throws(neg([rec(1, 2, "depends-on"), TRAILER]), "missing header");
  throws(neg([HEADER, rec(1, 2, "depends-on")]), "missing trailer");
  throws(() => { const p = path.join(tmp, "bad.jsonl"); writeFileSync(p, "{not json\n"); loadWeave(p, { snapshot_path: "bad.jsonl", snapshot_digest: "sha256:" + createHash("sha256").update(readFileSync(p)).digest("hex") }); }, "unparseable line");
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ---- SMOKE: real committed snapshot loads and yields sane metrics ----
{
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "lachesis/config/snapshot-manifest.json"), "utf8"));
  const snapPath = path.join(ROOT, manifest.snapshot_path);
  const w = loadWeave(snapPath, manifest);
  ok(w.edges.length === 4001, `smoke: real snapshot loads 4001 edges (got ${w.edges.length})`);
  ok(w.nodes.size > 0, "smoke: real snapshot has nodes");
  // pick a real node with dependents and assert metrics are computable + in range
  const someTo = w.edges.find((x) => x.edge_kind === "depends-on")?.to;
  const rc = riskClass(w, someTo);
  ok(["low", "medium", "high"].includes(rc.class), "smoke: riskClass in {low,medium,high}");
  ok(rc.relevance >= 0 && rc.relevance <= 1, "smoke: relevance normalized to [0,1]");
  ok(blastRadius(w, someTo).count >= 1, "smoke: real node has >=1 dependent");
}

console.log(`test-metrics: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
