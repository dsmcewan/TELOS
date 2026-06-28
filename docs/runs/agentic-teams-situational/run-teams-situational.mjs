#!/usr/bin/env node
// run-teams-situational.mjs — a KEYLESS, reproducible end-to-end run showing the
// builder being SITUATIONALLY AWARE: it senses the project before building
// (brownfield, a write-target collision, the project's real test command), and a
// team that fails its node's own test SELF-CORRECTS on the next attempt (runtime
// adaptation). Deterministic mock seats; real gate, real Ed25519 ledger, real
// merkle-dag. Throwaway temp workspace, so no .telos artifacts hit the repo.
//
//   node docs/runs/agentic-teams-situational/run-teams-situational.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLedger } from "../../../merkle-dag/crypto.mjs";
import { buildProject, makeTeamKeyring } from "../../../build-gate/build-orchestrator.mjs";
import { planTeams } from "../../../build-gate/teams.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

const dossier = {
  build_id: "situational-demo",
  use_case: "autonomous-build",
  objective: "Add a greeting module to an existing project, autonomously.",
  required_docs: [],
  write_targets: ["src/greet.mjs"]
};

// A node whose test passes only once its file contains the marker "FIXED".
const tasks = [{
  id: "greet",
  writes: ["src/greet.mjs"],
  reads: [],
  requirements: "export greet(name); the file must contain the marker FIXED",
  test: { cmd: "node", args: ["-e", "process.exit(require('fs').readFileSync('src/greet.mjs','utf8').includes('FIXED')?0:1)"] },
  workstream: "product-architecture"
}];

const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-situational-"));
const telosDir = path.join(baseDir, ".telos");
mkdirSync(telosDir, { recursive: true });
mkdirSync(path.join(baseDir, "src"), { recursive: true });

// BROWNFIELD setup: a real package.json (so project sense detects the test command)
// and a pre-existing write target (so project sense reports a collision).
writeFileSync(path.join(baseDir, "package.json"), JSON.stringify({ name: "host-project", type: "module", scripts: { test: "node --test" } }, null, 2));
writeFileSync(path.join(baseDir, "src", "greet.mjs"), "// legacy greeting\n");

const callSeat = async ({ model, intent }) => {
  if (intent === "decompose") return { tasks };
  return {
    packet: { build_id: dossier.build_id, use_case: dossier.use_case, model, role: "approver", docs_reviewed: [], proposal_ref: dossier.build_id, decision: "approve", required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z" },
    provenance: { model: `mock-${model}`, source: "situational-demo", response_id: `mock_${model}` }
  };
};

// RUNTIME ADAPTATION: the team writes a broken file on attempt 1, then — informed
// by `priorFailure` (its own captured test failure) — self-corrects on attempt 2.
const attempts = [];
const callTeam = async ({ team, node, attempt, priorFailure }) => {
  attempts.push({ node: node.id, attempt, saw_prior_failure: !!priorFailure, prior_detail: priorFailure?.detail || null });
  const content = attempt === 1
    ? `// ${node.id} by ${team.id}\nexport function greet(name) { return "hi " + name; }\n`           // missing FIXED marker -> test fails
    : `// ${node.id} by ${team.id} (corrected)\nexport function greet(name) { return "hi " + name; }\n// FIXED\n`;
  return { files: node.files.map((p) => ({ path: p, content })) };
};

const teams = planTeams(dossier);
const { keyring, signerFor } = makeTeamKeyring(teams);

const result = await buildProject({
  dossier, telos: "Add a greeting module to the existing host project.", tasks: undefined,
  callSeat, callTeam, keyring, signerFor, baseDir, telosDir, adaptAttempts: 2, maxRepairRounds: 12
});

const ledger = result.phase === "build" ? readLedger(path.join(telosDir, "ledger.jsonl")) : [];

const summary = {
  generated_for: dossier.build_id,
  keyless: true,
  phase: result.phase,
  ok: result.ok,
  merge_status: result.report ? result.report.merge_status : null,
  situation: result.situation ? {
    mode: result.situation.mode,
    collisions: result.situation.collisions.map((c) => c.path),
    detected_test_command: result.situation.conventions.testCmd,
    advisories: result.situation.advisories
  } : null,
  adaptation: {
    attempts,
    self_corrected: attempts.some((a) => a.attempt === 2 && a.saw_prior_failure)
  },
  settled_nodes: result.trace ? result.trace.filter((t) => t.action === "settled").map((t) => ({ id: t.id, signer: t.model })) : [],
  ledger_records: ledger.map((r) => ({ task_id: r.task_id, signer: r.signer, alg: r.sig && r.sig.alg })),
  final_file: (() => { try { return readFileSync(path.join(baseDir, "src", "greet.mjs"), "utf8").includes("FIXED") ? "contains FIXED (corrected)" : "missing FIXED"; } catch { return null; } })(),
  note: "Situational awareness: project sense (brownfield + collision + real test command) and runtime adaptation (a team self-corrected after its own test failed). Deterministic mock seats; real gate, real Ed25519 ledger, real merkle-dag."
};

writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nphase=${summary.phase} ok=${summary.ok} merge_status=${summary.merge_status} self_corrected=${summary.adaptation.self_corrected}`);
process.exit(summary.ok ? 0 : 1);
