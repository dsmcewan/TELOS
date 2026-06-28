#!/usr/bin/env node
// run-teams-market.mjs — a KEYLESS, reproducible end-to-end run of the autonomous
// builder on a MARKET-BOUND dossier, exercising the FULL multi-team fan-out.
//
// Unlike the non-market demo (every node routes to architecture), a market-bound
// dossier convenes one team per required workstream, so nodes fan out to distinct
// teams (backend, frontend, security, ops, ...). The market-readiness gate stays
// load-bearing: the run supplies real market packets whose frontend "meets"
// breakout record is RE-VERIFIED against an on-disk evidence file. Mock seats, but
// the real gate + real Ed25519 ledger + real merkle-dag substrate.
//
//   node docs/runs/agentic-teams-market/run-teams-market.mjs
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLedger } from "../../../merkle-dag/crypto.mjs";
import { buildProject, makeTeamKeyring } from "../../../build-gate/build-orchestrator.mjs";
import { planTeams, teamForNode } from "../../../build-gate/teams.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../../../build-gate/examples/agentic-teams-market");
const dossier = JSON.parse(readFileSync(path.join(fixture, "dossier.json"), "utf8"));
const tasks = JSON.parse(readFileSync(path.join(fixture, "tasks.json"), "utf8"));
const marketDir = path.join(fixture, "market");
const marketPackets = readdirSync(marketDir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(marketDir, f), "utf8")));

// Mock council seat: approves for every model (approval + market-lens seats) and
// serves the Planning team on intent==="decompose".
const callSeat = async ({ model, intent }) => {
  if (intent === "decompose") return { tasks };
  return {
    packet: {
      build_id: dossier.build_id, use_case: dossier.use_case, model, role: "approver",
      docs_reviewed: [], proposal_ref: dossier.build_id, decision: "approve",
      required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z"
    },
    provenance: { model: `mock-${model}`, source: "run-teams-market-demo", response_id: `mock_${model}` }
  };
};

// Mock build team: writes the node's declared files.
const callTeam = async ({ team, node }) => ({
  files: node.files.map((p) => ({ path: p, content: `// ${node.id} built by team ${team.id}\nexport const ${node.id.replace(/-/g, "_")} = true;\n` }))
});

const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-teams-market-"));
const telosDir = path.join(baseDir, ".telos");
mkdirSync(telosDir, { recursive: true });

// Pre-build market-readiness evidence: the frontend "meets" breakout record is
// re-verified against this file by the gate (truth-on-facts, not self-report).
mkdirSync(path.join(baseDir, "market-evidence"), { recursive: true });
writeFileSync(
  path.join(baseDir, "market-evidence", "frontend-meets.md"),
  `# Frontend LEXI-class evidence\nbuild_id: ${dossier.build_id}\nFirst-screen value proof present.\n`
);

const teams = planTeams(dossier);
const { keyring, signerFor } = makeTeamKeyring(teams);

const result = await buildProject({
  dossier, telos: "Build the market-ready micro-app autonomously.", tasks: undefined,
  callSeat, callTeam, marketPackets, keyring, signerFor, baseDir, telosDir,
  // re-verify the breakout `meets` checks against the build workspace
  source: { dossierDir: baseDir }, maxRepairRounds: 20
});

const ledger = result.phase === "build" ? readLedger(path.join(telosDir, "ledger.jsonl")) : [];

// Which team owned each node (computed the same way the orchestrator routes).
const routing = tasks.map((t) => ({ node: t.id, workstream: t.workstream, team: teamForNode(t, teams).id }));

const summary = {
  generated_for: dossier.build_id,
  market_bound: true,
  keyless: true,
  phase: result.phase,
  ok: result.ok,
  merge_status: result.report ? result.report.merge_status : null,
  teams_convened: teams.map((t) => t.id),
  node_routing: routing,
  distinct_teams_used: [...new Set(routing.map((r) => r.team))].sort(),
  // plan_hash is intentionally omitted: it pins the per-run EPHEMERAL signer
  // public keys, so it differs every run by design (keeps this evidence stable).
  authorized_signers: result.plan ? Object.keys(result.plan.authorized_signers || {}).sort() : [],
  settled_nodes: result.trace ? result.trace.filter((t) => t.action === "settled").map((t) => ({ id: t.id, signer: t.model })).sort((a, b) => (a.id < b.id ? -1 : 1)) : [],
  ledger_records: ledger.map((r) => ({ task_id: r.task_id, signer: r.signer, alg: r.sig && r.sig.alg })).sort((a, b) => (a.task_id < b.task_id ? -1 : 1)),
  market_packets_seen: marketPackets.map((p) => p.model).sort(),
  council_pass: result.council ? result.council.blockers.length === 0 : false,
  note: "Market-bound full fan-out. Deterministic mock seats; real gate (incl. market-readiness + breakout re-verify), real Ed25519 ledger, real merkle-dag. Throwaway temp workspace."
};

writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nmerge_status=${summary.merge_status} phase=${summary.phase} ok=${summary.ok} teams=${summary.distinct_teams_used.join(",")}`);
process.exit(summary.ok ? 0 : 1);
