// test-daedalus.mjs — the Daedalus workshop: objection hashing, the total state machine, driver.
import assert from "node:assert/strict";
import {
  DAEDALUS_MAX_ROUNDS, computeObjectionHash, objectionLedgerFrom,
  deriveWorkshopState, validateDispositions, runDaedalusWorkshop,
  PARALLEL_ROLES, OBLIGATION_FIELDS, validateObligationMatrix, deriveParallelState, runParallelDaedalus
} from "../daedalus.mjs";

// A complete obligation-matrix row (all five fields non-blank).
const okRow = (n) => Object.fromEntries(OBLIGATION_FIELDS.map((f) => [f, f + n]));

// Build a round artifact with the fields deriveWorkshopState reads.
function round({ n, inHash, outHash, aKey = "anthropic:a" + n, rKey = "openai:c" + n, bound = null, objections = [], resolutions = [] }) {
  return {
    round: n, input_plan_artifact_hash: inHash, output_plan_artifact_hash: outHash,
    author: { seat: n % 2 ? "claude" : "codex", provenance_key: aKey },
    reviewer: { seat: n % 2 ? "codex" : "claude", provenance_key: rKey, bound_hash: bound ?? outHash },
    objections, resolutions, supersessions: [], withdrawals: []
  };
}

// Case 1: controller-computed objection hash is deterministic + order-independent on evidence_refs.
{
  const h1 = computeObjectionHash({ scope: "s", claim: "c", evidence_refs: ["b", "a"] });
  const h2 = computeObjectionHash({ scope: "s", claim: "c", evidence_refs: ["a", "b"] });
  assert.equal(h1, h2);
  console.log("Case 1 OK: objection hash");
}

// Case 2: convergence — zero unresolved + distinct provenance + reviewer binds output hash.
{
  const r = deriveWorkshopState({ rounds: [round({ n: 1, inHash: "c0", outHash: "c1" })], maxRounds: 6, initialCandidateRef: "c0" });
  assert.equal(r.state, "converged-for-submission");
  assert.equal(r.terminal, "submit", "converged permits submission only");
  console.log("Case 2 OK: convergence -> submit");
}

// Case 3: a silently-dropped objection blocks convergence (absence is not a disposition).
{
  const obj = { objection_hash: computeObjectionHash({ scope: "s", claim: "boom", evidence_refs: [] }), scope: "s", claim: "boom", evidence_refs: [] };
  const rounds = [round({ n: 1, inHash: "c0", outHash: "c1", objections: [obj] }), round({ n: 2, inHash: "c1", outHash: "c2" })]; // round 2 just omits it
  const r = deriveWorkshopState({ rounds, maxRounds: 6, initialCandidateRef: "c0" });
  assert.notEqual(r.state, "converged-for-submission", "dropped objection does not converge");
  assert.ok(r.unresolved.includes(obj.objection_hash), "objection stays unresolved");
  console.log("Case 3 OK: silently-dropped objection blocks convergence");
}

// Case 4: unresolved + changed hash -> continue; unresolved + repeated hash -> stalemate.
{
  const obj = { objection_hash: computeObjectionHash({ scope: "s", claim: "x", evidence_refs: [] }), scope: "s", claim: "x", evidence_refs: [] };
  const cont = deriveWorkshopState({ rounds: [round({ n: 1, inHash: "c0", outHash: "c1", objections: [obj] })], maxRounds: 6, initialCandidateRef: "c0" });
  assert.equal(cont.state, "continue", "unresolved + changed hash -> continue");
  const stale = deriveWorkshopState({ rounds: [round({ n: 1, inHash: "c0", outHash: "c1", objections: [obj] }), round({ n: 2, inHash: "c1", outHash: "c1" })], maxRounds: 6, initialCandidateRef: "c0" });
  assert.equal(stale.state, "stalemate", "repeated candidate hash -> stalemate");
  assert.equal(stale.reason, "repeated-candidate-hash");
  console.log("Case 4 OK: continue vs stalemate by candidate hash");
}

// Case 5: round cap -> stalemate.
{
  const obj = { objection_hash: computeObjectionHash({ scope: "s", claim: "y", evidence_refs: [] }), scope: "s", claim: "y", evidence_refs: [] };
  const rounds = [];
  for (let i = 1; i <= 3; i++) rounds.push(round({ n: i, inHash: "c" + (i - 1), outHash: "c" + i, objections: i === 1 ? [obj] : [] }));
  const r = deriveWorkshopState({ rounds, maxRounds: 3, initialCandidateRef: "c0" });
  assert.equal(r.state, "stalemate");
  assert.equal(r.reason, "round-cap");
  console.log("Case 5 OK: round cap -> stalemate");
}

// Case 6: invalid/shared provenance can never converge.
{
  const shared = deriveWorkshopState({ rounds: [round({ n: 1, inHash: "c0", outHash: "c1", aKey: "anthropic:same", rKey: "anthropic:same" })], maxRounds: 6, initialCandidateRef: "c0" });
  assert.notEqual(shared.state, "converged-for-submission", "shared provenance can't converge");
  console.log("Case 6 OK: shared provenance can't converge");
}

