#!/usr/bin/env node
// test-advisory.mjs — Task 5. The two-direction advisory boundary invariant
// (D23/D27/D30/D32/D33, AM-24, AM-35..39): a deterministic lexical scan of the
// REAL repository plus a full synthetic-unit suite.
//
// Direction 1 (OUTSIDE-IN, D23/AM-24): every tracked JS/TS-family source
// assigned to a non-Clotho package is scanned with the SHARED lexical
// classifier; any literal relative / file: / absolute specifier resolving into
// clotho/ (lexically, or physically through a symlink alias), any bare
// `clotho` / Clotho-package-name specifier, any nonliteral dynamic import /
// require / module.require, and any tracked symlink source is flagged.
//
// Direction 2 (CLOTHO-SIDE OUTBOUND, D23/D27/D33): every tracked Clotho source
// is checked against the CLOSED allowlist — only Node built-ins and accepted
// literal relative forms resolving physically into clotho/ or the exact
// permitted merkle-dag/ closure pass; every other recognized specifier form
// fails closed. Additionally (D30/D32) loader-construction routes through
// `module` / `node:module` are checked against the frozen
// LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS mapping imported from inventory.mjs —
// this file maintains NO second hand-written allowlist.
//
// Advisory posture (AM-35..39): these are deterministic trusted-code review
// signals over recognized lexical forms. The scan claims NO isolation, NO
// sandbox, and NO data-flow analysis. Recognized out-of-policy forms FAIL the
// check; forms outside the frozen lexical set are reported as UNCLASSIFIED —
// reported, never certified absent. Comments, string lookalikes, and regex
// interiors can never trigger (the shared lexer masks them).

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync, realpathSync, mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { builtinModules, isBuiltin } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import * as util from "../weavers/util.mjs";
import {
  classifyModuleLoads, scanImports, lex, resolveRelativeSpecifier,
  deriveAcceptedClosure, escapeRegExp, ProfileError
} from "../weavers/util.mjs";
import { LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, PERMITTED_EXTERNAL_CLOSURE_FILES } from "../inventory.mjs";

// ---- the SHARED tooling (D33) ------------------------------------------------
// The advisory scanner dispatches through EXACTLY these weavers/util.mjs
// exports — the same classifier/resolver that drives closure derivation. A unit
// below proves this table IS the util module's exports, and a per-form unit
// proves every accepted literal syntax receives identical closure treatment.
const SHARED = { classifyModuleLoads, scanImports, lex, resolveRelativeSpecifier };

// The loader-check key set is DERIVED from the imported frozen mapping — never
// hand-written here (D30/D32: no second allowlist).
const LOADER_SPECIFIERS = new Set(Object.keys(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS));

// JS/TS-family source extensions assigned-to-package sources are scanned under.
const SOURCE_EXTENSIONS = [".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx"];
const isSourceFile = (p) => SOURCE_EXTENSIONS.some((e) => p.endsWith(e));

// A builtin specifier check that accepts `node:`-prefixed and bare builtin
// names including subpaths (node:assert/strict). isBuiltin has existed since
// Node 18.6; the builtinModules fallback keeps this total on any Node >= 18.
function isBuiltinSpecifier(spec) {
  if (typeof isBuiltin === "function") return isBuiltin(spec);
  return builtinModules.includes(spec.startsWith("node:") ? spec.slice(5) : spec);
}

const isAbsolutePathLiteral = (spec) =>
  spec.startsWith("/") || spec.startsWith("\\\\") || /^[A-Za-z]:[/\\]/.test(spec);

const toPosix = (p) => p.split(path.sep).join("/");

