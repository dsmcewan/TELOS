// concerns.mjs — typed concerns, holds, and controller-only dispositions (Required Points 6, 8).
// Every enforcement identity is a content address (concern_ref, required_verification_ref,
// node_version_ref). Dispositions are gated by a closed derivation table; a seat never writes one.
import { canonicalize, sha256hex } from "../merkle-dag/vendor.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));

export const JUDGMENT_CLASSES = ["consideration", "hold-request", "evidence-claim"];
export const SEVERITIES = ["low", "medium", "high", "critical"];
export const DISPOSITIONS = ["verified", "dismissed", "waived", "superseded", "verification-required", "expired-unresolved", "unresolved"];

// The closed terminal-disposition set (decision 19): these REMOVE a concern from the active gate.
// verified / expired-unresolved / unresolved stay BLOCKING (a verified blocker keeps blocking; a
// timed-out hold does not silently disappear).
export const TERMINAL_DISPOSITIONS = new Set(["dismissed", "waived", "superseded", "verification-required"]);

// Which derivation may produce each disposition. "unresolved" is never writable (it is the derived
// absence state). A model may RECOMMEND; only the controller WRITES, gated here.
export const DISPOSITION_DERIVATIONS = {
  verified: ["verifier-result"],
  dismissed: ["verifier-result"],
  waived: ["human-adjudication"],
  superseded: ["superseding-plan"],
  "verification-required": ["verification-obligation"],
  "expired-unresolved": ["expiration-policy"]
};

const EMPTY_RV = { requested: false, discharge_node_id: "", check_contract: { kind: "", params: {} }, required_result: "" };

export function requiredVerificationRef(rv) {
  const v = rv || EMPTY_RV;
  return H({ requested: !!v.requested, discharge_node_id: v.discharge_node_id || "", check_contract: v.check_contract || { kind: "", params: {} }, required_result: v.required_result || "" });
}

// Frozen concern identity (decision 16). Severity is EXCLUDED (a model proposal; policy decides).
export function concernRef({ plan_hash, scope, claim, judgment_class, seat, required_verification_ref }) {
  return H({ plan_hash, scope, claim, judgment_class, raised_by: { seat }, required_verification_ref });
}

// Node-lineage version identity (decision 19). Records lineage + effective_hash so a changed
// effective_hash never reads as "target gone".
export function nodeVersionRef(node_lineage_ref, effective_hash) {
  return H({ node_lineage_ref, effective_hash });
}

export function makeConcern({ planHash, scope, claim, severity, judgmentClass, requiredVerification, reasoningArtifactRef = null, raisedBy, normalizedFromLegacy = false, raisedAt = null, nodeLineageRef = null }) {
  if (!JUDGMENT_CLASSES.includes(judgmentClass)) throw new Error(`makeConcern: bad judgment_class '${judgmentClass}'`);
  if (!SEVERITIES.includes(severity)) throw new Error(`makeConcern: bad severity '${severity}'`);
  const rv = requiredVerification || EMPTY_RV;
  const rvRef = requiredVerificationRef(rv);
  const ref = concernRef({ plan_hash: planHash, scope, claim, judgment_class: judgmentClass, seat: raisedBy && raisedBy.seat, required_verification_ref: rvRef });
  return {
    record_type: "concern",
    concern_id: `concern-${(raisedBy && raisedBy.seat) || "seat"}-${ref.slice(7, 17)}`,
    concern_ref: ref,
    plan_hash: planHash,
    scope, claim, severity,
    judgment_class: judgmentClass,
    evidence: null,                       // evidence attachment is the RIP-10 verifier's job, never here
    required_verification: rv,
    required_verification_ref: rvRef,
    node_lineage_ref: nodeLineageRef,
    reasoning_artifact_ref: reasoningArtifactRef,
    raised_by: raisedBy,
    normalized_from_legacy: normalizedFromLegacy,
    raised_at: raisedAt
  };
}

/**
 * Normalize legacy hard_stops strings into typed hold-request concerns BEFORE gate evaluation,
 * preserving attribution. The packet keeps hard_stops:[] (present-but-empty) so shape checks pass.
 * @param opts.writeArtifact optional (value)->{ref} to persist the raw model response as audit evidence
 */
export function normalizeLegacyHardStops(packet, { writeArtifact } = {}) {
  const strings = Array.isArray(packet.hard_stops) ? packet.hard_stops : [];
  let raw_response_ref = null;
  if (writeArtifact && strings.length) raw_response_ref = writeArtifact({ kind: "legacy-hard-stops", model: packet.model, hard_stops: strings }).ref;
  const concerns = strings.map((s) => makeConcern({
    planHash: packet.proposal_ref, scope: "plan", claim: String(s), severity: "high", judgmentClass: "hold-request",
    raisedBy: { seat: packet.model, role: packet.role, provenance: packet.provenance }, normalizedFromLegacy: true, raisedAt: packet.timestamp
  }));
  return {
    packet: { ...packet, hard_stops: [], concerns: [...(packet.concerns || []), ...concerns], legacy_hard_stops_normalized: true, raw_response_ref },
    concerns
  };
}

