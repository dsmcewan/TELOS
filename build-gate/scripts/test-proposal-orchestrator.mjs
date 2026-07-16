// test-proposal-orchestrator.mjs — keyless end-to-end of the composed proposal lifecycle through
// buildProject({ dossier: { proposal_lifecycle: true } }). Proves the autonomous entry point actually
// runs the recorder + Daedalus workshop + outer revision loop + gate-reconstructed authorization +
// execution, not just the primitives in isolation. All keyless; disjoint creation/review provenance.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildProject, makeTeamKeyring } from "../build-orchestrator.mjs";
import { planTeams } from "../teams.mjs";
import { readProposalEvents } from "../../merkle-dag/proposal-ledger.mjs";

const NEEDLE = "AUTH_GUARD", TARGET = "out.txt";

function ws() { const d = mkdtempSync(path.join(os.tmpdir(), "orch-")); mkdirSync(path.join(d, ".telos"), { recursive: true }); return d; }

// A per-run unique-id source so EVERY provenance key is disjoint (creation vs review cold-review),
// unless a case deliberately reuses one.
function fixture() {
  let uid = 0;
  const prov = (provider, fixedId = null) => ({ provider, response_id: fixedId || `resp-${++uid}`, tool: "mock" });
  return { prov };
}

function reviewPacket(model, dossier, { decision = "approve", concerns = [] } = {}) {
  return { build_id: dossier.build_id, use_case: dossier.use_case, model, role: "approver", hard_stops: [], docs_reviewed: [], timestamp: new Date(0).toISOString(), decision, confidence: "high", required_edits: [], considerations: [], concerns, rationale: "ok" };
}
const verifyConcern = () => ({ scope: "plan", claim: "auth boundary must be verified", severity: "high", judgment_class: "hold-request", evidence_refs: [], required_verification: { requested: true, check_contract: { kind: "assert-file-contains", params_json: JSON.stringify({ target: TARGET, needle: NEEDLE }) }, required_result: "pass" } });

// Default converging workshop; disjoint provenance per call.
function convergingWorkshop(prov) { return async ({ seat }) => ({ plan_revision: "", objections: [], dispositions: [], provenance: prov(seat === "claude" ? "anthropic" : "openai") }); }

// Parallel-authorship callSeat (docs/daedalus-methodology.md): constraints=codex (openai provenance),
// implementation=claude (anthropic provenance). Author phase -> a source plan; integrate -> echo the
// frozen frame as the candidate body (so it deserializes) plus a COMPLETE five-field obligation matrix;
// verify -> each seat confirms its own contract survived. With { conflict: true } the constraints seat
// reports its invariant was violated by integration, driving deriveParallelState to needs-eye.
const okObligationRow = () => Object.fromEntries(["invariant", "mechanism", "task", "negative_test", "exit_criterion"].map((f) => [f, `${f}-1`]));
function parallelWorkshop(prov, { conflict = false } = {}) {
  return async ({ seat, role, phase, frame }) => {
    const provenance = prov(seat === "claude" ? "anthropic" : "openai");
    if (phase === "author") return { plan: `${role} source design`, provenance };
    if (phase === "integrate") return { plan: frame, obligation_matrix: [okObligationRow()], provenance };
    if (conflict && role === "constraints") return { verdict: "violated", conflicts: ["fail-closed weakened by integration"], provenance };
    return { verdict: "preserved", conflicts: [], provenance };
  };
}

function baseDossier(extra = {}) { return { build_id: "b1", use_case: "governance", objective: "add an auth boundary", proposal_lifecycle: true, write_targets: [TARGET], required_docs: [], ...extra }; }
function baseTasks(writes = [TARGET]) { return [{ id: "A", writes, reads: [], requirements: "write the auth boundary", test: { cmd: "node", args: ["-e", "process.exit(0)"] } }]; }

