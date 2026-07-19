#!/usr/bin/env node
// test-runtime-adaptation.mjs — RUNTIME ADAPTATION: a team that fails its node's
// own test sees why and self-corrects (inner dispatch loop), and if it exhausts,
// hands a respec up for the substrate's outer halt->mutate->re-dispatch loop.
// Rule 3 stays load-bearing throughout. Keyless: real Ed25519 ledger + real gate.
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readLedger } from "../../merkle-dag/crypto.mjs";
import { runNodeTest } from "../test-runner.mjs";
import { buildProject, makeTeamDispatch, makeTeamKeyring } from "../build-orchestrator.mjs";
import { planTeams } from "../teams.mjs";

function tmpWs() {
  const baseDir = mkdtempSync(path.join(os.tmpdir(), "telos-adapt-"));
  const telosDir = path.join(baseDir, ".telos");
  mkdirSync(telosDir, { recursive: true });
  return { baseDir, telosDir };
}

// A node whose test passes only if its file contains "FIXED".
const node = (id) => ({
  id, requirements: `write ${id} containing FIXED`, files: [`${id}.txt`],
  test: { cmd: "node", args: ["-e", `process.exit(require('fs').readFileSync('${id}.txt','utf8').includes('FIXED')?0:1)`] },
  effective_hash: "sha256:test"
});

// --- runNodeTest captures output + respects the cwd-escape guard ---
{
  const { baseDir } = tmpWs();
  writeFileSync(path.join(baseDir, "x.txt"), "nope");
  const fail = await runNodeTest({ id: "x", files: ["x.txt"], test: { cmd: "node", args: ["-e", "console.error('boom'); process.exit(1)"] } }, baseDir);
  assert.equal(fail.ok, false, "non-zero exit => not ok");
  assert.equal(fail.status, 1);
  assert.match(fail.stderr, /boom/, "stderr captured");
  assert.match(fail.detail, /test exit 1/, "detail summarizes the failure");

  const escape = await runNodeTest({ id: "e", files: [], test: { cmd: "node", args: ["-e", ""], cwd: "../escape" } }, baseDir);
  assert.equal(escape.ok, false, "cwd escape rejected");
  assert.match(escape.detail, /escapes baseDir/);

  const outside = mkdtempSync(path.join(os.tmpdir(), "telos-adapt-outside-"));
  symlinkSync(outside, path.join(baseDir, "escape-link"), process.platform === "win32" ? "junction" : "dir");
  const physicalEscape = await runNodeTest({
    id: "physical-e", files: [],
    test: { cmd: "node", args: ["-e", "require('node:fs').writeFileSync('ran.txt','x')"], cwd: "escape-link" }
  }, baseDir);
  assert.equal(physicalEscape.ok, false, "symlink/junction cwd escape rejected");
  assert.match(physicalEscape.detail, /escapes baseDir/);
  assert.equal(existsSync(path.join(outside, "ran.txt")), false, "test never ran outside baseDir");

  const noCmd = await runNodeTest({ id: "n", files: [], test: {} }, baseDir);
  assert.equal(noCmd.ok, false, "no test command => not ok");

  // Cross-platform shim: `npm` is npm.cmd on Windows (cannot be spawned without the
  // cmd.exe wrapper); runNodeTest must run it and capture exit 0 on Windows and
  // POSIX alike. `npm --version` needs no project and always exits 0.
  const npm = await runNodeTest({ id: "npm", files: [], test: { cmd: "npm", args: ["--version"] } }, baseDir);
  assert.equal(npm.ok, true, `npm-based node test must run cross-platform; got detail=${npm.detail}`);
  assert.equal(npm.status, 0, "npm --version exits 0");
}

// --- dispatch inner loop: fail attempt 1, self-correct on attempt 2 using priorFailure ---
{
  const { baseDir } = tmpWs();
  const seen = [];
  const callTeam = async ({ node, attempt, priorFailure }) => {
    seen.push({ attempt, hadPrior: !!priorFailure, detail: priorFailure?.detail });
    // attempt 1 writes a failing file; attempt 2 (informed by the failure) fixes it
    const content = attempt === 1 ? "broken" : "FIXED by adaptation";
    return { files: node.files.map((p) => ({ path: p, content })) };
  };
  const dispatch = makeTeamDispatch({ routeFor: () => ({ id: "backend", signer: "backend" }), callTeam, baseDir, maxAttempts: 2 });
  const out = await dispatch(node("a"));
  assert.equal(out.ok, true, "self-corrected on attempt 2 => settles");
  assert.equal(seen.length, 2, "two attempts");
  assert.equal(seen[0].hadPrior, false, "attempt 1 has no priorFailure");
  assert.equal(seen[1].hadPrior, true, "attempt 2 receives priorFailure");
  assert.match(seen[1].detail, /test exit 1/, "priorFailure carries the real failure detail");
  assert.match(readFileSync(path.join(baseDir, "a.txt"), "utf8"), /FIXED/, "the corrected file is on disk");
}

