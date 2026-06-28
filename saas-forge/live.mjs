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
// and no API keys; runForgeLive spawns the real ai-peer-mcp server.

import { spawnMcpClient } from "../breakout/mcp_client.mjs";
import { makeCouncilBreakout } from "../breakout/breakout.mjs";
import { forge } from "./forge.mjs";
import { factBreakout } from "./breakouts.mjs";
import { workstreamById } from "./workstreams.mjs";

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
 * Run the forge against live model seats. Spawns the ai-peer-mcp server, wires
 * `callTool`, and runs the same forge loop with live generation + council+fact
 * breakouts. Requires API keys in the server's environment (claude/codex/grok).
 */
export async function runForgeLive({
  projectRoot, telos, dossierMeta, serverPath, docsFor,
  team, reviewer, maxCycles = 3
}) {
  const { client, close } = spawnMcpClient({ serverPath });
  const callTool = (name, args) => client.callTool(name, args);
  try {
    return await forge({
      projectRoot, telos, dossierMeta, docsFor,
      makeGenerators: liveGenerators({ callTool }),
      makeBreakoutFns: makeCouncilFactFns({ callTool, team, reviewer }),
      maxCycles
    });
  } finally {
    close();
  }
}
