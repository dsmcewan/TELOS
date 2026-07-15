// test-merkle.mjs — property contract for merkle.mjs (Task 2)
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import {
  specHash, effectiveHash, topoSort, computePlan, recompute,
  mutateNode, writePlan, readPlan, appendPlanHistory
} from "../merkle.mjs";

// ─── helpers ─────────────────────────────────────────────────────────────────
const tmpBase = path.join(os.tmpdir(), "telos-test-merkle-" + process.pid);
mkdirSync(tmpBase, { recursive: true });

// Minimal node stub for specHash / effectiveHash unit tests
function stub(id, opts = {}) {
  return { id, files: opts.files ?? [], requirements: opts.requirements ?? "req", test: opts.test ?? "test", dependencies: opts.dependencies ?? [] };
}

// ─── Property 1: Determinism ──────────────────────────────────────────────────
{
  // key-order independence (canonicalize sorts keys)
  const n1 = { files: ["a"], requirements: "r", test: "t" };
  const n2 = { test: "t", requirements: "r", files: ["a"] };
  assert.equal(specHash(n1), specHash(n2), "P1: key-order must not affect specHash");

  // file-order independence (files pre-sorted inside specHash)
  const nAB = stub("x", { files: ["b", "a"] });
  const nBA = stub("x", { files: ["a", "b"] });
  assert.equal(specHash(nAB), specHash(nBA), "P1: file-order must not affect specHash");

  // requirements change changes specHash
  const base = stub("x", { requirements: "original" });
  const changed = stub("x", { requirements: "changed" });
  assert.notEqual(specHash(base), specHash(changed), "P1: changed requirements must change specHash");
}

// ─── Property 2: Effective-hash lineage ──────────────────────────────────────
{
  // build two leaf nodes with fixed spec_hashes so we can control effByID
  const effA = "sha256:aaaa";
  const effB = "sha256:bbbb";
  const effByID = { A: effA, B: effB };

  const nodeAB = { ...stub("C", { dependencies: ["A", "B"] }), spec_hash: "sha256:cccc" };
  const nodeBA = { ...stub("C", { dependencies: ["B", "A"] }), spec_hash: "sha256:cccc" };
  const nodeAAB = { ...stub("C", { dependencies: ["A", "A", "B"] }), spec_hash: "sha256:cccc" };

  const hAB  = effectiveHash(nodeAB,  effByID);
  const hBA  = effectiveHash(nodeBA,  effByID);
  const hAAB = effectiveHash(nodeAAB, effByID);

  assert.equal(hAB,  hBA,  "P2: parent order must not affect effectiveHash");
  assert.equal(hAB,  hAAB, "P2: duplicate parent must not affect effectiveHash");

  // leaf (no parents) must differ from a node with parents
  const leaf = { ...stub("L"), spec_hash: "sha256:cccc" };
  const hLeaf = effectiveHash(leaf, {});
  assert.notEqual(hLeaf, hAB, "P2: leaf eff-hash must differ from node with parents");
}

// ─── Property 3: Cascade ─────────────────────────────────────────────────────
{
  // A → B → C  and independent D
  const taskDefs = [
    { id: "A", files: ["a.js"], requirements: "reqA", test: "testA", dependencies: [] },
    { id: "B", files: ["b.js"], requirements: "reqB", test: "testB", dependencies: ["A"] },
    { id: "C", files: ["c.js"], requirements: "reqC", test: "testC", dependencies: ["B"] },
    { id: "D", files: ["d.js"], requirements: "reqD", test: "testD", dependencies: [] },
  ];

  const { plan } = computePlan(taskDefs);
  const oldPlanHash = plan.plan_hash;

  function eff(p, id) { return p.nodes.find(n => n.id === id).effective_hash; }

  const effA_before = eff(plan, "A");
  const effB_before = eff(plan, "B");
  const effC_before = eff(plan, "C");
  const effD_before = eff(plan, "D");

  const result = mutateNode(plan, "B", { requirements: "new" });
  assert.ok(!result.errors, "P3: mutateNode should not return errors");

  const newPlan = result.plan;

  // effB and effC must change
  assert.notEqual(eff(newPlan, "B"), effB_before, "P3: effB must change after mutating B");
  assert.notEqual(eff(newPlan, "C"), effC_before, "P3: effC must cascade-change after mutating B");

  // effA and effD must be UNCHANGED
  assert.equal(eff(newPlan, "A"), effA_before, "P3: effA must be unchanged");
  assert.equal(eff(newPlan, "D"), effD_before, "P3: effD must be unchanged");

  // mutated_nodes ids == ["B","C"] (order-insensitive)
  const mutatedIds = result.plan.meta.mutated_nodes.map(m => m.id).sort();
  assert.deepEqual(mutatedIds, ["B", "C"], "P3: mutated_nodes ids must be [B,C]");

  // revision and prev_plan_root
  assert.equal(newPlan.meta.revision, 2, "P3: revision must be 2");
  assert.equal(newPlan.meta.prev_plan_root, oldPlanHash, "P3: prev_plan_root must equal old plan_hash");
}

