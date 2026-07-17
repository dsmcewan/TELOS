// weavers/test.mjs — Clotho's test weaver (plan v15 Task 4b). Zero deps: Node
// stdlib only; imports clotho/registry.mjs and clotho/weavers/util.mjs (its
// accepted relative module-load closure is {registry.mjs, test.mjs, util.mjs}).
//
// Consumes its `test-files` and `package-manifests` counted sources and emits
// `verified-by` edges. A static NAMED import resolving to a seeded export emits
// `code-symbol -> test` (source_ref = the TEST FILE blob, import-derived). A test
// importing a module that does not resolve to a seeded symbol emits
// `repository-file -> test` (source_ref = the test file blob). A package
// `check`/`test` command that executes a seeded file as a script emits
// `repository-file -> test` with **source_ref = the package.json blob**
// (command-inferred, D25). Command strings are parsed as TEXT ONLY; nothing is
// executed. Deterministic; counted-source only.

import { readFileSync } from "node:fs";
import path from "node:path";

import { deriveNodeId, validateEdgeInput } from "../registry.mjs";
import { scanImports, resolveRelativeSpecifier } from "./util.mjs";

const WEAVER_ID = "clotho-test-weaver";

export function weave(ctx) {
  const { repoRoot, repositoryRef, sources } = ctx;
  const symbols = ctx.symbols || [];
  const files = ctx.files || [];

  const fileBlob = new Map(files.map((f) => [f.path, f.blob_sha]));
  const exportsByPath = new Map();
  for (const s of symbols) {
    if (!exportsByPath.has(s.path)) exportsByPath.set(s.path, new Map());
    exportsByPath.get(s.path).set(s.symbol, s.blob_sha);
  }

  const edges = [];
  const warnings = [];
  // Identity key includes source_ref so the SAME target verified once via import
  // and once via a package command yields two distinct retained records (D25).
  const seen = new Set();

  const testFiles = [...sources["test-files"]]; // {path, blob_sha}; consume the counted source
  const testBlob = new Map(testFiles.map((t) => [t.path, t.blob_sha]));

  const emit = (fromLocator, toLocator, sourceRef) => {
    const edge = {
      edge_kind: "verified-by",
      from_node: deriveNodeId(fromLocator),
      to_node: deriveNodeId(toLocator),
      from_locator: fromLocator,
      to_locator: toLocator,
      source_ref: sourceRef,
      asserted_by: WEAVER_ID,
      assertion_status: "deterministic-extraction"
    };
    const key = `${edge.from_node}|${edge.to_node}|${sourceRef}`;
    if (seen.has(key)) return;
    seen.add(key);
    validateEdgeInput(edge, { repositoryRef });
    edges.push(edge);
  };

  // ---- 1. import-derived edges (source_ref = the test file's own blob) --------
  for (const tf of testFiles) {
    const testLoc = { kind: "test", locator: { repository_ref: repositoryRef, path: tf.path, blob_sha: tf.blob_sha } };
    const testSrc = `file:${tf.path}@${tf.blob_sha}`;
    const src = readFileSync(path.join(repoRoot, ...tf.path.split("/")), "utf8");
    for (const imp of scanImports(src)) {
      if (!(imp.specifier.startsWith("./") || imp.specifier.startsWith("../"))) continue;
      const r = resolveRelativeSpecifier(path.join(repoRoot, ...tf.path.split("/")), imp.specifier, { repoRoot });
      if (!r.ok) continue; // unresolved / non-.mjs / physical-policy target: no verified-by edge
      const target = r.repoRelative;
      if (!fileBlob.has(target)) continue; // not a seeded module below the closed roots
      const targetExports = exportsByPath.get(target) || new Map();
      const seededNamed = (imp.bindings || []).filter((b) => b.form === "named" && targetExports.has(b.imported));
      if (seededNamed.length) {
        for (const b of seededNamed) {
          emit({ kind: "code-symbol", locator: { repository_ref: repositoryRef, path: target, symbol: b.imported, blob_sha: targetExports.get(b.imported) } }, testLoc, testSrc);
        }
      } else {
        // imports a module without resolving to a seeded symbol -> file level
        emit({ kind: "repository-file", locator: { repository_ref: repositoryRef, path: target, blob_sha: fileBlob.get(target) } }, testLoc, testSrc);
      }
    }
  }

  // ---- 2. command-inferred edges (source_ref = the package.json blob, D25) ----
  const MJS_TOKEN = /(?<![^\s"'=([:])([^\s"'()]+\.mjs)\b/g;
  for (const pm of sources["package-manifests"]) {
    const pkgRaw = readFileSync(path.join(repoRoot, ...pm.path.split("/")), "utf8");
    let pkg; try { pkg = JSON.parse(pkgRaw); } catch { warnings.push({ weaver: WEAVER_ID, message: `unparsable package manifest ${pm.path}` }); continue; }
    const pkgRoot = pm.path.includes("/") ? pm.path.slice(0, pm.path.lastIndexOf("/")) : "";
    const manifestSrc = `file:${pm.path}@${pm.blob_sha}`;
    const scripts = pkg && typeof pkg === "object" ? pkg.scripts : null;
    const cmds = scripts && typeof scripts === "object" ? [scripts.check, scripts.test].filter((c) => typeof c === "string") : [];
    for (const cmd of cmds) {
      let m;
      const re = new RegExp(MJS_TOKEN.source, "g");
      while ((m = re.exec(cmd)) !== null) {
        const ref = m[1];
        if (ref.startsWith("/") || ref.includes("\\") || ref.split("/").some((s) => s === "." || s === "..")) continue;
        const target = pkgRoot ? `${pkgRoot}/${ref}` : ref;
        if (!target.startsWith(pkgRoot ? pkgRoot + "/" : "")) continue; // must stay inside the package root
        if (!fileBlob.has(target)) continue; // must be a seeded repository file
        const testLoc = { kind: "test", locator: { repository_ref: repositoryRef, path: target, blob_sha: testBlob.get(target) || fileBlob.get(target) } };
        emit({ kind: "repository-file", locator: { repository_ref: repositoryRef, path: target, blob_sha: fileBlob.get(target) } }, testLoc, manifestSrc);
      }
    }
  }

  return { edges, warnings };
}
