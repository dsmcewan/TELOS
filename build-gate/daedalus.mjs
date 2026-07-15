// daedalus.mjs — the bounded claude/codex planning workshop. Objection hashes are controller-computed;
// convergence requires every prior objection EXPLICITLY resolved/superseded/withdrawn (absence is not
// a disposition); the state machine is total and candidate-hash-driven.
import { canonicalize, sha256hex } from "../merkle-dag/vendor.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));
const PLACEHOLDER_RE = /^$|_self$|^self$|placeholder/i;

export const DAEDALUS_MAX_ROUNDS = 6;
export const DAEDALUS_SEATS = ["claude", "codex"];
const PROVIDER_BY_SEAT = { claude: "anthropic", codex: "openai" };

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
      const hash = o.objection_hash || computeObjectionHash(o);
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
