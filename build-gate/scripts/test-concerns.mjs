// test-concerns.mjs — typed concerns, holds, controller-only dispositions, the active reducer.
import assert from "node:assert/strict";
import {
  JUDGMENT_CLASSES, TERMINAL_DISPOSITIONS, DISPOSITION_DERIVATIONS,
  concernRef, requiredVerificationRef, makeConcern, normalizeLegacyHardStops,
  makeHold, makeDisposition, assertDispositionAllowed, expireHolds, activeConcerns,
  evaluateConcernGate, deriveRevisionDispositions
} from "../concerns.mjs";

const holdPolicy = { ttl_ms: 3600000, escalation: "human-adjudication", min_ttl_ms: 60000, max_ttl_ms: 604800000 };

// Case 1: makeConcern fail-closed enums + frozen concern_ref.
{
  const c = makeConcern({ planHash: "sha256:p", scope: "task:x", claim: "boom", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } });
  assert.ok(c.concern_ref.startsWith("sha256:"));
  assert.equal(c.evidence, null, "evidence forced null");
  assert.throws(() => makeConcern({ planHash: "p", scope: "s", claim: "c", severity: "nope", judgmentClass: "hold-request", raisedBy: { seat: "g" } }), /severity/);
  assert.throws(() => makeConcern({ planHash: "p", scope: "s", claim: "c", severity: "high", judgmentClass: "bogus", raisedBy: { seat: "g" } }), /judgment_class/);
  // concern_ref changes with required_verification (retarget-safe)
  const rvA = { requested: true, discharge_node_id: "n", check_contract: { kind: "k", params: {} }, required_result: "pass" };
  const rvB = { requested: true, discharge_node_id: "n2", check_contract: { kind: "k", params: {} }, required_result: "pass" };
  assert.notEqual(makeConcern({ planHash: "p", scope: "s", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "g" }, requiredVerification: rvA }).concern_ref,
    makeConcern({ planHash: "p", scope: "s", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "g" }, requiredVerification: rvB }).concern_ref, "rv changes concern_ref");
  console.log("Case 1 OK: makeConcern + frozen concern_ref");
}

// Case 2: legacy hard_stops normalization preserves attribution; bare string cannot become verified.
{
  const packet = { model: "grok", role: "advisory", proposal_ref: "sha256:p", timestamp: "t", provenance: { provider: "xai", response_id: "r1" }, hard_stops: ["might be insecure"] };
  const { packet: norm, concerns } = normalizeLegacyHardStops(packet);
  assert.deepEqual(norm.hard_stops, [], "hard_stops emptied");
  assert.equal(norm.legacy_hard_stops_normalized, true);
  assert.equal(concerns[0].judgment_class, "hold-request");
  assert.equal(concerns[0].raised_by.seat, "grok", "attribution preserved");
  assert.equal(concerns[0].normalized_from_legacy, true);
  // a bare string can never be written as "verified" — the derivation table forbids it
  assert.throws(() => makeDisposition({ concernRef: concerns[0].concern_ref, planHash: "sha256:p", disposition: "verified", derivedFrom: { kind: "expiration-policy" } }), /cannot derive/);
  console.log("Case 2 OK: hard_stops normalization + no bare-string verified");
}

// Case 3: policy-bound hold; model-supplied TTL is ignored.
{
  const c = makeConcern({ planHash: "sha256:p", scope: "s", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } });
  const h = makeHold({ concern: { ...c, ttl_ms: 999 }, riskClass: "authorization", holdPolicy, createdAtMs: 1000 });
  assert.equal(h.ttl_ms, holdPolicy.ttl_ms, "TTL from policy, not model");
  assert.equal(h.expires_at_ms, 1000 + holdPolicy.ttl_ms);
  // bounded standing multiplier
  const h2 = makeHold({ concern: c, riskClass: "authorization", holdPolicy, createdAtMs: 0, standing: { ttl_multiplier: 2 } });
  assert.equal(h2.ttl_ms, holdPolicy.ttl_ms * 2);
  console.log("Case 3 OK: policy-bound hold, model TTL ignored");
}

// Case 4: makeDisposition derivation-table-gated; "unresolved" never writable; actor is controller.
{
  const d = makeDisposition({ concernRef: "sha256:c", planHash: "sha256:p", disposition: "dismissed", derivedFrom: { kind: "verifier-result", ref: "sha256:v" } });
  assert.deepEqual(d.actor, { controller: true }, "actor is controller only");
  assert.throws(() => makeDisposition({ concernRef: "c", planHash: "p", disposition: "unresolved", derivedFrom: { kind: "x" } }), /never writable/);
  assert.throws(() => makeDisposition({ concernRef: "c", planHash: "p", disposition: "waived", derivedFrom: { kind: "verifier-result" } }), /cannot derive/);
  console.log("Case 4 OK: disposition derivation gating");
}

// Case 5: self-disposition prohibition.
{
  const c = makeConcern({ planHash: "sha256:p", scope: "s", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } });
  assert.throws(() => assertDispositionAllowed({ concern: c, recommendedBy: { seat: "grok" } }), /self-disposition/);
  assert.throws(() => assertDispositionAllowed({ concern: c, recommendedBy: { seat: "codex", lineage_key: "openai:r1" }, creationLineageKeys: new Set(["openai:r1"]) }), /creation lineage/);
  assert.doesNotThrow(() => assertDispositionAllowed({ concern: c, recommendedBy: { seat: "codex", lineage_key: "openai:r9" }, creationLineageKeys: new Set(["openai:r1"]) }));
  console.log("Case 5 OK: self-disposition prohibition");
}

