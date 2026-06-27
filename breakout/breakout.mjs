// breakout.mjs — TELOS self-challenge engine.
//
// Turns a single adversarial pass (council_review) into a loop that keeps
// challenging a workstream's claimed status until the challenger can no longer
// break it (genuine goal status) or the rounds run out (honest needs-work plus
// the surviving blockers). The hard invariant: it never reports the goal status
// while a blocker still stands.
//
// Deterministic and keyless: the challenger and builder are injected as
// `challenge` / `revise`. In production they wire to the adversarial reviewer
// (Grok) and the builder (Claude) via the ai-peer-mcp tools; in tests they are
// plain stubs. This mirrors the build-gate's keyless-core philosophy.

/**
 * @param {object} input  { workstream, claimedStatus, evidence, goalStatus="meets", maxRounds=3 }
 * @param {object} fns    { challenge(state)->{blockers:string[]}, revise(state, blockers)->{evidence, resolved:string[]} }
 */
export async function runBreakout(input, fns) {
  const goalStatus = input.goalStatus || "meets";
  const maxRounds = Number.isInteger(input.maxRounds) ? input.maxRounds : 3;
  const workstream = input.workstream;

  let evidence = input.evidence;
  const rounds = [];
  let converged = false;
  let lastBlockers = [];

  for (let round = 1; round <= maxRounds; round++) {
    const challenged = (await fns.challenge({ workstream, evidence, round })) || {};
    const blockers = Array.isArray(challenged.blockers) ? challenged.blockers : [];

    if (blockers.length === 0) {
      rounds.push({ round, blockers: [], resolved: [] });
      converged = true;
      lastBlockers = [];
      break;
    }

    // The challenger found holes. Send them to the builder team, then loop back
    // so the same holes get re-attacked — a claimed fix only counts if it
    // survives the next challenge. `revise` may carry a review verdict.
    const revised = (await fns.revise({ workstream, evidence }, blockers)) || {};
    evidence = revised.evidence ?? evidence;
    const resolved = Array.isArray(revised.resolved) ? revised.resolved : [];
    rounds.push({ round, blockers, resolved, review: revised.review });
    lastBlockers = blockers;
  }

  const surviving_blockers = converged ? [] : lastBlockers;
  const finalStatus = converged ? goalStatus : "needs-work";

  return {
    workstream,
    claimedStatus: input.claimedStatus,
    finalStatus,
    converged,
    rounds,
    surviving_blockers,
    // What the market-readiness packet should carry — derived from whether the
    // claim survived challenge, never self-asserted.
    go_to_market_blockers: surviving_blockers,
    evidence
  };
}

/**
 * Wire the engine to live models through the ai-peer-mcp tools without making the
 * core depend on them. `callTool(name, args) -> string` is the MCP tool caller
 * (see mcp_client.mjs). Updates are made by a TEAM and then REVIEWED: each member
 * proposes a fix independently, and only review-accepted fixes count — the team
 * cannot approve its own work.
 *
 * @param {object} cfg
 *   callTool       async (toolName, {prompt, system}) -> string
 *   team           [{ name, tool?, system? }]   independent proposers
 *   reviewer       { tool?, system? }           judges the proposals
 *   challengerTool tool name for the adversary (default "grok_ask")
 */
export function makeCouncilBreakout({ callTool, team, reviewer, challengerTool = "grok_ask", challengerSystem, challengerModel }) {
  const members = Array.isArray(team) && team.length ? team : [{ name: "claude-builder", tool: "claude_ask" }];
  const reviewerTool = reviewer?.tool || "grok_ask";
  const withModel = (args, model) => (model ? { ...args, model } : args);

  return {
    challenge: async ({ workstream, evidence, round }) => {
      const text = await callTool(challengerTool, withModel({
        system: challengerSystem || "You are the adversarial reviewer. Be skeptical, concrete, and source-demanding.",
        prompt:
          `Workstream: ${workstream}\nRound: ${round}\nClaimed "meets" evidence:\n${evidence}\n\n` +
          `Attack this claim. List every concrete reason it does NOT yet meet the goal ` +
          `(missing states, claims not actually rendered, unverified assertions). ` +
          `Return a JSON array of short blocker strings; [] if you cannot break it.`
      }, challengerModel));
      return { blockers: parseBlockers(text) };
    },

    revise: async ({ workstream, evidence }, blockers) => {
      // 1. Each team member independently proposes a fix for the blockers.
      const proposals = [];
      for (const member of members) {
        const proposal = await callTool(member.tool || "claude_ask", withModel({
          system: member.system || `You are ${member.name}, a builder on the ${workstream} team.`,
          prompt:
            `Workstream: ${workstream}\nEvidence so far:\n${evidence}\n\n` +
            `An adversarial reviewer raised these blockers:\n- ${blockers.join("\n- ")}\n\n` +
            `Propose the concrete change that resolves them. Point to specifics; do not ` +
            `claim a fix you cannot name.`
        }, member.model));
        proposals.push({ name: member.name, proposal });
      }

      // 2. The reviewer judges the team's proposals against the blockers. Only
      //    review-accepted blockers resolve, and resolution is capped to blockers
      //    that were actually raised (no smuggling).
      const verdictText = await callTool(reviewerTool, withModel({
        system: reviewer?.system ||
          "You are the reviewer. Accept a fix only if it concretely resolves the blocker. " +
          'Return JSON {"accepted","resolved","evidence"}.',
        prompt:
          `Workstream: ${workstream}\nBlockers:\n- ${blockers.join("\n- ")}\n\n` +
          `Team proposals:\n${proposals.map((p) => `[${p.name}]\n${p.proposal}`).join("\n\n")}\n\n` +
          `Return JSON: {"accepted":"<member name or null>","resolved":["<blockers actually fixed>"],` +
          `"evidence":"<updated evidence of meets>"}.`
      }, reviewer?.model));
      const verdict = parseVerdict(verdictText, blockers);

      return {
        evidence: verdict.resolved.length > 0 && verdict.evidence ? verdict.evidence : evidence,
        resolved: verdict.resolved,
        review: { accepted: verdict.accepted, proposals, raw: verdictText }
      };
    }
  };
}

function parseVerdict(text, blockers) {
  const empty = { accepted: null, resolved: [], evidence: "" };
  if (typeof text !== "string") return empty;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return empty;
  let obj;
  try {
    obj = JSON.parse(match[0]);
  } catch {
    return empty;
  }
  const raised = new Set(blockers);
  const resolved = Array.isArray(obj.resolved) ? obj.resolved.filter((b) => raised.has(b)) : [];
  return {
    accepted: obj.accepted ?? null,
    resolved,
    evidence: typeof obj.evidence === "string" ? obj.evidence : ""
  };
}

function parseBlockers(text) {
  if (Array.isArray(text)) return text.filter((b) => typeof b === "string");
  if (typeof text !== "string") return [];
  const match = text.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed.filter((b) => typeof b === "string" && b.trim());
    } catch {
      // fall through to line parsing
    }
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}
