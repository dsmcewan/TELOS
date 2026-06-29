// forge.mjs — the cyclical driver for ai-forge: pattern validation -> plan ->
// generate -> verify -> per-workstream breakout (verdict-on-facts) -> market
// gate, looping until the gate certifies the project (or maxCycles).
//
// Mirrors saas-forge/forge.mjs with two key differences:
//   1. No research stage — the pattern supplies workstreams directly.
//   2. The market gate uses RAG workstream ids (set explicitly in the dossier's
//      required_market_workstreams) so the gate never falls back to the hardcoded
//      SaaS DEFAULT_MARKET_WORKSTREAMS list. All other gate mechanics are reused
//      verbatim (market-packet shape, breakout re-verification, approval seats).
//
// Gate path chosen: FULL MARKET PATH (mirror saas-forge/forge.mjs).
//
// Rationale: gate.mjs's requiredMarketWorkstreams() uses dossier.required_market_workstreams
// when it is a non-empty array — never falling back to DEFAULT_MARKET_WORKSTREAMS.
// Market-packet shape fields (architecture_findings, backend_schema_findings, etc.)
// accept empty arrays; no content is validated. lexi_class_ui_status="not-applicable"
// on non-UI workstreams triggers no blockers. user_facing_frontend=false in the
// dossier disables the frontend-brand-experience seat requirement. Breakout
// re-verification resolves file paths relative to dossier.affected_directories[0]
// (=projectRoot), which is exactly where generators write artifacts. No contortion
// needed; the exit criterion (merge_status ready + gate_status pass) is met cleanly.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { generateKeypair } from "../merkle-dag/crypto.mjs";
import { computePlan, writePlan } from "../merkle-dag/merkle.mjs";
import { runBuild } from "../merkle-dag/orchestrate.mjs";
import { validateRecords } from "../build-gate/gate.mjs";
import { validatePattern, patternTaskDefs, signerForTask } from "./pattern.mjs";
import { generatorDispatch, makePatternGenerators } from "./generators.mjs";
import { runPatternBreakouts } from "./breakouts.mjs";

const TS = "2026-06-29T00:00:00-04:00";

// One market-readiness packet per workstream record, generated FROM its breakout
// record. The breakout's checks point at the workstream's generated artifacts, so
// the gate re-verifies on disk the very files the build produced.
// Mirrors saas-forge/forge.mjs's marketPacketFromRecord.
function marketPacketFromRecord(record, dossierMeta) {
  const packet = {
    build_id: dossierMeta.build_id,
    idea_id: dossierMeta.idea_id,
    model: record.lens,
    project_state: "demo",
    workstreams_reviewed: [record.workstream],
    business_thesis: "Pattern-driven AI architecture generates deterministic, gate-certified artifacts.",
    target_users: ["technical evaluators", "AI practitioners", "platform builders"],
    architecture_findings: [],
    backend_schema_findings: [],
    security_findings: [],
    accuracy_eval_findings: [],
    scalability_findings: [],
    frontend_design_findings: [],
    lexi_class_ui_status: record.isUi ? (record.converged ? "meets" : "needs-work") : "not-applicable",
    go_to_market_blockers: record.surviving_blockers || [],
    breakout: {
      workstream: record.workstream,
      claimedStatus: "meets",
      finalStatus: record.finalStatus,
      converged: record.converged,
      surviving_blockers: record.surviving_blockers || [],
      go_to_market_blockers: record.surviving_blockers || [],
      checks: record.checks,
      rounds: record.rounds
    },
    recommendation_to_claude: record.converged
      ? "Proceed: claim survived adversarial breakout on facts."
      : "Block: surviving blockers from breakout.",
    timestamp: TS
  };
  packet[record.findingsKey] = [record.finding];
  return packet;
}

// Synthetic council approvals for the keyless/offline path. Marked honestly:
// proposal_ref says synthetic and there is NO provenance, so the gate surfaces a
// provenance warning — a demo can never be mistaken for a real signed council pass.
// Live runs replace these via real signed council approvals.
// Mirrors saas-forge/forge.mjs's syntheticApprovals; REQUIRED_MODELS = claude/agy/codex.
export function syntheticApprovals(dossierMeta) {
  return ["claude", "agy", "codex"].map((model) => ({
    build_id: dossierMeta.build_id,
    use_case: dossierMeta.use_case,
    model,
    role: "builder",
    docs_reviewed: [],
    proposal_ref: "synthetic-demo-approval",
    decision: "approve",
    required_edits: [],
    hard_stops: [],
    confidence: "high",
    timestamp: TS
  }));
}

