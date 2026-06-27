#!/usr/bin/env node

// Live-path tests. The verdict must be decided by the deterministic verifier
// (facts), with the prose council demoted to advisory `discovery`. Keyless: the
// council is injected via `discover`, and checks run against this real file.

import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
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

console.log("live: all tests passed");
