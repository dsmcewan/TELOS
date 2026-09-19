#!/usr/bin/env node
// Daedalus v2 runner — smoke mode only.
// Governing document (HELD, The Eye 2026-07-20; canonical location, does not move):
//   docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md
//
// Drives the full v2 plan arc with deterministic smoke seats: Stage 0 research
// breakout → Stage 1 plan produce (the real runWorkshop parallel join, smoke
// mode) → research dispositions → Stage 2 plan challenge with role R referee
// and Seat 5 checkpoints → converged-for-submission (submission only).
//
// Live mode is deliberately NOT wired: the grok/gemini challenge and referee
// transports require provider access, and The Eye's open items 1–7 (caps,
// cadence, Stage 3/4 vehicle) are unruled. Smoke evidence is prohibited in the
// governed workshop directory, so --run-dir is mandatory and must point at a
// disposable test-only location.
//
// Usage: run-daedalus-v2.mjs --smoke --run-dir <dir>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runWorkshop, createArtifactStore } from "./workshop-lib.mjs";
import { hashRefV2, runDaedalusV2 } from "./daedalus-v2.mjs";
import { deriveHallucinationMetrics } from "./hallucination-metrics.mjs";

const args = process.argv.slice(2);
if (args.includes("--live")) {
  // File-first live wiring: the challenger/referee adapters exist in
  // live-seats-v2.mjs (xAI Responses API + Gemini generateContent, mock-tested);
  // execution stays gated until every transport requirement is present AND The
  // Eye approves a live budget for the governed Stage 1 join.
  const { liveSeatsPreflight } = await import("./live-seats-v2.mjs");
  const preflight = liveSeatsPreflight(process.env);
  process.stdout.write(`${JSON.stringify({
    kind: "daedalus-v2-live-preflight",
    ready: preflight.ready,
    missing: preflight.missing,
    notes: preflight.notes,
    provider_calls_authorized: false
  }, null, 2)}\n`);
  process.exit(preflight.ready ? 0 : 2);
}
if (!args.includes("--smoke")) {
  console.error("usage: run-daedalus-v2.mjs --smoke --run-dir <disposable-dir> | --live (preflight report only)");
  process.exit(2);
}
const runDirIndex = args.indexOf("--run-dir");
if (runDirIndex === -1 || !args[runDirIndex + 1]) {
  console.error("--run-dir is required for smoke output (never the governed workshop directory)");
  process.exit(2);
}
const root = path.resolve(args[runDirIndex + 1]);
// Smoke evidence is prohibited in (or under) the governed workshop directory —
// enforced, not just documented.
const governedDir = path.dirname(new URL(import.meta.url).pathname);
if (root === governedDir || root.startsWith(`${governedDir}${path.sep}`) || governedDir.startsWith(`${root}${path.sep}`)) {
  console.error(`--run-dir must not point at or contain the governed workshop directory (${governedDir})`);
  process.exit(2);
}
mkdirSync(root, { recursive: true });

const stagePaths = {
  candidate: "candidate.md",
  design: "design.md",
  preReview: "pre-review.json",
  methodology: "methodology.md",
  comprehension: "reader-validation.json"
};
writeFileSync(path.join(root, stagePaths.candidate), "# Candidate\n\nAlpha.\n\nBeta.\n");
writeFileSync(path.join(root, stagePaths.design), "# Design\n");
writeFileSync(path.join(root, stagePaths.preReview), "{\"kind\":\"evidence\"}\n");
writeFileSync(path.join(root, stagePaths.methodology), "# Methodology\n");
writeFileSync(path.join(root, stagePaths.comprehension), JSON.stringify({
  result: "COMPREHENSION_PASSED",
  comprehension_checks: { passed: 19, failed: 0 }
}));

const frameRef = hashRefV2({ kind: "requirement-frame", source: "smoke", paths: stagePaths });
const matrix = [{
  obligation_id: "PPC-W01",
  invariant: "candidate remains bound",
  mechanism: "exact replacement controller",
  task: "materialize the integrated candidate",
  negative_test: "ambiguous replacement is rejected",
  exit_criterion: "materialized bytes are uniquely derived"
}];

