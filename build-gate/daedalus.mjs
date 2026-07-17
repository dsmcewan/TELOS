// daedalus.mjs — the bounded claude/codex planning workshop. Objection hashes are controller-computed;
// convergence requires every prior objection EXPLICITLY resolved/superseded/withdrawn (absence is not
// a disposition); the state machine is total and candidate-hash-driven.
import { readFileSync } from "node:fs";
import { canonicalize, sha256hex } from "../merkle-dag/vendor.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));
const PLACEHOLDER_RE = /^$|_self$|^self$|placeholder/i;

// Seat and role->seat bindings are DATA (seats.json): a future model takes the
// workshop or a parallel-authorship role by data change, not a script edit.
// DAEDALUS_MAX_ROUNDS stays code — it is a protocol constant, not a seat binding.
const SEATS = JSON.parse(readFileSync(new URL("./seats.json", import.meta.url), "utf8"));

export const DAEDALUS_MAX_ROUNDS = 6;
export const DAEDALUS_SEATS = SEATS.workshop_seats;
const PROVIDER_BY_SEAT = Object.fromEntries(Object.entries(SEATS.seats).map(([m, s]) => [m, s.provider]));

// Controller-computed objection identity (a model-asserted objection_hash is discarded + recomputed).
export function computeObjectionHash(objection) {
  return H({ scope: objection.scope, claim: objection.claim, evidence_refs: [...(objection.evidence_refs || [])].sort() });
}

function isRealProvenanceKey(key) { return typeof key === "string" && !PLACEHOLDER_RE.test(key) && key.includes(":"); }

/**
 * Replay round artifacts into an objection ledger. ONLY an explicit validated resolution /
 * supersession / withdrawal record changes a status — absence never does.
 * @returns Map<objection_hash, { objection, status, disposed_in, disposition_record }>
 */
export function objectionLedgerFrom(rounds) {
  const ledger = new Map();
  for (const r of rounds) {
    for (const o of r.objections || []) {
      // Objection identity is ALWAYS controller-recomputed (round-7/8): a model-supplied
      // objection_hash is never trusted. dispose() below then matches disposition records against
      // this same recomputed key (and validateDispositions already binds a disposition to the
      // objection's ORIGINATING seat), so a seat cannot forge either an objection or its reference.
      const hash = computeObjectionHash(o);
      if (!ledger.has(hash)) ledger.set(hash, { objection: { ...o, objection_hash: hash }, status: "open", disposed_in: null, disposition_record: null });
    }
    const dispose = (rec, status) => {
      const e = ledger.get(rec.objection_hash);
      if (e && e.status === "open") { e.status = status; e.disposed_in = r.round; e.disposition_record = rec; }
    };
    for (const rec of r.resolutions || []) dispose(rec, "resolved");
    for (const rec of r.supersessions || []) dispose(rec, "superseded");
    for (const rec of r.withdrawals || []) dispose(rec, "withdrawn");
  }
  return ledger;
}

/**
 * Total, pure state machine (decision 9). Returns one of continue / converged-for-submission /
 * stalemate. Convergence is checked first because it naturally repeats the candidate hash
 * (the reviewer binds the author's exact artifact).
 */
