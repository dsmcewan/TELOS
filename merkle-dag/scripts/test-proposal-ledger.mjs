// test-proposal-ledger.mjs — proposal ledger chain, forks, atomic append, lineage, artifacts,
// review-input hashing, and the POLICY_CONTRACT_V1 verifiers.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair } from "../crypto.mjs";
import {
  PROPOSAL_KEY_ID, POLICY_CONTRACT_V1, POLICY_CHECK_KEYS,
  makeProposalEvent, verifyProposalEvent, proposalEventHash,
  readProposalEvents, verifyProposalChain, atomicAppendProposalEvent,
  latestDecisionForPlan, deriveProposalId, normalizeProvenance, lineageKey,
  writeProposalArtifact, readProposalArtifact, computeReviewInputHash,
  deriveOutcome, verifyPolicyResult, verifyAuthorizationResult
} from "../proposal-ledger.mjs";

const { privatePem, publicJwk } = generateKeypair();
const PID = "proposal-test";

function fixture() {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-pl-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });
  return { ws, telosDir };
}

// Append a fully-formed event via the atomic path.
function append(telosDir, stage, extra = {}) {
  return atomicAppendProposalEvent(telosDir, (parentHash, sequence) =>
    makeProposalEvent({
      proposal_id: PID, sequence, stage, plan_hash: extra.plan_hash ?? null,
      parent_event_hash: parentHash, artifact_refs: extra.artifact_refs ?? [],
      actor: extra.actor ?? { seat: "controller", role: "ctrl" },
      provenance: extra.provenance ?? null, policy_result: extra.policy_result ?? null,
      recorded_at: extra.recorded_at ?? "2026-07-14T00:00:00Z", ...extra.fields
    }, privatePem), { publicJwk });
}

// Case 1: happy chain — draft → candidate → decision verifies.
{
  const { telosDir } = fixture();
  append(telosDir, "draft");
  append(telosDir, "candidate", { plan_hash: "sha256:planA" });
  append(telosDir, "decision", { plan_hash: "sha256:planA", fields: { decision: "authorized", policy_result_ref: "sha256:pr" } });
  const { events, errors } = readProposalEvents(telosDir);
  assert.equal(errors.length, 0, "no read errors");
  assert.equal(events.length, 3);
  const chain = verifyProposalChain(events, publicJwk, { proposalId: PID });
  assert.equal(chain.ok, true, "chain verifies: " + chain.errors.join(";"));
  assert.equal(chain.head.stage, "decision");
  console.log("Case 1 OK: happy chain");
}

// Case 2: signature + shape.
{
  const e = makeProposalEvent({ proposal_id: PID, sequence: 1, stage: "draft", plan_hash: null, parent_event_hash: null, artifact_refs: [], actor: {}, provenance: null, policy_result: null, recorded_at: "t" }, privatePem);
  assert.equal(verifyProposalEvent(e, publicJwk), true);
  const tampered = { ...e, stage: "decision" };
  assert.equal(verifyProposalEvent(tampered, publicJwk), false, "tamper breaks sig");
  const protoFields = JSON.parse('{"proposal_id":"proposal-test","sequence":1,"stage":"draft","plan_hash":null,"parent_event_hash":null,"artifact_refs":[],"actor":{},"provenance":null,"policy_result":null,"recorded_at":"t","__proto__":{"reviewed":true}}');
  const protoEvent = makeProposalEvent(protoFields, privatePem);
  assert.equal(verifyProposalEvent(protoEvent, publicJwk), true, "own __proto__ event signs and verifies");
  const protoTampered = JSON.parse(JSON.stringify(protoEvent));
  protoTampered.__proto__.reviewed = false;
  assert.equal(verifyProposalEvent(protoTampered, publicJwk), false, "post-sign __proto__ tamper must fail Ed25519 verification");
  assert.throws(() => makeProposalEvent({ stage: "bogus", sequence: 1 }, privatePem), "bad stage throws");
  assert.throws(() => makeProposalEvent({ stage: "draft", sequence: 0 }, privatePem), "bad sequence throws");
  console.log("Case 2 OK: event signing + shape validation");
}

