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
  validateGitArgs, gitSpawnOptions, isFullSha
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

    // Directory symlinks via junctions. These normative cases must RUN, not be
    // skipped — if junction creation fails the test fails loudly.
    symlinkSync(path.join(repo, "a"), path.join(repo, "linkdir"), "junction");
    // symlinked nested parent component -> rejected
    assert.equal(physicalContainment(repo, "linkdir/b/file.txt"), false, "symlinked parent component rejected");
    // symlinked component named as the candidate root of the walk -> rejected
    assert.equal(physicalContainment(repo, "linkdir"), false, "symlinked component rejected");
    // a SYMLINK PASSED AS THE ALLOWED ROOT is rejected (not followed)
    assert.equal(physicalContainment(path.join(repo, "linkdir"), "b/file.txt"), false, "symlinked allowed root rejected");
    // escape via a symlink target pointing outside the repo -> rejected
    symlinkSync(outside, path.join(repo, "escape"), "junction");
    writeFileSync(path.join(outside, "secret.txt"), "s");
    assert.equal(physicalContainment(repo, "escape/secret.txt"), false, "escape via symlink target rejected");
    // a candidate escaping the repo lexically is rejected
    assert.equal(physicalContainment(repo, "../elsewhere"), false);
    // a nonexistent tail beneath a real chain is contained (missing != escape)
    assert.equal(physicalContainment(repo, "a/b/newfile.txt"), true, "nonexistent tail under real chain contained");
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

    // Directory symlink via junction — normative, must run (fail if unavailable).
    symlinkSync(path.join(repo, "pkg"), path.join(repo, "linkpkg"), "junction");
    // a symlinked root is rejected outright
    assert.throws(() => walkFiles(repo, ["linkpkg"]), /root is a symlink/);
    // a symlinked ENTRY inside a walked root is REJECTED (fail-closed), not
    // silently skipped
    assert.throws(() => walkFiles(repo, ["."]), /symlinked entry is not permitted/);
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

  // ---- classifier robustness (the ONE shared D33 classifier) ----------------
  // member-call lookalikes are NOT accepted loader forms
  const mem = classifyModuleLoads('obj.import("./m1.mjs"); a.module.require("./m2.mjs"); o.require("./m3.mjs");');
  assert.equal(mem.filter((s) => s.specifier === "./m1.mjs").length, 0, "obj.import is not a load");
  assert.equal(mem.filter((s) => s.specifier === "./m2.mjs").length, 0, "a.module.require is not a load");
  assert.equal(mem.filter((s) => s.specifier === "./m3.mjs").length, 0, "o.require is not a load");
  // a regex literal containing a from/import lookalike creates NO edge
  const rgx = classifyModuleLoads('const re = /from "\\.\\/rx.mjs"/g;\nconst re2 = /import\\("\\.\\/rx2.mjs"\\)/;\n');
  assert.equal(rgx.filter((s) => s.specifier === "./rx.mjs" || s.specifier === "./rx2.mjs").length, 0, "regex interior is not a load");
  // a literal import() inside a template ${...} substitution IS detected
  const tpl = classifyModuleLoads('const t = `x ${ import("./tpl.mjs") } y`;\n');
  assert.ok(tpl.some((s) => s.form === "dynamic-import" && s.specifier === "./tpl.mjs" && s.literal), "load inside template substitution detected");
  // a from-clause binds to its OWN governing keyword: adjacent dynamic-then-static
  const adj = classifyModuleLoads('import("./dynA.mjs"); import { z } from "./statA.mjs";');
  assert.ok(adj.some((s) => s.form === "dynamic-import" && s.specifier === "./dynA.mjs"));
  assert.ok(adj.some((s) => s.form === "import" && s.specifier === "./statA.mjs"));
  assert.equal(adj.filter((s) => s.form === "import").length, 1, "no fabricated static import from the dynamic site");
  // export * as ns from  -> export-star (recognized namespace re-export variant)
  const ns = classifyModuleLoads('export * as things from "./ns2.mjs";');
  assert.ok(ns.some((s) => s.form === "export-star" && s.specifier === "./ns2.mjs"), "export * as ns is export-star");
  // two declarations on one line are attributed independently
  const two = classifyModuleLoads('import { a } from "./l1.mjs"; import { b } from "./l2.mjs";');
  assert.deepEqual(two.filter((s) => s.form === "import").map((s) => s.specifier).sort(), ["./l1.mjs", "./l2.mjs"]);

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
    ["log", "--format=%H", "--reverse", "--", "-evil"],
    // reordered flags rejected
    ["log", "--reverse", "--format=%H", "--", "clotho/x.mjs"],
    ["log", "-Sfoo", "--reverse", "--format=%H", "--", "clotho/x.mjs"],
    // duplicated flags rejected
    ["log", "--format=%H", "--format=%H", "--reverse", "--", "clotho/x.mjs"],
    // missing required flag rejected
    ["log", "--format=%H", "--", "clotho/x.mjs"],
    // extra trailing arg rejected
    ["log", "--format=%H", "--reverse", "--", "clotho/x.mjs", "extra"]
  ]) assert.throws(() => validateGitArgs(bad), /git:/, JSON.stringify(bad));
  assert.equal(isFullSha("a".repeat(40)), true);
  assert.equal(isFullSha("A".repeat(40)), false);
  assert.equal(isFullSha("a".repeat(39)), false);

  // gitSpawnOptions: caller-supplied cwd/shell/encoding CANNOT override the fixed,
  // security-relevant settings (they are spread last).
  const opts = gitSpawnOptions("/repo/root", { cwd: "/evil", shell: true, encoding: "hex", extra: 1 });
  assert.equal(opts.cwd, "/repo/root", "cwd cannot be overridden");
  assert.equal(opts.shell, false, "shell cannot be enabled");
  assert.equal(opts.encoding, "utf8", "encoding cannot be overridden");
  assert.deepEqual(opts.stdio, ["ignore", "pipe", "pipe"]);
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

    const { files, symbols, warnings } = seedSourceDescriptors(repo, ["pkg"], git);
    // files: every walked file, sorted by path, blob from hash-object
    assert.deepEqual(files, [
      { path: "pkg/a.mjs", blob_sha: "a".repeat(40) },
      { path: "pkg/b.mjs", blob_sha: "b".repeat(40) },
      { path: "pkg/data.json", blob_sha: "c".repeat(40) }
    ]);
    assert.ok(Array.isArray(warnings)); // no unsupported exports in these fixtures
    assert.equal(warnings.length, 0);
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

// ---- 7. duplicate export descriptors are fatal; unsupported exports warn ------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-seed2-"));
  try {
    mkdirSync(path.join(repo, "pkg"), { recursive: true });
    // two lexical `export const dupe` declarations for one file -> duplicate
    // descriptor, which seeding rejects (scanExports does not pre-dedupe names).
    writeFileSync(path.join(repo, "pkg", "dupe.mjs"), "export const dupe = 1;\nexport const dupe = 2;\n");
    const git = () => "a".repeat(40) + "\n";
    assert.throws(() => seedSourceDescriptors(repo, ["pkg"], git), /duplicate symbol descriptor/);

    // an unsupported export form warns (path-attributed) and yields no symbol.
    rmSync(path.join(repo, "pkg", "dupe.mjs"));
    writeFileSync(path.join(repo, "pkg", "re.mjs"), 'export * from "./other.mjs";\nexport const ok = 1;\n');
    const { symbols, warnings } = seedSourceDescriptors(repo, ["pkg"], git);
    assert.deepEqual(symbols.map((s) => s.symbol), ["ok"]);
    assert.ok(warnings.some((w) => w.path === "pkg/re.mjs" && /export \*/.test(w.message)), "unsupported export warned");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

console.log("test-util: all assertions passed");
