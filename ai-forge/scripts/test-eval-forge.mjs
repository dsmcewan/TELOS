import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { evalPattern, evalContext } from "../patterns/eval.mjs";

const dossierMeta = { build_id: "eval-e2e", idea_id: "eval", use_case: "eval", objective: "Forge an eval harness" };

// Happy path: all 8 workstreams converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-eval-"));
  const result = await forge({ pattern: evalPattern, ctx: evalContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.converged), "every component converges");
}

// Fail-closed #1: break `scorecard` so its selftest asserts a tampered card verifies -> node test fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-eval-fc1-"));
  const broken = {
    ...evalPattern,
    workstreams: evalPattern.workstreams.map((w) => w.id !== "scorecard" ? w : {
      ...w,
      render: () => ({ "eval/scorecard.mjs": 'import assert from "node:assert/strict";\nexport function verifyScorecard(){ return { ok: false }; }\nif (process.argv.includes("--selftest")) { assert.equal(verifyScorecard().ok, true, "WRONG: tampered card should not verify"); }\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: evalContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken scorecard component must NOT converge");
}

// Fail-closed #2: drift the design (omit a component from DESIGN.md) -> design verify fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-eval-fc2-"));
  const build = evalPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = evalPattern.workstreams.find((w) => w.id === "design");
  const brokenDesign = {
    ...realDesign,
    render: (ctx) => {
      const out = realDesign.render(ctx);
      const md = out["docs/DESIGN.md"];
      const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]).slice(1);
      out["docs/DESIGN.md"] = md.replace(/```json\s*[\s\S]*?```/, "```json\n" + JSON.stringify(block, null, 2) + "\n```");
      return out;
    }
  };
  const result = await forge({ pattern: { ...evalPattern, workstreams: [...build, brokenDesign] }, ctx: evalContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a drifted design must NOT converge");
}

console.log("test-eval-forge.mjs OK");
