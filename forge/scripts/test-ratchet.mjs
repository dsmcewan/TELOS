#!/usr/bin/env node

// Ratchet-stage tests — keyless ports of the behaviors the live runs proved:
// Styx (frozen defs, artifact preservation, never-refight), respec folding,
// contract closure arming, verify-failure banking, evidence digest derivation.

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  openState, foldDefs, styxGenerateFiles, bankVerifyFailures,
  contractClosure, runBouts, approvalEvidenceDigest, loadKeys, saveJson,
  withTransientRetry
} from "../ratchet.mjs";

const tmp = () => mkdtempSync(path.join(os.tmpdir(), "forge-test-"));

// 1. Keys persist across invocations (stable plan hashes).
{
  const w = tmp();
  const k1 = loadKeys(w, ["claude", "codex"]);
  const k2 = loadKeys(w, ["claude", "codex"]);
  assert.equal(k1.claude.publicJwk.x, k2.claude.publicJwk.x, "same keys on reload");
}

// 2. foldDefs: blockers fold into requirements (respec); a converged team's
//    frozen def is used verbatim; pre-Styx wins get frozen_def backfilled.
{
  const w = tmp();
  const state = openState(w);
  const raw = [
    { id: "a", files: ["a.md"], requirements: "REQ-A", test: {}, dependencies: [] },
    { id: "b", files: ["b.md"], requirements: "REQ-B", test: {}, dependencies: [] }
  ];
  state.boutBlockers.a = ["fix the intro", "cite the source"];
  state.done.b = { converged: true }; // pre-Styx win, no frozen_def
  const folded = foldDefs(raw, state);
  assert.ok(folded[0].requirements.includes("PRIOR BOUT BLOCKERS"), "blockers folded");
  assert.ok(folded[0].requirements.includes("fix the intro"));
  assert.equal(folded[1].requirements, "REQ-B", "frozen def used verbatim");
  assert.ok(state.done.b.frozen_def, "frozen_def backfilled for pre-Styx win");
  // A later operator edit to the raw def must NOT reach the frozen team.
  const folded2 = foldDefs([{ ...raw[0] }, { ...raw[1], requirements: "REQ-B-CHANGED" }], state);
  assert.equal(folded2[1].requirements, "REQ-B", "styx: crossing immune to spec churn");
}

// 3. styxGenerateFiles: a converged team's artifact re-settles from disk —
//    the seat is NEVER re-invoked; contested teams still generate.
{
  const w = tmp();
  const state = openState(w);
  writeFileSync(path.join(w, "won.md"), "the preserved artifact");
  state.done.won = { converged: true };
  let seatCalls = 0;
  const gen = styxGenerateFiles({ state, generate: async () => { seatCalls++; return { "new.md": "fresh" }; } });
  const preserved = await gen({ id: "won", files: ["won.md"] });
  assert.equal(preserved["won.md"], "the preserved artifact");
  assert.equal(seatCalls, 0, "no seat call for a crossing");
  await gen({ id: "contested", files: ["new.md"] });
  assert.equal(seatCalls, 1, "contested teams still generate");
}

// 4. bankVerifyFailures: diagnostics become banked blockers, deduped.
{
  const w = tmp();
  const state = openState(w);
  bankVerifyFailures([{ id: "a", reason: "test exit 1 — test said: tn mismatch" }], state);
  bankVerifyFailures([{ id: "a", reason: "test exit 1 — test said: tn mismatch" }], state);
  assert.equal(state.boutBlockers.a.length, 1, "identical failure banked once");
  assert.ok(state.boutBlockers.a[0].includes("tn mismatch"), "diagnostic text preserved");
}

// 5. contractClosure arms on the 4th bout and persists counts.
{
  const w = tmp();
  const state = openState(w);
  assert.equal(contractClosure(state, "x"), "", "bout 1 open");
  contractClosure(state, "x"); contractClosure(state, "x");
  const clause = contractClosure(state, "x");
  assert.ok(clause.includes("CONTRACT CLOSED (bout 4)"), "bout 4 closes the contract");
  const reopened = openState(w);
  assert.equal(reopened.fightCounts.x, 4, "counts persist across invocations");
}

