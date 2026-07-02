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
import { liveGenerators, makeCouncilFactFns, councilApprovals } from "../live.mjs";
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
  return async (name, args) => {
    const p = (args && args.prompt) || "";
    // Builder seat: author the team's files.
    const teamMatch = p.match(/TEAM:([\w-]+)/);
    if (teamMatch) {
      const ws = workstreamById(teamMatch[1]);
      const files = ws.render(arch);
      const textOnly = {};
      for (const [k, v] of Object.entries(files)) if (typeof v === "string") textOnly[k] = v;
      return JSON.stringify(textOnly);
    }
    // agy governance checkpoint approval (structured), with local attestation provenance.
    if (name === "agy_checkpoint") {
      return JSON.stringify({
        phase_gate_status: "advance", blocked_reasons: [],
        provenance: { model: "agy-checkpoint", source: "ai-peer-mcp", response_id: "agy-stub-1", attestation: "local-deterministic" }
      });
    }
    // Chat council approver: real-provenance envelope { text, provenance }.
    // ("approval packet" is in the council prompt; "council approver" is system-only.)
    if (p.includes("approval packet")) {
      const model = String(name).replace(/_ask$/, "");
      return JSON.stringify({
        text: JSON.stringify({ decision: "approve", confidence: "high", required_edits: [], hard_stops: [] }),
        provenance: { model, source: "ai-peer-mcp", response_id: `${model}-stub-1` }
      });
    }
    if (p.includes("Attack this claim")) return "[]";           // grok adversary: no holes
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
  makeBreakoutFns: makeCouncilFactFns({ callTool }),
  makeApprovals: councilApprovals({ callTool })
});

assert.equal(result.converged, true, `live forge must converge; cycles=${JSON.stringify(result.cycles, null, 2)}`);
assert.equal(result.verdict.gate_status, "pass", "live: market gate passed");

// The required-seat approvals carry REAL provenance from the council — not
// fabricated by the forge. Every required model has a non-null response_id.
const prov = result.verdict.provenance || [];
assert.equal(prov.length, 3, "live: provenance for all three required seats");
for (const pr of prov) {
  assert.equal(pr.has_provenance, true, `live: ${pr.model} approval carries provenance`);
  assert.ok(typeof pr.response_id === "string" && pr.response_id.length > 0,
    `live: ${pr.model} approval has a real response_id (got ${pr.response_id})`);
}
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

// --- signed mode: converge THROUGH the hardened signature+provenance gate ---
process.env.TELOS_SECRET_CLAUDE = "test-claude";
process.env.TELOS_SECRET_AGY = "test-agy";
process.env.TELOS_SECRET_CODEX = "test-codex";
{
  const signedRoot = mkdtempSync(path.join(os.tmpdir(), "saas-forge-signed-"));
  const signedResult = await forge({
    projectRoot: signedRoot, telos, dossierMeta,
    makeGenerators: liveGenerators({ callTool }),
    makeBreakoutFns: makeCouncilFactFns({ callTool }),
    makeApprovals: councilApprovals({ callTool }),
    signed: true
  });
  assert.equal(signedResult.converged, true,
    `signed-mode forge must converge through the hardened gate; cycles=${JSON.stringify(signedResult.cycles)}`);
  assert.equal(signedResult.verdict.gate_status, "pass", "signed-mode gate passes");
  assert.equal(signedResult.verdict.headline_checks.signing_enforced, true, "signing enforced in the verdict");
  assert.equal(signedResult.verdict.headline_checks.provenance_enforced, true, "provenance enforced in the verdict");
}
// negative: a missing required secret must fail closed in signed mode.
{
  delete process.env.TELOS_SECRET_CODEX;
  const failRoot = mkdtempSync(path.join(os.tmpdir(), "saas-forge-signed-fail-"));
  const failResult = await forge({
    projectRoot: failRoot, telos, dossierMeta,
    makeGenerators: liveGenerators({ callTool }),
    makeBreakoutFns: makeCouncilFactFns({ callTool }),
    makeApprovals: councilApprovals({ callTool }),
    signed: true
  });
  assert.equal(failResult.converged, false, "signed mode without a required secret must not converge");
  const blockers = (failResult.verdict && failResult.verdict.blockers) || [];
  assert.ok(blockers.some((b) => /no secret to verify codex|signature invalid/i.test(b)),
    `expected a fail-closed signature blocker; got ${JSON.stringify(blockers)}`);
  process.env.TELOS_SECRET_CODEX = "test-codex";
}
delete process.env.TELOS_SECRET_CLAUDE;
delete process.env.TELOS_SECRET_AGY;
delete process.env.TELOS_SECRET_CODEX;

console.log("test-live OK: seat-backed generation + council+fact breakout converged through the live path (stubbed transport)");
