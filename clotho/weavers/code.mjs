// weavers/code.mjs — Clotho's code weaver (plan v12 Task 4a). Zero dependencies:
// Node stdlib only; imports clotho/registry.mjs and clotho/weavers/util.mjs (its
// accepted relative module-load closure is {registry.mjs, code.mjs, util.mjs}).
//
// Consumes its driver-owned package-modules counted source and infers
// `depends-on` edges from static relative `.mjs` imports that are actually used.
// A named import resolving to a seeded export threads at SYMBOL level; a named
// import that does not resolve to a seeded export, a namespace/default import, or
// a side-effect import threads at FILE level. All four permitted depends-on
// endpoint shapes occur. Deterministic; counted-source only.

import { readFileSync } from "node:fs";
import path from "node:path";

import { deriveNodeId, validateEdgeInput } from "../registry.mjs";
import { scanImports, identifierUsedOutside } from "./util.mjs";

const WEAVER_ID = "clotho-code-weaver";

// Resolve a relative specifier to a repository-relative POSIX module path,
// lexically (from the consuming module's directory). Only "./"/"../" specifiers
// are candidates; a `.mjs` extension is appended when the specifier omits one.
function resolveModulePath(fromRepoPath, specifier) {
  if (!(specifier.startsWith("./") || specifier.startsWith("../"))) return null;
  const dir = path.posix.dirname(fromRepoPath);
  let target = path.posix.normalize(path.posix.join(dir, specifier));
  if (target.startsWith("..") || target.startsWith("/")) return null; // escapes the tree
  if (!path.posix.extname(target)) target += ".mjs";
  return target;
}

export function weave(ctx) {
  const { repoRoot, repositoryRef, sources } = ctx;

  // Seeds: file blob_sha by path, and seeded export symbols by path.
  const fileBlob = new Map(ctx.files.map((f) => [f.path, f.blob_sha]));
  const exportsByPath = new Map();
  for (const s of ctx.symbols) {
    if (!exportsByPath.has(s.path)) exportsByPath.set(s.path, new Map());
    exportsByPath.get(s.path).set(s.symbol, s.blob_sha);
  }

  const edges = [];
  const warnings = [];
  const seen = new Set();

  const codeSymbolLoc = (p, symbol, blob) => ({ kind: "code-symbol", locator: { repository_ref: repositoryRef, path: p, symbol, blob_sha: blob } });
  const repoFileLoc = (p, blob) => ({ kind: "repository-file", locator: { repository_ref: repositoryRef, path: p, blob_sha: blob } });

  const emit = (fromLocator, toLocator, sourceRef) => {
    const edge = {
      edge_kind: "depends-on",
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

  for (const mod of sources["package-modules"]) {
    const modPath = mod.path;
    const modBlob = mod.blob_sha;
    const sourceRef = `file:${modPath}@${modBlob}`;
    const source = readFileSync(path.join(repoRoot, ...modPath.split("/")), "utf8");
    const imports = scanImports(source);
    const importSpans = imports.map((i) => i.span);

    // Consuming module's own seeded exports (sorted for determinism).
    const ownExports = [...(exportsByPath.get(modPath) || new Map()).keys()].sort();
    const hasExport = ownExports.length > 0;
    // The "from" endpoints for every edge this module asserts.
    const fromEndpoints = hasExport
      ? ownExports.map((sym) => codeSymbolLoc(modPath, sym, modBlob))
      : [repoFileLoc(modPath, modBlob)];

    for (const imp of imports) {
      const targetPath = resolveModulePath(modPath, imp.specifier);
      // Only relative specifiers are file references; bare/node: are ignored.
      if (!(imp.specifier.startsWith("./") || imp.specifier.startsWith("../"))) continue;
      if (targetPath === null || !fileBlob.has(targetPath)) {
        warnings.push(`unrepresentable-consumer: ${modPath} imports ${JSON.stringify(imp.specifier)} (no seeded file below closed roots)`);
        continue;
      }
      const targetBlob = fileBlob.get(targetPath);
      const targetExports = exportsByPath.get(targetPath) || new Map();

      for (const b of imp.bindings) {
        if (b.form === "side-effect") {
          // no binding to check for use; a side-effect import is a use by nature
          for (const from of fromEndpoints) emit(from, repoFileLoc(targetPath, targetBlob), sourceRef);
          continue;
        }
        if (!identifierUsedOutside(source, b.local, importSpans)) continue; // unused import: no edge

        if (b.form === "named" && targetExports.has(b.imported)) {
          // symbol-level: to the seeded export symbol
          const to = codeSymbolLoc(targetPath, b.imported, targetBlob);
          for (const from of fromEndpoints) emit(from, to, sourceRef);
        } else {
          // file-level: named-not-seeded, namespace, or default
          const to = repoFileLoc(targetPath, targetBlob);
          for (const from of fromEndpoints) emit(from, to, sourceRef);
        }
      }
    }
  }

  return { edges, warnings };
}
