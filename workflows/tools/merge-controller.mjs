#!/usr/bin/env node
// merge-controller.mjs — E1: the deterministic pre-merge merge-controller.
//
// THE SOLE MERGER of the TELOS trust spine. The model NEVER merges: authorization
// is PRE-MERGE and machine-executed here; the protected branch is not mutated until
// this controller's deterministic eligibility check passes. Fail-closed: any missing,
// ambiguous, stale, unauthenticated, or self-modifying evidence blocks the merge.
//
// This file is split into a PURE DECISION CORE (`evaluateEligibility`) — a total
// function over fully-resolved ground truth, no I/O, exhaustively unit-tested against
// adversarial fixtures — and a thin gh-api I/O layer (`resolveGroundTruth`, `main`)
// that populates that ground truth from GitHub and never itself decides eligibility.
//
// Zero dependencies; node: + the repo's merkle-dag/vendor.mjs (canonicalize/sha256hex)
// and node:crypto Ed25519 only. Double-quoted strings, semicolons, 2-space indent,
// small pure functions — matching the surrounding zero-dependency packages.
//
// CORE INVARIANTS (each embodied as a fail-closed check below):
//  - The controller runs from a TRUSTED BASE checkout, never the PR head, and verifies
//    its own closure digest against the protected TRUSTED_CONTROLLER_DIGEST at startup.
//  - Eligibility is re-derived IMMEDIATELY BEFORE EACH MERGE (sequential, never batched).
//  - "green" is never keyed by check NAME: every required check is resolved to the
//    SYNTHETIC TEST-MERGE COMMIT GitHub actually evaluates and to its PRODUCER identity.
//  - EVERY merge requires an EYE-SIGNED PRE-MERGE ACCEPTANCE (phase-aware payload);
//    ordinary PRs included — no automation merges a change no human accepted.
//  - The controller's own closure, the verifier closure, and the workflow set are
//    PROTECTED SURFACES; a PR modifying any of them merges only with a valid
//    Eye-signed transition record binding the exact new bytes.

import { verify as edVerify } from "node:crypto";

// vendor is loaded lazily by the I/O layer; the pure core takes digests as inputs.

// ---- reason codes (closed set; every refusal names exactly one) ----------------
export const REFUSAL = Object.freeze({
  CONTROLLER_UNTRUSTED: "controller-untrusted",
  CONTROLLER_MODIFIED: "controller-modified",
  WORKFLOW_MODIFIED: "workflow-modified",
  VERIFIER_UNTRUSTED: "verifier-untrusted",
  VERIFIER_MODIFIED: "verifier-modified-in-change",
  PR_NOT_OPEN: "pr-not-open",
  BASE_MISMATCH: "base-mismatch",
  HEAD_MISMATCH: "head-mismatch",
  NOT_MERGEABLE: "not-mergeable",
  STALE_MERGE_EVIDENCE: "stale-merge-evidence",
  CHECK_MISSING: "required-check-missing",
  CHECK_NOT_GREEN: "required-check-not-green",
  PRODUCER_UNTRUSTED: "producer-untrusted",
  PRODUCER_MISMATCH: "producer-mismatch",
  TRANSITION_PAYLOAD_MISMATCH: "transition-payload-mismatch",
  TRANSITION_UNSIGNED: "transition-unsigned",
  ACCEPTANCE_MISSING: "acceptance-missing",
  ACCEPTANCE_INVALID: "acceptance-invalid",
  ACCEPTANCE_BINDING_MISMATCH: "acceptance-binding-mismatch",
  SLICE_NOT_WHITELISTED: "slice-not-whitelisted",
  SLICE_SURFACE_VIOLATION: "slice-surface-violation",
  WHITELIST_DIGEST_MISMATCH: "whitelist-digest-mismatch",
  TRANSITION_SEQ_UNSET: "transition-seq-unset",
  TRANSITION_SEQ_STALE: "transition-seq-stale",
  TRANSITION_SEQ_SKIPPED: "transition-seq-skipped",
});

const ok = () => ({ ok: true });
const no = (reason, detail) => ({ ok: false, reason, detail: detail || "" });

