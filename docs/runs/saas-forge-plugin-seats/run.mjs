#!/usr/bin/env node
// run.mjs — LIVE saas-forge build over the seat router (default transport).
//
// runForgeLive is called with neither callTool nor serverPath, so it takes the
// seat-router path added in #70: claude_ask and agy_checkpoint on ai-peer-mcp;
// grok/gemini/codex on the claude-plugins seat servers. Each of the seven SaaS
// workstream teams has its builder seat author real files, faces the grok
// adversary on top of on-disk fact checks, and the market gate certifies from
// disk with real per-seat provenance.
//
// Keys: ANTHROPIC_API_KEY, XAI_API_KEY, OPENAI_API_KEY (and GEMINI_API_KEY for
// any gemini seat) in the environment. Seats without keys fail-closed and the
// gate honest-blocks — the correct outcome, not an error.
//
//   node docs/runs/saas-forge-plugin-seats/run.mjs
import { mkdtempSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runForgeLive } from "../../../saas-forge/live.mjs";
import { WORKSTREAMS } from "../../../saas-forge/workstreams.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ALL = WORKSTREAMS.map((w) => w.id);

const dossierMeta = {
  build_id: "saas-forge-plugin-seats",
  idea_id: "idea-convergence",
  use_case: "forge-live-plugin-seats",
  objective: "Forge the convergence demo live, with every model seat reached through the seat-router plugin backends.",
  required_market_workstreams: ALL
};
const telos = "Make the convergence demo market-ready.";

// No wall-clock kill switch: the gemini referee reviews each bout's fight log
// and ends adversarial loops on judgment, not on a timer (rounds keep a cost
// fuse of 12 inside runBreakout).
const projectRoot = mkdtempSync(path.join(os.tmpdir(), "telos-saas-forge-plugin-seats-"));

let summary;
try {
  const result = await runForgeLive({ projectRoot, telos, dossierMeta, maxCycles: 3 });
  summary = {
    generated_for: dossierMeta.build_id,
    live: true,
    transport: "seat-router default (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)",
    converged: result.converged,
    gate_status: result.verdict ? result.verdict.gate_status : "not-run",
    approvals_provenance: (result.verdict?.provenance || []).map((p) => ({
      model: p.model, has_provenance: p.has_provenance, response_id: p.response_id
    })),
    teams: (result.teams || []).map((t) => ({
      workstream: t.workstream, converged: t.converged, finalStatus: t.finalStatus,
      rounds: t.rounds?.length ?? 0, referee: t.referee ?? null
    })),
    cycles: Array.isArray(result.cycles) ? result.cycles : result.cycles ?? null,
    note: "Live saas-forge run over the seat router. Seats without keys fail-closed; the gate certifies only from disk + signatures + real provenance."
  };
} catch (error) {
  summary = { generated_for: dossierMeta.build_id, live: true, error: error?.message || String(error) };
  process.exitCode = 1;
}

await writeFile(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nconverged=${summary.converged ?? "n/a"} gate_status=${summary.gate_status ?? "n/a"}`);
process.exit(process.exitCode || (summary.converged ? 0 : 1));