// ─── Property 4: plan_hash stable under task-array reorder ───────────────────
{
  const defs = [
    { id: "X", files: ["x.js"], requirements: "rx", test: "tx", dependencies: [] },
    { id: "Y", files: ["y.js"], requirements: "ry", test: "ty", dependencies: ["X"] },
    { id: "Z", files: ["z.js"], requirements: "rz", test: "tz", dependencies: ["Y"] },
  ];
  const defsShuffled = [defs[2], defs[0], defs[1]]; // Z, X, Y

  const { plan: p1 } = computePlan(defs);
  const { plan: p2 } = computePlan(defsShuffled);
  assert.equal(p1.plan_hash, p2.plan_hash, "P4: plan_hash must be independent of input task-array order");
}

// ─── Property 5: Validation errors — no throw ────────────────────────────────
{
  // Cycle: A→B→A
  const cycleResult = computePlan([
    { id: "A", files: [], requirements: "r", test: "t", dependencies: ["B"] },
    { id: "B", files: [], requirements: "r", test: "t", dependencies: ["A"] },
  ]);
  assert.ok(Array.isArray(cycleResult.errors), "P5: cycle must return errors array");
  assert.equal(cycleResult.errors[0].code, "Cycle", "P5: cycle error code must be 'Cycle'");
  assert.ok(Array.isArray(cycleResult.errors[0].nodes), "P5: cycle error must have nodes array");

  // Duplicate id
  const dupResult = computePlan([
    { id: "A", files: [], requirements: "r", test: "t", dependencies: [] },
    { id: "A", files: [], requirements: "r2", test: "t2", dependencies: [] },
  ]);
  assert.ok(Array.isArray(dupResult.errors), "P5: duplicate id must return errors array");
  assert.equal(dupResult.errors[0].code, "DuplicateTaskId", "P5: duplicate id error code");
  assert.equal(dupResult.errors[0].id, "A", "P5: duplicate id error must name the id");

  // Unknown dependency
  const unknownResult = computePlan([
    { id: "A", files: [], requirements: "r", test: "t", dependencies: ["GHOST"] },
  ]);
  assert.ok(Array.isArray(unknownResult.errors), "P5: unknown dep must return errors array");
  assert.equal(unknownResult.errors[0].code, "UnknownDependency", "P5: unknown dep error code");
  assert.equal(unknownResult.errors[0].dep, "GHOST", "P5: unknown dep error must name the dep");
}

// ─── Property 6: Overlap warning ─────────────────────────────────────────────
{
  const result = computePlan([
    { id: "P", files: ["shared.js", "p.js"], requirements: "r", test: "t", dependencies: [] },
    { id: "Q", files: ["shared.js", "q.js"], requirements: "r", test: "t", dependencies: [] },
  ]);
  assert.ok(!result.errors, "P6: overlap should not be an error");
  assert.ok(result.warnings.length > 0, "P6: must have at least one warning for overlapping file");
  assert.ok(result.warnings.some(w => w.includes("shared.js")), "P6: warning must mention the shared file");
}

// ─── Property 7: I/O roundtrip ───────────────────────────────────────────────
{
  const telosDir = path.join(tmpBase, "io-test", ".telos");
  mkdirSync(telosDir, { recursive: true });

  const taskDefs = [
    { id: "IO_A", files: ["io_a.js"], requirements: "r", test: "t", dependencies: [] },
    { id: "IO_B", files: ["io_b.js"], requirements: "r", test: "t", dependencies: ["IO_A"] },
  ];
  const { plan } = computePlan(taskDefs);

  writePlan(telosDir, plan);

  // readPlan returns deep-equal nodes
  const loaded = readPlan(telosDir);
  assert.deepEqual(loaded.nodes.map(n => n.id), plan.nodes.map(n => n.id), "P7: roundtrip node ids");
  assert.deepEqual(
    loaded.nodes.map(n => n.effective_hash),
    plan.nodes.map(n => n.effective_hash),
    "P7: roundtrip effective_hashes"
  );

  // versioned plans/<hash>.json exists
  const versionedPath = path.join(telosDir, "plans", plan.plan_hash.replace(/[:]/g, "_") + ".json");
  assert.ok(existsSync(versionedPath), "P7: versioned plan file must exist");

  // appendPlanHistory adds one parseable line
  const histEvent = { revision: 1, plan_hash: plan.plan_hash, prev_plan_root: null, mutated: [], reason_ref: null };
  appendPlanHistory(telosDir, histEvent);
  const histFile = path.join(telosDir, "plan-history.jsonl");
  assert.ok(existsSync(histFile), "P7: plan-history.jsonl must exist");
  const lines = readFileSync(histFile, "utf8").trim().split("\n");
  assert.equal(lines.length, 1, "P7: one history line");
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.plan_hash, plan.plan_hash, "P7: history line must parse and match plan_hash");
}

