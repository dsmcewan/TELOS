#!/usr/bin/env node
// Deterministic TELOS gate for Clotho Task 3 (thread-ledger.mjs). Re-runs the
// Task 3 acceptance criteria against the real on-disk artifacts via
// breakout/verifier.mjs. finalStatus=meets only if every check passes.

import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CLOTHO = path.join(ROOT, "clotho");
const node = process.execPath;
const BASE = "ed0e05c"; // main this task branched from

const { runVerifiedBreakout, fileExistsCheck, fileContainsCheck, commandCheck } =
  await import(pathToFileURL(path.join(ROOT, "breakout/verifier.mjs")).href);
process.env.ROOTDIR = ROOT;

const checks = [
  fileExistsCheck("ledger", path.join(CLOTHO, "thread-ledger.mjs")),
  fileExistsCheck("ledger-test", path.join(CLOTHO, "scripts/test-ledger.mjs")),
  fileContainsCheck("has-create", path.join(CLOTHO, "thread-ledger.mjs"), "export function createLedger"),
  fileContainsCheck("has-verify", path.join(CLOTHO, "thread-ledger.mjs"), "export async function verifyLedger"),
  fileContainsCheck("has-readedges", path.join(CLOTHO, "thread-ledger.mjs"), "export async function* readEdges"),
  fileContainsCheck("test-real", path.join(CLOTHO, "scripts/test-ledger.mjs"), "verifyLedger"),
  commandCheck("check", "clotho check", node, ["scripts/check.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("test-all", "clotho test-all", node, ["scripts/test-all.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("zero-deps", "zero dependencies", node,
    ["-e", "const p=require('./package.json');process.exit(p.dependencies||p.devDependencies?1:0)"],
    { cwd: CLOTHO, expectExit: 0 }),
  // thread-ledger imports only node: stdlib or clotho-relative modules (no spine)
  commandCheck("no-spine-import", "ledger imports node:/clotho-relative only", node,
    ["-e", "const s=require('fs').readFileSync('thread-ledger.mjs','utf8');const m=[...s.matchAll(/^import[^\\n]*from\\s+[\\\"']([^\\\"']+)[\\\"']/gm)].map(x=>x[1]);process.exit(m.every(x=>x.startsWith('node:')||x.startsWith('./'))?0:1)"],
    { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("confined", "diff confined to clotho/", node,
    ["-e", `const {execFileSync}=require('child_process');const out=execFileSync('git',['diff','--name-only','${BASE}','HEAD'],{cwd:process.env.ROOTDIR,encoding:'utf8'}).trim().split(/\\r?\\n/).filter(Boolean);process.exit(out.every(f=>f.startsWith('clotho/'))?0:1)`],
    { cwd: ROOT, expectExit: 0 })
];

const record = await runVerifiedBreakout(
  { workstream: "clotho-task-3-ledger", claimedStatus: "meets", goalStatus: "meets" },
  checks
);
writeFileSync(path.join(HERE, "gate-result.json"), JSON.stringify(record, null, 2));
console.log(record.verified_facts.map((f) => `  [${f.ok ? "PASS" : "FAIL"}] ${f.id}: ${f.detail}`).join("\n"));
console.log(`-> finalStatus: ${record.finalStatus}, converged: ${record.converged}`);
if (record.surviving_blockers.length) console.log("blockers:", record.surviving_blockers);
process.exit(record.converged ? 0 : 2);
