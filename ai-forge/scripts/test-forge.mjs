// test-forge.mjs — Real RAG end-to-end + fail-closed test (Task 7 + Task 3).
// Replaces the Task 5 fixture-based temporary test with the actual ragPattern.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { ragPattern, ragContext } from "../patterns/rag.mjs";
import { makeDesignWorkstream } from "../workstreams/design.mjs";

const dossierMeta = { build_id: "rag-e2e", idea_id: "rag", use_case: "ai-architecture", objective: "Forge a RAG architecture" };

// ─── Happy path: all 7 workstreams generate, breakout-survive, gate passes ───
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-rag-"));
  const result = await forge({ pattern: ragPattern, ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every(r => r.converged));
  assert.ok(result.records.some(r => r.workstream === "design" && r.converged), "design workstream converges");
  console.log("Happy path PASS: converged=true, gate_status=pass, 8 records all converged");
}

// ─── Fail-closed: inject a broken generator for guardrails so its artifact
// lacks the required rule → its node test (Rule 3) and breakout fail → forge does not converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-rag-fc-"));
  const broken = { ...ragPattern, workstreams: ragPattern.workstreams.map(w =>
    w.id === "guardrails" ? { ...w, render: () => ({ "rag/serve.config.json": "{}", "rag/guardrails.mjs": "// empty — no rule" }) } : w) };
  const result = await forge({ pattern: broken, ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a guardrails artifact missing its rule must not converge");
  // Carry-forward: assert the MECHANISM — the build did not reach ready because
  // the guardrails node test (file_contains checks) failed, preventing ledger from settling.
  assert.notEqual(
    result.cycles[0].ledger_status,
    "ready",
    `Expected ledger_status !== "ready" when guardrails checks fail; got: ${result.cycles[0].ledger_status}`
  );
  console.log("Fail-closed PASS: converged=false, ledger_status=" + result.cycles[0].ledger_status + " (not ready)");
}

// ─── Fail-closed design sub-cases: perturb the component block; verify.mjs stays
// intact so the forge must detect the drift and NOT converge. ─────────────────
function ragWithBrokenDesign(mutateComponents) {
  const build = ragPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = makeDesignWorkstream(build);
  const brokenDesign = {
    ...realDesign,
    render: (ctx) => {
      const out = realDesign.render(ctx);
      const md = out["docs/DESIGN.md"];
      const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
      const mutated = JSON.stringify(mutateComponents(block), null, 2);
      out["docs/DESIGN.md"] = md.replace(/```json\s*[\s\S]*?```/, "```json\n" + mutated + "\n```");
      return out;
    }
  };
  return { ...ragPattern, workstreams: [...build, brokenDesign] };
}

const drifts = {
  "omit a component": (c) => c.slice(1),
  "phantom component": (c) => [...c, { workstream: "ghost", model: "codex", artifact: c[0].artifact, depends_on: [] }],
  // Strip deps from embed-index (index 1, depends_on:["ingestion"]); ops at c.length-1 has [] already.
  "wrong dep edge": (c) => c.map((x, i) => i === 1 ? { ...x, depends_on: [] } : x),
  "unrealized artifact": (c) => c.map((x, i) => i === 0 ? { ...x, artifact: "rag/NOPE.txt" } : x)
};
for (const [name, mut] of Object.entries(drifts)) {
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-design-fc-"));
  const result = await forge({ pattern: ragWithBrokenDesign(mut), ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, `design drift '${name}' must NOT converge`);
  console.log(`Fail-closed PASS [${name}]: converged=false`);
}

console.log("test-forge.mjs OK");
