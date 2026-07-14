// test-obligation.mjs — verification obligations: derivation, attachment, anchor checks, discharge.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair } from "../crypto.mjs";
import { compileAndHashPlan } from "../planner.mjs";
import {
  deriveObligationRef, deriveTestRef, normalizeVerifies,
  attachObligations, checkObligationAnchors, undischargedObligations
} from "../obligation.mjs";

const baseOb = { obligation_id: "verify-auth-001", concern_ref: "sha256:concernA", required_result: "pass", check_contract_ref: "sha256:cc1" };

// Case 1: deriveObligationRef determinism + field validation.
{
  const a = deriveObligationRef(baseOb);
  const b = deriveObligationRef({ ...baseOb });
  assert.equal(a, b, "deterministic");
  assert.ok(a.startsWith("sha256:"), "sha256-prefixed");
  assert.throws(() => deriveObligationRef({ ...baseOb, concern_ref: "" }), "empty field throws");
  assert.throws(() => deriveObligationRef({ ...baseOb, obligation_id: undefined }), "missing field throws");
  console.log("Case 1 OK: deriveObligationRef determinism + validation");
}

// Case 2: ref-change matrix — each of the 4 SEMANTIC fields changes obligation_ref;
// discharge_test_ref is derived only from the test and is excluded from the semantic hash.
{
  const ref0 = deriveObligationRef(baseOb);
  for (const field of ["obligation_id", "concern_ref", "required_result", "check_contract_ref"]) {
    const changed = deriveObligationRef({ ...baseOb, [field]: baseOb[field] + "-X" });
    assert.notEqual(changed, ref0, `changing ${field} changes obligation_ref`);
  }
  console.log("Case 2 OK: ref-change matrix (all 4 semantic fields)");
}

// Case 3: normalizeVerifies dedupes + sorts.
{
  assert.deepEqual(normalizeVerifies(["sha256:b", "sha256:a", "sha256:b"]), ["sha256:a", "sha256:b"]);
  assert.deepEqual(normalizeVerifies(undefined), []);
  console.log("Case 3 OK: normalizeVerifies");
}

// Case 4: attachObligations registers the ref into the discharge node's test.verifies and computes
// discharge_test_ref from the FINAL test.
{
  const defs = [
    { id: "impl", files: ["impl.txt"], requirements: "impl", test: { cmd: "node", args: ["-e", "0"] }, dependencies: [] },
    { id: "auth-test", files: ["auth.test.txt"], requirements: "test", test: { cmd: "node", args: ["-e", "0"] }, dependencies: [] }
  ];
  const res = attachObligations(defs, [{ ...baseOb, discharge_node_id: "auth-test" }]);
  assert.ok(!res.errors, "no errors");
  const node = res.defs.find((d) => d.id === "auth-test");
  const ref = deriveObligationRef({ ...baseOb });
  assert.ok(node.test.verifies.includes(ref), "verifies contains obligation_ref");
  assert.equal(res.obligations[0].discharge_test_ref, deriveTestRef(node.test), "discharge_test_ref from final test");
  assert.equal(res.obligations[0].obligation_ref, ref, "obligation_ref recorded");
  console.log("Case 4 OK: attachObligations registration");
}

// Case 5: attachObligations error taxonomy.
{
  const defs = [{ id: "impl", files: ["impl.txt"], requirements: "impl", test: { cmd: "node", args: ["-e", "0"] }, dependencies: [] }];
  assert.equal(attachObligations(defs, [{ ...baseOb, discharge_node_id: "nope" }]).errors[0].code, "UnknownDischargeNode");
  const noTest = [{ id: "impl", files: ["impl.txt"], requirements: "impl", test: null, dependencies: [] }];
  assert.equal(attachObligations(noTest, [{ ...baseOb, discharge_node_id: "impl" }]).errors[0].code, "MissingDischargeTest");
  assert.equal(attachObligations(defs, [{ ...baseOb, discharge_node_id: "impl" }, { ...baseOb, discharge_node_id: "impl" }]).errors[0].code, "DuplicateObligationRef");
  assert.equal(attachObligations(defs, [{ ...baseOb, concern_ref: "", discharge_node_id: "impl" }]).errors[0].code, "BadObligationField");
  console.log("Case 5 OK: attachObligations error taxonomy");
}

