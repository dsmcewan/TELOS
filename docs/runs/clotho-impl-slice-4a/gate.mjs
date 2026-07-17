#!/usr/bin/env node
// Deterministic TELOS gate for Clotho Task 4a (closed inventory, substrate, git +
// code weavers). Re-runs the Task 4a acceptance criteria against the real on-disk
// artifacts via breakout/verifier.mjs. finalStatus=meets only if every check
// passes.

import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CLOTHO = path.join(ROOT, "clotho");
const node = process.execPath;
const BASE = "bb265b9"; // merged main incl. v15/AM-41 (Task 4a rebased onto it)

const { runVerifiedBreakout, fileExistsCheck, fileContainsCheck, commandCheck } =
  await import(pathToFileURL(path.join(ROOT, "breakout/verifier.mjs")).href);
process.env.ROOTDIR = ROOT;

const newFiles = [
  "inventory.mjs",
  "weavers/util.mjs",
  "weavers/git.mjs",
  "weavers/code.mjs",
  "scripts/test-closure.mjs"
];

const checks = [
  ...newFiles.map((f) => fileExistsCheck(`exists:${f}`, path.join(CLOTHO, f))),
  fileContainsCheck("git-weave", path.join(CLOTHO, "weavers/git.mjs"), "export function weave"),
  fileContainsCheck("code-weave", path.join(CLOTHO, "weavers/code.mjs"), "export function weave"),
  fileContainsCheck("frozen-table", path.join(CLOTHO, "inventory.mjs"), "REQUIRED_INVENTORY_IDS"),
  fileContainsCheck("loader-map", path.join(CLOTHO, "inventory.mjs"), "LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS"),
  fileContainsCheck("closure-test-derives", path.join(CLOTHO, "scripts/test-closure.mjs"), "WEAVER_IMPL_FILES"),
  commandCheck("check", "clotho check", node, ["scripts/check.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("test-all", "clotho test-all (incl. closure + frozen-table + D32 units)", node, ["scripts/test-all.mjs"], { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("zero-deps", "zero dependencies", node,
    ["-e", "const p=require('./package.json');process.exit(p.dependencies||p.devDependencies?1:0)"],
    { cwd: CLOTHO, expectExit: 0 }),
  // Every new clotho module imports only node: stdlib, clotho-relative, or the
  // permitted merkle-dag primitives (vendor.mjs) — no spine coupling beyond that.
  commandCheck("imports-permitted", "new modules import node:/clotho-relative/vendor only", node,
    ["-e", "const fs=require('fs');const mods=['inventory.mjs','weavers/util.mjs','weavers/git.mjs','weavers/code.mjs'];const ok=(x)=>x.startsWith('node:')||x.startsWith('./')||x==='../registry.mjs'||x.endsWith('merkle-dag/vendor.mjs');for(const m of mods){const s=fs.readFileSync(m,'utf8');const im=[...s.matchAll(/^import[^\\n]*from\\s+[\\\"']([^\\\"']+)[\\\"']/gm)].map(x=>x[1]);const bad=im.filter(x=>!ok(x));if(bad.length){console.error('bad import in '+m+': '+bad.join(','));process.exit(1);}}process.exit(0)"],
    { cwd: CLOTHO, expectExit: 0 }),
  commandCheck("confined", "diff confined to clotho/", node,
    ["-e", `const {execFileSync}=require('child_process');const out=execFileSync('git',['diff','--name-only','${BASE}','HEAD'],{cwd:process.env.ROOTDIR,encoding:'utf8'}).trim().split(/\\r?\\n/).filter(Boolean);process.exit(out.every(f=>f.startsWith('clotho/'))?0:1)`],
    { cwd: ROOT, expectExit: 0 })
];

const record = await runVerifiedBreakout(
  { workstream: "clotho-task-4a-inventory-weavers", claimedStatus: "meets", goalStatus: "meets" },
  checks
);
writeFileSync(path.join(HERE, "gate-result.json"), JSON.stringify(record, null, 2));
console.log(record.verified_facts.map((f) => `  [${f.ok ? "PASS" : "FAIL"}] ${f.id}: ${f.detail}`).join("\n"));
console.log(`-> finalStatus: ${record.finalStatus}, converged: ${record.converged}`);
if (record.surviving_blockers.length) console.log("blockers:", record.surviving_blockers);
process.exit(record.converged ? 0 : 2);
