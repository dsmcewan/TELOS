// test-proposal-gate.mjs — verifyWrittenPlan, proposal_ref binding, cold review, and the
// ledger-reconstructing validateProposalLifecycle.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair } from "../../merkle-dag/crypto.mjs";
import { compileAndHashPlan, assignNodeLineages } from "../../merkle-dag/planner.mjs";
import { writePlan, mutateNode } from "../../merkle-dag/merkle.mjs";
import {
  PROPOSAL_KEY_ID, makeProposalEvent, atomicAppendProposalEvent, writeProposalArtifact,
  computeReviewInputHash, deriveProposalId
} from "../../merkle-dag/proposal-ledger.mjs";
import { verifyWrittenPlan, checkProposalRefBinding, checkColdReview, validateProposalLifecycle } from "../proposal-gate.mjs";

// A lifecycle-mode candidate: plan carries a proposal-controller signer + lifecycle metadata.
function candidate({ proposalId = "proposal-x" } = {}) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-pg-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });
  writeFileSync(path.join(ws, "a.txt"), "a\n");
  const { privatePem, publicJwk } = generateKeypair();
  const tasks = [{ id: "A", writes: ["a.txt"], reads: [], requirements: "a", test: { cmd: "node", args: ["-e", "0"] } }];
  const defs = tasks.map((t) => ({ id: t.id, files: t.writes, requirements: t.requirements, test: t.test, dependencies: [] }));
  const lifecycle = { contract_ref: "sha256:c", proposal_id: proposalId, predecessor_plan_hash: null, ...assignNodeLineages(defs, { proposalId }) };
  const { plan } = compileAndHashPlan({ tasks, authorizedSigners: { [PROPOSAL_KEY_ID]: publicJwk }, repoRoot: ws, lifecycle });
  writePlan(telosDir, plan);
  return { ws, telosDir, plan, privatePem, publicJwk, proposalId };
}

const append = (telosDir, privatePem, publicJwk, proposalId, stage, extra = {}) =>
  atomicAppendProposalEvent(telosDir, (parentHash, sequence) =>
    makeProposalEvent({ proposal_id: proposalId, sequence, stage, plan_hash: extra.plan_hash ?? null, parent_event_hash: parentHash, artifact_refs: extra.artifact_refs ?? [], actor: extra.actor ?? {}, provenance: extra.provenance ?? null, policy_result: null, recorded_at: "t", ...extra.fields }, privatePem), { publicJwk });

// Case 1: verifyWrittenPlan — recompute-from-disk is the authority.
{
  const { telosDir, plan } = candidate();
  const wp = verifyWrittenPlan(telosDir);
  assert.equal(wp.ok, true, "clean candidate verifies");
  assert.equal(wp.plan_hash, plan.plan_hash);
  console.log("Case 1 OK: verifyWrittenPlan");
}

// Case 2: proposal_ref binding — build_id or a stale hash does not satisfy.
{
  const { plan } = candidate();
  const good = [{ model: "claude", proposal_ref: plan.plan_hash }, { model: "codex", proposal_ref: plan.plan_hash }, { model: "agy", proposal_ref: plan.plan_hash }];
  assert.equal(checkProposalRefBinding(good, plan.plan_hash, ["claude", "codex", "agy"]).length, 0, "matching refs pass");
  const buildIdRef = [{ model: "claude", proposal_ref: "build-123" }, { model: "codex", proposal_ref: plan.plan_hash }, { model: "agy", proposal_ref: plan.plan_hash }];
  assert.ok(checkProposalRefBinding(buildIdRef, plan.plan_hash, ["claude", "codex", "agy"]).length > 0, "build_id ref blocked");
  console.log("Case 2 OK: proposal_ref binding");
}

// Case 3: cold review — creation ∩ review lineage disjointness is provider-scoped.
{
  const { telosDir, plan, privatePem, publicJwk, proposalId } = candidate();
  append(telosDir, privatePem, publicJwk, proposalId, "draft");
  // creation call (negotiation) with anthropic:r_1
  append(telosDir, privatePem, publicJwk, proposalId, "negotiation", { provenance: { provider: "anthropic", response_id: "r_1" } });
  const { readProposalEvents } = await import("../../merkle-dag/proposal-ledger.mjs");
  const { events } = readProposalEvents(telosDir);
  // review packet reusing the SAME (anthropic, r_1) -> blocked
  const overlap = checkColdReview({ telosDir, events, packets: [{ model: "claude", provenance: { provider: "anthropic", response_id: "r_1" } }], planHash: plan.plan_hash, signed: true });
  assert.ok(overlap.blockers.some((b) => /cold-review violation/.test(b)), "overlap blocks");
  // provider-scoped: openai:r_1 does NOT collide with anthropic:r_1
  const distinct = checkColdReview({ telosDir, events, packets: [{ model: "codex", provenance: { provider: "openai", response_id: "r_1" } }], planHash: plan.plan_hash, signed: true });
  assert.equal(distinct.blockers.filter((b) => /cold-review violation/.test(b)).length, 0, "distinct provider -> no collision");
  console.log("Case 3 OK: provider-scoped cold-review disjointness");
}

