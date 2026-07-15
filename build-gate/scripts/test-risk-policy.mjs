// test-risk-policy.mjs — deterministic risk classification + signed downgrade adjudication.
import assert from "node:assert/strict";
import { generateKeypair } from "../../merkle-dag/crypto.mjs";
import {
  DEFAULT_RISK_POLICY, loadRiskPolicy, normalizeRelPath, globToRegExp, classifyPath,
  riskRank, highestClass, evaluateRiskClass, holdPolicyFor,
  signAdjudication, verifyAdjudication, applyAdjudication, adjudicationPayload
} from "../risk-policy.mjs";

const policy = loadRiskPolicy({});

// Case 1: glob matching semantics.
{
  assert.ok(globToRegExp("docs/**").test("docs/a/b.txt"), "** crosses segments");
  assert.ok(globToRegExp("**/*.md").test("x.md"), "**/ matches zero segments");
  assert.ok(globToRegExp("**/*.md").test("a/b.md"), "**/ matches nested");
  assert.ok(!globToRegExp("*.md").test("a/b.md"), "* does not cross /");
  console.log("Case 1 OK: glob semantics");
}

// Case 2: classification + unknown -> highest.
{
  assert.equal(classifyPath("docs/readme.md", policy).class, "documentation-only");
  assert.equal(classifyPath("build-gate/sign.mjs", policy).class, "secrets");
  assert.equal(evaluateRiskClass({ paths: ["totally/unknown.xyz"] }, policy).risk_class, highestClass(policy), "unknown -> highest");
  assert.equal(evaluateRiskClass({}, policy).risk_class, highestClass(policy), "empty -> highest");
  console.log("Case 2 OK: classification + unknown-high");
}

// Case 3: dot-segment / drive evasion is neutralized.
{
  assert.equal(normalizeRelPath("docs/../build-gate/sign.mjs"), "build-gate/sign.mjs");
  assert.equal(classifyPath("docs/../build-gate/sign.mjs", policy).class, "secrets", "evasion classified as secrets, not docs");
  assert.equal(normalizeRelPath("C:\\docs\\..\\build-gate\\sign.mjs"), "build-gate/sign.mjs", "drive root stripped");
  console.log("Case 3 OK: path-evasion neutralized");
}

// Case 4: malformed policy fails closed (everything highest).
{
  const bad = loadRiskPolicy({ risk_policy: { rules: [{ match: 123 }] } });
  assert.equal(bad.rules.length, 0, "malformed -> empty rules");
  assert.equal(evaluateRiskClass({ paths: ["docs/readme.md"] }, bad).risk_class, highestClass(bad), "fail-closed to highest");
  console.log("Case 4 OK: malformed policy fails closed");
}

// Case 5: MAX-rank aggregation across paths / workstreams / flags.
{
  const r = evaluateRiskClass({ paths: ["docs/readme.md", "build-gate/sign.mjs"], workstreams: [], flags: {} }, policy);
  assert.equal(r.risk_class, "secrets", "max rank wins");
  const wr = evaluateRiskClass({ paths: ["docs/readme.md"], workstreams: ["security-trust"], flags: {} }, policy);
  assert.equal(riskRank(policy, wr.risk_class) >= riskRank(policy, "authentication"), true, "workstream min_class applied");
  const fr = evaluateRiskClass({ paths: ["docs/readme.md"], flags: { protected_path_hit: true } }, policy);
  assert.equal(fr.risk_class, "governance", "flag rule applied");
  console.log("Case 5 OK: max-rank aggregation");
}

// Case 6: holdPolicyFor buckets by risk class + clamps.
{
  assert.equal(holdPolicyFor("documentation-only", policy).escalation, "none");
  assert.equal(holdPolicyFor("authorization", policy).escalation, "human-adjudication");
  assert.equal(holdPolicyFor("unknown-class", policy).escalation, "human-adjudication", "unknown -> human");
  console.log("Case 6 OK: holdPolicyFor");
}

// Case 7: model downgrade is powerless without a valid signed adjudication.
{
  const { privatePem, publicJwk } = generateKeypair();
  const p2 = { ...policy, adjudicators: { "human-1": publicJwk } };
  const planHash = "sha256:planX";
  // no adjudication -> downgrade ignored
  assert.equal(applyAdjudication("secrets", "documentation-only", null, p2, { plan_hash: planHash }).effective_class, "secrets", "downgrade ignored without adjudication");
  // valid adjudication -> downgrade applies
  const adj = { plan_hash: planHash, from_class: "secrets", to_class: "documentation-only", key_id: "human-1", adjudicated_at: "t" };
  adj.sig = { alg: "Ed25519", value: signAdjudication(adj, privatePem) };
  assert.equal(verifyAdjudication(adj, p2), true, "adjudication verifies");
  assert.equal(applyAdjudication("secrets", "documentation-only", adj, p2, { plan_hash: planHash }).effective_class, "documentation-only", "valid downgrade applies");
  // wrong plan hash -> ignored
  assert.equal(applyAdjudication("secrets", "documentation-only", adj, p2, { plan_hash: "sha256:other" }).effective_class, "secrets", "wrong plan hash ignored");
  // corrupted signature -> ignored
  const badAdj = { ...adj, sig: { alg: "Ed25519", value: "AAAA" } };
  assert.equal(applyAdjudication("secrets", "documentation-only", badAdj, p2, { plan_hash: planHash }).effective_class, "secrets", "bad sig ignored");
  console.log("Case 7 OK: signed downgrade adjudication");
}

// Case 8: upgrades apply freely (no signature needed).
{
  assert.equal(applyAdjudication("application", "governance", null, policy, { plan_hash: "sha256:p" }).effective_class, "governance", "upgrade free");
  console.log("Case 8 OK: upgrade free");
}

console.log("test-risk-policy.mjs OK");
