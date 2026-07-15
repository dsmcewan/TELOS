// test-concerns.mjs — typed concerns, holds, controller-only dispositions, the active reducer.
import assert from "node:assert/strict";
import {
  JUDGMENT_CLASSES, TERMINAL_DISPOSITIONS, DISPOSITION_DERIVATIONS,
  concernRef, requiredVerificationRef, makeConcern, normalizeLegacyHardStops,
  makeHold, makeDisposition, assertDispositionAllowed, expireHolds, activeConcerns,
  evaluateConcernGate, deriveRevisionDispositions,
  processReviewPackets, sweepExpiredHolds, reconstructProposalState
} from "../concerns.mjs";

const holdPolicy = { ttl_ms: 3600000, escalation: "human-adjudication", min_ttl_ms: 60000, max_ttl_ms: 604800000 };

// Case 1: makeConcern fail-closed enums + frozen concern_ref.
{
  const c = makeConcern({ planHash: "sha256:p", scope: "task:x", claim: "boom", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } });
  assert.ok(c.concern_ref.startsWith("sha256:"));
  assert.equal(c.evidence, null, "evidence forced null");
  assert.throws(() => makeConcern({ planHash: "p", scope: "s", claim: "c", severity: "nope", judgmentClass: "hold-request", raisedBy: { seat: "g" } }), /severity/);
  assert.throws(() => makeConcern({ planHash: "p", scope: "s", claim: "c", severity: "high", judgmentClass: "bogus", raisedBy: { seat: "g" } }), /judgment_class/);
  // Identity red-team (decision 7 / round-7 B-B): concern_ref is INVARIANT to a model-supplied
  // discharge_node_id (the discharge node is controller-minted FROM concern_ref, so a model cannot
  // key the concern identity — or the minted node id — via a node id it names), and changes ONLY
  // with the check_contract / required_result.
  const base = { planHash: "p", scope: "s", claim: "c", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "g" } };
  const rv = { requested: true, check_contract: { kind: "assert-file-contains", params_json: "{\"target\":\"src/a.mjs\",\"needle\":\"AUTH_GUARD\"}" }, required_result: "pass" };
  const rvWithNodeId = { ...rv, discharge_node_id: "attacker-named-node" };
  assert.equal(
    makeConcern({ ...base, requiredVerification: rv }).concern_ref,
    makeConcern({ ...base, requiredVerification: rvWithNodeId }).concern_ref,
    "concern_ref INVARIANT to a model-supplied discharge_node_id");
  const rvDiffKind = { ...rv, check_contract: { kind: "assert-path-absent", params_json: rv.check_contract.params_json } };
  const rvDiffResult = { ...rv, required_result: "fail" };
  assert.notEqual(makeConcern({ ...base, requiredVerification: rv }).concern_ref, makeConcern({ ...base, requiredVerification: rvDiffKind }).concern_ref, "check_contract.kind changes concern_ref");
  assert.notEqual(makeConcern({ ...base, requiredVerification: rv }).concern_ref, makeConcern({ ...base, requiredVerification: rvDiffResult }).concern_ref, "required_result changes concern_ref");
  console.log("Case 1 OK: makeConcern + concern_ref identity (invariant to model node id)");
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

