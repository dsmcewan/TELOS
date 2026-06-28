#!/usr/bin/env node
// run-teams-live.mjs — the autonomous builder over the LIVE ai-peer-mcp backends.
//
// This is the real wiring: the approval council seats (claude/grok/codex) call
// their live `*_ask` tools, agy runs its local `agy_checkpoint`, and each build
// team calls its lead seat to generate the node's files. Everything else — the
// gate, the content-addressed plan, the Ed25519 ledger — is the same real
// substrate the keyless demos use.
//
// Keys come from the environment: ANTHROPIC_API_KEY, XAI_API_KEY, OPENAI_API_KEY
// (and optional TELOS_*_MODEL overrides). A seat with no key FAIL-CLOSES: the
// server returns no usable answer, the seat yields a non-approving packet, and
// the gate honest-blocks at the approval phase — no plan, no ledger. That is the
// correct outcome, not an error.
//
//   ANTHROPIC_API_KEY=… XAI_API_KEY=… OPENAI_API_KEY=… \
//     node docs/runs/agentic-teams-live/run-teams-live.mjs
//   # optional: TELOS_LIVE_DECOMPOSE=1 lets the Planning team author the tasks live
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnMcpClient } from "../../../breakout/mcp_client.mjs";
import { liveSeatCaller } from "../../../build-gate/council.mjs";
import { buildProject, makeTeamKeyring } from "../../../build-gate/build-orchestrator.mjs";
import { planTeams } from "../../../build-gate/teams.mjs";
import { makeLiveCallSeat, makeLiveCallTeam } from "../../../build-gate/teamPrompts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, "../../../build-gate/examples/agentic-teams");
const dossier = JSON.parse(readFileSync(path.join(fixture, "dossier.json"), "utf8"));
const fixtureTasks = JSON.parse(readFileSync(path.join(fixture, "tasks.json"), "utf8"));
const serverPath = fileURLToPath(new URL("../../../connectors/ai-peer-mcp/server.mjs", import.meta.url));

// Per-seat model overrides (else the server defaults apply).
const models = {
  claude: process.env.TELOS_CLAUDE_MODEL,
  grok: process.env.TELOS_GROK_MODEL,
  codex: process.env.OPENAI_MODEL || process.env.TELOS_CODEX_MODEL
};
const meta = { proposal_ref: dossier.build_id, timestamp: new Date().toISOString(), docs_reviewed: [] };
const liveDecompose = process.env.TELOS_LIVE_DECOMPOSE === "1";

const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-teams-live-"));
const telosDir = path.join(baseDir, ".telos");
mkdirSync(telosDir, { recursive: true });

const teams = planTeams(dossier);
const { keyring, signerFor } = makeTeamKeyring(teams);

const { client, close } = spawnMcpClient({ serverPath });
const killer = setTimeout(() => { process.stderr.write("LIVE_BUILD_TIMEOUT\n"); close(); process.exit(2); }, 240000);

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
    decompose: liveDecompose ? "live" : "fixture",
    phase: result.phase,
    ok: result.ok,
    merge_status: result.report ? result.report.merge_status : null,
    teams_convened: teams.map((t) => t.id),
    council: (result.council ? result.council.blockers : (result.blocked || [])).length === 0
      ? "passed"
      : { blockers: result.council ? result.council.blockers : result.blocked },
    settled_nodes: result.trace ? result.trace.filter((t) => t.action === "settled").map((t) => ({ id: t.id, signer: t.model })) : [],
    note: "Live ai-peer-mcp backends. Without API keys, required seats fail-closed and the gate honest-blocks at approval (no plan, no ledger) — the correct outcome."
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
