#!/usr/bin/env node
// test-code.mjs — Task 4a. Real coverage of clotho/weavers/code.mjs against a
// real on-disk fixture tree: alias resolution, all four permitted depends-on
// endpoint shapes, symbol- and file-level locators (repository_ref + blob_sha),
// no-export named import preserved as repository-file -> code-symbol, dedup,
// unused imports, comments/strings not counting as uses, unrepresentable-consumer
// only for unresolvable specifiers, counted-source exhaustion, and byte-equal
// {edges,warnings} over two runs. Plain node:assert/strict; fresh process.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { weave } from "../weavers/code.mjs";
import { makeCountedSource } from "../weavers/util.mjs";
import { canonicalJson, deriveNodeId } from "../registry.mjs";

const REPO = "git-root:" + "a".repeat(40);
const blob = (n) => String(n).padStart(2, "0").repeat(20); // distinct 40-hex per file

// ---- fixture tree ------------------------------------------------------------
const root = mkdtempSync(path.join(tmpdir(), "clotho-code-"));
try {
  const files = {
    "pkg-a/one.mjs": "export const alpha = 1;\nexport function beta() { return 2; }\n",
    "pkg-b/two.mjs": 'import { alpha as al } from "../pkg-a/one.mjs";\nexport function useOne() { return al; }\nexport function useTwo() { return al + 1; }\n',
    "pkg-b/noexp.mjs": 'import { alpha } from "../pkg-a/one.mjs";\nconsole.log(alpha);\n',
    "pkg-b/nsimp.mjs": 'import * as ns from "../pkg-a/one.mjs";\nexport const usesNs = ns.alpha;\n',
    "pkg-b/sideimp.mjs": 'import "../pkg-a/one.mjs";\nexport const s = 1;\n',
    "pkg-b/sidenoexp.mjs": 'import "../pkg-a/one.mjs";\nconst x = 1;\n',
    "pkg-b/dup.mjs": 'import { alpha as a } from "../pkg-a/one.mjs";\nexport function d() { return a + a; }\n',
    "pkg-b/unresolved.mjs": 'import { z } from "../pkg-a/missing.mjs";\nexport const u = z;\n',
    "pkg-b/unused.mjs": 'import { beta } from "../pkg-a/one.mjs";\nexport const w = 1;\n',
    "pkg-b/commentstr.mjs": 'import { alpha } from "../pkg-a/one.mjs";\n// alpha appears in this comment only\nconst t = "alpha in a string";\nexport const c = 1;\n'
  };
  for (const [rel, src] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split("/"));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, src);
  }

  // Seeds (what the driver would seed from util.walkFiles + git hash-object).
  const fileList = Object.keys(files).map((p) => ({ path: p, blob_sha: blob(Object.keys(files).indexOf(p) + 10) }));
  const blobOf = new Map(fileList.map((f) => [f.path, f.blob_sha]));
  const symbols = [
    { path: "pkg-a/one.mjs", symbol: "alpha", blob_sha: blobOf.get("pkg-a/one.mjs") },
    { path: "pkg-a/one.mjs", symbol: "beta", blob_sha: blobOf.get("pkg-a/one.mjs") },
    { path: "pkg-b/two.mjs", symbol: "useOne", blob_sha: blobOf.get("pkg-b/two.mjs") },
    { path: "pkg-b/two.mjs", symbol: "useTwo", blob_sha: blobOf.get("pkg-b/two.mjs") },
    { path: "pkg-b/nsimp.mjs", symbol: "usesNs", blob_sha: blobOf.get("pkg-b/nsimp.mjs") },
    { path: "pkg-b/sideimp.mjs", symbol: "s", blob_sha: blobOf.get("pkg-b/sideimp.mjs") },
    { path: "pkg-b/dup.mjs", symbol: "d", blob_sha: blobOf.get("pkg-b/dup.mjs") },
    { path: "pkg-b/unresolved.mjs", symbol: "u", blob_sha: blobOf.get("pkg-b/unresolved.mjs") },
    { path: "pkg-b/unused.mjs", symbol: "w", blob_sha: blobOf.get("pkg-b/unused.mjs") },
    { path: "pkg-b/commentstr.mjs", symbol: "c", blob_sha: blobOf.get("pkg-b/commentstr.mjs") }
  ].sort((a, b) => (a.path + a.symbol).localeCompare(b.path + b.symbol));

  const modOrder = Object.keys(files);
  const mkCtx = () => {
    const src = makeCountedSource("package-modules", modOrder.map((p) => ({ path: p, blob_sha: blobOf.get(p) })));
    return {
      ctx: { repoRoot: root, repositoryRef: REPO, files: fileList, symbols, sources: { "package-modules": src.source } },
      acct: src.accounting
    };
  };

  const { ctx, acct } = mkCtx();
  const { edges, warnings } = weave(ctx);

  // counted source exhausted exactly once
  assert.deepEqual(acct(), { inventory_id: "package-modules", expected_cardinality: modOrder.length, observed_count: modOrder.length, exhausted: true });

  const nid = (kind, locator) => deriveNodeId({ kind, locator });
  const cs = (p, sym) => nid("code-symbol", { repository_ref: REPO, path: p, symbol: sym, blob_sha: blobOf.get(p) });
  const rf = (p) => nid("repository-file", { repository_ref: REPO, path: p, blob_sha: blobOf.get(p) });
  const has = (fromId, toId) => edges.some((e) => e.from_node === fromId && e.to_node === toId && e.edge_kind === "depends-on");

  // 1. code-symbol -> code-symbol (alias al -> seeded export alpha), from BOTH exports
  assert.ok(has(cs("pkg-b/two.mjs", "useOne"), cs("pkg-a/one.mjs", "alpha")), "useOne -> alpha");
  assert.ok(has(cs("pkg-b/two.mjs", "useTwo"), cs("pkg-a/one.mjs", "alpha")), "useTwo -> alpha");
  // 2. repository-file -> code-symbol (no-export importer, preserved not downgraded)
  assert.ok(has(rf("pkg-b/noexp.mjs"), cs("pkg-a/one.mjs", "alpha")), "noexp file -> alpha symbol");
  // 3. code-symbol -> repository-file (namespace + side-effect, module-terminating)
  assert.ok(has(cs("pkg-b/nsimp.mjs", "usesNs"), rf("pkg-a/one.mjs")), "usesNs -> one file (namespace)");
  assert.ok(has(cs("pkg-b/sideimp.mjs", "s"), rf("pkg-a/one.mjs")), "s -> one file (side-effect)");
  // 4. repository-file -> repository-file (side-effect from a no-export module)
  assert.ok(has(rf("pkg-b/sidenoexp.mjs"), rf("pkg-a/one.mjs")), "sidenoexp file -> one file");

  // Direct locator-field assertions (not only node-id equality): a FILE-level
  // fallback edge and a SYMBOL-level edge carry repository_ref + blob_sha (+symbol).
  const fileLevel = edges.find((e) => e.from_node === rf("pkg-b/sidenoexp.mjs") && e.to_node === rf("pkg-a/one.mjs"));
  assert.ok(fileLevel, "file-level fallback edge present");
  assert.equal(fileLevel.from_locator.locator.repository_ref, REPO);
  assert.equal(fileLevel.from_locator.locator.blob_sha, blobOf.get("pkg-b/sidenoexp.mjs"));
  assert.equal(fileLevel.to_locator.locator.repository_ref, REPO);
  assert.equal(fileLevel.to_locator.locator.blob_sha, blobOf.get("pkg-a/one.mjs"));
  const symLevel = edges.find((e) => e.from_node === cs("pkg-b/two.mjs", "useOne") && e.to_node === cs("pkg-a/one.mjs", "alpha"));
  assert.ok(symLevel, "symbol-level edge present");
  assert.equal(symLevel.from_locator.locator.repository_ref, REPO);
  assert.equal(symLevel.from_locator.locator.symbol, "useOne");
  assert.equal(symLevel.from_locator.locator.blob_sha, blobOf.get("pkg-b/two.mjs"));
  assert.equal(symLevel.to_locator.locator.repository_ref, REPO);
  assert.equal(symLevel.to_locator.locator.symbol, "alpha");
  assert.equal(symLevel.to_locator.locator.blob_sha, blobOf.get("pkg-a/one.mjs"));

  // every edge validates + carries the file: source_ref of its consuming module
  for (const e of edges) {
    assert.equal(e.asserted_by, "clotho-code-weaver");
    assert.equal(e.assertion_status, "deterministic-extraction");
    assert.match(e.source_ref, /^file:pkg-b\/[a-z]+\.mjs@[0-9a-f]{40}$/);
    assert.equal(e.from_node, deriveNodeId(e.from_locator));
    assert.equal(e.to_node, deriveNodeId(e.to_locator));
  }

  // dedup: dup.mjs uses `a` twice in one export -> exactly one edge from d
  assert.equal(edges.filter((e) => e.from_node === cs("pkg-b/dup.mjs", "d")).length, 1, "dup collapsed to one edge");

  // unused import (unused.mjs: beta imported, never used) -> no edge
  assert.equal(edges.filter((e) => e.from_node === cs("pkg-b/unused.mjs", "w")).length, 0, "unused import emits no edge");
  // comments/strings do not count as a use (commentstr.mjs) -> no edge
  assert.equal(edges.filter((e) => e.from_node === cs("pkg-b/commentstr.mjs", "c")).length, 0, "comment/string is not a use");

  // unrepresentable-consumer ONLY for the unresolvable specifier — structured,
  // producer-attributed warning (D10/AM-39)
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].weaver, "clotho-code-weaver");
  assert.match(warnings[0].message, /unrepresentable-consumer: pkg-b\/unresolved\.mjs/);

  // byte-equal over two runs
  const run2 = weave(mkCtx().ctx);
  assert.equal(canonicalJson({ edges, warnings }), canonicalJson(run2), "byte-equal over two runs");
} finally {
  rmSync(root, { recursive: true, force: true });
}

