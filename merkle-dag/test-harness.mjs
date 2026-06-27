// test-harness.mjs — end-to-end proof: cascade + parallel-isolation + disk-drift + cycle guard.
// Runs entirely in os.tmpdir(); never touches CWD or vault.
import path from "node:path";
import os from "node:os";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

// ESM module anchor (no CWD usage anywhere in this file).
const __filename = fileURLToPath(import.meta.url);

import { computePlan, mutateNode, writePlan, appendPlanHistory } from "./merkle.mjs";
import { computeDiskTreeHash } from "./artifact.mjs";
import { generateKeypair, makeRecord, appendLedger, writePublicKey } from "./crypto.mjs";
import { verify } from "./ledger-gate.mjs";

// ---------------------------------------------------------------------------
// Helper: write artifact file on disk, hash it, sign, append to ledger.
// ---------------------------------------------------------------------------
function settle(ws, telosDir, plan, nodeId, privatePem) {
  const node = plan.nodes.find((n) => n.id === nodeId);
  assert(node, `settle: node ${nodeId} not found in plan`);
  writeFileSync(path.join(ws, nodeId + ".txt"), `artifact content for ${nodeId}`);
  const disk = computeDiskTreeHash(node.files, ws);
  const record = makeRecord(
    { task_id: nodeId, effective_hash: node.effective_hash,
      artifact_tree_hash: disk.tree_hash, artifact_files: disk.files },
    "tester", privatePem
  );
  appendLedger(path.join(telosDir, "ledger.jsonl"), record);
}

// ---------------------------------------------------------------------------
// Step 1: workspace + mock DAG plan
//
// Graph (two branches — proves cascade + parallel isolation):
//   A1 -> B1 -> C1   (branch 1)
//   A2 -> B2         (branch 2)
// ---------------------------------------------------------------------------
const ws = mkdtempSync(path.join(os.tmpdir(), "telos-harness-"));
const telosDir = path.join(ws, ".telos");

const taskDefs = [
  { id: "A1", files: ["A1.txt"], requirements: "build A1",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: [] },
  { id: "A2", files: ["A2.txt"], requirements: "build A2",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: [] },
  { id: "B1", files: ["B1.txt"], requirements: "build B1",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["A1"] },
  { id: "B2", files: ["B2.txt"], requirements: "build B2",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["A2"] },
  { id: "C1", files: ["C1.txt"], requirements: "build C1",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["B1"] },
];

// Keypair must be generated BEFORE computePlan so it can be pinned into authorized_signers.
const { privatePem, publicJwk } = generateKeypair();

const planResult1 = computePlan(taskDefs, { authorizedSigners: { tester: publicJwk } });
assert(!planResult1.errors, `computePlan failed: ${JSON.stringify(planResult1.errors)}`);
const planV1 = planResult1.plan;
writePlan(telosDir, planV1);

// Snapshot v1 effective hashes for later isolation assertions.
const v1Eff = {};
for (const n of planV1.nodes) v1Eff[n.id] = n.effective_hash;

// writePublicKey still written for tooling/bootstrapping, but is no longer the trust path.
writePublicKey(path.join(telosDir, "keys"), "tester", publicJwk);

console.log("Step 1 OK: plan computed, keypair written");

// ---------------------------------------------------------------------------
// Step 2: settle all 5 nodes -> verify READY, exit 0, passed === 5
// ---------------------------------------------------------------------------
for (const id of ["A1", "A2", "B1", "B2", "C1"]) {
  settle(ws, telosDir, planV1, id, privatePem);
}

const r1 = verify(telosDir, { baseDir: ws });
assert.equal(r1.merge_status, "ready",
  `Step 2: expected ready, got ${r1.merge_status}. Blockers: ${JSON.stringify(r1.blockers)}`);
assert.equal(r1.exit, 0, "Step 2: exit should be 0");
assert.equal(r1.summary.passed, 5, "Step 2: all 5 nodes should pass");

console.log("Step 2 OK: all 5 settled -> READY exit 0");

// ---------------------------------------------------------------------------
// Step 3: mutate B1 spec, write planV2.
// Do NOT re-settle B1 or C1 — they now carry stale ledger entries.
// ---------------------------------------------------------------------------
const mutResult = mutateNode(planV1, "B1", { requirements: "changed B1" });
assert(!mutResult.errors, `mutateNode failed: ${JSON.stringify(mutResult.errors)}`);
const planV2 = mutResult.plan;
const historyEvent = mutResult.historyEvent;
writePlan(telosDir, planV2);
appendPlanHistory(telosDir, historyEvent);

console.log("Step 3 OK: B1 mutated, planV2 written");