// Case 10: processReviewPackets is the SOLE controller minter — one review event per packet, a
// policy-derived hold per hold-request (matching concern_ref so the gate reports NO PROTOCOL FAILURE),
// no hold for a consideration, model-supplied concern fields ignored (concern_ref recomputed), and an
// unregistered check kind routed to human-review (never silently minted as a verification).
{
  const events = [];
  const rec = {
    recordReview: ({ seat, concerns }) => events.push({ stage: "review", proposal_id: "p", seat, concerns }),
    recordHold: ({ hold }) => events.push({ stage: "hold", proposal_id: "p", hold }),
    recordDisposition: ({ disposition }) => events.push({ stage: "disposition", proposal_id: "p", disposition })
  };
  const results = [{ model: "grok", role: "approver", ok: true, packet: { proposal_ref: "sha256:p", review_input_hash: "sha256:r", review_manifest_ref: "sha256:m", provenance: { provider: "xai", response_id: "r1" },
    concerns: [
      { scope: "plan", claim: "auth", severity: "high", judgment_class: "hold-request", evidence_refs: [], concern_ref: "sha256:FORGED",
        required_verification: { requested: true, check_contract: { kind: "assert-file-contains", params_json: "{\"target\":\"a.mjs\",\"needle\":\"AUTH_GUARD\"}" }, required_result: "pass" } },
      { scope: "plan", claim: "note", severity: "low", judgment_class: "consideration", evidence_refs: [], required_verification: { requested: false, check_contract: { kind: "", params_json: "" }, required_result: "" } },
      { scope: "plan", claim: "bad", severity: "high", judgment_class: "hold-request", evidence_refs: [], required_verification: { requested: true, check_contract: { kind: "NOPE", params_json: "{}" }, required_result: "pass" } }
    ] } }];
  const out = processReviewPackets({ results, planHash: "sha256:p", recorder: rec, riskClassFor: () => "authorization", holdPolicyFor: () => holdPolicy, standingFor: () => null, nowMs: 1000 });
  assert.equal(out.reviewEventCount, 1, "exactly one review event per packet");
  assert.equal(events.filter((e) => e.stage === "review").length, 1);
  assert.equal(out.concerns.length, 3, "all concerns minted");
  assert.equal(out.holds.length, 2, "a hold per hold-request; none for the consideration");
  assert.equal(out.verificationRequests.length, 1, "only the REGISTERED-kind verification is a request");
  assert.deepEqual(out.unregisteredKinds, ["NOPE"], "unregistered kind routed to human-review");
  assert.notEqual(out.concerns[0].concern_ref, "sha256:FORGED", "model-supplied concern_ref is ignored (recomputed)");
  const st = reconstructProposalState(events);
  const cg = evaluateConcernGate({ concerns: st.concerns, holds: st.holds, dispositions: st.dispositions, proposalId: "p", nowMs: 1000 });
  assert.ok(!cg.blockers.some((b) => /PROTOCOL FAILURE/.test(b)), "every hold-request has a hold -> no protocol failure");
  console.log("Case 10 OK: processReviewPackets sole minter (cardinality, holds, untrusted fields, unregistered->human)");
}

// Case 11: sweepExpiredHolds is idempotent — a first sweep past expiry writes an expired-unresolved
// disposition; a re-sweep over the freshly-read events (now carrying that disposition) writes nothing.
{
  const events = [];
  const rec = { recordDisposition: ({ disposition }) => events.push({ stage: "disposition", proposal_id: "p", disposition }) };
  const c = makeConcern({ planHash: "sha256:p", scope: "s", claim: "x", severity: "high", judgmentClass: "hold-request", raisedBy: { seat: "grok" } });
  const hold = makeHold({ concern: c, riskClass: "authorization", holdPolicy, createdAtMs: 0 });
  events.push({ stage: "review", proposal_id: "p", concerns: [c] }, { stage: "hold", proposal_id: "p", hold });
  const first = sweepExpiredHolds({ recorder: rec, events: events.slice(), nowMs: 10 ** 15 });
  assert.equal(first.length, 1, "first sweep past expiry writes one disposition");
  const second = sweepExpiredHolds({ recorder: rec, events: events.slice(), nowMs: 10 ** 15 });
  assert.equal(second.length, 0, "re-sweep is idempotent (nothing appended)");
  console.log("Case 11 OK: sweepExpiredHolds idempotency");
}

// Case 12: fail-closed — a hold-request whose policy resolves to NULL gets NO hold, so the concern
// gate reports a PROTOCOL FAILURE and blocks (never a hold-request silently cleared). Guards the
// `if (holdPolicy)` branch of processReviewPackets that no other test drives.
{
  const events = [];
  const rec = {
    recordReview: ({ seat, concerns }) => events.push({ stage: "review", proposal_id: "p", seat, concerns }),
    recordHold: ({ hold }) => events.push({ stage: "hold", proposal_id: "p", hold }),
    recordDisposition: ({ disposition }) => events.push({ stage: "disposition", proposal_id: "p", disposition })
  };
  const results = [{ model: "grok", role: "approver", ok: true, packet: { proposal_ref: "sha256:p", provenance: { provider: "xai", response_id: "r1" },
    concerns: [{ scope: "plan", claim: "must hold", severity: "high", judgment_class: "hold-request", evidence_refs: [], required_verification: { requested: false, check_contract: { kind: "", params_json: "" }, required_result: "" } }] } }];
  const out = processReviewPackets({ results, planHash: "sha256:p", recorder: rec, riskClassFor: () => "authorization", holdPolicyFor: () => null, standingFor: () => null, nowMs: 1000 });
  assert.equal(out.holds.length, 0, "no hold when policy is null");
  assert.equal(events.filter((e) => e.stage === "hold").length, 0, "no hold recorded");
  const st = reconstructProposalState(events);
  const cg = evaluateConcernGate({ concerns: st.concerns, holds: st.holds, dispositions: st.dispositions, proposalId: "p", nowMs: 1000 });
  assert.ok(cg.blockers.some((b) => /PROTOCOL FAILURE/.test(b)), "hold-request with no hold -> PROTOCOL FAILURE (fail closed)");
  console.log("Case 12 OK: fail-closed — hold-request with no policy blocks (protocol failure)");
}

console.log("test-concerns.mjs OK");
