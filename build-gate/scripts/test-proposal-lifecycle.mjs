// test-proposal-lifecycle.mjs — end-to-end lifecycle composition (keyless): candidate compiled with
// lifecycle metadata -> recorder writes draft/candidate/review -> gate reconstructs state from the
// ledger -> decision (authorized/blocked) -> runBuild reads authorization from disk. Also: restart
// resume, and that authorization requires the exact written plan.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair } from "../../merkle-dag/crypto.mjs";
import { compileAndHashPlan, assignNodeLineages } from "../../merkle-dag/planner.mjs";
import { writePlan } from "../../merkle-dag/merkle.mjs";
import { runBuild, defaultVerifyNode } from "../../merkle-dag/orchestrate.mjs";
import { PROPOSAL_KEY_ID, readProposalEvents } from "../../merkle-dag/proposal-ledger.mjs";
import { computeDiskTreeHash } from "../../merkle-dag/artifact.mjs";
import { makeProposalRecorder } from "../proposal-recorder.mjs";
import { validateProposalLifecycle } from "../proposal-gate.mjs";

// A keyless lifecycle fixture: an ephemeral proposal-controller Ed25519 key, a candidate plan
// carrying lifecycle metadata + the controller pubkey pinned into authorized_signers.
function setup({ proposalId = "proposal-e2e" } = {}) {
  const ws = mkdtempSync(path.join(os.tmpdir(), "telos-e2e-"));
  const telosDir = path.join(ws, ".telos");
  mkdirSync(telosDir, { recursive: true });
  writeFileSync(path.join(ws, "a.txt"), "a\n");
  const controller = generateKeypair();
  const signerFor = (id) => (id === PROPOSAL_KEY_ID ? controller.privatePem : controller.privatePem);
  const tasks = [{ id: "A", writes: ["a.txt"], reads: [], requirements: "a", test: { cmd: "node", args: ["-e", "0"] } }];
  const defs = tasks.map((t) => ({ id: t.id, files: t.writes, requirements: t.requirements, test: t.test, dependencies: [] }));
  const lifecycle = { contract_ref: "sha256:c", proposal_id: proposalId, predecessor_plan_hash: null, ...assignNodeLineages(defs, { proposalId }) };
  const { plan } = compileAndHashPlan({ tasks, authorizedSigners: { [PROPOSAL_KEY_ID]: controller.publicJwk }, repoRoot: ws, lifecycle });
  writePlan(telosDir, plan);
  return { ws, telosDir, plan, signerFor, controller, proposalId };
}

// dispatch/verify stubs (settle node A green).
const makeDispatch = (ws) => async (injected) => { for (const f of injected.files) writeFileSync(path.join(ws, f), `c ${injected.id}`); return { ok: true, signer: PROPOSAL_KEY_ID }; };
const realVerify = () => async (node, baseDir) => { const disk = computeDiskTreeHash(node.files, baseDir); return { ok: true, tree_hash: disk.tree_hash, files: disk.files }; };
const allPass = () => Object.fromEntries(["written_plan", "proposal_ref_binding", "required_packets", "packet_signatures", "provider_lineage", "cold_review_inputs", "required_approvals", "required_edits", "concerns", "risk_policy", "obligation_anchors", "protected_paths", "proposal_chain"].map((k) => [k, "pass"]));

// Case 1: happy path — draft -> candidate -> decision(authorized) -> runBuild reaches ready.
{
  const { ws, telosDir, plan, signerFor, proposalId } = setup();
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId });
  assert.ok(rec, "recorder created");
  rec.recordDraft({ inputRefs: ["sha256:idea"] });
  rec.recordCreationCall({ seat: "claude", provenance: { provider: "anthropic", response_id: "a1" } });
  rec.recordCandidate({ planHash: plan.plan_hash });
  // authorized decision with an all-pass certificate
  rec.recordDecision({ planHash: plan.plan_hash, checks: allPass(), blockers: [], findings: [] });
  // runBuild reads authorization from disk (no caller-supplied hash)
  const build = await runBuild({ telosDir, baseDir: ws, dispatch: makeDispatch(ws), verifyNode: realVerify(), signerFor, requireAuthorizedDecision: true, maxRounds: 5 });
  assert.ok(!build.error, "runBuild authorized: " + JSON.stringify(build.error || ""));
  assert.equal(build.report.merge_status, "ready", "reaches ready");
  console.log("Case 1 OK: happy path to ready");
}

