import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forge } from "../../../ai-forge/forge.mjs";
import { multiagentPattern, multiagentContext } from "../../../ai-forge/patterns/multiagent.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-run-"));
mkdirSync(path.join(projectRoot, ".telos"), { recursive: true });

const dossierMeta = {
  build_id: "ai-forge-multiagent-evidence",
  idea_id: "ai-forge-multiagent-evidence",
  use_case: "AI architecture: multi-agent pattern evidence run",
  objective: "Prove the multi-agent pattern converges over the forge gate."
};

const result = await forge({ pattern: multiagentPattern, ctx: multiagentContext(), projectRoot, dossierMeta });

// Sanitized summary — mirrors docs/runs/ai-forge-telos/run.mjs exactly.
const summary = {
  converged: result.converged,
  merge_status: result.converged ? "ready" : "not-ready",
  gate_status: result.verdict ? result.verdict.gate_status : "not-run",
  workstreams: (result.records || []).map((r) => ({ id: r.workstream, converged: r.converged, finalStatus: r.finalStatus })),
  generated_at_note: "deterministic; no timestamps"
};
const raw = JSON.stringify(summary);
if (raw.includes("file://") || /[A-Za-z]:[\\/]/.test(raw) || raw.includes("/home/") || raw.includes("/Users/")) {
  throw new Error("SANITIZATION FAILURE: absolute path detected in summary — do not commit.");
}
writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`multiagent run: converged=${summary.converged} gate_status=${summary.gate_status} workstreams=${summary.workstreams.length}`);
process.exit(result.converged ? 0 : 1);
