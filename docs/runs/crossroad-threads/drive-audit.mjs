#!/usr/bin/env node
// drive-audit.mjs — run Crossroad Threads audit passes until the gate PASSES,
// a fixed point (no progress between passes), or the cost fuse.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const runner = path.join(here, "run-audit.mjs");
const workdir = path.join(here, "workdir");
const loadJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const log = (m) => console.log(`[driver] ${m}`);

const MAX_PASSES = Number(process.env.TELOS_MAX_PASSES) || 12;
let prevState = null;

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  log(`pass ${pass}/${MAX_PASSES}: invoking audit ratchet`);
  const r = spawnSync("node", [runner], { cwd: root, stdio: "inherit" });
  log(`pass ${pass}: exited ${r.status}`);
  const summary = loadJson(path.join(here, "run-summary.json")) || {};
  if (summary.result === "PASS") {
    log(`CONVERGED on pass ${pass}: launch-audit gate PASSED`);
    process.exit(0);
  }
  const teams = loadJson(path.join(workdir, "checkpoint.teams.json")) || {};
  const blockers = loadJson(path.join(workdir, "checkpoint.blockers.json")) || {};
  const state = JSON.stringify({ converged: Object.keys(teams).sort(), blockers });
  log(`pass ${pass}: result=${summary.result ?? "?"}; converged=[${Object.keys(teams).join(", ") || "none"}]; contested=${Object.keys(blockers).length}`);
  if (state === prevState) {
    log("FIXED POINT: no progress between consecutive passes — stopping honestly");
    process.exit(1);
  }
  prevState = state;
}
log(`cost fuse reached (${MAX_PASSES} passes)`);
process.exit(1);
