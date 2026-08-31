#!/usr/bin/env node
// test-merge-controller.mjs — adversarial regressions for the E1 merge-controller
// PURE DECISION CORE (`evaluateEligibility`). Plain node:assert/strict, fresh process.
//
// Each case builds a fully-eligible ground truth, then mutates exactly ONE surface to
// the attack shape the spec names, and asserts the controller refuses with the exact
// reason. A single happy-path case proves the eligible baseline is reachable (so the
// refusals are discriminating, not vacuous).

import assert from "node:assert/strict";
import { evaluateEligibility, globMatch, REFUSAL } from "../merge-controller.mjs";

const BASE_SHA = "b".repeat(40);
const HEAD_SHA = "h".repeat(40);

// A fully-eligible POST-B ground truth. Cases clone + mutate one field.
function eligiblePostB() {
  return {
    controller: {
      runningClosureDigest: "sha256:ctrl",
      trustedControllerDigest: "sha256:ctrl",
      proposedClosureDigest: "sha256:ctrl",
      controllerClosureFiles: ["workflows/tools/merge-controller.mjs"],
    },
    verifier: { closureDigest: "sha256:vf", trustedVerifierDigest: "sha256:vf", modifiedInChange: false },
    pr: {
      number: 7, state: "open", baseRepo: "dsmcewan/TELOS", baseRef: "main",
      headSha: HEAD_SHA, dossierHeadSha: HEAD_SHA, mergeableState: "clean",
      diffPaths: ["docs/x.md"],
    },
    base: { repo: "dsmcewan/TELOS", ref: "main", sha: BASE_SHA },
    requiredContexts: ["ci"],
    syntheticMergeCommit: { sha: "m".repeat(40), parents: [BASE_SHA, HEAD_SHA] },
    mergeCommitHasContext: { ci: true },
    checkRuns: {
      ci: { runId: 1, headSha: HEAD_SHA, onMergeCommit: true, conclusion: "success",
            producerApp: "github-actions", workflowPath: ".github/workflows/ci.yml",
            jobName: "test", workflowDigest: "sha256:wf" },
    },
    producerMap: { ci: { workflowPath: ".github/workflows/ci.yml", jobName: "test", workflowDigest: "sha256:wf" } },
    workflowChange: null,
    controllerTransition: null,
    authenticatedGithubApp: "github-actions",
    phase: "post-B",
    acceptance: {
      sigValid: true,
      payload: { repo: "dsmcewan/TELOS", pr_number: 7, head_sha: HEAD_SHA, base_sha: BASE_SHA, base_ref: "main", active_plan_ref: "sha256:plan" },
    },
  };
}

// A fully-eligible PHASE A->B window ground truth.
function eligibleWindow() {
  const gt = eligiblePostB();
  gt.phase = "A->B-window";
  gt.window = {
    activePlanRef: "sha256:v15", deferredAuthId: "authz-product-1-amendment-1",
    deferredPlanRef: "sha256:463bde1c", whitelistDigest: "sha256:wl",
    publishedWhitelistDigest: "sha256:wl", descriptorAddress: "sha256:desc",
    descriptorMember: true,
    descriptor: { allowed_path_globs: ["workflows/**", "docs/**"], forbidden_surfaces: ["CURRENT-AUTHORITY.json"] },
    transitionSeq: { provisioned: true, live: 0, recordSeq: null },
  };
  gt.pr.diffPaths = ["workflows/tools/merge-controller.mjs", "docs/x.md"];
  gt.controllerTransition = { signed: true, sigValid: true, boundNewClosureDigest: "sha256:ctrl" };
  gt.window.transitionSeq.recordSeq = 1; // controller-closure change consumes seq 1
  gt.acceptance.payload = {
    repo: "dsmcewan/TELOS", pr_number: 7, head_sha: HEAD_SHA, base_sha: BASE_SHA, base_ref: "main",
    active_plan_ref: "sha256:v15", deferred_authorization_id: "authz-product-1-amendment-1",
    deferred_plan_ref: "sha256:463bde1c", whitelist_digest: "sha256:wl", descriptor_address: "sha256:desc",
  };
  return gt;
}

