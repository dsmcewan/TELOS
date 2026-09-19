#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import path from "node:path";

import { verifyWorkshop } from "./workshop-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const DEFAULT_RUN_DIR = "docs/runs/production-profile-compiler-1-workshop";

function parseArgs(argv) {
  const args = { runDir: DEFAULT_RUN_DIR, allowSmoke: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--run-dir") args.runDir = argv[++index];
    else if (argv[index] === "--allow-smoke") args.allowSmoke = true;
    else throw new Error(`unknown argument: ${argv[index]}`);
  }
  if (typeof args.runDir !== "string" || args.runDir.length === 0 || path.isAbsolute(args.runDir) || args.runDir.includes("\\") || args.runDir.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("run directory must be a normalized repository-relative path");
  }
  if (args.allowSmoke && args.runDir === DEFAULT_RUN_DIR) {
    throw new Error("--allow-smoke cannot target the governed workshop directory");
  }
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const result = verifyWorkshop({
    repoRoot: ROOT,
    runDir: path.resolve(ROOT, ...args.runDir.split("/")),
    allowSmoke: args.allowSmoke
  });
  if (!result.ok) {
    console.error(`WORKSHOP VERIFICATION BLOCKED\n${result.errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 3;
  } else {
    const label = result.mode === "smoke" ? "WORKSHOP SMOKE VERIFIED" : "WORKSHOP VERIFIED";
    process.stdout.write(`${label}: ${result.event_count} signed events, ${result.provenance_count} distinct ${result.mode} calls, state=${result.state}, terminal=${result.terminal}, authorization=false\n`);
  }
} catch (error) {
  console.error(`WORKSHOP VERIFICATION ERROR: ${error.message}`);
  process.exitCode = 2;
}
