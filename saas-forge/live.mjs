// live.mjs — wire the forge to live models through the ai-peer-mcp tools.
//
// Two injected boundaries become real here:
//   1. generation  — each team's artifacts are authored by its model seat
//      (`<model>_ask`) instead of the deterministic demo renderers.
//   2. breakout    — each team's claim faces a grok adversary (makeCouncilBreakout)
//      ON TOP OF the on-disk fact checks: a team converges only when no grok
//      blocker survives AND every fact check holds. Verdict stays anchored to disk.
//
// The transport (`callTool`) is injected, so this module is testable with a stub
// and no API keys; live, runForgeLive routes seats through the seat registry
// (or a single ai-peer-mcp server when `serverPath` is given).

import { spawnMcpClient } from "../breakout/mcp_client.mjs";
import { createSeatRouter } from "../breakout/seat_router.mjs";
import { makeCouncilBreakout } from "../breakout/breakout.mjs";
import { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } from "../build-gate/council.mjs";
import { defaultSeatRegistry } from "../build-gate/seat-registry.mjs";
import { forge } from "./forge.mjs";
import { factBreakout } from "./breakouts.mjs";
import { workstreamById } from "./workstreams.mjs";

const APPROVAL_TS = "2026-06-28T00:00:00-04:00";
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

// Real council approvals: each REQUIRED seat (claude/agy/codex) authors its own
// approval packet through ai-peer-mcp, and runCouncil stamps it with the seat's
// REAL provenance (server response_id, or agy's local attestation) — never
// fabricated by the forge. A dissenting seat returns a non-approve decision and
// the gate fails closed; absent provenance => response_id:null => the gate blocks
// under signed mode. signerFor/secrets sign the packet when TELOS_SECRET_* is set.
export function councilApprovals({ callTool, models = {} }) {
  return async ({ dossierMeta }) => {
    const meta = {
      build_id: dossierMeta.build_id, use_case: dossierMeta.use_case,
      proposal_ref: "saas-forge-council", timestamp: APPROVAL_TS, docs_reviewed: []
    };
    const objective = dossierMeta.objective || "Approve the market-ready build for merge.";

    function promptFor(model) {
      if (model === "agy") {
        // Governance inputs derived from the dossier, not asserted (see
        // council.agyCheckpointArgs) — no hardcoded present==required rubber stamp.
        return { tool: "agy_checkpoint", args: agyCheckpointArgs(dossierMeta, "saas-forge") };
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
      const m = (obj && !obj.phase_gate_status) ? obj : (extractJsonObject(text) || {});
      const decision = VALID_DECISIONS.has(m.decision) ? m.decision : "advisory-note";
      const confidence = VALID_CONFIDENCE.has(m.confidence) ? m.confidence : "medium";
      return {
        build_id: meta.build_id, use_case: meta.use_case, model, role: "approver",
        docs_reviewed: meta.docs_reviewed, proposal_ref: meta.proposal_ref,
        decision, required_edits: Array.isArray(m.required_edits) ? m.required_edits : [],
        hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [],
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

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const isBinary = (rel) => /\.(png|jpe?g|gif|webp|ico)$/i.test(rel);

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

// Seat-backed generation: each team's builder seat authors its files. Binary
// assets the text seat can't emit (screenshots) get a non-empty placeholder so
// the harness — not the model — owns rendering.
export function liveGenerators({ callTool }) {
  return (arch) => async (injected) => {
    const ws = workstreamById(injected.id);
    const model = (ws && ws.signer) || "claude";
    const prompt =
      `You are the builder seat for the "${injected.id}" team of a SaaS product.\n` +
      `Requirements: ${injected.requirements}\n\n` +
      `Produce the EXACT files listed. Return ONLY a JSON object mapping each path ` +
      `to its full file contents as a string. Binary assets (.png) may be omitted.\n` +
      `TEAM:${injected.id}\nFILES:${JSON.stringify(injected.files)}\n`;
    const text = await callTool(`${model}_ask`, {
      system: `You build production-grade ${injected.id} artifacts for a market-ready SaaS.`,
      prompt
    });
    const produced = parseFileMap(text) || {};
    const out = {};
    for (const rel of injected.files) {
      if (typeof produced[rel] === "string") out[rel] = produced[rel];
      else if (isBinary(rel)) out[rel] = PNG_1x1;
      else throw new Error(`${injected.id}: seat did not return required file ${rel}`);
    }
    return out;
  };
}

// Council (grok adversary) layered on the fact checks. A blocker survives if the
// adversary raises it OR a fact check fails — so the model can never talk a team
// past missing evidence.
export function makeCouncilFactFns({ callTool, team, reviewer, challengerTool, challengerModel }) {
  const council = makeCouncilBreakout({ callTool, team, reviewer, challengerTool, challengerModel });
  return ({ workstream, checks, baseDir }) => {
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
 * Run the forge against live model seats and run the same forge loop with live
 * generation + council+fact breakouts. Requires API keys in the backends'
 * environment (claude/codex/grok).
 *
 * Transport resolution mirrors ai-forge/live.mjs: an injected `callTool` is used
 * directly; an explicit `serverPath` keeps the legacy single ai-peer-mcp spawn;
 * otherwise the seat router over the default seat registry routes each council
 * tool to its declared backend (fail-closed on unrouted tools).
 *
 * @param {object} opts
 *   signed default false; when true, gate runs under trust_mode: "signed"
 */
export async function runForgeLive({
  projectRoot, telos, dossierMeta, serverPath, docsFor,
  team, reviewer, callTool: injectedCallTool, maxCycles = 3, signed = false
}) {
  let callTool = injectedCallTool;
  let close = () => {};
  if (!callTool) {
    if (serverPath) {
      const spawned = spawnMcpClient({ serverPath });
      callTool = (name, args) => spawned.client.callTool(name, args);
      close = spawned.close;
    } else {
      const router = createSeatRouter(defaultSeatRegistry());
      callTool = (name, args) => router.callTool(name, args);
      close = () => router.close();
    }
  }
  try {
    return await forge({
      projectRoot, telos, dossierMeta, docsFor,
      makeGenerators: liveGenerators({ callTool }),
      makeBreakoutFns: makeCouncilFactFns({ callTool, team, reviewer }),
      makeApprovals: councilApprovals({ callTool }),
      maxCycles,
      signed
    });
  } finally {
    close();
  }
}