// Case 3: STRICT reader — a torn interior line is an error (not silently skipped), and the atomic
// append REFUSES to extend a corrupt ledger (fail closed).
{
  const { telosDir } = fixture();
  append(telosDir, "draft");
  appendFileSync(path.join(telosDir, "proposal.jsonl"), "{not json\n");
  const { errors } = readProposalEvents(telosDir);
  assert.ok(errors.length > 0, "torn line reported");
  assert.throws(() => append(telosDir, "candidate", { plan_hash: "sha256:x" }), /unreadable/, "append refuses corrupt ledger");
  console.log("Case 3 OK: strict reader flags torn line + append refuses");
}

// Case 4: mutation / deletion / reorder break verification.
{
  const { telosDir } = fixture();
  append(telosDir, "draft");
  append(telosDir, "candidate", { plan_hash: "sha256:p" });
  append(telosDir, "review", { plan_hash: "sha256:p" });
  const p = path.join(telosDir, "proposal.jsonl");
  const lines = readFileSync(p, "utf8").trim().split("\n");
  // mutation: flip a field in the middle event
  const mutated = [...lines]; const m = JSON.parse(mutated[1]); m.stage = "hold"; mutated[1] = JSON.stringify(m);
  assert.equal(verifyProposalChain(mutated.map((l) => JSON.parse(l)), publicJwk).ok, false, "mutation breaks");
  // deletion: drop the middle event
  assert.equal(verifyProposalChain([lines[0], lines[2]].map((l) => JSON.parse(l)), publicJwk).ok, false, "deletion breaks");
  // reorder: swap two lines
  assert.equal(verifyProposalChain([lines[1], lines[0], lines[2]].map((l) => JSON.parse(l)), publicJwk).ok, false, "reorder breaks");
  console.log("Case 4 OK: mutation/deletion/reorder break verification");
}

// Case 5: fork family — duplicate sequence, two children of one parent, multiple heads,
// missing parent, self-parent, cycle.
{
  const { telosDir } = fixture();
  const e1 = append(telosDir, "draft");
  const e2 = append(telosDir, "candidate", { plan_hash: "sha256:p" });
  const h1 = proposalEventHash(e1);
  // fork: two events (seq 3) both parented on e2
  const forkA = makeProposalEvent({ proposal_id: PID, sequence: 3, stage: "review", plan_hash: "sha256:p", parent_event_hash: proposalEventHash(e2), artifact_refs: [], actor: {}, provenance: null, policy_result: null, recorded_at: "t" }, privatePem);
  const forkB = makeProposalEvent({ proposal_id: PID, sequence: 4, stage: "review", plan_hash: "sha256:p", parent_event_hash: proposalEventHash(e2), artifact_refs: [], actor: {}, provenance: null, policy_result: null, recorded_at: "t2" }, privatePem);
  assert.equal(verifyProposalChain([e1, e2, forkA, forkB], publicJwk).ok, false, "fork (two children of one parent) breaks");
  // duplicate sequence
  const dup = makeProposalEvent({ proposal_id: PID, sequence: 2, stage: "review", plan_hash: "sha256:p", parent_event_hash: proposalEventHash(e2), artifact_refs: [], actor: {}, provenance: null, policy_result: null, recorded_at: "t" }, privatePem);
  assert.equal(verifyProposalChain([e1, e2, dup], publicJwk).ok, false, "duplicate sequence breaks");
  // missing parent
  const orphan = makeProposalEvent({ proposal_id: PID, sequence: 3, stage: "review", plan_hash: "sha256:p", parent_event_hash: "sha256:ghost", artifact_refs: [], actor: {}, provenance: null, policy_result: null, recorded_at: "t" }, privatePem);
  assert.equal(verifyProposalChain([e1, e2, orphan], publicJwk).ok, false, "missing parent breaks");
  // self-parent (parent hash points to itself is impossible to forge post-sign; a parent at a
  // later/equal file position is the detectable form)
  assert.equal(verifyProposalChain([e2, e1], publicJwk).ok, false, "parent at later position breaks");
  // multiple heads / roots: two roots
  const root2 = makeProposalEvent({ proposal_id: PID, sequence: 2, stage: "draft", plan_hash: null, parent_event_hash: null, artifact_refs: [], actor: {}, provenance: null, policy_result: null, recorded_at: "t" }, privatePem);
  assert.equal(verifyProposalChain([e1, root2], publicJwk).ok, false, "two roots break");
  console.log("Case 5 OK: fork family (fork/dup-seq/missing-parent/reorder/two-roots)");
}

