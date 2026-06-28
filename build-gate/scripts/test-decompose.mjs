#!/usr/bin/env node
// test-decompose.mjs — the Planning team's decomposition contract: extract a usable
// task list, normalize it for the planner, and fail closed on garbage.
import assert from "node:assert/strict";
import { decompose } from "../decompose.mjs";

const dossier = { build_id: "d1", use_case: "u", market_bound: false };
const seatReturning = (payload) => async () => payload;

// --- extract + normalize: defaults workstream, fills empty reads/baseDependencies ---
{
  const tasks = await decompose({
    dossier, telos: "t",
    callSeat: seatReturning({ tasks: [
      { id: "a", writes: ["a.txt"], requirements: "make a", test: { cmd: "node", args: ["-e", ""] } },
      { id: "b", writes: ["b.txt"], reads: ["a.txt"], requirements: "make b", test: { cmd: "node" }, workstream: "backend-schema", baseDependencies: ["a"] }
    ] })
  });
  assert.equal(tasks.length, 2, "both valid tasks extracted");
  assert.equal(tasks[0].workstream, "product-architecture", "missing workstream defaults to product-architecture");
  assert.deepEqual(tasks[0].reads, [], "missing reads normalized to []");
  assert.deepEqual(tasks[0].baseDependencies, [], "missing baseDependencies normalized to []");
  assert.equal(tasks[1].workstream, "backend-schema", "explicit workstream preserved");
  assert.deepEqual(tasks[1].baseDependencies, ["a"], "explicit baseDependencies preserved");
}

// --- conventions (project sense) are forwarded to the seat caller ---
{
  let seenArgs = null;
  const callSeat = async (args) => { seenArgs = args; return { tasks: [{ id: "a", writes: ["a.txt"], requirements: "r", test: { cmd: "node" } }] }; };
  await decompose({ dossier, telos: "t", callSeat, conventions: { testCmd: "npm test" } });
  assert.equal(seenArgs.intent, "decompose", "decompose intent set");
  assert.deepEqual(seenArgs.conventions, { testCmd: "npm test" }, "conventions forwarded to callSeat");
}

// --- accepts tasks nested under a packet body too ---
{
  const tasks = await decompose({
    dossier, telos: "t",
    callSeat: seatReturning({ packet: { tasks: [{ id: "x", writes: ["x"], requirements: "r", test: { cmd: "node" } }] } })
  });
  assert.equal(tasks.length, 1, "tasks read from packet.tasks");
}

// --- invalid tasks are filtered; if nothing valid remains, fail closed ---
{
  await assert.rejects(
    decompose({ dossier, telos: "t", callSeat: seatReturning({ tasks: [
      { id: "no-writes", requirements: "r", test: { cmd: "node" } },
      { writes: ["y"], requirements: "no id", test: { cmd: "node" } },
      { id: "no-test", writes: ["z"], requirements: "r" }
    ] }) }),
    /produced no valid tasks/,
    "all-invalid decomposition throws (no silent empty plan)"
  );
}

// --- empty proposal fails closed ---
{
  await assert.rejects(
    decompose({ dossier, telos: "t", callSeat: seatReturning({ tasks: [] }) }),
    /no valid tasks/,
    "empty task list throws"
  );
}

// --- duplicate ids rejected before any plan is built ---
{
  await assert.rejects(
    decompose({ dossier, telos: "t", callSeat: seatReturning({ tasks: [
      { id: "dup", writes: ["a"], requirements: "r", test: { cmd: "node" } },
      { id: "dup", writes: ["b"], requirements: "r", test: { cmd: "node" } }
    ] }) }),
    /duplicate task id 'dup'/,
    "duplicate task ids are fail-closed"
  );
}

console.log("test-decompose.mjs OK");