// 6. runBouts: Styx skip (no fns invoked for a crossing), win checkpointing
//    (blockers cleared, frozen_def stored), loss banking; fight logs persisted.
{
  const w = tmp();
  const telosDir = path.join(w, ".telos");
  mkdirSync(telosDir, { recursive: true });
  const state = openState(w);
  state.done.across = { converged: true, workstream: "across", rounds: [] };
  state.boutBlockers.loser = ["old blocker"];

  let fnsBuilt = [];
  const makeFns = ({ workstream }) => {
    fnsBuilt.push(workstream);
    return {
      challenge: async () => ({ blockers: workstream === "winner" ? [] : ["still broken"] }),
      revise: async () => ({ evidence: "e", resolved: [] })
    };
  };
  const workstreams = [
    { id: "across", files: ["x.md"], checks: [], lens: "codex", signer: "codex" },
    { id: "winner", files: ["w.md"], checks: [{ type: "file_exists", path: "w.md" }], lens: "claude", signer: "claude" },
    { id: "loser", files: ["l.md"], checks: [], lens: "grok", signer: "codex" }
  ];
  const defById = new Map(workstreams.map((ws) => [ws.id, { id: ws.id, files: ws.files, requirements: "REQ" }]));
  const records = await runBouts({ workstreams, state, makeFns, defById, hashById: new Map(), telosDir });

  assert.ok(!fnsBuilt.includes("across"), "styx: crossing never re-fought");
  assert.equal(records.length, 3);
  assert.equal(state.done.winner.converged, true, "win checkpointed");
  assert.ok(state.done.winner.frozen_def, "win carries frozen_def");
  assert.equal(state.boutBlockers.winner, undefined, "win clears banked blockers");
  assert.deepEqual(state.boutBlockers.loser, ["still broken"], "loss banks surviving blockers");
  const fight = JSON.parse((await import("node:fs")).readFileSync(path.join(telosDir, "fights", "loser.json"), "utf8"));
  assert.equal(fight.workstream, "loser", "fight log persisted");
}

// 6b. maxRounds caps within-bout arguing (cost flows to between-pass rebuilds).
{
  const w = tmp();
  const telosDir = path.join(w, ".telos");
  mkdirSync(telosDir, { recursive: true });
  const state = openState(w);
  let challenges = 0;
  const makeFns = () => ({
    // Always finds a fresh blocker — without a cap this runs to the referee fuse.
    challenge: async () => { challenges++; return { blockers: [`blocker ${challenges}`] }; },
    revise: async () => ({ evidence: "e", resolved: [] })
  });
  const workstreams = [{ id: "endless", files: ["e.md"], checks: [], lens: "grok", signer: "codex" }];
  const defById = new Map([["endless", { id: "endless", files: ["e.md"], requirements: "REQ" }]]);
  const records = await runBouts({ workstreams, state, makeFns, defById, hashById: new Map(), telosDir, maxRounds: 2 });
  assert.equal(records[0].rounds.length, 2, "maxRounds caps the bout at 2 rounds");
  assert.equal(challenges, 2, "no arguing beyond the cap");
  assert.equal(records[0].converged, false, "unconverged, blockers banked for the rebuild");
}

// 7. approvalEvidenceDigest derives from disk: check counts and Phase-2 items.
{
  const w = tmp();
  mkdirSync(path.join(w, "audit"), { recursive: true });
  writeFileSync(path.join(w, "audit", "DOC.md"),
    "# Audit\ncontent with NEEDLE inside\n## Phase 2 Work Items\n- item one\n- item two\n3. item three\n");
  const records = [{
    workstream: "doc", rounds: [1, 2], referee: null,
    checks: [
      { type: "file_exists", path: "audit/DOC.md" },
      { type: "file_contains", path: "audit/DOC.md", needle: "NEEDLE" },
      { type: "file_contains", path: "audit/DOC.md", needle: "ABSENT" }
    ],
    frozen_def: { files: ["audit/DOC.md"] }
  }];
  const digest = approvalEvidenceDigest(records, w);
  assert.ok(digest.includes("2/3 deterministic checks RE-VERIFIED FROM DISK"), `derived counts real: ${digest.split("\n")[2]}`);
  assert.ok(digest.includes("3 enumerated Phase 2 work items"), "work items counted from the artifact");
}

// 8. withTransientRetry: retries network flakes, passes through success, does
//    NOT retry billing failures, and gives up after the retry budget.
{
  // (a) a transient ECONNRESET then success -> retried, resolves.
  let n = 0;
  const flaky = withTransientRetry(async () => {
    n++; if (n < 3) throw new Error("read ECONNRESET"); return "ok";
  }, { retries: 5, backoffMs: 0 });
  assert.equal(await flaky("t", {}), "ok");
  assert.equal(n, 3, "retried past two network resets");

  // (b) a billing failure is NOT retried (retrying a wallet buys nothing).
  let m = 0;
  const billing = withTransientRetry(async () => { m++; throw new Error("credit balance is too low"); }, { retries: 5, backoffMs: 0 });
  await assert.rejects(() => billing("t", {}), /credit balance/);
  assert.equal(m, 1, "billing failure thrown immediately, no retry");

  // (c) sustained network failure exhausts the budget then throws.
  let k = 0;
  const dead = withTransientRetry(async () => { k++; throw new Error("ETIMEDOUT"); }, { retries: 2, backoffMs: 0 });
  await assert.rejects(() => dead("t", {}), /ETIMEDOUT/);
  assert.equal(k, 3, "initial try + 2 retries");
}

console.log("test-ratchet: all assertions passed");
