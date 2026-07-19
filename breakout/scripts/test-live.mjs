#!/usr/bin/env node

// Live-path tests. The verdict must be decided by the deterministic verifier
// (facts), with the prose council demoted to advisory `discovery`. Keyless: the
// council is injected via `discover`, and checks run against this real file.

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path, { dirname } from "node:path";
import { runLiveBreakout } from "../live.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const selfName = fileURLToPath(import.meta.url).split(/[\\/]/).pop();

// 1. The verdict is decided by the checks, NOT by the council. A passing check
//    yields meets even when the council is "never satisfied".
{
  const result = await runLiveBreakout({
    workstream: "frontend-brand-experience",
    checks: [{ type: "file_exists", path: selfName }],
    baseDir: here,
    discover: async () => ({ role: "discovery", surviving_blockers: ["the council is never satisfied"] }),
  });
  assert.equal(result.converged, true);
  assert.equal(result.finalStatus, "meets");
  assert.ok(result.discovery && result.discovery.surviving_blockers.length > 0, "council ran as advisory discovery");
}

// 2. A failing check forces needs-work even if discovery declares all-good — the
//    council cannot rescue a claim the facts reject.
{
  const result = await runLiveBreakout({
    workstream: "frontend-brand-experience",
    checks: [{ type: "file_exists", path: selfName + ".does-not-exist" }],
    baseDir: here,
    discover: async () => ({ role: "discovery", surviving_blockers: [] }),
  });
  assert.equal(result.converged, false);
  assert.equal(result.finalStatus, "needs-work");
}

// 3. No checks -> meets cannot be verified.
{
  const result = await runLiveBreakout({ workstream: "x", checks: [], discover: async () => ({ role: "discovery" }) });
  assert.equal(result.converged, false);
}

// 4. A discovery (MCP/council) error is captured, not thrown; the verdict still stands.
{
  const result = await runLiveBreakout({
    workstream: "frontend-brand-experience",
    checks: [{ type: "file_exists", path: selfName }],
    baseDir: here,
    discover: async () => { throw new Error("mcp down"); },
  });
  assert.equal(result.converged, true);
  assert.ok(result.discovery && /mcp down/.test(result.discovery.error));
}

// 5. A live command cwd is confined physically as well as lexically. Neither a
//    `..` escape nor a symlink/junction may redirect execution outside baseDir.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "telos-live-cwd-"));
  const base = path.join(root, "base");
  const outside = path.join(root, "outside");
  mkdirSync(base);
  mkdirSync(outside);
  symlinkSync(outside, path.join(base, "escape-link"), process.platform === "win32" ? "junction" : "dir");

  const lexicalSentinel = path.join(outside, "lexical-command-ran.txt");
  const physicalSentinel = path.join(outside, "physical-command-ran.txt");
  const lexical = await runLiveBreakout({
    workstream: "cwd-confinement",
    baseDir: base,
    checks: [{
      type: "command",
      command: process.execPath,
      args: ["-e", 'require("node:fs").writeFileSync("lexical-command-ran.txt", "ran")'],
      cwd: "../outside",
    }],
  });
  const physical = await runLiveBreakout({
    workstream: "cwd-confinement",
    baseDir: base,
    checks: [{
      type: "command",
      command: process.execPath,
      args: ["-e", 'require("node:fs").writeFileSync("physical-command-ran.txt", "ran")'],
      cwd: "escape-link",
    }],
  });

  assert.deepEqual(
    {
      lexicalConverged: lexical.converged,
      lexicalExecutedOutside: existsSync(lexicalSentinel),
      physicalConverged: physical.converged,
      physicalExecutedOutside: existsSync(physicalSentinel),
    },
    {
      lexicalConverged: false,
      lexicalExecutedOutside: false,
      physicalConverged: false,
      physicalExecutedOutside: false,
    },
    "live command cwd escapes must fail before subprocess execution"
  );
}

console.log("live: all tests passed");
