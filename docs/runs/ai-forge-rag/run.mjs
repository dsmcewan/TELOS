#!/usr/bin/env node
// run.mjs — a KEYLESS, reproducible end-to-end evidence run of the ai-forge
// RAG pattern: pattern validation -> plan -> generate -> verify ->
// per-workstream breakout (verdict-on-facts) -> market gate.
//
// Real gate (validateRecords), real Ed25519 ledger, real merkle-dag.
// No network, no secrets, no timestamps — deterministic and CI-safe.
//
//   node docs/runs/ai-forge-rag/run.mjs
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forge } from "../../../ai-forge/forge.mjs";
import { ragPattern, ragContext } from "../../../ai-forge/patterns/rag.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// Throwaway temp workspace: no absolute paths committed.
const projectRoot = mkdtempSync(path.join(os.tmpdir(), "telos-ai-forge-rag-"));
mkdirSync(path.join(projectRoot, ".telos"), { recursive: true });

const dossierMeta = {
  build_id: "ai-forge-rag-evidence",
  idea_id:  "ai-forge-rag-evidence",
  use_case: "AI architecture: RAG pattern evidence run",
  objective: "Prove the RAG pattern converges over the real gate + Ed25519 ledger + merkle-dag."
};

const ctx = ragContext();

const result = await forge({
  pattern:     ragPattern,
  ctx,
  projectRoot,
  dossierMeta
});

// Sanitized summary — no absolute paths, no machine-specific data, no timestamps.
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

writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
console.log(`\nconverged=${summary.converged} merge_status=${summary.merge_status} gate_status=${summary.gate_status}`);
process.exit(result.converged ? 0 : 1);
