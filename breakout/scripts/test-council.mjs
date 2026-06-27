#!/usr/bin/env node

// Council wiring tests: challenge -> adversary, revise -> team proposes + reviewer
// judges. Driven by a fake `callTool` so no API keys / MCP server are needed.

import assert from "node:assert/strict";
import { makeCouncilBreakout } from "../breakout.mjs";

function fakeCallTool(script) {
  const calls = [];
  const callTool = async (name, args) => {
    calls.push({ name, args });
    const nth = calls.filter((c) => c.name === name).length;
    const responder = script[`${name}:${nth}`] ?? script[name];
    if (typeof responder === "function") return responder(args, calls);
    return responder ?? "[]";
  };
  return { calls, callTool };
}

const team = [
  { name: "claude-builder", tool: "claude_ask" },
  { name: "codex-feasibility", tool: "claude_ask" }
];

// A. challenge() routes to the adversary and parses its blocker list.
{
  const { calls, callTool } = fakeCallTool({
    grok_ask: JSON.stringify(["§04 scorecard not rendered"])
  });
  const council = makeCouncilBreakout({ callTool, team, reviewer: { tool: "grok_ask" } });
  const out = await council.challenge({ workstream: "frontend-brand-experience", evidence: "x", round: 1 });
  assert.deepEqual(out.blockers, ["§04 scorecard not rendered"]);
  assert.equal(calls[0].name, "grok_ask");
}

// B. revise() asks EVERY team member, then the reviewer; review-accepted blockers
//    resolve and the reviewer's evidence is adopted.
{
  const verdict = JSON.stringify({
    accepted: "codex-feasibility",
    resolved: ["§04 scorecard not rendered"],
    evidence: "scorecard now renders 4 metrics + hard negative"
  });
  const { calls, callTool } = fakeCallTool({
    "claude_ask:1": "proposal A from claude-builder",
    "claude_ask:2": "proposal B from codex-feasibility",
    grok_ask: verdict
  });
  const council = makeCouncilBreakout({ callTool, team, reviewer: { tool: "grok_ask" } });
  const out = await council.revise({ workstream: "frontend-brand-experience", evidence: "x" }, ["§04 scorecard not rendered"]);

  const proposerCalls = calls.filter((c) => c.name === "claude_ask");
  assert.equal(proposerCalls.length, 2, "both team members must propose");
  assert.equal(calls[calls.length - 1].name, "grok_ask", "reviewer runs after the team");
  assert.deepEqual(out.resolved, ["§04 scorecard not rendered"]);
  assert.equal(out.evidence, "scorecard now renders 4 metrics + hard negative");
  assert.equal(out.review.proposals.length, 2);
}

// C. The team cannot self-approve: if the reviewer accepts nothing, nothing
//    resolves and the evidence is unchanged.
{
  const verdict = JSON.stringify({ accepted: null, resolved: [], evidence: "" });
  const { callTool } = fakeCallTool({
    "claude_ask:1": "weak proposal",
    "claude_ask:2": "also weak",
    grok_ask: verdict
  });
  const council = makeCouncilBreakout({ callTool, team, reviewer: { tool: "grok_ask" } });
  const out = await council.revise({ workstream: "frontend-brand-experience", evidence: "orig" }, ["unfixed blocker"]);
  assert.deepEqual(out.resolved, []);
  assert.equal(out.evidence, "orig");
}

// D. A reviewer can't resolve a blocker that was never raised (no smuggling).
{
  const verdict = JSON.stringify({ accepted: "claude-builder", resolved: ["a different blocker"], evidence: "unrelated" });
  const { callTool } = fakeCallTool({ "claude_ask:1": "p", "claude_ask:2": "q", grok_ask: verdict });
  const council = makeCouncilBreakout({ callTool, team, reviewer: { tool: "grok_ask" } });
  const out = await council.revise({ workstream: "frontend-brand-experience", evidence: "orig" }, ["the real blocker"]);
  assert.deepEqual(out.resolved, []);
  assert.equal(out.evidence, "orig");
}

// E. Explicit model IDs are forwarded to callTool (so a live run does not depend
//    on the server's registry aliases).
{
  const seen = [];
  const callTool = async (name, args) => {
    seen.push({ name, model: args.model });
    if (name === "grok_ask") return JSON.stringify(["b"]);
    if (name === "claude_ask") return "proposal";
    return "[]";
  };
  const council = makeCouncilBreakout({
    callTool,
    challengerTool: "grok_ask",
    challengerModel: "grok-4",
    team: [{ name: "claude-builder", tool: "claude_ask", model: "claude-sonnet-4-6" }],
    reviewer: { tool: "claude_ask", model: "claude-opus-4-8" }
  });
  await council.challenge({ workstream: "frontend", evidence: "x", round: 1 });
  await council.revise({ workstream: "frontend", evidence: "x" }, ["b"]);

  assert.equal(seen[0].model, "grok-4", "challenger model forwarded");
  assert.equal(seen.find((c) => c.name === "claude_ask" && c.model === "claude-sonnet-4-6") !== undefined, true, "team member model forwarded");
  assert.equal(seen[seen.length - 1].model, "claude-opus-4-8", "reviewer model forwarded");
}

console.log("council: all tests passed");