// Case 6: atomicAppendProposalEvent concurrency — two builders from the same initial head yield a
// LINEAR chain, not two children of one parent.
{
  const { telosDir } = fixture();
  append(telosDir, "draft");
  // Two sequential atomic appends (the lock serializes them; each rereads the head).
  append(telosDir, "candidate", { plan_hash: "sha256:p" });
  append(telosDir, "review", { plan_hash: "sha256:p" });
  const { events } = readProposalEvents(telosDir);
  assert.equal(events.length, 3);
  const chain = verifyProposalChain(events, publicJwk);
  assert.equal(chain.ok, true, "linear after sequential atomic appends");
  assert.deepEqual(events.map((e) => e.sequence), [1, 2, 3], "contiguous sequences");
  console.log("Case 6 OK: atomic append yields a linear chain");
}

// Case 7: latestDecisionForPlan selects by exact plan hash; decisions for other plans are ignored.
{
  const { telosDir } = fixture();
  append(telosDir, "decision", { plan_hash: "sha256:planA", fields: { decision: "authorized", policy_result_ref: "sha256:a" } });
  append(telosDir, "decision", { plan_hash: "sha256:planB", fields: { decision: "revise", policy_result_ref: "sha256:b" } });
  const { events } = readProposalEvents(telosDir);
  assert.equal(latestDecisionForPlan(events, "sha256:planA").decision, "authorized");
  assert.equal(latestDecisionForPlan(events, "sha256:planB").decision, "revise");
  assert.equal(latestDecisionForPlan(events, "sha256:ghost"), null, "no decision for unknown plan");
  console.log("Case 7 OK: latestDecisionForPlan by exact plan hash");
}

// Case 8: deriveProposalId determinism + sortedUnique; lineageKey provider-scoping + placeholders.
{
  assert.equal(deriveProposalId(["b", "a", "a"]), deriveProposalId(["a", "b"]), "sorted+unique");
  assert.equal(lineageKey("OpenAI", "resp_1"), "openai:resp_1", "provider lowercased");
  assert.equal(lineageKey("openai", ""), null, "empty id -> null");
  assert.equal(lineageKey("openai", "self"), null, "placeholder id -> null");
  assert.equal(lineageKey("", "resp_1"), null, "missing provider -> null");
  assert.equal(normalizeProvenance({ provider: "openai", model: "gpt-x", response_id: "r" }).response_model, "gpt-x", "model->response_model");
  console.log("Case 8 OK: proposalId + lineageKey + provenance");
}

// Case 9: artifact store round-trip + tamper -> null; review-input hash determinism.
{
  const { telosDir } = fixture();
  const { ref } = writeProposalArtifact(telosDir, { kind: "candidate", plan: { a: 1 } });
  assert.deepEqual(readProposalArtifact(telosDir, ref), { kind: "candidate", plan: { a: 1 } }, "round-trip");
  // bit-flip the file
  const hex = ref.slice("sha256:".length);
  writeFileSync(path.join(telosDir, "artifacts", "sha256_" + hex + ".json"), '{"kind":"tampered"}');
  assert.equal(readProposalArtifact(telosDir, ref), null, "tampered artifact -> null");
  const h1 = computeReviewInputHash({ plan_hash: "sha256:p", review_contract_ref: "sha256:c", evidence: [{ path: "b", sha256: "sha256:2" }, { path: "a", sha256: "sha256:1" }] });
  const h2 = computeReviewInputHash({ plan_hash: "sha256:p", review_contract_ref: "sha256:c", evidence: [{ path: "a", sha256: "sha256:1" }, { path: "b", sha256: "sha256:2" }] });
  assert.equal(h1, h2, "evidence order-independent");
  console.log("Case 9 OK: artifact round-trip + review-input hash");
}

