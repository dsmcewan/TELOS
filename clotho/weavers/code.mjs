// weavers/code.mjs — Clotho's code weaver (plan v13 (v12 + AM-40) Task 4a). Zero dependencies:
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
import { scanImports, identifierUsedOutside, resolveRelativeSpecifier } from "./util.mjs";

const WEAVER_ID = "clotho-code-weaver";

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
    const modAbs = path.join(repoRoot, ...modPath.split("/"));
    const sourceRef = `file:${modPath}@${modBlob}`;
    const source = readFileSync(modAbs, "utf8");
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
      // Only relative specifiers are file references; bare/node: are ignored.
      if (!(imp.specifier.startsWith("./") || imp.specifier.startsWith("../"))) continue;
      // Specifier -> path via the ONE shared resolver (D33); the seeded-file
      // membership test below is the code weaver's own extraction-grammar filter.
      const r = resolveRelativeSpecifier(modAbs, imp.specifier, { repoRoot });
      if (!r.ok) {
        // Outside the explicit-.mjs extraction grammar: NOT unrepresentable — no
        // edge and no warning (a non-.mjs import is simply not a code edge here).
        if (r.kind === "ambiguous-extension") continue;
        // A specifier that does not resolve to a real file below the closed roots
        // is the ONLY genuinely unrepresentable-consumer case.
        if (r.kind === "unresolved") {
          warnings.push({ weaver: WEAVER_ID, message: `unrepresentable-consumer: ${modPath} imports ${JSON.stringify(imp.specifier)} (does not resolve to a real file below the closed roots)` });
          continue;
        }
        // symlink / escape / non-regular target: a physical-policy violation —
        // fail closed rather than downgrade to an advisory warning.
        throw new Error(`code-weaver: ${modPath} imports ${JSON.stringify(imp.specifier)} — ${r.kind} target (physical-policy violation)`);
      }
      if (!fileBlob.has(r.repoRelative)) {
        // Resolves to a real .mjs file, but not a seeded file below the closed
        // package roots — genuinely unrepresentable in this weave.
        warnings.push({ weaver: WEAVER_ID, message: `unrepresentable-consumer: ${modPath} imports ${JSON.stringify(imp.specifier)} (resolves outside the closed package roots)` });
        continue;
      }
      const targetPath = r.repoRelative;
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