// Case 7: validateDispositions — only the originating seat may retire; unknown hash rejected.
{
  const menu = [{ objection_hash: "sha256:o1", scope: "s", claim: "c", raised_by_seat: "codex" }];
  const wrongSeat = validateDispositions({ dispositions: [{ objection_hash: "sha256:o1", action: "withdrawn" }], openMenu: menu, actorSeat: "claude", provenanceKey: "anthropic:a" });
  assert.equal(wrongSeat.rejected[0].why_rejected, "not-originating-seat");
  const unknown = validateDispositions({ dispositions: [{ objection_hash: "sha256:ghost", action: "resolved" }], openMenu: menu, actorSeat: "codex", provenanceKey: "openai:c" });
  assert.equal(unknown.rejected[0].why_rejected, "unknown-or-closed-hash");
  const ok = validateDispositions({ dispositions: [{ objection_hash: "sha256:o1", action: "resolved" }], openMenu: menu, actorSeat: "codex", provenanceKey: "openai:c" });
  assert.equal(ok.accepted.resolutions.length, 1);
  console.log("Case 7 OK: disposition validation");
}

// Case 8: runDaedalusWorkshop driver — a mock transcript that raises then resolves an objection
// converges; artifacts + negotiation events are produced; determinism holds.
{
  let ac = 0, cc = 0;
  const objection = { scope: "task:auth", claim: "needs a boundary test", evidence_refs: [] };
  const objHash = computeObjectionHash(objection);
  const callSeat = async ({ seat, role }) => {
    // round 1: claude proposes a revision + raises the objection; codex reviews clean.
    // round 2: codex resolves the objection (originating seat) and both bind the same hash.
    if (seat === "claude") { ac++; return { plan_revision: ac === 1 ? "plan-v1" : "", objections: [], dispositions: [], provenance: { provider: "anthropic", response_id: "a" + ac } }; }
    cc++;
    if (cc === 1) return { plan_revision: "", objections: [objection], dispositions: [], provenance: { provider: "openai", response_id: "c" + cc } };
    return { plan_revision: "", objections: [], dispositions: [{ objection_hash: objHash, action: "resolved", note: "added test" }], provenance: { provider: "openai", response_id: "c" + cc } };
  };
  const artifacts = [];
  const events = [];
  const writeArtifact = (v) => { const ref = "sha256:" + (artifacts.push(v) - 1) + "-" + JSON.stringify(v).length; return { ref }; };
  const appendEvent = async (e) => { events.push(e); };
  const res = await runDaedalusWorkshop({ draft: "plan-v0", callSeat, writeArtifact, appendEvent, maxRounds: 6 });
  assert.equal(res.state, "converged-for-submission", "resolved objection -> converged: " + JSON.stringify(res.reason));
  assert.ok(events.length >= 2, "one negotiation event per round");
  assert.ok(res.creation_lineage.length >= 4, "creation lineage records every seat call");
  console.log("Case 8 OK: runDaedalusWorkshop converges after resolution");
}

// --- Parallel authorship (docs/daedalus-methodology.md) ---

// Case 9: obligation-matrix completeness — every row needs all five fields.
{
  assert.equal(validateObligationMatrix([]).complete, false, "empty matrix incomplete");
  assert.equal(validateObligationMatrix([okRow(1)]).complete, true, "full row complete");
  const missing = validateObligationMatrix([{ ...okRow(1), negative_test: "" }]);
  assert.equal(missing.complete, false, "blank field incomplete");
  assert.deepEqual(missing.incompleteRows[0].missing, ["negative_test"]);
  console.log("Case 9 OK: obligation-matrix completeness");
}

// Case 10: deriveParallelState converges only with both sources, dual descent, complete matrix, both verifications preserved + distinct provenance.
{
  const sources = [
    { role: "constraints", artifact_ref: "sha:cons", provenance_key: "openai:c1" },
    { role: "implementation", artifact_ref: "sha:impl", provenance_key: "anthropic:a1" }
  ];
  const integration = { candidate_ref: "sha:cand", descends_from: ["sha:cons", "sha:impl"], obligation_matrix: [okRow(1)], provenance_key: "anthropic:a1" };
  const verifications = [
    { role: "constraints", verdict: "preserved", conflicts: [], provenance_key: "openai:c2" },
    { role: "implementation", verdict: "preserved", conflicts: [], provenance_key: "anthropic:a2" }
  ];
  const ok = deriveParallelState({ sources, integration, verifications });
  assert.equal(ok.state, "converged-parallel");
  assert.equal(ok.terminal, "submit");
  console.log("Case 10 OK: parallel convergence -> submit");
}

