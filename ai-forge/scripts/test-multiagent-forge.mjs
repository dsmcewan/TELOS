import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { multiagentPattern, multiagentContext } from "../patterns/multiagent.mjs";

const dossierMeta = { build_id: "multiagent-e2e", idea_id: "multiagent", use_case: "agents", objective: "Forge a multi-agent system" };

// Happy path: all 8 workstreams converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-"));
  const result = await forge({ pattern: multiagentPattern, ctx: multiagentContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.converged), "every component converges");
}

// Fail-closed #1: break `protocol` so its selftest asserts a malformed message is VALID -> node test fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-fc1-"));
  const broken = {
    ...multiagentPattern,
    workstreams: multiagentPattern.workstreams.map((w) => w.id !== "protocol" ? w : {
      ...w,
      render: () => ({ "agents/protocol.mjs": 'import assert from "node:assert/strict";\nexport function validate(){ return { ok: false }; }\nif (process.argv.includes("--selftest")) { assert.equal(validate({}).ok, true, "WRONG: malformed should not validate"); }\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: multiagentContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken protocol component must NOT converge");
}

// Fail-closed #2: drift the design (omit a component from DESIGN.md) -> design verify fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-fc2-"));
  const build = multiagentPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = multiagentPattern.workstreams.find((w) => w.id === "design");
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
  const result = await forge({ pattern: { ...multiagentPattern, workstreams: [...build, brokenDesign] }, ctx: multiagentContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a drifted design must NOT converge");
}

console.log("test-multiagent-forge.mjs OK");