let smokeCall = 0;
function smokeProvenance(seat, phase) {
  smokeCall += 1;
  return {
    provider: `${seat}-provider`,
    model: `${seat}-smoke`,
    response_id: `smoke-${phase}-${seat}-${smokeCall}`,
    source: "workshop-smoke"
  };
}

const stageOneSeat = async ({ seat, role, phase }) => {
  const provenance = {
    ...smokeProvenance(seat, phase),
    provider: seat === "claude" ? "anthropic" : "openai"
  };
  if (phase === "author" && role === "constraints") {
    const response = { plan: "# Constraint source\n", obligations: ["PPC-W01"] };
    return { ...response, provenance, response };
  }
  if (phase === "author") {
    const response = { plan: "# Implementation source\n" };
    return { ...response, provenance, response };
  }
  if (phase === "integrate") {
    return {
      provenance,
      response: {
        decision: "preserve",
        maturation_summary: "No material revision is required.",
        replacements: [],
        obligation_matrix: matrix
      }
    };
  }
  const response = { verdict: "preserved", conflicts: [] };
  return { ...response, provenance, response };
};

let joinIndex = 0;
const workshopRunDir = path.join(root, "stage-1");
const runJoin = async () => {
  joinIndex += 1;
  const summary = await runWorkshop({
    repoRoot: root,
    runDir: workshopRunDir,
    attemptId: `attempt-${String(joinIndex).padStart(3, "0")}`,
    mode: "smoke",
    paths: stagePaths,
    callSeat: stageOneSeat
  });
  if (summary.state !== "converged-parallel") return { terminal: "needs-work" };
  return {
    state: summary.state,
    terminal: "submit",
    plan_ref: summary.matured_plan.raw_sha256,
    integration_ref: summary.integration.candidate_ref
  };
};

const store = createArtifactStore(path.join(root, "v2-artifacts"));
const result = await runDaedalusV2({
  frameRef,
  store,
  researchSeats: ["claude", "codex", "grok", "gemini"],
  callResearchSeat: async ({ seat }) => ({
    response: {
      research_version: 1,
      seat,
      requirement_frame_ref: frameRef,
      inclusions: [{ topic: `${seat}-scope`, claim: `${seat} smoke inclusion`, evidence_refs: [] }],
      use_cases: [{ name: `${seat}-case`, why_planning_must_consider: "smoke boundary" }],
      failure_cases: [],
      adversarial_cases: [],
      open_questions: [],
      citations: []
    },
    provenance: smokeProvenance(seat, "research")
  }),
  runJoin,
  callDispose: async ({ surviving }) => ({
    response: {
      dispositions: surviving.map((artifact) => ({
        artifact_ref: artifact.ref,
        status: "used",
        why: "smoke arc consumes all research"
      }))
    },
    provenance: smokeProvenance("claude", "dispose")
  }),
  callChallengerSeat: async ({ seat, phase }) => ({
    response: phase === "challenge"
      ? { verdict: "accepted", objections: [], empty_list_attestation: "genuinely-found-nothing" }
      : { rationale: "smoke defense", concur: true },
    provenance: smokeProvenance(seat, phase)
  }),
  callRefereeSeat: async ({ seat }) => ({
    response: { verdict: "continue", loop_evidence: [] },
    provenance: smokeProvenance(seat, "referee")
  })
});

const metrics = deriveHallucinationMetrics(result);
const summaryPath = path.join(root, "daedalus-v2-result.json");
writeFileSync(summaryPath, `${JSON.stringify({ ...result, hallucination_metrics: metrics }, null, 2)}\n`);
console.log(`state: ${result.state}`);
console.log(`terminal: ${result.terminal}`);
console.log(`plan_ref: ${result.plan_ref ?? "n/a"}`);
console.log(`checkpoints: ${result.checkpoints.length} (all agy-attested)`);
console.log(`fabrication events: ${metrics.totals.fabrication_events}/${metrics.totals.counted_calls} counted calls (transport failures: ${metrics.totals.transport_failures})`);
console.log(`result: ${summaryPath}`);
process.exit(result.state === "converged-for-submission" ? 0 : 1);
