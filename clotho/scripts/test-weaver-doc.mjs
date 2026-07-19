#!/usr/bin/env node
// test-weaver-doc.mjs — Task 4b. Real coverage of clotho/weavers/doc.mjs against
// an on-disk fixture tree: documented-in from seeded symbols/files; doc-section vs
// contract-clause by root; exact locators (heading_path + text_sha256) and the
// whole-file blob source_ref; `alphabet` does not match `alpha`; a duplicate
// heading path emits no edge to either ambiguous section; byte-equal over two runs
// consuming only the counted source. Plain node:assert/strict; fresh process.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { weave } from "../weavers/doc.mjs";
import { makeCountedSource, splitMarkdownSections } from "../weavers/util.mjs";
import { canonicalJson } from "../registry.mjs";

const REPO = "git-root:" + "a".repeat(40);
const blob = (n) => String(n).padStart(2, "0").repeat(20);

const root = mkdtempSync(path.join(tmpdir(), "clotho-doc-"));
try {
  const files = {
    // docs/ -> doc-section. Two sections; `alpha` in one, `alphabet` in the other.
    "docs/guide.md": "# Alpha\nThis section mentions alpha directly.\n# Bet\nThis section mentions alphabet, not the symbol.\n",
    // a doc naming a repository file path (exact path token).
    "docs/paths.md": "# Files\nSee clotho/weavers/doc.mjs for the weaver.\n",
    // contracts/ -> contract-clause.
    "contracts/Rules.md": "# Clause\nThe alpha rule is defined here.\n",
    // duplicate heading path within a file -> no edge to either.
    "docs/dup.md": "# Same\nalpha here (dup one)\n# Same\nalpha here (dup two)\n"
  };
  for (const [rel, src] of Object.entries(files)) {
    const abs = path.join(root, ...rel.split("/"));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, src);
  }

  const docList = Object.keys(files).map((p, i) => ({ path: p, blob_sha: blob(i + 10) }));
  const symbols = [{ path: "clotho/weavers/git.mjs", symbol: "alpha", blob_sha: blob(50) }];
  const seededFiles = [{ path: "clotho/weavers/doc.mjs", blob_sha: blob(60) }];
  const mkCtx = () => ({ repoRoot: root, repositoryRef: REPO, symbols, files: seededFiles, sources: { "doc-files": makeCountedSource("doc-files", docList).source } });

  const { edges, warnings } = weave(mkCtx());

  // --- alpha matches, alphabet does not ---
  const alphaEdges = edges.filter((e) => e.from_locator.kind === "code-symbol" && e.from_locator.locator.symbol === "alpha");
  const guideAlpha = alphaEdges.filter((e) => e.to_locator.locator.path === "docs/guide.md");
  assert.equal(guideAlpha.length, 1, "alpha matched exactly one guide.md section (not the alphabet section)");
  assert.deepEqual(guideAlpha[0].to_locator.locator.heading_path, ["Alpha"]);
  assert.equal(guideAlpha[0].to_locator.kind, "doc-section", "docs/ target is a doc-section");
  assert.equal(guideAlpha[0].edge_kind, "documented-in");
  assert.equal(guideAlpha[0].source_ref, `file:docs/guide.md@${blob(10)}`, "source ref is the whole-file blob");

  // section hash matches the splitter output
  const sec = splitMarkdownSections("# Alpha\nThis section mentions alpha directly.\n").sections[0];
  assert.equal(guideAlpha[0].to_locator.locator.text_sha256, sec.text_sha256, "text_sha256 is the exact section bytes hash");

  // --- contract-clause kind under contracts/ ---
  const clause = alphaEdges.find((e) => e.to_locator.locator.path === "contracts/Rules.md");
  assert.ok(clause && clause.to_locator.kind === "contract-clause", "contracts/ target is a contract-clause");

  // --- file-path token match -> repository-file -> doc-section ---
  const fileEdge = edges.find((e) => e.from_locator.kind === "repository-file" && e.from_locator.locator.path === "clotho/weavers/doc.mjs");
  assert.ok(fileEdge, "a seeded file path named in a doc emits repository-file -> doc-section");
  assert.equal(fileEdge.to_locator.locator.path, "docs/paths.md");

  // --- duplicate heading path: no edge to either ambiguous section ---
  const dupEdges = edges.filter((e) => e.to_locator.locator.path === "docs/dup.md");
  assert.equal(dupEdges.length, 0, "no edge to either section of a duplicate heading path");
  const duplicateWarnings = warnings.filter((w) => w.code === "duplicate-heading-path" && w.path === "docs/dup.md");
  assert.equal(duplicateWarnings.length, 1, "duplicate-heading-path emits one canonical typed warning per ambiguous address");
  assert.deepEqual(Object.keys(duplicateWarnings[0]).sort(), ["code", "detail", "path", "weaver"], "warning obeys the typed warning contract");
  assert.equal(duplicateWarnings[0].weaver, "clotho-doc-weaver");
  assert.match(duplicateWarnings[0].detail, /Same/, "warning detail identifies the ambiguous heading path");

  // --- deterministic: byte-equal over two runs ---
  const a = weave(mkCtx()), b = weave(mkCtx());
  assert.equal(canonicalJson(a), canonicalJson(b), "byte-equal {edges,warnings} over two runs");

  // --- counted source exhausted ---
  const cs = makeCountedSource("doc-files", docList);
  weave({ repoRoot: root, repositoryRef: REPO, symbols, files: seededFiles, sources: { "doc-files": cs.source } });
  const acc = cs.accounting();
  assert.equal(acc.observed_count, docList.length);
  assert.equal(acc.exhausted, true);

  console.log("test-weaver-doc: all assertions passed");
} finally {
  rmSync(root, { recursive: true, force: true });
}
