import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { servingPattern, servingContext } from "../patterns/serving.mjs";

const dossierMeta = { build_id: "serving-e2e", idea_id: "serving", use_case: "serving", objective: "Forge a serving layer with guardrails" };

// Happy path: all 8 workstreams converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-serving-"));
  const result = await forge({ pattern: servingPattern, ctx: servingContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.converged), "every component converges");
}

// Fail-closed #1: break `input-guardrail` so its selftest asserts a denylisted input is accepted -> node test fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-serving-fc1-"));
  const broken = {
    ...servingPattern,
    workstreams: servingPattern.workstreams.map((w) => w.id !== "input-guardrail" ? w : {
      ...w,
      render: () => ({ "serving/guard-in.mjs": 'import assert from "node:assert/strict";\nexport function checkInput(){ return { allow: true }; }\nif (process.argv.includes("--selftest")) { assert.equal(checkInput({ body: { q: "<script>x" } }).allow, false, "WRONG: denylisted should be rejected"); }\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: servingContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken input-guardrail must NOT converge");
}

// Fail-closed #2: drift the design (omit a component from DESIGN.md) -> design verify fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-serving-fc2-"));
  const build = servingPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = servingPattern.workstreams.find((w) => w.id === "design");
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
  const result = await forge({ pattern: { ...servingPattern, workstreams: [...build, brokenDesign] }, ctx: servingContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a drifted design must NOT converge");
}

console.log("test-serving-forge.mjs OK");
