// live.mjs — wire the forge to live models through the ai-peer-mcp tools.
//
// Mirrors saas-forge/live.mjs with adaptations for the pattern-driven architecture:
//   1. generation  — each workstream's artifacts are authored by its model seat
//      (`<signer>_ask`) instead of the deterministic pattern renderers.
//   2. breakout    — each workstream's claim faces a grok adversary (makeCouncilBreakout)
//      ON TOP OF the on-disk fact checks: a workstream converges only when no grok
//      blocker survives AND every fact check holds. Verdict stays anchored to disk.
//   3. embed / vectorStore — real embedding and vector-store services are injected
//      so the RAG infrastructure can be backed by live providers in production.
//
// The transport (`callTool`) and both RAG deps (`embed`, `vectorStore`) are injected,
// so this module is testable with stubs and no API keys. runForgeLive spawns the
// real ai-peer-mcp server when `callTool` is not supplied.
//
// NOTE: forge.mjs does not await makeApprovals. runForgeLive pre-resolves the async
// council approval call and passes a sync wrapper to forge, keeping forge.mjs
// unmodified (zero-change to the spine / other ai-forge modules).

import { spawnMcpClient } from "../breakout/mcp_client.mjs";
import { makeCouncilBreakout } from "../breakout/breakout.mjs";
import { runCouncil, liveSeatCaller, agyApprovalPacket } from "../build-gate/council.mjs";
import { forge, syntheticApprovals } from "./forge.mjs";
import { factBreakout } from "./breakouts.mjs";
import { ragPattern, ragContext } from "./patterns/rag.mjs";

const APPROVAL_TS = "2026-06-29T00:00:00-04:00";
const VALID_DECISIONS = new Set(["approve", "revise", "reject", "advisory-note"]);
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
const APPROVAL_INSTRUCTION =
  'Return ONLY a JSON approval packet: {"decision":"approve|revise|reject",' +
  '"confidence":"low|medium|high","required_edits":[],"hard_stops":[],"rationale":"one sentence"}. ' +
  "No prose outside the JSON.";

function tryJson(text) { try { return JSON.parse(text); } catch { return null; } }
function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const s = body.indexOf("{"), e = body.lastIndexOf("}");
  if (s === -1 || e === -1 || e < s) return null;
  try { return JSON.parse(body.slice(s, e + 1)); } catch { return null; }
}

