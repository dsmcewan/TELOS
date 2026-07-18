// test-readonly.mjs — executable READ-ONLY oracle for Atropos. Static, fail-closed scan proving the
// runtime never mutates state: only named fs READS, no write/exec/vm surfaces, sole sanctioned
// non-node import is merkle-dag/vendor.mjs. NON-CLAIM: a static profile check, not a sandbox/proof.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, "..");
const REPO = path.resolve(PKG, "..");
const SANCTIONED = path.join(REPO, "merkle-dag", "vendor.mjs");
const FS_READS = new Set(["readFileSync", "readdirSync", "realpathSync", "statSync", "lstatSync", "existsSync", "accessSync"]);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("FAIL:", m); } };

export function violations(src, fileDir) {
  const v = [];
  // fs write / mutation APIs anywhere -> reject
  if (/\b(writeFileSync|appendFileSync|openSync|mkdirSync|rmSync|rmdirSync|unlinkSync|renameSync|copyFileSync|writeSync|ftruncateSync|truncateSync|chmodSync|chownSync|symlinkSync|linkSync|utimesSync|createWriteStream|writeFile|appendFile|mkdir|rm|unlink)\b/.test(src)) v.push("fs write/mutation API");
  // exec / vm / process-mutation surfaces -> reject
  if (/\b(child_process|worker_threads|process\.chdir|process\.getBuiltinModule|process\.report|process\.dlopen|createRequire|\beval\s*\()/.test(src)) v.push("exec/vm/process-mutation surface");
  if (/from\s*["']node:vm["']|from\s*["']vm["']/.test(src)) v.push("vm import");
  // imports: node: reads only; the one sanctioned sibling; in-package relatives
  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s*["']([^"']+)["']/g)) {
    const clause = m[1], spec = m[2];
    if (spec === "node:fs") {
      const named = (clause.match(/\{([^}]*)\}/) || [, ""])[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      if (!/\{/.test(clause)) { v.push("node:fs namespace/default import (unverifiable)"); continue; }
      for (const n of named) if (!FS_READS.has(n)) v.push(`non-read fs import: ${n}`);
      continue;
    }
    if (spec === "node:fs/promises" || spec === "fs" || spec === "fs/promises") { v.push(`disallowed fs specifier: ${spec}`); continue; }
    if (spec.startsWith("node:")) continue;
    if (spec.startsWith(".")) {
      const resolved = path.resolve(fileDir, spec);
      if (resolved === SANCTIONED) continue;
      if (resolved.startsWith(PKG + path.sep)) continue;
      v.push(`escaping relative import: ${spec}`);
      continue;
    }
    v.push(`bare import: ${spec}`);
  }
  return v;
}

// 1) runtime surface (recursive, excl. scripts/) must be clean
function runtimeFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) { out.push(["SYMLINK", full]); continue; }
    if (e.isDirectory()) { if (e.name !== "scripts" && e.name !== "node_modules") out.push(...runtimeFiles(full)); }
    else if (/\.(mjs|js|cjs)$/.test(e.name)) out.push(full);
  }
  return out;
}
const runtime = runtimeFiles(PKG);
ok(runtime.length >= 1, `runtime surface discovered (${runtime.length})`);
for (const f of runtime) {
  if (Array.isArray(f)) { ok(false, `runtime symlink (not followed): ${path.relative(PKG, f[1])}`); continue; }
  const v = violations(readFileSync(f, "utf8"), path.dirname(f));
  ok(v.length === 0, `runtime ${path.relative(PKG, f)} read-only (got: ${v.join("; ")})`);
}

// 2) discriminating negatives — each MUST be flagged
for (const [src, label] of [
  ['import { writeFileSync } from "node:fs";', "fs write"],
  ['import { openSync } from "node:fs";', "openSync"],
  ['import cp from "node:child_process";', "child_process"],
  ['import fs from "node:fs";', "fs namespace"],
  ['import { readFile } from "node:fs/promises";', "fs/promises"],
  ['const r = eval("x");', "eval"],
  ['import x from "../../clotho/query.mjs";', "clotho escape"]
]) ok(violations(src, PKG).length > 0, `negative flagged: ${label}`);
ok(violations('import { readFileSync, realpathSync } from "node:fs";\nimport { canonicalize } from "../merkle-dag/vendor.mjs";', PKG).length === 0, "compliant read-only fixture passes");

// 3) zero dependencies
const pkg = JSON.parse(readFileSync(path.join(PKG, "package.json"), "utf8"));
ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, "package.json dependencies empty");

console.log(`test-readonly: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
