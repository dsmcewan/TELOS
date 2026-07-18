// test-boundary.mjs — executable package-boundary oracle. Enforces the load-bearing
// no-clotho-import / zero-dependency boundary, modeled on Clotho's source-profile:
// total correctness over a supported STATIC import profile, FAIL-CLOSED on out-of-
// profile dynamic/computed loading. Allowlist: node: builtins, relative imports that
// stay under the package root, and the ONE sanctioned sibling merkle-dag/vendor.mjs.
// Discriminating: negative fixtures must be flagged, so a no-op cannot pass.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, "..");          // lachesis/
const REPO = path.resolve(PKG, "..");
const SANCTIONED = path.join(REPO, "merkle-dag/vendor.mjs");

let passes = 0, fails = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.error("FAIL:", m); } };

// Return an array of boundary violations for a source string located at `fileDir`.
export function violations(source, fileDir) {
  const v = [];
  // out-of-profile dynamic/computed loading -> FAIL CLOSED (never silently allowed)
  if (/\bimport\s*\(/.test(source)) v.push("dynamic import()");
  if (/\brequire\s*\(/.test(source)) v.push("require()");
  if (/\bcreateRequire\b/.test(source)) v.push("createRequire alias");
  if (/\beval\s*\(/.test(source)) v.push("eval()");
  // static specifiers
  const specs = [];
  for (const re of [/(?:^|[^.\w])(?:import|export)[^;\n]*?\bfrom\s*["']([^"']+)["']/g, /(?:^|[^.\w])import\s*["']([^"']+)["']/g]) {
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

// 1) runtime surface must be clean
for (const f of ["ingest.mjs", "measure.mjs"]) {
  const src = readFileSync(path.join(PKG, f), "utf8");
  ok(violations(src, PKG).length === 0, `runtime ${f} clean (got: ${violations(src, PKG).join("; ")})`);
}

// 2) discriminating NEGATIVE fixtures — each MUST be flagged
const NEG = [
  ['import x from "../../clotho/query.mjs";', "clotho spine import"],
  ['import x from "../../elsewhere/thing.mjs";', "escaping relative import"],
  ['import fs from "fs";', "bare (non-node:) import"],
  ['const m = await import("./x.mjs");', "dynamic import()"],
  ['const r = require("x");', "require()"],
  ['import { createRequire } from "node:module"; const r = createRequire(import.meta.url);', "createRequire alias"],
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
