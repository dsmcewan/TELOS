#!/usr/bin/env node
// Deterministic TELOS gate for Clotho Task 2 (registry.mjs). Re-runs the Task 2
// acceptance criteria against the real on-disk artifacts via breakout/verifier.mjs.
// finalStatus=meets only if every check passes. Gate stage only — the required-
// seat review + human acceptance are separate.

import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CLOTHO = path.join(ROOT, "clotho");
const node = process.execPath;
const BASE = "97e5239"; // main this task branched from

const { runVerifiedBreakout, fileExistsCheck, fileContainsCheck, commandCheck } =
  await import(pathToFileURL(path.join(ROOT, "breakout/verifier.mjs")).href);

const checks = [
  fileExistsCheck("registry", path.join(CLOTHO, "registry.mjs")),
  fileExistsCheck("registry-test", path.join(CLOTHO, "scripts/test-registry.mjs")),
  // real module + real test (not the scaffold)
  fileContainsCheck("has-node-kinds", path.join(CLOTHO, "registry.mjs"), "export const NODE_KINDS"),
  fileContainsCheck("has-derive-repo", path.join(CLOTHO, "registry.mjs"), "export function deriveRepositoryRef"),
  fileContainsCheck("test-realgit", path.join(CLOTHO, "scripts/test-registry.mjs"), "real-git"),
  // npm test green (check + test-all, incl. the real-git fixture)
  commandCheck("check", "clotho check", node, ["scripts/check.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("test-all", "clotho test-all", node, ["scripts/test-all.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  // zero dependencies
  commandCheck("zero-deps", "zero dependencies", node,
    ["-e", "const p=require('./package.json');process.exit(p.dependencies||p.devDependencies?1:0)"],
    { cwd: CLOTHO, expectExit: 0 }),
  // registry.mjs imports only node: stdlib (no external / merkle-dag import)
  commandCheck("stdlib-only", "registry imports node: only", node,
    ["-e", "const s=require('fs').readFileSync('registry.mjs','utf8');const m=[...s.matchAll(/^import[^\\n]*from\\s+[\\\"']([^\\\"']+)[\\\"']/gm)].map(x=>x[1]);process.exit(m.every(x=>x.startsWith('node:'))?0:1)"],
    { cwd: CLOTHO, expectExit: 0 }),
  // scaffold placeholder is gone
  commandCheck("no-scaffold", "scaffold placeholder replaced", node,
    ["-e", "const s=require('fs').readFileSync('scripts/test-registry.mjs','utf8');process.exit(s.includes('clotho scaffold OK')?1:0)"],
    { cwd: CLOTHO, expectExit: 0 }),
  // diff confined to clotho/ (no spine / no workflow change)
  commandCheck("confined", "diff confined to clotho/", node,
    ["-e", `const {execFileSync}=require('child_process');const out=execFileSync('git',['diff','--name-only','${BASE}','HEAD'],{cwd:process.env.ROOTDIR,encoding:'utf8'}).trim().split(/\\r?\\n/).filter(Boolean);process.exit(out.every(f=>f.startsWith('clotho/'))?0:1)`],
    { cwd: ROOT, expectExit: 0, }),
];

// pass ROOT to the confined check via env
process.env.ROOTDIR = ROOT;

const record = await runVerifiedBreakout(
  { workstream: "clotho-task-2-registry", claimedStatus: "meets", goalStatus: "meets" },
  checks
);

writeFileSync(path.join(HERE, "gate-result.json"), JSON.stringify(record, null, 2));
console.log(record.verified_facts.map((f) => `  [${f.ok ? "PASS" : "FAIL"}] ${f.id}: ${f.detail}`).join("\n"));
console.log(`-> finalStatus: ${record.finalStatus}, converged: ${record.converged}`);
if (record.surviving_blockers.length) console.log("blockers:", record.surviving_blockers);
process.exit(record.converged ? 0 : 2);
