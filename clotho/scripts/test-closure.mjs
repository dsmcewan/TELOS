#!/usr/bin/env node
// test-closure.mjs — Task 4a. Proves the committed per-weaver implementation-file
// inventories (D33) are EQUAL to the accepted relative module-load closures
// derived from the real weaver modules with the SHARED classifier/resolver — the
// inventories are proven, never trusted. The committed permitted-external policy
// (PERMITTED_EXTERNAL_CLOSURE_FILES) is the SAME policy used in the normative
// equality check. Then hermetic fixtures prove: every accepted load form
// contributes a closure edge and cannot be omitted from the inventory; recursion,
// cycles, and an apparently-unreachable literal dynamic import are handled; a
// permitted merkle-dag helper is traversed; and every failure mode
// (missing/extra/nonexistent inventory; unresolved/ambiguous-extension/symlinked/
// non-regular/escaping/forbidden target; symlinked or out-of-scope entry;
// non-literal loads; comment/string lookalikes) is handled correctly (fatal or
// no-edge). The committed-inventory equality/existence check and the failure
// fixtures share ONE harness. Directory symlinks use Windows junctions and must
// RUN (a junction-creation failure fails the test, it is never skipped). Plain
// node:assert/strict.

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

// The ONE harness used for BOTH committed inventories and failure fixtures:
// derive the closure, require exact set-and-order equality with the claimed
// inventory, and require every claimed file to be a real regular file. Any
// derivation-fatal condition, mismatch, or missing/non-regular entry -> false.
function inventoryMatches(claimed, entryAbs, repoRoot, allowExternal = new Set()) {
  let derived;
  try { derived = deriveAcceptedClosure(entryAbs, { repoRoot, allowExternal }); }
  catch { return false; }
  if (claimed.length !== derived.length) return false;
  for (let i = 0; i < claimed.length; i++) if (claimed[i] !== derived[i]) return false;
  for (const rel of claimed) {
    let st;
    try { st = statSync(path.join(repoRoot, ...rel.split("/"))); } catch { return false; }
    if (!st.isFile()) return false;
  }
  return true;
}

