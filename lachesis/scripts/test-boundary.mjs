// test-boundary.mjs — executable package-boundary oracle. Enforces the load-bearing
// no-clotho-import / zero-dependency boundary, modeled on Clotho's source-profile:
// total correctness over a supported STATIC import profile, FAIL-CLOSED on out-of-
// profile dynamic/computed loading. Allowlist: node: builtins, relative imports that
// stay under the package root, and the ONE sanctioned sibling merkle-dag/vendor.mjs.
// Discriminating: negative fixtures must be flagged, so a no-op cannot pass.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, "..");          // lachesis/
const REPO = path.resolve(PKG, "..");
const SANCTIONED = path.join(REPO, "merkle-dag/vendor.mjs");

let passes = 0, fails = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.error("FAIL:", m); } };

// Strip line + block comments so a comment can't hide a specifier (e.g. `import x from /*c*/ "..."`).
// Bias: fail-closed — this is a static profile check, not a full lexer (NON-CLAIM below).
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
// Return an array of boundary violations for a source string located at `fileDir`.
export function violations(rawSource, fileDir) {
  const source = stripComments(rawSource);
  const v = [];
  // fail-closed RAW scan for the string-in-comment evasion (const a="/*"; import x from "clotho/..";
  // const b="*/"), which comment-stripping would erase: flag a clotho/ specifier in an import/require
  // POSITION in the raw source. (Comment-BETWEEN cases like `from /*c*/ "clotho/.."` are caught by the
  // comment-stripped scan below.) Narrow to specifier position so prose comments don't false-positive.
  if (/(?:\bfrom|\bimport|\brequire|_load)\s*\(?\s*["'][^"']*clotho\//.test(rawSource)) v.push("clotho/ import specifier in raw source (fail-closed)");
  // out-of-profile dynamic/computed loading -> FAIL CLOSED (never silently allowed)
  if (/\bimport\s*\(/.test(source)) v.push("dynamic import()");
  if (/\brequire\s*\(/.test(source)) v.push("require()");
  if (/\bcreateRequire\b/.test(source)) v.push("createRequire alias");
  if (/\b(?:Module\._load|Module\._compile|process\.binding|process\.dlopen)\b/.test(source)) v.push("low-level loader escape");
  if (/\beval\s*\(/.test(source)) v.push("eval()");
  // static specifiers — `[^;]` (not `[^;\n]`) so MULTILINE `import {...}\nfrom "..."` is caught
  const specs = [];
  for (const re of [/(?:^|[^.\w])(?:import|export)[^;]*?\bfrom\s*["']([^"']+)["']/g, /(?:^|[^.\w])import\s*["']([^"']+)["']/g]) {
    let m; while ((m = re.exec(source))) specs.push(m[1]);
  }
  for (const s of specs) {
    if (s.startsWith("node:")) continue;                         // stdlib, ok
    if (s.startsWith(".")) {
      const resolved = path.resolve(fileDir, s);
      if (resolved === SANCTIONED) continue;                     // the one sanctioned reuse
      if (resolved.startsWith(PKG + path.sep)) continue;         // within the package
      v.push(`escaping relative import: ${s}` + (/clotho\//.test(s) ? " (clotho spine!)" : ""));
      continue;
    }
    v.push(`bare-package import: ${s}`);                         // undeclared/bare -> reject
  }
  return v;
}

// 1) EVERY runtime .mjs must be clean (recursively; exclude scripts/ dev tooling, which holds
//    intentional negative-fixture strings). Catches an in-package helper that imports the spine.
function runtimeFiles(dir) {
  const out = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isSymbolicLink()) { out.push(["SYMLINK", full]); continue; } // flagged: not followed
    if (ent.isDirectory()) { if (ent.name !== "scripts" && ent.name !== "node_modules") out.push(...runtimeFiles(full)); }
    else if (/\.(mjs|js|cjs)$/.test(ent.name)) out.push(full);
  }
  return out;
}
const runtime = runtimeFiles(PKG);
ok(runtime.length >= 2, `runtime surface discovered (${runtime.length} entries)`);
for (const f of runtime) {
  if (Array.isArray(f)) { ok(false, `runtime symlink present (not followed): ${path.relative(PKG, f[1])}`); continue; }
  const v = violations(readFileSync(f, "utf8"), path.dirname(f));
  ok(v.length === 0, `runtime ${path.relative(PKG, f)} clean (got: ${v.join("; ")})`);
}
// the ONE sanctioned external module (merkle-dag/vendor.mjs) must itself import only node: builtins
{
  const vsrc = readFileSync(SANCTIONED, "utf8");
  const vv = violations(vsrc, path.dirname(SANCTIONED)).filter((x) => !/vendor\.mjs|within the package/.test(x));
  ok(vv.length === 0, `sanctioned vendor.mjs imports only node: builtins (got: ${vv.join("; ")})`);
}

// 2) discriminating NEGATIVE fixtures — each MUST be flagged
const NEG = [
  ['import x from "../../clotho/query.mjs";', "clotho spine import"],
  ['import x from "../../elsewhere/thing.mjs";', "escaping relative import"],
  ['import fs from "fs";', "bare (non-node:) import"],
  ['import x from /*c*/ "../../clotho/query.mjs";', "comment-hidden clotho import"],
  ['const m = await import("./x.mjs");', "dynamic import()"],
  ['const m = await import/*c*/("./x.mjs");', "comment-hidden dynamic import"],
  ['const r = require("x");', "require()"],
  ['import { createRequire } from "node:module"; const r = createRequire(import.meta.url);', "createRequire alias"],
  ['const m = Module._load("../../clotho/query.mjs");', "low-level loader escape"],
  ['const f = eval("readFileSync");', "eval()"]
];
for (const [src, label] of NEG) ok(violations(src, PKG).length > 0, `negative flagged: ${label}`);

// 3) a compliant fixture must NOT be flagged
ok(violations('import { readFileSync } from "node:fs";\nimport { x } from "./sib.mjs";', PKG).length === 0, "compliant fixture passes");

// 4) package.json declares zero dependencies
const pkg = JSON.parse(readFileSync(path.join(PKG, "package.json"), "utf8"));
ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, "package.json dependencies empty");

console.log(`test-boundary: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