// Case 6: activeConcerns reducer — terminal set removes; verified/expired stay; cross-proposal rejected.
{
  const c1 = { ...makeConcern({ planHash: "sha256:p", scope: "s", claim: "c1", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } }), proposal_id: "P" };
  const c2 = { ...makeConcern({ planHash: "sha256:p", scope: "s", claim: "c2", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "gemini" } }), proposal_id: "P" };
  const disp = [
    { concern_ref: c1.concern_ref, disposition: "dismissed", proposal_id: "P" },      // terminal -> removes c1
    { concern_ref: c2.concern_ref, disposition: "verified", proposal_id: "P" }         // non-terminal -> c2 stays
  ];
  const active = activeConcerns([c1, c2], disp, "P");
  assert.equal(active.length, 1, "dismissed removed, verified stays");
  assert.equal(active[0].concern_ref, c2.concern_ref);
  // cross-proposal disposition ignored
  const crossActive = activeConcerns([c1], [{ concern_ref: c1.concern_ref, disposition: "dismissed", proposal_id: "OTHER" }], "P");
  assert.equal(crossActive.length, 1, "cross-proposal disposition rejected -> concern stays active");
  console.log("Case 6 OK: activeConcerns reducer");
}

// Case 7: hold expiry -> expired-unresolved (still blocking), never approval-by-timeout.
{
  const c = { ...makeConcern({ planHash: "sha256:p", scope: "s", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } }), proposal_id: "P" };
  const h = makeHold({ concern: c, riskClass: "authorization", holdPolicy, createdAtMs: 0 });
  const swept = expireHolds({ holds: [h], dispositions: [], nowMs: h.expires_at_ms + 1 });
  assert.equal(swept.length, 1, "expired hold swept");
  assert.equal(swept[0].disposition.disposition, "expired-unresolved");
  // gate still blocks
  const gate = evaluateConcernGate({ concerns: [c], holds: [h], dispositions: swept.map((s) => s.disposition), proposalId: "P", nowMs: h.expires_at_ms + 1 });
  assert.ok(gate.blockers.length > 0, "expired-unresolved still blocks");
  console.log("Case 7 OK: hold expiry -> expired-unresolved blocking");
}

// Case 8: evaluateConcernGate — verified blocks; consideration warns; hold-request without hold is a protocol failure.
{
  const verified = { ...makeConcern({ planHash: "sha256:p", scope: "s", claim: "vc", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } }), proposal_id: "P" };
  const consid = { ...makeConcern({ planHash: "sha256:p", scope: "s", claim: "cc", severity: "low", judgmentClass: "consideration", raisedBy: { seat: "gemini" } }), proposal_id: "P" };
  const holdless = { ...makeConcern({ planHash: "sha256:p", scope: "s", claim: "hc", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } }), proposal_id: "P" };
  const g = evaluateConcernGate({ concerns: [verified, consid, holdless], holds: [], dispositions: [{ concern_ref: verified.concern_ref, disposition: "verified", proposal_id: "P" }], proposalId: "P", nowMs: 0 });
  assert.ok(g.blockers.some((b) => /verified blocker/.test(b)), "verified blocks");
  assert.ok(g.warnings.some((w) => /consideration/.test(w)), "consideration warns");
  assert.ok(g.blockers.some((b) => /PROTOCOL FAILURE/.test(b)), "hold-request without hold -> protocol failure");
  console.log("Case 8 OK: evaluateConcernGate outcomes");
}

// Case 9: deriveRevisionDispositions — obligation -> verification-required; verifier -> dismissed;
// rename (surviving lineage) -> stays active; genuine disappearance + proof -> superseded.
{
  const c = makeConcern({ planHash: "sha256:pN", scope: "task:auth", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" }, nodeLineageRef: "sha256:lineageA" });
  const newPlan = { plan_hash: "sha256:pN1", lifecycle: { node_lineages: [{ node_id: "auth", node_lineage_ref: "sha256:lineageA" }] } };
  // obligation attached -> verification-required
  const vreq = deriveRevisionDispositions({ priorActiveConcerns: [c], actualNewPlan: newPlan, attachedObligations: [{ concern_ref: c.concern_ref, obligation_ref: "sha256:ob" }] });
  assert.equal(vreq[0].disposition, "verification-required");
  // verifier contradicts -> dismissed
  const dis = deriveRevisionDispositions({ priorActiveConcerns: [c], actualNewPlan: newPlan, verifierResults: [{ concern_ref: c.concern_ref, contradicted: true, verifier_result_ref: "sha256:vr" }] });
  assert.equal(dis[0].disposition, "dismissed");
  // rename: lineage survives -> NOT superseded even with a proof
  const kept = deriveRevisionDispositions({ priorActiveConcerns: [c], actualNewPlan: newPlan, supersessionProofs: [{ concern_ref: c.concern_ref, proof_ref: "sha256:pf" }] });
  assert.equal(kept.length, 0, "surviving lineage -> concern stays active (no auto-supersede)");
  // genuine disappearance + proof -> superseded
  const gonePlan = { plan_hash: "sha256:pN2", lifecycle: { node_lineages: [{ node_id: "other", node_lineage_ref: "sha256:lineageB" }] } };
  const sup = deriveRevisionDispositions({ priorActiveConcerns: [c], actualNewPlan: gonePlan, supersessionProofs: [{ concern_ref: c.concern_ref, proof_ref: "sha256:pf" }] });
  assert.equal(sup[0].disposition, "superseded");
  console.log("Case 9 OK: deriveRevisionDispositions against actual N+1");
}

console.log("test-concerns.mjs OK");