// True iff `candidate` is `base` or lexically beneath it (both absolute).
function isUnder(base, candidate) {
  const rel = path.relative(base, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Physical (symlink-following) form of an absolute path: realpath the deepest
// existing ancestor and re-append the missing tail — so a symlink alias whose
// physical target lies inside clotho/ is caught even when the named file does
// not (yet) exist. Returns null when nothing on the chain exists / is readable.
function physicalTarget(absTarget) {
  let cur = absTarget;
  const tail = [];
  for (;;) {
    try {
      const real = realpathSync(cur);
      return tail.length ? path.join(real, ...tail) : real;
    } catch (e) {
      if (!(e && e.code === "ENOENT")) return null;
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      tail.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

function matchingParenIn(masked, openIdx) {
  let depth = 0;
  for (let k = openIdx; k < masked.length; k++) {
    if (masked[k] === "(") depth++;
    else if (masked[k] === ")") { depth--; if (depth === 0) return k; }
  }
  return -1;
}

function nextSigIdx(masked, from) {
  let j = from;
  while (j < masked.length && /\s/.test(masked[j])) j++;
  return j;
}

// ---- package-root inventory --------------------------------------------------
// Package roots come from tracked package.json files; every tracked JS/TS-family
// source is assigned to its DEEPEST enclosing package root. Sources outside
// every package root are out of the advisory clause's scan scope (counted, not
// scanned). Tracked entries: { path (repo-relative POSIX), symlink? }.

function buildAssignment(tracked) {
  const roots = tracked
    .filter((t) => t.path === "package.json" || t.path.endsWith("/package.json"))
    .map((t) => (t.path === "package.json" ? "" : t.path.slice(0, -"/package.json".length)))
    .sort();
  const sources = [];
  let unassigned = 0;
  for (const t of tracked) {
    if (!isSourceFile(t.path)) continue;
    let assigned = null;
    for (const r of roots) {
      if (r === "" || t.path.startsWith(r + "/")) {
        if (assigned === null || r.length > assigned.length) assigned = r;
      }
    }
    if (assigned === null) { unassigned++; continue; }
    sources.push({ path: t.path, root: assigned, symlink: !!t.symlink });
  }
  sources.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { packageRoots: roots, sources, unassigned };
}

// ---- direction 1: outside-in (D23/AM-24) -------------------------------------

function scanOutsideFile(ctx, fileRel, source, out) {
  let sites;
  try {
    sites = SHARED.classifyModuleLoads(source);
  } catch (e) {
    // Outside a package's frozen lexical set: UNCLASSIFIED — reported, never
    // certified absent, never silently dropped. (Only Clotho sources are held
    // to the enforced profile; an outside file may legitimately be richer.)
    if (e instanceof ProfileError) {
      out.unclassified.push({ file: fileRel, code: "outside-unclassified-source", detail: e.detail });
      return;
    }
    throw e;
  }
  const fileDirAbs = path.dirname(path.join(ctx.repoRootAbs, ...fileRel.split("/")));
  for (const site of sites) {
    if (!site.literal || site.specifier === null) {
      // A nonliteral dynamic import / require / module.require outside Clotho
      // is an unresolved structural risk — fails closed (AM-24).
      const code = site.form === "dynamic-import" ? "outside-nonliteral-dynamic-import"
        : site.form === "module-require" ? "outside-nonliteral-module-require"
        : "outside-nonliteral-require";
      out.findings.push({ file: fileRel, code, form: site.form, specifier: null });
      continue;
    }
    const spec = site.specifier;
    let absTarget = null;
    let codeIfClotho = null;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      absTarget = path.resolve(fileDirAbs, spec);
      codeIfClotho = "outside-relative-into-clotho";
    } else if (spec.startsWith("file:")) {
      try { absTarget = fileURLToPath(new URL(spec)); } catch {
        out.unclassified.push({ file: fileRel, code: "outside-unclassified-specifier", form: site.form, specifier: spec });
        continue;
      }
      codeIfClotho = "outside-file-url-into-clotho";
    } else if (isAbsolutePathLiteral(spec)) {
      absTarget = path.resolve(spec);
      codeIfClotho = "outside-absolute-into-clotho";
    } else {
      // Bare specifier: `clotho`, Clotho's package name, or their subpaths.
      const names = [ctx.clothoRoot, ctx.clothoPackageName].filter(Boolean);
      if (names.some((n) => spec === n || spec.startsWith(n + "/"))) {
        out.findings.push({ file: fileRel, code: "outside-bare-clotho-specifier", form: site.form, specifier: spec });
      }
      continue;
    }
    // Lexical containment first; then the real-path check, which catches a
    // symlink alias whose PHYSICAL target lies inside clotho/ even when the
    // lexical path never mentions clotho/ (D23/AM-24).
    if (isUnder(ctx.clothoRootAbs, absTarget)) {
      out.findings.push({ file: fileRel, code: codeIfClotho, form: site.form, specifier: spec, target: toPosix(path.relative(ctx.repoRootAbs, absTarget)) });
      continue;
    }
    const phys = physicalTarget(absTarget);
    if (phys !== null && ctx.realClothoRoot !== null && isUnder(ctx.realClothoRoot, phys)) {
      out.findings.push({ file: fileRel, code: "outside-symlink-alias-into-clotho", form: site.form, specifier: spec, target: toPosix(path.relative(ctx.realRepoRoot ?? ctx.repoRootAbs, phys)) });
    }
  }
}

// ---- direction 2: Clotho-side outbound closed allowlist (D23/D27/D30/D32/D33) -

function scanClothoFile(ctx, fileRel, source, out) {
  const fileAbs = path.join(ctx.repoRootAbs, ...fileRel.split("/"));
  let sites, imports, lexed;
  try {
    sites = SHARED.classifyModuleLoads(source);
    imports = SHARED.scanImports(source);
    lexed = SHARED.lex(source);
  } catch (e) {
    // A Clotho source outside the enforced profile cannot be certified against
    // the closed allowlist — fail closed (unclassified is a FAILURE here).
    if (e instanceof ProfileError) {
      out.findings.push({ file: fileRel, code: "clotho-unclassified-source", detail: e.detail });
      return;
    }
    throw e;
  }
  for (const site of sites) {
    if (!site.literal || site.specifier === null) {
      const code = site.form === "dynamic-import" ? "clotho-nonliteral-dynamic-import"
        : site.form === "module-require" ? "clotho-nonliteral-module-require"
        : "clotho-nonliteral-require";
      out.findings.push({ file: fileRel, code, form: site.form, specifier: null });
      continue;
    }
    const spec = site.specifier;
    if (spec.startsWith("./") || spec.startsWith("../")) {
      // The ONE shared resolver (D33), same configuration as the closure
      // derivation: any explicit extension, physical containment, no symlinks.
      const r = SHARED.resolveRelativeSpecifier(fileAbs, spec, { repoRoot: ctx.repoRootAbs, extensions: "any" });
      if (!r.ok) {
        out.findings.push({ file: fileRel, code: "clotho-relative-resolution-failed", form: site.form, specifier: spec, kind: r.kind });
        continue;
      }
      const inClotho = r.repoRelative === ctx.clothoRoot || r.repoRelative.startsWith(ctx.clothoRoot + "/");
      if (inClotho || ctx.permittedExternal.has(r.repoRelative)) {
        out.edges.push({ file: fileRel, form: site.form, target: r.repoRelative });
        continue;
      }
      out.findings.push({ file: fileRel, code: "clotho-relative-outside-permitted-closure", form: site.form, specifier: spec, target: r.repoRelative });
      continue;
    }
    if (spec.startsWith("file:")) {
      out.findings.push({ file: fileRel, code: "clotho-file-url-specifier", form: site.form, specifier: spec });
      continue;
    }
    if (isAbsolutePathLiteral(spec)) {
      out.findings.push({ file: fileRel, code: "clotho-absolute-path-specifier", form: site.form, specifier: spec });
      continue;
    }
    if (isBuiltinSpecifier(spec)) {
      // Builtins pass the outbound allowlist; the two loader-capable
      // specifiers additionally face the D30/D32 form checks. Static import
      // forms are decided binding-by-binding below (scanImports).
      if (LOADER_SPECIFIERS.has(spec)) {
        if (site.form === "dynamic-import") {
          out.findings.push({ file: fileRel, code: "loader-dynamic-import", specifier: spec });
        } else if (site.form === "require" || site.form === "module-require") {
          out.findings.push({ file: fileRel, code: "loader-cjs-require", form: site.form, specifier: spec });
        } else if (site.form === "export-from" || site.form === "export-star") {
          // Re-exports are flagged even for otherwise-safe names.
          out.findings.push({ file: fileRel, code: "loader-static-reexport", form: site.form, specifier: spec });
        }
      }
      continue;
    }
    // Everything else recognized (non-builtin bare, exotic literals) fails
    // closed — the allowlist is closed, not a denylist.
    out.findings.push({ file: fileRel, code: "clotho-forbidden-bare-specifier", form: site.form, specifier: spec });
  }

  // ---- D30/D32: static-import bindings of the loader-capable specifiers ------
  // Decided by the IMPORTED (source) export name, never the local binding name;
  // the safe set comes from the imported frozen mapping only.
  const accessLocals = [];
  const createRequireNames = new Set(["createRequire"]);
  for (const imp of imports) {
    if (!LOADER_SPECIFIERS.has(imp.specifier)) continue;
    const safe = new Set(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS[imp.specifier]);
    for (const b of imp.bindings) {
      if (b.form === "named") {
        if (safe.has(b.imported)) continue; // permitted source export, any local alias
        if (b.imported === "createRequire") {
          createRequireNames.add(b.local);
          out.findings.push({ file: fileRel, code: "loader-create-require-named-import", specifier: imp.specifier, imported: b.imported, local: b.local });
        } else {
          out.findings.push({ file: fileRel, code: "loader-non-allowlisted-named-export", specifier: imp.specifier, imported: b.imported });
        }
      } else if (b.form === "namespace") {
        accessLocals.push(b.local);
        out.findings.push({ file: fileRel, code: "loader-namespace-import", specifier: imp.specifier, local: b.local });
      } else if (b.form === "default") {
        accessLocals.push(b.local);
        out.findings.push({ file: fileRel, code: "loader-default-import", specifier: imp.specifier, local: b.local });
      } else {
        // A side-effect import of a loader-capable specifier is not a static
        // named import of a permitted export — the rule is a closed allowlist.
        out.findings.push({ file: fileRel, code: "loader-non-allowlisted-import-form", specifier: imp.specifier });
      }
    }
  }
  const masked = lexed.masked;
  // Property access obtaining ANY export (safe names included) from an imported
  // namespace/default binding is flagged; computed access is ambiguous
  // acquisition and fails closed as unclassified.
  for (const local of accessLocals) {
    const re = new RegExp(`(?<![A-Za-z0-9_$.])${escapeRegExp(local)}\\s*(\\?\\.|\\.|\\[)`, "g");
    for (let m; (m = re.exec(masked)); ) {
      const code = m[1] === "[" ? "loader-ambiguous-acquisition" : "loader-binding-property-access";
      out.findings.push({ file: fileRel, code, local });
    }
  }
  // Immediate invocation: a createRequire-named call (any alias of the
  // createRequire source export, or the bare name) whose call result is itself
  // immediately called — createRequire(import.meta.url)("pkg").
  for (const nm of createRequireNames) {
    const re = new RegExp(`(?<![A-Za-z0-9_$.])${escapeRegExp(nm)}\\s*\\(`, "g");
    for (let m; (m = re.exec(masked)); ) {
      const open = m.index + m[0].length - 1;
      const close = matchingParenIn(masked, open);
      if (close === -1) continue;
      if (masked[nextSigIdx(masked, close + 1)] === "(") {
        out.findings.push({ file: fileRel, code: "loader-immediate-invocation", callee: nm });
      }
    }
  }
  // process.getBuiltinModule — both loader-capable argument spellings are
  // flagged; a nonliteral or concatenated argument fails closed as ambiguous;
  // a clean literal naming an ORDINARY builtin passes.
  {
    const re = /(?<![A-Za-z0-9_$.])process\s*\.\s*getBuiltinModule\s*\(/g;
    for (let m; (m = re.exec(masked)); ) {
      const open = m.index + m[0].length - 1;
      const j = nextSigIdx(masked, open + 1);
      const s = lexed.strings.get(j);
      if (!s) {
        out.findings.push({ file: fileRel, code: "loader-ambiguous-acquisition", detail: "nonliteral getBuiltinModule argument" });
        continue;
      }
      const k = nextSigIdx(masked, s.end);
      const clean = masked[k] === ")" || masked[k] === ",";
      if (!clean) {
        out.findings.push({ file: fileRel, code: "loader-ambiguous-acquisition", detail: "non-atomic getBuiltinModule argument" });
      } else if (LOADER_SPECIFIERS.has(s.value)) {
        out.findings.push({ file: fileRel, code: "loader-process-get-builtin-module", specifier: s.value });
      }
    }
  }
}

// ---- the two-direction repository scan ---------------------------------------

function scanRepo(repoRoot, tracked, opts = {}) {
  const repoRootAbs = path.resolve(repoRoot);
  const clothoRoot = opts.clothoRoot ?? "clotho";
  const permittedExternal = opts.permittedExternal ?? new Set(PERMITTED_EXTERNAL_CLOSURE_FILES);
  const { packageRoots, sources, unassigned } = buildAssignment(tracked);
  let clothoPackageName = null;
  try {
    const pj = JSON.parse(readFileSync(path.join(repoRootAbs, clothoRoot, "package.json"), "utf8"));
    if (typeof pj.name === "string") clothoPackageName = pj.name;
  } catch { /* absent/unreadable manifest: dir-name check still applies */ }
  const clothoRootAbs = path.join(repoRootAbs, clothoRoot);
  let realClothoRoot = null, realRepoRoot = null;
  try { realClothoRoot = realpathSync(clothoRootAbs); } catch { /* no clotho dir */ }
  try { realRepoRoot = realpathSync(repoRootAbs); } catch { /* keep null */ }
  const ctx = { repoRootAbs, clothoRoot, clothoRootAbs, clothoPackageName, permittedExternal, realClothoRoot, realRepoRoot };
  const out = {
    packageRoots,
    outside: { findings: [], unclassified: [] },
    clotho: { findings: [] },
    edges: [],
    counts: { outsideScanned: 0, clothoScanned: 0, unassigned }
  };
  for (const src of sources) {
    const isClotho = src.root === clothoRoot;
    const abs = path.join(repoRootAbs, ...src.path.split("/"));
    let st = null;
    try { st = lstatSync(abs); } catch { /* missing on disk: handled below */ }
    // A tracked symlink source (git mode 120000, or a symlink materialized on
    // disk) is flagged in BOTH directions and its content is not certified.
    if (src.symlink || (st !== null && st.isSymbolicLink())) {
      (isClotho ? out.clotho.findings : out.outside.findings)
        .push({ file: src.path, code: isClotho ? "clotho-tracked-symlink-source" : "outside-tracked-symlink-source" });
      continue;
    }
    let source;
    try {
      source = readFileSync(abs, "utf8");
    } catch (e) {
      const detail = `unreadable: ${e && e.code ? e.code : "error"}`;
      if (isClotho) out.clotho.findings.push({ file: src.path, code: "clotho-unclassified-source", detail });
      else out.outside.unclassified.push({ file: src.path, code: "outside-unclassified-source", detail });
      continue;
    }
    if (isClotho) {
      out.counts.clothoScanned++;
      scanClothoFile(ctx, src.path, source, { findings: out.clotho.findings, edges: out.edges });
    } else {
      out.counts.outsideScanned++;
      scanOutsideFile(ctx, src.path, source, out.outside);
    }
  }
  return out;
}

// Tracked entries of the REAL repository, from git's index: mode 120000 marks a
// tracked symlink even when the working copy materializes it as a plain file.
function gitTracked(repoRoot) {
  const raw = execFileSync("git", ["ls-files", "-z", "-s"], {
    cwd: repoRoot, shell: false, encoding: "utf8", maxBuffer: 64 * 1024 * 1024
  });
  const entries = [];
  for (const rec of raw.split("\0")) {
    if (!rec) continue;
    const tab = rec.indexOf("\t");
    const mode = rec.slice(0, rec.indexOf(" "));
    entries.push({ path: rec.slice(tab + 1), symlink: mode === "120000" });
  }
  return entries;
}

// ---- unit harness ------------------------------------------------------------

let UNITS = 0;
function unit(name, fn) {
  UNITS++;
  try { fn(); } catch (e) {
    console.error(`unit FAILED: ${name}`);
    throw e;
  }
}

function writeFixture(repo, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(repo, ...rel.split("/"));
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return Object.keys(files).map((p) => ({ path: p }));
}

const codesOf = (findings, file) => findings.filter((f) => f.file === file).map((f) => f.code);
const hasCode = (findings, file, code) => findings.some((f) => f.file === file && f.code === code);

// ---- A. outside-in: every recognized form is flagged --------------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-a-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "clotho/inner.mjs": "export const x = 1;\n",
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/f-import.mjs": 'import { x } from "../clotho/inner.mjs";\nexport const a = x;\n',
      "pkg/f-side.mjs": 'import "../clotho/inner.mjs";\n',
      "pkg/f-export-from.mjs": 'export { x } from "../clotho/inner.mjs";\n',
      "pkg/f-export-star.mjs": 'export * from "../clotho/inner.mjs";\n',
      "pkg/f-dynamic.mjs": 'export const p = import("../clotho/inner.mjs");\n',
      "pkg/f-require.mjs": 'export const r = require("../clotho/inner.mjs");\n',
      "pkg/f-module-require.mjs": 'export const s = module.require("../clotho/inner.mjs");\n'
    };
    const tracked = writeFixture(repo, files);
    const res = scanRepo(repo, tracked);
    const expect = [
      ["pkg/f-import.mjs", "import"],
      ["pkg/f-side.mjs", "import-side-effect"],
      ["pkg/f-export-from.mjs", "export-from"],
      ["pkg/f-export-star.mjs", "export-star"],
      ["pkg/f-dynamic.mjs", "dynamic-import"],
      ["pkg/f-require.mjs", "require"],
      ["pkg/f-module-require.mjs", "module-require"]
    ];
    for (const [file, form] of expect) {
      unit(`outside-in flags ${form} into clotho/`, () => {
        const fs2 = res.outside.findings.filter((f) => f.file === file);
        assert.equal(fs2.length, 1, `exactly one finding for ${file}`);
        assert.equal(fs2[0].code, "outside-relative-into-clotho");
        assert.equal(fs2[0].form, form);
        assert.equal(fs2[0].target, "clotho/inner.mjs");
      });
    }
    unit("outside-in: clotho fixture itself scans clean", () => {
      assert.deepEqual(res.clotho.findings, []);
      assert.deepEqual(res.outside.unclassified, []);
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- B. outside-in: comments/lookalikes, aliases, traversal, safe neighbors ---
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-b-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "clotho/inner.mjs": "export const x = 1;\n",
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/comments.mjs": [
        '// import { x } from "../clotho/inner.mjs"',
        '/* const r = require("../clotho/inner.mjs"); */',
        "const s = 'import(\"../clotho/inner.mjs\")';",
        'const t = "clotho/inventory.mjs";',
        "export const ok = s + t;",
        ""
      ].join("\n"),
      "pkg/alias.mjs": 'import { x as hidden } from "../clotho/inner.mjs";\nexport const a = hidden;\n',
      "pkg/traversal.mjs": 'import { x } from "./deep/../../clotho/inner.mjs";\nexport const b = x;\n',
      "pkg/safe-near.mjs": 'import { y } from "../clotho-like/helper.mjs";\nexport const c = y;\n',
      "pkg/safe-sub.mjs": 'import { z } from "./clotho/local.mjs";\nexport const d = z;\n',
      "pkg/safe-bare.mjs": 'import cd from "clothodile";\nexport const e = cd;\n',
      "clotho-like/helper.mjs": "export const y = 1;\n",
      "pkg/clotho/local.mjs": "export const z = 1;\n"
    };
    const tracked = writeFixture(repo, files);
    const res = scanRepo(repo, tracked);
    unit("outside-in: comments and lookalike strings do NOT trigger", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/comments.mjs"), []);
    });
    unit("outside-in: aliased named import into clotho is flagged", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/alias.mjs"), ["outside-relative-into-clotho"]);
    });
    unit("outside-in: path traversal into clotho is flagged", () => {
      const f = res.outside.findings.filter((x) => x.file === "pkg/traversal.mjs");
      assert.equal(f.length, 1);
      assert.equal(f[0].code, "outside-relative-into-clotho");
      assert.equal(f[0].target, "clotho/inner.mjs");
    });
    unit("outside-in: safe nearby paths are NOT flagged", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/safe-near.mjs"), []);
      assert.deepEqual(codesOf(res.outside.findings, "pkg/safe-sub.mjs"), []);
      assert.deepEqual(codesOf(res.outside.findings, "pkg/safe-bare.mjs"), []);
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- C. outside-in: nonliteral forms fail closed (AM-24) ----------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-c-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/nl-dyn.mjs": "export function f(n) { return import(n); }\n",
      "pkg/nl-req.mjs": "export function g(n) { return require(n); }\n",
      "pkg/nl-mreq.mjs": "export function h(n) { return module.require(n); }\n"
    };
    const tracked = writeFixture(repo, files);
    const res = scanRepo(repo, tracked);
    unit("outside-in: nonliteral dynamic import() fails closed", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/nl-dyn.mjs"), ["outside-nonliteral-dynamic-import"]);
    });
    unit("outside-in: nonliteral require() fails closed", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/nl-req.mjs"), ["outside-nonliteral-require"]);
    });
    unit("outside-in: nonliteral module.require() fails closed", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/nl-mreq.mjs"), ["outside-nonliteral-module-require"]);
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- D. symlink review signals (D23/AM-24) ------------------------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-d-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "clotho/inner.mjs": "export const x = 1;\n",
      "clotho/link.mjs": "export const l = 1;\n",
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/link.mjs": "export const l = 2;\n",
      "pkg/src.mjs": 'import { x } from "./alias/inner.mjs";\nexport const a = x;\n'
    };
    const tracked = writeFixture(repo, files);
    // Mark the two link files as index-mode-120000 tracked symlinks (git ground
    // truth even when the checkout materializes them as regular files).
    for (const t of tracked) if (t.path.endsWith("/link.mjs")) t.symlink = true;
    // A directory junction so ./alias/inner.mjs physically resolves into
    // clotho/ while the LEXICAL path never mentions clotho.
    symlinkSync(path.join(repo, "clotho"), path.join(repo, "pkg", "alias"), "junction");
    const res = scanRepo(repo, tracked);
    unit("tracked symlink source outside clotho is flagged", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/link.mjs"), ["outside-tracked-symlink-source"]);
    });
    unit("tracked symlink source inside clotho fails closed", () => {
      assert.deepEqual(codesOf(res.clotho.findings, "clotho/link.mjs"), ["clotho-tracked-symlink-source"]);
    });
    unit("symlink alias physically resolving into clotho/ is flagged (real-path check)", () => {
      const f = res.outside.findings.filter((x) => x.file === "pkg/src.mjs");
      assert.equal(f.length, 1);
      assert.equal(f[0].code, "outside-symlink-alias-into-clotho");
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- E. outside-in: bare clotho / package-name specifiers ---------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-e-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "@telos/clotho" }\n',
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/bare1.mjs": 'import c from "clotho";\nexport const a = c;\n',
      "pkg/bare2.mjs": 'import i from "clotho/inventory.mjs";\nexport const b = i;\n',
      "pkg/bare3.mjs": 'import p from "@telos/clotho";\nexport const c = p;\n',
      "pkg/bare4.mjs": 'import q from "@telos/clotho/weavers/util.mjs";\nexport const d = q;\n',
      "pkg/bare5.mjs": 'import s from "clothodile";\nexport const e = s;\n'
    };
    const tracked = writeFixture(repo, files);
    const res = scanRepo(repo, tracked);
    for (const file of ["pkg/bare1.mjs", "pkg/bare2.mjs", "pkg/bare3.mjs", "pkg/bare4.mjs"]) {
      unit(`outside-in: bare specifier in ${file} is flagged`, () => {
        assert.deepEqual(codesOf(res.outside.findings, file), ["outside-bare-clotho-specifier"]);
      });
    }
    unit("outside-in: a bare lookalike (clothodile) is NOT flagged", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/bare5.mjs"), []);
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- F. outside-in: file: URL and absolute-path literals into clotho ----------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-f-"));
  try {
    const innerAbs = path.join(repo, "clotho", "inner.mjs");
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "clotho/inner.mjs": "export const x = 1;\n",
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/f-url.mjs": `import { x } from "${pathToFileURL(innerAbs).href}";\nexport const a = x;\n`,
      "pkg/f-abs.mjs": `import { x } from "${toPosix(innerAbs)}";\nexport const b = x;\n`
    };
    const tracked = writeFixture(repo, files);
    const res = scanRepo(repo, tracked);
    unit("outside-in: literal file: URL into clotho is flagged", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/f-url.mjs"), ["outside-file-url-into-clotho"]);
    });
    unit("outside-in: literal absolute path into clotho is flagged", () => {
      assert.deepEqual(codesOf(res.outside.findings, "pkg/f-abs.mjs"), ["outside-absolute-into-clotho"]);
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- G. Clotho-side outbound closed allowlist (D23/D27/D33) -------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-g-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "clotho/inner.mjs": "export const x = 1;\n",
      "clotho/helper": "export const h = 1;\n",
      "clotho/nl-req.mjs": "export function f(n) { return require(n); }\n",
      "clotho/nl-mreq.mjs": "export function g(n) { return module.require(n); }\n",
      "clotho/nl-dyn.mjs": "export function h(n) { return import(n); }\n",
      "clotho/file-url.mjs": 'import { x } from "file:///tmp/elsewhere/x.mjs";\nexport const a = x;\n',
      "clotho/abs1.mjs": 'import { a } from "/abs/elsewhere/a.mjs";\nexport const b = a;\n',
      "clotho/abs2.mjs": 'import { b } from "C:/elsewhere/b.mjs";\nexport const c = b;\n',
      "clotho/bare.mjs": 'import lp from "left-pad";\nexport const d = lp;\n',
      "clotho/escape.mjs": 'import { g } from "../pkg/gate.mjs";\nexport const e = g;\n',
      "clotho/unresolved.mjs": 'import { m } from "./missing.mjs";\nexport const f2 = m;\n',
      "clotho/ambig.mjs": 'import { h } from "./helper";\nexport const g2 = h;\n',
      "clotho/ok.mjs": 'import { readFileSync } from "node:fs";\nimport { x } from "./inner.mjs";\nexport const i = x && readFileSync;\n',
      "clotho/vendor-user.mjs": 'import { v } from "../merkle-dag/vendor.mjs";\nexport const j = v;\n',
      "clotho/forbidden-md.mjs": 'import { f } from "../merkle-dag/forbidden.mjs";\nexport const k = f;\n',
      "pkg/package.json": '{ "name": "pkg" }\n',
      "pkg/gate.mjs": "export const g = 1;\n",
      "merkle-dag/package.json": '{ "name": "merkle-dag" }\n',
      "merkle-dag/vendor.mjs": "export const v = 1;\n",
      "merkle-dag/forbidden.mjs": "export const f = 1;\n"
    };
    const tracked = writeFixture(repo, files);
    // The permitted external closure is the frozen inventory value's shape:
    // exactly merkle-dag/vendor.mjs (mirrors PERMITTED_EXTERNAL_CLOSURE_FILES).
    const res = scanRepo(repo, tracked, { permittedExternal: new Set(["merkle-dag/vendor.mjs"]) });
    const one = (file, code, extra = {}) => unit(`clotho outbound: ${file} -> ${code}`, () => {
      const f = res.clotho.findings.filter((x) => x.file === file);
      assert.equal(f.length, 1, `exactly one finding for ${file}: ${JSON.stringify(f)}`);
      assert.equal(f[0].code, code);
      for (const [k2, v2] of Object.entries(extra)) assert.equal(f[0][k2], v2);
    });
    one("clotho/nl-req.mjs", "clotho-nonliteral-require");
    one("clotho/nl-mreq.mjs", "clotho-nonliteral-module-require");
    one("clotho/nl-dyn.mjs", "clotho-nonliteral-dynamic-import");
    one("clotho/file-url.mjs", "clotho-file-url-specifier");
    one("clotho/abs1.mjs", "clotho-absolute-path-specifier");
    one("clotho/abs2.mjs", "clotho-absolute-path-specifier");
    one("clotho/bare.mjs", "clotho-forbidden-bare-specifier", { specifier: "left-pad" });
    one("clotho/escape.mjs", "clotho-relative-outside-permitted-closure", { target: "pkg/gate.mjs" });
    one("clotho/unresolved.mjs", "clotho-relative-resolution-failed", { kind: "unresolved" });
    one("clotho/ambig.mjs", "clotho-relative-resolution-failed", { kind: "ambiguous-extension" });
    one("clotho/forbidden-md.mjs", "clotho-relative-outside-permitted-closure", { target: "merkle-dag/forbidden.mjs" });
    unit("clotho outbound: node: builtin + in-clotho relative + permitted merkle-dag pass", () => {
      assert.deepEqual(codesOf(res.clotho.findings, "clotho/ok.mjs"), []);
      assert.deepEqual(codesOf(res.clotho.findings, "clotho/vendor-user.mjs"), []);
      assert.ok(res.edges.some((e) => e.file === "clotho/ok.mjs" && e.target === "clotho/inner.mjs"));
      assert.ok(res.edges.some((e) => e.file === "clotho/vendor-user.mjs" && e.target === "merkle-dag/vendor.mjs"));
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- H. D30/D32 loader-construction checks ------------------------------------
{
  const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-h-"));
  try {
    const files = {
      "clotho/package.json": '{ "name": "clotho" }\n',
      "clotho/l-safe1.mjs": 'import { builtinModules } from "module";\nexport const n = builtinModules.length;\n',
      "clotho/l-safe2.mjs": 'import { builtinModules } from "node:module";\nexport const n = builtinModules.length;\n',
      "clotho/l-safe3.mjs": 'import { isBuiltin } from "module";\nexport const y = isBuiltin("fs");\n',
      "clotho/l-safe4.mjs": 'import { isBuiltin } from "node:module";\nexport const y = isBuiltin("fs");\n',
      "clotho/l-alias.mjs": 'import { builtinModules as bm, isBuiltin as ib } from "node:module";\nexport const ok = ib("fs") && bm.length;\n',
      "clotho/l-cr1.mjs": 'import { createRequire } from "module";\nexport const c = createRequire;\n',
      "clotho/l-cr2.mjs": 'import { createRequire } from "node:module";\nexport const c = createRequire;\n',
      "clotho/l-cr-alias.mjs": 'import { createRequire as loadFactory } from "node:module";\nexport const c = loadFactory;\n',
      "clotho/l-other1.mjs": 'import { syncBuiltinESMExports } from "node:module";\nexport const s = syncBuiltinESMExports;\n',
      "clotho/l-other2.mjs": 'import { findSourceMap } from "module";\nexport const s = findSourceMap;\n',
      "clotho/l-ns.mjs": 'import * as Module from "node:module";\nexport const f = Module.createRequire;\n',
      "clotho/l-def.mjs": 'import M from "node:module";\nexport const g = M.builtinModules;\n',
      "clotho/l-imm.mjs": 'import { createRequire } from "node:module";\nexport const r = createRequire(import.meta.url)("external-package");\n',
      "clotho/l-imm-alias.mjs": 'import { createRequire as loadFactory } from "node:module";\nexport const p = loadFactory(import.meta.url)("left-pad");\n',
      "clotho/l-reex1.mjs": 'export { createRequire } from "node:module";\n',
      "clotho/l-reex2.mjs": 'export { builtinModules } from "node:module";\n',
      "clotho/l-reex3.mjs": 'export * from "module";\n',
      "clotho/l-dynreex.mjs": 'export const loader = await import("node:module");\n',
      "clotho/l-cjs1.mjs": 'const m = require("module");\nexport const c = m;\n',
      "clotho/l-cjs2.mjs": 'const n = module.require("node:module");\nexport const d = n;\n',
      "clotho/l-dyn.mjs": 'export const e = import("node:module");\n',
      "clotho/l-gbm1.mjs": 'export const a = process.getBuiltinModule("module");\n',
      "clotho/l-gbm2.mjs": 'export const b = process.getBuiltinModule("node:module");\n',
      "clotho/l-gbm-safe.mjs": 'export const c = process.getBuiltinModule("fs");\n',
      "clotho/l-gbm-ambig.mjs": "export function get(n) { return process.getBuiltinModule(n); }\n",
      "clotho/l-gbm-concat.mjs": 'export const d = process.getBuiltinModule("mod" + "ule");\n',
      "clotho/l-computed.mjs": 'import * as M2 from "node:module";\nexport const h = M2["createRequire"];\n',
      "clotho/l-concat-dyn.mjs": 'export const i = import("node:" + "module");\n',
      "clotho/l-side.mjs": 'import "node:module";\n',
      "clotho/l-clean.mjs": [
        '// import { createRequire } from "node:module"',
        '/* process.getBuiltinModule("module") */',
        "const s = 'createRequire(import.meta.url)(\"x\")';",
        'const t = "module.require(\\"node:module\\")";',
        'import { createHash } from "node:crypto";',
        "export const u = s + t + typeof createHash;",
        ""
      ].join("\n")
    };
    const tracked = writeFixture(repo, files);
    const res = scanRepo(repo, tracked);
    const F = res.clotho.findings;
    for (const file of ["clotho/l-safe1.mjs", "clotho/l-safe2.mjs", "clotho/l-safe3.mjs", "clotho/l-safe4.mjs"]) {
      unit(`loader: safe named import accepted (${file})`, () => assert.deepEqual(codesOf(F, file), []));
    }
    unit("loader: safe named exports under local aliases accepted (decided by SOURCE export name)", () => {
      assert.deepEqual(codesOf(F, "clotho/l-alias.mjs"), []);
    });
    unit("loader: createRequire flagged from both specifiers", () => {
      assert.deepEqual(codesOf(F, "clotho/l-cr1.mjs"), ["loader-create-require-named-import"]);
      assert.deepEqual(codesOf(F, "clotho/l-cr2.mjs"), ["loader-create-require-named-import"]);
    });
    unit("loader: aliased createRequire (as loadFactory) flagged", () => {
      const f = F.filter((x) => x.file === "clotho/l-cr-alias.mjs");
      assert.deepEqual(f.map((x) => x.code), ["loader-create-require-named-import"]);
      assert.equal(f[0].local, "loadFactory");
    });
    unit("loader: allowlist semantics — two additional non-allowlisted named exports flagged", () => {
      assert.deepEqual(codesOf(F, "clotho/l-other1.mjs"), ["loader-non-allowlisted-named-export"]);
      assert.deepEqual(codesOf(F, "clotho/l-other2.mjs"), ["loader-non-allowlisted-named-export"]);
    });
    unit("loader: namespace import + property access flagged", () => {
      const codes = codesOf(F, "clotho/l-ns.mjs");
      assert.ok(codes.includes("loader-namespace-import"), JSON.stringify(codes));
      assert.ok(codes.includes("loader-binding-property-access"), JSON.stringify(codes));
    });
    unit("loader: default import + property access (even of a safe name) flagged", () => {
      const codes = codesOf(F, "clotho/l-def.mjs");
      assert.ok(codes.includes("loader-default-import"), JSON.stringify(codes));
      assert.ok(codes.includes("loader-binding-property-access"), JSON.stringify(codes));
    });
    unit("loader: immediate invocation createRequire(import.meta.url)(...) flagged", () => {
      assert.ok(codesOf(F, "clotho/l-imm.mjs").includes("loader-immediate-invocation"));
      assert.ok(codesOf(F, "clotho/l-imm-alias.mjs").includes("loader-immediate-invocation"));
    });
    unit("loader: static re-export flagged — including a safe name", () => {
      assert.deepEqual(codesOf(F, "clotho/l-reex1.mjs"), ["loader-static-reexport"]);
      assert.deepEqual(codesOf(F, "clotho/l-reex2.mjs"), ["loader-static-reexport"]);
      assert.deepEqual(codesOf(F, "clotho/l-reex3.mjs"), ["loader-static-reexport"]);
    });
    unit("loader: dynamic re-export form flagged", () => {
      assert.deepEqual(codesOf(F, "clotho/l-dynreex.mjs"), ["loader-dynamic-import"]);
    });
    unit("loader: CommonJS require/module.require of either specifier flagged", () => {
      assert.deepEqual(codesOf(F, "clotho/l-cjs1.mjs"), ["loader-cjs-require"]);
      assert.deepEqual(codesOf(F, "clotho/l-cjs2.mjs"), ["loader-cjs-require"]);
    });
    unit("loader: dynamic import of node:module flagged", () => {
      assert.deepEqual(codesOf(F, "clotho/l-dyn.mjs"), ["loader-dynamic-import"]);
    });
    unit("loader: both process.getBuiltinModule spellings flagged", () => {
      assert.deepEqual(codesOf(F, "clotho/l-gbm1.mjs"), ["loader-process-get-builtin-module"]);
      assert.deepEqual(codesOf(F, "clotho/l-gbm2.mjs"), ["loader-process-get-builtin-module"]);
    });
    unit("loader: getBuiltinModule of an ordinary builtin literal passes", () => {
      assert.deepEqual(codesOf(F, "clotho/l-gbm-safe.mjs"), []);
    });
    unit("loader: computed/concatenated/ambiguous acquisition fails closed as unclassified", () => {
      assert.deepEqual(codesOf(F, "clotho/l-gbm-ambig.mjs"), ["loader-ambiguous-acquisition"]);
      assert.deepEqual(codesOf(F, "clotho/l-gbm-concat.mjs"), ["loader-ambiguous-acquisition"]);
      const comp = codesOf(F, "clotho/l-computed.mjs");
      assert.ok(comp.includes("loader-namespace-import"), JSON.stringify(comp));
      assert.ok(comp.includes("loader-ambiguous-acquisition"), JSON.stringify(comp));
      assert.deepEqual(codesOf(F, "clotho/l-concat-dyn.mjs"), ["clotho-nonliteral-dynamic-import"]);
    });
    unit("loader: side-effect import of node:module is not an allowlisted form", () => {
      assert.deepEqual(codesOf(F, "clotho/l-side.mjs"), ["loader-non-allowlisted-import-form"]);
    });
    unit("loader: comments/string lookalikes do NOT trigger; ordinary builtin accepted", () => {
      assert.deepEqual(codesOf(F, "clotho/l-clean.mjs"), []);
    });
  } finally { rmSync(repo, { recursive: true, force: true }); }
}

// ---- I. frozen loader mapping re-exercised (D32, landed in Task 4a) -----------
{
  const NORMATIVE = {
    "module": ["builtinModules", "isBuiltin"],
    "node:module": ["builtinModules", "isBuiltin"]
  };
  // Exact-equality validation: identical sorted key set AND per-key identical
  // export arrays (order-sensitive — the committed value is the sorted pair).
  const exactEqual = (a, b) => {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
    return ka.every((k) => Array.isArray(a[k]) && Array.isArray(b[k]) &&
      a[k].length === b[k].length && a[k].every((v, i) => v === b[k][i]));
  };
  unit("mapping: committed mapping deep-equals the normative mapping", () => {
    assert.deepEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, NORMATIVE);
  });
  unit("mapping: exact key equality — no missing or additional specifier", () => {
    assert.deepEqual(Object.keys(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS).sort(), Object.keys(NORMATIVE).sort());
    assert.ok(exactEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, NORMATIVE));
  });
  unit("mapping: exact value equality — no missing or additional export", () => {
    for (const k of Object.keys(NORMATIVE)) {
      assert.deepEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS[k], NORMATIVE[k]);
    }
  });
  unit("mapping: outer object and inner arrays are frozen", () => {
    assert.ok(Object.isFrozen(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS));
    for (const v of Object.values(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS)) assert.ok(Object.isFrozen(v));
  });
  unit("mapping: mutation attempts fail or leave it unchanged", () => {
    assert.throws(() => { LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["module"].push("createRequire"); });
    assert.throws(() => { "use strict"; LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["node:fs"] = ["readFileSync"]; });
    assert.throws(() => { "use strict"; delete LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS["module"]; });
    assert.deepEqual(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS, NORMATIVE);
  });
  unit("mapping: a copy with one export added fails exact-equality validation", () => {
    const widened = {
      "module": [...NORMATIVE["module"], "createRequire"],
      "node:module": [...NORMATIVE["node:module"]]
    };
    assert.equal(exactEqual(widened, NORMATIVE), false);
    const extraKey = { ...NORMATIVE, "node:vm": ["runInNewContext"] };
    assert.equal(exactEqual(extraKey, NORMATIVE), false);
  });
  unit("mapping: the scanner's loader key set IS the imported mapping's key set", () => {
    assert.deepEqual([...LOADER_SPECIFIERS].sort(), Object.keys(LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS).sort());
  });
}

