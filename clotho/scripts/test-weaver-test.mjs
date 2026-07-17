#!/usr/bin/env node
// test-weaver-test.mjs — Task 4b. Real coverage of clotho/weavers/test.mjs: a
// named import resolving to a seeded export -> code-symbol -> test (test-file blob
// source ref); an import not resolving to a seeded symbol -> repository-file ->
// test (test-file blob); a package check/test command executing a seeded file as a
// script -> repository-file -> test with the PACKAGE.JSON blob source ref (D25);
// no command is executed (text only); the same target verified via import and via
// command yields two distinct retained records with distinct source refs (D25);
// byte-equal over two runs consuming only counted sources.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { weave } from "../weavers/test.mjs";
import { makeCountedSource } from "../weavers/util.mjs";
import { canonicalJson } from "../registry.mjs";

const REPO = "git-root:" + "a".repeat(40);
const B = { src: "11".repeat(20), testa: "22".repeat(20), check: "33".repeat(20), pkg: "44".repeat(20) };

const root = mkdtempSync(path.join(tmpdir(), "clotho-test-"));
try {
  const files = {
    "pkg/src.mjs": "export const alpha = 1;\n",
    "pkg/scripts/check.mjs": "export const c = 1;\n",
    "pkg/scripts/test-a.mjs": 'import { alpha } from "../src.mjs";\nimport "./check.mjs";\nif (alpha) {}\n',
    "pkg/package.json": JSON.stringify({ name: "pkg", scripts: { check: "node scripts/check.mjs" } }, null, 2) + "\n"
  };
  for (const [rel, src] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split("/"));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, src);
  }

  const seededFiles = [
    { path: "pkg/src.mjs", blob_sha: B.src },
    { path: "pkg/scripts/check.mjs", blob_sha: B.check },
    { path: "pkg/scripts/test-a.mjs", blob_sha: B.testa },
    { path: "pkg/package.json", blob_sha: B.pkg }
  ];
  const symbols = [
    { path: "pkg/src.mjs", symbol: "alpha", blob_sha: B.src },
    { path: "pkg/scripts/check.mjs", symbol: "c", blob_sha: B.check }
  ];
  // Driver-seeded test-files: scripts/test-*.mjs plus command-referenced .mjs paths.
  const testFiles = [
    { path: "pkg/scripts/test-a.mjs", blob_sha: B.testa },
    { path: "pkg/scripts/check.mjs", blob_sha: B.check }
  ];
  const manifests = [{ path: "pkg/package.json", blob_sha: B.pkg }];
  const mkCtx = () => ({
    repoRoot: root, repositoryRef: REPO, symbols, files: seededFiles,
    sources: { "test-files": makeCountedSource("test-files", testFiles).source, "package-manifests": makeCountedSource("package-manifests", manifests).source }
  });

  const { edges } = weave(mkCtx());
  const find = (pred) => edges.filter(pred);

  // 1. import resolving to a seeded export -> code-symbol -> test (test-file blob)
  const cs = find((e) => e.from_locator.kind === "code-symbol" && e.from_locator.locator.symbol === "alpha");
  assert.equal(cs.length, 1, "one code-symbol -> test for the imported seeded symbol");
  assert.equal(cs[0].edge_kind, "verified-by");
  assert.equal(cs[0].to_locator.kind, "test");
  assert.equal(cs[0].to_locator.locator.path, "pkg/scripts/test-a.mjs");
  assert.equal(cs[0].source_ref, `file:pkg/scripts/test-a.mjs@${B.testa}`, "import-derived: test-file blob source ref");

  // 2. import not resolving to a seeded symbol (side-effect) -> repository-file -> test (test-file blob)
  const impRf = find((e) => e.from_locator.kind === "repository-file" && e.from_locator.locator.path === "pkg/scripts/check.mjs" && e.to_locator.locator.path === "pkg/scripts/test-a.mjs");
  assert.equal(impRf.length, 1, "side-effect import -> repository-file -> test");
  assert.equal(impRf[0].source_ref, `file:pkg/scripts/test-a.mjs@${B.testa}`, "import-derived: test-file blob");

  // 3. command-inferred -> repository-file -> test with PACKAGE.JSON blob (D25)
  const cmd = find((e) => e.from_locator.kind === "repository-file" && e.from_locator.locator.path === "pkg/scripts/check.mjs" && e.to_locator.locator.path === "pkg/scripts/check.mjs");
  assert.equal(cmd.length, 1, "package command executing a seeded file -> repository-file -> test");
  assert.equal(cmd[0].source_ref, `file:pkg/package.json@${B.pkg}`, "D25: command-inferred carries the package.json blob source ref");

  // 4. D25 two provenance: the same target (repository-file check.mjs) verified via
  //    import AND via command -> two distinct records with distinct source refs.
  const forCheck = find((e) => e.from_locator.kind === "repository-file" && e.from_locator.locator.path === "pkg/scripts/check.mjs");
  const refs = new Set(forCheck.map((e) => e.source_ref));
  assert.ok(refs.has(`file:pkg/scripts/test-a.mjs@${B.testa}`) && refs.has(`file:pkg/package.json@${B.pkg}`),
    "same target retains BOTH the import-derived (test-file) and command-inferred (package.json) source refs");

  // deterministic
  assert.equal(canonicalJson(weave(mkCtx())), canonicalJson(weave(mkCtx())), "byte-equal over two runs");

  // counted sources exhausted
  const tc = makeCountedSource("test-files", testFiles), pc = makeCountedSource("package-manifests", manifests);
  weave({ repoRoot: root, repositoryRef: REPO, symbols, files: seededFiles, sources: { "test-files": tc.source, "package-manifests": pc.source } });
  assert.equal(tc.accounting().exhausted, true);
  assert.equal(pc.accounting().exhausted, true);

  console.log("test-weaver-test: all assertions passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
