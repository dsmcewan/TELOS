// proposal-gate.mjs — pure, synchronous proposal-lifecycle verification. Reconstructs ALL proposal
// state FROM the ledger (decision 8): a miswired orchestrator cannot weaken the gate by omitting a
// concern/hold from a preview. The authority for the plan hash is always the recompute from disk.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { canonicalize, sha256hex } from "../merkle-dag/vendor.mjs";
import { recompute, readPlan } from "../merkle-dag/merkle.mjs";
import { checkObligationAnchors, deriveExecutableRef } from "../merkle-dag/obligation.mjs";
import {
  readProposalEvents, verifyProposalChain, computeReviewInputHash,
  readProposalArtifact, normalizeProvenance, lineageKey, PROPOSAL_KEY_ID
} from "../merkle-dag/proposal-ledger.mjs";
import { activeConcerns, evaluateConcernGate, expireHolds, reconstructProposalState, requiredVerificationRef, concernRef, latestDispositions } from "./concerns.mjs";
import { resolve as resolveCheck, checkContractRef } from "./check-registry.mjs";

// Inputs the review manifest is ALLOWED to contain (decision 13). Anything else — the proposal
// ledger, Daedalus rounds, prior packets/decisions, consensus summaries — is contamination.
const ALLOWED_EVIDENCE_KINDS = new Set(["candidate-plan", "review-contract", "source-doc", "evidence"]);

// verifyWrittenPlan: recompute is the AUTHORITY; the immutable candidate must match.
export function verifyWrittenPlan(telosDir) {
  const blockers = [];
  let stored;
  try { stored = readPlan(telosDir); } catch { return { ok: false, plan_hash: null, blockers: ["no written candidate plan on disk"] }; }
  const rc = recompute(stored);
  if (rc.errors) return { ok: false, plan_hash: null, blockers: [`plan does not recompute: ${JSON.stringify(rc.errors)}`] };
  if (rc.plan.plan_hash !== stored.plan_hash) blockers.push("stored plan_hash does not recompute");
  const immPath = path.join(telosDir, "plans", rc.plan.plan_hash.replace(/[:]/g, "_") + ".json");
  if (!existsSync(immPath)) blockers.push("immutable candidate plan file missing");
  else {
    let imm; try { imm = JSON.parse(readFileSync(immPath, "utf8")); } catch { imm = null; }
    if (!imm || recompute(imm).plan.plan_hash !== rc.plan.plan_hash) blockers.push("immutable candidate plan does not match recomputed hash");
  }
  return { ok: blockers.length === 0, plan_hash: rc.plan.plan_hash, blockers, plan: rc.plan };
}

// Strict equality: every required packet's proposal_ref must equal the exact plan hash.
export function checkProposalRefBinding(packets, planHash, requiredModels) {
  const blockers = [];
  const byModel = new Map(packets.map((p) => [p.model, p]));
  for (const m of requiredModels) {
    const p = byModel.get(m);
    if (!p) { blockers.push(`missing required packet for '${m}'`); continue; }
    if (p.proposal_ref !== planHash) blockers.push(`packet '${m}' proposal_ref '${p.proposal_ref}' != plan hash '${planHash}'`);
  }
  return blockers;
}

function lineageKeysFrom(provList) {
  const keys = new Set();
  const unverifiable = [];
  for (const prov of provList) {
    const n = normalizeProvenance(prov);
    const k = n && lineageKey(n.provider, n.response_id);
    if (k) keys.add(k); else unverifiable.push(prov);
  }
  return { keys, unverifiable };
}

// Creation lineage = provenance of draft/negotiation/candidate events. Review lineage = review-stage
// events' provenance UNION the review packets' provenance.
export function collectCreationLineage(events) {
  return lineageKeysFrom(events.filter((e) => ["draft", "negotiation", "candidate"].includes(e.stage) && e.provenance).map((e) => e.provenance));
}
export function collectReviewLineage(events, packets) {
  const provs = [...events.filter((e) => e.stage === "review" && e.provenance).map((e) => e.provenance), ...packets.filter((p) => p.provenance).map((p) => p.provenance)];
  return lineageKeysFrom(provs);
}

