// test-boundaries.mjs — executable cross-product boundary oracle: ai-forge and
// saas-forge must not import each other. IN-PROCESS scan (modeled on
// lachesis/scripts/test-boundary.mjs), replacing a shelled-out grep whose
// catch-all turned every grep failure (grep missing, bad dir) into "no
// matches" — a false pass. Fail-closed: an unreadable source file throws, and
// discriminating negative fixtures prove the scanner actually flags
// violations, so a scanner regression cannot no-op its way to green.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Strip line + block comments so a commented-out import is not a violation.
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// Static import/export specifiers in a source string.
export function importSpecifiers(rawSource) {
  const source = stripComments(rawSource);
  const specs = [];
  for (const re of [/(?:^|[^.\w])(?:import|export)[^;]*?\bfrom\s*["']([^"']+)["']/g, /(?:^|[^.\w])import\s*["']([^"']+)["']/g]) {
    let m; while ((m = re.exec(source))) specs.push(m[1]);
  }
  return specs;
}

// Violations: any specifier from a file in `pkgDir` that resolves into `forbiddenDir`.
export function crossImportViolations(rawSource, fileDir, forbiddenDir) {
  const v = [];
  for (const s of importSpecifiers(rawSource)) {
    if (s.startsWith("node:")) continue;
    const resolved = s.startsWith(".") ? path.resolve(fileDir, s) : null;
    if (resolved && (resolved === forbiddenDir || resolved.startsWith(forbiddenDir + path.sep))) v.push(s);
    else if (!s.startsWith(".") && (s === path.basename(forbiddenDir) || s.startsWith(path.basename(forbiddenDir) + "/"))) v.push(s);
  }
  return v;
}

function mjsFilesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...mjsFilesUnder(p));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) out.push(p);
  }
  return out;
}

function assertNoCrossImports(pkgRel, forbiddenRel) {
  const pkgDir = path.join(root, pkgRel);
  const forbiddenDir = path.join(root, forbiddenRel);
  for (const file of mjsFilesUnder(pkgDir)) {
    // readFileSync failure THROWS — an unreadable source is an error, never "no matches".
    const src = readFileSync(file, "utf8");
    const v = crossImportViolations(src, path.dirname(file), forbiddenDir);
    assert.deepEqual(v, [], `${path.relative(root, file)} must not import from ${forbiddenRel}: ${v.join(", ")}`);
  }
}

// Discriminating negative fixtures: the scanner MUST flag these, or it has no teeth.
{
  const fixtureDir = path.join(root, "ai-forge");
  const forbidden = path.join(root, "saas-forge");
  const relative = crossImportViolations(`import { x } from "../saas-forge/forge.mjs";`, fixtureDir, forbidden);
  assert.equal(relative.length, 1, "scanner must flag a relative cross-import");
  const multiline = crossImportViolations(`import {\n  y\n}\nfrom "../saas-forge/plan.mjs";`, fixtureDir, forbidden);
  assert.equal(multiline.length, 1, "scanner must flag a multiline cross-import");
  const commented = crossImportViolations(`// import { x } from "../saas-forge/forge.mjs";`, fixtureDir, forbidden);
  assert.equal(commented.length, 0, "commented-out import is not a violation");
}

assertNoCrossImports("ai-forge", "saas-forge");
assertNoCrossImports("saas-forge", "ai-forge");

console.log("test-boundaries: OK — no cross-product imports (in-process scan, fixtures discriminating)");
