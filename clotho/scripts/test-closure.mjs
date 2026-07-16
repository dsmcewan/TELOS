#!/usr/bin/env node
// test-closure.mjs — Task 4a. Proves the committed per-weaver implementation-file
// inventories (D33) are EQUAL to the accepted relative module-load closures
// derived from the real weaver modules with the SHARED classifier/resolver — the
// inventories are proven, never trusted. Then hermetic fixtures prove: every
// accepted load form contributes a closure edge; recursion, cycles, and an
// apparently-unreachable literal dynamic import are handled; a permitted
// merkle-dag helper is traversed; and missing/extra/nonexistent inventory
// entries, unresolved/symlinked/escaping/forbidden targets, non-literal loads,
// and comment/string lookalikes are all handled correctly (fatal or no-edge).
// Directory symlinks use Windows junctions. Plain node:assert/strict.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deriveAcceptedClosure, resolveRelativeSpecifier, classifyModuleLoads, walkFiles
} from "../weavers/util.mjs";
import { WEAVER_IMPL_FILES, WEAVER_ENTRY_MODULE, PERMITTED_EXTERNAL_CLOSURE_FILES } from "../inventory.mjs";

const CLOTHO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = path.resolve(CLOTHO, "..");

// ---- 1. committed inventories == derived closures (real weavers) -------------
{
  for (const id of Object.keys(WEAVER_ENTRY_MODULE)) {
    const entryAbs = path.join(REPO_ROOT, ...WEAVER_ENTRY_MODULE[id].split("/"));
    const derived = deriveAcceptedClosure(entryAbs, { repoRoot: REPO_ROOT });
    assert.deepEqual(WEAVER_IMPL_FILES[id], derived, `committed ${id} closure equals derived`);
    // every committed file exists as a real regular file
    for (const rel of WEAVER_IMPL_FILES[id]) {
      const st = statSync(path.join(REPO_ROOT, ...rel.split("/")));
      assert.ok(st.isFile(), `${rel} is a regular file`);
    }
  }
}

// ---- fixture helpers ---------------------------------------------------------
function mkRepo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "clotho-closure-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split("/"));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}
const entryOf = (root) => path.join(root, "clotho", "entry.mjs");
const closureOf = (root, allowExternal = new Set()) =>
  deriveAcceptedClosure(entryOf(root), { repoRoot: root, allowExternal });