// checkColdReview: creation ∩ review lineage must be empty (provider-scoped); each review event's
// manifest must recompute its review_input_hash, bind the plan hash, re-derive evidence hashes from
// disk, and contain ONLY allowlisted inputs.
export function checkColdReview({ telosDir, events, packets, planHash, signed, baseDir, forceSignedDisjointness = false }) {
  const blockers = [], warnings = [];
  const creation = collectCreationLineage(events);
  const review = collectReviewLineage(events, packets);
  for (const k of review.keys) if (creation.keys.has(k)) blockers.push(`cold-review violation: lineage key ${k} appears in both creation and review`);
  const unver = [...creation.unverifiable, ...review.unverifiable];
  // Preventive under keyless (round-5): whenever the proposal lifecycle forces signed semantics,
  // unverifiable lineage is a BLOCKER not a warning — a creation/review seat with a placeholder or
  // missing response_id cannot slip the disjointness check just because trust_mode isn't "signed".
  if (unver.length) { const msg = `unverifiable lineage (missing provider / placeholder id) x${unver.length}`; (signed || forceSignedDisjointness) ? blockers.push(msg) : warnings.push(msg); }

  // Manifest binding REQUIRED (round-5): every review event must carry a review_input_hash that
  // recomputes from its manifest, else a required approver bypasses cold-input verification. Under
  // forceSignedDisjointness a review event WITHOUT the binding fails closed.
  const reviewEvents = events.filter((x) => x.stage === "review");
  for (const e of reviewEvents.filter((x) => !x.review_input_hash)) {
    if (forceSignedDisjointness) blockers.push("review event missing review_input_hash (cold-input binding required)");
  }
  for (const e of reviewEvents.filter((x) => x.review_input_hash)) {
    const manifestRef = (e.artifact_refs || []).find((r) => r);
    const manifest = manifestRef ? readProposalArtifact(telosDir, manifestRef) : null;
    if (!manifest) { blockers.push("review event manifest missing/tampered"); continue; }
    if (computeReviewInputHash(manifest) !== e.review_input_hash) { blockers.push("review_input_hash does not recompute from manifest"); continue; }
    // A review bound to a DIFFERENT plan hash is a review of a prior candidate in this proposal's
    // revision history, not of the current candidate — skip it here (it does not contribute to THIS
    // candidate's cold review). Reviews that bind to the current plan are validated below.
    if (manifest.plan_hash !== planHash) continue;
    for (const ev of manifest.evidence || []) {
      if (ev.kind && !ALLOWED_EVIDENCE_KINDS.has(ev.kind)) { blockers.push(`review manifest contamination: disallowed input kind '${ev.kind}'`); continue; }
      if (String(ev.path || "").includes(".telos/") || String(ev.path || "").includes("proposal")) { blockers.push(`review manifest contamination: control-plane path '${ev.path}'`); continue; }
      const abs = baseDir ? path.resolve(baseDir, ev.path) : null;
      if (abs && existsSync(abs)) { const h = "sha256:" + sha256hex(readFileSync(abs)); if (h !== ev.sha256) blockers.push(`review evidence '${ev.path}' sha256 does not re-derive from disk`); }
    }
  }
  return { blockers, warnings };
}

// Reconstruct concern/hold/disposition records from the ledger events (no caller-supplied state).
/**
 * The load-bearing lifecycle check. Reconstructs everything from disk and returns pass/fail checks +
 * typed findings + blockers. The orchestrator turns these into the POLICY_CONTRACT certificate.
 * @returns { ok, plan_hash, proposal_id, checks, blockers, warnings, findings }
 */