// Case 2: a non-authorized decision blocks runBuild (no dispatch).
{
  const { ws, telosDir, plan, signerFor, proposalId } = setup();
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId });
  rec.recordDraft({ inputRefs: ["sha256:idea"] });
  rec.recordCandidate({ planHash: plan.plan_hash });
  // a verified-blocker finding routes to blocked
  const { decision } = rec.recordDecision({ planHash: plan.plan_hash, checks: { ...allPass(), concerns: "fail" }, blockers: ["verified blocker: x"], findings: [{ code: "VERIFIED_BLOCKER", class: "protocol", reparable: false, requires_human: false, ref: null }] });
  assert.equal(decision, "blocked", "verified/protocol -> blocked");
  let dispatched = false;
  const build = await runBuild({ telosDir, baseDir: ws, dispatch: async () => { dispatched = true; return { ok: true, signer: PROPOSAL_KEY_ID }; }, verifyNode: realVerify(), signerFor, requireAuthorizedDecision: true, maxRounds: 5 });
  assert.equal(build.error, "DECISION_NOT_AUTHORIZED", "blocked decision does not authorize");
  assert.equal(dispatched, false, "no dispatch");
  console.log("Case 2 OK: blocked decision -> runBuild refuses");
}

// Case 3: recordDecision computes the outcome deterministically (deriveOutcome) — a reparable
// finding with revision budget routes to revise; carrying a revision_brief_ref.
{
  const { telosDir, plan, signerFor, proposalId } = setup();
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId });
  rec.recordDraft({ inputRefs: ["sha256:idea"] });
  rec.recordCandidate({ planHash: plan.plan_hash });
  const brief = rec.writeArtifact({ record_type: "revision-brief", source_review_event_refs: [], prose: "add a boundary test" }).ref;
  const { decision } = rec.recordDecision({ planHash: plan.plan_hash, checks: { ...allPass(), concerns: "fail" }, blockers: ["reparable"], findings: [{ code: "REQUIRED_VERIFICATION", class: "verification", reparable: true, requires_human: false, ref: null }], revision: { index: 1, maximum: 3 }, revisionBriefRef: brief });
  assert.equal(decision, "revise", "reparable + budget -> revise");
  const { events } = readProposalEvents(telosDir);
  const decisionEvent = events.find((e) => e.stage === "decision");
  assert.equal(decisionEvent.revision_brief_ref, brief, "revise decision carries revision_brief_ref");
  console.log("Case 3 OK: revise decision + revision_brief_ref");
}

// Case 4: restart resume — a second recorder instance (same key) resumes the verified chain and
// appends a further event; the chain still verifies.
{
  const { telosDir, plan, signerFor, proposalId } = setup();
  const rec1 = makeProposalRecorder({ telosDir, signerFor, proposalId });
  rec1.recordDraft({ inputRefs: ["sha256:idea"] });
  rec1.recordCandidate({ planHash: plan.plan_hash });
  const before = readProposalEvents(telosDir).events.length;
  // "process 2": a fresh recorder over the same on-disk ledger + key
  const rec2 = makeProposalRecorder({ telosDir, signerFor, proposalId });
  assert.equal(rec2.proposalId, rec1.proposalId, "resumed proposal_id");
  rec2.recordDisposition({ disposition: { record_type: "disposition", concern_ref: "sha256:x", plan_hash: plan.plan_hash, disposition: "expired-unresolved", derived_from: { kind: "expiration-policy" }, actor: { controller: true } } });
  const after = readProposalEvents(telosDir);
  assert.equal(after.events.length, before + 1, "second process appended");
  const pl = validateProposalLifecycle({ telosDir, packets: [], requiredModels: [], signed: false });
  assert.equal(pl.checks.proposal_chain, "pass", "chain still verifies after restart");
  console.log("Case 4 OK: restart resume across recorder instances");
}

// Case 5: authorization is keyed by the EXACT written plan — an authorized decision for a different
// plan hash does not authorize the current plan.
{
  const { ws, telosDir, plan, signerFor, proposalId } = setup();
  const rec = makeProposalRecorder({ telosDir, signerFor, proposalId });
  rec.recordDraft({ inputRefs: ["sha256:idea"] });
  rec.recordCandidate({ planHash: plan.plan_hash });
  // authorize a DIFFERENT (fictional) plan hash
  rec.recordDecision({ planHash: "sha256:some-other-plan", checks: allPass(), blockers: [], findings: [] });
  const build = await runBuild({ telosDir, baseDir: ws, dispatch: makeDispatch(ws), verifyNode: realVerify(), signerFor, requireAuthorizedDecision: true, maxRounds: 5 });
  assert.equal(build.error, "NO_AUTHORIZED_DECISION", "authorization for another plan does not apply");
  console.log("Case 5 OK: authorization keyed to exact written plan");
}

console.log("test-proposal-lifecycle.mjs OK");
