// proposal-orchestrator.mjs — composes the proposal-lifecycle primitives into the autonomous entry
// point (decision 1). buildProject delegates here when dossier.proposal_lifecycle === true; the legacy
// path is untouched. This is the ONLY place the whole lifecycle runs end to end:
//
//   controller key (single-sourced, pinned) -> recorder -> recordDraft
//     -> outer revision loop:
//          Daedalus workshop (claude/codex) -> compile candidate N (+ minted verification nodes
//          for carried verification requests + lifecycle proposal_id) -> writePlan -> recordCandidate
//          -> deriveRevisionDispositions AFTER N compiled -> review manifests -> runCouncil(review)
//          -> processReviewPackets (SOLE concern minter) -> sweepExpiredHolds -> validateRecords
//          (base + lifecycle, reconstructed from the ledger) -> recordDecision (full report.blockers)
//          -> branch on outcome
//     -> on authorized: runBuild(requireAuthorizedDecision, lifecycleVerify)
//
// Every enforcement identity is a controller-derived content address; the gate reconstructs all state
// from the ledger, never from anything this orchestrator holds in memory.

import { existsSync } from "node:fs";
import path from "node:path";
import { createPublicKey, createPrivateKey } from "node:crypto";
import { canonicalize } from "../merkle-dag/vendor.mjs";
import { runCouncil, planSeats } from "./council.mjs";
import { validateRecords } from "./gate.mjs";
import { authorizedSignersFor, teamForNode } from "./teams.mjs";
import { makeTeamDispatch } from "./build-orchestrator.mjs";
import {
  processReviewPackets, sweepExpiredHolds, deriveRevisionDispositions,
  activeConcerns, reconstructProposalState
} from "./concerns.mjs";
import { validateProposalLifecycle } from "./proposal-gate.mjs";
import { makeProposalRecorder, buildReviewManifest, buildRevisionBrief } from "./proposal-recorder.mjs";
import { runDaedalusWorkshop, runParallelDaedalus } from "./daedalus.mjs";
import { resolve as resolveCheck, isRegistered, checkContractRef } from "./check-registry.mjs";
import { loadRiskPolicy, evaluateRiskClass, holdPolicyFor } from "./risk-policy.mjs";
import { compileAndHashPlan, assignNodeLineages } from "../merkle-dag/planner.mjs";
import { writePlan } from "../merkle-dag/merkle.mjs";
import { runBuild, defaultVerifyNode } from "../merkle-dag/orchestrate.mjs";
import { PROPOSAL_KEY_ID, readProposalEvents, readProposalArtifact } from "../merkle-dag/proposal-ledger.mjs";
import { generateKeypair } from "../merkle-dag/crypto.mjs";
import { deriveVerifyNodeId, deriveObligationId } from "../merkle-dag/obligation.mjs";

// Canonical task-body <-> string round-trip for the workshop candidate (decision 8 / round-8): a
// single canonical STRING that both Daedalus value-equality convergence and the parse-back step
// deserialize to compileAndHashPlan's task fields. A body that does not deserialize to a non-empty
// task array is rejected (fail-closed).
export function serializeTasks(tasks) { return canonicalize(tasks); }
export function parseTasks(body) {
  let t;
  try { t = typeof body === "string" ? JSON.parse(body) : body; } catch { return null; }
  if (!Array.isArray(t) || t.length === 0) return null;
  for (const task of t) if (!task || typeof task.id !== "string" || !task.id) return null;
  return t;
}

// Reconstruct the verification-request accumulator FROM the ledger (decision 8b(a)) — never an
// in-memory array, so a durable resume rebuilds it. A request is a concern whose required_verification
// is requested and resolves to a REGISTERED kind. Deduped by concern_ref.
function reconstructVerificationRequests(events) {
  const { concerns } = reconstructProposalState(events);
  const byConcern = new Map();
  for (const c of concerns) {
    const rv = c.required_verification;
    if (!rv || !rv.requested) continue;
    const cc = rv.check_contract || {};
    if (!isRegistered(cc.kind)) continue;
    if (!byConcern.has(c.concern_ref)) byConcern.set(c.concern_ref, { concern_ref: c.concern_ref, scope: c.scope, check_contract: cc, required_result: rv.required_result || "pass" });
  }
  return [...byConcern.values()];
}

