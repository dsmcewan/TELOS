#!/usr/bin/env node
// test-team-prompts.mjs — pure (no-network) coverage of the live-wiring helpers:
// buildable-seat selection, prompt construction, response parsing/clamping, and a
// fake-client callTeam round-trip.
import assert from "node:assert/strict";
import { buildableSeat, promptForTeam, nodeBuildPrompt, parseTeamFiles, makeLiveCallTeam, approvalPromptFor, parseApprovalPacket, decomposePrompt, parseDecomposeTasks, extractJson, makeLiveCallSeat } from "../teamPrompts.mjs";

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
  assert.ok(!/previous attempt/i.test(up), "no failure block on the first attempt");

  // on a retry, the node's OWN prior failure is fed back (Rule-1 safe)
  const retry = nodeBuildPrompt({ id: "n1", requirements: "do x", files: ["a.txt"] }, { status: 1, stderr: "AssertionError: expected FIXED", detail: "n1: test exit 1" });
  assert.match(retry, /previous attempt FAILED/i, "retry prompt states the prior failure");
  assert.match(retry, /AssertionError: expected FIXED/, "retry prompt carries the captured test output");
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

  // a retry passes priorFailure all the way into the prompt the team sees
  let seenPrompt = "";
  const retryClient = { async callTool(_tool, args) { seenPrompt = args.prompt; return JSON.stringify({ files: [{ path: "out.txt", content: "fixed" }] }); } };
  await makeLiveCallTeam({ client: retryClient })({ team: { id: "backend", seats: [{ model: "codex" }] }, node, attempt: 2, priorFailure: { status: 1, stderr: "boom", detail: "n: test exit 1" } });
  assert.match(seenPrompt, /previous attempt FAILED/i, "priorFailure reaches the live build prompt on retry");
}

// --- approvalPromptFor: agy stays structured; chat seats get the decision packet instruction ---
{
  const promptFor = approvalPromptFor({ build_id: "b", use_case: "u", objective: "ship it" }, { models: { claude: "claude-sonnet-4-6" } });
  const agy = promptFor("agy", "approver");
  assert.equal(agy.tool, "agy_checkpoint", "agy uses the structured checkpoint tool");
  assert.equal(agy.args.protected_path_check, "pass", "agy checkpoint carries governance args");
  const claude = promptFor("claude", "approver");
  assert.equal(claude.tool, "claude_ask", "chat seats use their ask tool");
  assert.equal(claude.model, "claude-sonnet-4-6", "per-seat model id is threaded through");
  assert.match(claude.system, /Return ONLY a JSON object/, "chat seat told to emit a strict JSON decision");
  assert.match(claude.prompt, /ship it/, "prompt carries the objective");
}

// --- parseApprovalPacket: identity from dossier, judgment from the model ---
{
  const dossier = { build_id: "b1", use_case: "u1" };
  const meta = { proposal_ref: "b1", timestamp: "2026-06-28T00:00:00Z", docs_reviewed: ["d.md"] };
  const pkt = parseApprovalPacket('```json\n{"decision":"approve","confidence":"high","hard_stops":[]}\n```', "claude", dossier, meta);
  assert.equal(pkt.build_id, "b1", "identity injected from dossier (not the model)");
  assert.equal(pkt.use_case, "u1");
  assert.equal(pkt.model, "claude");
  assert.equal(pkt.decision, "approve", "model's decision preserved");
  assert.equal(pkt.confidence, "high", "model's confidence preserved");
  assert.equal(pkt.timestamp, "2026-06-28T00:00:00Z");

  // Unparseable answer => non-approving advisory-note (fail-closed, never approve).
  const junk = parseApprovalPacket("the build looks fine to me", "grok", dossier, meta);
  assert.equal(junk.decision, "advisory-note", "garbage degrades to advisory-note, never approve");

  // An agy checkpoint is adapted (advance => approve).
  const agyPkt = parseApprovalPacket(JSON.stringify({ phase_gate_status: "advance", blocked_reasons: [] }), "agy", dossier, meta);
  assert.equal(agyPkt.model, "agy");
  assert.equal(agyPkt.decision, "approve", "advance checkpoint => approve");
}

// --- decompose prompt + parse: strict JSON array, fenced-tolerant ---
{
  const { system, prompt } = decomposePrompt({ objective: "build x" }, "telos: do x");
  assert.match(system, /JSON array of task objects/, "decompose system asks for a task array");
  assert.match(prompt, /build x/, "decompose prompt carries the objective");
  assert.ok(!/test command/.test(prompt), "no convention line when conventions absent");

  // project sense: a detected test command steers node tests toward the real runner
  const withConv = decomposePrompt({ objective: "build x" }, "t", { testCmd: "vitest run" });
  assert.match(withConv.prompt, /real test command is "vitest run"/, "decompose prompt names the project's real test command");

  const tasks = parseDecomposeTasks('here you go:\n```json\n[{"id":"a","writes":["a.txt"]}]\n```');
  assert.deepEqual(tasks, [{ id: "a", writes: ["a.txt"] }], "parses a fenced JSON task array");
  assert.deepEqual(parseDecomposeTasks("no array here"), [], "no array => [] (decompose.mjs fail-closes)");
  assert.deepEqual(extractJson("x [1,2] y", "[", "]"), [1, 2], "extractJson pulls a bracketed array");
}

// --- makeLiveCallSeat: routes decompose vs approval over a fake client ---
{
  const dossier = { build_id: "b", use_case: "u", objective: "o" };
  const fakeLiveSeatCaller = ({ parsePacket }) => async (seatArg) => ({ packet: parsePacket('{"decision":"approve","confidence":"high"}'), provenance: { model: seatArg.model, response_id: "r" } });
  const client = { async callTool(tool, args) {
    assert.equal(tool, "claude_ask", "decompose uses the planning lead's ask tool");
    assert.match(args.prompt, /Emit the JSON task array/, "decompose prompt sent");
    return JSON.stringify({ text: JSON.stringify([{ id: "n", writes: ["n.txt"], requirements: "r", test: { cmd: "node" } }]) });
  } };
  const callSeat = makeLiveCallSeat({ client, liveSeatCaller: fakeLiveSeatCaller, dossier, meta: { timestamp: "2026-06-28T00:00:00Z" } });

  const dec = await callSeat({ intent: "decompose", telos: "t" });
  assert.equal(dec.tasks.length, 1, "decompose intent returns parsed tasks");
  const appr = await callSeat({ model: "claude", role: "approver" });
  assert.equal(appr.packet.decision, "approve", "non-decompose routes to the approval council");
}

console.log("test-team-prompts.mjs OK");