// ---- C. regex-after-keyword: a binding appearing ONLY in `return /re/` is no use
{
  const r2 = mkdtempSync(path.join(tmpdir(), "clotho-code-rx-"));
  try {
    mkdirSync(path.join(r2, "pkg"), { recursive: true });
    writeFileSync(path.join(r2, "pkg", "dep.mjs"), "export const alpha = 1;\n");
    // `alpha` occurs only inside a regex literal after `return` — not an identifier use.
    writeFileSync(path.join(r2, "pkg", "use.mjs"), 'import { alpha } from "./dep.mjs";\nexport function f() { return /alpha/; }\n');
    const files2 = [{ path: "pkg/dep.mjs", blob_sha: blob(50) }, { path: "pkg/use.mjs", blob_sha: blob(51) }];
    const symbols2 = [{ path: "pkg/dep.mjs", symbol: "alpha", blob_sha: blob(50) }, { path: "pkg/use.mjs", symbol: "f", blob_sha: blob(51) }];
    const src = makeCountedSource("package-modules", files2.map((f) => ({ path: f.path, blob_sha: f.blob_sha })));
    const { edges, warnings } = weave({ repoRoot: r2, repositoryRef: REPO, files: files2, symbols: symbols2, sources: { "package-modules": src.source } });
    assert.equal(edges.length, 0, "binding only inside return /re/ emits no edge");
    assert.equal(warnings.length, 0);
  } finally {
    rmSync(r2, { recursive: true, force: true });
  }
}