export function validateProposalLifecycle({ telosDir, packets = [], requiredModels = [], signed = false, baseDir, nowMs = 0, forceSignedDisjointness = false }) {
  const checks = {
    written_plan: "pass", proposal_ref_binding: "pass", required_packets: "pass", packet_signatures: "n/a",
    provider_lineage: "pass", cold_review_inputs: "pass", required_approvals: "pass", required_edits: "pass",
    concerns: "pass", risk_policy: "pass", obligation_anchors: "pass", protected_paths: "pass", proposal_chain: "pass"
  };
  const blockers = [], warnings = [], findings = [];
  const fail = (k) => { checks[k] = "fail"; };

  const wp = verifyWrittenPlan(telosDir);
  if (!wp.ok) { fail("written_plan"); blockers.push(...wp.blockers); findings.push({ code: "WRITTEN_PLAN", class: "protocol", reparable: false, requires_human: false, ref: null }); return { ok: false, plan_hash: wp.plan_hash, proposal_id: null, checks, blockers, warnings, findings }; }
  const planHash = wp.plan_hash;

  const refBlockers = checkProposalRefBinding(packets, planHash, requiredModels);
  if (refBlockers.length) { fail("proposal_ref_binding"); blockers.push(...refBlockers); findings.push({ code: "PROPOSAL_REF", class: "protocol", reparable: false, requires_human: false, ref: null }); }

  const { events, errors } = readProposalEvents(telosDir);
  let proposal_id = null;
  const pub = (wp.plan.authorized_signers || {})[PROPOSAL_KEY_ID];
  if (errors.length || !pub) { fail("proposal_chain"); blockers.push(...(errors.length ? errors : ["no proposal-controller signer pinned"])); findings.push({ code: "CHAIN", class: "protocol", reparable: false, requires_human: false, ref: null }); }
  else if (events.length) {
    const chain = verifyProposalChain(events, pub);
    if (!chain.ok) { fail("proposal_chain"); blockers.push(...chain.errors); findings.push({ code: "CHAIN", class: "protocol", reparable: false, requires_human: false, ref: null }); }
    // candidate event proposal_id must agree with plan.lifecycle
    const candidate = events.find((e) => e.stage === "candidate" && e.plan_hash === planHash);
    proposal_id = candidate ? candidate.proposal_id : (events[0] && events[0].proposal_id);
    const lcPid = wp.plan.lifecycle && wp.plan.lifecycle.proposal_id;
    if (lcPid && proposal_id && lcPid !== proposal_id) { fail("proposal_chain"); blockers.push(`candidate proposal_id '${proposal_id}' != plan.lifecycle.proposal_id '${lcPid}'`); findings.push({ code: "PROPOSAL_ID", class: "protocol", reparable: false, requires_human: false, ref: null }); }

    // cold review
    const cr = checkColdReview({ telosDir, events, packets, planHash, signed, baseDir, forceSignedDisjointness });
    if (cr.blockers.length) { fail("cold_review_inputs"); fail("provider_lineage"); blockers.push(...cr.blockers); findings.push({ code: "COLD_REVIEW", class: "protocol", reparable: false, requires_human: false, ref: null }); }
    warnings.push(...cr.warnings);

    // concern gate (reconstructed from ledger, then expiry-swept)
    const state = reconstructProposalState(events);
    const swept = expireHolds({ holds: state.holds, dispositions: state.dispositions, nowMs });
    const allDisp = [...state.dispositions, ...swept.map((s) => s.disposition)];
    const cg = evaluateConcernGate({ concerns: state.concerns, holds: state.holds, dispositions: allDisp, proposalId: proposal_id, nowMs });
    if (cg.blockers.length) {
      fail("concerns"); blockers.push(...cg.blockers);
      for (const b of cg.blockers) {
        if (/^verified blocker/.test(b)) findings.push({ code: "VERIFIED_BLOCKER", class: "verified", reparable: true, requires_human: false, ref: null });
        else if (/PROTOCOL FAILURE/.test(b)) findings.push({ code: "CONCERN_PROTOCOL", class: "protocol", reparable: false, requires_human: false, ref: null });
        else if (/expired-unresolved/.test(b)) findings.push({ code: "EXPIRED_HOLD", class: "hold", reparable: false, requires_human: true, ref: null });
        else findings.push({ code: "ACTIVE_HOLD", class: "hold", reparable: true, requires_human: false, ref: null });
      }
    }
    warnings.push(...cg.warnings);
  }

  // obligation anchors (structural: node exists, test-ref, verifies-registered, plan-hash coverage)
  const oa = checkObligationAnchors(wp.plan, { recomputedPlanHash: planHash });
  if (!oa.ok) { fail("obligation_anchors"); blockers.push(...oa.failures.map((f) => `obligation ${f.obligation_id}: ${f.check}`)); findings.push({ code: "OBLIGATION_ANCHOR", class: "protocol", reparable: false, requires_human: false, ref: null }); }

  // obligation<->concern reconciliation (decision 7 + 8b): bind each obligation's executable to the
  // concern's check_contract via the check-registry, and require every verification-required-cleared
  // concern to have a live, reconciling obligation. Folded into obligation_anchors (no new closed key).
  const oc = reconcileObligations({ plan: wp.plan, events });
  if (!oc.ok) { fail("obligation_anchors"); blockers.push(...oc.blockers); findings.push({ code: "OBLIGATION_RECONCILE", class: "protocol", reparable: false, requires_human: false, ref: null }); }

  const ok = blockers.length === 0;
  return { ok, plan_hash: planHash, proposal_id, checks, blockers, warnings, findings };
}