// ---- 1. committed inventories == derived closures (real weavers) -------------
// Uses the SAME allowExternal policy the inventory commits.
{
  const allow = new Set(PERMITTED_EXTERNAL_CLOSURE_FILES);
  for (const id of Object.keys(WEAVER_ENTRY_MODULE)) {
    const entryAbs = path.join(REPO_ROOT, ...WEAVER_ENTRY_MODULE[id].split("/"));
    assert.ok(inventoryMatches(WEAVER_IMPL_FILES[id], entryAbs, REPO_ROOT, allow),
      `committed ${id} inventory equals derived closure (with committed permitted-external policy)`);
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
    "export * as ns from": 'export * as ns from "./helper.mjs";\n',
    "dynamic import()": 'export const p = import("./helper.mjs");\n',
    "require()": 'export const r = require("./helper.mjs");\n',
    "module.require()": 'export const r = module.require("./helper.mjs");\n'
  };
  for (const [label, entrySrc] of Object.entries(forms)) {
    const root = mkRepo({ "clotho/entry.mjs": entrySrc, "clotho/helper.mjs": "export const h = 1;\n" });
    try {
      assert.deepEqual(closureOf(root), ["clotho/entry.mjs", "clotho/helper.mjs"], `form: ${label}`);
      // an inventory OMITTING the form-only-reached member FAILS the harness
      assert.equal(inventoryMatches(["clotho/entry.mjs"], entryOf(root), root), false,
        `omission of a member reached only via ${label} fails equality`);
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

// ---- 5. inventory equality failures through the shared harness ---------------
{
  const root = mkRepo({
    "clotho/entry.mjs": 'import { h } from "./helper.mjs";\n',
    "clotho/helper.mjs": "export const h = 1;\n",
    "clotho/extra.mjs": "export const x = 1;\n" // a real but unreachable file
  });
  try {
    // exact match holds
    assert.equal(inventoryMatches(["clotho/entry.mjs", "clotho/helper.mjs"], entryOf(root), root), true);
    // missing a closure file fails
    assert.equal(inventoryMatches(["clotho/entry.mjs"], entryOf(root), root), false, "missing member fails");
    // an extra (real but unreachable) file fails
    assert.equal(inventoryMatches(["clotho/entry.mjs", "clotho/extra.mjs", "clotho/helper.mjs"], entryOf(root), root), false, "extra file fails");
    // a nonexistent claimed file fails (equality and/or existence)
    assert.equal(inventoryMatches(["clotho/entry.mjs", "clotho/nope.mjs"], entryOf(root), root), false, "nonexistent file fails");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 6. derivation-fatal targets --------------------------------------------
{
  // unresolved (literal relative specifier to a missing file)
  let root = mkRepo({ "clotho/entry.mjs": 'import { h } from "./missing.mjs";\n' });
  try { assert.throws(() => closureOf(root), /unresolved/); }
  finally { rmSync(root, { recursive: true, force: true }); }

  // ambiguous extension: extensionless and non-.mjs relative specifiers are fatal
  root = mkRepo({ "clotho/entry.mjs": 'import { h } from "./helper";\n', "clotho/helper.mjs": "export const h=1;\n" });
  try { assert.throws(() => closureOf(root), /ambiguous-extension/); }
  finally { rmSync(root, { recursive: true, force: true }); }
  root = mkRepo({ "clotho/entry.mjs": 'import { h } from "./helper.js";\n', "clotho/helper.js": "export const h=1;\n" });
  try { assert.throws(() => closureOf(root), /ambiguous-extension/); }
  finally { rmSync(root, { recursive: true, force: true }); }

  // non-regular target: a directory named like a module is fatal
  root = mkRepo({ "clotho/entry.mjs": 'import { h } from "./dir.mjs";\n' });
  mkdirSync(path.join(root, "clotho", "dir.mjs"), { recursive: true });
  try { assert.throws(() => closureOf(root), /non-regular/); }
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

  // symlinked component in the resolved chain (junction) is fatal — must run
  root = mkRepo({
    "clotho/entry.mjs": 'import { h } from "./linkdir/helper.mjs";\n',
    "clotho/realdir/helper.mjs": "export const h = 1;\n"
  });
  symlinkSync(path.join(root, "clotho", "realdir"), path.join(root, "clotho", "linkdir"), "junction");
  try { assert.throws(() => closureOf(root), /symlink/); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

// ---- 6b. the ENTRY undergoes the same checks as a resolved target -----------
{
  // entry reached through a symlinked directory component -> fatal (junction)
  let root = mkRepo({ "clotho/realdir/entry.mjs": "export const e = 1;\n" });
  symlinkSync(path.join(root, "clotho", "realdir"), path.join(root, "clotho", "linkdir"), "junction");
  try {
    assert.throws(() => deriveAcceptedClosure(path.join(root, "clotho", "linkdir", "entry.mjs"), { repoRoot: root }), /symlink/);
  } finally { rmSync(root, { recursive: true, force: true }); }

  // entry outside the admissible set (not under clotho/, not permitted) -> escape
  root = mkRepo({ "other/entry.mjs": "export const e = 1;\n" });
  try {
    assert.throws(() => deriveAcceptedClosure(path.join(root, "other", "entry.mjs"), { repoRoot: root }), /escape/);
  } finally { rmSync(root, { recursive: true, force: true }); }

  // a nonexistent entry -> fatal
  root = mkRepo({ "clotho/keep.mjs": "export const k = 1;\n" });
  try {
    assert.throws(() => deriveAcceptedClosure(path.join(root, "clotho", "ghost.mjs"), { repoRoot: root }), /does not exist/);
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

// ---- 9. AM-34 test 19: ONE shared classifier + resolver, both consumers ------
// The closure derivation consumes util's exported classifier and resolver; the
// code weaver consumes the SAME exported resolver; no other clotho module defines
// a competing classifier/resolver or a second relative-specifier resolution
// (join+normalize+extension append). The Task 5 advisory scanner will import the
// same exports.
{
  assert.equal(typeof deriveAcceptedClosure, "function");
  assert.equal(typeof resolveRelativeSpecifier, "function");
  assert.equal(typeof classifyModuleLoads, "function");

  const defs = { classifyModuleLoads: [], resolveRelativeSpecifier: [] };
  for (const rel of walkFiles(REPO_ROOT, ["clotho"])) {
    if (!rel.endsWith(".mjs")) continue;
    const abs = path.join(REPO_ROOT, ...rel.split("/"));
    const src = readFileSync(abs, "utf8");
    if (/function\s+classifyModuleLoads\s*\(/.test(src)) defs.classifyModuleLoads.push(rel);
    if (/function\s+resolveRelativeSpecifier\s*\(/.test(src)) defs.resolveRelativeSpecifier.push(rel);
    // no clotho module other than util may append a `.mjs` extension itself (a
    // second, closure-only resolver): the shared resolver is the sole authority.
    if (rel !== "clotho/weavers/util.mjs") {
      assert.ok(!/\+=\s*["']\.mjs["']/.test(src), `${rel} must not append a .mjs extension (only the shared resolver resolves specifiers)`);
    }
  }
  assert.deepEqual(defs.classifyModuleLoads, ["clotho/weavers/util.mjs"], "one classifier, in util");
  assert.deepEqual(defs.resolveRelativeSpecifier, ["clotho/weavers/util.mjs"], "one resolver, in util");

  // the code weaver consumes the SHARED resolver by name from util
  const codeSrc = readFileSync(path.join(CLOTHO, "weavers", "code.mjs"), "utf8");
  assert.match(codeSrc, /import\s*\{[^}]*\bresolveRelativeSpecifier\b[^}]*\}\s*from\s*["']\.\/util\.mjs["']/,
    "code.mjs imports the shared resolveRelativeSpecifier from util");

  // The closure-derivation consumer is proven EXPLICITLY: deriveAcceptedClosure's
  // OWN body must call BOTH the shared classifier and the shared resolver by name,
  // so the shared-consumer guarantee cannot silently regress when Task 5's advisory
  // scanner lands (it must import these same exports, never fork a private copy).
  const utilSrc = readFileSync(path.join(CLOTHO, "weavers", "util.mjs"), "utf8");
  const dStart = utilSrc.indexOf("export function deriveAcceptedClosure");
  assert.ok(dStart !== -1, "deriveAcceptedClosure is defined in util");
  const dNext = utilSrc.indexOf("\nexport ", dStart + 1);
  const dBody = utilSrc.slice(dStart, dNext === -1 ? utilSrc.length : dNext);
  assert.match(dBody, /classifyModuleLoads\s*\(/, "deriveAcceptedClosure body calls classifyModuleLoads");
  assert.match(dBody, /resolveRelativeSpecifier\s*\(/, "deriveAcceptedClosure body calls resolveRelativeSpecifier");

  assert.ok(PERMITTED_EXTERNAL_CLOSURE_FILES.includes("merkle-dag/vendor.mjs"));
}

// ---- 12. DIRECT real-repo closure equality (derived list shown on failure) ---
// Beyond the boolean inventoryMatches harness, assert the exact derived closures
// so a reviewer sees the real-repo fixed point directly.
{
  const allow = new Set(PERMITTED_EXTERNAL_CLOSURE_FILES);
  const derive = (rel) => deriveAcceptedClosure(path.join(REPO_ROOT, ...rel.split("/")), { repoRoot: REPO_ROOT, allowExternal: allow });

  const gitClosure = derive("clotho/weavers/git.mjs");
  assert.deepEqual(gitClosure, ["clotho/registry.mjs", "clotho/weavers/git.mjs"],
    "git.mjs closure (derived: " + JSON.stringify(gitClosure) + ")");

  const codeClosure = derive("clotho/weavers/code.mjs");
  assert.deepEqual(codeClosure, ["clotho/registry.mjs", "clotho/weavers/code.mjs", "clotho/weavers/util.mjs"],
    "code.mjs closure (derived: " + JSON.stringify(codeClosure) + ")");

  // registry.mjs imports only node:crypto, so its OWN accepted-relative closure is
  // exactly itself — proving the git/code inventories are the genuine recursive
  // fixed point, not an untested coincidence.
  const regClosure = derive("clotho/registry.mjs");
  assert.deepEqual(regClosure, ["clotho/registry.mjs"],
    "registry.mjs is a closure leaf (derived: " + JSON.stringify(regClosure) + ")");
}

// ---- 13. require-style edge to a non-.mjs target is fatal (extension rule) ----
// test-util proves require('./x.cjs') / module.require('./x.cjs') is a recognized
// literal load SITE; here we pin what the closure RESOLVER does with that site — a
// non-.mjs target is a FATAL ambiguous-extension, never an edge to a .cjs file.
{
  for (const form of ['require("./x.cjs")', 'module.require("./x.cjs")']) {
    const root = mkRepo({ "clotho/entry.mjs": `export const r = ${form};\n`, "clotho/x.cjs": "module.exports = 1;\n" });
    try {
      assert.throws(() => closureOf(root), /ambiguous-extension/,
        `literal ${form} of a non-.mjs target is fatal ambiguous-extension`);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
}

console.log("test-closure: all assertions passed");
