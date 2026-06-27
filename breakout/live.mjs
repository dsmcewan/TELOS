#!/usr/bin/env node

// live.mjs — run a real breakout. The VERDICT is decided by the deterministic
// verifier (facts: file_exists / file_contains / command), never by the prose
// council. The council (Grok challenges -> Claude+Grok team fixes -> Claude
// reviews) is run for DISCOVERY only — it surfaces what to check next, as
// advisory context attached under `discovery`. It does not move the verdict.
//
// Why: the live council does not reliably converge — a goalpost-moving reviewer
// can refuse forever. Deciding `meets` on facts is the load-bearing fix; the
// council's value is discovery, not adjudication.
//
// The council/MCP path needs the ai-peer-mcp env (ANTHROPIC_API_KEY /
// XAI_API_KEY + models); the verdict path is keyless.

import { readFileSync } from "node:fs";
import { spawnMcpClient } from "./mcp_client.mjs";
import { makeCouncilBreakout, runBreakout } from "./breakout.mjs";
import { runVerifiedBreakout, buildCheck } from "./verifier.mjs";

export async function runLiveBreakout({ workstream, checks, baseDir, evidence, maxRounds = 3, team, reviewer, env, discover } = {}) {
  // VERDICT — decided by deterministic checks. `checks` may be declarative specs
  // or pre-built check objects.
  const built = (checks || []).map((c) => (c && typeof c.run === "function") ? c : buildCheck(c, baseDir));
  const verdict = await runVerifiedBreakout({ workstream, claimedStatus: "meets" }, built);

  // DISCOVERY (advisory) — the prose council surfaces what to check next. It does
  // NOT decide the verdict. An injected `discover` overrides the live MCP path
  // (used in tests); otherwise the council runs only when `evidence` is given.
  let discovery = null;
  const discoverer = discover || defaultCouncilDiscovery;
  if (discover || evidence != null) {
    try {
      discovery = await discoverer({ workstream, evidence, maxRounds, team, reviewer, env, verdict });
    } catch (error) {
      discovery = { error: error?.message || String(error) };
    }
  }

  return { ...verdict, discovery };
}

// The live prose council, run for discovery. Returns the council's surfaced
// blockers/rounds (NOT a verdict). Requires the ai-peer-mcp environment.
async function defaultCouncilDiscovery({ workstream, evidence, maxRounds = 3, team, reviewer, env }) {
  const CLAUDE_MODEL = process.env.BREAKOUT_CLAUDE_MODEL || "claude-sonnet-4-6";
  const REVIEW_MODEL = process.env.BREAKOUT_REVIEW_MODEL || "claude-opus-4-8";

  const { client, close } = spawnMcpClient({ env });
  try {
    const council = makeCouncilBreakout({
      callTool: (name, args) => client.callTool(name, args),
      challengerTool: "grok_ask",
      challengerSystem: "You are Grok, the adversarial reviewer. Be skeptical, concrete, and source-demanding.",
      team: team || [
        { name: "claude-builder", tool: "claude_ask", model: CLAUDE_MODEL, system: "You are Claude, lead architect and builder." },
        { name: "grok-skeptic", tool: "grok_ask", system: "You are Grok; propose the fix a skeptic would actually trust." }
      ],
      reviewer: reviewer || {
        tool: "claude_ask",
        model: REVIEW_MODEL,
        system:
          "You are the reviewer. Surface every concrete check the claim should have to survive. " +
          'Return JSON {"accepted","resolved","evidence"}.'
      }
    });
    const council_result = await runBreakout({ workstream, claimedStatus: "meets", evidence, maxRounds }, council);
    return {
      role: "discovery",
      note: "advisory only — surfaces checks to add; does not decide the verdict",
      surviving_blockers: council_result.surviving_blockers,
      rounds: council_result.rounds
    };
  } finally {
    close();
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].split(/[\\/]/).pop() === "live.mjs";
if (invokedDirectly) {
  const [, , workstream, evidence, checksFile, rounds] = process.argv;
  if (!workstream) {
    console.error('Usage: node live.mjs "<workstream>" ["<evidence for discovery>"] [checks.json] [maxRounds]');
    process.exit(2);
  }
  let checks = [];
  if (checksFile) {
    try { checks = JSON.parse(readFileSync(checksFile, "utf8")); }
    catch (error) { console.error(`could not read checks file: ${error?.message || error}`); process.exit(2); }
  }
  runLiveBreakout({ workstream, checks, evidence: evidence || null, maxRounds: rounds ? Number(rounds) : 3 })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.converged ? 0 : 1);
    })
    .catch((error) => {
      console.error(error?.message || String(error));
      process.exit(2);
    });
}