/**
 * Drive the forge to convergence.
 *
 *   pattern         validated pattern object (workstreams registry)
 *   ctx             render context forwarded to workstream render/checks fns
 *   projectRoot     absolute path the build writes into
 *   dossierMeta     { build_id, idea_id, use_case, objective }
 *   makeGenerators  (pattern, ctx) -> generateFiles adapter  [default: makePatternGenerators]
 *   makeBreakoutFns optional breakout factory; default = factBreakout (keyless, verdict on disk)
 *   makeApprovals   (dossierMeta) -> packet[]  [default: syntheticApprovals]
 *   maxCycles       plan->build->breakout->gate iterations before giving up  [default: 3]
 *
 * Returns { converged, cycles[], records[], verdict }.
 */
export async function forge({
  pattern,
  ctx,
  projectRoot,
  dossierMeta,
  makeGenerators = makePatternGenerators,
  makeBreakoutFns,
  makeApprovals = syntheticApprovals,
  maxCycles = 3
}) {
  // Step 1: validate the pattern; throw immediately on schema errors.
  const validation = validatePattern(pattern);
  if (!validation.ok) {
    throw new Error(`invalid pattern: ${JSON.stringify(validation.errors)}`);
  }

  const telosDir = path.join(projectRoot, ".telos");
  await mkdir(telosDir, { recursive: true });

  // Step 2: one keypair per distinct signer across workstreams.
  const signerNames = [...new Set(pattern.workstreams.map((w) => w.signer))];
  const keys = Object.fromEntries(signerNames.map((name) => [name, generateKeypair()]));
  const authorizedSigners = Object.fromEntries(signerNames.map((name) => [name, keys[name].publicJwk]));
  const signerForModel = (m) => keys[m]?.privatePem;

  const cycles = [];
  let verdict = null;
  let records = [];

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    // Step 3: derive task defs from the pattern, compute and write the plan.
    const defs = patternTaskDefs(pattern, ctx);
    const { plan, errors } = computePlan(defs, { authorizedSigners });
    if (errors) throw new Error(`plan invalid: ${JSON.stringify(errors)}`);
    writePlan(telosDir, plan);

    // Step 4: wire the generator dispatch — pattern renderers supply the files.
    const dispatch = generatorDispatch({
      baseDir: projectRoot,
      generateFiles: makeGenerators(pattern, ctx),
      signerForTask: signerForTask(pattern)
    });

    // Step 5: run the build; settled iff every node passes its test and the
    // ledger-gate confirms merge_status === "ready".
    const { report } = await runBuild({
      telosDir,
      baseDir: projectRoot,
      dispatch,
      signerFor: signerForModel
    });
    const built = report.merge_status === "ready";

    // Step 6: adversarial per-workstream breakout (verdict on facts, not trivia).
    // Every workstream is independently challenged against its own artifact on disk.
    records = built
      ? await runPatternBreakouts({ pattern, ctx, baseDir: projectRoot, makeFns: makeBreakoutFns })
      : [];
    const allConverged = built && records.length > 0 && records.every((r) => r.converged);

    // Step 7: market gate — only if ALL workstreams converged.
    if (allConverged) {
      const approvals = makeApprovals(dossierMeta);
      const dossier = {
        build_id: dossierMeta.build_id,
        idea_id: dossierMeta.idea_id,
        use_case: dossierMeta.use_case,
        objective: dossierMeta.objective,
        required_docs: [],
        write_targets: [],
        protected_paths: [],
        affected_directories: [projectRoot],  // gate resolves breakout check paths here
        market_bound: true,
        user_facing_frontend: false,           // RAG patterns are not user-facing UIs
        lexi_required: false,
        required_market_workstreams: pattern.workstreams.map((w) => w.id)
      };
      const marketPackets = records.map((r) => marketPacketFromRecord(r, dossierMeta));
      verdict = validateRecords(dossier, approvals, { dossierDir: projectRoot }, [], marketPackets);
    } else {
      verdict = null;
    }

    cycles.push({
      cycle,
      ledger_status: report.merge_status,
      built,
      records_converged: allConverged,
      surviving: records
        .filter((r) => !r.converged)
        .map((r) => ({ workstream: r.workstream, blockers: r.surviving_blockers })),
      gate_status: verdict ? verdict.gate_status : "not-run",
      blockers: verdict ? verdict.blockers : (report.blockers || [])
    });

    // Step 8: converged when all workstream records converged AND gate passes.
    if (allConverged && verdict && verdict.gate_status === "pass") {
      return { converged: true, cycles, records, verdict };
    }
  }

  return { converged: false, cycles, records, verdict };
}
