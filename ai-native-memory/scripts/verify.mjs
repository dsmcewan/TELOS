#!/usr/bin/env node
// verify.mjs — proves each NORMATIVE contract equals what reality enforces, by running
// the oracle the host names for it. Exit 0 only if every pair is green.
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readJson, finding, printFindings, resolveWithin } from "./lib/record.mjs";

const SKIP = new Set(["node_modules", ".git"]);

function findContractFiles(root, out) {
  const contracts = [];
  const readDirectory = (dir) => {
    try {
      return readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      out.push(finding("FAIL", "verify", path.relative(root, dir) || ".", `cannot read directory: ${error.message}`));
      return [];
    }
  };
  const walk = (dir) => {
    for (const entry of readDirectory(dir)) {
      if (entry.isSymbolicLink() || !entry.isDirectory() || SKIP.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.name !== "memory") {
        walk(full);
        continue;
      }
      const contractDir = path.join(full, "CONTRACTS");
      if (!existsSync(contractDir)) continue;
      for (const contract of readDirectory(contractDir)) {
        if (contract.isFile() && contract.name.endsWith(".json")) {
          contracts.push(path.join(contractDir, contract.name));
        }
      }
    }
  };
  walk(root);
  return contracts;
}

const relativeContractPath = (root, file) => path.relative(root, file).split(path.sep).join("/");

const mapPath = process.argv[2];
if (!mapPath) { console.error("usage: verify.mjs <verify-map.json>"); process.exit(1); }
let map;
try { map = readJson(mapPath); } catch (e) { console.error("VERIFY_ERROR: " + e.message); process.exit(1); }
if (!Array.isArray(map)) { console.error("VERIFY_ERROR: verify-map must be an array"); process.exit(1); }
const base = path.dirname(path.resolve(mapPath));
const out = [];
if (map.length === 0) out.push(finding("FAIL", "verify", "verify-map.json", "map must name at least one contract"));
const seen = new Set();
for (const entry of map) {
  if (!entry || typeof entry !== "object") {
    out.push(finding("FAIL", "verify", "verify-map.json", "entry must be an object"));
    continue;
  }
  if (seen.has(entry.contract)) {
    out.push(finding("FAIL", "verify", entry.contract, "duplicate contract entry"));
    continue;
  }
  seen.add(entry.contract);
  let cpath;
  let opath;
  let cwd;
  try {
    cpath = resolveWithin(base, entry.contract);
    opath = resolveWithin(base, entry.oracle);
    cwd = entry.cwd ? resolveWithin(base, entry.cwd) : base;
  } catch (error) {
    out.push(finding("FAIL", "verify", entry.contract, error.message));
    continue;
  }
  if (!existsSync(cpath)) {
    out.push(finding("FAIL", "verify", entry.contract, "contract file missing"));
    continue;
  }
  let contract;
  try {
    contract = readJson(cpath);
  } catch (error) {
    out.push(finding("FAIL", "verify", entry.contract, error.message));
    continue;
  }
  if (contract.status !== "NORMATIVE-CURRENT") {
    out.push(finding("FAIL", "verify", entry.contract, `contract status is ${contract.status}`));
    continue;
  }
  if (contract.oracle?.test !== entry.oracle) {
    out.push(finding("FAIL", "verify", entry.contract, `map oracle ${entry.oracle} != declared ${contract.oracle?.test}`));
    continue;
  }
  if (!existsSync(opath)) {
    out.push(finding("FAIL", "verify", entry.contract, `oracle missing: ${entry.oracle}`));
    continue;
  }
  const result = spawnSync(process.execPath, [opath], {
    cwd,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    out.push(finding("FAIL", "verify", entry.contract, `oracle ${entry.oracle} exited ${result.status}: ${(result.stderr || result.stdout || "").trim().slice(0, 200)}`));
  }
}
for (const cpath of findContractFiles(base, out)) {
  const contractPath = relativeContractPath(base, cpath);
  if (seen.has(contractPath)) continue;
  let contract;
  try {
    contract = readJson(cpath);
  } catch (error) {
    out.push(finding("FAIL", "verify", contractPath, error.message));
    continue;
  }
  if (contract.status === "NORMATIVE-CURRENT") {
    out.push(finding("FAIL", "verify", contractPath, "normative contract missing from verify-map"));
  }
}
process.exit(printFindings(out, "verify"));
