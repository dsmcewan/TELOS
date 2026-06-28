#!/usr/bin/env node
// test-live.mjs — exercise the LIVE code path (seat-backed generation + council
// + fact breakout) with a stubbed callTool and NO API keys. Proves the wiring:
// the forge drives model seats to author each team's files, a grok adversary
// challenges on top of the fact checks, and the whole thing still converges +
// gates. (Live, the same callTool is backed by the ai-peer-mcp server.)

import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { liveGenerators, makeCouncilFactFns } from "../live.mjs";
import { researchArchitecture } from "../research.mjs";
import { workstreamById, WORKSTREAMS } from "../workstreams.mjs";

const ALL = WORKSTREAMS.map((w) => w.id);
const dossierMeta = {
  build_id: "saas-forge-live", idea_id: "idea-convergence",
  use_case: "forge-live", objective: "Forge the convergence demo, live.",
  required_market_workstreams: ALL
};
const telos = "Make the convergence demo market-ready.";

// Stub seat transport: builder calls return the team's files as JSON (text
// only); the grok adversary finds no holes; the reviewer is never reached
// because facts pass on round 1.
function makeStubCallTool(arch) {
  return async (_name, args) => {
    const p = (args && args.prompt) || "";
    const teamMatch = p.match(/TEAM:([\w-]+)/);
    if (teamMatch) {
      const ws = workstreamById(teamMatch[1]);
      const files = ws.render(arch);
      const textOnly = {};
      for (const [k, v] of Object.entries(files)) if (typeof v === "string") textOnly[k] = v;
      return JSON.stringify(textOnly);
    }
    if (p.includes("Attack this claim")) return "[]";           // grok: no holes
    if (p.includes("Team proposals")) return '{"accepted":null,"resolved":[],"evidence":""}';
    return "{}";
  };
}

const arch = await researchArchitecture({ telos, workstreams: ALL });
const callTool = makeStubCallTool(arch);

const root = mkdtempSync(path.join(os.tmpdir(), "saas-forge-live-"));
const result = await forge({
  projectRoot: root, telos, dossierMeta,
  makeGenerators: liveGenerators({ callTool }),
  makeBreakoutFns: makeCouncilFactFns({ callTool })
});

assert.equal(result.converged, true, `live forge must converge; cycles=${JSON.stringify(result.cycles, null, 2)}`);
assert.equal(result.verdict.gate_status, "pass", "live: market gate passed");
assert.equal(result.teams.length, ALL.length, "live: a breakout per team");
for (const t of result.teams) {
  assert.equal(t.converged, true, `live: ${t.workstream} converged`);
  assert.ok(t.rounds.length >= 1, `live: ${t.workstream} faced the grok adversary at least once`);
}

// Seat-authored text artifacts on disk, plus a harness-filled binary placeholder.
for (const [rel, needle] of [["db/schema.sql", "create policy"], ["web/DESIGN.md", "Figma"], ["web/site/style.css", "#69e7ff"]]) {
  const fp = path.join(root, rel);
  assert.ok(existsSync(fp) && readFileSync(fp, "utf8").includes(needle), `live: seat authored ${rel} ("${needle}")`);
}
const png = path.join(root, "docs/verification/s03-dynamics-discriminator.png");
assert.ok(existsSync(png) && statSync(png).size > 0, "live: binary screenshot placeholder filled by harness");

console.log("test-live OK: seat-backed generation + council+fact breakout converged through the live path (stubbed transport)");
