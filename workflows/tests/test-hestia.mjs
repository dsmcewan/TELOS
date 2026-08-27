#!/usr/bin/env node

// Semantic tests for the hestia workflow's residue ship gate. The Workflow
// runtime provides args/agent/parallel/log as ambient globals and treats the
// file as an async function body; this harness reproduces exactly that: strip
// the meta export, wrap the source in an AsyncFunction, and inject stubs. The
// gate under test: with merge:true, a PR ships ONLY when its residue evidence
// is present and clean — dirty, unscanned, or garbled evidence blocks it.
// (This file lives under workflows/tests/ so the runtime never loads it as a
// workflow, and workflows/ stays package-less by design: a package.json here
// would enroll it in the tracked-package completeness enumeration.)

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(HERE, "..", "hestia.js"), "utf8").replace("export const meta", "const meta");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function run(args, agentStub) {
  const parallel = (fns) => Promise.all(fns.map((f) => f()));
  const log = () => {};
  const fn = new AsyncFunction("args", "agent", "parallel", "log", src);
  return fn(args, agentStub, parallel, log);
}

// Label-dispatching agent stub: audits always find one mechanical fix; fix
// agents return the injected pr_url; verify returns the injected fixture;
// ship agents record which PR they were asked to merge.
function mkAgent({ prUrls, residue, shipLog }) {
  return async (_prompt, opts = {}) => {
    const label = opts.label || "";
    if (label.startsWith("audit:")) {
      const repo = label.slice("audit:".length);
      return { repo, verdict: "passes", findings: [{ rank: 1, path: "README.md", what: "stray temp file", kind: "mechanical", fix: "remove it" }] };
    }
    if (label.startsWith("fix:")) {
      const repo = label.slice("fix:".length);
      return { repo, pr_url: prUrls[repo] ?? null, note: "tests green" };
    }
    if (label === "verify:residue") return residue;
    if (label.startsWith("ship:")) { shipLog.push(opts); return "merged abc1234"; }
    throw new Error(`unexpected agent label: ${label}`);
  };
}

const A = "https://github.com/o/a/pull/1";
const B = "https://github.com/o/b/pull/2";
const cleanEntry = (repo, pr) => ({ repo, prs: [{ pr, residue_findings: [] }], ci_summary: "green" });

// 1. Clean residue + merge:true -> every shipped PR gets a ship agent.
{
  const shipLog = [];
  const res = await run(
    { repos: ["o/a", "o/b"], merge: true },
    mkAgent({ prUrls: { "o/a": A, "o/b": B }, residue: { repos: [cleanEntry("o/a", A), cleanEntry("o/b", B)] }, shipLog })
  );
  assert.equal(shipLog.length, 2, "both clean PRs ship");
  assert.equal(res.residue_gate.blocked.length, 0);
  assert.equal(res.merged.length, 2);
}

// 2. PR A dirty / PR B clean -> A blocked with findings and NO ship agent; B merges.
{
  const shipLog = [];
  const res = await run(
    { repos: ["o/a", "o/b"], merge: true },
    mkAgent({
      prUrls: { "o/a": A, "o/b": B },
      residue: { repos: [{ repo: "o/a", prs: [{ pr: A, residue_findings: [{ where: "body", term: "sweep" }] }], ci_summary: "green" }, cleanEntry("o/b", B)] },
      shipLog
    })
  );
  assert.equal(shipLog.length, 1, "only the clean PR ships");
  assert.deepEqual(res.merged.map((m) => m.pr), [B]);
  assert.equal(res.residue_gate.blocked.length, 1);
  assert.equal(res.residue_gate.blocked[0].blocker, "residue-dirty");
  assert.equal(res.residue_gate.blocked[0].findings[0].term, "sweep");
}

// 3. Residue entry MISSING for a shipped PR -> blocked (fail-closed), no ship agent.
{
  const shipLog = [];
  const res = await run(
    { repos: ["o/a", "o/b"], merge: true },
    mkAgent({ prUrls: { "o/a": A, "o/b": B }, residue: { repos: [cleanEntry("o/b", B)] }, shipLog })
  );
  assert.equal(shipLog.length, 1, "the unscanned PR never ships");
  assert.equal(res.residue_gate.blocked.length, 1);
  assert.equal(res.residue_gate.blocked[0].blocker, "residue-missing");
}

// 4. merge:false -> zero ship agents regardless of clean evidence.
{
  const shipLog = [];
  const res = await run(
    { repos: ["o/a"], merge: false },
    mkAgent({ prUrls: { "o/a": A }, residue: { repos: [cleanEntry("o/a", A)] }, shipLog })
  );
  assert.equal(shipLog.length, 0, "merging is the owner's act");
  assert.deepEqual(res.merged, []);
  assert.equal(res.residue_gate.clean.length, 1, "gate still reports readiness");
}

// 5. Garbled/failed verify (falsy or non-schema) -> ALL shipped PRs blocked,
//    structured report intact, no throw.
for (const garbage of [null, "not an object", { repos: "nope" }, { repos: [{ repo: "o/a", prs: "nope" }] }]) {
  const shipLog = [];
  const res = await run(
    { repos: ["o/a"], merge: true },
    mkAgent({ prUrls: { "o/a": A }, residue: garbage, shipLog })
  );
  assert.equal(shipLog.length, 0, `no ship agent on garbled verify (${JSON.stringify(garbage)})`);
  assert.equal(res.residue_gate.blocked.length, 1);
  assert.equal(res.residue_gate.blocked[0].blocker, "residue-missing");
}

// 6. pr_url:null (nothing mechanical / no PR) is excluded from the gate — not
//    reported as residue-missing, and never shipped.
{
  const shipLog = [];
  const res = await run(
    { repos: ["o/a"], merge: true },
    mkAgent({ prUrls: {}, residue: { repos: [] }, shipLog })
  );
  assert.equal(shipLog.length, 0);
  assert.equal(res.residue_gate.blocked.length, 0, "nothing shipped, nothing blocked");
  assert.equal(res.residue_gate.clean.length, 0);
}

console.log("test-hestia: all assertions passed");