// ---- J. the shared classifier/resolver (D33): one implementation, two consumers
{
  unit("shared tooling: the advisory scanner dispatches through weavers/util.mjs exports", () => {
    assert.equal(SHARED.classifyModuleLoads, util.classifyModuleLoads);
    assert.equal(SHARED.scanImports, util.scanImports);
    assert.equal(SHARED.lex, util.lex);
    assert.equal(SHARED.resolveRelativeSpecifier, util.resolveRelativeSpecifier);
  });
  // Every accepted literal syntax supported by the outbound scanner receives
  // IDENTICAL closure treatment: for each form, the D33 closure derivation and
  // the advisory outbound scan resolve the same single edge to the same target.
  const FORMS = [
    ["import", 'import { d } from "./dep.mjs";\nexport const a = d;\n'],
    ["import-side-effect", 'import "./dep.mjs";\n'],
    ["export-from", 'export { d } from "./dep.mjs";\n'],
    ["export-star", 'export * from "./dep.mjs";\n'],
    ["dynamic-import", 'export const p = import("./dep.mjs");\n'],
    ["require", 'export const r = require("./dep.mjs");\n'],
    ["module-require", 'export const s = module.require("./dep.mjs");\n']
  ];
  for (const [form, src] of FORMS) {
    unit(`shared tooling: ${form} receives identical closure treatment in both consumers`, () => {
      const repo = mkdtempSync(path.join(tmpdir(), "clotho-adv-j-"));
      try {
        const files = {
          "clotho/package.json": '{ "name": "clotho" }\n',
          "clotho/entry.mjs": src,
          "clotho/dep.mjs": "export const d = 1;\n"
        };
        const tracked = writeFixture(repo, files);
        const closure = deriveAcceptedClosure(path.join(repo, "clotho", "entry.mjs"), { repoRoot: repo });
        assert.deepEqual(closure, ["clotho/dep.mjs", "clotho/entry.mjs"]);
        const res = scanRepo(repo, tracked);
        assert.deepEqual(res.clotho.findings, [], `no findings for ${form}`);
        const edges = res.edges.filter((e) => e.file === "clotho/entry.mjs");
        assert.equal(edges.length, 1);
        assert.equal(edges[0].form, form);
        assert.equal(edges[0].target, "clotho/dep.mjs");
        // Identical membership: closure set == scanner edge targets + entry.
        assert.deepEqual(closure, [...new Set([...edges.map((e) => e.target), "clotho/entry.mjs"])].sort());
      } finally { rmSync(repo, { recursive: true, force: true }); }
    });
  }
}

