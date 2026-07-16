#!/usr/bin/env node
// test-util.mjs — Task 4a. Real coverage of clotho/weavers/util.mjs: the counted-
// iterator constructor (D26/D29), the physical-containment helper (D21), the
// real-file walker (root/symlink rejection), the module-load classifier and
// Phase 1 export scanner (comment/string/metacharacter safety), and the import
// parser. Directory symlinks are created as Windows junctions (portable without
// privilege; lstat reports them as symbolic links). Plain node:assert/strict.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  makeCountedSource, physicalContainment, walkFiles, seedSourceDescriptors,
  classifyModuleLoads, scanExports, scanImports, identifierUsedOutside, escapeRegExp,
  validateGitArgs, isFullSha
} from "../weavers/util.mjs";

// ---- 1. counted-iterator (D26/D29) ------------------------------------------
{
  // full consumption: counted exactly once each, exhausted on normal completion
  const c = makeCountedSource("inv", ["a", "b", "c"]);
  const got = [];
  for (const x of c.source) got.push(x);
  assert.deepEqual(got, ["a", "b", "c"]);
  assert.deepEqual(c.accounting(), { inventory_id: "inv", expected_cardinality: 3, observed_count: 3, exhausted: true });

  // partial consumption: an item requested but not completed is NOT counted
  const p = makeCountedSource("inv2", ["a", "b", "c"]);
  const it = p.source[Symbol.iterator]();
  assert.equal(it.next().value, "a"); // requested a, consumer has not moved on
  assert.deepEqual(p.accounting(), { inventory_id: "inv2", expected_cardinality: 3, observed_count: 0, exhausted: false });
  assert.equal(it.next().value, "b"); // moving on completes a (count 1), not b
  assert.deepEqual(p.accounting(), { inventory_id: "inv2", expected_cardinality: 3, observed_count: 1, exhausted: false });

  // exhaustion recorded ONLY on normal completion (break => not exhausted)
  const b = makeCountedSource("inv3", ["a", "b", "c"]);
  for (const x of b.source) { if (x === "b") break; }
  assert.equal(b.accounting().exhausted, false);
  assert.equal(b.accounting().observed_count, 1); // only "a" completed before break

  // cardinality equals the configured list length
  assert.equal(makeCountedSource("z", [1, 2, 3, 4]).accounting().expected_cardinality, 4);

  // the weaver receives ONLY the iterable — accounting is not reachable through it
  const s = makeCountedSource("x", ["a"]).source;
  assert.equal(typeof s.accounting, "undefined");
  assert.deepEqual(Object.keys(s), []); // only the (symbol-keyed) iterator
}

// ---- 2. physical-containment helper (D21) -----------------------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-contain-"));
  const outside = mkdtempSync(path.join(tmpdir(), "clotho-outside-"));
  try {
    mkdirSync(path.join(repo, "a", "b"), { recursive: true });
    writeFileSync(path.join(repo, "a", "b", "file.txt"), "x");
    // plain nested path accepted
    assert.equal(physicalContainment(repo, "a/b/file.txt"), true);
    assert.equal(physicalContainment(repo, "a/b"), true);

    let junctionsWork = true;
    try {
      // symlinked nested parent component (junction under repo) -> rejected
      symlinkSync(path.join(repo, "a"), path.join(repo, "linkdir"), "junction");
    } catch { junctionsWork = false; }

    if (junctionsWork) {
      assert.equal(physicalContainment(repo, "linkdir/b/file.txt"), false, "symlinked parent component rejected");
      // symlinked allowed root: first component is a symlink -> rejected
      assert.equal(physicalContainment(repo, "linkdir"), false, "symlinked root component rejected");
      // escape via a symlink target pointing outside the repo -> rejected
      symlinkSync(outside, path.join(repo, "escape"), "junction");
      writeFileSync(path.join(outside, "secret.txt"), "s");
      assert.equal(physicalContainment(repo, "escape/secret.txt"), false, "escape via symlink target rejected");
    } else {
      console.error("test-util: NOTE junctions unavailable; containment symlink cases skipped");
    }
    // a candidate escaping the repo lexically is rejected
    assert.equal(physicalContainment(repo, "../elsewhere"), false);
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
}

