import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair } from "../crypto.mjs";
import { recompute } from "../merkle.mjs";
import { compileAndHashPlan } from "../planner.mjs";

const kp = generateKeypair();
const authorizedSigners = { "test-key": kp.publicJwk };
const repoRoot = mkdtempSync(path.join(os.tmpdir(), "planner-test-"));
const T = { cmd: "node", args: ["-e", "process.exit(0)"] };

// Case 1 — Read-after-write edge
{
  const r1 = compileAndHashPlan({
    tasks: [
      { id: "W", writes: ["a.txt"], reads: [], test: T },
      { id: "R", writes: [], reads: ["a.txt"], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r1.errors, "case1: no errors");
  const Rnode = r1.plan.nodes.find(n => n.id === "R");
  assert.ok(Rnode.dependencies.includes("W"), "case1: R depends on W");
  const Wnode = r1.plan.nodes.find(n => n.id === "W");
  assert.ok(!Wnode.dependencies.includes("R"), "case1: edge is reader->writer only, not the reverse");
}

// Case 2 — Write-write serial
{
  const r2 = compileAndHashPlan({
    tasks: [
      { id: "A", writes: ["x.txt"], reads: [], test: T },
      { id: "B", writes: ["x.txt"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r2.errors, "case2: no errors");
  const A2 = r2.plan.nodes.find(n => n.id === "A");
  const B2 = r2.plan.nodes.find(n => n.id === "B");
  assert.ok(B2.dependencies.includes("A"), "case2: B depends on A");
  assert.ok(!A2.dependencies.includes("B"), "case2: A does not depend on B");
}

// Case 3 — Multi-parent convergence (implicit join)
{
  const r3 = compileAndHashPlan({
    tasks: [
      { id: "P", writes: ["p.txt"], reads: [], test: T },
      { id: "Q", writes: ["q.txt"], reads: [], test: T },
      { id: "R3", writes: ["r.txt"], reads: [], test: T },
      { id: "D", writes: [], reads: ["p.txt", "q.txt", "r.txt"], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r3.errors, "case3: no errors");
  const D3 = r3.plan.nodes.find(n => n.id === "D");
  assert.ok(["P", "Q", "R3"].every(id => D3.dependencies.includes(id)), "case3: D depends on P,Q,R3");
  // No spurious empty-files join node (D itself may have empty files since it only reads)
  assert.ok(!r3.plan.nodes.some(n => n.files.length === 0 && n.id !== "D"), "case3: no spurious join node");
  // Recompute proof: change P's spec → D effective_hash changes
  const r3b = compileAndHashPlan({
    tasks: [
      { id: "P", writes: ["p.txt"], reads: [], test: T, requirements: "changed" },
      { id: "Q", writes: ["q.txt"], reads: [], test: T },
      { id: "R3", writes: ["r.txt"], reads: [], test: T },
      { id: "D", writes: [], reads: ["p.txt", "q.txt", "r.txt"], test: T }
    ],
    authorizedSigners, repoRoot
  });
  const D3b = r3b.plan.nodes.find(n => n.id === "D");
  assert.notStrictEqual(D3.effective_hash, D3b.effective_hash, "case3: recompute proof — D hash changes when P changes");
  // recompute reproduces identical effective_hashes
  const recomp3 = recompute(r3.plan);
  assert.ok(!recomp3.errors, "case3: recompute no errors");
  r3.plan.nodes.forEach(n => {
    const rn = recomp3.plan.nodes.find(x => x.id === n.id);
    assert.strictEqual(rn.effective_hash, n.effective_hash, `case3: recompute hash matches for ${n.id}`);
  });
}

// Case 4 — Isolation leaf
{
  const r4 = compileAndHashPlan({
    tasks: [
      { id: "ISO", writes: ["unique-iso.txt"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r4.errors, "case4: no errors");
  const ISO = r4.plan.nodes.find(n => n.id === "ISO");
  assert.deepStrictEqual(ISO.dependencies, [], "case4: ISO has no dependencies");
}

// Case 5 — Path normalization
{
  const r5 = compileAndHashPlan({
    tasks: [
      { id: "WRITER5", writes: ["./dir/f.mjs"], reads: [], test: T },
      { id: "READER5", writes: [], reads: ["dir/f.mjs"], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r5.errors, "case5: no errors");
  const R5 = r5.plan.nodes.find(n => n.id === "READER5");
  assert.ok(R5.dependencies.includes("WRITER5"), "case5: path normalization couples reader to writer");
}

// Case 6 — Valid plan handoff
{
  const r6 = compileAndHashPlan({
    tasks: [
      { id: "N1", writes: ["n1.txt"], reads: [], test: T },
      { id: "N2", writes: ["n2.txt"], reads: ["n1.txt"], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r6.errors, "case6: no errors");
  assert.ok(r6.plan.plan_hash, "case6: plan_hash present");
  r6.plan.nodes.forEach(n => {
    assert.ok(n.spec_hash, `case6: ${n.id} has spec_hash`);
    assert.ok(n.effective_hash, `case6: ${n.id} has effective_hash`);
  });
  assert.deepStrictEqual(r6.plan.authorized_signers, authorizedSigners, "case6: authorized_signers pinned");
  const recomp6 = recompute(r6.plan);
  assert.ok(!recomp6.errors, "case6: recompute no errors");
  r6.plan.nodes.forEach(n => {
    const rn = recomp6.plan.nodes.find(x => x.id === n.id);
    assert.strictEqual(rn.effective_hash, n.effective_hash, `case6: recompute matches ${n.id}`);
  });
}

// Case 7 — test + requirements passthrough
{
  const testObj7 = { cmd: "node", args: ["-e", "process.exit(0)"], cwd: "/tmp" };
  const r7 = compileAndHashPlan({
    tasks: [
      { id: "TPT", writes: ["tpt.txt"], reads: [], test: testObj7, requirements: "req string" }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r7.errors, "case7: no errors");
  const TPT = r7.plan.nodes.find(n => n.id === "TPT");
  assert.deepStrictEqual(TPT.test, testObj7, "case7: test passthrough");
  assert.strictEqual(TPT.requirements, "req string", "case7: requirements passthrough");
}

// Case 8 — Cycle from conflicting footprints
{
  const r8 = compileAndHashPlan({
    tasks: [
      { id: "CA", writes: ["x8.txt"], reads: ["y8.txt"], test: T },
      { id: "CB", writes: ["y8.txt"], reads: ["x8.txt"], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(r8.errors, "case8: has errors");
  assert.ok(r8.errors.some(e => e.code === "Cycle"), "case8: Cycle error");
  assert.ok(Array.isArray(r8.advisories), "case8: advisories is array");
}

// Case 9 — Advisory scan
{
  const repoRoot9 = mkdtempSync(path.join(os.tmpdir(), "planner-test-9-"));
  writeFileSync(path.join(repoRoot9, "t1-write.mjs"), `import x from "./t2-write.mjs";\n`);
  writeFileSync(path.join(repoRoot9, "t2-write.mjs"), `export default 42;\n`);

  const r9a = compileAndHashPlan({
    tasks: [
      { id: "T1", writes: ["t1-write.mjs"], reads: [], test: T },
      { id: "T2", writes: ["t2-write.mjs"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot: repoRoot9
  });
  assert.ok(r9a.advisories.some(s => s.includes("T1") && s.includes("T2")), "case9: advisory warns on undeclared import");
  const T1node9a = r9a.plan.nodes.find(n => n.id === "T1");
  assert.ok(!T1node9a.dependencies.includes("T2"), "case9: advisory must NOT inject a dependency edge");

  const r9b = compileAndHashPlan({
    tasks: [
      { id: "T1", writes: ["t1-write.mjs"], reads: ["t2-write.mjs"], test: T },
      { id: "T2", writes: ["t2-write.mjs"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot: repoRoot9
  });
  assert.ok(!r9b.advisories.some(s => s.includes("T1") && s.includes("T2")), "case9: no advisory when read declared");
  // advisory never mutates dependencies — T1 depends on T2 via declared read, not advisory
  const T1node9b = r9b.plan.nodes.find(n => n.id === "T1");
  assert.ok(T1node9b.dependencies.includes("T2"), "case9: declared read creates dependency edge");
}

// Case 10 — Write-write advisory (default mode): plan produced, advisory emitted, Rule A intact
{
  const r10 = compileAndHashPlan({
    tasks: [
      { id: "WW1", writes: ["shared10.txt"], reads: [], test: T },
      { id: "WW2", writes: ["shared10.txt"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r10.errors, "case10: no errors in default mode");
  assert.ok(r10.plan, "case10: plan is produced");
  assert.ok(
    r10.advisories.some(s => s.includes("write-write conflict") && s.includes("WW1") && s.includes("WW2")),
    "case10: advisory mentions write-write conflict with both task ids"
  );
  const WW2node = r10.plan.nodes.find(n => n.id === "WW2");
  assert.ok(WW2node.dependencies.includes("WW1"), "case10: later writer (WW2) depends on earlier writer (WW1) - Rule A intact");
}

// Case 11 — Write-write strict reject: errors present, no plan
{
  const r11 = compileAndHashPlan({
    tasks: [
      { id: "WW1", writes: ["shared11.txt"], reads: [], test: T },
      { id: "WW2", writes: ["shared11.txt"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot, strict: true
  });
  assert.ok(r11.errors, "case11: errors present in strict mode");
  assert.ok(r11.errors.some(e => e.code === "WriteWriteConflict"), "case11: WriteWriteConflict error code");
  assert.ok(!r11.plan, "case11: no plan produced in strict mode");
  assert.ok(Array.isArray(r11.advisories), "case11: advisories is array");
}

// Case 12 — Disjoint writes: no write-write advisory
{
  const r12 = compileAndHashPlan({
    tasks: [
      { id: "DW1", writes: ["dw1.txt"], reads: [], test: T },
      { id: "DW2", writes: ["dw2.txt"], reads: [], test: T }
    ],
    authorizedSigners, repoRoot
  });
  assert.ok(!r12.errors, "case12: no errors");
  assert.ok(
    !r12.advisories.some(s => s.includes("write-write conflict")),
    "case12: no write-write advisory for disjoint writes"
  );
}

console.log("test-planner.mjs OK");