// ---------------------------------------------------------------------------
// Step 4: verify -> BLOCKED; blocked == {B1, C1} (STALE_LINEAGE); passed == {A1, A2, B2}
// ---------------------------------------------------------------------------
const r2 = verify(telosDir, { baseDir: ws });
assert.equal(r2.merge_status, "blocked", "Step 4: expected blocked");
assert.equal(r2.exit, 1, "Step 4: exit should be 1");

const blockedIds = r2.nodes.filter((n) => !n.ok).map((n) => n.id).sort();
const passedIds  = r2.nodes.filter((n) =>  n.ok).map((n) => n.id).sort();
assert.deepEqual(blockedIds, ["B1", "C1"],       "Step 4: blocked should be exactly [B1, C1]");
assert.deepEqual(passedIds,  ["A1", "A2", "B2"], "Step 4: passed should be exactly [A1, A2, B2]");

for (const id of ["B1", "C1"]) {
  const nodeRep = r2.nodes.find((n) => n.id === id);
  assert.equal(nodeRep.checks.lineage, "STALE_LINEAGE",
    `Step 4: ${id} must carry STALE_LINEAGE`);
}

console.log("Step 4 OK: BLOCKED {B1,C1} STALE_LINEAGE; passed {A1,A2,B2}");

// ---------------------------------------------------------------------------
// Step 5: effective-hash isolation assertions
//   B1 mutated (spec changed) -> B1 eff-hash changes.
//   C1 depends on B1         -> C1 eff-hash cascades.
//   A1, A2, B2 in branch 2   -> UNCHANGED (parallel isolation).
// ---------------------------------------------------------------------------
const v2Eff = {};
for (const n of planV2.nodes) v2Eff[n.id] = n.effective_hash;

assert.notEqual(v2Eff["B1"], v1Eff["B1"], "Step 5: B1 eff-hash must CHANGE after mutation");
assert.notEqual(v2Eff["C1"], v1Eff["C1"], "Step 5: C1 eff-hash must CASCADE from B1 change");
assert.equal(v2Eff["A1"],    v1Eff["A1"], "Step 5: A1 eff-hash must be UNCHANGED");
assert.equal(v2Eff["A2"],    v1Eff["A2"], "Step 5: A2 eff-hash must be UNCHANGED");
assert.equal(v2Eff["B2"],    v1Eff["B2"], "Step 5: B2 eff-hash must be UNCHANGED (parallel branch)");

console.log("Step 5 OK: eff-hash isolation proven (cascade + parallel isolation)");

// ---------------------------------------------------------------------------
// Step 6: re-settle B1 + C1 against planV2 -> verify READY again
// ---------------------------------------------------------------------------
settle(ws, telosDir, planV2, "B1", privatePem);
settle(ws, telosDir, planV2, "C1", privatePem);

const r3 = verify(telosDir, { baseDir: ws });
assert.equal(r3.merge_status, "ready",
  `Step 6: expected ready, got ${r3.merge_status}. Blockers: ${JSON.stringify(r3.blockers)}`);
assert.equal(r3.exit, 0, "Step 6: exit should be 0 after re-settle");

console.log("Step 6 OK: re-settled B1+C1 -> READY exit 0");

// ---------------------------------------------------------------------------
// Step 7: disk-drift micro-proof
// Tamper A1.txt on disk (append a byte) -> ARTIFACT_MISMATCH for A1, exit 1.
// ---------------------------------------------------------------------------
appendFileSync(path.join(ws, "A1.txt"), "drift");
const r4 = verify(telosDir, { baseDir: ws });
assert.equal(r4.exit, 1, "Step 7: exit should be 1 after disk drift");
const a1Rep = r4.nodes.find((n) => n.id === "A1");
assert.equal(a1Rep.checks.artifact, "ARTIFACT_MISMATCH",
  "Step 7: A1 must report ARTIFACT_MISMATCH after on-disk tamper");

console.log("Step 7 OK: disk-drift detected -> ARTIFACT_MISMATCH exit 1");

// ---------------------------------------------------------------------------
// Step 8: cycle guard
// computePlan on X->Y, Y->X must return errors[0].code === "Cycle"; no plan.
// ---------------------------------------------------------------------------
const cycleResult = computePlan([
  { id: "X", files: ["X.txt"], requirements: "build X",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["Y"] },
  { id: "Y", files: ["Y.txt"], requirements: "build Y",
    test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["X"] },
]);
assert(cycleResult.errors, "Step 8: cycle must produce errors");
assert.equal(cycleResult.errors[0].code, "Cycle", "Step 8: error code must be Cycle");
assert.strictEqual(cycleResult.plan, undefined, "Step 8: no plan must be returned for cyclic graph");

console.log("Step 8 OK: cycle guard -> errors[0].code=Cycle, no plan");

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------
console.log("test-harness.mjs OK");
