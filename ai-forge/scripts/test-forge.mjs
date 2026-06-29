// test-forge.mjs — TEMPORARY integration test for forge.mjs (Task 5).
// Task 7 replaces this with a real RAG pattern fixture. For now: a 2-workstream
// fixture pattern (each render writes the exact token its check asserts) drives
// forge() through os.tmpdir(), asserting converged===true / gate passes.
// Fail-closed: a second fixture with a workstream that writes the WRONG token
// asserts converged===false.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtempSync } from "node:fs";
import { forge } from "../forge.mjs";

// ─── shared dossier metadata ──────────────────────────────────────────────────

const BASE_DOSSIER = {
  build_id: "forge-test-01",
  idea_id: "idea-forge-01",
  use_case: "forge-fixture",
  objective: "Integration test for the ai-forge driver."
};

// ─── Test 1: 2 converging workstreams → converged === true ───────────────────
// Each render() writes its file with the exact token the check asserts, so the
// node test (check-node.mjs) passes, the breakout converges, and the market gate
// certifies the project.
{
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "aiforge-pass-"));

  const pattern = {
    id: "fixture-pass",
    workstreams: [
      {
        id: "ws-alpha",
        signer: "claude",
        lens: "claude",
        files: ["artifacts/alpha.txt"],
        requirements: "produce alpha artifact",
        render: () => ({ "artifacts/alpha.txt": "ALPHA_TOKEN_OK" }),
        checks: () => [{ type: "file_contains", path: "artifacts/alpha.txt", needle: "ALPHA_TOKEN_OK" }],
        isUi: false,
        findingsKey: "architecture_findings",
        finding: "Alpha RAG stage generates deterministic artifacts."
      },
      {
        id: "ws-beta",
        signer: "codex",
        lens: "codex",
        files: ["artifacts/beta.txt"],
        requirements: "produce beta artifact",
        render: () => ({ "artifacts/beta.txt": "BETA_TOKEN_OK" }),
        checks: () => [{ type: "file_contains", path: "artifacts/beta.txt", needle: "BETA_TOKEN_OK" }],
        isUi: false,
        findingsKey: "backend_schema_findings",
        finding: "Beta RAG stage generates deterministic artifacts."
      }
    ]
  };

  const result = await forge({ pattern, ctx: {}, projectRoot, dossierMeta: BASE_DOSSIER });

  assert.equal(
    result.converged,
    true,
    `Expected converged=true; cycle info: ${JSON.stringify(result.cycles)}`
  );
  assert.equal(
    result.verdict?.gate_status,
    "pass",
    `Expected gate_status=pass; blockers: ${JSON.stringify(result.verdict?.blockers)}`
  );
  assert.ok(
    Array.isArray(result.records) && result.records.length === 2,
    "Expected 2 breakout records"
  );
  assert.ok(
    result.records.every((r) => r.converged),
    "Every breakout record must be converged"
  );

  console.log("Test 1 PASS: 2-workstream fixture → converged=true, gate_status=pass");
}

// ─── Test 2: workstream writes WRONG token → converged === false (fail-closed) ──
// ws-gamma renders correctly; ws-delta renders "WRONG_TOKEN" but its check
// asserts "DELTA_TOKEN_OK". The node test (check-node.mjs) exits non-zero;
// runBuild does not settle that node; merge_status !== "ready"; forge returns
// converged=false after exhausting maxCycles=1 (short for the test).
{
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "aiforge-fail-"));

  const pattern = {
    id: "fixture-fail",
    workstreams: [
      {
        id: "ws-gamma",
        signer: "claude",
        lens: "claude",
        files: ["artifacts/gamma.txt"],
        requirements: "produce gamma artifact",
        render: () => ({ "artifacts/gamma.txt": "GAMMA_TOKEN_OK" }),
        checks: () => [{ type: "file_contains", path: "artifacts/gamma.txt", needle: "GAMMA_TOKEN_OK" }],
        isUi: false,
        findingsKey: "architecture_findings",
        finding: "Gamma workstream."
      },
      {
        id: "ws-delta",
        signer: "codex",
        lens: "codex",
        files: ["artifacts/delta.txt"],
        requirements: "produce delta artifact",
        // Deliberately writes the wrong token so the check fails.
        render: () => ({ "artifacts/delta.txt": "WRONG_TOKEN" }),
        checks: () => [{ type: "file_contains", path: "artifacts/delta.txt", needle: "DELTA_TOKEN_OK" }],
        isUi: false,
        findingsKey: "backend_schema_findings",
        finding: "Delta workstream."
      }
    ]
  };

  const result = await forge({
    pattern,
    ctx: {},
    projectRoot,
    dossierMeta: { ...BASE_DOSSIER, build_id: "forge-test-02", idea_id: "idea-forge-02" },
    maxCycles: 1
  });

  assert.equal(
    result.converged,
    false,
    "Expected converged=false when a workstream writes the wrong token"
  );

  console.log("Test 2 PASS: fail-closed — wrong render token → converged=false");
}

console.log("test-forge.mjs OK");