// Mint a dedicated verification node + obligation per carried verification request (decision 7). The
// node id is the FULL concern_ref hex (no collision); the test IS the registry-resolved check; the
// node depends on the concern's scope node if that resolves to a live node id in `tasks`, else on ALL
// non-verification nodes so it runs LAST (never zero-dep, never a dangling dep). Fail-closed on an
// unresolvable / unregistered kind.
export function mintVerificationNodes(verificationRequests, tasks) {
  const liveIds = new Set(tasks.map((t) => t.id));
  const nonVerifyIds = tasks.map((t) => t.id);
  const nodes = [], obligationDefs = [], errors = [];
  const seen = new Set();
  for (const req of verificationRequests) {
    if (seen.has(req.concern_ref)) continue;
    seen.add(req.concern_ref);
    const r = resolveCheck(req.check_contract.kind, req.check_contract.params_json);
    if (!r || !r.ok) { errors.push({ concern_ref: req.concern_ref, error: r ? r.error : "resolve failed" }); continue; }
    const nodeId = deriveVerifyNodeId(req.concern_ref);
    const deps = (req.scope && liveIds.has(req.scope)) ? [req.scope] : nonVerifyIds.slice();
    // Task convention (planner.mjs): `writes` (declared files) + `baseDependencies` (explicit deps).
    // The verify node writes nothing; it runs the registry-resolved check AFTER its dependencies.
    nodes.push({ id: nodeId, writes: [], reads: [], requirements: `verify concern ${req.concern_ref}`, test: r.test, baseDependencies: deps });
    obligationDefs.push({
      obligation_id: deriveObligationId(req.concern_ref),
      concern_ref: req.concern_ref,
      required_result: req.required_result || "pass",
      check_contract_ref: checkContractRef(req.check_contract),
      discharge_node_id: nodeId
    });
  }
  return { nodes, obligationDefs, errors };
}

export function makeExecutionLifecycleVerifier(baseDir) {
  return ({ telosDir, nowMs }) =>
    validateProposalLifecycle({
      telosDir,
      baseDir,
      requiredModels: [],
      packets: [],
      nowMs,
      forceSignedDisjointness: true
    });
}

function blocked(phase, reasons, extra = {}) { return { phase, ok: false, decision: extra.decision || null, blocked: Array.isArray(reasons) ? reasons : [reasons], ...extra }; }

/**
 * Run the full proposal lifecycle. Returns a phased result compatible with buildProject's contract.
 * Injected (keyless-testable): callSeat (review council), callWorkshopSeat (Daedalus adapter), callTeam
 * (execution). signerFor resolves team keys; the controller key is single-sourced here.
 */
// Normalize a parallel-authorship result (docs/daedalus-methodology.md) to the
// shape the revision loop consumes from the serial workshop: converged-parallel
// -> converged-for-submission; conflict (needs-eye) or a non-converged round ->
// stalemate (human review / The Eye). The integration candidate's artifact
// carries `.plan`, so final_candidate_ref resolves the same way. creation_lineage
// records every real seat call (both source authors, the integrator, both
// verifiers) so cold review sees the true creators.
function normalizeParallelWorkshop(result) {
  const converged = result.state === "converged-parallel";
  const lineage = [
    ...(result.sources || []).map((s) => ({ seat: s.seat, round: 1, provenance: s.provenance, artifact_ref: s.artifact_ref })),
    ...(result.integration && result.integration.seat ? [{ seat: result.integration.seat, round: 1, provenance: result.integration.provenance, artifact_ref: result.integration.candidate_ref }] : []),
    ...(result.verifications || []).map((v) => ({ seat: v.seat, round: 1, provenance: v.provenance, artifact_ref: result.integration && result.integration.candidate_ref }))
  ];
  return {
    state: converged ? "converged-for-submission" : "stalemate",
    reason: result.reason,
    terminal: result.terminal,
    final_candidate_ref: result.candidate_ref,
    creation_lineage: lineage,
    conflicts: result.conflicts || []
  };
}

