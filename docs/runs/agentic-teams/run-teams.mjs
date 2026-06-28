#!/usr/bin/env node
// run-teams.mjs — a KEYLESS, reproducible end-to-end run of the autonomous
// builder. It drives buildProject over the examples/agentic-teams fixture using
// DETERMINISTIC mock seats (no API keys), with a REAL Ed25519 ledger + the real
// gate + the real merkle-dag substrate. Writes a sanitized run-summary.json next
// to this file as committable evidence. The build workspace is a throwaway temp
// dir, so no .telos/ runtime artifacts land in the repo.
//
//   node docs/runs/agentic-teams/run-teams.mjs
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLedger } from "../../../merkle-dag/crypto.mjs";
import { buildProject, makeTeamKeyring } from "../../../build-gate/build-orchestrator.mjs";
import { planTeams } from "../../../build-gate/teams.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../../../build-gate/examples/agentic-teams");
const dossier = JSON.parse(readFileSync(path.join(fixture, "dossier.json"), "utf8"));
const tasks = JSON.parse(readFileSync(path.join(fixture, "tasks.json"), "utf8"));

// Mock council seat: every seat approves; also serves the Planning team on
// intent==="decompose". A real run swaps this for liveSeatCaller + approvalPromptFor.
const callSeat = async ({ model, intent }) => {
  if (intent === "decompose") return { tasks };
  return {
    packet: {
      build_id: dossier.build_id, use_case: dossier.use_case, model, role: "approver",
      docs_reviewed: [], proposal_ref: dossier.build_id, decision: "approve",
      required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z"
    },
    provenance: { model: `mock-${model}`, source: "run-teams-demo", response_id: `mock_${model}` }
  };
};

// Mock build team: writes the node's declared files. A real run swaps this for
// makeLiveCallTeam({ client }) over ai-peer-mcp.
const callTeam = async ({ team, node }) => ({
  files: node.files.map((p) => ({ path: p, content: `// ${node.id} built by team ${team.id}\nexport const built = true;\n` }))
});

const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-teams-run-"));
const telosDir = path.join(baseDir, ".telos");
mkdirSync(telosDir, { recursive: true });

const teams = planTeams(dossier);
const { keyring, signerFor } = makeTeamKeyring(teams);

const result = await buildProject({
  dossier, telos: "Build the greeting library autonomously.", tasks: undefined,
  callSeat, callTeam, keyring, signerFor, baseDir, telosDir, maxRepairRounds: 20
});

const ledger = result.phase === "build" ? readLedger(path.join(telosDir, "ledger.jsonl")) : [];

// Sanitized, secret-free evidence (no private keys, no env).
const summary = {
  generated_for: dossier.build_id,
  keyless: true,
  phase: result.phase,
  ok: result.ok,
  merge_status: result.report ? result.report.merge_status : null,
  teams_convened: teams.map((t) => t.id),
  plan_hash: result.plan ? result.plan.plan_hash : null,
  authorized_signers: result.plan ? Object.keys(result.plan.authorized_signers || {}) : [],
  settled_nodes: result.trace ? result.trace.filter((t) => t.action === "settled").map((t) => ({ id: t.id, signer: t.model })) : [],
  ledger_records: ledger.map((r) => ({ task_id: r.task_id, signer: r.signer, alg: r.sig && r.sig.alg })),
  council_pass: result.council ? result.council.blockers.length === 0 : false,
  note: "Deterministic mock seats; real Ed25519 ledger, real gate, real merkle-dag. Build workspace was a throwaway temp dir."
};

writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nmerge_status=${summary.merge_status} phase=${summary.phase} ok=${summary.ok}`);
process.exit(summary.ok ? 0 : 1);
