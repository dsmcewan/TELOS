#!/usr/bin/env node
// Deterministic TELOS gate for Clotho Phase 1 Slice 1 (v12 Task 1 scaffold).
//
// Re-runs the Slice 1 acceptance criteria against the REAL on-disk artifacts
// using TELOS's own verifier (breakout/verifier.mjs). This is the gate stage of
// "run the implementation PR back through TELOS": no self-report is trusted, the
// verdict is decided from facts. finalStatus=meets only if every check passes.
//
// This is the deterministic gate only. It does NOT perform the required-seat
// review (a live council) or human acceptance — both remain separate.

import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CLOTHO = path.join(ROOT, "clotho");
const node = process.execPath;

const { runVerifiedBreakout, fileExistsCheck, fileContainsCheck, commandCheck } =
  await import(pathToFileURL(path.join(ROOT, "breakout/verifier.mjs")).href);

const checks = [
  fileExistsCheck("pkg", path.join(CLOTHO, "package.json")),
  fileExistsCheck("check-script", path.join(CLOTHO, "scripts/check.mjs")),
  fileExistsCheck("test-all", path.join(CLOTHO, "scripts/test-all.mjs")),
  fileExistsCheck("scaffold-test", path.join(CLOTHO, "scripts/test-registry.mjs")),
  fileContainsCheck("esm", path.join(CLOTHO, "package.json"), "\"type\": \"module\""),
  fileContainsCheck("engines", path.join(CLOTHO, "package.json"), ">=18"),
  // check.mjs green (recursive node --check)
  commandCheck("check", "clotho check", node, ["scripts/check.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  // test-all green (runs the scaffold test -> "clotho scaffold OK")
  commandCheck("test-all", "clotho test-all", node, ["scripts/test-all.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  // zero dependencies (exit 1 if any dependency field present)
  commandCheck("zero-deps", "zero dependencies", node,
    ["-e", "const p=require('./package.json');process.exit(p.dependencies||p.devDependencies?1:0)"],
    { cwd: CLOTHO, expectExit: 0 }),
  // .github/workflows untouched by this slice (Task 0 is separate)
  commandCheck("workflows-untouched", "no workflow change in this slice", "git",
    ["diff", "--quiet", "df9c7119194995355ade61c20d404125fda0225b", "--", ".github/"],
    { cwd: ROOT, expectExit: 0 })
];

const record = await runVerifiedBreakout(
  { workstream: "clotho-phase-1-slice-1", claimedStatus: "meets", goalStatus: "meets" },
  checks
);

writeFileSync(path.join(HERE, "gate-result.json"), JSON.stringify(record, null, 2));

const facts = record.verified_facts.map((f) => `  [${f.ok ? "PASS" : "FAIL"}] ${f.id}: ${f.detail}`).join("\n");
console.log(facts);
console.log(`-> finalStatus: ${record.finalStatus}, converged: ${record.converged}`);
if (record.surviving_blockers.length) console.log("blockers:", record.surviving_blockers);
process.exit(record.converged ? 0 : 2);