export function deriveWorkshopState({ rounds, maxRounds = DAEDALUS_MAX_ROUNDS, initialCandidateRef }) {
  if (!Array.isArray(rounds) || rounds.length === 0) {
    return { state: "continue", reason: "no-rounds-yet", unresolved: [], round: 0, candidate_ref: initialCandidateRef };
  }
  const ledger = objectionLedgerFrom(rounds);
  const unresolved = [...ledger].filter(([, e]) => e.status === "open").map(([h]) => h).sort();
  const last = rounds[rounds.length - 1];
  const priorHashes = new Set([initialCandidateRef, ...rounds.slice(0, -1).map((r) => r.output_plan_artifact_hash)]);
  const hashRepeated = priorHashes.has(last.output_plan_artifact_hash);
  const authKey = last.author && last.author.provenance_key;
  const revKey = last.reviewer && last.reviewer.provenance_key;
  const provenanceValid = isRealProvenanceKey(authKey) && isRealProvenanceKey(revKey) && authKey !== revKey;
  const reviewerBindsSameHash = last.reviewer && last.reviewer.bound_hash === last.output_plan_artifact_hash;

  // 1. converged-for-submission (submission only — never authorization)
  if (unresolved.length === 0 && provenanceValid && reviewerBindsSameHash) {
    return { state: "converged-for-submission", reason: "all-objections-accounted", unresolved, round: last.round, candidate_ref: last.output_plan_artifact_hash, terminal: "submit" };
  }
  // 2. stalemate: unresolved + repeated candidate hash
  if (unresolved.length > 0 && hashRepeated) {
    return { state: "stalemate", reason: "repeated-candidate-hash", unresolved, round: last.round, candidate_ref: last.output_plan_artifact_hash, terminal: "needs-work" };
  }
  // 3. stalemate: hard cap reached without convergence
  if (rounds.length >= maxRounds) {
    return { state: "stalemate", reason: "round-cap", unresolved, round: last.round, candidate_ref: last.output_plan_artifact_hash, terminal: "needs-work" };
  }
  // 4. invalid/shared provenance can never converge — round burned
  if (!provenanceValid) {
    return { state: "continue", reason: "invalid-provenance-round-discarded", unresolved, round: last.round, candidate_ref: last.output_plan_artifact_hash };
  }
  // 5. unresolved + changed hash -> continue
  return { state: "continue", reason: "unresolved-changed-hash", unresolved, round: last.round, candidate_ref: last.output_plan_artifact_hash };
}

// Validate a seat's disposition entries against the controller's open-objection menu. Only the
// ORIGINATING seat may retire its objection, and the enclosing response must carry real provenance.
export function validateDispositions({ dispositions, openMenu, actorSeat, provenanceKey }) {
  const accepted = { resolutions: [], supersessions: [], withdrawals: [] };
  const rejected = [];
  const menuByHash = new Map(openMenu.map((o) => [o.objection_hash, o]));
  for (const d of dispositions || []) {
    const menuEntry = menuByHash.get(d.objection_hash);
    if (!menuEntry) { rejected.push({ ...d, why_rejected: "unknown-or-closed-hash" }); continue; }
    if (menuEntry.raised_by_seat && menuEntry.raised_by_seat !== actorSeat) { rejected.push({ ...d, why_rejected: "not-originating-seat" }); continue; }
    if (!isRealProvenanceKey(provenanceKey)) { rejected.push({ ...d, why_rejected: "no-provenance" }); continue; }
    const rec = { record_type: `objection-${d.action}`, objection_hash: d.objection_hash, actor: { seat: actorSeat, provenance_key: provenanceKey } };
    if (d.action === "resolved") accepted.resolutions.push(rec);
    else if (d.action === "superseded") accepted.supersessions.push({ ...rec, superseded_by: d.replacement_hash || null });
    else if (d.action === "withdrawn") accepted.withdrawals.push({ ...rec, reason: d.note || "" });
    else rejected.push({ ...d, why_rejected: "unknown-action" });
  }
  return { accepted, rejected };
}

/**
 * Run the workshop. Seat calls + artifact writes + event appends are INJECTED (keyless-testable).
 * @param callSeat  async ({ seat, role, candidateBody, openMenu }) -> { plan_revision, objections, dispositions, provenance }
 * @param writeArtifact (value) -> { ref }
 * @param appendEvent  async (event) -> any     (proposal ledger negotiation events)
 * @returns { state, reason, rounds, final_candidate_ref, creation_lineage, terminal }
 */