// Case 11: a violated verification routes to The Eye (never blended).
{
  const sources = [
    { role: "constraints", artifact_ref: "sha:cons", provenance_key: "openai:c1" },
    { role: "implementation", artifact_ref: "sha:impl", provenance_key: "anthropic:a1" }
  ];
  const integration = { candidate_ref: "sha:cand", descends_from: ["sha:cons", "sha:impl"], obligation_matrix: [okRow(1)], provenance_key: "anthropic:a1" };
  const verifications = [
    { role: "constraints", verdict: "violated", conflicts: ["invariant X dropped in integration"], provenance_key: "openai:c2" },
    { role: "implementation", verdict: "preserved", conflicts: [], provenance_key: "anthropic:a2" }
  ];
  const c = deriveParallelState({ sources, integration, verifications });
  assert.equal(c.state, "conflict");
  assert.equal(c.terminal, "needs-eye", "conflict routes to The Eye");
  assert.equal(c.conflicts[0].role, "constraints");
  console.log("Case 11 OK: verification conflict -> needs-eye");
}

// Case 12: integration must descend from BOTH sources; an incomplete matrix blocks convergence.
{
  const sources = [
    { role: "constraints", artifact_ref: "sha:cons", provenance_key: "openai:c1" },
    { role: "implementation", artifact_ref: "sha:impl", provenance_key: "anthropic:a1" }
  ];
  const verifications = [
    { role: "constraints", verdict: "preserved", conflicts: [], provenance_key: "openai:c2" },
    { role: "implementation", verdict: "preserved", conflicts: [], provenance_key: "anthropic:a2" }
  ];
  const oneParent = deriveParallelState({ sources, integration: { candidate_ref: "sha:cand", descends_from: ["sha:cons"], obligation_matrix: [okRow(1)] }, verifications });
  assert.equal(oneParent.reason, "integration-not-descended-from-both");
  const badMatrix = deriveParallelState({ sources, integration: { candidate_ref: "sha:cand", descends_from: ["sha:cons", "sha:impl"], obligation_matrix: [{ ...okRow(1), exit_criterion: "" }] }, verifications });
  assert.equal(badMatrix.reason, "incomplete-obligation-matrix");
  assert.notEqual(badMatrix.state, "converged-parallel");
  console.log("Case 12 OK: dual-descent + complete-matrix gates");
}

// Case 13: shared source provenance can never converge (the two seats must be genuinely distinct).
{
  const sources = [
    { role: "constraints", artifact_ref: "sha:cons", provenance_key: "same:x" },
    { role: "implementation", artifact_ref: "sha:impl", provenance_key: "same:x" }
  ];
  const r = deriveParallelState({ sources, integration: { candidate_ref: "sha:cand", descends_from: ["sha:cons", "sha:impl"], obligation_matrix: [okRow(1)] }, verifications: [] });
  assert.equal(r.reason, "invalid-source-provenance");
  console.log("Case 13 OK: shared source provenance blocks convergence");
}

// Case 14: runParallelDaedalus driver — two source nodes, an integration descending from both, dual verification -> converged; events recorded.
{
  const seatResp = ({ seat, role, phase }) => {
    const provenance = { provider: seat === "codex" ? "openai" : "anthropic", response_id: `${seat}-${role}-${phase}` };
    if (phase === "author") return { plan: `${role}-design`, provenance };
    if (phase === "integrate") return { plan: "integrated-candidate", obligation_matrix: [okRow(1), okRow(2)], provenance };
    return { verdict: "preserved", conflicts: [], provenance }; // verify
  };
  const artifacts = [], events = [];
  const writeArtifact = (v) => ({ ref: "sha256:" + (artifacts.push(v) - 1) });
  const appendEvent = async (e) => { events.push(e); };
  const res = await runParallelDaedalus({ frame: "frozen-frame", callSeat: seatResp, writeArtifact, appendEvent });
  assert.equal(res.state, "converged-parallel", "driver converges: " + JSON.stringify(res.reason));
  assert.equal(res.sources.length, 2, "two content-addressed source nodes");
  assert.deepEqual(res.integration.descends_from.sort(), res.sources.map((s) => s.artifact_ref).sort(), "integration descends from both sources");
  assert.equal(events.filter((e) => e.stage === "parallel-authorship").length, 1);
  assert.equal(events.filter((e) => e.stage === "parallel-verification").length, 1);
  console.log("Case 14 OK: runParallelDaedalus driver converges");
}

// Case 15: driver routes a real integration violation to The Eye.
{
  const seatResp = ({ seat, role, phase }) => {
    const provenance = { provider: seat === "codex" ? "openai" : "anthropic", response_id: `${seat}-${role}-${phase}` };
    if (phase === "author") return { plan: `${role}-design`, provenance };
    if (phase === "integrate") return { plan: "integrated", obligation_matrix: [okRow(1)], provenance };
    // constraints seat finds its invariant dropped; implementation is fine.
    return role === "constraints"
      ? { verdict: "violated", conflicts: ["fail-closed weakened during integration"], provenance }
      : { verdict: "preserved", conflicts: [], provenance };
  };
  const writeArtifact = (v) => ({ ref: "sha256:" + JSON.stringify(v).length });
  const res = await runParallelDaedalus({ frame: "f", callSeat: seatResp, writeArtifact, appendEvent: async () => {} });
  assert.equal(res.state, "conflict");
  assert.equal(res.terminal, "needs-eye");
  assert.equal(res.conflicts[0].role, "constraints");
  console.log("Case 15 OK: driver routes integration conflict to The Eye");
}

console.log("test-daedalus.mjs OK");
