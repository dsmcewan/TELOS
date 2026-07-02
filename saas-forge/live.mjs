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

import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnMcpClient } from "../breakout/mcp_client.mjs";
import { createSeatRouter } from "../breakout/seat_router.mjs";
import { makeCouncilBreakout, makeGeminiReferee } from "../breakout/breakout.mjs";
import { createFightMemory } from "../breakout/fight_memory.mjs";
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

// Seats under blocker pressure wrap the file map in prose and code fences
// despite "Return ONLY a JSON object" — so parse generously: fenced blocks
// first, then the greedy brace span, then progressive brace-start candidates.
// (Postel at the parse layer only; what lands on disk is still verified.)
function parseFileMap(text) {
  if (typeof text !== "string") return null;
  const tryParse = (s) => {
    try {
      const obj = JSON.parse(s.trim());
      return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  };
  for (const m of text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) {
    const obj = tryParse(m[1]);
    if (obj) return obj;
  }
  const greedy = text.match(/\{[\s\S]*\}/);
  if (greedy) {
    const obj = tryParse(greedy[0]);
    if (obj) return obj;
  }
  // Prose before the payload poisons the greedy span: retry from each later
  // "{" to the final "}" (bounded — the payload is near the front of the list).
  const end = text.lastIndexOf("}");
  let i = text.indexOf("{");
  for (let attempts = 0; i !== -1 && i < end && attempts < 50; attempts++) {
    const obj = tryParse(text.slice(i, end + 1));
    if (obj) return obj;
    i = text.indexOf("{", i + 1);
  }
  return null;
}

// The node's deterministic acceptance checks, restated for the builder seat.
// Telling the seat its contract is not trust leakage — the same specs are
// re-verified literally on disk by check-node.mjs and again by the breakout,
// so a seat that ignores them still fail-closes.
function acceptanceNotes(test) {
  try {
    const specs = JSON.parse(test?.args?.[1] || "[]");
    const byPath = {};
    for (const s of specs) {
      if (s?.type === "file_contains" && typeof s.needle === "string") {
        (byPath[s.path] ||= []).push(s.needle);
      }
    }
    const paths = Object.entries(byPath);
    if (paths.length === 0) return "";
    return "\nACCEPTANCE CHECKS (re-verified literally on disk; the build fails without them):\n" +
      paths.map(([p, needles]) => `- ${p} must contain each of these exact strings: ${JSON.stringify(needles)}`).join("\n") +
      "\n";
  } catch {
    return "";
  }
}

// Seat-backed generation: each team's builder seat authors its files. Binary
// assets the text seat can't emit (screenshots) get a non-empty placeholder so
// the harness — not the model — owns rendering.
export function liveGenerators({ callTool }) {
  return (arch) => async (injected) => {
    const ws = workstreamById(injected.id);
    const model = (ws && ws.signer) || "claude";
    // Researched stack guidance (offline KB or live Context7) — the builder
    // sees what the research phase learned, not just the bare requirements.
    const guidance = Array.isArray(arch?.stack) && arch.stack.length
      ? `\nRESEARCHED STACK (ground the artifact in these):\n` +
        arch.stack.map((s) =>
          `- ${s.domain}: ${s.library}${s.libraryId ? ` (${s.libraryId})` : ""} — ${String(s.summary || "").slice(0, 240).replace(/\s+/g, " ")}`).join("\n") +
        "\n"
      : "";
    const prompt =
      `You are the builder seat for the "${injected.id}" team of a SaaS product.\n` +
      `Requirements: ${injected.requirements}\n` +
      guidance +
      acceptanceNotes(injected.test) +
      `\nProduce the EXACT files listed. These are the ONLY files that will exist on disk: ` +
      `do not read, import, or reference any other path — embed any data, fixtures, or configuration inline. ` +
      `A script that will be executed must run standalone from the project root, exit 0 on success, and be ` +
      `READ-ONLY: it must never create or modify files — artifacts are hash-signed, so a script that writes ` +
      `drifts the signed tree and the gate blocks the build. ` +
      `Return ONLY a JSON object mapping each path to its full file contents as a string. ` +
      `Binary assets (.png) may be omitted.\n` +
      `TEAM:${injected.id}\nFILES:${JSON.stringify(injected.files)}\n`;
    const text = await callTool(`${model}_ask`, {
      system: `You build production-grade ${injected.id} artifacts for a market-ready SaaS.`,
      prompt,
      // File authoring needs far more than ai-peer-mcp's 2000-token default —
      // a truncated JSON file map parses to null and fails the whole team.
      max_tokens: 16000
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

// Council adversaries layered on the fact checks. A blocker survives if ANY
// adversary raises it OR a fact check fails — so the model can never talk a
// team past missing evidence. By default the grok adversary is joined by an
// agy co-adversary (`agy_ask`, served by the Antigravity seat backend through
// the seat router); pass `coChallengers: []` to disable it — e.g. on the
// legacy single ai-peer-mcp transport, which has no agy_ask tool.
export function makeCouncilFactFns({
  callTool, team, reviewer, challengerTool, challengerModel,
  coChallengers = [{ tool: "agy_ask" }],
  referee = "gemini",
  memory = createFightMemory()
}) {
  // Scope discipline: a bout can only change the declared files, so blockers
  // demanding NEW files, external systems, or live operational evidence are
  // unresolvable by construction and just feed loops. Adversaries stay harsh —
  // about what the artifact text can actually fix.
  const SCOPED_CHALLENGER =
    "You are the adversarial reviewer. Be skeptical, concrete, and source-demanding — about the artifact itself. " +
    "The file manifest is FIXED: raise only blockers resolvable by EDITING THE FILES SHOWN IN EVIDENCE. " +
    "Demands for additional files, live infrastructure evidence, command outputs, or external systems are OUT OF " +
    "SCOPE for this bout and must not be raised as blockers. " +
    "THE CONTRACT BOUNDS YOU: a valid blocker cites either a specific violation of the stated CONTRACT " +
    "(the requirements shown with the evidence) or a factual defect in the artifact (internal contradiction, " +
    "broken example, claim the artifact itself does not fulfill). Aesthetic preferences, completeness wishes, " +
    "and new demands beyond the contract are NOT blockers — a bout that satisfies its contract ends.";
  const council = makeCouncilBreakout({
    callTool, team, reviewer, challengerTool, challengerModel, memory,
    challengerSystem: SCOPED_CHALLENGER
  });
  const extras = (coChallengers || []).map((c) =>
    makeCouncilBreakout({ callTool, team, reviewer, challengerTool: c.tool, challengerModel: c.model, challengerSystem: c.system || SCOPED_CHALLENGER, memory }));
  // The gemini referee reviews each bout's fight log and ends adversarial
  // loops (recycled solutions/results) — see makeGeminiReferee. Pass
  // referee: null to disable (e.g. on the legacy transport with no gemini_ask).
  const refereeFn = referee === "gemini" ? makeGeminiReferee({ callTool })
    : (typeof referee === "function" ? referee : undefined);
  return ({ workstream, checks, baseDir, contract }) => {
    const facts = factBreakout({ checks, baseDir });
    // The bout argues about the ARTIFACT against its CONTRACT, so every round
    // reads both: adversaries attack real content for contract violations and
    // proposers can cite real lines — without this, text seats stalemate
    // demanding evidence nobody can produce, and adversaries judge against an
    // unbounded standard of taste instead of the spec.
    const contractHeader = contract
      ? `=== CONTRACT (the requirements this artifact must meet — blockers must cite violations of THIS) ===\n${String(contract).slice(0, 8000)}\n\n`
      : "";
    const diskEvidence = () => {
      const paths = [...new Set(checks.map((c) => c.path).filter(Boolean))];
      return contractHeader + (paths.map((rel) => {
        try {
          const full = readFileSync(path.join(baseDir, rel), "utf8");
          // Annotate any excerpting explicitly, and show HEAD + TAIL — clipping
          // only the head hides late sections and adversaries (correctly)
          // block on content they cannot verify.
          return full.length > 60000
            ? `--- ${rel} [EXCERPT: first 45000 + last 12000 of ${full.length} chars — the file on disk is complete] ---\n${full.slice(0, 45000)}\n\n[... ${full.length - 57000} chars omitted (middle) ...]\n\n${full.slice(-12000)}`
            : `--- ${rel} (complete, ${full.length} chars) ---\n${full}`;
        } catch {
          return `--- ${rel} --- (missing on disk)`;
        }
      }).join("\n\n") || "(no artifact files declared)");
    };
    return {
      challenge: async (state) => {
        const f = facts.challenge();
        const evidence = diskEvidence();
        const councils = await Promise.all(
          [council, ...extras].map((c) => c.challenge({ ...state, evidence, workstream })));
        const blockers = [...new Set([
          ...(f.blockers || []),
          ...councils.flatMap((g) => (g && g.blockers) || [])
        ])];
        return { blockers };
      },
      revise: (state, blockers) => council.revise({ ...state, evidence: diskEvidence(), workstream }, blockers),
      ...(refereeFn ? { referee: refereeFn } : {}),
      // Recursion: the same durable fight memory records defeats (rejected
      // proposals, fixes re-broken on re-attack) and feeds the proposers'
      // DEFEATED SOLUTIONS log — across rounds, cycles, and runs.
      ...(memory ? { memory } : {})
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