export async function runDaedalusWorkshop({ draft, callSeat, writeArtifact, appendEvent, maxRounds = DAEDALUS_MAX_ROUNDS }) {
  const candidateRef0 = writeArtifact({ kind: "candidate", plan: draft }).ref;
  const rounds = [];
  const creation_lineage = [];
  let currentRef = candidateRef0;
  let currentBody = draft;

  for (let round = 1; round <= maxRounds; round++) {
    const authorSeat = round % 2 === 1 ? "claude" : "codex";
    const reviewerSeat = authorSeat === "claude" ? "codex" : "claude";
    const openMenu = [...objectionLedgerFrom(rounds)].filter(([, e]) => e.status === "open").map(([h, e]) => ({ objection_hash: h, scope: e.objection.scope, claim: e.objection.claim, raised_by_seat: e.objection.raised_by && e.objection.raised_by.seat }));

    // author
    const aResp = await callSeat({ seat: authorSeat, role: "author", candidateBody: currentBody, openMenu });
    const aProvKey = provKey(authorSeat, aResp.provenance);
    const aRespRef = writeArtifact({ kind: "seat-response", body: aResp, provenance: aResp.provenance }).ref;
    creation_lineage.push({ seat: authorSeat, round, provenance: aResp.provenance, artifact_ref: aRespRef });
    let outputBody = currentBody;
    if (aResp.plan_revision && aResp.plan_revision !== "") outputBody = aResp.plan_revision;
    const outputRef = writeArtifact({ kind: "candidate", plan: outputBody }).ref;
    const authorObjections = (aResp.objections || []).map((o) => ({ ...o, objection_hash: computeObjectionHash(o), raised_by: { seat: authorSeat } }));
    const authorDisp = validateDispositions({ dispositions: aResp.dispositions, openMenu, actorSeat: authorSeat, provenanceKey: aProvKey });

    // reviewer sees the exact output
    const rResp = await callSeat({ seat: reviewerSeat, role: "reviewer", candidateBody: outputBody, openMenu });
    const rProvKey = provKey(reviewerSeat, rResp.provenance);
    const rRespRef = writeArtifact({ kind: "seat-response", body: rResp, provenance: rResp.provenance }).ref;
    creation_lineage.push({ seat: reviewerSeat, round, provenance: rResp.provenance, artifact_ref: rRespRef });
    let boundHash = outputRef;
    let nextBody = outputBody;
    if (rResp.plan_revision && rResp.plan_revision !== "" && rResp.plan_revision !== outputBody) { nextBody = rResp.plan_revision; boundHash = writeArtifact({ kind: "candidate", plan: nextBody }).ref; }
    const reviewerObjections = (rResp.objections || []).map((o) => ({ ...o, objection_hash: computeObjectionHash(o), raised_by: { seat: reviewerSeat } }));
    const reviewerDisp = validateDispositions({ dispositions: rResp.dispositions, openMenu, actorSeat: reviewerSeat, provenanceKey: rProvKey });

    const roundArtifact = {
      record_type: "daedalus-round", round,
      input_plan_artifact_hash: currentRef, output_plan_artifact_hash: outputRef,
      author: { seat: authorSeat, provenance_ref: aRespRef, provenance_key: aProvKey },
      reviewer: { seat: reviewerSeat, provenance_ref: rRespRef, provenance_key: rProvKey, bound_hash: boundHash },
      objections: [...authorObjections, ...reviewerObjections],
      resolutions: [...authorDisp.accepted.resolutions, ...reviewerDisp.accepted.resolutions],
      supersessions: [...authorDisp.accepted.supersessions, ...reviewerDisp.accepted.supersessions],
      withdrawals: [...authorDisp.accepted.withdrawals, ...reviewerDisp.accepted.withdrawals],
      rejected_dispositions: [...authorDisp.rejected, ...reviewerDisp.rejected]
    };
    const roundRef = writeArtifact(roundArtifact).ref;
    rounds.push(roundArtifact);

    const state = deriveWorkshopState({ rounds, maxRounds, initialCandidateRef: candidateRef0 });
    if (appendEvent) await appendEvent({ stage: "negotiation", artifact_refs: [roundRef, aRespRef, rRespRef], policy_result: { state: state.state, unresolved: state.unresolved.length, round } });

    currentRef = boundHash; currentBody = nextBody;
    if (state.state !== "continue") {
      return { state: state.state, reason: state.reason, rounds, final_candidate_ref: state.candidate_ref, creation_lineage, terminal: state.terminal };
    }
  }
  const finalState = deriveWorkshopState({ rounds, maxRounds, initialCandidateRef: candidateRef0 });
  return { state: finalState.state, reason: finalState.reason, rounds, final_candidate_ref: finalState.candidate_ref, creation_lineage, terminal: finalState.terminal };
}

function provKey(seat, provenance) {
  const provider = (provenance && provenance.provider) || PROVIDER_BY_SEAT[seat] || "";
  const id = provenance && provenance.response_id;
  if (typeof id !== "string" || PLACEHOLDER_RE.test(id) || !provider) return null;
  return provider.toLowerCase() + ":" + id;
}

