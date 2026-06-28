// breakouts.mjs — run a REAL adversarial breakout per SaaS team, with the
// verdict decided on facts (the team's artifact on disk), not trivia.
//
// The challenger is fact-grounded: it re-verifies the team's checks against the
// built artifact and raises a blocker for every check that does NOT hold. A team
// only converges to "meets" when its product evidence actually survives — "the
// cat is drawn", not "the capital of Kuwait". In live mode the same loop is
// driven by makeCouncilBreakout (grok challenges, the builder team revises,
// a reviewer accepts) — but even there the verdict is anchored to these checks.

import { runBreakout } from "../breakout/breakout.mjs";
import { reverifyRecord } from "../breakout/verifier.mjs";
import { WORKSTREAMS } from "./workstreams.mjs";

// Fact challenger/builder for one team. `repair` (optional) regenerates failing
// artifacts in live mode; offline it is a no-op, so unmet checks honestly survive.
function factBreakout({ checks, baseDir, repair }) {
  return {
    challenge: () => {
      const r = reverifyRecord({ checks }, baseDir);
      if (r.reverifiable === 0) return { blockers: ["no re-verifiable product evidence for this team"] };
      return { blockers: r.failing.map((f) => f.detail || f.description || f.id) };
    },
    revise: async (state, blockers) => {
      if (typeof repair === "function") await repair(state.workstream, blockers);
      // Evidence is the artifact on disk; the next challenge re-reads it.
      return { evidence: state.evidence, resolved: [] };
    }
  };
}

/**
 * Run every team's breakout against the built project. Returns one record per
 * workstream: { workstream, finalStatus, converged, surviving_blockers, rounds,
 * checks }. `repairFor(id)` optionally returns a live repair fn for that team.
 */
export async function runTeamBreakouts({ baseDir, architecture, maxRounds = 3, repairFor }) {
  const records = [];
  for (const ws of WORKSTREAMS) {
    const checks = ws.checks(architecture);
    const fns = factBreakout({ checks, baseDir, repair: repairFor ? repairFor(ws.id) : undefined });
    const record = await runBreakout(
      { workstream: ws.id, claimedStatus: "meets", goalStatus: "meets",
        evidence: `${ws.id} artifacts: ${ws.files.join(", ")}`, maxRounds },
      fns
    );
    // Attach the deterministic specs so the gate can independently re-verify.
    records.push({ ...record, checks, lens: ws.lens, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
  }
  return records;
}
