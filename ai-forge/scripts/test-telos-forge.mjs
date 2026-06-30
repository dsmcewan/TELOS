import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { telosPattern, telosContext } from "../patterns/telos.mjs";

const dossierMeta = { build_id: "telos-e2e", idea_id: "telos", use_case: "trust-system", objective: "Forge a TELOS-like trust system" };

// Happy path: all 8 workstreams (7 components wrapping the real spine + design) converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-telos-"));
  const result = await forge({ pattern: telosPattern, ctx: telosContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.converged), "every component converges");
}

// Fail-closed #1: break the `sign` component's selftest so its node test fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-telos-fc1-"));
  const broken = {
    ...telosPattern,
    workstreams: telosPattern.workstreams.map((w) => w.id !== "sign" ? w : {
      ...w,
      // selftest that asserts a TAMPERED packet verifies (false) -> assertion throws -> node test fails
      render: () => ({ "telos/sign.mjs": 'import assert from "node:assert/strict";\nimport { signPacket, verifyPacket } from "' + telosContext().spineRoot + 'build-gate/sign.mjs";\nconst s = signPacket({ model: "claude" }, "k");\nassert.equal(verifyPacket({ ...s, model: "x" }, "k").ok, true, "WRONG: tamper should not verify");\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: telosContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken sign component must NOT converge");
}

// Fail-closed #2: drift the design (omit a component from DESIGN.md) -> design verify fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-telos-fc2-"));
  const build = telosPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = telosPattern.workstreams.find((w) => w.id === "design");
  const brokenDesign = {
    ...realDesign,
    render: (ctx) => {
      const out = realDesign.render(ctx);
      const md = out["docs/DESIGN.md"];
      const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]).slice(1); // drop one component
      out["docs/DESIGN.md"] = md.replace(/```json\s*[\s\S]*?```/, "```json\n" + JSON.stringify(block, null, 2) + "\n```");
      return out;
    }
  };
  const result = await forge({ pattern: { ...telosPattern, workstreams: [...build, brokenDesign] }, ctx: telosContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a drifted design must NOT converge");
}

console.log("test-telos-forge.mjs OK");