// ---------------------------------------------------------------------------
// Parallel authorship (docs/daedalus-methodology.md). The serial loop above is
// retained for genuinely small deltas; real plan design splits into two seats
// working IN PARALLEL from one frozen frame, not an author->reviewer sequence:
//   - constraints seat (codex): invariants, trust boundaries, failure
//     semantics, normative schemas, proof obligations, adversarial tests.
//   - implementation seat (claude): architecture, interfaces, data flow, task
//     decomposition, sequencing, integration, delivery.
// Each output is a content-addressed source node; the integrated candidate must
// descend from BOTH and map every obligation through the five-field matrix.
// Each seat then verifies its own contract survived integration; a violation or
// any conflict routes to The Eye rather than being silently blended. The target
// is the smallest complete behavioral model that satisfies the invariant.
export const PARALLEL_ROLES = SEATS.parallel_authorship;
export const OBLIGATION_FIELDS = ["invariant", "mechanism", "task", "negative_test", "exit_criterion"];

// A matrix row is complete only when every field is a non-blank string.
export function validateObligationMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) return { complete: false, reason: "empty-matrix", incompleteRows: [] };
  const incompleteRows = [];
  matrix.forEach((row, i) => {
    const missing = OBLIGATION_FIELDS.filter((f) => typeof (row && row[f]) !== "string" || !row[f].trim());
    if (missing.length) incompleteRows.push({ index: i, missing });
  });
  return { complete: incompleteRows.length === 0, reason: incompleteRows.length ? "incomplete-rows" : null, incompleteRows };
}

// The structured proof-obligation set is OWNED by the constraints seat (GPT declares the invariants /
// proof obligations — docs/daedalus-methodology.md). Coverage is a strict BIJECTION between the declared
// obligation IDs and the integration matrix rows' obligation_id: every declared obligation is mapped by
// exactly one row, none is dropped, none is invented, none is duplicated. Field-completeness (above) is
// necessary but NOT sufficient — a matrix can have five non-blank fields per row yet silently omit or
// fabricate an obligation. This is the check that makes "map every obligation" structural.
export function validateObligationCoverage(matrix, declaredObligations) {
  const declared = Array.isArray(declaredObligations) ? declaredObligations.map((o) => (typeof o === "string" ? o.trim() : "")) : [];
  if (!declared.length || declared.some((o) => !o)) return { covered: false, reason: "no-declared-obligations", missing: [], extra: [] };
  if (declared.length !== new Set(declared).size) return { covered: false, reason: "duplicate-declared-obligation", missing: [], extra: [] };
  const rowIds = (Array.isArray(matrix) ? matrix : []).map((r) => (r && typeof r.obligation_id === "string" ? r.obligation_id.trim() : ""));
  if (!rowIds.length || rowIds.some((id) => !id)) return { covered: false, reason: "row-missing-obligation-id", missing: [], extra: [] };
  if (rowIds.length !== new Set(rowIds).size) return { covered: false, reason: "duplicate-row-obligation-id", missing: [], extra: [] };
  const declaredSet = new Set(declared), rowSet = new Set(rowIds);
  const missing = declared.filter((id) => !rowSet.has(id));
  const extra = rowIds.filter((id) => !declaredSet.has(id));
  if (missing.length || extra.length) return { covered: false, reason: "coverage-mismatch", missing, extra };
  return { covered: true, reason: null, missing: [], extra: [] };
}

/**
 * Total, pure state machine for a parallel-authorship round. Convergence is
 * FAIL-CLOSED and requires ALL of:
 *   - both source roles present, each with a real provenance key, and the two distinct;
 *   - an integration node with a real provenance key of its own (the integrator is a
 *     genuine seat call, not a free rewrite);
 *   - descent bound EXACTLY to the two real source refs (not merely a superset — no
 *     missing parent, no smuggled extra), which the integration artifact commits to;
 *   - a field-complete obligation matrix that EXACTLY covers the constraints-declared
 *     obligation set (bijection: every obligation mapped once, none dropped/invented);
 *   - all five seat-call provenance keys (2 authors, integrator, 2 verifiers) real and
 *     pairwise distinct — no response id replayed across calls;
 *   - both verifications AFFIRMATIVELY "preserved" (an unrecognized or missing verdict
 *     cannot converge; it is not treated as tacit approval).
 * Any verifier reporting "violated" or a non-empty conflict list is a conflict routed
 * to The Eye (terminal needs-eye) — never blended. Every other shortfall is "continue"
 * (non-terminal), which the orchestrator normalizes to a human-review stalemate.
 * @returns { state, reason, terminal, candidate_ref, conflicts }
 *   state: converged-parallel | conflict | continue
 *   terminal: submit | needs-eye | (undefined while continue)
 */
