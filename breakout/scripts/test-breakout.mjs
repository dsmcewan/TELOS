#!/usr/bin/env node

// Self-challenge "breakout" engine tests. Keyless and deterministic: the
// challenger/builder are injected, so these run with no API keys (matching the
// build-gate test idiom).

import assert from "node:assert/strict";
import { runBreakout } from "../breakout.mjs";

// 1. A claim the challenger cannot break converges immediately to the goal,
//    and the builder is never asked to revise something that isn't broken.
{
  const result = await runBreakout(
    { workstream: "frontend-brand-experience", claimedStatus: "meets", evidence: "all sections render", maxRounds: 3 },
    {
      challenge: () => ({ blockers: [] }),
      revise: () => { throw new Error("revise must not run when nothing is broken"); }
    }
  );
  assert.equal(result.converged, true);
  assert.equal(result.finalStatus, "meets");
  assert.deepEqual(result.surviving_blockers, []);
  assert.equal(result.rounds.length, 1);
}

// 2. A claim broken once, then genuinely fixed, converges to the goal with the
//    fix recorded on the round where it happened.
{
  let fixed = false;
  const result = await runBreakout(
    { workstream: "frontend-brand-experience", claimedStatus: "meets", evidence: "sections render", maxRounds: 3 },
    {
      challenge: () => (fixed ? { blockers: [] } : { blockers: ["dynamics/scorecard loaded but never rendered"] }),
      revise: (state, blockers) => {
        fixed = true;
        return { evidence: state.evidence + " + dynamics/scorecard wired", resolved: blockers };
      }
    }
  );
  assert.equal(result.converged, true);
  assert.equal(result.finalStatus, "meets");
  assert.deepEqual(result.surviving_blockers, []);
  assert.equal(result.rounds.length, 2);
  assert.deepEqual(result.rounds[0].resolved, ["dynamics/scorecard loaded but never rendered"]);
}

// 3. The rubber-stamp case: a claim whose blocker never actually resolves is
//    honestly downgraded, NOT passed. (This is the dead-data §03/§04 site.)
{
  const result = await runBreakout(
    { workstream: "frontend-brand-experience", claimedStatus: "meets", evidence: "looks done", maxRounds: 2 },
    {
      challenge: () => ({ blockers: ["dead data: dynamics computed but not rendered"] }),
      revise: (state) => ({ evidence: state.evidence, resolved: [] }) // pretends, fixes nothing
    }
  );
  assert.equal(result.converged, false);
  assert.equal(result.finalStatus, "needs-work");
  assert.notEqual(result.claimedStatus, result.finalStatus);
  assert.ok(result.surviving_blockers.length > 0);
  assert.deepEqual(result.go_to_market_blockers, result.surviving_blockers);
}

// 4. Hard invariant: never report the goal status while blockers survive.
{
  const result = await runBreakout(
    { workstream: "x", claimedStatus: "meets", evidence: "e", maxRounds: 1 },
    { challenge: () => ({ blockers: ["unresolved"] }), revise: (s) => ({ evidence: s.evidence, resolved: [] }) }
  );
  assert.ok(
    !(result.finalStatus === "meets" && result.surviving_blockers.length > 0),
    "must never return meets with surviving blockers"
  );
}

console.log("breakout: all tests passed");