// TTL from POLICY (+ bounded standing multiplier), never from the model.
export function makeHold({ concern, riskClass, holdPolicy, createdAtMs, standing = null }) {
  const mult = standing && typeof standing.ttl_multiplier === "number" ? standing.ttl_multiplier : 1;
  const ttl = Math.max(holdPolicy.min_ttl_ms, Math.min(holdPolicy.ttl_ms * mult, holdPolicy.max_ttl_ms));
  return {
    record_type: "hold",
    hold_id: `hold-${concern.concern_ref.slice(7, 17)}`,
    concern_ref: concern.concern_ref, plan_hash: concern.plan_hash,
    risk_class: riskClass, ttl_ms: ttl, created_at_ms: createdAtMs, expires_at_ms: createdAtMs + ttl,
    escalation: holdPolicy.escalation,
    requested_by: concern.raised_by,
    policy: { source: "risk-policy", standing_ttl_multiplier: mult }
  };
}

// A disposition record — controller-authored ONLY (no seat parameter). Gated by the derivation table.
export function makeDisposition({ concernRef: cref, planHash, disposition, derivedFrom, decidedAtMs = null }) {
  if (disposition === "unresolved") throw new Error("makeDisposition: 'unresolved' is never writable");
  const allowed = DISPOSITION_DERIVATIONS[disposition];
  if (!allowed) throw new Error(`makeDisposition: unknown disposition '${disposition}'`);
  if (!derivedFrom || !allowed.includes(derivedFrom.kind)) throw new Error(`makeDisposition: '${disposition}' cannot derive from '${derivedFrom && derivedFrom.kind}'`);
  return { record_type: "disposition", concern_ref: cref, plan_hash: planHash, disposition, derived_from: derivedFrom, decided_at_ms: decidedAtMs, actor: { controller: true } };
}

// A seat may never dispose of (or select the derivation input for) a concern it raised or whose
// creation lineage it participated in.
export function assertDispositionAllowed({ concern, recommendedBy, creationLineageKeys = new Set() }) {
  if (recommendedBy && concern.raised_by && recommendedBy.seat === concern.raised_by.seat) throw new Error("self-disposition: recommender raised this concern");
  const key = recommendedBy && recommendedBy.lineage_key;
  if (key && creationLineageKeys.has(key)) throw new Error("self-disposition: recommender is in the concern's creation lineage");
}

// Latest disposition per concern_ref (by decided_at_ms, then array order).
function latestDispositions(dispositions) {
  const m = new Map();
  for (const d of dispositions) {
    const prev = m.get(d.concern_ref);
    if (!prev || (d.decided_at_ms ?? 0) >= (prev.decided_at_ms ?? 0)) m.set(d.concern_ref, d);
  }
  return m;
}

// The active-concern reducer (decision 19), partitioned by proposal_id. A disposition referencing a
// concern from another proposal is rejected. A concern stays active unless it has a CLOSED terminal
// disposition; verified / expired-unresolved / unresolved remain active (blocking).
export function activeConcerns(concerns, dispositions, proposalId) {
  const mine = concerns.filter((c) => proposalId == null || c.proposal_id === proposalId);
  const myRefs = new Set(mine.map((c) => c.concern_ref));
  const validDisps = dispositions.filter((d) => myRefs.has(d.concern_ref) && (proposalId == null || d.proposal_id == null || d.proposal_id === proposalId));
  const latest = latestDispositions(validDisps);
  return mine.filter((c) => {
    const d = latest.get(c.concern_ref);
    return !(d && TERMINAL_DISPOSITIONS.has(d.disposition));
  });
}

export function openConcerns(concerns, dispositions) {
  const latest = latestDispositions(dispositions);
  return concerns.filter((c) => { const d = latest.get(c.concern_ref); return !d || d.disposition === "unresolved"; });
}

// Pure holds sweep: every hold past expiry lacking a terminal disposition yields an
// expired-unresolved disposition (never approval-by-timeout).
export function expireHolds({ holds, dispositions, nowMs }) {
  const latest = latestDispositions(dispositions);
  const out = [];
  for (const h of holds) {
    if (h.expires_at_ms > nowMs) continue;
    const d = latest.get(h.concern_ref);
    if (d && (TERMINAL_DISPOSITIONS.has(d.disposition) || d.disposition === "verified")) continue;
    if (d && d.disposition === "expired-unresolved") continue;
    out.push({ hold: h, disposition: makeDisposition({ concernRef: h.concern_ref, planHash: h.plan_hash, disposition: "expired-unresolved", derivedFrom: { kind: "expiration-policy", ref: h.hold_id }, decidedAtMs: nowMs }) });
  }
  return out;
}