// ---- REAL-REPO two-direction scan (the advisory invariant over this tree) -----
{
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const tracked = gitTracked(repoRoot);
  const res = scanRepo(repoRoot, tracked);
  assert.ok(res.packageRoots.includes("clotho"), "real repo: clotho package root inventoried from tracked package.json files");
  assert.ok(res.counts.clothoScanned >= 15, `real repo: expected clotho sources scanned, got ${res.counts.clothoScanned}`);
  assert.ok(res.counts.outsideScanned >= 50, `real repo: expected outside sources scanned, got ${res.counts.outsideScanned}`);
  for (const u of res.outside.unclassified) {
    console.log(`advisory UNCLASSIFIED (reported, never certified absent): ${u.file}${u.detail ? " — " + u.detail : ""}${u.specifier ? " — " + u.specifier : ""}`);
  }
  const bad = [...res.outside.findings, ...res.clotho.findings];
  if (bad.length > 0) {
    for (const f of bad) console.error(`advisory FINDING: ${JSON.stringify(f)}`);
    console.error(`clotho test-advisory FAILED: ${bad.length} finding(s) on the real tree`);
    process.exit(1);
  }
  console.log(
    `advisory real-repo scan: outside-in PASS (${res.counts.outsideScanned} sources, ` +
    `${res.outside.unclassified.length} unclassified reported), clotho outbound PASS ` +
    `(${res.counts.clothoScanned} sources, ${res.edges.length} accepted edges, ` +
    `${res.counts.unassigned} tracked sources outside every package root not in scope)`
  );
}

console.log(`clotho test-advisory OK (${UNITS} units)`);