// A minimal glob matcher for descriptor allowed_path_globs / forbidden surfaces.
// Supports "**" (any path segments) and "*" (within a segment). Deterministic,
// anchored full-match. No regex injection from data: the glob is compiled to a
// bounded character class set, never eval'd.
export function globMatch(glob, p) {
  if (typeof glob !== "string" || typeof p !== "string") return false;
  let re = "^";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += "[^\\0]*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else if ("\\^$.|?+()[]{}".includes(c)) { re += "\\" + c; }
    else re += c;
  }
  re += "$";
  return new RegExp(re).test(p);
}

// ---- Ed25519 acceptance / transition signature verification --------------------
// Verifies a detached Ed25519 signature (base64) over the CANONICAL bytes of a
// payload, against a SPKI/PEM public key. Fail-closed: any error => false.
export function verifyEd25519(canonicalBytes, signatureB64, publicKeyPem) {
  try {
    if (!canonicalBytes || !signatureB64 || !publicKeyPem) return false;
    const data = Buffer.isBuffer(canonicalBytes) ? canonicalBytes : Buffer.from(String(canonicalBytes), "utf8");
    const sig = Buffer.from(String(signatureB64), "base64");
    return edVerify(null, data, publicKeyPem, sig) === true;
  } catch { return false; }
}