export function deriveParallelState({ sources, integration, verifications } = {}) {
  const bad = (reason, extra = {}) => ({ state: "continue", reason, terminal: undefined, candidate_ref: null, conflicts: [], ...extra });
  const cont = (reason, candidate_ref, extra = {}) => ({ state: "continue", reason, terminal: undefined, candidate_ref, conflicts: [], ...extra });
  const byRole = new Map((Array.isArray(sources) ? sources : []).map((s) => [s && s.role, s]));
  const cons = byRole.get("constraints");
  const impl = byRole.get("implementation");
  if (!cons || !impl) return bad("missing-source-node");
  const consKey = cons.provenance_key, implKey = impl.provenance_key;
  if (!isRealProvenanceKey(consKey) || !isRealProvenanceKey(implKey) || consKey === implKey) return bad("invalid-source-provenance");
  if (!integration || !integration.candidate_ref) return bad("no-integration-node");
  // The integrator provenance was previously stored but never validated — a null/placeholder
  // integrator could carry a candidate to convergence. It must be a real seat call.
  if (!isRealProvenanceKey(integration.provenance_key)) return bad("invalid-integration-provenance");
  // Parentage is bound EXACTLY to the two real source nodes. Previously the check accepted any
  // superset AND the candidate ref committed to nothing, making it vacuous; now the integration
  // artifact commits to descends_from and we require it to be precisely {constraints, implementation}.
  const declaredParents = Array.isArray(integration.descends_from) ? integration.descends_from : [];
  const parentSet = new Set(declaredParents);
  if (declaredParents.length !== 2 || parentSet.size !== 2 || !parentSet.has(cons.artifact_ref) || !parentSet.has(impl.artifact_ref)) return cont("integration-not-descended-from-both", integration.candidate_ref);
  const matrix = validateObligationMatrix(integration.obligation_matrix);
  if (!matrix.complete) return cont("incomplete-obligation-matrix", integration.candidate_ref, { incompleteRows: matrix.incompleteRows });
  // Exact coverage of the constraints-declared obligation set — field-completeness alone let a matrix
  // silently drop or fabricate obligations.
  const coverage = validateObligationCoverage(integration.obligation_matrix, cons.obligations);
  if (!coverage.covered) return cont(`obligation-${coverage.reason}`, integration.candidate_ref, { coverage });

  const vByRole = new Map((Array.isArray(verifications) ? verifications : []).map((v) => [v && v.role, v]));
  const vc = vByRole.get("constraints"), vi = vByRole.get("implementation");
  if (!vc || !vi) return bad("missing-verification");
  if (!isRealProvenanceKey(vc.provenance_key) || !isRealProvenanceKey(vi.provenance_key) || vc.provenance_key === vi.provenance_key) {
    return cont("invalid-verification-provenance", integration.candidate_ref);
  }
  // Every one of the FIVE seat calls must carry a real, pairwise-distinct provenance key — a single
  // response id replayed across author/integrate/verify would otherwise satisfy the per-pair checks.
  const callKeys = [consKey, implKey, integration.provenance_key, vc.provenance_key, vi.provenance_key];
  if (new Set(callKeys).size !== callKeys.length) return cont("provenance-reused-across-calls", integration.candidate_ref);
  // A verifier must AFFIRMATIVELY attest "preserved". Previously anything other than the literal string
  // "violated" (including undefined, missing, or an arbitrary token) fell through to convergence.
  const VERDICTS = new Set(["preserved", "violated"]);
  if (!VERDICTS.has(vc.verdict) || !VERDICTS.has(vi.verdict)) return cont("invalid-verification-verdict", integration.candidate_ref);
  const conflicts = [
    ...(vc.verdict !== "preserved" || (vc.conflicts || []).length ? [{ role: "constraints", detail: vc.conflicts || [] }] : []),
    ...(vi.verdict !== "preserved" || (vi.conflicts || []).length ? [{ role: "implementation", detail: vi.conflicts || [] }] : [])
  ];
  if (conflicts.length) return { state: "conflict", reason: "verification-conflict", terminal: "needs-eye", candidate_ref: integration.candidate_ref, conflicts };
  return { state: "converged-parallel", reason: "both-contracts-preserved", terminal: "submit", candidate_ref: integration.candidate_ref, conflicts: [] };
}

