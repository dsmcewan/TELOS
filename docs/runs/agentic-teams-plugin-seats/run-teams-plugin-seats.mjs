#!/usr/bin/env node
// run-teams-plugin-seats.mjs — the autonomous builder over the SEAT ROUTER.
//
// Identical build to docs/runs/agentic-teams-live/run-teams-live.mjs, but the
// transport is the multi-server seat router over the default seat registry
// instead of a single ai-peer-mcp spawn: claude_ask and agy_checkpoint stay on
// ai-peer-mcp; grok/gemini/codex chat seats reach their claude-plugins seat
// servers (ndjson MCP, provenance envelope, provider-native structured output).
//
// Keys come from the environment: ANTHROPIC_API_KEY (ai-peer loads HKCU too),
// XAI_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY (plugin servers read process env
// only). A seat with no key FAIL-CLOSES and the gate honest-blocks — the
// correct outcome, not an error.
//
//   node docs/runs/agentic-teams-plugin-seats/run-teams-plugin-seats.mjs
//   # optional: TELOS_LIVE_DECOMPOSE=1 lets the Planning team author the tasks live
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeatRouter } from "../../../breakout/seat_router.mjs";
import { liveSeatCaller } from "../../../build-gate/council.mjs";
import { defaultSeatRegistry } from "../../../build-gate/seat-registry.mjs";
import { buildProject, makeTeamKeyring } from "../../../build-gate/build-orchestrator.mjs";
import { planTeams } from "../../../build-gate/teams.mjs";
import { makeLiveCallSeat, makeLiveCallTeam } from "../../../build-gate/teamPrompts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../../../build-gate/examples/agentic-teams");
const dossier = JSON.parse(readFileSync(path.join(fixture, "dossier.json"), "utf8"));
const fixtureTasks = JSON.parse(readFileSync(path.join(fixture, "tasks.json"), "utf8"));

// Per-seat model overrides (else each backend's default applies).
const models = {
  claude: process.env.TELOS_CLAUDE_MODEL,
  grok: process.env.TELOS_GROK_MODEL,
  codex: process.env.OPENAI_MODEL || process.env.TELOS_CODEX_MODEL
};
const meta = { proposal_ref: dossier.build_id, timestamp: new Date().toISOString(), docs_reviewed: [] };
const liveDecompose = process.env.TELOS_LIVE_DECOMPOSE === "1";

const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-teams-plugin-seats-"));
const telosDir = path.join(baseDir, ".telos");
mkdirSync(telosDir, { recursive: true });

const teams = planTeams(dossier);
const { keyring, signerFor } = makeTeamKeyring(teams);

// The seat router presents the same { callTool } surface a single client does;
// max-effort plugin backends (xhigh / pro-high) need the longer kill switch.
const router = createSeatRouter(defaultSeatRegistry());
const client = { callTool: (name, args) => router.callTool(name, args) };
const close = () => router.close();
const killer = setTimeout(() => { process.stderr.write("LIVE_BUILD_TIMEOUT\n"); close(); process.exit(2); }, 900000);

let summary;
try {
  const callSeat = makeLiveCallSeat({ client, liveSeatCaller, dossier, meta, models });
  const callTeam = makeLiveCallTeam({ client });

  const result = await buildProject({
    dossier,
    telos: "Build the greeting library autonomously, end to end.",
    tasks: liveDecompose ? undefined : fixtureTasks,
    callSeat, callTeam, keyring, signerFor, baseDir, telosDir, maxRepairRounds: 12
  });

  // Sanitized, secret-free summary (no keys, no private signer material).
  summary = {
    generated_for: dossier.build_id,
    live: true,
    transport: "seat-router (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)",
    decompose: liveDecompose ? "live" : "fixture",
    phase: result.phase,
    ok: result.ok,
    merge_status: result.report ? result.report.merge_status : null,
    teams_convened: teams.map((t) => t.id),
    council: (result.council ? result.council.blockers : (result.blocked || [])).length === 0
      ? "passed"
      : { blockers: result.council ? result.council.blockers : result.blocked },
    settled_nodes: result.trace ? result.trace.filter((t) => t.action === "settled").map((t) => ({ id: t.id, signer: t.model })) : [],
    note: "Live run over the seat router. Without API keys, required seats fail-closed and the gate honest-blocks at approval (no plan, no ledger) — the correct outcome."
  };
} catch (error) {
  summary = { generated_for: dossier.build_id, live: true, error: error?.message || String(error) };
  process.exitCode = 1;
} finally {
  clearTimeout(killer);
  close();
}

writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nphase=${summary.phase} ok=${summary.ok} merge_status=${summary.merge_status ?? "n/a"}`);
