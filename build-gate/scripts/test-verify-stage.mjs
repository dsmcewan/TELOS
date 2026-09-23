#!/usr/bin/env node
// test-verify-stage.mjs — the per-node VERIFY stage, KEYLESS.
//
// After a team builds a node and its own test passes, an independent verify team
// adversarially re-checks the artifact. The verdict can only BLOCK — Rule 3
// (defaultVerifyNode) stays the sole settle authority. Blocking is fact-grounded:
// the verdict's declarative checks are re-run against disk, so a model cannot
// bluff "ok". By default the stage is advisory (a broken verifier cannot wedge
// the build); requireVerify makes an un-runnable verify hard-fail the node.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLedger } from "../../merkle-dag/crypto.mjs";
import { buildProject, makeTeamKeyring } from "../build-orchestrator.mjs";
import { planTeams, verifyTeamForNode } from "../teams.mjs";

function makeDossier() {
  return { build_id: "vs1", use_case: "verify-stage", objective: "verify-stage test", required_docs: [], write_targets: [] };
}
function makeCallSeat() {
  return async ({ model }) => ({
    packet: {
      build_id: "vs1", use_case: "verify-stage", model, role: "approver",
      docs_reviewed: [], proposal_ref: "vs1", decision: "approve", required_edits: [],
      hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z"
    },
    provenance: { model: `real-${model}`, source: "mock", response_id: `r_${model}` }
  });
}
// Team writes the node's declared files, so the node's own test (Rule 3) passes
// and execution reaches the verify stage.
const buildTeam = async ({ team, node }) => ({
  files: node.files.map((p) => ({ path: p, content: `// ${node.id} by ${team.id}\n` }))
});
const okTask = [{ id: "core", writes: ["out/core.txt"], reads: [], requirements: "core", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, workstream: "product-architecture" }];

function fixture() {
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-verify-"));
  const telosDir = path.join(baseDir, ".telos");
  mkdirSync(telosDir, { recursive: true });
  const { keyring, signerFor } = makeTeamKeyring(planTeams(makeDossier()));
  return { baseDir, telosDir, keyring, signerFor };
}
function run(extra) {
  const { baseDir, telosDir, keyring, signerFor } = fixture();
  return buildProject({
    dossier: makeDossier(), telos: "x", tasks: okTask,
    callSeat: makeCallSeat(), callTeam: buildTeam, keyring, signerFor,
    baseDir, telosDir, maxRepairRounds: 4, ...extra
  }).then((result) => ({ result, telosDir }));
}

// Sanity: a plain non-market dossier convenes a verify team (integrity is ALWAYS_ON).
assert.ok(verifyTeamForNode({ workstream: "product-architecture" }, planTeams(makeDossier())),
  "a verify team is available for the node");

// 1. Verify PASSES (its declared check holds on disk) -> node settles, build ready.
{
  const verify = async () => ({ ok: true, blockers: [], findings: [], checks: [{ type: "file_exists", path: "out/core.txt", needle: "" }] });
  const { result, telosDir } = await run({ callVerify: verify });
  assert.equal(result.report.merge_status, "ready", "passing verify -> ready");
  assert.deepEqual(readLedger(path.join(telosDir, "ledger.jsonl")).map((r) => r.task_id), ["core"], "node settled");
  console.log("OK: verify pass -> settle");
}

// 2. Verify BLOCKS via a declared check that does NOT hold on disk (fact-grounding:
//    the model said ok:true, but its own evidence is absent) -> node never settles.
{
  const verify = async () => ({ ok: true, blockers: [], findings: [], checks: [{ type: "file_exists", path: "out/missing.txt", needle: "" }] });
  const { result, telosDir } = await run({ callVerify: verify });
  assert.equal(result.report.merge_status, "blocked", "failing grounded check blocks");
  assert.deepEqual(readLedger(path.join(telosDir, "ledger.jsonl")), [], "no ledger entry — verify blocked the node");
  console.log("OK: verify block on failing declared check (model cannot bluff ok)");
}

// 3. Verify BLOCKS via an explicit stop (ok:false / blockers) -> node never settles.
{
  const verify = async () => ({ ok: false, blockers: ["missing error handling"], findings: [], checks: [] });
  const { result, telosDir } = await run({ callVerify: verify });
  assert.equal(result.report.merge_status, "blocked", "explicit verifier stop blocks");
  assert.deepEqual(readLedger(path.join(telosDir, "ledger.jsonl")), [], "no ledger entry");
  console.log("OK: verify block on ok:false/blockers");
}

// 4. Advisory by default: a verify team that THROWS does not wedge the build —
//    Rule 3 already settled the node, verify is supplementary scrutiny.
{
  const verify = async () => { throw new Error("verify seat unavailable (no key)"); };
  const { result, telosDir } = await run({ callVerify: verify });
  assert.equal(result.report.merge_status, "ready", "un-runnable verify is advisory -> still ready");
  assert.deepEqual(readLedger(path.join(telosDir, "ledger.jsonl")).map((r) => r.task_id), ["core"], "node settled anyway");
  console.log("OK: un-runnable verify is advisory by default");
}

// 5. requireVerify: an un-runnable verify HARD-FAILS the node (opt-in strictness).
{
  const verify = async () => { throw new Error("verify seat unavailable (no key)"); };
  const { result, telosDir } = await run({ callVerify: verify, requireVerify: true });
  assert.equal(result.report.merge_status, "blocked", "requireVerify + un-runnable verify blocks");
  assert.deepEqual(readLedger(path.join(telosDir, "ledger.jsonl")), [], "no ledger entry when required verify cannot run");
  console.log("OK: requireVerify hard-fails an un-runnable verify");
}

// 6. Backward-compat: no callVerify => the verify stage is inert, behavior unchanged.
{
  const { result, telosDir } = await run({});
  assert.equal(result.report.merge_status, "ready", "no verify stage -> unchanged ready");
  assert.deepEqual(readLedger(path.join(telosDir, "ledger.jsonl")).map((r) => r.task_id), ["core"], "node settled");
  console.log("OK: absent callVerify is byte-compatible");
}

console.log("test-verify-stage.mjs OK");
