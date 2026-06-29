#!/usr/bin/env node
// test-live.mjs — exercise the LIVE code path (seat-backed generation + council
// + fact breakout) with stubbed deps and NO API keys. Proves the wiring:
// the forge drives model seats to author each workstream's files via callTool,
// a grok adversary challenges on top of the fact checks, and the whole thing
// reaches a verdict. (Live, callTool is backed by the ai-peer-mcp server.)
//
// This is a WIRING test — asserts runForgeLive returns a result with a `cycles`
// array (the code path ran). Convergence is not required but will happen when the
// stub returns the pattern's own render output for each workstream.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runForgeLive } from "../live.mjs";
import { ragPattern, ragContext } from "../patterns/rag.mjs";

const ctx = ragContext();
const dossierMeta = {
  build_id: "ai-forge-live-test",
  idea_id: "rag",
  use_case: "ai-architecture",
  objective: "Wiring test: exercise the live path with stubbed transport."
};

// ─── Stub RAG deps (keyless, no network) ────────────────────────────────────

// Stub embed: deterministic 8-dim unit vector (first element = 1.0)
const stubEmbed = async (_text) => [1, 0, 0, 0, 0, 0, 0, 0];

// Stub vectorStore: in-memory key→value store
const stubVectorStore = (() => {
  const store = new Map();
  return {
    upsert: async (id, vec, meta) => { store.set(id, { vec, meta }); },
    query: async (_vec, topK = 3) =>
      [...store.values()].slice(0, topK).map((v) => ({ score: 0.9, ...v.meta }))
  };
})();

// ─── Stub callTool transport (deterministic, no API keys) ────────────────────
//
// Handles four call shapes:
//   1. Builder seat:   prompt contains `TEAM:<id>` — return the pattern's own
//                      render output so all on-disk fact checks pass (text-only;
//                      binary files like .png are omitted by the seat).
//   2. Grok adversary: prompt contains "Attack this claim" — return [] (no holes).
//   3. Member revise:  prompt contains "Team proposals" — return a no-op verdict.
//   4. Approval seats: handled by runForgeLive's graceful fallback to
//                      syntheticApprovals when the council call errors.
//
function makeStubCallTool(pattern, ragCtx) {
  return async (name, args) => {
    const p = (args && args.prompt) || "";

    // 1. Builder seat: author workstream files using the pattern's own renderer.
    const teamMatch = p.match(/TEAM:([\w-]+)/);
    if (teamMatch) {
      const ws = pattern.workstreams.find((w) => w.id === teamMatch[1]);
      if (!ws) return JSON.stringify({});
      const files = ws.render(ragCtx);
      const textOnly = {};
      for (const [k, v] of Object.entries(files)) {
        if (typeof v === "string") textOnly[k] = v;
      }
      return JSON.stringify(textOnly);
    }

    // 2. Grok adversary: no blockers — let the fact checks decide.
    if (p.includes("Attack this claim")) return "[]";

    // 3. Revise step: no-op verdict (no accepted fix needed when grok found no holes).
    if (p.includes("Team proposals")) {
      return JSON.stringify({ accepted: null, resolved: [], evidence: "" });
    }

    // 4. agy governance checkpoint (approval path).
    if (name === "agy_checkpoint") {
      return JSON.stringify({
        phase_gate_status: "advance",
        blocked_reasons: [],
        provenance: {
          model: "agy-checkpoint", source: "ai-peer-mcp",
          response_id: "agy-stub-live-1", attestation: "local-deterministic"
        }
      });
    }

    // 5. Chat approval seat (claude/codex).
    if (p.includes("approval packet")) {
      const model = String(name).replace(/_ask$/, "");
      return JSON.stringify({
        text: JSON.stringify({
          decision: "approve", confidence: "high",
          required_edits: [], hard_stops: [], rationale: "stub approve"
        }),
        provenance: { model, source: "ai-peer-mcp", response_id: `${model}-stub-live-1` }
      });
    }

    return "{}";
  };
}

// ─── Exercise the live path ──────────────────────────────────────────────────

const callTool = makeStubCallTool(ragPattern, ctx);
const root = mkdtempSync(path.join(os.tmpdir(), "ai-forge-live-"));

const result = await runForgeLive({
  projectRoot: root,
  telos: ctx.telos,
  dossierMeta,
  embed: stubEmbed,
  vectorStore: stubVectorStore,
  callTool   // injected → no server spawn
});

// ─── Wiring assertions ───────────────────────────────────────────────────────

assert.ok(result !== null && typeof result === "object",
  "runForgeLive must return a result object");
assert.ok(Array.isArray(result.cycles),
  `result must have a cycles array; got: ${JSON.stringify(result)}`);
assert.ok(result.cycles.length >= 1,
  "cycles array must have at least one entry (the forge ran at least one cycle)");

console.log(
  `test-live.mjs OK: live path executed — ` +
  `cycles=${result.cycles.length}, converged=${result.converged}, ` +
  `gate=${result.verdict ? result.verdict.gate_status : "not-run"} ` +
  `(stubbed transport, keyless)`
);