// ---- 3. walker: real regular files only; reject root escape and symlinks -----
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-walk-"));
  try {
    mkdirSync(path.join(repo, "pkg", "sub"), { recursive: true });
    writeFileSync(path.join(repo, "pkg", "a.mjs"), "");
    writeFileSync(path.join(repo, "pkg", "sub", "b.mjs"), "");
    const walked = walkFiles(repo, ["pkg"]);
    assert.deepEqual(walked, ["pkg/a.mjs", "pkg/sub/b.mjs"]); // sorted, POSIX, real files only

    // root escape rejected
    assert.throws(() => walkFiles(repo, ["../outside"]), /escapes repository/);

    let junctionsWork = true;
    try { symlinkSync(path.join(repo, "pkg"), path.join(repo, "linkpkg"), "junction"); }
    catch { junctionsWork = false; }
    if (junctionsWork) {
      // a symlinked root is rejected outright
      assert.throws(() => walkFiles(repo, ["linkpkg"]), /root is a symlink/);
      // a symlinked entry inside a walked root is not followed
      const walked2 = walkFiles(repo, ["."]);
      assert.ok(!walked2.some((p) => p.startsWith("linkpkg/")), "symlinked entry not followed");
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

// ---- 4. classifier / export scanner / import parser (lexical safety) ---------
{
  const src = [
    'import def from "./def.mjs";',
    'import { alpha as al, beta } from "./pkg.mjs";',
    'import * as ns from "./ns.mjs";',
    'import "./side.mjs";',
    'export * from "./star.mjs";',
    'export { z } from "./named.mjs";',
    'const p = import("./dyn.mjs");',
    'const q = import(variable);',
    'const r = require("./req.cjs");',
    'const s = module.require("./mreq.cjs");',
    'const t = require(dynVar);',
    '// import "./comment.mjs" is a comment, not an edge',
    'const str = "import \\"./string.mjs\\"";',
    'export function foo() { al(); }',
    'export const bar = 1;'
  ].join("\n");

  const forms = classifyModuleLoads(src);
  const find = (form, spec) => forms.some((f) => f.form === form && f.specifier === spec && f.literal);
  assert.ok(find("import", "./def.mjs"));
  assert.ok(find("import", "./pkg.mjs"));
  assert.ok(find("import", "./ns.mjs"));
  assert.ok(find("import-side-effect", "./side.mjs"));
  assert.ok(find("export-star", "./star.mjs"));
  assert.ok(find("export-from", "./named.mjs"));
  assert.ok(find("dynamic-import", "./dyn.mjs"));
  assert.ok(find("require", "./req.cjs"));
  assert.ok(find("module-require", "./mreq.cjs"));
  // non-literal dynamic/require reported with literal:false, no specifier
  assert.ok(forms.some((f) => f.form === "dynamic-import" && f.specifier === null && !f.literal));
  assert.ok(forms.some((f) => f.form === "require" && f.specifier === null && !f.literal));
  // comment/string lookalikes create no edge
  assert.ok(!forms.some((f) => f.specifier === "./comment.mjs"));
  assert.ok(!forms.some((f) => f.specifier === "./string.mjs"));

  const ex = scanExports(src);
  assert.deepEqual(ex.exports, ["bar", "foo"]);
  assert.ok(ex.warnings.some((w) => /export \{ \.\.\. \}/.test(w)));
  assert.ok(ex.warnings.some((w) => /export \*/.test(w)));

  const imps = scanImports(src);
  const pkg = imps.find((i) => i.specifier === "./pkg.mjs");
  assert.deepEqual(pkg.bindings, [
    { form: "named", imported: "alpha", local: "al" },
    { form: "named", imported: "beta", local: "beta" }
  ]);

  // metacharacter-safe identifier matching: "al" is used (in foo), "beta" is not,
  // and "al" does not spuriously match inside "alpha"/other tokens.
  const spans = imps.map((i) => i.span);
  assert.equal(identifierUsedOutside(src, "al", spans), true);
  assert.equal(identifierUsedOutside(src, "beta", spans), false);
  const tricky = 'const x = alpha; const y = "al"; // al\nconst z = bal + ali;';
  assert.equal(identifierUsedOutside(tricky, "al", []), false, "al must not match inside alpha/bal/ali/string/comment");
  assert.equal(escapeRegExp("a.$b*"), "a\\.\\$b\\*");
}

// ---- 5. git-arg allowlist + SHA guard ---------------------------------------
{
  for (const ok of [
    ["rev-parse", "HEAD"], ["rev-parse", "--is-shallow-repository"],
    ["rev-list", "--max-parents=0", "HEAD"], ["hash-object", "--no-filters", "--", "clotho/x.mjs"],
    ["log", "-Sfoo", "--format=%H", "--reverse", "--", "clotho/x.mjs"],
    ["log", "--format=%H", "--reverse", "--", "clotho/x.mjs"]
  ]) validateGitArgs(ok);
  for (const bad of [
    ["log", "--oneline"], ["status"], ["log", "--format=%H", "clotho/x.mjs"],
    ["rev-parse", "--all"], ["hash-object", "clotho/x.mjs"], ["log", "-S", "--", "p"],
    ["log", "--format=%H", "--reverse", "--", "-evil"]
  ]) assert.throws(() => validateGitArgs(bad), /git:/, JSON.stringify(bad));
  assert.equal(isFullSha("a".repeat(40)), true);
  assert.equal(isFullSha("A".repeat(40)), false);
  assert.equal(isFullSha("a".repeat(39)), false);
}

// ---- 6. source-descriptor seeding (injected git) ----------------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-seed-"));
  try {
    mkdirSync(path.join(repo, "pkg"), { recursive: true });
    writeFileSync(path.join(repo, "pkg", "a.mjs"), "export const x = 1;\nexport function y() {}\n");
    writeFileSync(path.join(repo, "pkg", "b.mjs"), "const nope = 1;\n"); // no Phase 1 export
    writeFileSync(path.join(repo, "pkg", "data.json"), "{}\n");          // non-.mjs walked file
    const blobFor = { "pkg/a.mjs": "a".repeat(40), "pkg/b.mjs": "b".repeat(40), "pkg/data.json": "c".repeat(40) };
    const calls = [];
    const git = (args) => { calls.push(args.slice()); return blobFor[args[3]] + "\n"; };

    const { files, symbols } = seedSourceDescriptors(repo, ["pkg"], git);
    // files: every walked file, sorted by path, blob from hash-object
    assert.deepEqual(files, [
      { path: "pkg/a.mjs", blob_sha: "a".repeat(40) },
      { path: "pkg/b.mjs", blob_sha: "b".repeat(40) },
      { path: "pkg/data.json", blob_sha: "c".repeat(40) }
    ]);
    // symbols: Phase 1 exports only, sorted by (path, symbol), SAME blob as the file
    assert.deepEqual(symbols, [
      { path: "pkg/a.mjs", symbol: "x", blob_sha: "a".repeat(40) },
      { path: "pkg/a.mjs", symbol: "y", blob_sha: "a".repeat(40) }
    ]);
    // exact hash-object args, one per walked file
    assert.deepEqual(calls, [
      ["hash-object", "--no-filters", "--", "pkg/a.mjs"],
      ["hash-object", "--no-filters", "--", "pkg/b.mjs"],
      ["hash-object", "--no-filters", "--", "pkg/data.json"]
    ]);
    // a non-40-hex blob is fatal
    assert.throws(() => seedSourceDescriptors(repo, ["pkg"], () => "not-a-blob\n"), /bad blob_sha/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

console.log("test-util: all assertions passed");
