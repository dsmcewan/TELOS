#!/usr/bin/env node
// test-forge.mjs — end-to-end, keyless proof of the 7-team forge loop:
// research -> generate (dispatch) -> verify-by-test -> per-team breakout
// (verdict-on-facts) -> signed ledger -> market gate.
// Also proves fail-closed: break one team's artifact and that team's breakout
// does not converge, so the forge does not converge.

import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { makeDemoGenerators } from "../generator.mjs";
import { WORKSTREAMS } from "../workstreams.mjs";

const ALL_WORKSTREAMS = WORKSTREAMS.map((w) => w.id);
const dossierMeta = {
  build_id: "saas-forge-convergence",
  idea_id: "idea-convergence-agentic-prototype",
  use_case: "forge-convergence-demo",
  objective: "Forge the convergence demo into a market-ready SaaS.",
  required_market_workstreams: ALL_WORKSTREAMS
};
const telos = "Make the convergence demo market-ready.";

// ---------------------------------------------------------------------------
// Case 1: full 7-team loop converges — build ready, every team's breakout
// survives on facts, and the market gate passes.
// ---------------------------------------------------------------------------
{
  const root = mkdtempSync(path.join(os.tmpdir(), "saas-forge-"));
  const result = await forge({ projectRoot: root, telos, dossierMeta });

  assert.equal(result.converged, true, `forge must converge; cycles=${JSON.stringify(result.cycles, null, 2)}`);
  assert.equal(result.cycles[0].built, true, "Case 1: build settled all nodes (ledger ready)");
  assert.equal(result.cycles[0].teams_converged, true, "Case 1: every team breakout converged");
  assert.equal(result.verdict.gate_status, "pass", "Case 1: market gate passed");

  // One real breakout per team, each converged with re-verifiable checks.
  assert.equal(result.teams.length, ALL_WORKSTREAMS.length, "Case 1: a breakout per team");
  for (const t of result.teams) {
    assert.equal(t.converged, true, `Case 1: ${t.workstream} breakout converged`);
    assert.ok(Array.isArray(t.checks) && t.checks.length > 0, `Case 1: ${t.workstream} has fact checks`);
    assert.ok(t.rounds.length >= 1, `Case 1: ${t.workstream} ran at least one challenge round`);
  }

  // A sampling of generated artifacts on disk (the "drawn product", per team):
  const expect = [
    ["docs/ARCHITECTURE.md", "Vite"],
    ["docs/POSITIONING.md", "Target users"],
    ["db/schema.sql", "create policy"],
    ["web/site/csp.txt", "Content-Security-Policy"],
    ["evals/scorecard.json", "precision"],
    ["docs/OPERATIONS.md", "CloudFront"],
    ["web/site/style.css", "#69e7ff"]
  ];
  for (const [rel, needle] of expect) {
    const p = path.join(root, rel);
    assert.ok(existsSync(p) && statSync(p).size > 0, `Case 1: generated ${rel}`);
    assert.ok(readFileSync(p, "utf8").includes(needle), `Case 1: ${rel} contains "${needle}"`);
  }
  console.log(`Case 1 OK: ${ALL_WORKSTREAMS.length} teams generated, breakout-survived on facts, gate PASS`);
}

// ---------------------------------------------------------------------------
// Case 2: fail-closed per team — break the security team's CSP artifact; its
// breakout must NOT converge (verdict-on-facts), so the forge does not converge.
// ---------------------------------------------------------------------------
{
  const root = mkdtempSync(path.join(os.tmpdir(), "saas-forge-broken-"));
  const brokenGenerators = (arch) => {
    const base = makeDemoGenerators(arch);
    return async (injected) => {
      const files = await base(injected);
      if (injected.id === "security-trust") {
        // Strip the CSP header the security team's breakout checks demand.
        files["web/site/csp.txt"] = "# (no policy)\n";
      }
      return files;
    };
  };

  const result = await forge({ projectRoot: root, telos, dossierMeta, makeGenerators: brokenGenerators, maxCycles: 1 });
  assert.equal(result.converged, false, "Case 2: broken security artifact must not converge");

  // The security team specifically must fail its breakout; others may still pass.
  // (If the build node test fails first, teams won't run — accept either, but the
  // node test for security uses the same checks, so the build node fails too.)
  const built = result.cycles[0].built;
  if (built) {
    const sec = result.teams.find((t) => t.workstream === "security-trust");
    assert.ok(sec && sec.converged === false, "Case 2: security-trust breakout did not converge");
    assert.ok(sec.surviving_blockers.length > 0, "Case 2: security-trust has surviving blockers");
  } else {
    // The security node's deterministic test (same checks) caught it at build time.
    assert.equal(result.cycles[0].teams_converged, false, "Case 2: not all teams converged");
  }
  console.log("Case 2 OK: fail-closed — broken CSP blocked the security team on facts");
}

console.log("saas-forge: all tests passed");
