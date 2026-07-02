// forge.mjs — the cyclical driver: research -> plan -> generate -> verify ->
// per-team breakout (verdict-on-facts) -> market gate, looping until the
// market-bound gate certifies the project (or maxCycles).
//
// Every SaaS team gets a REAL adversarial breakout against its own artifact
// (breakouts.mjs): a team converges only if its product evidence survives
// re-verification on disk. The market packets are GENERATED from those breakout
// records — never hand-asserted — and the gate independently re-verifies. The
// generators/docs adapters are injected, so live runs swap in Context7 +
// ai-peer-mcp seats while tests stay keyless.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { generateKeypair } from "../merkle-dag/crypto.mjs";
import { writePlan } from "../merkle-dag/merkle.mjs";
import { runBuild } from "../merkle-dag/orchestrate.mjs";
import { validateRecords } from "../build-gate/gate.mjs";
import { signMarketPacket } from "../build-gate/sign.mjs";
import { researchArchitecture, offlineDocsFor } from "./research.mjs";
import { compileConvergencePlan, signerForTask } from "./plan.mjs";
import { generatorDispatch, makeDemoGenerators } from "./generator.mjs";
import { runTeamBreakouts } from "./breakouts.mjs";

const TS = "2026-06-28T00:00:00-04:00";

// One market-readiness packet per team, generated FROM its breakout record. The
// breakout's checks point at the team's generated artifacts, so the gate
// re-verifies on disk the very files the build produced.
function marketPacketFromRecord(record, dossierMeta, { signed = false } = {}) {
  const packet = {
    build_id: dossierMeta.build_id,
    idea_id: dossierMeta.idea_id,
    model: record.lens,
    project_state: "demo",
    workstreams_reviewed: [record.workstream],
    business_thesis: dossierMeta.business_thesis || "Deterministic communication forensics converts technical credibility into market trust.",
    target_users: Array.isArray(dossierMeta.target_users) && dossierMeta.target_users.length
      ? dossierMeta.target_users
      : ["technical evaluators", "compliance teams", "early buyers"],
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
  return signed ? signMarketPacket(packet, record, record.signer) : packet;
}

// Synthetic council approvals for the keyless/offline path. Marked honestly:
// proposal_ref says synthetic and there is NO provenance, so the gate surfaces a
// provenance warning — a demo can never be mistaken for a real signed council
// pass. Live runs replace these via councilApprovals (real provenance).
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

// The REQUIRED-seat approval packets are produced by the seats (or the synthetic
// fallback) — NEVER fabricated inside the gate call. A dissenting seat
// (decision != approve) or absent provenance fails the gate closed.
// Exported so stage-driven runners (e.g. the ratcheting evidence runner) can
// re-run the gate over checkpointed records without re-entering forge().
export function runMarketGate({ projectRoot, dossierMeta, teamRecords, approvals, signed = false }) {
  const dossier = {
    build_id: dossierMeta.build_id,
    idea_id: dossierMeta.idea_id,
    use_case: dossierMeta.use_case,
    objective: dossierMeta.objective,
    trust_mode: signed ? "signed" : undefined,
    required_docs: [],
    write_targets: [],
    protected_paths: [],
    affected_directories: [projectRoot], // absolute root for breakout re-verify
    market_bound: true,
    user_facing_frontend: true,
    lexi_required: false,
    required_market_workstreams: dossierMeta.required_market_workstreams
  };

  const marketPackets = teamRecords.map((r) => marketPacketFromRecord(r, dossierMeta, { signed }));
  return validateRecords(dossier, approvals, { dossierDir: projectRoot }, [], marketPackets);
}

/**
 * Drive the forge to convergence.
 *   projectRoot   absolute path the build writes into
 *   telos         one-line project intent
 *   dossierMeta   { build_id, idea_id, use_case, objective, required_market_workstreams }
 *   docsFor       research adapter (default offline; live = Context7)
 *   makeGenerators(arch) -> generateFiles (default keyless demo team renderers)
 *   maxCycles     research->build->breakout->gate iterations before giving up
 *   signed        default false; when true, gate runs under trust_mode: "signed"
 * Returns { converged, cycles[], teams[], architecture, verdict }.
 */
export async function forge({
  projectRoot,
  telos,
  dossierMeta,
  docsFor = offlineDocsFor,
  makeGenerators = makeDemoGenerators,
  makeBreakoutFns,
  makeApprovals = async ({ dossierMeta: dm }) => syntheticApprovals(dm),
  signed = false,
  maxCycles = 3
}) {
  const telosDir = path.join(projectRoot, ".telos");
  await mkdir(telosDir, { recursive: true });

  const seats = { claude: generateKeypair(), codex: generateKeypair() };
  const authorizedSigners = { claude: seats.claude.publicJwk, codex: seats.codex.publicJwk };
  const signerForModel = (m) => seats[m]?.privatePem;

  const cycles = [];
  let architecture = null;
  let verdict = null;
  let teams = [];

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    architecture = await researchArchitecture({ telos, workstreams: dossierMeta.required_market_workstreams, docsFor });

    const { plan, errors } = compileConvergencePlan({ architecture, authorizedSigners });
    if (errors) throw new Error(`plan invalid: ${JSON.stringify(errors)}`);
    writePlan(telosDir, plan);

    const dispatch = generatorDispatch({
      baseDir: projectRoot,
      generateFiles: makeGenerators(architecture),
      signerForTask
    });
    const { report } = await runBuild({ telosDir, baseDir: projectRoot, dispatch, signerFor: signerForModel });
    const built = report.merge_status === "ready";

    // Every team is adversarially challenged on its own artifact (verdict-on-facts).
    teams = built ? await runTeamBreakouts({ baseDir: projectRoot, architecture, makeFns: makeBreakoutFns }) : [];
    const teamsConverged = built && teams.length > 0 && teams.every((t) => t.converged);

    // Required-seat approvals come from the seats (live) or the synthetic
    // fallback (offline) — produced here, then handed to the gate.
    const approvals = teamsConverged ? await makeApprovals({ dossierMeta, architecture }) : [];
    verdict = teamsConverged ? runMarketGate({ projectRoot, dossierMeta, teamRecords: teams, approvals, signed }) : null;

    cycles.push({
      cycle,
      ledger_status: report.merge_status,
      built,
      teams_converged: teamsConverged,
      surviving: teams.filter((t) => !t.converged).map((t) => ({ team: t.workstream, blockers: t.surviving_blockers })),
      gate_status: verdict ? verdict.gate_status : "not-run",
      blockers: verdict ? verdict.blockers : (report.blockers || [])
    });

    if (teamsConverged && verdict.gate_status === "pass") {
      return { converged: true, cycles, teams, architecture, verdict };
    }
  }

  return { converged: false, cycles, teams, architecture, verdict };
}