/**
 * The concern gate: turns active concerns + holds + dispositions into blockers/warnings. No path
 * lets a bare claim string become a "verified" blocker; verification is only via a disposition.
 * @returns { blockers, warnings, active_holds, expired_unresolved, considerations }
 */
export function evaluateConcernGate({ concerns, holds, dispositions, proposalId = null, nowMs }) {
  const blockers = [], warnings = [], considerations = [], active_holds = [], expired_unresolved = [];
  const latest = latestDispositions(dispositions);
  const active = activeConcerns(concerns, dispositions, proposalId);
  const holdByConcern = new Map(holds.map((h) => [h.concern_ref, h]));

  for (const c of active) {
    const d = latest.get(c.concern_ref);
    if (d && d.disposition === "verified") { blockers.push(`verified blocker: ${c.claim}`); continue; }
    if (d && d.disposition === "expired-unresolved") { expired_unresolved.push(c.concern_ref); blockers.push(`hold expired-unresolved; risk-policy adjudication required: ${c.claim}`); continue; }
    if (c.judgment_class === "consideration") { considerations.push(c.concern_ref); warnings.push(`consideration: ${c.claim}`); continue; }
    if (c.judgment_class === "hold-request") {
      const h = holdByConcern.get(c.concern_ref);
      if (!h) { blockers.push(`PROTOCOL FAILURE: hold-request concern '${c.concern_id}' has no policy-derived hold`); continue; }
      if (h.expires_at_ms > nowMs) { active_holds.push(h.hold_id); blockers.push(`policy hold active until ${h.expires_at_ms}: ${c.claim}`); continue; }
      expired_unresolved.push(c.concern_ref); blockers.push(`hold expired-unresolved: ${c.claim}`);
      continue;
    }
    // evidence-claim without a verified disposition is not a blocker on its own (the evidence
    // verifier produces the verified/dismissed disposition); surface as a consideration.
    warnings.push(`unverified evidence-claim: ${c.claim}`);
  }
  return { blockers, warnings, active_holds, expired_unresolved, considerations };
}

/**
 * Derive transition dispositions AGAINST THE ACTUAL revised plan (decision 19). Runs only after
 * candidate N+1 is compiled. Supersession requires a verified supersession_proof_ref; renames/edits
 * (same node_lineage_ref) never auto-supersede.
 * @param actualNewPlan the compiled N+1 plan (has .lifecycle.node_lineages + .obligations)
 * @param attachedObligations obligations attached to N+1 (each has .concern_ref, .obligation_ref)
 * @param verifierResults [{ concern_ref, contradicted:boolean, verifier_result_ref }]
 * @param supersessionProofs [{ concern_ref, node_lineage_ref, proof_ref }]
 */
export function deriveRevisionDispositions({ priorActiveConcerns, actualNewPlan, attachedObligations = [], verifierResults = [], supersessionProofs = [], nowMs = null }) {
  const obByConcern = new Map(attachedObligations.map((o) => [o.concern_ref, o]));
  const vByConcern = new Map(verifierResults.map((v) => [v.concern_ref, v]));
  const proofByConcern = new Map(supersessionProofs.map((p) => [p.concern_ref, p]));
  const survivingLineages = new Set((actualNewPlan.lifecycle && actualNewPlan.lifecycle.node_lineages || []).map((e) => e.node_lineage_ref));
  const out = [];
  for (const c of priorActiveConcerns) {
    const ob = obByConcern.get(c.concern_ref);
    if (ob) { out.push(makeDisposition({ concernRef: c.concern_ref, planHash: actualNewPlan.plan_hash, disposition: "verification-required", derivedFrom: { kind: "verification-obligation", ref: ob.obligation_ref }, decidedAtMs: nowMs })); continue; }
    const v = vByConcern.get(c.concern_ref);
    if (v && v.contradicted) { out.push(makeDisposition({ concernRef: c.concern_ref, planHash: actualNewPlan.plan_hash, disposition: "dismissed", derivedFrom: { kind: "verifier-result", ref: v.verifier_result_ref }, decidedAtMs: nowMs })); continue; }
    // superseded ONLY with a verified proof AND the target lineage genuinely absent from N+1
    const proof = proofByConcern.get(c.concern_ref);
    if (proof && c.node_lineage_ref && !survivingLineages.has(c.node_lineage_ref)) {
      out.push(makeDisposition({ concernRef: c.concern_ref, planHash: actualNewPlan.plan_hash, disposition: "superseded", derivedFrom: { kind: "superseding-plan", ref: proof.proof_ref }, decidedAtMs: nowMs }));
      continue;
    }
    // otherwise: no disposition — the concern carries forward active against N+1.
  }
  return out;
}