// ---- E. unrepresentable-consumer semantics: reserved for unresolvable .mjs -----
{
  const r3 = mkdtempSync(path.join(tmpdir(), "clotho-code-un-"));
  try {
    mkdirSync(path.join(r3, "pkg"), { recursive: true });
    mkdirSync(path.join(r3, "outside"), { recursive: true });
    writeFileSync(path.join(r3, "outside", "real.mjs"), "export const o = 1;\n"); // real .mjs, deliberately NOT seeded
    writeFileSync(path.join(r3, "pkg", "helper.json"), "{}\n");                    // real non-.mjs
    writeFileSync(path.join(r3, "pkg", "a.mjs"), 'import { o } from "../outside/real.mjs";\nexport const a = o;\n'); // outside closed roots
    writeFileSync(path.join(r3, "pkg", "b.mjs"), 'import cfg from "./helper.json";\nexport const b = cfg;\n');      // non-.mjs -> silent
    writeFileSync(path.join(r3, "pkg", "c.mjs"), 'import { z } from "./missing.mjs";\nexport const c = z;\n');      // unresolved
    const seeded = [
      { path: "pkg/a.mjs", blob_sha: blob(60) },
      { path: "pkg/b.mjs", blob_sha: blob(61) },
      { path: "pkg/c.mjs", blob_sha: blob(62) },
      { path: "pkg/helper.json", blob_sha: blob(63) }
    ];
    const symbols3 = [
      { path: "pkg/a.mjs", symbol: "a", blob_sha: blob(60) },
      { path: "pkg/b.mjs", symbol: "b", blob_sha: blob(61) },
      { path: "pkg/c.mjs", symbol: "c", blob_sha: blob(62) }
    ];
    const modList = [{ path: "pkg/a.mjs", blob_sha: blob(60) }, { path: "pkg/b.mjs", blob_sha: blob(61) }, { path: "pkg/c.mjs", blob_sha: blob(62) }];
    const src = makeCountedSource("package-modules", modList);
    const { edges, warnings } = weave({ repoRoot: r3, repositoryRef: REPO, files: seeded, symbols: symbols3, sources: { "package-modules": src.source } });
    assert.equal(edges.length, 0, "no edges: targets are unresolvable or non-.mjs");
    const msgs = warnings.map((w) => w.message);
    assert.equal(warnings.length, 2, "exactly two unrepresentable warnings (outside-roots + unresolved)");
    assert.ok(warnings.every((w) => w.weaver === "clotho-code-weaver"));
    assert.ok(msgs.some((m) => /pkg\/a\.mjs.*outside the closed package roots/.test(m)), "real file outside roots -> unrepresentable");
    assert.ok(msgs.some((m) => /pkg\/c\.mjs.*does not resolve to a real file/.test(m)), "missing target -> unrepresentable");
    assert.ok(!msgs.some((m) => /pkg\/b\.mjs/.test(m)), "non-.mjs import is silent, not unrepresentable");

    // A symlinked import target (physical-policy violation) fails closed (throws).
    mkdirSync(path.join(r3, "realdir"), { recursive: true });
    writeFileSync(path.join(r3, "realdir", "t.mjs"), "export const t = 1;\n");
    symlinkSync(path.join(r3, "realdir"), path.join(r3, "pkg", "linkdir"), "junction");
    writeFileSync(path.join(r3, "pkg", "d.mjs"), 'import { t } from "./linkdir/t.mjs";\nexport const d = t;\n');
    const src4 = makeCountedSource("package-modules", [{ path: "pkg/d.mjs", blob_sha: blob(64) }]);
    assert.throws(
      () => weave({ repoRoot: r3, repositoryRef: REPO, files: [{ path: "pkg/d.mjs", blob_sha: blob(64) }], symbols: [{ path: "pkg/d.mjs", symbol: "d", blob_sha: blob(64) }], sources: { "package-modules": src4.source } }),
      /physical-policy violation|symlink/
    );
  } finally {
    rmSync(r3, { recursive: true, force: true });
  }
}

console.log("test-code: all assertions passed");
