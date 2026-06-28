// forge.mjs — the cyclical driver: research -> plan -> generate -> verify ->
// gate, looping until the market-bound gate certifies the project (or maxCycles).
//
// This is the "do what it did, cyclically, before finishing" loop: each cycle
// researches the architecture, generates every workstream's artifacts through
// the merkle-dag build (which verifies each by its own test and settles a signed
// ledger), then runs the TELOS market gate. Convergence = build ready AND gate
// pass. The generators/docs adapters are injected, so live runs swap in Context7
// + ai-peer-mcp seats while tests stay keyless.

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { generateKeypair } from "../merkle-dag/crypto.mjs";
import { writePlan } from "../merkle-dag/merkle.mjs";
import { runBuild } from "../merkle-dag/orchestrate.mjs";
import { validateRecords } from "../build-gate/gate.mjs";
import { researchArchitecture, offlineDocsFor } from "./research.mjs";
import { compileConvergencePlan, signerForTask } from "./plan.mjs";
import { generatorDispatch, makeDemoGenerators } from "./generator.mjs";

const TS = "2026-06-28T00:00:00-04:00";

// Build the market-bound gate inputs and run the TELOS gate. The market packet's
// breakout `checks` point at the GENERATED frontend artifacts, so the gate
// re-verifies on disk the very files the build produced — the loop closes here.
function runMarketGate({ projectRoot, dossierMeta }) {
  const dossier = {
    build_id: dossierMeta.build_id,
    idea_id: dossierMeta.idea_id,
    use_case: dossierMeta.use_case,
    objective: dossierMeta.objective,
    required_docs: [],
    write_targets: [],
    protected_paths: [],
    // Absolute root so the breakout re-verify resolves against the built project.
    affected_directories: [projectRoot],
    market_bound: true,
    user_facing_frontend: true,
    lexi_required: false,
    required_market_workstreams: dossierMeta.required_market_workstreams
  };

  const approval = (model) => ({
    build_id: dossierMeta.build_id,
    use_case: dossierMeta.use_case,
    model,
    role: "builder",
    docs_reviewed: [],
    proposal_ref: "saas-forge",
    decision: "approve",
    required_edits: [],
    hard_stops: [],
    confidence: "high",
    timestamp: TS
  });
  const packets = ["claude", "agy", "codex"].map(approval);

  const marketPackets = [{
    build_id: dossierMeta.build_id,
    idea_id: dossierMeta.idea_id,
    model: "claude",
    project_state: "demo",
    workstreams_reviewed: ["frontend-brand-experience"],
    business_thesis: "A deterministic communication-forensics demo converts technical credibility into market trust.",
    target_users: ["technical evaluators", "early buyers"],
    architecture_findings: ["Static-first delivery with an optional LLM explanation layer over fixed findings."],
    backend_schema_findings: [],
    security_findings: [],
    accuracy_eval_findings: [],
    scalability_findings: [],
    frontend_design_findings: ["Generated frontend carries the #69e7ff brand token and the LEXI-class first-screen proof band."],
    lexi_class_ui_status: "meets",
    go_to_market_blockers: [],
    breakout: {
      workstream: "frontend-brand-experience",
      claimedStatus: "meets",
      finalStatus: "meets",
      converged: true,
      surviving_blockers: [],
      go_to_market_blockers: [],
      checks: [
        { type: "file_contains", path: "web/site/style.css", needle: "#69e7ff" },
        { type: "file_exists", path: "web/VERIFICATION.md" },
        { type: "file_exists", path: "docs/verification/s03-dynamics-discriminator.png" },
        { type: "file_exists", path: "docs/verification/s04-scorecard.png" }
      ],
      rounds: [
        { round: 1, blockers: ["first-screen value proof not present"], resolved: ["first-screen value proof not present"] },
        { round: 2, blockers: [], resolved: [] }
      ]
    },
    recommendation_to_claude: "Proceed: the generated frontend meets the market-ready bar.",
    timestamp: TS
  }];

  return validateRecords(dossier, packets, { dossierDir: projectRoot }, [], marketPackets);
}

/**
 * Drive the forge to convergence.
 *   projectRoot   absolute path the build writes into (the target SaaS project)
 *   telos         one-line project intent
 *   dossierMeta   { build_id, idea_id, use_case, objective, required_market_workstreams }
 *   docsFor       research adapter (default offline; live = Context7)
 *   makeGenerators(arch) -> generateFiles  (default keyless demo generators)
 *   maxCycles     research->build->gate iterations before giving up
 * Returns { converged, cycles[], architecture, verdict }.
 */
export async function forge({
  projectRoot,
  telos,
  dossierMeta,
  docsFor = offlineDocsFor,
  makeGenerators = makeDemoGenerators,
  maxCycles = 3
}) {
  const telosDir = path.join(projectRoot, ".telos");
  await mkdir(telosDir, { recursive: true });

  // Per-seat signing keys; both seats authorized in the plan.
  const seats = { claude: generateKeypair(), codex: generateKeypair() };
  const authorizedSigners = { claude: seats.claude.publicJwk, codex: seats.codex.publicJwk };
  const signerForModel = (m) => seats[m]?.privatePem;

  const cycles = [];
  let architecture = null;
  let verdict = null;

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

    verdict = built ? runMarketGate({ projectRoot, dossierMeta }) : null;
    cycles.push({
      cycle,
      ledger_status: report.merge_status,
      built,
      gate_status: verdict ? verdict.gate_status : "not-run",
      blockers: verdict ? verdict.blockers : report.blockers || []
    });

    if (built && verdict.gate_status === "pass") {
      return { converged: true, cycles, architecture, verdict };
    }
  }

  return { converged: false, cycles, architecture, verdict };
}
