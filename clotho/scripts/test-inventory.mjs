#!/usr/bin/env node
// test-inventory.mjs — Task 4a. Proves clotho/inventory.mjs commits: the five
// weavers (ids/order/integer versions); the per-weaver required inspected-source
// inventory-id table EXACTLY equal to the frozen normative table (D24/D26/D31);
// the LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS mapping (D32) deep-equal to the
// normative mapping, with exact keys/values and deep freeze proven; and that
// every committed file/root path names an existing filesystem entry. Plain
// node:assert/strict; fresh process.

import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { statSync as statSyncFs } from "node:fs";
import { execFileSync } from "node:child_process";

// Test-only git allowlist (like Task 2's fixture builder): this mechanically-
// enforcing unit runs git itself, so it follows the same no-shell/closed-shape
// discipline — EXACTLY one pinned `ls-files` invocation, nothing else.
const TEST_GIT_LS_FILES = ["ls-files", "--", "*package.json", "package.json"];
function testGitLsFiles(repoRoot) {
  const args = TEST_GIT_LS_FILES;
  if (!(args.length === 4 && args[0] === "ls-files" && args[1] === "--" && args[2] === "*package.json" && args[3] === "package.json")) {
    throw new Error("test-inventory: disallowed git ls-files shape");
  }
  return execFileSync("git", args, { cwd: repoRoot, shell: false, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

import {
  PACKAGE_ROOTS, PACKAGE_ROOTS_EXCLUDE, DOC_ROOTS, DOC_WEAVER_EXCLUDE, GLOBAL_EXCLUDE, CONTRACT_FILES,
  LEDGER_SOURCES, RUN_SOURCES, WEAVERS, REQUIRED_INVENTORY_IDS,
  LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, WEAVER_IMPL_FILES, PERMITTED_EXTERNAL_CLOSURE_FILES
} from "../inventory.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const abs = (rel) => path.join(REPO_ROOT, ...rel.split("/"));

// ---- 1. the five weavers -----------------------------------------------------
{
  assert.deepEqual(WEAVERS.map((w) => w.id), [
    "clotho-git-weaver", "clotho-code-weaver", "clotho-test-weaver",
    "clotho-doc-weaver", "clotho-ledger-weaver"
  ]);
  for (const w of WEAVERS) assert.ok(Number.isInteger(w.version), `${w.id} version is an integer`);
}

// ---- 2. required inventory-id table == frozen normative table ----------------
{
  // The frozen normative table (this plan). thread-ledger.mjs enforces the same
  // shape on every weave's coverage; a divergence here would desync the two.
  const NORMATIVE = {
    "clotho-git-weaver": ["package-files", "package-symbols"],
    "clotho-code-weaver": ["package-modules"],
    "clotho-test-weaver": ["package-manifests", "test-files"],
    "clotho-doc-weaver": ["doc-files"],
    "clotho-ledger-weaver": ["contract-files", "ledger-sources", "run-sources"]
  };
  assert.deepEqual(REQUIRED_INVENTORY_IDS, NORMATIVE, "inventory-id table equals frozen normative table");
  // ids are sorted+unique within each weaver
  for (const [id, ids] of Object.entries(REQUIRED_INVENTORY_IDS)) {
    assert.deepEqual([...ids].sort(), [...ids], `${id} ids sorted`);
    assert.equal(new Set(ids).size, ids.length, `${id} ids unique`);
  }
  // deeply frozen
  assert.ok(Object.isFrozen(REQUIRED_INVENTORY_IDS));
  assert.ok(Object.isFrozen(REQUIRED_INVENTORY_IDS["clotho-git-weaver"]));
  assert.throws(() => { REQUIRED_INVENTORY_IDS["clotho-git-weaver"].push("x"); }, TypeError);
}

// ---- 3. LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS (D32) ----------------------------
{
  const NORMATIVE = { "module": ["builtinModules", "isBuiltin"], "node:module": ["builtinModules", "isBuiltin"] };
  assert.deepEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, NORMATIVE, "deep-equal to normative mapping");
  // exact key set
  assert.deepEqual(Object.keys(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS).sort(), ["module", "node:module"]);
  // exact values (the sorted pair)
  for (const k of ["module", "node:module"]) {
    assert.deepEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS[k], ["builtinModules", "isBuiltin"]);
    assert.deepEqual([...LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS[k]].sort(), LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS[k]);
  }
  // deep freeze: outer mapping and inner arrays; mutation attempts fail and leave it unchanged
  assert.ok(Object.isFrozen(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS));
  assert.ok(Object.isFrozen(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["module"]));
  assert.ok(Object.isFrozen(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["node:module"]));
  assert.throws(() => { LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["module"].push("evil"); }, TypeError);
  assert.throws(() => { LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["module"][0] = "evil"; }, TypeError);
  assert.throws(() => { LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["node:new"] = ["x"]; }, TypeError);
  assert.deepEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, NORMATIVE, "unchanged after failed mutations");
}