// ─── Property 8: recompute matches; tamper detection ─────────────────────────
{
  const taskDefs = [
    { id: "R_A", files: ["r_a.js"], requirements: "r", test: "t", dependencies: [] },
    { id: "R_B", files: ["r_b.js"], requirements: "r", test: "t", dependencies: ["R_A"] },
  ];
  const { plan } = computePlan(taskDefs);

  // Clean recompute: every node's effective_hash matches stored value
  const rc = recompute(plan);
  assert.ok(!rc.errors, "P8: recompute of clean plan must not error");
  for (let i = 0; i < plan.nodes.length; i++) {
    assert.equal(
      rc.plan.nodes[i].effective_hash,
      plan.nodes[i].effective_hash,
      `P8: recompute hash must match stored hash for node ${plan.nodes[i].id}`
    );
  }

  // Tamper a stored hash in a copy → recompute output differs from stored
  const tampered = JSON.parse(JSON.stringify(plan)); // deep clone via JSON
  tampered.nodes[0].effective_hash = "sha256:TAMPERED000000000000000000000000000000000000000000000000000000000";
  const rcTampered = recompute(tampered);
  // recompute ignores stored hashes and recomputes from specs — so result should equal the ORIGINAL
  assert.equal(
    rcTampered.plan.nodes[0].effective_hash,
    plan.nodes[0].effective_hash,
    "P8: recompute must ignore tampered stored hash and return correct value"
  );
  // The tampered plan's stored hash differs from what recompute returns → ledger-gate detects this
  assert.notEqual(
    tampered.nodes[0].effective_hash,
    rcTampered.plan.nodes[0].effective_hash,
    "P8: stored tampered hash must differ from recomputed hash"
  );
}

// ─── Property 9: obligation-free / lifecycle-free plans keep byte-identical plan_hash ─────────
{
  const defs = [{ id: "a", files: ["a.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "0"] }, dependencies: [] }];
  const legacy = computePlan(defs, { authorizedSigners: {} });
  const withEmpty = computePlan(defs, { authorizedSigners: {}, obligations: [], lifecycle: null });
  assert.equal(legacy.plan.plan_hash, withEmpty.plan.plan_hash, "P9: empty obligations/lifecycle -> legacy plan_hash");
  assert.deepEqual(legacy.plan.obligations, [], "P9: obligations field present as []");
  assert.equal(legacy.plan.lifecycle, null, "P9: lifecycle field present as null");
}

// ─── Property 10: lifecycle bound into plan_hash + node-lineage validation ────────────────────
{
  const defs = [
    { id: "a", files: ["a.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "0"] }, dependencies: [] },
    { id: "b", files: ["b.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "0"] }, dependencies: ["a"] }
  ];
  const lc = { contract_ref: "sha256:c", proposal_id: "proposal-x", predecessor_plan_hash: null, node_lineages: [{ node_id: "a", node_lineage_ref: "sha256:la" }, { node_id: "b", node_lineage_ref: "sha256:lb" }] };
  const p1 = computePlan(defs, { authorizedSigners: {}, lifecycle: lc });
  const p0 = computePlan(defs, { authorizedSigners: {} });
  assert.notEqual(p1.plan.plan_hash, p0.plan.plan_hash, "P10: lifecycle changes plan_hash");
  // changing a node_lineage_ref changes plan_hash (can't drift under a fixed hash)
  const lc2 = { ...lc, node_lineages: [{ node_id: "a", node_lineage_ref: "sha256:CHANGED" }, { node_id: "b", node_lineage_ref: "sha256:lb" }] };
  assert.notEqual(computePlan(defs, { authorizedSigners: {}, lifecycle: lc2 }).plan.plan_hash, p1.plan.plan_hash, "P10: changed lineage_ref -> changed plan_hash");
  // validation: unknown node, duplicate ref, incomplete coverage
  assert.equal(computePlan(defs, { authorizedSigners: {}, lifecycle: { ...lc, node_lineages: [{ node_id: "ghost", node_lineage_ref: "sha256:x" }] } }).errors[0].code, "UnknownLineageNode");
  assert.equal(computePlan(defs, { authorizedSigners: {}, lifecycle: { ...lc, node_lineages: [{ node_id: "a", node_lineage_ref: "sha256:d" }, { node_id: "b", node_lineage_ref: "sha256:d" }] } }).errors[0].code, "DuplicateLineageRef");
  assert.equal(computePlan(defs, { authorizedSigners: {}, lifecycle: { ...lc, node_lineages: [{ node_id: "a", node_lineage_ref: "sha256:la" }] } }).errors[0].code, "IncompleteLineage");
}

console.log("test-merkle.mjs OK");
