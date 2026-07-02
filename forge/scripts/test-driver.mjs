#!/usr/bin/env node

// Fixed-point driver tests: pass terminal, fixed-point stop (identical state
// across consecutive passes), cost fuse, and progress continuing the loop.

import assert from "node:assert/strict";
import { driveUntil } from "../driver.mjs";

// 1. Terminal result stops with outcome "pass".
{
  let calls = 0;
  const r = await driveUntil({
    invoke: async () => { calls++; return calls === 3 ? "PASS" : "again"; },
    isTerminal: (x) => x === "PASS",
    stateSnapshot: () => ({ progress: calls }),
    maxPasses: 10
  });
  assert.equal(r.outcome, "pass");
  assert.equal(r.pass, 3);
}

// 2. Identical state across consecutive passes stops with "fixed-point" —
//    and the loop never runs a wasteful third identical pass.
{
  let calls = 0;
  const r = await driveUntil({
    invoke: async () => { calls++; return "blocked"; },
    isTerminal: () => false,
    stateSnapshot: () => ({ converged: ["a"], blockers: { b: ["same"] } }),
    maxPasses: 10
  });
  assert.equal(r.outcome, "fixed-point");
  assert.equal(calls, 2, "exactly two passes prove a fixed point");
}

// 3. Changing state keeps driving until the fuse.
{
  let calls = 0;
  const r = await driveUntil({
    invoke: async () => { calls++; return "blocked"; },
    isTerminal: () => false,
    stateSnapshot: () => ({ pass: calls }),
    maxPasses: 4
  });
  assert.equal(r.outcome, "fuse");
  assert.equal(calls, 4);
}

console.log("test-driver: all assertions passed");
