#!/usr/bin/env node

// Fight-memory tests: defeated solutions are recorded (reviewer rejection and
// fix-re-broken-on-reattack), recalled per workstream with dedupe + limit, and
// shown to proposers as a DEFEATED SOLUTIONS log. Keyless — stub callTool,
// temp-dir storage.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createFightMemory } from "../fight_memory.mjs";
import { runBreakout, makeCouncilBreakout } from "../breakout.mjs";

// 1. record/beatenFor round-trip: workstream filter, dedupe by solution, limit,
//    and resilience to a missing file.
{
  const memory = createFightMemory({ dir: mkdtempSync(path.join(os.tmpdir(), "fm-")) });
  assert.deepEqual(memory.beatenFor("ws-a"), [], "empty memory reads as empty");

  memory.record([
    { workstream: "ws-a", blocker: "b1", solution: "use a cron job", outcome: "rejected-by-review" },
    { workstream: "ws-a", blocker: "b1", solution: "use a cron job", outcome: "rejected-by-review" }, // dup
    { workstream: "ws-b", blocker: "bx", solution: "other stream", outcome: "rejected-by-review" },
    { workstream: "ws-a", blocker: "b2", solution: "retry with backoff", outcome: "fix-did-not-survive-reattack" },
    { workstream: "ws-a", blocker: null, solution: "   ", outcome: "rejected-by-review" } // blank solution dropped
  ]);

  const beaten = memory.beatenFor("ws-a");
  assert.deepEqual(beaten.map((b) => b.solution), ["use a cron job", "retry with backoff"],
    "dedupes by solution, filters by workstream, drops blanks");
  assert.equal(memory.beatenFor("ws-a", 1).length, 1, "limit respected");
}

// 2. Engine records a fix that did not survive re-attack.
{
  const recorded = [];
  const memory = { record: (es) => recorded.push(...es), beatenFor: () => [] };
  let round = 0;
  const fns = {
    memory,
    challenge: async () => {
      round++;
      if (round === 1) return { blockers: ["missing auth"] };
      if (round === 2) return { blockers: ["missing auth"] }; // re-raised after claimed resolution
      return { blockers: [] };
    },
    revise: async () => ({ evidence: "e2", resolved: ["missing auth"], review: { raw: "accepted: add-auth-header" } })
  };
  const result = await runBreakout({ workstream: "ws-r", claimedStatus: "meets", evidence: "e1" }, fns);
  assert.equal(result.converged, true, "third round converges");
  const beat = recorded.find((e) => e.outcome === "fix-did-not-survive-reattack");
  assert.ok(beat, "re-raised blocker records a defeated fix");
  assert.equal(beat.blocker, "missing auth");
  assert.ok(beat.solution.includes("add-auth-header"), "defeat carries the beaten resolution");
}

// 3. Council revise: rejected proposals are recorded, and the DEFEATED
//    SOLUTIONS log is injected into the next proposer prompt.
{
  const memory = createFightMemory({ dir: mkdtempSync(path.join(os.tmpdir(), "fm-")) });
  const prompts = [];
  const callTool = async (name, args) => {
    prompts.push({ name, prompt: args.prompt });
    if (args.prompt.includes("Team proposals")) {
      return '{"accepted":"alice","resolved":[],"evidence":""}'; // bob's proposal is rejected
    }
    return `proposal from ${name}`;
  };
  const council = makeCouncilBreakout({
    callTool,
    team: [{ name: "alice", tool: "claude_ask" }, { name: "bob", tool: "codex_ask" }],
    memory
  });

  await council.revise({ workstream: "ws-m", evidence: "e" }, ["blocker-1"]);
  const beaten = memory.beatenFor("ws-m");
  assert.equal(beaten.length, 1, "only the rejected proposal is recorded");
  assert.ok(beaten[0].solution.includes("codex_ask"), "bob's beaten proposal is the one remembered");

  prompts.length = 0;
  await council.revise({ workstream: "ws-m", evidence: "e" }, ["blocker-2"]);
  const memberPrompt = prompts.find((p) => p.prompt.includes("adversarial reviewer raised"));
  assert.ok(memberPrompt.prompt.includes("DEFEATED SOLUTIONS LOG"),
    "next revise shows the defeated-solutions log");
  assert.ok(memberPrompt.prompt.includes("proposal from codex_ask"),
    "the beaten solution itself is listed");
}

console.log("test-fight-memory: all assertions passed");
