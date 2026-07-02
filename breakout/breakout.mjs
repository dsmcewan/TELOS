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
 * @param {object} input  { workstream, claimedStatus, evidence, goalStatus="meets", maxRounds }
 * @param {object} fns    { challenge(state)->{blockers:string[]}, revise(state, blockers)->{evidence, resolved:string[]},
 *                          referee?(state)->{verdict:"continue"|"stalemate", reason} }
 *
 * rounds[] IS the fight log: each round's blockers and resolutions. It is
 * passed to challenge() as `history` so adversaries do not re-raise settled
 * blockers, and to the optional referee, who reviews the log after each
 * contested round and ends the bout when the exchange is looping (the same
 * solutions and results recycling). With a referee the round cap is a cost
 * fuse (12), not the governing bound — the referee is expected to rule first.
 * A stalemate ruling never grants convergence: the claim honestly stays
 * needs-work with its surviving blockers.
 */
export async function runBreakout(input, fns) {
  const goalStatus = input.goalStatus || "meets";
  const maxRounds = Number.isInteger(input.maxRounds)
    ? input.maxRounds
    : (typeof fns.referee === "function" ? 12 : 3);
  const workstream = input.workstream;

  let evidence = input.evidence;
  const rounds = [];
  let converged = false;
  let lastBlockers = [];
  let refereeRuling = null;

  for (let round = 1; round <= maxRounds; round++) {
    const challenged = (await fns.challenge({ workstream, evidence, round, history: rounds.slice() })) || {};
    const blockers = Array.isArray(challenged.blockers) ? challenged.blockers : [];

    if (blockers.length === 0) {
      rounds.push({ round, blockers: [], resolved: [] });
      converged = true;
      lastBlockers = [];
      break;
    }

    // A blocker that was claimed resolved in an earlier round and is raised
    // again means that fix got beat — record it so it is not re-proposed
    // (this cycle, or in any future run reading the same fight memory).
    if (fns.memory && typeof fns.memory.record === "function" && rounds.length) {
      const beaten = [];
      for (const b of blockers) {
        const prior = rounds.find((r) => Array.isArray(r.resolved) && r.resolved.includes(b));
        if (prior) {
          beaten.push({
            workstream,
            blocker: b,
            solution: prior.review?.raw ? String(prior.review.raw) : `resolution claimed in round ${prior.round}`,
            outcome: "fix-did-not-survive-reattack"
          });
        }
      }
      if (beaten.length) fns.memory.record(beaten);
    }

    // The challenger found holes. Send them to the builder team, then loop back
    // so the same holes get re-attacked — a claimed fix only counts if it
    // survives the next challenge. `revise` may carry a review verdict.
    const revised = (await fns.revise({ workstream, evidence }, blockers)) || {};
    evidence = revised.evidence ?? evidence;
    const resolved = Array.isArray(revised.resolved) ? revised.resolved : [];
    rounds.push({ round, blockers, resolved, review: revised.review });
    lastBlockers = blockers;

    // The referee reviews the fight log; a stalemate ruling stops the loop
    // with an honest needs-work — never a granted convergence.
    if (typeof fns.referee === "function") {
      const ruling = (await fns.referee({ workstream, rounds: rounds.slice(), evidence })) || {};
      if (ruling.verdict === "stalemate") {
        refereeRuling = { round, verdict: "stalemate", reason: ruling.reason || "adversarial loop detected" };
        break;
      }
    }
  }

  const surviving_blockers = converged ? [] : lastBlockers;
  const finalStatus = converged ? goalStatus : "needs-work";

  return {
    workstream,
    claimedStatus: input.claimedStatus,
    finalStatus,
    converged,
    rounds,
    referee: refereeRuling,
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
export function makeCouncilBreakout({ callTool, team, reviewer, challengerTool = "grok_ask", challengerSystem, challengerModel, memory }) {
  const members = Array.isArray(team) && team.length ? team : [{ name: "claude-builder", tool: "claude_ask" }];
  const reviewerTool = reviewer?.tool || "grok_ask";
  const withModel = (args, model) => (model ? { ...args, model } : args);

  return {
    challenge: async ({ workstream, evidence, round, history }) => {
      const fightLog = Array.isArray(history) && history.length
        ? `\nFIGHT LOG (prior rounds — blockers already raised and the team's resolutions):\n` +
          history.map((r) =>
            `Round ${r.round}: raised ${JSON.stringify(r.blockers)}; resolved ${JSON.stringify(r.resolved || [])}`).join("\n") +
          `\nDo NOT re-raise a blocker from the log unless its resolution is demonstrably inadequate — ` +
          `and say why in the blocker text. Raise only NEW, concrete blockers.\n`
        : "";
      const text = await callTool(challengerTool, withModel({
        system: challengerSystem || "You are the adversarial reviewer. Be skeptical, concrete, and source-demanding.",
        prompt:
          `Workstream: ${workstream}\nRound: ${round}\nClaimed "meets" evidence:\n${evidence}\n${fightLog}\n` +
          `Attack this claim. List every concrete reason it does NOT yet meet the goal ` +
          `(missing states, claims not actually rendered, unverified assertions). ` +
          `Return a JSON array of short blocker strings; [] if you cannot break it.`
      }, challengerModel));
      return { blockers: parseBlockers(text) };
    },

    revise: async ({ workstream, evidence }, blockers) => {
      // Recursion over the fight memory: approaches that already LOST — in a
      // prior round, cycle, or run — are shown to the proposers so they are
      // not re-proposed. The memory informs; it never decides.
      const beaten = memory && typeof memory.beatenFor === "function" ? memory.beatenFor(workstream) : [];
      const beatenNotes = beaten.length
        ? `\nDEFEATED SOLUTIONS LOG (approaches that already lost in prior fights — do NOT re-propose these or trivial variants of them):\n` +
          beaten.map((b) =>
            `- ${b.solution.slice(0, 300).replace(/\s+/g, " ")}${b.blocker ? ` [failed against: ${b.blocker.slice(0, 120)}]` : ""}`).join("\n") +
          "\n"
        : "";

      // 1. Each team member independently proposes a fix for the blockers.
      const proposals = [];
      for (const member of members) {
        const proposal = await callTool(member.tool || "claude_ask", withModel({
          system: member.system || `You are ${member.name}, a builder on the ${workstream} team.`,
          prompt:
            `Workstream: ${workstream}\nEvidence so far:\n${evidence}\n\n` +
            `An adversarial reviewer raised these blockers:\n- ${blockers.join("\n- ")}\n${beatenNotes}\n` +
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

      // Record defeats: a proposal the reviewer did not accept is a beaten
      // solution — the next proposer (this cycle or a future run) skips it.
      if (memory && typeof memory.record === "function") {
        memory.record(proposals
          .filter((p) => p.name !== verdict.accepted)
          .map((p) => ({
            workstream,
            blocker: blockers.join(" | ").slice(0, 500),
            solution: String(p.proposal || ""),
            outcome: "rejected-by-review"
          })));
      }

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

/**
 * The gemini referee: reviews the fight log after each contested round and
 * rules whether the bout is still productive or has become an adversarial loop
 * (the same solutions and results recycling round after round — roughly five
 * equivalent solution/result exchanges is a loop). Replaces a wall-clock/round
 * bound with a judgment on the log itself. Fail-open on referee errors: a
 * broken referee never ends a fight (the round fuse still bounds cost), and it
 * can never grant convergence — only runBreakout's challenger can do that.
 *
 * @param {object} cfg  { callTool, tool = "gemini_ask", model }
 */
export function makeGeminiReferee({ callTool, tool = "gemini_ask", model }) {
  return async ({ workstream, rounds }) => {
    try {
      const text = await callTool(tool, {
        system:
          "You are the neutral referee of an adversarial review bout. You judge only the exchange dynamics, " +
          "never the artifact itself. You cannot approve or reject the claim — only rule whether the bout continues.",
        prompt:
          `Workstream: ${workstream}\n` +
          `FIGHT LOG (round, blockers raised, resolutions):\n${JSON.stringify(rounds, null, 2)}\n\n` +
          `Rule on the bout. verdict "continue" if the exchange is productive (new blockers or genuinely new ` +
          `resolutions are appearing). verdict "stalemate" if it is looping: the same or equivalent blockers and ` +
          `solutions are recycling (about five equivalent solution/result exchanges means a loop). ` +
          `Return ONLY JSON: {"verdict":"continue"|"stalemate","reason":"<one sentence>"}.`,
        ...(model ? { model } : {})
      });
      const m = String(text).match(/\{[\s\S]*\}/);
      const ruling = m ? JSON.parse(m[0]) : null;
      return ruling && (ruling.verdict === "stalemate" || ruling.verdict === "continue")
        ? { verdict: ruling.verdict, reason: ruling.reason }
        : { verdict: "continue", reason: "referee returned no usable ruling" };
    } catch (e) {
      return { verdict: "continue", reason: `referee unavailable: ${e?.message || e}` };
    }
  };
}