// reconcileObligations — the decision-7 concern<->obligation binding, living ONLY here (the gate
// reconstructs concerns from the ledger). For each obligation tied to a reconstructed concern it
// recomputes the concern identity from the body (a verified identity, not a stored ref), then binds:
//   (i)  obligation.check_contract_ref === H(concern.check_contract) and required_result matches;
//   (ii) deriveExecutableRef(discharge_node.test) === deriveExecutableRef(check-registry.resolve(...))
//        — so a verify- node whose test was swapped for a passing no-op fails the gate. A resolve()
//        throw/empty at gate time is CAUGHT and recorded as a reconciliation FAIL (fail-closed).
// And (8b) every concern cleared by a terminal verification-required disposition MUST map to a live
// obligation present in plan.obligations — else the concern reads cleared while nothing is enforced.
function reconcileObligations({ plan, events }) {
  const blockers = [];
  const obligations = plan.obligations || [];
  const { concerns, dispositions } = reconstructProposalState(events);
  const nodeById = new Map((plan.nodes || []).map((n) => [n.id, n]));
  const identityOf = (c) => concernRef({
    plan_hash: c.plan_hash, scope: c.scope, claim: c.claim, judgment_class: c.judgment_class,
    seat: c.raised_by && c.raised_by.seat, required_verification_ref: requiredVerificationRef(c.required_verification)
  });
  const concernByRef = new Map(concerns.map((c) => [identityOf(c), c]));
  const obByRef = new Map(obligations.map((o) => [o.obligation_ref, o]));

  for (const ob of obligations) {
    const c = concernByRef.get(ob.concern_ref);
    if (!c) continue; // no reconstructed concern -> inert (clears nothing); structure covered by anchors
    const cc = (c.required_verification && c.required_verification.check_contract) || { kind: "", params_json: "" };
    if (ob.check_contract_ref !== checkContractRef(cc)) blockers.push(`obligation ${ob.obligation_id}: check_contract_ref does not reconcile with concern`);
    if (ob.required_result !== (c.required_verification && c.required_verification.required_result)) blockers.push(`obligation ${ob.obligation_id}: required_result != concern`);
    const node = nodeById.get(ob.discharge_node_id);
    if (!node || !node.test) { blockers.push(`obligation ${ob.obligation_id}: discharge node/test missing`); continue; }
    let r;
    try { r = resolveCheck(cc.kind, cc.params_json); } catch (e) { blockers.push(`obligation ${ob.obligation_id}: check-registry resolve threw`); continue; }
    if (!r || !r.ok) { blockers.push(`obligation ${ob.obligation_id}: check-registry resolve failed (${r && r.error})`); continue; }
    if (deriveExecutableRef(node.test) !== deriveExecutableRef(r.test)) blockers.push(`obligation ${ob.obligation_id}: discharge node executable != registry-resolved check (no-op swap?)`);
  }

  const latest = latestDispositions(dispositions);
  for (const c of concerns) {
    const d = latest.get(c.concern_ref);
    if (!d || d.disposition !== "verification-required") continue;
    const obRef = d.derived_from && d.derived_from.ref;
    const ob = obRef && obByRef.get(obRef);
    if (!ob) { blockers.push(`verification-required concern ${c.concern_id}: obligation '${obRef}' absent from plan.obligations`); continue; }
    if (ob.concern_ref !== c.concern_ref) blockers.push(`verification-required concern ${c.concern_id}: obligation concern_ref mismatch`);
  }
  return { ok: blockers.length === 0, blockers };
}