let passed = 0;
const expect = (gt, wantOk, wantReason, label) => {
  const v = evaluateEligibility(gt);
  assert.equal(v.ok, wantOk, `${label}: ok expected ${wantOk} got ${v.ok} (${v.reason || ""} ${v.detail || ""})`);
  if (!wantOk) assert.equal(v.reason, wantReason, `${label}: reason expected ${wantReason} got ${v.reason}`);
  passed++;
};

// ---- happy paths (eligible baselines) ----
expect(eligiblePostB(), true, null, "post-B eligible baseline");
expect(eligibleWindow(), true, null, "window eligible baseline");

// ---- (1) controller self-closure ----
{ const gt = eligiblePostB(); gt.controller.runningClosureDigest = "sha256:evil";
  expect(gt, false, REFUSAL.CONTROLLER_UNTRUSTED, "running != trusted controller digest"); }
{ const gt = eligiblePostB(); gt.controller.trustedControllerDigest = "";
  expect(gt, false, REFUSAL.TRANSITION_SEQ_UNSET, "TRUSTED_CONTROLLER_DIGEST unset"); }
{ const gt = eligiblePostB(); gt.pr.diffPaths = ["workflows/tools/merge-controller.mjs"];
  gt.controllerTransition = null; // controller change without a transition
  expect(gt, false, REFUSAL.CONTROLLER_MODIFIED, "controller-closure change, no transition"); }
{ const gt = eligiblePostB(); gt.pr.diffPaths = ["workflows/tools/merge-controller.mjs"];
  gt.controller.proposedClosureDigest = "sha256:proposed-new";
  gt.controllerTransition = { signed: true, sigValid: true, boundNewClosureDigest: "sha256:WRONG" };
  expect(gt, false, REFUSAL.TRANSITION_PAYLOAD_MISMATCH, "controller transition bound-digest mismatch"); }

// ---- (2) verifier closure ----
{ const gt = eligiblePostB(); gt.verifier.closureDigest = "sha256:swapped";
  expect(gt, false, REFUSAL.VERIFIER_UNTRUSTED, "verifier closure swapped, undeclared"); }
{ const gt = eligiblePostB(); gt.verifier.modifiedInChange = true; gt.verifier.closureDigest = "sha256:swapped"; gt.workflowChange = null;
  expect(gt, false, REFUSAL.VERIFIER_MODIFIED, "verifier changed without a transition"); }

// ---- (3) ground-truth re-query ----
{ const gt = eligiblePostB(); gt.pr.state = "closed"; expect(gt, false, REFUSAL.PR_NOT_OPEN, "PR not open"); }
{ const gt = eligiblePostB(); gt.pr.baseRef = "release"; expect(gt, false, REFUSAL.BASE_MISMATCH, "base ref mismatch"); }
{ const gt = eligiblePostB(); gt.pr.headSha = "x".repeat(40); expect(gt, false, REFUSAL.HEAD_MISMATCH, "head moved from dossier"); }
{ const gt = eligiblePostB(); gt.pr.mergeableState = "behind"; expect(gt, false, REFUSAL.NOT_MERGEABLE, "mergeable behind"); }

