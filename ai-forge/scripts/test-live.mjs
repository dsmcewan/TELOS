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
//   4. Approval seats: the council runs for REAL — agy via agy_checkpoint,
//                      claude/codex via <model>_ask (prompt carries "approval
//                      packet"). Each returns a packet with provenance so the
//                      verdict is distinguishable from the synthetic fallback.
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

// Regression guard for the arg-shape bug: runForgeLive must invoke the async
// council with { dossierMeta } so the REAL council runs. If it regresses to a
// bare dossierMeta, councilApprovals throws and runForgeLive silently substitutes
// syntheticApprovals — which carry NO provenance. The stub's council packets do,
// so require real provenance to reach the gate (only observable once the build
// converges and the market gate runs).
assert.equal(result.converged, true,
  "live path must converge (stubbed seats + fact breakouts) so the council-fed gate runs");
assert.ok(result.verdict && result.verdict.gate_status === "pass",
  `market gate must pass on real council approvals; got ${JSON.stringify(result.verdict && result.verdict.gate_status)}`);
const provByModel = new Map((result.verdict.provenance || []).map((p) => [p.model, p]));
for (const model of ["claude", "agy", "codex"]) {
  const pv = provByModel.get(model);
  assert.ok(pv && typeof pv.response_id === "string" && pv.response_id.length > 0,
    `${model} approval must carry real council provenance, not the synthetic fallback; got ${JSON.stringify(pv)}`);
}

// --- signed mode: converge THROUGH the hardened signature+provenance gate ---
// All four model signers used in the RAG pattern need secrets in signed mode:
// the three required approval seats (claude/agy/codex) AND grok (guardrails
// workstream signer), because the gate calls enforceSignedPacketAuth on every
// market packet — not just the required approval trio.
process.env.TELOS_SECRET_CLAUDE = "test-claude";
process.env.TELOS_SECRET_AGY = "test-agy";
process.env.TELOS_SECRET_CODEX = "test-codex";
process.env.TELOS_SECRET_GROK = "test-grok";
{
  const signedRoot = mkdtempSync(path.join(os.tmpdir(), "ai-forge-signed-"));
  const signedResult = await runForgeLive({
    projectRoot: signedRoot, telos: ctx.telos, dossierMeta,
    embed: stubEmbed, vectorStore: stubVectorStore, callTool, signed: true
  });
  assert.equal(signedResult.converged, true,
    `signed-mode live run must converge through the hardened gate; cycles=${JSON.stringify(signedResult.cycles)}`);
  assert.equal(signedResult.verdict.gate_status, "pass", "signed-mode gate passes");
  assert.equal(signedResult.verdict.headline_checks.signing_enforced, true, "signing enforced in the verdict");
  assert.equal(signedResult.verdict.headline_checks.provenance_enforced, true, "provenance enforced in the verdict");
}
// negative: a missing required secret must fail closed in signed mode.
{
  delete process.env.TELOS_SECRET_CODEX;
  const failRoot = mkdtempSync(path.join(os.tmpdir(), "ai-forge-signed-fail-"));
  const failResult = await runForgeLive({
    projectRoot: failRoot, telos: ctx.telos, dossierMeta,
    embed: stubEmbed, vectorStore: stubVectorStore, callTool, signed: true
  });
  assert.equal(failResult.converged, false, "signed mode without a required secret must not converge");
  const blockers = (failResult.verdict && failResult.verdict.blockers) || [];
  assert.ok(blockers.some((b) => /no secret to verify codex|signature invalid/i.test(b)),
    `expected a fail-closed signature blocker; got ${JSON.stringify(blockers)}`);
  process.env.TELOS_SECRET_CODEX = "test-codex";
}
delete process.env.TELOS_SECRET_CLAUDE;
delete process.env.TELOS_SECRET_AGY;
delete process.env.TELOS_SECRET_CODEX;
delete process.env.TELOS_SECRET_GROK;

console.log(
  `test-live.mjs OK: live path executed — ` +
  `cycles=${result.cycles.length}, converged=${result.converged}, ` +
  `gate=${result.verdict ? result.verdict.gate_status : "not-run"} ` +
  `(stubbed transport, keyless)`
);
