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
import { reverifyRecord } from "../breakout/verifier.mjs";

// Fact challenger/builder for one workstream. `repair` (optional) regenerates
// failing artifacts in live mode; offline it is a no-op, so unmet checks
// honestly survive.
// NOTE: copied verbatim from saas-forge/breakouts.mjs (human-approved Phase A
// duplication — each forge owns its own copy so the two can diverge independently).
export function factBreakout({ checks, baseDir, repair }) {
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
    // Attach the deterministic specs so the gate can independently re-verify.
    records.push({ ...record, checks, lens: ws.lens, signer: ws.signer, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
  }
  return records;
}