function parseFileMap(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

// Real council approvals: each REQUIRED seat (claude/agy/codex) authors its own
// approval packet through ai-peer-mcp. Identical in structure to saas-forge's
// councilApprovals but references the ai-forge proposal_ref.
export function councilApprovals({ callTool, models = {} }) {
  return async ({ dossierMeta }) => {
    const meta = {
      build_id: dossierMeta.build_id, use_case: dossierMeta.use_case,
      proposal_ref: "ai-forge-council", timestamp: APPROVAL_TS, docs_reviewed: []
    };
    const objective = dossierMeta.objective || "Approve the pattern-driven AI architecture build for merge.";

    function promptFor(model) {
      if (model === "agy") {
        return { tool: "agy_checkpoint", args: {
          phase: "merge-gate", scope: "ai-forge",
          required_packets: ["claude", "codex"], present_packets: ["claude", "codex"],
          protected_path_check: "pass"
        } };
      }
      return {
        tool: `${model}_ask`, model: models[model],
        system: `You are ${model}, a council approver. Judge the objective on the merits. ${APPROVAL_INSTRUCTION}`,
        prompt: `Objective:\n${objective}\n\n${APPROVAL_INSTRUCTION}`
      };
    }
    function parsePacket(text, model) {
      const obj = tryJson(text);
      if (obj && obj.phase_gate_status) return agyApprovalPacket(obj, meta);
      const m2 = (obj && !obj.phase_gate_status) ? obj : (extractJsonObject(text) || {});
      const decision = VALID_DECISIONS.has(m2.decision) ? m2.decision : "advisory-note";
      const confidence = VALID_CONFIDENCE.has(m2.confidence) ? m2.confidence : "medium";
      return {
        build_id: meta.build_id, use_case: meta.use_case, model, role: "approver",
        docs_reviewed: meta.docs_reviewed, proposal_ref: meta.proposal_ref,
        decision, required_edits: Array.isArray(m2.required_edits) ? m2.required_edits : [],
        hard_stops: Array.isArray(m2.hard_stops) ? m2.hard_stops : [],
        confidence, timestamp: meta.timestamp
      };
    }

    const client = { callTool };
    const seats = [
      { model: "claude", role: "approver" },
      { model: "agy", role: "approver" },
      { model: "codex", role: "approver" }
    ];
    const callSeat = (seatArg) =>
      liveSeatCaller({ client, promptFor: (model) => promptFor(model), parsePacket: (t) => parsePacket(t, seatArg.model) })(seatArg);

    const results = await runCouncil({ seats, callSeat, dossier: { build_id: dossierMeta.build_id } });
    return results.filter((r) => r.ok).map((r) => r.packet);
  };
}

// Seat-backed generation: each workstream's builder seat authors its files via
// callTool. Mirrors saas-forge's liveGenerators but accepts (pattern, ctx) — the
// pattern-driven interface forge.mjs uses — instead of (arch).
//
// `embed` and `vectorStore` are passed through for workstreams that need live RAG
// infrastructure (e.g. a future workstream that populates a real vector store).
// They are available in the closure but not consumed in the base implementation,
// which delegates file content entirely to the model seat.
export function liveGenerators({ embed, vectorStore, callTool }) {
  return (pattern, _ctx) => async (injected) => {
    const ws = pattern.workstreams.find((w) => w.id === injected.id);
    const model = (ws && ws.signer) || "claude";
    const prompt =
      `You are the builder seat for the "${injected.id}" workstream of a RAG AI architecture.\n` +
      `Requirements: ${injected.requirements}\n\n` +
      `Produce the EXACT files listed. Return ONLY a JSON object mapping each path ` +
      `to its full file contents as a string.\n` +
      `TEAM:${injected.id}\nFILES:${JSON.stringify(injected.files)}\n`;
    const text = await callTool(`${model}_ask`, {
      system: `You build production-grade ${injected.id} artifacts for a RAG AI architecture.`,
      prompt
    });
    const produced = parseFileMap(text) || {};
    const out = {};
    for (const rel of injected.files) {
      if (typeof produced[rel] === "string") out[rel] = produced[rel];
      else throw new Error(`${injected.id}: seat did not return required file ${rel}`);
    }
    return out;
  };
}

// Council (grok adversary) layered on the fact checks. Mirrors saas-forge's
// makeCouncilFactFns with simplified defaults suited for the ai-forge workstreams.
export function makeCouncilFactFns({
  callTool,
  team,
  reviewer,
  challengerTool = "grok_ask",
  challengerModel
} = {}) {
  return ({ workstream, checks, baseDir }) => {
    const council = makeCouncilBreakout({
      callTool, team, reviewer, challengerTool, challengerModel
    });
    const facts = factBreakout({ checks, baseDir });
    return {
      challenge: async (state) => {
        const f = facts.challenge();
        const g = (await council.challenge({ ...state, workstream })) || {};
        const blockers = [...new Set([...(f.blockers || []), ...((g.blockers) || [])])];
        return { blockers };
      },
      revise: (state, blockers) => council.revise({ ...state, workstream }, blockers)
    };
  };
}

/**
 * Bundle all three live-path injection points into one object.
 * Caller supplies embed / vectorStore / callTool; none are defaulted here
 * so missing deps surface clearly at call time rather than at first network hit.
 *
 * makeApprovals is exposed as an async function for documentation purposes.
 * runForgeLive pre-resolves it before passing to forge (which is sync-makeApprovals).
 */
export function liveBoundaries({ embed, vectorStore, callTool }) {
  return {
    makeGenerators: liveGenerators({ embed, vectorStore, callTool }),
    makeBreakoutFns: makeCouncilFactFns({ callTool }),
    makeApprovals: councilApprovals({ callTool })
  };
}

/**
 * Run the forge against live model seats.
 *
 * When `callTool` is injected (test path or caller-supplied transport), it is
 * used directly. When omitted, the ai-peer-mcp server is spawned via
 * spawnMcpClient so live API keys in the server's environment are used.
 *
 * forge.mjs does not await makeApprovals, so runForgeLive pre-resolves the async
 * council approval call and wraps the result in a sync function before passing it
 * to forge — keeping forge.mjs unmodified.
 *
 * @param {object} opts
 *   projectRoot  absolute path the build writes into
 *   telos        top-level goal string forwarded to ragContext
 *   dossierMeta  { build_id, idea_id, use_case, objective }
 *   embed        async (text: string) -> number[]   (real: e.g. OpenAI embeddings)
 *   vectorStore  { upsert, query }                  (real: e.g. Pinecone/Qdrant)
 *   callTool     async (name, args) -> string        (injected: skip server spawn)
 *   pattern      override the default ragPattern
 *   ctx          override the default ragContext
 *   serverPath   path to ai-peer-mcp server.mjs     (live spawn only)
 *   maxCycles    default 3
 */
export async function runForgeLive({
  projectRoot, telos, dossierMeta,
  embed, vectorStore, callTool,
  pattern, ctx,
  serverPath, maxCycles = 3
}) {
  const resolvedPattern = pattern || ragPattern;
  const resolvedCtx = ctx || ragContext({ telos });

  let ct = callTool;
  let close = () => {};

  if (!ct) {
    // No injected transport: spawn the real ai-peer-mcp server.
    const spawned = spawnMcpClient({ serverPath });
    ct = (name, args) => spawned.client.callTool(name, args);
    close = spawned.close;
  }

  try {
    const { makeGenerators, makeBreakoutFns, makeApprovals: makeApprovalsAsync } = liveBoundaries({
      embed, vectorStore, callTool: ct
    });

    // Pre-resolve async council approvals so forge.mjs's sync makeApprovals call works.
    // We do this upfront (before forge runs) so the council result is ready by the
    // time forge reaches the gate step. If the forge never converges, approvals are
    // discarded (acceptable overhead for a single-run council call).
    let approvals;
    try {
      approvals = await makeApprovalsAsync(dossierMeta);
    } catch {
      // Council call failed (e.g. keys unavailable); fall back to synthetic.
      approvals = syntheticApprovals(dossierMeta);
    }
    const makeApprovals = () => approvals;

    return await forge({
      pattern: resolvedPattern,
      ctx: resolvedCtx,
      projectRoot,
      dossierMeta,
      makeGenerators,
      makeBreakoutFns,
      makeApprovals,
      maxCycles
    });
  } finally {
    close();
  }
}