/**
 * Run one parallel-authorship round. Seat calls + artifact writes + event
 * appends are INJECTED (keyless-testable), mirroring runDaedalusWorkshop.
 * @param frame        the frozen design frame (spec + amendments) both seats author from
 * @param callSeat     async ({ seat, role, phase, frame, sources? }) -> { plan?, obligation_matrix?, verdict?, conflicts?, provenance }
 * @param writeArtifact (value) -> { ref }
 * @param appendEvent  async (event) -> any
 * @returns { state, reason, terminal, candidate_ref, sources, integration, verifications, conflicts }
 */
export async function runParallelDaedalus({ frame, callSeat, writeArtifact, appendEvent } = {}) {
  // 1. Parallel authorship: two source nodes from the same frozen frame.
  const authored = await Promise.all(["constraints", "implementation"].map(async (role) => {
    const seat = PARALLEL_ROLES[role];
    const resp = await callSeat({ seat, role, phase: "author", frame });
    // The constraints seat OWNS the proof-obligation set; commit those IDs INTO the source-node content
    // address so the obligation set the integrator must cover is content-bound, not caller-mutable.
    const obligations = role === "constraints" ? (Array.isArray(resp.obligations) ? resp.obligations : []) : undefined;
    const artifact_ref = writeArtifact({ kind: "source-node", role, seat, body: resp.plan ?? "", ...(obligations ? { obligations } : {}), provenance: resp.provenance }).ref;
    return { role, seat, artifact_ref, body: resp.plan ?? "", obligations, provenance: resp.provenance, provenance_key: provKey(seat, resp.provenance) };
  }));
  const sources = authored.map(({ body, ...s }) => s);
  if (appendEvent) await appendEvent({ stage: "parallel-authorship", artifact_refs: sources.map((s) => s.artifact_ref), policy_result: { roles: sources.map((s) => s.role) } });

  // 2. Integration: one candidate descending from both source nodes + the obligation matrix. descends_from
  // is written INTO the artifact body so the candidate ref content-commits to its parentage (previously it
  // was attached only in memory, leaving the ref parent-agnostic and the descent check vacuous).
  const integ = await callSeat({ seat: PARALLEL_ROLES.implementation, role: "integration", phase: "integrate", frame, sources: authored });
  const parentRefs = authored.map((s) => s.artifact_ref);
  const candidate_ref = writeArtifact({ kind: "integration-candidate", plan: integ.plan ?? "", descends_from: parentRefs, obligation_matrix: integ.obligation_matrix ?? [], provenance: integ.provenance }).ref;
  const integration = {
    candidate_ref,
    descends_from: parentRefs,
    obligation_matrix: integ.obligation_matrix ?? [],
    seat: PARALLEL_ROLES.implementation,
    provenance: integ.provenance,
    provenance_key: provKey(PARALLEL_ROLES.implementation, integ.provenance)
  };
  if (appendEvent) await appendEvent({ stage: "integration", artifact_refs: [candidate_ref], policy_result: { descends_from: integration.descends_from } });

  // 3. Parallel verification: each seat confirms its own contract survived integration.
  const verifications = await Promise.all(["constraints", "implementation"].map(async (role) => {
    const seat = PARALLEL_ROLES[role];
    const v = await callSeat({ seat, role, phase: "verify", frame, sources: [authored.find((s) => s.role === role)], integration: { candidate_ref, plan: integ.plan ?? "", obligation_matrix: integration.obligation_matrix } });
    return { role, seat, verdict: v.verdict, conflicts: v.conflicts || [], provenance: v.provenance, provenance_key: provKey(seat, v.provenance) };
  }));

  const state = deriveParallelState({ sources, integration, verifications });
  if (appendEvent) await appendEvent({ stage: "parallel-verification", artifact_refs: [candidate_ref], policy_result: { state: state.state, terminal: state.terminal, conflicts: state.conflicts.length } });
  return { ...state, sources, integration, verifications };
}
