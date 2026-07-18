// record.mjs — vendored primitives for the ai-native-memory oracles. Zero-dep, stdlib only.
// Deliberately self-contained: the plugin never imports from a host repo's packages.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Deterministic JSON: object keys sorted at every level, arrays in given order, no whitespace.
export function canonicalize(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

export function sha256hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

// Content address of a record: sha256 over its canonical form MINUS its own "id" field.
export function contentAddress(record) {
  const { id, ...rest } = record;
  return "sha256:" + sha256hex(canonicalize(rest));
}

export function readJson(p) {
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch (e) { throw new Error(`cannot read ${p}: ${e.message}`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`invalid JSON in ${p}: ${e.message}`); }
}

export function finding(level, check, path, detail) {
  return { level, check, path, detail };
}

// Prints one JSON line per finding + a human summary. Returns the fail-closed exit code.
export function printFindings(findings, label) {
  for (const f of findings) console.log(JSON.stringify(f));
  const fails = findings.filter((f) => f.level === "FAIL").length;
  const warns = findings.filter((f) => f.level === "WARN").length;
  console.log(`${label}: ${fails} FAIL, ${warns} WARN`);
  return fails ? 2 : 0;
}
