// breakouts.mjs — run a REAL adversarial breakout per pattern workstream, with
// the verdict decided on facts (the workstream's artifact on disk), not trivia.
//
// The challenger is fact-grounded: it re-verifies the workstream's checks
// against the built artifact and raises a blocker for every check that does NOT
// hold. A workstream only converges to "meets" when its product evidence actually
// survives. In live mode the same loop is driven by makeCouncilBreakout (grok
// challenges, the builder revises, a reviewer accepts) — but even there the
// verdict is anchored to these checks.

import { runBreakout } from "../breakout/breakout.mjs";
import { factBreakout } from "../forge/breakouts.mjs";

export { factBreakout };

/**
 * Run every workstream's breakout against the built project. Returns one record
 * per workstream:
 *   { workstream, finalStatus, converged, surviving_blockers, rounds, evidence,
 *     checks, lens, isUi, finding, findingsKey }
 *
 * Mirrors saas-forge's runTeamBreakouts but iterates pattern.workstreams
 * (data-driven) instead of the hard-coded WORKSTREAMS registry, and reads
 * ws.checks(ctx) / ws.lens / ws.isUi / ws.finding / ws.findingsKey.
 *
 *   makeFns({ workstream, checks, baseDir }) -> { challenge, revise }
 *     Default = factBreakout (verdict purely on disk). Live = council+fact (a
 *     grok adversary on top of the fact checks, with a builder revise).
 */
export async function runPatternBreakouts({ pattern, ctx, baseDir, maxRounds = 3, makeFns }) {
  const build = makeFns || (({ checks }) => factBreakout({ checks, baseDir }));
  const records = [];
  for (const ws of pattern.workstreams) {
    const checks = ws.checks(ctx);
    const fns = build({ workstream: ws.id, checks, baseDir });
    const record = await runBreakout(
      { workstream: ws.id, claimedStatus: "meets", goalStatus: "meets",
        evidence: `${ws.id} artifacts: ${ws.files.join(", ")}`, maxRounds },
      fns
    );
    records.push({ ...record, checks, lens: ws.lens, signer: ws.signer, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
  }
  return records;
}