async function drive({ dossier, tasks, callSeat, callWorkshopSeat, callParallelSeat, callTeam, env }) {
  const dir = ws();
  const teams = planTeams({});
  const { keyring, signerFor } = makeTeamKeyring(teams);
  const prevEnv = process.env.TELOS_PROPOSAL_CONTROLLER_SK;
  if (env && env.TELOS_PROPOSAL_CONTROLLER_SK) process.env.TELOS_PROPOSAL_CONTROLLER_SK = env.TELOS_PROPOSAL_CONTROLLER_SK;
  else delete process.env.TELOS_PROPOSAL_CONTROLLER_SK;
  try {
    const res = await buildProject({ dossier, telos: "t", tasks, callSeat, callWorkshopSeat, callParallelSeat, callTeam, keyring, signerFor, baseDir: dir, telosDir: path.join(dir, ".telos"), nowMs: 1000, maxRevisions: 3 });
    return { res, dir };
  } finally {
    if (prevEnv === undefined) delete process.env.TELOS_PROPOSAL_CONTROLLER_SK; else process.env.TELOS_PROPOSAL_CONTROLLER_SK = prevEnv;
  }
}

// team writes the target file; poison=true writes WITHOUT the marker so the verify check fails.
function makeCallTeam({ poison = false } = {}) { return async ({ node }) => ({ files: (node.writes || node.files || []).map((f) => ({ path: f, content: poison ? "no marker" : `function login(){ ${NEEDLE}(); }` })) }); }

// Iteration-aware review: round 1 -> claude requests a verification (revise); later rounds -> approve.
function makeReviewLoop(prov, { concernFactory = verifyConcern } = {}) {
  let calls = 0;
  return async ({ model }, dossier) => {
    const iteration = Math.ceil(++calls / 3);
    if (model === "agy") return { packet: reviewPacket("agy", dossier), provenance: prov("agentic") };
    if (iteration === 1 && model === "claude") return { packet: reviewPacket("claude", dossier, { decision: "revise", concerns: [concernFactory()] }), provenance: prov("anthropic") };
    return { packet: reviewPacket(model, dossier, {}), provenance: prov(model === "claude" ? "anthropic" : "openai") };
  };
}

const D = (dossier) => (fn) => (seatArg) => fn(seatArg, dossier);

// ---------------------------------------------------------------------------
// Case (a): clean run — reviewers approve immediately, no concerns -> authorized -> ready.
{
  const { prov } = fixture();
  const dossier = baseDossier();
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov(model === "agy" ? "agentic" : model === "claude" ? "anthropic" : "openai") }));
  const { res, dir } = await drive({ dossier, tasks: baseTasks(), callSeat, callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam() });
  assert.equal(res.phase, "build", "(a) reaches build");
  assert.equal(res.decision, "authorized", "(a) clean run authorizes (read from the gate)");
  assert.equal(res.report.merge_status, "ready", "(a) ready");
  // the authorized decision is on the ledger, not hand-built
  const decisions = readProposalEvents(path.join(dir, ".telos")).events.filter((e) => e.stage === "decision");
  assert.ok(decisions.some((e) => e.decision === "authorized"), "(a) ledger carries an authorized decision");
  console.log("Case (a) OK: clean run -> authorized -> ready");
}

// ---------------------------------------------------------------------------
// Case (b) + NEGATIVE CONTROL: revise loop mints a verification obligation that is load-bearing at Rule 3.
{
  const { prov } = fixture();
  const dossier = baseDossier();
  const { res } = await drive({ dossier, tasks: baseTasks(), callSeat: D(dossier)(makeReviewLoop(prov)), callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam({ poison: false }) });
  assert.equal(res.decision, "authorized", "(b) revised candidate authorizes");
  assert.equal(res.report.merge_status, "ready", "(b) obligation discharged -> ready");
  // node-level proof: a verify-<concern_ref> node discharged its obligation
  assert.ok(res.report.nodes.some((n) => n.id.startsWith("verify-") && n.ok), "(b) verify node settled");

  const { prov: prov2 } = fixture();
  const dossier2 = baseDossier();
  const { res: ctl } = await drive({ dossier: dossier2, tasks: baseTasks(), callSeat: D(dossier2)(makeReviewLoop(prov2)), callWorkshopSeat: convergingWorkshop(prov2), callTeam: makeCallTeam({ poison: true }) });
  assert.equal(ctl.decision, "authorized", "(b-control) still authorizes (concern cleared by verification-required)");
  assert.notEqual(ctl.report.merge_status, "ready", "(b-control) NOT ready — the obligation is load-bearing at Rule 3");
  assert.ok(ctl.report.nodes.some((n) => n.id.startsWith("verify-") && n.checks.obligations === "UNDISCHARGED_OBLIGATION"), "(b-control) undischarged obligation flagged");
  console.log("Case (b) OK: verification obligation discharged -> ready; negative control -> authorized but not ready");
}

