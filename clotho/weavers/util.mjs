// weavers/util.mjs — Clotho's shared weaver substrate (plan v12 Task 4a). Zero
// dependencies: Node stdlib only.
//
// One lexical scanner (comment/string aware, never executes code), ONE
// module-load form classifier and ONE relative-specifier resolver (D33) shared
// by the closure derivation and — from Task 5 — the advisory outbound scanner;
// the accepted relative module-load closure derived from them; a real-file
// walker; the counted-iterator constructor (D26/D29); the physical-containment
// helper (D21); and the no-shell weaver-facing git wrapper.

import { readFileSync, readdirSync, lstatSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const IDENT_CHAR = /[A-Za-z0-9_$]/;
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const HEX40 = /^[0-9a-f]{40}$/;

// Escape a run of text for use as a LITERAL inside a RegExp: every
// metacharacter is neutralized, so searched text can never alter the matcher.
export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- lexical scanner ---------------------------------------------------------
// Single pass over the source tracking code / line-comment / block-comment /
// single- and double-quoted string / template-literal state. Produces a `masked`
// string (same length as the source) in which every comment character and every
// string/template INTERIOR byte is replaced by a space, while structural
// delimiters (quotes, backticks, braces, parens) are preserved — so a structural
// regex over `masked` can never match inside a comment or string. Also returns
// `strings`: each plain single/double string literal keyed by its opening-quote
// index, carrying its decoded-enough value (specifiers never contain escapes we
// must decode beyond the raw slice). Templates are recorded as non-plain (a
// template specifier is treated as non-literal). Regex literals are not treated
// as strings; they are masked as code (specifiers are never regexes).

export function lex(source) {
  const n = source.length;
  const keep = new Uint8Array(n); // 1 = code byte to preserve; 0 = blank to space
  const strings = new Map(); // openQuoteIndex -> { end, value, plain:true }
  const templates = new Set(); // opening-backtick index
  let i = 0;
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];
    if (c === "/" && c2 === "/") {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const open = i;
      keep[open] = 1; // preserve the opening quote position
      i++;
      let value = "";
      while (i < n && source[i] !== c) {
        if (source[i] === "\\") { value += source[i + 1] ?? ""; i += 2; continue; }
        if (source[i] === "\n") break; // unterminated line string; stop
        value += source[i];
        i++;
      }
      const closed = i < n && source[i] === c;
      if (closed) { keep[i] = 1; i++; }
      strings.set(open, { end: closed ? i : n, value, plain: true });
      continue;
    }
    if (c === "`") {
      const open = i;
      keep[open] = 1;
      templates.add(open);
      i++;
      let depth = 0;
      while (i < n) {
        if (source[i] === "\\") { i += 2; continue; }
        if (source[i] === "`" && depth === 0) { keep[i] = 1; i++; break; }
        if (source[i] === "$" && source[i + 1] === "{") { depth++; i += 2; continue; }
        if (source[i] === "}" && depth > 0) { depth--; i++; continue; }
        i++;
      }
      continue;
    }
    keep[i] = 1; // ordinary code byte
    i++;
  }
  let masked = "";
  for (let k = 0; k < n; k++) masked += keep[k] ? source[k] : " ";
  return { masked, strings, templates };
}

// ---- module-load form classifier (D33) --------------------------------------
// Recognizes exactly the accepted forms and reports, per load site, its form,
// its literal specifier (or null when non-literal), and whether it is literal.
//   static import  :  import ... from "x"      form "import"
//   side-effect    :  import "x"               form "import-side-effect"
//   export-from    :  export { ... } from "x"  form "export-from"
//   export-star    :  export * from "x"        form "export-star"
//   dynamic import :  import("x")              form "dynamic-import"
//   require        :  require("x")             form "require"
//   module.require :  module.require("x")      form "module-require"
// A dynamic import / require / module.require whose argument is not a plain
// string literal is reported with literal:false and specifier:null (no edge).