// --- exhaustion: a team that never passes hands a respec UP for the outer loop ---
{
  const { baseDir } = tmpWs();
  const callTeam = async ({ node }) => ({ files: node.files.map((p) => ({ path: p, content: "still broken" })) });
  const dispatch = makeTeamDispatch({ routeFor: () => ({ id: "backend", signer: "backend" }), callTeam, baseDir, maxAttempts: 2 });
  const out = await dispatch(node("b"));
  assert.equal(out.ok, false, "exhausted attempts => not ok");
  assert.ok(out.respec && typeof out.respec.requirements === "string", "carries a respec");
  assert.match(out.respec.requirements, /\[adaptation\] prior test failure/, "respec embeds the failure for re-dispatch");
}

// --- end-to-end: two-level adaptation reaches ready via buildProject ---
{
  const { baseDir, telosDir } = tmpWs();
  const dossier = { build_id: "ad1", use_case: "u", objective: "o", required_docs: [], write_targets: ["a.txt"] };
  const callSeat = async ({ model, intent }) => intent === "decompose" ? { tasks: [] } : ({
    packet: { build_id: "ad1", use_case: "u", model, role: "approver", docs_reviewed: [], proposal_ref: "ad1", decision: "approve", required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z" },
    provenance: { model, source: "mock", response_id: `r_${model}` }
  });
  // Fails its own test on the first build attempt, succeeds on the second.
  let calls = 0;
  const callTeam = async ({ node }) => { calls++; return { files: node.files.map((p) => ({ path: p, content: calls >= 2 ? "FIXED" : "broken" })) }; };
  const tasks = [{ id: "a", writes: ["a.txt"], reads: [], requirements: "write a containing FIXED", test: { cmd: "node", args: ["-e", "process.exit(require('fs').readFileSync('a.txt','utf8').includes('FIXED')?0:1)"] }, workstream: "product-architecture" }];
  const { keyring, signerFor } = makeTeamKeyring(planTeams(dossier));
  const result = await buildProject({ dossier, telos: "x", tasks, callSeat, callTeam, keyring, signerFor, baseDir, telosDir, adaptAttempts: 1, maxRepairRounds: 6 });
  assert.equal(result.report.merge_status, "ready", "two-level adaptation reaches ready");
  assert.equal(readLedger(path.join(telosDir, "ledger.jsonl")).length, 1, "node settled after adaptation");
  assert.ok(result.situation, "buildProject returns a situation report");
}

// --- Rule 3 stays load-bearing: a team whose own runner passes but whose file
// fails defaultVerifyNode's (different) test must NOT settle ---
{
  const { baseDir, telosDir } = tmpWs();
  const dossier = { build_id: "ad2", use_case: "u", objective: "o", required_docs: [], write_targets: ["z.txt"] };
  const callSeat = async ({ model, intent }) => intent === "decompose" ? { tasks: [] } : ({
    packet: { build_id: "ad2", use_case: "u", model, role: "approver", docs_reviewed: [], proposal_ref: "ad2", decision: "approve", required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-28T00:00:00Z" },
    provenance: { model, source: "mock", response_id: `r_${model}` }
  });
  // The team writes a file; its node test always passes (exit 0), so the dispatch
  // settles — but the file content is irrelevant. We instead give the NODE a test
  // that always FAILS so defaultVerifyNode (Rule 3) blocks it regardless of dispatch.
  const callTeam = async ({ node }) => ({ files: node.files.map((p) => ({ path: p, content: "anything" })) });
  const tasks = [{ id: "z", writes: ["z.txt"], reads: [], requirements: "r", test: { cmd: "node", args: ["-e", "process.exit(1)"] }, workstream: "product-architecture" }];
  const { keyring, signerFor } = makeTeamKeyring(planTeams(dossier));
  const result = await buildProject({ dossier, telos: "x", tasks, callSeat, callTeam, keyring, signerFor, baseDir, telosDir, adaptAttempts: 2, maxRepairRounds: 3 });
  assert.equal(result.report.merge_status, "blocked", "a node whose test never passes never settles (Rule 3 load-bearing)");
  assert.equal(readLedger(path.join(telosDir, "ledger.jsonl")).length, 0, "no ledger entry for the failing node");
}

console.log("test-runtime-adaptation.mjs OK");