// ---------------------------------------------------------------------------
// Case (d): workshop stalemate -> human-review-required, no execution.
{
  const { prov } = fixture();
  const dossier = baseDossier();
  let wc = 0;
  const stalemateWorkshop = async ({ seat }) => ({ plan_revision: "", objections: [{ scope: "plan", claim: `unresolved-${++wc}`, evidence_refs: [] }], dispositions: [], provenance: prov(seat === "claude" ? "anthropic" : "openai") });
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov("agentic") }));
  const { res, dir } = await drive({ dossier, tasks: baseTasks(), callSeat, callWorkshopSeat: stalemateWorkshop, callTeam: makeCallTeam() });
  assert.equal(res.decision, "human-review-required", "(d) stalemate -> human-review-required (read from ledger)");
  assert.notEqual(res.phase, "build", "(d) no execution");
  console.log("Case (d) OK: workshop stalemate -> human-review-required");
}

// ---------------------------------------------------------------------------
// Case (e): a review seat REUSES a workshop-author provenance key -> cold-review violation -> blocked.
{
  const { prov } = fixture();
  const dossier = baseDossier();
  const sharedId = "shared-claude-1";
  const workshop = async ({ seat }) => ({ plan_revision: "", objections: [], dispositions: [], provenance: prov(seat === "claude" ? "anthropic" : "openai", seat === "claude" ? sharedId : null) });
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: model === "claude" ? prov("anthropic", sharedId) : prov(model === "agy" ? "agentic" : "openai") }));
  const { res } = await drive({ dossier, tasks: baseTasks(), callSeat, callWorkshopSeat: workshop, callTeam: makeCallTeam() });
  assert.notEqual(res.decision, "authorized", "(e) cold-review violation does not authorize");
  assert.ok((res.blocked || []).some((b) => /cold-review/.test(b)) || res.decision === "blocked", "(e) blocked on cold-review lineage");
  console.log("Case (e) OK: review seat reusing a creation-lineage key -> blocked");
}

// ---------------------------------------------------------------------------
// Case (g): a DURABLE controller key (env) — the chain verifies and the gate authorizes.
{
  const { generateKeypair } = await import("../../merkle-dag/crypto.mjs");
  const { privatePem } = generateKeypair();
  const { prov } = fixture();
  const dossier = baseDossier();
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov(model === "agy" ? "agentic" : model === "claude" ? "anthropic" : "openai") }));
  const { res } = await drive({ dossier, tasks: baseTasks(), callSeat, callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam(), env: { TELOS_PROPOSAL_CONTROLLER_SK: privatePem } });
  assert.equal(res.decision, "authorized", "(g) durable-key run authorizes");
  assert.equal(res.report.merge_status, "ready", "(g) durable-key run reaches ready");
  console.log("Case (g) OK: durable controller key authorizes");
}

// ---------------------------------------------------------------------------
// Case (i): base-gate protected_paths STILL gates in lifecycle mode (decision 4) — a protected-path
// write blocks even though proposal_lifecycle.checks.protected_paths reads "pass".
{
  const { prov } = fixture();
  const dossier = baseDossier({ write_targets: ["me/gemini/secret.txt"] });
  const tasks = baseTasks(["me/gemini/secret.txt"]);
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov(model === "agy" ? "agentic" : model === "claude" ? "anthropic" : "openai") }));
  const { res } = await drive({ dossier, tasks, callSeat, callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam() });
  assert.notEqual(res.decision, "authorized", "(i) protected-path write does not authorize in lifecycle mode");
  console.log("Case (i) OK: base-gate protected_paths still gates in lifecycle mode");
}