export function classifyModuleLoads(source) {
  const { masked, strings } = lex(source);
  const sites = [];

  const literalAt = (parenIdx) => {
    // parenIdx points at "("; find next non-space; if a plain string opens there
    // and the call closes right after it, return its value, else null.
    let j = parenIdx + 1;
    while (j < masked.length && masked[j] === " ") j++;
    const s = strings.get(j);
    if (!s || !s.plain) return null;
    let k = s.end;
    while (k < masked.length && masked[k] === " ") k++;
    return masked[k] === ")" ? s.value : null;
  };

  // from-clauses: static import / export-from / export-star.
  const fromRe = /(?<![A-Za-z0-9_$])from\s*["']/g;
  for (let m; (m = fromRe.exec(masked)); ) {
    const quoteIdx = m.index + m[0].length - 1;
    const s = strings.get(quoteIdx);
    if (!s) continue;
    // The nearest preceding import/export keyword governs this from-clause.
    const head = masked.slice(0, m.index);
    const kwRe = /(?<![A-Za-z0-9_$])(import|export)(?![A-Za-z0-9_$])/g;
    let last = null;
    for (let mm; (mm = kwRe.exec(head)); ) last = mm;
    if (!last) continue;
    const region = head.slice(last.index);
    let form;
    if (last[1] === "import") form = "import";
    else form = /\*/.test(region) ? "export-star" : "export-from";
    sites.push({ form, specifier: s.value, literal: true });
  }

  // side-effect imports: import "x"  (a quote directly after import, no `from`)
  const sideRe = /(?<![A-Za-z0-9_$])import\s*["']/g;
  for (let m; (m = sideRe.exec(masked)); ) {
    const quoteIdx = m.index + m[0].length - 1;
    const s = strings.get(quoteIdx);
    if (s) sites.push({ form: "import-side-effect", specifier: s.value, literal: true });
  }

  // dynamic import: import( ... )
  const dynRe = /(?<![A-Za-z0-9_$])import\s*\(/g;
  for (let m; (m = dynRe.exec(masked)); ) {
    const paren = m.index + m[0].length - 1;
    const value = literalAt(paren);
    sites.push({ form: "dynamic-import", specifier: value, literal: value !== null });
  }

  // module.require( ... )
  const modReqRe = /(?<![A-Za-z0-9_$])module\s*\.\s*require\s*\(/g;
  const modReqParens = new Set();
  for (let m; (m = modReqRe.exec(masked)); ) {
    const paren = m.index + m[0].length - 1;
    modReqParens.add(paren);
    const value = literalAt(paren);
    sites.push({ form: "module-require", specifier: value, literal: value !== null });
  }

  // require( ... ) — standalone, NOT preceded by a dot (so not module.require)
  const reqRe = /(?<![A-Za-z0-9_$.])require\s*\(/g;
  for (let m; (m = reqRe.exec(masked)); ) {
    const paren = m.index + m[0].length - 1;
    if (modReqParens.has(paren)) continue;
    const value = literalAt(paren);
    sites.push({ form: "require", specifier: value, literal: value !== null });
  }

  return sites;
}

// ---- relative-specifier resolver + physical containment (D33/D21) ------------
// A resolver used by both the closure derivation and the outbound scanner. Only
// literal specifiers beginning with "./" or "../" are relative module edges;
// everything else (node:, bare) resolves to { ok:false, kind:"non-relative" }.
// A relative specifier is resolved under the importing file's directory, then
// every existing path component from the repo root down is lstat-checked: a
// symlink component is fatal; the resolved target must be an existing regular
// file beneath the repo root; a target under merkle-dag/ is permitted ONLY if it
// is in allowExternal, otherwise "forbidden"; anything else is "escape".

function toPosix(p) { return p.split(path.sep).join("/"); }

// Walk each existing component from repoRootReal down to `absTarget`; reject any
// symlink component; return the deepest existing ancestor's real path (or null
// if a component is a symlink / a missing component appears mid-chain after an
// existing one — the caller separately checks existence of the final target).
function containmentReal(repoRootReal, absTarget) {
  const rel = path.relative(repoRootReal, absTarget);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return { ok: false, reason: "escape" };
  const segs = rel.split(path.sep);
  let cur = repoRootReal;
  for (const seg of segs) {
    cur = path.join(cur, seg);
    let st;
    try { st = lstatSync(cur); } catch { return { ok: true, deepestExisting: null, missing: true }; }
    if (st.isSymbolicLink()) return { ok: false, reason: "symlink" };
  }
  return { ok: true, missing: false };
}

export function resolveRelativeSpecifier(fromFileAbs, specifier, { repoRoot, allowExternal = new Set() } = {}) {
  if (typeof specifier !== "string" || !(specifier.startsWith("./") || specifier.startsWith("../"))) {
    return { ok: false, kind: "non-relative" };
  }
  const repoRootReal = realpathSync(repoRoot);
  const fromDir = path.dirname(fromFileAbs);
  // Resolve as-is; if it has no extension and does not exist, try appending .mjs.
  let abs = path.resolve(fromDir, specifier);
  const candidates = [abs];
  if (!path.extname(specifier)) candidates.push(abs + ".mjs");

  for (const cand of candidates) {
    const contain = containmentReal(repoRootReal, cand);
    if (!contain.ok) return { ok: false, kind: contain.reason, resolved: toPosix(path.relative(repoRootReal, cand)) };
    let st;
    try { st = lstatSync(cand); } catch { continue; } // missing: try next candidate
    if (st.isSymbolicLink()) return { ok: false, kind: "symlink", resolved: toPosix(path.relative(repoRootReal, cand)) };
    if (!st.isFile()) return { ok: false, kind: "non-regular", resolved: toPosix(path.relative(repoRootReal, cand)) };
    const relPosix = toPosix(path.relative(repoRootReal, cand));
    const underClotho = relPosix === "clotho" || relPosix.startsWith("clotho/");
    if (!underClotho) {
      if (allowExternal.has(relPosix)) return { ok: true, repoRelative: relPosix, abs: cand };
      if (relPosix.startsWith("merkle-dag/")) return { ok: false, kind: "forbidden", resolved: relPosix };
      return { ok: false, kind: "escape", resolved: relPosix };
    }
    return { ok: true, repoRelative: relPosix, abs: cand };
  }
  return { ok: false, kind: "unresolved", resolved: toPosix(path.relative(repoRootReal, abs)) };
}

// ---- accepted relative module-load closure (D33) -----------------------------
// The entry module plus every file reachable through an accepted LITERAL RELATIVE
// module-load edge, recursively. Fatal (throws) on: a symlink/non-regular/
// escaping/forbidden target, or a literal relative specifier that does not
// resolve to an existing file. Non-literal dynamic import/require/module.require
// and non-relative specifiers create NO edge. Returns sorted repo-relative paths.

export function deriveAcceptedClosure(entryFileAbs, { repoRoot, allowExternal = new Set() } = {}) {
  const repoRootReal = realpathSync(repoRoot);
  const entryRel = toPosix(path.relative(repoRootReal, realpathSync(entryFileAbs)));
  const seen = new Set([entryRel]);
  const absOf = new Map([[entryRel, realpathSync(entryFileAbs)]]);
  const work = [entryRel];
  while (work.length) {
    const rel = work.shift();
    const abs = absOf.get(rel);
    const source = readFileSync(abs, "utf8");
    for (const site of classifyModuleLoads(source)) {
      // Only literal specifiers participate; a non-literal dynamic/require site
      // creates no edge (but is still a recognized site).
      if (!site.literal || site.specifier === null) continue;
      if (!(site.specifier.startsWith("./") || site.specifier.startsWith("../"))) continue;
      const r = resolveRelativeSpecifier(abs, site.specifier, { repoRoot: repoRootReal, allowExternal });
      if (!r.ok) {
        throw new Error(`closure: ${rel} -> ${JSON.stringify(site.specifier)} is ${r.kind}${r.resolved ? " (" + r.resolved + ")" : ""}`);
      }
      if (!seen.has(r.repoRelative)) {
        seen.add(r.repoRelative);
        absOf.set(r.repoRelative, r.abs);
        work.push(r.repoRelative);
      }
    }
  }
  return [...seen].sort();
}

// ---- Phase 1 export scanner --------------------------------------------------
// Recognizes exactly `export function`, `export async function`, `export const`,
// and `export class` followed by an identifier. Unsupported re-exports, computed
// exports, default exports, and dynamic symbol flow warn and emit no symbol.

export function scanExports(source) {
  const { masked } = lex(source);
  const exportsFound = [];
  const warnings = [];
  const seen = new Set();
  const add = (name) => { if (!seen.has(name)) { seen.add(name); exportsFound.push(name); } };

  const declRe = /(?<![A-Za-z0-9_$])export\s+(?:(async)\s+function|function|const|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (let m; (m = declRe.exec(masked)); ) add(m[2]);

  // Unsupported forms -> warn, no inferred symbol.
  if (/(?<![A-Za-z0-9_$])export\s+default(?![A-Za-z0-9_$])/.test(masked)) warnings.push("export default is not a Phase 1 export");
  if (/(?<![A-Za-z0-9_$])export\s*\{/.test(masked)) warnings.push("export { ... } list is not a Phase 1 export");
  if (/(?<![A-Za-z0-9_$])export\s*\*/.test(masked)) warnings.push("export * re-export is not a Phase 1 export");
  if (/(?<![A-Za-z0-9_$])export\s+(?:const|let|var)\s*[[{]/.test(masked)) warnings.push("destructuring/computed export is not a Phase 1 export");

  exportsFound.sort();
  return { exports: exportsFound, warnings };
}

// ---- static-import parser (code weaver) --------------------------------------
// Parses static import declarations only. Returns, per declaration: its POSIX
// specifier, its [start,end) span in the source, and its bindings. Bindings:
//   { form:"named",       imported, local }   import { a as b } / import { a }
//   { form:"default",     local }             import d from "x"
//   { form:"namespace",   local }             import * as ns from "x"
//   { form:"side-effect" }                    import "x"
// Only used to derive knowledge-graph dependency edges (unchanged by D33).

export function scanImports(source) {
  const { masked, strings } = lex(source);
  const imports = [];
  const importRe = /(?<![A-Za-z0-9_$])import(?![A-Za-z0-9_$])/g;
  for (let m; (m = importRe.exec(masked)); ) {
    const start = m.index;
    // dynamic import() — skip (handled by classifyModuleLoads, not a static import)
    let after = m.index + "import".length;
    while (after < masked.length && masked[after] === " ") after++;
    if (masked[after] === "(") continue;
    if (masked[after] === ".") continue; // import.meta

    // side-effect: import "x"
    if (masked[after] === '"' || masked[after] === "'") {
      const s = strings.get(after);
      if (s) imports.push({ specifier: s.value, span: [start, s.end], bindings: [{ form: "side-effect" }] });
      continue;
    }
    // clause ... from "x"
    const fromRe = /(?<![A-Za-z0-9_$])from\s*["']/g;
    fromRe.lastIndex = after;
    const fm = fromRe.exec(masked);
    if (!fm) continue;
    const quoteIdx = fm.index + fm[0].length - 1;
    const s = strings.get(quoteIdx);
    if (!s) continue;
    const clause = masked.slice(after, fm.index);
    const bindings = parseImportClause(clause);
    imports.push({ specifier: s.value, span: [start, s.end], bindings });
  }
  return imports;
}

function parseImportClause(clause) {
  const bindings = [];
  // namespace: * as ns
  const nsRe = /\*\s*as\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  for (let m; (m = nsRe.exec(clause)); ) bindings.push({ form: "namespace", local: m[1] });
  // named group { ... }
  const braceStart = clause.indexOf("{");
  const braceEnd = clause.indexOf("}");
  let namedRegion = "";
  if (braceStart !== -1 && braceEnd !== -1 && braceEnd > braceStart) {
    namedRegion = clause.slice(braceStart + 1, braceEnd);
    for (const part of namedRegion.split(",")) {
      const t = part.trim();
      if (!t) continue;
      const asMatch = t.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
      if (asMatch) bindings.push({ form: "named", imported: asMatch[1], local: asMatch[2] });
      else if (IDENT.test(t)) bindings.push({ form: "named", imported: t, local: t });
    }
  }
  // default: a leading identifier before any '{' or '*'
  const head = (braceStart === -1 ? clause : clause.slice(0, braceStart)).replace(/\*\s*as\s+[A-Za-z_$][A-Za-z0-9_$]*/g, "");
  const defMatch = head.match(/^\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*,?\s*$/);
  if (defMatch && defMatch[1] !== "from") bindings.push({ form: "default", local: defMatch[1] });
  return bindings;
}

// True if `name` occurs as an identifier token in `masked` OUTSIDE every span in
// `excludeSpans` (metacharacter-safe: guarded by non-identifier boundaries).
export function identifierUsedOutside(source, name, excludeSpans) {
  const { masked } = lex(source);
  const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRegExp(name)}(?![A-Za-z0-9_$])`, "g");
  for (let m; (m = re.exec(masked)); ) {
    const idx = m.index;
    if (!excludeSpans.some(([a, b]) => idx >= a && idx < b)) return true;
  }
  return false;
}

// ---- real-file walker --------------------------------------------------------
// Walks only real regular files beneath each configured root. Rejects root
// escape and symlinked input (does not follow). Returns validated
// repository-relative POSIX paths, sorted, deduplicated.

export function walkFiles(repoRoot, roots) {
  const repoRootReal = realpathSync(repoRoot);
  const out = new Set();
  for (const root of roots) {
    const absRoot = path.resolve(repoRootReal, root);
    const rel = path.relative(repoRootReal, absRoot);
    if (rel !== "" && (rel.startsWith("..") || path.isAbsolute(rel))) {
      throw new Error(`walkFiles: root escapes repository: ${JSON.stringify(root)}`);
    }
    let rootStat;
    try { rootStat = lstatSync(absRoot); } catch { continue; } // absent root: nothing to walk
    if (rootStat.isSymbolicLink()) throw new Error(`walkFiles: root is a symlink: ${JSON.stringify(root)}`);
    if (rootStat.isFile()) { out.add(toPosix(path.relative(repoRootReal, absRoot))); continue; }
    walkDir(absRoot, repoRootReal, out);
  }
  return [...out].sort();
}

function walkDir(dir, repoRootReal, out) {
  const entries = readdirSync(dir).sort();
  for (const name of entries) {
    const full = path.join(dir, name);
    let st;
    try { st = lstatSync(full); } catch { continue; }
    if (st.isSymbolicLink()) continue; // never follow a symlink
    if (st.isDirectory()) walkDir(full, repoRootReal, out);
    else if (st.isFile()) out.add(toPosix(path.relative(repoRootReal, full)));
  }
}

// ---- source-descriptor seeding -----------------------------------------------
// Seeds ctx.symbols and ctx.files from the real files below the closed package
// roots: every walked file gets a repository-file descriptor {path, blob_sha};
// every Phase 1 export of each .mjs file gets a code-symbol descriptor
// {path, symbol, blob_sha}. The blob_sha comes from `git hash-object
// --no-filters -- <path>` (injected runner, like registry.deriveRepositoryRef),
// so a symbol and its file carry the SAME blob_sha by construction (one hash per
// walked file per weave). files sorted by path; symbols sorted by (path, symbol);
// a duplicate symbol descriptor is fatal.

export function seedSourceDescriptors(repoRoot, packageRoots, git) {
  if (typeof git !== "function") throw new TypeError("seedSourceDescriptors: git runner must be a function");
  const walked = walkFiles(repoRoot, packageRoots);
  const files = [];
  const symbols = [];
  const seenSymbol = new Set();
  for (const rel of walked) {
    const raw = git(["hash-object", "--no-filters", "--", rel]);
    const blob_sha = typeof raw === "string" ? raw.replace(/\r?\n$/, "") : "";
    if (!HEX40.test(blob_sha)) throw new Error(`seedSourceDescriptors: bad blob_sha for ${rel}: ${JSON.stringify(blob_sha)}`);
    files.push({ path: rel, blob_sha });
    if (rel.endsWith(".mjs")) {
      const source = readFileSync(path.join(repoRoot, ...rel.split("/")), "utf8");
      for (const symbol of scanExports(source).exports) {
        const key = `${rel} ${symbol}`;
        if (seenSymbol.has(key)) throw new Error(`seedSourceDescriptors: duplicate symbol descriptor ${rel}#${symbol}`);
        seenSymbol.add(key);
        symbols.push({ path: rel, symbol, blob_sha });
      }
    }
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  symbols.sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
  });
  return { files, symbols };
}

// ---- counted-iterator constructor (D26/D29) ----------------------------------
// Given an inventory id and its ordered source list, returns an iterable that
// yields each source and increments a PRIVATE count only when the consumer
// COMPLETES consumption of that source (i.e. requests the next one without a
// fatal error). Normal exhaustion is recorded only when the iterator completes.
// A source that raises before completion is not counted. The accounting accessor
// is returned separately; the weaver receives only `source`.

export function makeCountedSource(inventoryId, list) {
  const items = Array.from(list);
  let observed = 0;
  let exhausted = false;
  function* gen() {
    for (let idx = 0; idx < items.length; idx++) {
      yield items[idx];
      // Reached only when the consumer resumes for the next item: the previous
      // item was consumed to completion without a fatal error.
      observed++;
    }
    exhausted = true; // normal completion
  }
  const source = { [Symbol.iterator]: gen };
  const accounting = () => ({
    inventory_id: inventoryId,
    expected_cardinality: items.length,
    observed_count: observed,
    exhausted
  });
  return { source, accounting };
}

// ---- physical-containment helper (D21) ---------------------------------------
// True iff every existing component of the candidate's ancestor chain (from the
// repo root down) is a non-symlink and the resulting physical path remains
// beneath the repository's real path. Never follows a symlink to decide.

export function physicalContainment(repoRoot, candidate) {
  let repoRootReal;
  try { repoRootReal = realpathSync(repoRoot); } catch { return false; }
  const abs = path.resolve(repoRootReal, candidate);
  const rel = path.relative(repoRootReal, abs);
  if (rel !== "" && (rel.startsWith("..") || path.isAbsolute(rel))) return false;
  const contain = containmentReal(repoRootReal, abs);
  return contain.ok === true;
}

// ---- weaver-facing git wrapper -----------------------------------------------
// Permits ONLY the exact subcommands and argument shapes the weavers need, with
// no shell. Any other shape is fatal.

const GIT_LOG_FLAGS = new Set(["--format=%H", "--reverse"]);

export function validateGitArgs(args) {
  if (!Array.isArray(args) || args.length === 0 || !args.every((a) => typeof a === "string")) {
    throw new Error("git: args must be a nonempty string array");
  }
  const [sub] = args;
  const eq = (arr) => args.length === arr.length && arr.every((v, k) => v === args[k]);
  if (sub === "rev-parse") {
    if (eq(["rev-parse", "HEAD"]) || eq(["rev-parse", "--is-shallow-repository"])) return;
    throw new Error(`git: disallowed rev-parse shape ${JSON.stringify(args)}`);
  }
  if (sub === "rev-list") {
    if (eq(["rev-list", "--max-parents=0", "HEAD"])) return;
    throw new Error(`git: disallowed rev-list shape ${JSON.stringify(args)}`);
  }
  if (sub === "hash-object") {
    if (args.length === 4 && args[1] === "--no-filters" && args[2] === "--" && isPathArg(args[3])) return;
    throw new Error(`git: disallowed hash-object shape ${JSON.stringify(args)}`);
  }
  if (sub === "log") {
    // ["log", <flags...>, "--", <path>] ; flags are --format=%H, --reverse, or one -S<value>
    const dd = args.indexOf("--");
    if (dd < 1 || dd !== args.length - 2) throw new Error(`git: disallowed log shape ${JSON.stringify(args)}`);
    const path_ = args[args.length - 1];
    if (!isPathArg(path_)) throw new Error(`git: disallowed log path ${JSON.stringify(path_)}`);
    let sawS = false;
    for (const f of args.slice(1, dd)) {
      if (f.startsWith("-S")) { if (f.length <= 2 || sawS) throw new Error("git: bad -S flag"); sawS = true; continue; }
      if (!GIT_LOG_FLAGS.has(f)) throw new Error(`git: disallowed log flag ${JSON.stringify(f)}`);
    }
    return;
  }
  throw new Error(`git: disallowed subcommand ${JSON.stringify(sub)}`);
}

function isPathArg(p) {
  return typeof p === "string" && p.length > 0 && !p.startsWith("-") && !p.includes("\0");
}

export function makeGitRunner(repoRoot) {
  return function git(args, options = {}) {
    validateGitArgs(args);
    return execFileSync("git", args, {
      cwd: repoRoot, shell: false, encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024, ...options
    });
  };
}

export function isFullSha(s) { return typeof s === "string" && HEX40.test(s); }
