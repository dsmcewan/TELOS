#!/usr/bin/env node
// run.mjs — a KEYLESS, reproducible end-to-end evidence run of the ai-forge
// TELOS pattern: pattern validation -> plan -> generate -> verify ->
// per-workstream breakout (verdict-on-facts) -> market gate.
//
// 7 spine-wrapping components (sign · plan · provenance · gate · council ·
// ledger · breakout) each with a genuine executable selftest, plus the generic
// design workstream (8 workstreams total). ai-forge forges a TELOS-like trust
// system — the self-similar capstone of the catalog.
//
// Real gate (validateRecords), real Ed25519 ledger, real merkle-dag.
// No network, no secrets, no timestamps — deterministic and CI-safe.
//
//   node docs/runs/ai-forge-telos/run.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forge } from "../../../ai-forge/forge.mjs";
import { telosPattern, telosContext } from "../../../ai-forge/patterns/telos.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// Throwaway temp workspace: no absolute paths committed.
const projectRoot = mkdtempSync(path.join(os.tmpdir(), "telos-ai-forge-telos-"));
mkdirSync(path.join(projectRoot, ".telos"), { recursive: true });

const dossierMeta = {
  build_id: "ai-forge-telos-evidence",
  idea_id:  "ai-forge-telos-evidence",
  use_case: "AI architecture: TELOS pattern evidence run",
  objective: "Prove the TELOS pattern converges over the real gate + Ed25519 ledger + merkle-dag."
};

const ctx = telosContext();

const result = await forge({
  pattern:     telosPattern,
  ctx,
  projectRoot,
  dossierMeta
});

// Sanitized summary — no absolute paths, no machine-specific data, no timestamps.
// CRITICAL: strip any field that could carry spineRoot (an absolute file:// URL)
// or the temp projectRoot. Only scalar convergence data + workstream ids survive.
const summary = {
  converged:    result.converged,
  merge_status: result.converged ? "ready" : "not-ready",
  gate_status:  result.verdict   ? result.verdict.gate_status : "not-run",
  workstreams:  (result.records || []).map((r) => ({
    id:          r.workstream,
    converged:   r.converged,
    finalStatus: r.finalStatus
  })),
  generated_at_note: "deterministic; no timestamps"
};

// Verify sanitization: ensure no absolute paths snuck through.
const raw = JSON.stringify(summary);
if (raw.includes("file://") || /[A-Za-z]:[\\/]/.test(raw) || raw.includes("/home/") || raw.includes("/Users/")) {
  throw new Error("SANITIZATION FAILURE: absolute path detected in summary — do not commit.");
}

writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nconverged=${summary.converged} merge_status=${summary.merge_status} gate_status=${summary.gate_status}`);
process.exit(result.converged ? 0 : 1);
