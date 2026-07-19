// weavers/doc.mjs — Clotho's documentation weaver (plan v15 Task 4b). Zero deps:
// Node stdlib only; imports clotho/registry.mjs and clotho/weavers/util.mjs (its
// accepted relative module-load closure is {registry.mjs, doc.mjs, util.mjs}).
//
// Consumes its driver-owned `doc-files` counted source and emits `documented-in`
// edges: a seeded symbol whose identifier token appears in a section emits
// `code-symbol -> {doc-section|contract-clause}`; a seeded repository file whose
// exact repository path appears in a section emits `repository-file -> ...`. A
// target below the documentation root is a `doc-section`; below the contract root
// a `contract-clause`. The whole Markdown file blob is the source ref. Two
// sections in one file with the same heading path are a fatal duplicate: no edge
// is emitted to either. Deterministic; counted-source only.

import { readFileSync } from "node:fs";
import path from "node:path";

import { deriveNodeId, validateEdgeInput } from "../registry.mjs";
import { splitMarkdownSections, escapeRegExp } from "./util.mjs";

const WEAVER_ID = "clotho-doc-weaver";
const CONTRACT_ROOT = "contracts/";

const symbolToken = (text, sym) => new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(sym)}(?![A-Za-z0-9_$])`).test(text);
const pathToken = (text, p) => new RegExp(`(?<![A-Za-z0-9_$/.\\-])${escapeRegExp(p)}(?![A-Za-z0-9_$/.\\-])`).test(text);

export function weave(ctx) {
  const { repoRoot, repositoryRef, sources } = ctx;
  const symbols = ctx.symbols || [];
  const files = ctx.files || [];
  const edges = [];
  const warnings = [];
  const seen = new Set();

  const emit = (fromLocator, toLocator, sourceRef) => {
    const edge = {
      edge_kind: "documented-in",
      from_node: deriveNodeId(fromLocator),
      to_node: deriveNodeId(toLocator),
      from_locator: fromLocator,
      to_locator: toLocator,
      source_ref: sourceRef,
      asserted_by: WEAVER_ID,
      assertion_status: "deterministic-extraction"
    };
    const key = `${edge.from_node}|${edge.to_node}`;
    if (seen.has(key)) return;
    seen.add(key);
    validateEdgeInput(edge, { repositoryRef });
    edges.push(edge);
  };

  for (const doc of sources["doc-files"]) {
    const docPath = doc.path;
    const bytes = readFileSync(path.join(repoRoot, ...docPath.split("/")));
    const sourceRef = `file:${docPath}@${doc.blob_sha}`;
    const kind = docPath.startsWith(CONTRACT_ROOT) ? "contract-clause" : "doc-section";
    const { sections, duplicatePaths } = splitMarkdownSections(bytes);
    for (const duplicatePath of [...duplicatePaths].sort()) {
      warnings.push({
        weaver: WEAVER_ID,
        code: "duplicate-heading-path",
        path: docPath,
        detail: `duplicate heading path ${duplicatePath}`
      });
    }
    for (const sec of sections) {
      // A fatal duplicate heading path: mark absent, no edge to either section.
      if (duplicatePaths.has(JSON.stringify(sec.heading_path))) {
        continue;
      }
      const secText = bytes.toString("utf8", sec.startByte, sec.endByte);
      const toLocator = { kind, locator: { repository_ref: repositoryRef, path: docPath, heading_path: sec.heading_path, text_sha256: sec.text_sha256 } };
      for (const sym of symbols) {
        if (symbolToken(secText, sym.symbol)) {
          emit({ kind: "code-symbol", locator: { repository_ref: repositoryRef, path: sym.path, symbol: sym.symbol, blob_sha: sym.blob_sha } }, toLocator, sourceRef);
        }
      }
      for (const f of files) {
        if (pathToken(secText, f.path)) {
          emit({ kind: "repository-file", locator: { repository_ref: repositoryRef, path: f.path, blob_sha: f.blob_sha } }, toLocator, sourceRef);
        }
      }
    }
  }

  return { edges, warnings };
}
