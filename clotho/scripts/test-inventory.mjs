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

import {
  PACKAGE_ROOTS, DOC_ROOTS, DOC_WEAVER_EXCLUDE, GLOBAL_EXCLUDE, CONTRACT_FILES,
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
  // CONTRACT_FILES is sorted; LEDGER_SOURCES is empty at this PR (AM-17)
  assert.deepEqual([...CONTRACT_FILES].sort(), [...CONTRACT_FILES]);
  assert.deepEqual(LEDGER_SOURCES, []);
  // exclusions are the reviewed values
  assert.deepEqual(DOC_WEAVER_EXCLUDE, ["docs/runs"]);
  assert.deepEqual(GLOBAL_EXCLUDE, ["docs/runs/clotho-self-weave"]);
}

console.log("test-inventory: all assertions passed");