export async function runProposalLifecycle({
  dossier, taskList, teams, situation = null, callSeat, callWorkshopSeat, callParallelSeat, callTeam,
  keyring, signerFor: injectedSignerFor, baseDir, telosDir, marketPackets = [], source,
  maxRepairRounds = 8, adaptAttempts = 2, concurrency, nowMs = 0, maxRevisions
}) {
  // Authorship mode (docs/daedalus-methodology.md): serial author->reviewer loop
  // by default (small deltas, back-compatible); parallel constraint/implementation
  // authorship when the dossier opts in. Selection FAILS CLOSED: an explicit request
  // for parallel authorship with no callParallelSeat adapter injected must NOT silently
  // downgrade to serial — a caller that asked for the two-seat trust structure would
  // otherwise get the weaker single-track path without knowing it. Block instead.
  const parallelRequested = dossier?.authorship === "parallel";
  if (parallelRequested && typeof callParallelSeat !== "function") {
    return blocked("plan", ["PARALLEL_AUTHORSHIP_UNAVAILABLE: dossier.authorship === \"parallel\" but no callParallelSeat adapter was injected; refusing to silently downgrade to serial authorship"]);
  }
  const useParallelAuthorship = parallelRequested;
  // 1. Controller key — single-sourced, pinned DIRECTLY into authorized_signers (decision 2, B1+B2).
  const envSk = process.env.TELOS_PROPOSAL_CONTROLLER_SK || null;
  let controllerPriv, controllerPubJwk, ephemeral = false;
  if (envSk) {
    controllerPriv = envSk;
    try { controllerPubJwk = createPublicKey(createPrivateKey(envSk)).export({ format: "jwk" }); }
    catch (e) { return blocked("approval", [`TELOS_PROPOSAL_CONTROLLER_SK is not a valid private key: ${e.message}`]); }
  } else {
    // Ephemeral key over a PERSISTED ledger throws on resume (chain signed by a lost key); refuse with
    // a DISTINCT documented error rather than a raw throw (round-6 should-fix).
    const existing = readProposalEvents(telosDir);
    if (existing.events && existing.events.length) {
      return blocked("approval", ["EPHEMERAL_KEY_OVER_EXISTING_LEDGER: a proposal.jsonl already exists but no durable TELOS_PROPOSAL_CONTROLLER_SK is set; refusing to start (set the durable key or use a fresh telosDir)"]);
    }
    const kp = generateKeypair(); controllerPriv = kp.privatePem; controllerPubJwk = kp.publicJwk; ephemeral = true;
  }
  // Composite signerFor: team nodes still settle under their team key; PROPOSAL_KEY_ID -> controller
  // (decision 2 round-4). Forwarding a team-only signerFor makes the recorder null; a controller-only
  // one makes team nodes fail to settle.
  const signerFor = (id) => (id === PROPOSAL_KEY_ID ? controllerPriv : (injectedSignerFor ? injectedSignerFor(id) : null));
  const authorizedSigners = { ...authorizedSignersFor(teams, keyring), [PROPOSAL_KEY_ID]: controllerPubJwk };

  // The execution-time lifecycle-state re-verification (decision 6), forcing signed disjointness.
  const lifecycleVerify = makeExecutionLifecycleVerifier(baseDir);

  // 2. Recorder + draft. recordDraft derives the proposal_id from the draft artifact ref.
  const recorder = makeProposalRecorder({ telosDir, signerFor });
  if (!recorder) return blocked("approval", ["no proposal-controller key available (recorder is null)"]);
  const draftBody = serializeTasks(taskList);
  const draftRef = recorder.writeArtifact({ kind: "draft-tasks", body: draftBody }).ref;
  recorder.recordDraft({ inputRefs: [draftRef], recordedAt: nowMs });
  const proposalId = recorder.proposalId;

  // Risk / hold / standing wiring (injected into the SOLE minter).
  const riskPolicy = loadRiskPolicy(dossier);
  const riskClassFor = (concern) => evaluateRiskClass({ paths: [], scope: concern.scope, judgment_class: concern.judgment_class }, riskPolicy).risk_class;
  const holdPolicyForRc = (rc) => holdPolicyFor(rc, riskPolicy);
  const standingFor = () => null; // cold start (never SHORTENS); live standing is out of scope for the autonomous entry point

  const maximum = Number.isInteger(maxRevisions) ? maxRevisions : (Number.isInteger(dossier?.max_revisions) ? dossier.max_revisions : 3);
  let candidateBody = draftBody;
  let lastReport = null;

  for (let index = 1; index <= maximum; index++) {
    // a. Daedalus workshop refines the candidate (claude/codex negotiation).
    let workshop;
    try {
      const appendEvent = (ev) => recorder.record({ stage: "negotiation", artifact_refs: ev.artifact_refs, policy_result: ev.policy_result, recorded_at: nowMs });
      workshop = useParallelAuthorship
        ? normalizeParallelWorkshop(await runParallelDaedalus({ frame: candidateBody, callSeat: callParallelSeat, writeArtifact: recorder.writeArtifact, appendEvent }))
        : await runDaedalusWorkshop({ draft: candidateBody, callSeat: callWorkshopSeat, writeArtifact: recorder.writeArtifact, appendEvent });
    } catch (e) { return blocked("plan", [`daedalus workshop error: ${e.message}`]); }
    // Record each workshop creation-lineage entry as a negotiation event with that seat's provenance,
    // so cold review sees the real plan creators (else a review seat reusing a workshop-author key slips).
    for (const cl of workshop.creation_lineage || []) recorder.recordCreationCall({ seat: cl.seat, provenance: cl.provenance, recordedAt: nowMs });
    if (workshop.state === "stalemate") {
      const needsEye = workshop.terminal === "needs-eye";
      const label = needsEye ? "workshop conflict (parallel authorship) — routed to The Eye" : `workshop stalemate${workshop.reason ? ` (${workshop.reason})` : ""}`;
      const { decision } = recorder.recordDecision({ planHash: draftRef, checks: naChecks(), blockers: [label], findings: [{ code: needsEye ? "WORKSHOP_CONFLICT" : "WORKSHOP_STALEMATE", class: "hold", reparable: false, requires_human: true, ref: null }], revision: { index, maximum } });
      return blocked("approval", [`${label} — human review required`], { decision });
    }
    const finalArtifact = readProposalArtifact(telosDir, workshop.final_candidate_ref);
    const finalTasks = parseTasks(finalArtifact && finalArtifact.plan);
    if (!finalTasks) return blocked("plan", ["workshop produced a candidate body that does not deserialize to a valid task list"]);
    candidateBody = serializeTasks(finalTasks);

    // b. Reconstruct the verification-request accumulator FROM the ledger (decision 8b(a)).
    const before = readProposalEvents(telosDir).events;
    const verificationRequests = reconstructVerificationRequests(before);
    const minted = mintVerificationNodes(verificationRequests, finalTasks);
    if (minted.errors.length) {
      const { decision } = recorder.recordDecision({ planHash: draftRef, checks: naChecks(), blockers: minted.errors.map((e) => `verification request ${e.concern_ref}: ${e.error}`), findings: [{ code: "UNRESOLVABLE_VERIFICATION", class: "hold", reparable: false, requires_human: true, ref: null }], revision: { index, maximum } });
      return blocked("approval", ["a carried verification request could not be resolved — human review required"], { decision });
    }

    // c. Compile candidate N WITH the minted verify nodes + obligations + lifecycle(proposal_id).
    const allTasks = [...finalTasks, ...minted.nodes];
    // assignNodeLineages hashes { files, requirements, test } where files === the task's writes.
    const defs = allTasks.map((t) => ({ id: t.id, files: t.writes || t.files || [], requirements: t.requirements, test: t.test }));
    const lifecycle = { contract_ref: dossier?.contract_ref || "sha256:contract", proposal_id: proposalId, predecessor_plan_hash: null, ...assignNodeLineages(defs, { proposalId }) };
    let compiled;
    try { compiled = compileAndHashPlan({ tasks: allTasks, authorizedSigners, repoRoot: baseDir, obligations: minted.obligationDefs, lifecycle }); }
    catch (e) { compiled = { errors: [e.message] }; }
    if (compiled.errors) {
      // An N+1 compile error (e.g. a carried discharge node dropped) is human-review, never a fall-through.
      const { decision } = recorder.recordDecision({ planHash: draftRef, checks: naChecks(), blockers: compiled.errors.map(String), findings: [{ code: "COMPILE_ERROR", class: "hold", reparable: false, requires_human: true, ref: null }], revision: { index, maximum } });
      return blocked("plan", compiled.errors.map(String), { decision });
    }
    writePlan(telosDir, compiled.plan);
    const planHash = compiled.plan.plan_hash;
    recorder.recordCandidate({ planHash, artifactRefs: [workshop.final_candidate_ref], recordedAt: nowMs });

    // d. deriveRevisionDispositions AFTER candidate N is compiled (decision 5): carried concerns whose
    // obligation is attached get a verification-required disposition (against the REAL new plan).
    const beforeState = reconstructProposalState(before);
    const priorActive = activeConcerns(beforeState.concerns, beforeState.dispositions, proposalId);
    const revDisp = deriveRevisionDispositions({ priorActiveConcerns: priorActive, actualNewPlan: compiled.plan, attachedObligations: compiled.plan.obligations || [], nowMs });
    for (const d of revDisp) recorder.recordDisposition({ disposition: d, recordedAt: nowMs });

    // e. Review the exact compiled candidate: per-seat manifest binding -> council. Every council
    // seat (planSeats) is bound to the recomputed plan hash so no packet slips cold-input verification.
    const invocations = [];
    for (const seat of planSeats(dossier)) {
      const built = buildReviewManifest({ telosDir, planHash, seat: seat.model, role: seat.role || "approver", workstream: seat.workstream || null, reviewContract: { kind: "review-contract", objective: dossier?.objective || "" }, evidenceFiles: [], baseDir });
      invocations.push(built.invocation);
    }
    const context = { invocations, writeArtifact: recorder.writeArtifact };
    const council = await runCouncil({ callSeat, dossier, context });

    // f. processReviewPackets — the SOLE controller-derived concern minter.
    const pr = processReviewPackets({ results: council, planHash, recorder, riskClassFor, holdPolicyFor: holdPolicyForRc, standingFor, nowMs });
    // g. sweep expired holds (frozen clock).
    sweepExpiredHolds({ recorder, events: readProposalEvents(telosDir).events, nowMs });

    // An unregistered check kind cannot auto-convert -> human review (never a silent drop).
    if (pr.unregisteredKinds.length) {
      const { decision } = recorder.recordDecision({ planHash, checks: naChecks(), blockers: pr.unregisteredKinds.map((k) => `unregistered check kind '${k}'`), findings: [{ code: "UNREGISTERED_KIND", class: "hold", reparable: false, requires_human: true, ref: null }], revision: { index, maximum } });
      return blocked("approval", ["a required_verification named an unregistered check kind — human review required"], { decision });
    }

    // h. validateRecords: base gate + lifecycle gate (reconstructed from the ledger).
    const packets = council.filter((r) => r && r.ok && r.packet).map((r) => r.packet);
    const gateSource = { ...(source || {}), telosDir, baseDir, nowMs };
    const report = validateRecords(dossier, packets, gateSource, [], marketPackets);
    lastReport = report;
    const pl = report.proposal_lifecycle || {};

    // A required_verification raised THIS round is only minted at the NEXT candidate compile
    // (obligations are reconstructed from the ledger at the top of a round). A blocking concern already
    // forces a revise via its hold, but a required_verification on a NON-BLOCKING concern
    // (consideration / evidence-claim) would otherwise let this round authorize with the requested
    // check never minted — a silent drop. Force a reparable `verification` finding whenever this
    // round produced a verification request that is not yet an obligation in the current plan, so the
    // decision routes to `revise` (or, at the revision cap, `human-review-required`) and the next
    // candidate mints it. Fail closed: a requested verification is never dropped.
    const mintedConcernRefs = new Set((compiled.plan.obligations || []).map((o) => o.concern_ref));
    const pendingVerification = pr.verificationRequests.some((r) => !mintedConcernRefs.has(r.concern_ref));
    const findings = [...(pl.findings || [])];
    if (pendingVerification) findings.push({ code: "PENDING_VERIFICATION", class: "verification", reparable: true, requires_human: false, ref: null });

    // i. recordDecision with the FULL report.blockers (base + lifecycle) so deriveOutcome's blocker
    // guard INDEPENDENTLY prevents authorized whenever ANY blocker exists (decision 4 round-4).
    const { decision } = recorder.recordDecision({
      planHash, checks: pl.checks || naChecks(), blockers: report.blockers,
      findings, revision: { index, maximum }
    });

    // j. Branch on the gate-derived outcome.
    if (decision === "authorized") {
      const build = await runBuild({
        telosDir, baseDir,
        dispatch: makeTeamDispatch({ routeFor: (id) => routeForNode(id, allTasks, teams), callTeam, baseDir, dossier, maxAttempts: adaptAttempts }),
        verifyNode: defaultVerifyNode, signerFor, maxRounds: maxRepairRounds, concurrency,
        requireAuthorizedDecision: true, lifecycleVerify, nowMs
      });
      if (build.error) return { phase: "build", ok: false, decision, error: build.error, detail: build.detail, report: build.report, plan: compiled.plan, council: report, teams, situation };
      return { phase: "build", ok: build.report.merge_status === "ready", decision, report: build.report, trace: build.trace, council: report, plan: compiled.plan, teams, situation };
    }
    if (decision === "blocked" || decision === "human-review-required") {
      return { phase: "approval", ok: false, decision, blocked: report.blockers, council: report, plan: compiled.plan, teams, situation };
    }
    // decision === "revise": loop again with the accumulated obligations carried via the ledger.
  }

  // Budget exhausted across every candidate -> human-review-required (distinct from a workshop stalemate).
  const { decision } = recorder.recordDecision({ planHash: draftRef, checks: naChecks(), blockers: ["revision budget exhausted"], findings: [{ code: "BUDGET_EXHAUSTED", class: "hold", reparable: false, requires_human: true, ref: null }], revision: { index: maximum, maximum } });
  return blocked("approval", ["revision budget exhausted — human review required"], { decision, council: lastReport });
}

// A closed all-"n/a" checks object for the OFF-PLAN decisions (stalemate / compile-error / budget)
// where no plan-bound certificate is meaningful; deriveOutcome routes on the findings, not the checks,
// and the blocker guard keeps these non-authorizing.
function naChecks() {
  return {
    written_plan: "n/a", proposal_ref_binding: "n/a", required_packets: "n/a", packet_signatures: "n/a",
    provider_lineage: "n/a", cold_review_inputs: "n/a", required_approvals: "n/a", required_edits: "n/a",
    concerns: "n/a", risk_policy: "n/a", obligation_anchors: "n/a", protected_paths: "n/a", proposal_chain: "n/a"
  };
}

function routeForNode(id, tasks, teams) {
  const t = tasks.find((x) => x.id === id) || {};
  return teamForNode(t, teams);
}
