#!/usr/bin/env node
// drive-audit.mjs — drive the TELOS self-audit to its terminal: gate PASS,
// fixed point, or fuse. Thin caller over forge/driver.mjs.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { driveUntil } from "../../../forge/driver.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const runner = path.join(here, "run-audit.mjs");
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
  isTransient: (summary) => typeof summary.result === "string" && summary.result.startsWith("error"),
  stateSnapshot: () => ({
    converged: Object.keys(loadJson(path.join(workdir, "checkpoint.teams.json")) || {}).sort(),
    blockers: loadJson(path.join(workdir, "checkpoint.blockers.json")) || {}
  }),
  maxPasses: Number(process.env.TELOS_MAX_PASSES) || 10,
  log
});

if (outcome === "pass") log(`CONVERGED on pass ${pass}: the factory certified its own launch audit — signed.`);
process.exit(outcome === "pass" ? 0 : 1);
