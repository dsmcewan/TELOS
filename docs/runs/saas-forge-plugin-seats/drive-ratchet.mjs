#!/usr/bin/env node
// drive-ratchet.mjs — run ratchet passes until the market gate PASSES.
//
// Stopping conditions, in order of honor:
//   PASS         run-summary.result === "PASS" (gate passed) -> exit 0
//   FIXED POINT  two consecutive passes with identical converged-team set and
//                identical banked blockers — the system has stopped learning;
//                more passes would only re-buy the same verdicts -> exit 1
//   COST FUSE    TELOS_MAX_PASSES (default 15) — a backstop, not a bound; the
//                fixed-point check is expected to fire long before it -> exit 1
//
//   node docs/runs/saas-forge-plugin-seats/drive-ratchet.mjs

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const ratchet = path.join(here, "run-ratchet.mjs");
const workdir = path.join(here, "workdir");

const loadJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const log = (m) => console.log(`[driver] ${m}`);

const MAX_PASSES = Number(process.env.TELOS_MAX_PASSES) || 15;
let prevState = null;

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  log(`pass ${pass}/${MAX_PASSES}: invoking ratchet`);
  const r = spawnSync("node", [ratchet], { cwd: root, stdio: "inherit" });
  log(`pass ${pass}: ratchet exited ${r.status}`);

  const summary = loadJson(path.join(here, "run-summary.json")) || {};
  if (summary.result === "PASS") {
    log(`CONVERGED on pass ${pass}: market gate PASSED`);
    process.exit(0);
  }

  const teams = loadJson(path.join(workdir, "checkpoint.teams.json")) || {};
  const blockers = loadJson(path.join(workdir, "checkpoint.blockers.json")) || {};
  const state = JSON.stringify({ converged: Object.keys(teams).sort(), blockers });
  log(`pass ${pass}: result=${summary.result ?? "?"}; converged=[${Object.keys(teams).join(", ") || "none"}]; contested=${Object.keys(blockers).length}`);
  if (state === prevState) {
    log("FIXED POINT: no progress between consecutive passes — stopping honestly (inspect banked blockers)");
    process.exit(1);
  }
  prevState = state;
}

log(`cost fuse reached (${MAX_PASSES} passes) without convergence or fixed point`);
process.exit(1);