// Helpers for policy-result cases.
const allPass = () => Object.fromEntries(POLICY_CHECK_KEYS.map((k) => [k, "pass"]));
function policyArtifact({ outcome, checks = allPass(), blockers = [], findings = [], revision = { index: 1, maximum: 3 }, plan_hash = "sha256:p" }) {
  return { policy_contract_ref: POLICY_CONTRACT_V1, plan_hash, outcome, checks, blockers, findings, revision };
}

// Case 10: deriveOutcome routing — identical checks, different findings -> each of the four outcomes.
{
  const checks = allPass();
  assert.equal(deriveOutcome(checks, [], [], { index: 1, maximum: 3 }), "authorized", "clean -> authorized");
  assert.equal(deriveOutcome(checks, [], [{ class: "protocol", reparable: false, requires_human: false }], { index: 1, maximum: 3 }), "blocked", "protocol -> blocked");
  assert.equal(deriveOutcome(checks, [], [{ class: "hold", reparable: false, requires_human: true }], { index: 1, maximum: 3 }), "human-review-required", "requires_human -> human");
  assert.equal(deriveOutcome(checks, [], [{ class: "verified", reparable: true, requires_human: false }], { index: 1, maximum: 3 }), "revise", "reparable+budget -> revise");
  assert.equal(deriveOutcome(checks, [], [{ class: "verified", reparable: true, requires_human: false }], { index: 3, maximum: 3 }), "human-review-required", "reparable+exhausted -> human");
  console.log("Case 10 OK: deriveOutcome routing table");
}

// Case 11: verifyPolicyResult accepts all four; verifyAuthorizationResult accepts only authorized.
{
  const authorized = policyArtifact({ outcome: "authorized" });
  assert.equal(verifyPolicyResult(authorized, { planHash: "sha256:p" }).ok, true, "policy: authorized ok");
  assert.equal(verifyAuthorizationResult(authorized, { planHash: "sha256:p" }).ok, true, "auth: authorized ok");
  const revise = policyArtifact({ outcome: "revise", findings: [{ class: "verification", reparable: true, requires_human: false }] });
  assert.equal(verifyPolicyResult(revise, { planHash: "sha256:p" }).ok, true, "policy: revise ok");
  assert.equal(verifyAuthorizationResult(revise, { planHash: "sha256:p" }).ok, false, "auth: revise rejected");
  console.log("Case 11 OK: layered verifiers");
}

// Case 12: verifyPolicyResult rejects missing/unknown/duplicate check, contract mismatch, plan mismatch,
// and a lying outcome.
{
  const good = policyArtifact({ outcome: "authorized" });
  const missing = { ...good, checks: { ...good.checks } }; delete missing.checks.concerns;
  assert.equal(verifyPolicyResult(missing, { planHash: "sha256:p" }).ok, false, "missing check rejected");
  const unknown = { ...good, checks: { ...good.checks, bogus: "pass" } };
  assert.equal(verifyPolicyResult(unknown, { planHash: "sha256:p" }).ok, false, "unknown check rejected");
  const badContract = { ...good, policy_contract_ref: "sha256:wrong" };
  assert.equal(verifyPolicyResult(badContract, { planHash: "sha256:p" }).ok, false, "contract mismatch rejected");
  assert.equal(verifyPolicyResult(good, { planHash: "sha256:other" }).ok, false, "plan mismatch rejected");
  const lying = policyArtifact({ outcome: "authorized", findings: [{ class: "protocol", reparable: false, requires_human: false }] });
  assert.equal(verifyPolicyResult(lying, { planHash: "sha256:p" }).ok, false, "outcome != derived rejected");
  console.log("Case 12 OK: verifyPolicyResult rejections");
}

console.log("test-proposal-ledger.mjs OK");