// Case 4: cold review — a contaminated manifest (control-plane input) fails.
{
  const { ws, telosDir, plan, privatePem, publicJwk, proposalId } = candidate();
  writeFileSync(path.join(ws, "contract.txt"), "review contract\n");
  const { ref: contractRef } = writeProposalArtifact(telosDir, { kind: "review-contract", body: "..." });
  // legit manifest
  const manifest = { plan_hash: plan.plan_hash, review_contract_ref: contractRef, evidence: [{ path: "contract.txt", sha256: "sha256:" + require_sha(path.join(ws, "contract.txt")), kind: "source-doc" }] };
  const { ref: mRef } = writeProposalArtifact(telosDir, manifest);
  append(telosDir, privatePem, publicJwk, proposalId, "review", { artifact_refs: [mRef], fields: { review_input_hash: computeReviewInputHash(manifest) } });
  const { readProposalEvents } = await import("../../merkle-dag/proposal-ledger.mjs");
  let events = readProposalEvents(telosDir).events;
  const clean = checkColdReview({ telosDir, events, packets: [], planHash: plan.plan_hash, signed: true, baseDir: ws });
  assert.equal(clean.blockers.length, 0, "clean manifest passes: " + clean.blockers.join(";"));
  // contaminated manifest referencing the proposal ledger
  const badManifest = { plan_hash: plan.plan_hash, review_contract_ref: contractRef, evidence: [{ path: ".telos/proposal.jsonl", sha256: "sha256:x", kind: "evidence" }] };
  const { ref: bRef } = writeProposalArtifact(telosDir, badManifest);
  append(telosDir, privatePem, publicJwk, proposalId, "review", { artifact_refs: [bRef], fields: { review_input_hash: computeReviewInputHash(badManifest) } });
  events = readProposalEvents(telosDir).events;
  const contaminated = checkColdReview({ telosDir, events, packets: [], planHash: plan.plan_hash, signed: true, baseDir: ws });
  assert.ok(contaminated.blockers.some((b) => /contamination/.test(b)), "contaminated manifest blocked");
  console.log("Case 4 OK: manifest contamination blocked");
}

// Case 5: validateProposalLifecycle — proposal_id disagreement between candidate event and plan.lifecycle blocks.
{
  const { telosDir, plan, privatePem, publicJwk } = candidate({ proposalId: "proposal-real" });
  // candidate event stamped with a DIFFERENT proposal_id than plan.lifecycle.proposal_id
  append(telosDir, privatePem, publicJwk, "proposal-forged", "candidate", { plan_hash: plan.plan_hash });
  const r = validateProposalLifecycle({ telosDir, packets: [], requiredModels: [], signed: false });
  assert.ok(r.blockers.some((b) => /proposal_id/.test(b)), "proposal_id mismatch blocks");
  console.log("Case 5 OK: candidate proposal_id must match plan.lifecycle");
}

// Case 6: validateProposalLifecycle reconstructs concern state from the ledger (not from a caller).
{
  const { telosDir, plan, privatePem, publicJwk, proposalId } = candidate();
  append(telosDir, privatePem, publicJwk, proposalId, "candidate", { plan_hash: plan.plan_hash });
  // a verified-blocker concern recorded in a review event
  const concern = { record_type: "concern", concern_ref: "sha256:cc", plan_hash: plan.plan_hash, scope: "s", claim: "cross-tenant read", severity: "critical", judgment_class: "hold-request", raised_by: { seat: "grok" } };
  append(telosDir, privatePem, publicJwk, proposalId, "review", { fields: { concerns: [concern] } });
  append(telosDir, privatePem, publicJwk, proposalId, "disposition", { fields: { disposition: { record_type: "disposition", concern_ref: "sha256:cc", disposition: "verified", actor: { controller: true } } } });
  const r = validateProposalLifecycle({ telosDir, packets: [], requiredModels: [], signed: false, nowMs: 0 });
  assert.ok(r.blockers.some((b) => /verified blocker/.test(b)), "gate reconstructs the verified blocker from the ledger");
  assert.ok(r.findings.some((f) => f.class === "verified"), "verified finding emitted");
  console.log("Case 6 OK: gate reconstructs concern state from the ledger");
}

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
function require_sha(p) { return createHash("sha256").update(readFileSync(p)).digest("hex"); }

console.log("test-proposal-gate.mjs OK");
