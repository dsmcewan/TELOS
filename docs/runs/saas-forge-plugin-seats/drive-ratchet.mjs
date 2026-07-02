#!/usr/bin/env node
// drive-ratchet.mjs — run ratchet passes until the market gate PASSES, a fixed
// point (no progress between passes), or the cost fuse. Thin caller over the
// generic fixed-point driver in forge/driver.mjs.
//
//   node docs/runs/saas-forge-plugin-seats/drive-ratchet.mjs

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { driveUntil } from "../../../forge/driver.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const runner = path.join(here, "run-ratchet.mjs");
const workdir = path.join(here, "workdir");
const loadJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const log = (m) => console.log(`[driver] ${m}`);

const { outcome, pass } = await driveUntil({
  invoke: async (pass) => {
    const r = spawnSync("node", [runner], { cwd: root, stdio: "inherit" });
    const summary = loadJson(path.join(here, "run-summary.json")) || {};
    const teams = loadJson(path.join(workdir, "checkpoint.teams.json")) || {};
    const blockers = loadJson(path.join(workdir, "checkpoint.blockers.json")) || {};
    log(`pass ${pass}: exited ${r.status}; result=${summary.result ?? "?"}; converged=[${Object.keys(teams).join(", ") || "none"}]; contested=${Object.keys(blockers).length}`);
    return summary;
  },
  isTerminal: (summary) => summary.result === "PASS",
  stateSnapshot: () => ({
    converged: Object.keys(loadJson(path.join(workdir, "checkpoint.teams.json")) || {}).sort(),
    blockers: loadJson(path.join(workdir, "checkpoint.blockers.json")) || {}
  }),
  maxPasses: Number(process.env.TELOS_MAX_PASSES) || 15,
  log
});

if (outcome === "pass") log(`CONVERGED on pass ${pass}: market gate PASSED`);
process.exit(outcome === "pass" ? 0 : 1);
