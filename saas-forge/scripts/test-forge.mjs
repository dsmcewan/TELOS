#!/usr/bin/env node
// test-forge.mjs — end-to-end, keyless proof of the forge loop:
// research -> generate (via dispatch) -> verify-by-test -> signed ledger -> market gate.
// Also proves fail-closed: a frontend that drops the brand token never settles.

import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { makeDemoGenerators } from "../generator.mjs";

const dossierMeta = {
  build_id: "saas-forge-convergence",
  idea_id: "idea-convergence-agentic-prototype",
  use_case: "forge-convergence-demo",
  objective: "Forge the convergence demo into a market-ready SaaS frontend.",
  required_market_workstreams: ["frontend-brand-experience"]
};
const telos = "Make the convergence demo market-ready.";

// ---------------------------------------------------------------------------
// Case 1: full loop converges — build ready + gate pass, artifacts on disk.
// ---------------------------------------------------------------------------
{
  const root = mkdtempSync(path.join(os.tmpdir(), "saas-forge-"));
  const result = await forge({ projectRoot: root, telos, dossierMeta });

  assert.equal(result.converged, true, `forge must converge; cycles=${JSON.stringify(result.cycles)}`);
  assert.equal(result.cycles[0].built, true, "Case 1: build settled all nodes (ledger ready)");
  assert.equal(result.verdict.gate_status, "pass", "Case 1: market gate passed");
  assert.deepEqual(result.verdict.blockers, [], "Case 1: no gate blockers");

  // Artifacts the generator wrote and the gate re-verified, on disk:
  const css = path.join(root, "web/site/style.css");
  assert.ok(existsSync(css) && readFileSync(css, "utf8").includes("#69e7ff"),
    "Case 1: style.css generated with brand token");
  const arch = path.join(root, "docs/ARCHITECTURE.md");
  assert.ok(existsSync(arch) && readFileSync(arch, "utf8").includes("Vite"),
    "Case 1: ARCHITECTURE.md references the researched UI stack (Vite)");
  for (const f of ["web/index.html", "web/VERIFICATION.md",
                   "docs/verification/s03-dynamics-discriminator.png",
                   "docs/verification/s04-scorecard.png"]) {
    const p = path.join(root, f);
    assert.ok(existsSync(p) && statSync(p).size > 0, `Case 1: generated ${f} is present and non-empty`);
  }
  console.log("Case 1 OK: research -> generate -> verify -> signed ledger -> market gate PASS");
}

// ---------------------------------------------------------------------------
// Case 2: fail-closed — a frontend missing the brand token fails its node test,
//         never settles, so the loop does NOT converge (the gate is real).
// ---------------------------------------------------------------------------
{
  const root = mkdtempSync(path.join(os.tmpdir(), "saas-forge-broken-"));
  const brokenGenerators = (arch) => {
    const base = makeDemoGenerators(arch);
    return async (injected) => {
      const files = await base(injected);
      if (injected.id === "frontend-brand-experience") {
        files["web/site/style.css"] = files["web/site/style.css"].replace("#69e7ff", "#ffffff");
      }
      return files;
    };
  };

  const result = await forge({ projectRoot: root, telos, dossierMeta, makeGenerators: brokenGenerators, maxCycles: 1 });
  assert.equal(result.converged, false, "Case 2: broken frontend must not converge");
  assert.equal(result.cycles[0].built, false, "Case 2: frontend node fails its test and does not settle");
  console.log("Case 2 OK: fail-closed — dropped brand token blocked at the verify handshake");
}

console.log("saas-forge: all tests passed");
