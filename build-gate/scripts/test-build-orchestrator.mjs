#!/usr/bin/env node
// test-build-orchestrator.mjs — the autonomous builder end to end, KEYLESS.
// Proves the composition: decompose -> council approval gate (fail-closed) ->
// content-addressed plan -> teams build as workers -> Rule-3 verify -> signed
// ledger -> done() ready. No API keys: council + teams are deterministic mocks;
// the Ed25519 substrate is real.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLedger } from "../../merkle-dag/crypto.mjs";
import { buildProject, makeTeamDispatch, makeTeamKeyring } from "../build-orchestrator.mjs";
import { planTeams } from "../teams.mjs";

// A gate-valid dossier (non-market keeps the council gate to the 3 required seats).
function makeDossier() {
  return {
    build_id: "ap1",
    use_case: "autonomous-build",
    objective: "build a tiny project autonomously",
    required_docs: [],
    write_targets: []
  };
}

// Council seat caller: approves for every model; doubles as the Planning team's
// decompose source when intent==="decompose".
function makeCallSeat({ decision = "approve", tasks } = {}) {
  return async ({ model, intent }) => {
    if (intent === "decompose") return { tasks };
    return {
      packet: {
        build_id: "ap1", use_case: "autonomous-build", model, role: "approver",
        docs_reviewed: [], proposal_ref: "ap1", decision, required_edits: [],
        hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z"
      },
      provenance: { model: `real-${model}`, source: "mock", response_id: `r_${model}` }
    };
  };
}

// Team build caller: writes the node's declared files (so Rule-3 verify passes).
const buildTeam = async ({ team, node }) => ({
  files: node.files.map((p) => ({ path: p, content: `// ${node.id} built by team ${team.id}\n` }))
});

const tasks = [
  { id: "core", writes: ["out/core.txt"], reads: [], requirements: "core module", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" },
  { id: "app", writes: ["out/app.txt"], reads: ["out/core.txt"], requirements: "app on core", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" }
];

function fixture() {
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-teams-"));
  const telosDir = path.join(baseDir, ".telos");
  mkdirSync(telosDir, { recursive: true });
  const teams = planTeams(makeDossier());
  const { keyring, signerFor } = makeTeamKeyring(teams);
  return { baseDir, telosDir, keyring, signerFor };
}

// --- Happy path: hand-authored tasks build all the way to merge_status:ready ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "make a tiny project", tasks,
    callSeat: makeCallSeat(), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 20
  });

  assert.equal(result.phase, "build", "reached the build phase");
  assert.equal(result.ok, true, "build ok");
  assert.equal(result.report.merge_status, "ready", "done() gate reports ready");
  const ledger = readLedger(path.join(telosDir, "ledger.jsonl"));
  assert.equal(ledger.length, 2, "both nodes settled into the signed ledger");
  assert.ok(ledger.every((r) => r.sig && r.sig.alg === "Ed25519"), "ledger entries are Ed25519-signed");
  const settled = result.trace.filter((t) => t.action === "settled").map((t) => t.id).sort();
  assert.deepEqual(settled, ["app", "core"], "both nodes appear settled in the trace");
  console.log("OK: happy path -> ready");
}

// --- Fail-closed sequencing: a council 'revise' blocks at approval; NO plan, NO ledger ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "x", tasks,
    callSeat: makeCallSeat({ decision: "revise" }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir
  });

  assert.equal(result.phase, "approval", "stopped at the approval phase");
  assert.equal(result.ok, false, "not ok");
  assert.ok(result.blocked.some((b) => /decision is 'revise'/.test(b)), "blocked on the revise decision");
  assert.equal(existsSync(path.join(telosDir, "plan.json")), false, "no plan written when approval fails");
  assert.equal(existsSync(path.join(telosDir, "ledger.jsonl")), false, "no ledger written when approval fails");
  console.log("OK: fail-closed — approval blocks before any execution");
}

// --- Autonomous decompose: omit tasks, the Planning team proposes them, build reaches ready ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "decompose me",
    callSeat: makeCallSeat({ tasks }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 20
  });

  assert.equal(result.ok, true, "autonomous decomposition built to ready");
  assert.equal(result.report.merge_status, "ready", "Planning-team tasks survived the gate + Rule-3 verify");
  console.log("OK: autonomous decompose -> ready");
}

// --- Decompose fail-closed: an empty decomposition stops before approval/plan ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const result = await buildProject({
    dossier: makeDossier(), telos: "nothing",
    callSeat: makeCallSeat({ tasks: [] }), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir
  });
  assert.equal(result.phase, "decompose", "stopped at decompose");
  assert.equal(result.ok, false, "empty decomposition is fail-closed");
  console.log("OK: empty decomposition blocks");
}

// --- A team verify-failure does NOT settle: bad test => node blocked, no ledger entry ---
{
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  const badTasks = [
    { id: "good", writes: ["out/good.txt"], reads: [], requirements: "ok", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" },
    { id: "bad", writes: ["out/bad.txt"], reads: [], requirements: "fails its own test", test: { cmd: "node", args: ["-e", "process.exit(1)"] }, workstream: "product-architecture" }
  ];
  const result = await buildProject({
    dossier: makeDossier(), telos: "x", tasks: badTasks,
    callSeat: makeCallSeat(), callTeam: buildTeam,
    keyring, signerFor, baseDir, telosDir, maxRepairRounds: 5
  });
  assert.equal(result.report.merge_status, "blocked", "a failing node blocks the merge (Rule 3 not bypassed)");
  const ledger = readLedger(path.join(telosDir, "ledger.jsonl"));
  assert.deepEqual(ledger.map((r) => r.task_id), ["good"], "only the verified node settled; the failing one did not");
  console.log("OK: Rule-3 verify is load-bearing");
}

// --- makeTeamDispatch unit: a team writing OUTSIDE baseDir is rejected (path escape) ---
{
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-disp-"));
  const team = { id: "rogue", signer: "rogue" };
  const dispatch = makeTeamDispatch({
    routeFor: () => team,
    callTeam: async () => ({ files: [{ path: "../escape.txt", content: "x" }] }),
    baseDir, dossier: {}
  });
  const out = await dispatch({ id: "n", files: ["../escape.txt"] });
  assert.equal(out.ok, false, "path-escaping write is rejected");
  assert.match(out.reason, /escapes baseDir/, "reason names the escape");
  console.log("OK: dispatch rejects path escape");
}

// --- makeTeamDispatch unit: a team that declines surfaces a respec for the repair loop ---
{
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-disp2-"));
  const team = { id: "t", signer: "t" };
  const dispatch = makeTeamDispatch({
    routeFor: () => team,
    callTeam: async () => ({ ok: false, reason: "needs more spec", respec: { requirements: "clarified" } }),
    baseDir, dossier: {}
  });
  const out = await dispatch({ id: "n", files: [] });
  assert.equal(out.ok, false, "decline is a halt");
  assert.deepEqual(out.respec, { requirements: "clarified" }, "respec passes through to runBuild's repair loop");
  console.log("OK: dispatch surfaces respec on decline");
}

console.log("test-build-orchestrator.mjs OK");
