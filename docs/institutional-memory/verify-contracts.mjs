#!/usr/bin/env node
// verify-contracts.mjs — the "system reality" half of the institutional-memory
// layer. A machine-readable CONTRACT (clotho/memory/CONTRACTS/*.json) is only
// trustworthy as a VERIFIED PROJECTION of the running code. This script proves each
// NORMATIVE contract equals what the code actually enforces, and that
// CURRENT-AUTHORITY.json matches the plan bytes on disk. Same fail-closed discipline
// as the build-gate: never trust a document's self-report.
//
//   node docs/institutional-memory/verify-contracts.mjs
//   exit 0 => every checked contract == system reality; exit 2 => drift found.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");

const results = [];
const check = (id, ok, detail) => results.push({ id, ok, detail });
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const deepEq = (a, b) => canonicalize(a) === canonicalize(b);

// ---- 1. CURRENT-AUTHORITY.json active plan hash == disk ------------------------
try {
  const auth = readJson("CURRENT-AUTHORITY.json");
  const active = auth.active_plan;
  const real = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: readFileSync(path.join(ROOT, active.path), "utf8") }));
  check("authority:active-plan-hash", real === active.sha256, `disk=${real} record=${active.sha256}`);
  // every superseded plan hash is also verifiable from disk
  for (const s of auth.superseded || []) {
    const rp = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: readFileSync(path.join(ROOT, superPath(s.plan_version)), "utf8") }));
    check(`authority:superseded-${s.plan_version}-hash`, rp === s.sha256, `disk=${rp} record=${s.sha256}`);
  }
} catch (e) { check("authority:read", false, e.message); }

function superPath(v) {
  const map = { v11: "docs/runs/clotho-daedalus-delta10/matured-plan-v11.md", v12: "docs/runs/clotho-daedalus-delta11/matured-plan-v12.md", v13: "docs/runs/clotho-daedalus-delta12/matured-plan-v13.md", v14: "docs/runs/clotho-daedalus-delta13/matured-plan-v14.md" };
  return map[v];
}

// ---- 2. clotho package-roots contract == inventory.mjs -------------------------
try {
  const contract = readJson("clotho/memory/CONTRACTS/package-roots.json");
  const inv = await imp("clotho/inventory.mjs");
  check("contract:package-roots==PACKAGE_ROOTS", eqArr(contract.package_roots, inv.PACKAGE_ROOTS), `contract=${JSON.stringify(contract.package_roots)} code=${JSON.stringify(inv.PACKAGE_ROOTS)}`);
  check("contract:package-roots-exclude==PACKAGE_ROOTS_EXCLUDE", eqArr(contract.package_roots_exclude, inv.PACKAGE_ROOTS_EXCLUDE), `contract=${JSON.stringify(contract.package_roots_exclude)} code=${JSON.stringify(inv.PACKAGE_ROOTS_EXCLUDE)}`);
} catch (e) { check("contract:package-roots", false, e.message); }

// ---- 2b. inventory-id-table contract == inventory.REQUIRED_INVENTORY_IDS -------
try {
  const contract = readJson("clotho/memory/CONTRACTS/inventory-id-table.json");
  const inv = await imp("clotho/inventory.mjs");
  check("contract:inventory-id-table==REQUIRED_INVENTORY_IDS", deepEq(contract.required_inventory_ids, inv.REQUIRED_INVENTORY_IDS), "compared canonical JSON");
} catch (e) { check("contract:inventory-id-table", false, e.message); }

// ---- 2c. loader-safe-exports contract == inventory.LOADER_CAPABLE... -----------
try {
  const contract = readJson("clotho/memory/CONTRACTS/loader-safe-exports.json");
  const inv = await imp("clotho/inventory.mjs");
  check("contract:loader-safe-exports==LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS", deepEq(contract.loader_capable_builtin_safe_exports, inv.LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS), "compared canonical JSON");
} catch (e) { check("contract:loader-safe-exports", false, e.message); }

// ---- 3. every NORMATIVE contract declares a nonempty oracle --------------------
const CONTRACT_FILES = ["package-roots", "inventory-id-table", "loader-safe-exports", "source-profile", "git-allowlist"];
for (const name of CONTRACT_FILES) {
  try {
    const contract = readJson(`clotho/memory/CONTRACTS/${name}.json`);
    const hasOracle = contract.normativity === "NORMATIVE" ? (contract.oracle && Object.keys(contract.oracle).length > 0) : true;
    check(`discipline:normative-has-oracle(${name})`, !!hasOracle, `${contract.normativity} oracle=${contract.oracle ? "present" : "MISSING"}`);
  } catch (e) { check(`discipline:normative-has-oracle(${name})`, false, e.message); }
}

// ---- report -------------------------------------------------------------------
for (const r of results) console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.id}: ${r.detail}`);
const failed = results.filter((r) => !r.ok);
console.log(`-> ${results.length - failed.length}/${results.length} contracts match system reality`);
process.exit(failed.length ? 2 : 0);
