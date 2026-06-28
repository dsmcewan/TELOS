#!/usr/bin/env node
// test-team-prompts.mjs — pure (no-network) coverage of the live-wiring helpers:
// buildable-seat selection, prompt construction, response parsing/clamping, and a
// fake-client callTeam round-trip.
import assert from "node:assert/strict";
import { buildableSeat, promptForTeam, nodeBuildPrompt, parseTeamFiles, makeLiveCallTeam, approvalPromptFor } from "../teamPrompts.mjs";

// --- buildableSeat: skip a structured lead (agy) for the first _ask-capable seat ---
{
  assert.equal(buildableSeat({ seats: [{ model: "claude" }, { model: "codex" }] }), "claude", "first ask seat is the lead");
  assert.equal(buildableSeat({ seats: [{ model: "agy" }, { model: "codex" }] }), "codex", "agy lead falls back to codex builder");
  assert.equal(buildableSeat({ seats: [{ model: "agy" }] }), "claude", "no ask seat => claude default");
}

// --- prompts mention the node spec and the strict JSON contract ---
{
  const sys = promptForTeam({ id: "backend", mission: "data model" });
  assert.match(sys, /backend/, "system prompt names the team");
  assert.match(sys, /\{"files"/, "system prompt states the JSON files contract");
  const up = nodeBuildPrompt({ id: "n1", requirements: "do x", files: ["a.txt"] });
  assert.match(up, /n1/, "user prompt carries the node id");
  assert.match(up, /a\.txt/, "user prompt lists the declared files");
}

// --- parseTeamFiles: clamps to declared files, drops undeclared/malformed ---
{
  const node = { id: "n", files: ["keep.txt"] };
  const out = parseTeamFiles(JSON.stringify({ files: [
    { path: "keep.txt", content: "ok" },
    { path: "sneak.txt", content: "nope" },
    { path: "keep.txt", content: 123 }
  ] }), node);
  assert.deepEqual(out, [{ path: "keep.txt", content: "ok" }], "only declared, string-content files survive");

  // tolerate the {text:"...json..."} envelope shape the ask tools can return
  const env = parseTeamFiles(JSON.stringify({ text: JSON.stringify({ files: [{ path: "keep.txt", content: "v" }] }) }), node);
  assert.deepEqual(env, [{ path: "keep.txt", content: "v" }], "unwraps the provenance envelope text");

  assert.deepEqual(parseTeamFiles("not json", node), [], "garbage -> no files (fail-closed)");
}

// --- makeLiveCallTeam: round-trips through a fake client; empty -> decline ---
{
  const node = { id: "n", files: ["out.txt"] };
  const okClient = { async callTool(tool, args) {
    assert.equal(tool, "codex_ask", "uses the team's buildable seat tool");
    assert.equal(args.include_provenance, true, "requests provenance envelope");
    return JSON.stringify({ files: [{ path: "out.txt", content: "built" }] });
  } };
  const callTeam = makeLiveCallTeam({ client: okClient });
  const res = await callTeam({ team: { id: "backend", seats: [{ model: "codex" }] }, node });
  assert.deepEqual(res.files, [{ path: "out.txt", content: "built" }], "live callTeam returns clamped files");

  const emptyClient = { async callTool() { return JSON.stringify({ files: [] }); } };
  const decline = await makeLiveCallTeam({ client: emptyClient })({ team: { id: "backend", seats: [{ model: "codex" }] }, node });
  assert.equal(decline.ok, false, "no usable files -> fail-closed decline");
}

// --- approvalPromptFor: agy stays structured; chat seats emit packet instructions ---
{
  const promptFor = approvalPromptFor({ build_id: "b", use_case: "u", objective: "o" });
  const agy = promptFor("agy", "approver");
  assert.equal(agy.tool, "agy_checkpoint", "agy uses the structured checkpoint tool");
  const claude = promptFor("claude", "approver");
  assert.equal(claude.tool, "claude_ask", "chat seats use their ask tool");
  assert.match(claude.system, /approval packet/, "chat seat is told to emit an approval packet");
  assert.match(claude.prompt, /build_id: b/, "prompt carries dossier context");
}

console.log("test-team-prompts.mjs OK");