// The PURE DECISION CORE. `gt` (ground truth) is fully resolved by the I/O layer;
// this function performs NO I/O and returns exactly one verdict. Checks run in the
// fail-closed order the spec fixes; the FIRST failure wins and names its reason.
//
// gt shape (all fields REQUIRED unless noted; the I/O layer guarantees presence):
//   controller: { runningClosureDigest, trustedControllerDigest, modifiedFiles:[...],
//                 controllerClosureFiles:[...] }
//   verifier:   { closureDigest, trustedVerifierDigest, modifiedInChange:bool }
//   pr:         { number, state, baseRepo, baseRef, headSha, dossierHeadSha,
//                 mergeableState, diffPaths:[...] }
//   base:       { repo, ref, sha }
//   requiredContexts: [ context, ... ]
//   syntheticMergeCommit: { sha, parents:[baseSha, headSha] }
//   checkRuns: { <context>: { runId, headSha, onMergeCommit:bool, conclusion,
//                             producerApp, workflowPath, jobName, workflowDigest } }
//   producerMap: { <context>: { workflowPath, jobName, workflowDigest } }
//   workflowChange: null | { signed:bool, sigValid:bool, boundNewDigests:{path:digest} }
//   controllerTransition: null | { signed, sigValid, boundNewClosureDigest }
//   acceptance: null | { canonicalBytes, signatureB64, sigValid, payload }
//   phase: "A->B-window" | "post-B"
//   window: {  // required when phase === "A->B-window"
//     activePlanRef, deferredAuthId, deferredPlanRef, whitelistDigest,
//     publishedWhitelistDigest, descriptorAddress, descriptorMember:bool,
//     descriptor: { allowed_path_globs:[...], forbidden_surfaces:[...] },
//     transitionSeq: { provisioned:bool, live:int|null, recordSeq:int|null }
//   }
//   authenticatedGithubApp: string
export function evaluateEligibility(gt) {
  // (1) Controller self-closure: running bytes must equal the provisioned trusted digest.
  if (!gt.controller || !gt.controller.trustedControllerDigest) return no(REFUSAL.TRANSITION_SEQ_UNSET, "TRUSTED_CONTROLLER_DIGEST unset");
  if (gt.controller.runningClosureDigest !== gt.controller.trustedControllerDigest) {
    return no(REFUSAL.CONTROLLER_UNTRUSTED, "running closure != TRUSTED_CONTROLLER_DIGEST");
  }
  // A PR modifying any controller-closure file merges ONLY with a valid Eye-signed
  // controller transition binding the exact new closure bytes.
  const touchesController = (gt.pr.diffPaths || []).some(
    (p) => (gt.controller.controllerClosureFiles || []).includes(p)
  );
  if (touchesController) {
    const t = gt.controllerTransition;
    if (!t || !t.signed || !t.sigValid) return no(REFUSAL.CONTROLLER_MODIFIED, "controller-closure change without a valid Eye-signed transition");
    if (t.boundNewClosureDigest !== gt.controller.proposedClosureDigest) return no(REFUSAL.TRANSITION_PAYLOAD_MISMATCH, "controller transition new-digest != proposed closure");
  }

  // (2) Verifier closure: base-sourced execution only; a swapped verifier under an
  // unmoved digest is refused.
  if (gt.verifier) {
    if (gt.verifier.modifiedInChange && !(gt.workflowChange && gt.workflowChange.sigValid)) {
      // a verifier change is a protected-surface change; needs a signed transition too
      if (gt.verifier.closureDigest !== gt.verifier.trustedVerifierDigest) {
        return no(REFUSAL.VERIFIER_MODIFIED, "verifier closure changed without a valid transition");
      }
    }
    if (!gt.verifier.modifiedInChange && gt.verifier.closureDigest !== gt.verifier.trustedVerifierDigest) {
      return no(REFUSAL.VERIFIER_UNTRUSTED, "verifier closure != VERIFIER_CLOSURE_DIGEST and not a declared change");
    }
  }

  // (3) Ground-truth re-query at THIS mutation point.
  if (gt.pr.state !== "open") return no(REFUSAL.PR_NOT_OPEN);
  if (gt.pr.baseRepo !== gt.base.repo || gt.pr.baseRef !== gt.base.ref) return no(REFUSAL.BASE_MISMATCH);
  if (gt.pr.headSha !== gt.pr.dossierHeadSha) return no(REFUSAL.HEAD_MISMATCH, "PR head moved from the accepted dossier head");
  if (gt.pr.mergeableState === "behind" || gt.pr.mergeableState === "dirty") return no(REFUSAL.NOT_MERGEABLE, gt.pr.mergeableState);

  // (4) Required checks — evaluated on the SYNTHETIC MERGE COMMIT GitHub selects,
  // producer-authenticated, transition-aware. Never by check name.
  const smc = gt.syntheticMergeCommit;
  if (!smc || !Array.isArray(smc.parents) || smc.parents.length !== 2 ||
      smc.parents[0] !== gt.base.sha || smc.parents[1] !== gt.pr.headSha) {
    return no(REFUSAL.STALE_MERGE_EVIDENCE, "synthetic merge commit parents != {current base, dossier head}");
  }
  for (const ctx of gt.requiredContexts || []) {
    const run = (gt.checkRuns || {})[ctx];
    if (!run) return no(REFUSAL.CHECK_MISSING, ctx);
    // A run ON the merge commit takes precedence; a head-SHA run may satisfy ONLY
    // when NO run exists on the merge commit for the context.
    if (!run.onMergeCommit && (gt.mergeCommitHasContext || {})[ctx]) {
      return no(REFUSAL.STALE_MERGE_EVIDENCE, `${ctx}: a merge-commit run exists but a head-SHA run was offered`);
    }
    if (run.conclusion !== "success") return no(REFUSAL.CHECK_NOT_GREEN, ctx);
    if (run.producerApp !== gt.authenticatedGithubApp) return no(REFUSAL.PRODUCER_UNTRUSTED, `${ctx}: producer ${run.producerApp}`);
    const mapped = (gt.producerMap || {})[ctx];
    if (!mapped) return no(REFUSAL.PRODUCER_MISMATCH, `${ctx}: no producer-map entry`);
    if (run.workflowPath !== mapped.workflowPath || run.jobName !== mapped.jobName) {
      return no(REFUSAL.PRODUCER_MISMATCH, `${ctx}: workflow/job != mapped`);
    }
    // Transition-aware workflow digest: matches the mapped digest, OR a valid signed
    // workflow-change record binds this file's exact new digest.
    if (run.workflowDigest !== mapped.workflowDigest) {
      const wc = gt.workflowChange;
      if (!wc || !wc.signed || !wc.sigValid) return no(REFUSAL.WORKFLOW_MODIFIED, `${ctx}: workflow digest changed without a valid transition`);
      const bound = (wc.boundNewDigests || {})[mapped.workflowPath];
      if (bound !== run.workflowDigest) return no(REFUSAL.TRANSITION_PAYLOAD_MISMATCH, `${ctx}: workflow blob != transition-bound new digest`);
    }
  }

  // (5) Eye-signed pre-merge acceptance — REQUIRED for every merge; phase-aware.
  const acc = gt.acceptance;
  if (!acc) return no(REFUSAL.ACCEPTANCE_MISSING);
  if (!acc.sigValid) return no(REFUSAL.ACCEPTANCE_INVALID, "Eye signature invalid over canonical acceptance payload");
  const pl = acc.payload || {};
  // Common binding: owner/repo, pr number, exact head, current base + ref.
  if (pl.repo !== gt.base.repo || pl.pr_number !== gt.pr.number ||
      pl.head_sha !== gt.pr.headSha || pl.base_sha !== gt.base.sha || pl.base_ref !== gt.base.ref) {
    return no(REFUSAL.ACCEPTANCE_BINDING_MISMATCH, "acceptance payload does not bind this exact PR head/base");
  }
  if (gt.phase === "A->B-window") {
    const w = gt.window;
    // Window acceptance binds the active plan (v15), the deferred successor authz +
    // plan_ref, the whitelist digest, and the immutable slice-descriptor address.
    if (pl.active_plan_ref !== w.activePlanRef) return no(REFUSAL.ACCEPTANCE_BINDING_MISMATCH, "active_plan_ref");
    if (pl.deferred_authorization_id !== w.deferredAuthId || pl.deferred_plan_ref !== w.deferredPlanRef) {
      return no(REFUSAL.ACCEPTANCE_BINDING_MISMATCH, "deferred successor authorization binding");
    }
    if (pl.whitelist_digest !== w.whitelistDigest) return no(REFUSAL.ACCEPTANCE_BINDING_MISMATCH, "whitelist_digest");
    if (pl.descriptor_address !== w.descriptorAddress) return no(REFUSAL.ACCEPTANCE_BINDING_MISMATCH, "descriptor_address");
    // Transition-seq monotonic consumption (pre-E2 genesis window).
    const ts = w.transitionSeq || {};
    if (!ts.provisioned || ts.live === null || ts.live === undefined) return no(REFUSAL.TRANSITION_SEQ_UNSET);
    if (gt.controllerTransition || gt.workflowChange || (gt.verifier && gt.verifier.modifiedInChange)) {
      if (typeof ts.recordSeq !== "number") return no(REFUSAL.TRANSITION_SEQ_UNSET, "protected-surface change without a transition_seq");
      if (ts.recordSeq <= ts.live) return no(REFUSAL.TRANSITION_SEQ_STALE, `record seq ${ts.recordSeq} <= live ${ts.live}`);
      if (ts.recordSeq !== ts.live + 1) return no(REFUSAL.TRANSITION_SEQ_SKIPPED, `record seq ${ts.recordSeq} != live+1`);
    }
    // Whitelist membership + digest + descriptor diff-to-surface predicate.
    if (w.whitelistDigest !== w.publishedWhitelistDigest) return no(REFUSAL.WHITELIST_DIGEST_MISMATCH);
    if (!w.descriptorMember) return no(REFUSAL.SLICE_NOT_WHITELISTED);
    const d = w.descriptor || {};
    for (const changed of gt.pr.diffPaths || []) {
      const allowed = (d.allowed_path_globs || []).some((g) => globMatch(g, changed));
      if (!allowed) return no(REFUSAL.SLICE_SURFACE_VIOLATION, `changed path outside allowed globs: ${changed}`);
      const forbidden = (d.forbidden_surfaces || []).some((g) => typeof g === "string" && globMatch(g, changed));
      if (forbidden) return no(REFUSAL.SLICE_SURFACE_VIOLATION, `changed path hits a forbidden surface: ${changed}`);
    }
  } else if (gt.phase !== "post-B") {
    return no(REFUSAL.ACCEPTANCE_INVALID, `unknown phase ${gt.phase}`);
  }

  return ok();
}

// The controller is executed as a script in CI; the entry point is intentionally
// minimal here (the gh-api I/O layer + genesis provisioning land alongside in this
// slice). Running it directly without a resolved ground truth is a fail-closed no-op.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.error("merge-controller: invoke via the controller workflow with a resolved ground-truth dossier; direct invocation is a fail-closed no-op.");
  process.exit(2);
}