// ---------------------------------------------------------------------------
// Case (ephemeral-refusal): an ephemeral controller key over a PRE-EXISTING proposal ledger refuses
// with a distinct documented error (round-6 should-fix), not a raw throw.
{
  const { prov } = fixture();
  const dossier = baseDossier();
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov("anthropic") }));
  const dir = ws();
  const teams = planTeams({});
  const { keyring, signerFor } = makeTeamKeyring(teams);
  delete process.env.TELOS_PROPOSAL_CONTROLLER_SK;
  // seed a proposal ledger with one event under a DIFFERENT ephemeral key
  const { makeProposalRecorder } = await import("../proposal-recorder.mjs");
  const { generateKeypair } = await import("../../merkle-dag/crypto.mjs");
  const other = generateKeypair();
  const seed = makeProposalRecorder({ telosDir: path.join(dir, ".telos"), signerFor: () => other.privatePem, proposalId: "seed" });
  seed.recordDraft({ inputRefs: ["sha256:x"] });
  const res = await buildProject({ dossier, telos: "t", tasks: baseTasks(), callSeat, callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam(), keyring, signerFor, baseDir: dir, telosDir: path.join(dir, ".telos"), nowMs: 1000 });
  assert.equal(res.ok, false, "(eph) refuses to start over a pre-existing ledger");
  assert.ok((res.blocked || []).some((b) => /EPHEMERAL_KEY_OVER_EXISTING_LEDGER/.test(b)), "(eph) distinct documented error, not a raw throw");
  console.log("Case (eph) OK: ephemeral key over a pre-existing ledger refuses cleanly");
}

// ---------------------------------------------------------------------------
// Case (v): the SHARPEST form of the silent-drop hole — a reviewer that APPROVES (decision "approve",
// so the base-gate approval check is satisfied) while attaching a NON-BLOCKING consideration that
// carries a required_verification. Without the pending-verification fix this authorizes and reaches
// merge_status "ready" with the requested check NEVER minted. With the fix it must force a revise,
// mint the dedicated verify node, and — since the remediation is poisoned so the check FAILS on disk —
// NOT reach "ready". This reproduces the exact authorize→ready drop, not merely a mint miss.
{
  const { prov } = fixture();
  const dossier = baseDossier();
  const considerationWithVerify = { scope: "plan", claim: "please verify the boundary", severity: "low", judgment_class: "consideration", evidence_refs: [], required_verification: { requested: true, check_contract: { kind: "assert-file-contains", params_json: JSON.stringify({ target: TARGET, needle: NEEDLE }) }, required_result: "pass" } };
  let calls = 0;
  const callSeat = D(dossier)(async ({ model }, d) => {
    const iteration = Math.ceil(++calls / 3);
    if (model === "agy") return { packet: reviewPacket("agy", d), provenance: prov("agentic") };
    // claude APPROVES but attaches the consideration+required_verification on round 1
    if (iteration === 1 && model === "claude") return { packet: reviewPacket("claude", d, { decision: "approve", concerns: [considerationWithVerify] }), provenance: prov("anthropic") };
    return { packet: reviewPacket(model, d), provenance: prov(model === "claude" ? "anthropic" : "openai") };
  });
  const { res } = await drive({ dossier, tasks: baseTasks(), callSeat, callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam({ poison: true }) });
  assert.notEqual(res.report ? res.report.merge_status : "ready", "ready", "(v) an APPROVED non-blocking required_verification is still enforced, not dropped to ready");
  assert.ok((res.report?.nodes || []).some((n) => n.id.startsWith("verify-")), "(v) the requested verification WAS minted (not silently dropped)");
  console.log("Case (v) OK: an approve-path non-blocking required_verification is enforced, not silently dropped");
}