// ---- (4) synthetic merge commit + producer authentication ----
{ const gt = eligiblePostB(); gt.syntheticMergeCommit.parents = ["old".padEnd(40, "0"), HEAD_SHA];
  expect(gt, false, REFUSAL.STALE_MERGE_EVIDENCE, "merge commit parent != current base"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.onMergeCommit = false; // head-SHA run offered while a merge-commit run exists
  expect(gt, false, REFUSAL.STALE_MERGE_EVIDENCE, "head-SHA run masks merge-commit run"); }
{ const gt = eligiblePostB(); delete gt.checkRuns.ci; expect(gt, false, REFUSAL.CHECK_MISSING, "required check missing"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.conclusion = "failure"; expect(gt, false, REFUSAL.CHECK_NOT_GREEN, "required check red"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.producerApp = "untrusted-app"; // untrusted app posts green same-name
  expect(gt, false, REFUSAL.PRODUCER_UNTRUSTED, "green same-name from untrusted producer ignored"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.workflowPath = ".github/workflows/other.yml"; // trusted app, different workflow
  expect(gt, false, REFUSAL.PRODUCER_MISMATCH, "different workflow emits mapped context"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.workflowDigest = "sha256:changed"; gt.workflowChange = null;
  expect(gt, false, REFUSAL.WORKFLOW_MODIFIED, "workflow digest changed, no transition"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.workflowDigest = "sha256:newblob";
  gt.workflowChange = { signed: true, sigValid: true, boundNewDigests: { ".github/workflows/ci.yml": "sha256:DIFFERENT" } };
  expect(gt, false, REFUSAL.TRANSITION_PAYLOAD_MISMATCH, "workflow blob != transition-bound digest"); }
{ const gt = eligiblePostB(); gt.checkRuns.ci.workflowDigest = "sha256:newblob";
  gt.workflowChange = { signed: true, sigValid: true, boundNewDigests: { ".github/workflows/ci.yml": "sha256:newblob" } };
  expect(gt, true, null, "Phase-B-style workflow change with a valid bound transition => eligible"); }

// ---- (5) Eye acceptance ----
{ const gt = eligiblePostB(); gt.acceptance = null; expect(gt, false, REFUSAL.ACCEPTANCE_MISSING, "no Eye acceptance"); }
{ const gt = eligiblePostB(); gt.acceptance.sigValid = false; expect(gt, false, REFUSAL.ACCEPTANCE_INVALID, "invalid Eye signature"); }
{ const gt = eligiblePostB(); gt.acceptance.payload.head_sha = "z".repeat(40);
  expect(gt, false, REFUSAL.ACCEPTANCE_BINDING_MISMATCH, "acceptance binds a different head"); }

// ---- window-specific: whitelist + descriptor diff predicate + transition-seq ----
{ const gt = eligibleWindow(); gt.window.descriptorMember = false; expect(gt, false, REFUSAL.SLICE_NOT_WHITELISTED, "descriptor not a whitelist member"); }
{ const gt = eligibleWindow(); gt.window.whitelistDigest = "sha256:other";
  gt.acceptance.payload.whitelist_digest = "sha256:other"; // acceptance still binds, but published digest differs
  expect(gt, false, REFUSAL.WHITELIST_DIGEST_MISMATCH, "whitelist digest != published"); }
{ const gt = eligibleWindow(); gt.pr.diffPaths = ["workflows/tools/merge-controller.mjs", "CURRENT-AUTHORITY.json"];
  expect(gt, false, REFUSAL.SLICE_SURFACE_VIOLATION, "diff hits a forbidden surface"); }
{ const gt = eligibleWindow(); gt.pr.diffPaths = ["workflows/tools/merge-controller.mjs", "cli/pylae.mjs"];
  expect(gt, false, REFUSAL.SLICE_SURFACE_VIOLATION, "diff outside allowed globs"); }
{ const gt = eligibleWindow(); gt.window.transitionSeq = { provisioned: false, live: null, recordSeq: null };
  expect(gt, false, REFUSAL.TRANSITION_SEQ_UNSET, "transition seq unprovisioned"); }
{ const gt = eligibleWindow(); gt.window.transitionSeq = { provisioned: true, live: 3, recordSeq: 3 };
  expect(gt, false, REFUSAL.TRANSITION_SEQ_STALE, "record seq <= live"); }
{ const gt = eligibleWindow(); gt.window.transitionSeq = { provisioned: true, live: 0, recordSeq: 5 };
  expect(gt, false, REFUSAL.TRANSITION_SEQ_SKIPPED, "record seq skips live+1"); }

// ---- globMatch unit sanity ----
assert.equal(globMatch("workflows/**", "workflows/tools/merge-controller.mjs"), true, "glob ** deep");
assert.equal(globMatch("docs/*.md", "docs/x.md"), true, "glob * within segment");
assert.equal(globMatch("docs/*.md", "docs/sub/x.md"), false, "glob * does not cross /");
assert.equal(globMatch("CURRENT-AUTHORITY.json", "CURRENT-AUTHORITY.json"), true, "glob literal");
passed += 4;

console.log(`test-merge-controller: all ${passed} assertions passed`);