// buildFixture: a real compiled plan carrying an obligation on the "auth-test" node.
function buildFixture(obOverride = {}) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-ob-"));
  writeFileSync(path.join(ws, "impl.txt"), "impl\n");
  writeFileSync(path.join(ws, "auth.test.txt"), "test\n");
  const { publicJwk } = generateKeypair();
  const tasks = [
    { id: "impl", writes: ["impl.txt"], reads: [], requirements: "impl", test: { cmd: "node", args: ["-e", "0"] } },
    { id: "auth-test", writes: ["auth.test.txt"], reads: [], requirements: "test", test: { cmd: "node", args: ["-e", "0"] } }
  ];
  const obligations = [{ ...baseOb, discharge_node_id: "auth-test", ...obOverride }];
  const res = compileAndHashPlan({ tasks, authorizedSigners: { tester: publicJwk }, repoRoot: ws, obligations });
  assert.ok(res.plan, "plan compiled: " + JSON.stringify(res.errors || {}));
  return { ws, plan: res.plan };
}

// Case 6: checkObligationAnchors — all six checks pass on a valid compiled plan.
{
  const { plan } = buildFixture();
  const r = checkObligationAnchors(plan, { recomputedPlanHash: plan.plan_hash });
  assert.equal(r.ok, true, "anchors pass: " + JSON.stringify(r.failures));
  console.log("Case 6 OK: checkObligationAnchors all pass");
}

// Case 7: verifies-registered fail — a retargeted obligation (changed concern_ref) whose recomputed
// obligation_ref is no longer in the node's test.verifies. This is the rev-6 "no silent retarget" guard.
{
  const { plan } = buildFixture();
  const tampered = { ...plan, obligations: [{ ...plan.obligations[0], concern_ref: "sha256:concernB", obligation_ref: deriveObligationRef({ ...baseOb, concern_ref: "sha256:concernB" }) }] };
  const r = checkObligationAnchors(tampered, { recomputedPlanHash: tampered.plan_hash });
  assert.equal(r.ok, false, "retargeted obligation fails anchors");
  assert.equal(r.failures[0].check, "verifies-registered", "fails at verifies-registered");
  console.log("Case 7 OK: retarget fails verifies-registered");
}

// Case 8: node-exists / test-ref-match failures.
{
  const { plan } = buildFixture();
  const missingNode = { ...plan, obligations: [{ ...plan.obligations[0], discharge_node_id: "ghost" }] };
  assert.equal(checkObligationAnchors(missingNode).failures[0].check, "node-exists");
  const badTestRef = { ...plan, obligations: [{ ...plan.obligations[0], discharge_test_ref: "sha256:wrong" }] };
  assert.equal(checkObligationAnchors(badTestRef).failures[0].check, "test-ref-match");
  console.log("Case 8 OK: node-exists + test-ref-match failures");
}

// Case 9: undischargedObligations — required_result != "pass", and node-not-verified.
{
  const { plan } = buildFixture();
  const passReports = new Map([["impl", { id: "impl", ok: true }], ["auth-test", { id: "auth-test", ok: true }]]);
  assert.equal(undischargedObligations(plan, passReports).length, 0, "all discharged when node ok");
  const failReports = new Map([["impl", { id: "impl", ok: true }], ["auth-test", { id: "auth-test", ok: false }]]);
  assert.equal(undischargedObligations(plan, failReports).length, 1, "undischarged when discharge node not ok");
  const noReports = new Map();
  assert.equal(undischargedObligations(plan, noReports).length, 1, "undischarged when node has no report");
  console.log("Case 9 OK: undischargedObligations by node report");
}

// Case 10: required_result other than "pass" is never auto-discharged (fail closed).
{
  const { plan } = buildFixture({ required_result: "fail" });
  const passReports = new Map([["impl", { id: "impl", ok: true }], ["auth-test", { id: "auth-test", ok: true }]]);
  const u = undischargedObligations(plan, passReports);
  assert.equal(u.length, 1, "non-pass required_result stays undischarged");
  assert.match(u[0].reason, /required_result/);
  console.log("Case 10 OK: non-pass required_result fail-closed");
}

// Case 11: obligation binds into plan_hash — a retargeted obligation changes the compiled plan_hash.
{
  const a = buildFixture();
  const b = buildFixture({ concern_ref: "sha256:concernB" });
  assert.notEqual(a.plan.plan_hash, b.plan.plan_hash, "different concern_ref -> different plan_hash");
  console.log("Case 11 OK: obligation semantics bound into plan_hash");
}

console.log("test-obligation.mjs OK");