// ---- 4. every committed path exists ------------------------------------------
{
  for (const root of PACKAGE_ROOTS) assert.ok(statSync(abs(root)).isDirectory(), `package root ${root} exists`);
  for (const root of DOC_ROOTS) assert.ok(statSync(abs(root)).isDirectory(), `doc root ${root} exists`);
  for (const f of CONTRACT_FILES) assert.ok(statSync(abs(f)).isFile(), `contract file ${f} exists`);
  for (const r of RUN_SOURCES) {
    assert.ok(statSync(abs(r.dir)).isDirectory(), `run dir ${r.dir} exists`);
    assert.ok(statSync(abs(r.summary)).isFile(), `run summary ${r.summary} exists`);
  }
  for (const list of Object.values(WEAVER_IMPL_FILES)) {
    for (const f of list) assert.ok(statSync(abs(f)).isFile(), `impl file ${f} exists`);
  }
  for (const f of PERMITTED_EXTERNAL_CLOSURE_FILES) assert.ok(statSync(abs(f)).isFile(), `permitted external ${f} exists`);
  // Every permitted external closure target must be a canonical merkle-dag/
  // primitive — the ONE frozen external namespace; no other prefix may appear.
  for (const f of PERMITTED_EXTERNAL_CLOSURE_FILES) {
    assert.ok(typeof f === "string" && f.startsWith("merkle-dag/") && !f.includes("\\") && !f.includes(".."),
      `permitted external ${JSON.stringify(f)} is a canonical merkle-dag/ path`);
  }
  // CONTRACT_FILES is sorted; LEDGER_SOURCES is the EXACT reviewed set at this SHA.
  assert.deepEqual([...CONTRACT_FILES].sort(), [...CONTRACT_FILES]);
  // exclusions are the reviewed values
  assert.deepEqual(DOC_WEAVER_EXCLUDE, ["docs/runs"]);
  assert.deepEqual(GLOBAL_EXCLUDE, ["docs/runs/clotho-self-weave"]);
}

// ---- 6. LEDGER_SOURCES is a committed closed source inventory (exact-final) ---
{
  // Not a deferred placeholder: the exact reviewed set at this SHA is empty
  // (Clotho weaves no committed ledger artifact). If a real entry is ever added
  // it must carry the { id, path, adapter } shape and name an existing file.
  assert.ok(Array.isArray(LEDGER_SOURCES) && Object.isFrozen(LEDGER_SOURCES));
  assert.deepEqual(LEDGER_SOURCES, []);
  for (const e of LEDGER_SOURCES) {
    assert.deepEqual(Object.keys(e).sort(), ["adapter", "id", "path"]);
    assert.ok(statSync(abs(e.path)).isFile(), `ledger source ${e.path} exists`);
  }
}

// ---- 7. PACKAGE_ROOTS completeness over TRACKED package.json (AM-40) ----------
{
  // AM-40 mandates the proof be over every directory holding a *tracked*
  // package.json (git-tracked, NOT a filesystem scan that could see stray or
  // untracked files). Enumerate them, then prove exact set equality with the
  // committed union and empty intersection — nothing silently omitted, no root
  // silently deleted, membership cannot drift.
  const out = testGitLsFiles(REPO_ROOT);
  const pkgPaths = out.split(/\r?\n/).filter(Boolean)
    .filter((p) => p === "package.json" || p.endsWith("/package.json"))   // basename exactly package.json
    .filter((p) => !p.split("/").includes("node_modules"));
  // A tracked repo-root package.json would need an explicit ruling (it is not a
  // weavable package root); assert none exists rather than silently dropping it.
  assert.ok(!pkgPaths.includes("package.json"), "no tracked repo-root package.json to classify");
  const discovered = new Set(pkgPaths.map((p) => p.slice(0, -"/package.json".length)));

  const included = new Set(PACKAGE_ROOTS);
  const excluded = new Set(PACKAGE_ROOTS_EXCLUDE);
  const union = new Set([...included, ...excluded]);

  // set equality BOTH directions
  for (const d of discovered) assert.ok(union.has(d), `tracked package dir ${d} is classified (PACKAGE_ROOTS or _EXCLUDE)`);
  for (const d of union) assert.ok(discovered.has(d), `classified root ${d} is a real tracked package dir`);
  assert.equal(union.size, discovered.size, "discovered == PACKAGE_ROOTS ∪ PACKAGE_ROOTS_EXCLUDE (exact set equality)");

  // disjointness: PACKAGE_ROOTS ∩ PACKAGE_ROOTS_EXCLUDE == ∅
  for (const d of PACKAGE_ROOTS) assert.ok(!excluded.has(d), `${d} not both included and excluded`);
  assert.equal(included.size + excluded.size, union.size, "PACKAGE_ROOTS ∩ PACKAGE_ROOTS_EXCLUDE == ∅");

  // exact AM-40 arrays, sorted + unique
  assert.deepEqual(PACKAGE_ROOTS, ["breakout", "build-gate", "clotho", "connectors/ai-peer-mcp", "merkle-dag"], "PACKAGE_ROOTS is exactly the five TELOS-spine packages (AM-40)");
  assert.deepEqual(PACKAGE_ROOTS_EXCLUDE, ["ai-forge", "forge", "saas-forge"], "PACKAGE_ROOTS_EXCLUDE is exactly the three sibling products (AM-40)");
  const sortedUnique = (a) => Array.isArray(a) && a.length === new Set(a).size && a.every((v, i) => i === 0 || a[i - 1] < v);
  assert.ok(sortedUnique(PACKAGE_ROOTS), "PACKAGE_ROOTS sorted + unique");
  assert.ok(sortedUnique(PACKAGE_ROOTS_EXCLUDE), "PACKAGE_ROOTS_EXCLUDE sorted + unique");
  assert.ok(statSyncFs(abs("clotho/package.json")).isFile()); // sanity
}

console.log("test-inventory: all assertions passed");