// ---------------------------------------------------------------------------
// Case (mint): mintVerificationNodes derives the run-last dependency set directly (finding 1 — the
// ordering was previously only implied by the e2e). Scope not matching a live node -> depend on ALL
// non-verification nodes; scope matching a live node -> depend on just that node. Never zero-dep.
{
  const { mintVerificationNodes } = await import("../proposal-orchestrator.mjs");
  const tasks = [{ id: "A", writes: ["a.txt"], test: { cmd: "node", args: ["-e", "0"] } }, { id: "B", writes: ["b.txt"], test: { cmd: "node", args: ["-e", "0"] } }];
  const cc = { kind: "assert-file-contains", params_json: JSON.stringify({ target: "a.txt", needle: "GENUINE_MARKER" }) };
  const noScope = mintVerificationNodes([{ concern_ref: "sha256:aa", scope: "plan", check_contract: cc, required_result: "pass" }], tasks);
  assert.deepEqual([...noScope.nodes[0].baseDependencies].sort(), ["A", "B"], "(mint) unresolved scope -> run LAST after all non-verify nodes");
  assert.ok(noScope.nodes[0].baseDependencies.length > 0, "(mint) never zero-dependency");
  const scoped = mintVerificationNodes([{ concern_ref: "sha256:bb", scope: "B", check_contract: cc, required_result: "pass" }], tasks);
  assert.deepEqual(scoped.nodes[0].baseDependencies, ["B"], "(mint) scope matching a live node -> depend on that node");
  console.log("Case (mint) OK: verification node run-last dependency derivation");
}

// ---------------------------------------------------------------------------
// Case (p1): parallel authorship (dossier.authorship === "parallel" + injected callParallelSeat)
// converges -> authorized -> ready. Proves the parallel workshop feeds a valid candidate through the
// SAME downstream lifecycle (mint/compile/authorize/execute) as the serial path.
{
  const { prov } = fixture();
  const dossier = baseDossier({ authorship: "parallel" });
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov(model === "agy" ? "agentic" : model === "claude" ? "anthropic" : "openai") }));
  const { res, dir } = await drive({ dossier, tasks: baseTasks(), callSeat, callParallelSeat: parallelWorkshop(prov), callTeam: makeCallTeam() });
  assert.equal(res.decision, "authorized", "(p1) parallel authorship authorizes");
  assert.equal(res.report.merge_status, "ready", "(p1) ready");
  // parallel-specific signature: an integration negotiation event descends from BOTH source nodes.
  const negotiations = readProposalEvents(path.join(dir, ".telos")).events.filter((e) => e.stage === "negotiation");
  assert.ok(negotiations.some((e) => e.policy_result && Array.isArray(e.policy_result.descends_from) && e.policy_result.descends_from.length === 2), "(p1) parallel path taken — integration descends from both source nodes");
  console.log("Case (p1) OK: parallel authorship -> authorized -> ready");
}

// ---------------------------------------------------------------------------
// Case (p2): a seat's contract is VIOLATED by integration -> deriveParallelState conflict (terminal
// "needs-eye") -> normalized to stalemate -> routed to The Eye / human review, NO execution.
{
  const { prov } = fixture();
  const dossier = baseDossier({ authorship: "parallel" });
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov("agentic") }));
  const { res } = await drive({ dossier, tasks: baseTasks(), callSeat, callParallelSeat: parallelWorkshop(prov, { conflict: true }), callTeam: makeCallTeam() });
  assert.equal(res.decision, "human-review-required", "(p2) parallel verification conflict -> human-review-required");
  assert.notEqual(res.phase, "build", "(p2) no execution on conflict");
  assert.ok((res.blocked || []).some((b) => /Eye|conflict/i.test(b)), "(p2) conflict routed to The Eye");
  console.log("Case (p2) OK: parallel verification conflict -> The Eye / human review, no execution");
}

// ---------------------------------------------------------------------------
// Case (p3): backward-compat — authorship "parallel" declared but NO callParallelSeat injected falls
// back to the serial workshop (the selector requires BOTH the flag and the injected seat).
{
  const { prov } = fixture();
  const dossier = baseDossier({ authorship: "parallel" });
  const callSeat = D(dossier)(async ({ model }, d) => ({ packet: reviewPacket(model, d), provenance: prov(model === "agy" ? "agentic" : model === "claude" ? "anthropic" : "openai") }));
  const { res } = await drive({ dossier, tasks: baseTasks(), callSeat, callWorkshopSeat: convergingWorkshop(prov), callTeam: makeCallTeam() });
  assert.equal(res.decision, "authorized", "(p3) missing callParallelSeat -> serial fallback still authorizes");
  console.log("Case (p3) OK: parallel flag without callParallelSeat falls back to serial");
}

console.log("test-proposal-orchestrator.mjs OK");
