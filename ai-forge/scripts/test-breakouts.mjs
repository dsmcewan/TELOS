import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPatternBreakouts } from "../breakouts.mjs";

const dir = mkdtempSync(path.join(os.tmpdir(), "aiforge-bk-"));
mkdirSync(path.join(dir, "rag"), { recursive: true });
writeFileSync(path.join(dir, "rag/a.txt"), "grounded #ok");

const pattern = { id: "p", workstreams: [
  { id: "good", signer: "codex", lens: "codex", files: ["rag/a.txt"], requirements: "r",
    render: () => ({}), checks: () => [{ type: "file_contains", path: "rag/a.txt", needle: "#ok" }],
    findingsKey: "k", finding: "f" },
  { id: "bad", signer: "grok", lens: "grok", files: ["rag/missing.txt"], requirements: "r",
    render: () => ({}), checks: () => [{ type: "file_exists", path: "rag/missing.txt" }],
    findingsKey: "k", finding: "f" }
]};

const records = await runPatternBreakouts({ pattern, ctx: { telos: "t" }, baseDir: dir });
const good = records.find((r) => r.workstream === "good");
const bad = records.find((r) => r.workstream === "bad");
assert.equal(good.converged, true, "present+matching evidence converges");
assert.equal(bad.converged, false, "missing artifact must NOT converge (fail-closed)");
assert.equal(good.lens, "codex");
assert.ok(Array.isArray(good.checks));
console.log("test-breakouts.mjs OK");
