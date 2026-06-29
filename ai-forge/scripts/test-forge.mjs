// test-forge.mjs — Real RAG end-to-end + fail-closed test (Task 7).
// Replaces the Task 5 fixture-based temporary test with the actual ragPattern.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { ragPattern, ragContext } from "../patterns/rag.mjs";

const dossierMeta = { build_id: "rag-e2e", idea_id: "rag", use_case: "ai-architecture", objective: "Forge a RAG architecture" };

// ─── Happy path: all 7 workstreams generate, breakout-survive, gate passes ───
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-rag-"));
  const result = await forge({ pattern: ragPattern, ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 7);
  assert.ok(result.records.every(r => r.converged));
  console.log("Happy path PASS: converged=true, gate_status=pass, 7 records all converged");
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

console.log("test-forge.mjs OK");
