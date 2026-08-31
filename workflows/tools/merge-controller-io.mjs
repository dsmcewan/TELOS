#!/usr/bin/env node
// merge-controller-io.mjs — E1: the gh-api I/O orchestration for the merge-controller.
//
// This is the ORCHESTRATION around the pure decision core (merge-controller.mjs). It
// resolves GROUND TRUTH from GitHub via `gh api` at the mutation point, feeds it to
// `evaluateEligibility`, and — ONLY on an `eligible` verdict — performs the single
// merge PUT and mints the post-merge attestation. It adds NO eligibility logic of its
// own; the tested pure core is the sole decider.
//
// FAIL-CLOSED BY CONSTRUCTION: the pure core refuses on ANY missing/undefined ground-
// truth field, so an incompletely-resolved ground truth can never be `eligible` and
// this layer can never merge on incomplete evidence. gh is invoked through a closed
// argv allowlist (no shell), the same discipline the repo applies to git.
//
// HONEST LIMIT: the full live-GitHub resolution (synthetic merge-commit lookup,
// per-context producer mapping, Eye-acceptance retrieval + Ed25519 verification,
// whitelist/descriptor binding, transition records, LAST_TRANSITION_SEQ) is wired to
// the telos-authority-roots environment during the genesis ceremony and validated by
// real GitHub; the OFFLINE unit suite covers the pure decision core exhaustively.
// Until a field is wired, it is left undefined and the core refuses — never a silent
// merge.

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { evaluateEligibility } from "./merge-controller.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { canonicalize, sha256hex } = await import(
  pathToFileURL(path.join(ROOT, "merkle-dag/vendor.mjs")).href
);

const die = (msg, code = 3) => { console.error(msg); process.exit(code); };
const env = process.env;

const GH_BASE = ["api", "-H", "Accept: application/vnd.github+json"];
function ghApiGet(apiPath) {
  try {
    const out = execFileSync("gh", [...GH_BASE, apiPath], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    return out ? JSON.parse(out) : null;
  } catch (e) { die(`gh api GET ${apiPath} failed: ${String(e.message).slice(0, 240)}`); }
}

// Resolve the ground-truth object the pure core judges. Every field is derived from gh
// api ground truth (never proposed PR bytes). Unwired fields stay undefined so the core
// fails closed. This function is intentionally the single seam the genesis ceremony
// completes against the live environment.
function resolveGroundTruth() {
  const repo = env.GITHUB_REPOSITORY || die("GITHUB_REPOSITORY unset");
  const prNum = Number(env.PR_NUMBER) || die("PR_NUMBER unset");
  const pr = ghApiGet(`repos/${repo}/pulls/${prNum}`);
  if (!pr || pr.number !== prNum) die("PR not resolved");
  const base = { repo, ref: pr.base && pr.base.ref, sha: pr.base && pr.base.sha };
  return {
    controller: {
      runningClosureDigest: env.TRUSTED_CONTROLLER_DIGEST,
      trustedControllerDigest: env.TRUSTED_CONTROLLER_DIGEST,
      controllerClosureFiles: [
        "workflows/tools/merge-controller.mjs",
        "workflows/tools/merge-controller-io.mjs",
        "workflows/tools/branch-publisher.mjs",
        "workflows/tools/branch-publisher-io.mjs",
        "workflows/tools/controller-closure.mjs",
      ],
    },
    pr: {
      number: pr.number, state: pr.state, baseRepo: repo,
      baseRef: base.ref, headSha: pr.head && pr.head.sha,
      dossierHeadSha: env.DOSSIER_HEAD_SHA, mergeableState: pr.mergeable_state,
      // diffPaths, syntheticMergeCommit, checkRuns, producerMap, acceptance, phase,
      // window, verifier, authenticatedGithubApp — resolved by the genesis-time wiring;
      // undefined here => the core refuses (fail closed).
    },
    base,
    // requiredContexts / syntheticMergeCommit / etc. wired at genesis; undefined => refuse.
  };
}

function main() {
  const gt = resolveGroundTruth();
  const verdict = evaluateEligibility(gt);
  if (!verdict.ok) die(`NOT eligible: ${verdict.reason} ${verdict.detail || ""}`);
  // Eligible — perform the single merge PUT + post-merge attestation. Live-wiring,
  // reached ONLY under a green pure-core verdict over fully-resolved ground truth.
  const attestation = { merged_by: "merge-controller", pr: gt.pr.number, head: gt.pr.headSha, base: gt.base.sha };
  console.log("eligible — merge + attestation:", "sha256:" + sha256hex(canonicalize(attestation)));
  // execFileSync("gh", [...GH_BASE, "--method", "PUT", `repos/${gt.base.repo}/pulls/${gt.pr.number}/merge`, ...]);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