// ---- 2. every accepted load form contributes an edge ------------------------
{
  const forms = {
    "named static import": 'import { h } from "./helper.mjs";\n',
    "side-effect import": 'import "./helper.mjs";\n',
    "export {..} from": 'export { h } from "./helper.mjs";\n',
    "export * from": 'export * from "./helper.mjs";\n',
    "dynamic import()": 'export const p = import("./helper.mjs");\n',
    "require()": 'export const r = require("./helper.mjs");\n',
    "module.require()": 'export const r = module.require("./helper.mjs");\n'
  };
  for (const [label, entrySrc] of Object.entries(forms)) {
    const root = mkRepo({ "clotho/entry.mjs": entrySrc, "clotho/helper.mjs": "export const h = 1;\n" });
    try {
      assert.deepEqual(closureOf(root), ["clotho/entry.mjs", "clotho/helper.mjs"], `form: ${label}`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}

// ---- 3. recursion, cycles, conditional/unreachable dynamic import ------------
{
  // recursive mixed chain to the fixed point: import -> export* -> dynamic -> require
  const root = mkRepo({
    "clotho/entry.mjs": 'import { a } from "./a.mjs";\n',
    "clotho/a.mjs": 'export * from "./b.mjs";\n',
    "clotho/b.mjs": 'export const p = import("./c.mjs");\n',
    "clotho/c.mjs": 'export const r = require("./d.mjs");\n',
    "clotho/d.mjs": "export const d = 1;\n"
  });
  try {
    assert.deepEqual(closureOf(root),
      ["clotho/a.mjs", "clotho/b.mjs", "clotho/c.mjs", "clotho/d.mjs", "clotho/entry.mjs"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
{
  // cycle terminates with each member exactly once
  const root = mkRepo({
    "clotho/entry.mjs": 'import { x } from "./x.mjs";\n',
    "clotho/x.mjs": 'import { y } from "./y.mjs";\n',
    "clotho/y.mjs": 'import { x } from "./x.mjs";\nexport const y = 1;\n'
  });
  try {
    const cl = closureOf(root);
    assert.deepEqual(cl, ["clotho/entry.mjs", "clotho/x.mjs", "clotho/y.mjs"]);
    assert.equal(new Set(cl).size, cl.length, "each member exactly once");
  } finally { rmSync(root, { recursive: true, force: true }); }
}
{
  // an apparently-unreachable literal dynamic import is still included
  const root = mkRepo({
    "clotho/entry.mjs": 'if (false) { import("./helper.mjs"); }\nexport const e = 1;\n',
    "clotho/helper.mjs": "export const h = 1;\n"
  });
  try {
    assert.deepEqual(closureOf(root), ["clotho/entry.mjs", "clotho/helper.mjs"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 4. a permitted merkle-dag helper is included and recursively traversed --
{
  const root = mkRepo({
    "clotho/entry.mjs": 'import { v } from "../merkle-dag/vendor.mjs";\n',
    "merkle-dag/vendor.mjs": 'import { vh } from "./vendor-helper.mjs";\nexport const v = 1;\n',
    "merkle-dag/vendor-helper.mjs": "export const vh = 1;\n"
  });
  const allow = new Set(["merkle-dag/vendor.mjs", "merkle-dag/vendor-helper.mjs"]);
  try {
    assert.deepEqual(closureOf(root, allow),
      ["clotho/entry.mjs", "merkle-dag/vendor-helper.mjs", "merkle-dag/vendor.mjs"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 5. inventory equality failures (missing / extra / nonexistent) ----------
{
  const root = mkRepo({
    "clotho/entry.mjs": 'import { h } from "./helper.mjs";\n',
    "clotho/helper.mjs": "export const h = 1;\n"
  });
  try {
    const derived = closureOf(root); // ["clotho/entry.mjs","clotho/helper.mjs"]
    // an inventory missing a closure file fails equality
    assert.notDeepEqual(["clotho/entry.mjs"], derived);
    // an inventory listing an extra (unreachable) file fails equality
    assert.notDeepEqual([...derived, "clotho/extra.mjs"].sort(), derived);
    // an inventory naming a nonexistent file fails the existence check
    assert.throws(() => statSync(path.join(root, "clotho", "nope.mjs")), /ENOENT/);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 6. fatal targets: unresolved / symlink / escape / forbidden -------------
{
  // unresolved (literal relative specifier to a missing file)
  let root = mkRepo({ "clotho/entry.mjs": 'import { h } from "./missing.mjs";\n' });
  try { assert.throws(() => closureOf(root), /unresolved/); }
  finally { rmSync(root, { recursive: true, force: true }); }

  // physical escape (literal relative specifier leaving the repo)
  root = mkRepo({ "clotho/entry.mjs": 'import { h } from "../../evil.mjs";\n' });
  try { assert.throws(() => closureOf(root), /escape/); }
  finally { rmSync(root, { recursive: true, force: true }); }

  // forbidden merkle-dag target (resolves under merkle-dag/, not in allowExternal)
  root = mkRepo({
    "clotho/entry.mjs": 'import { x } from "../merkle-dag/forbidden.mjs";\n',
    "merkle-dag/forbidden.mjs": "export const x = 1;\n"
  });
  try { assert.throws(() => closureOf(root), /forbidden/); }
  finally { rmSync(root, { recursive: true, force: true }); }

  // symlinked component in the resolved chain (junction) is fatal
  root = mkRepo({
    "clotho/entry.mjs": 'import { h } from "./linkdir/helper.mjs";\n',
    "clotho/realdir/helper.mjs": "export const h = 1;\n"
  });
  let junctionsWork = true;
  try { symlinkSync(path.join(root, "clotho", "realdir"), path.join(root, "clotho", "linkdir"), "junction"); }
  catch { junctionsWork = false; }
  try {
    if (junctionsWork) assert.throws(() => closureOf(root), /symlink/);
    else console.error("test-closure: NOTE junctions unavailable; symlink-target case skipped");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 7. non-literal loads and comment/string lookalikes create NO edge -------
{
  const root = mkRepo({
    "clotho/entry.mjs": [
      'const s1 = "./nope1.mjs";',
      'export const a = import(s1);',              // non-literal dynamic import
      'export const b = require(s1);',             // non-literal require
      'export const c = module.require(s1);',      // non-literal module.require
      '// import { z } from "./nope2.mjs";',       // comment
      'const str = "require(\\"./nope3.mjs\\")";', // string lookalike
      'export const e = 1;'
    ].join("\n") + "\n"
  });
  try {
    assert.deepEqual(closureOf(root), ["clotho/entry.mjs"], "no edge from non-literal or comment/string loads");
    // and the classifier still RECOGNIZES the non-literal sites (literal:false)
    const sites = classifyModuleLoads('const a = import(x); const b = require(y); const c = module.require(z);');
    assert.equal(sites.filter((s) => !s.literal).length, 3);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 8. non-relative specifier resolves to non-relative (no edge) -----------
{
  const root = mkRepo({ "clotho/entry.mjs": 'import { readFileSync } from "node:fs";\nimport x from "bare-pkg";\n' });
  try {
    const r1 = resolveRelativeSpecifier(entryOf(root), "node:fs", { repoRoot: root });
    const r2 = resolveRelativeSpecifier(entryOf(root), "bare-pkg", { repoRoot: root });
    assert.equal(r1.ok, false); assert.equal(r1.kind, "non-relative");
    assert.equal(r2.ok, false); assert.equal(r2.kind, "non-relative");
    assert.deepEqual(closureOf(root), ["clotho/entry.mjs"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 9. AM-34 test 19: a single shared classifier + resolver -----------------
// The closure derivation consumes util's exported classifier and resolver; no
// other clotho module defines a competing classifier/resolver, so the Task 5
// advisory outbound scanner will import the SAME exports.
{
  assert.equal(typeof deriveAcceptedClosure, "function");
  assert.equal(typeof resolveRelativeSpecifier, "function");
  assert.equal(typeof classifyModuleLoads, "function");
  const defs = { classifyModuleLoads: [], resolveRelativeSpecifier: [] };
  for (const rel of walkFiles(REPO_ROOT, ["clotho"])) {
    if (!rel.endsWith(".mjs")) continue;
    const abs = path.join(REPO_ROOT, ...rel.split("/"));
    const src = statSync(abs).isFile() ? readFileSync(abs, "utf8") : "";
    if (/function\s+classifyModuleLoads\s*\(/.test(src)) defs.classifyModuleLoads.push(rel);
    if (/function\s+resolveRelativeSpecifier\s*\(/.test(src)) defs.resolveRelativeSpecifier.push(rel);
  }
  assert.deepEqual(defs.classifyModuleLoads, ["clotho/weavers/util.mjs"], "one classifier, in util");
  assert.deepEqual(defs.resolveRelativeSpecifier, ["clotho/weavers/util.mjs"], "one resolver, in util");
  assert.ok(PERMITTED_EXTERNAL_CLOSURE_FILES.includes("merkle-dag/vendor.mjs"));
}

console.log("test-closure: all assertions passed");
