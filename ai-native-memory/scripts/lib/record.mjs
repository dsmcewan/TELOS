// record.mjs — vendored primitives for the ai-native-memory oracles. Zero-dep, stdlib only.
// Deliberately self-contained: the plugin never imports from a host repo's packages.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const RECORD_KINDS = new Set([
  "mechanism",
  "decision",
  "rejected-alternative",
  "non-claim",
  "invariant",
  "open-question",
  "contract",
  "evidence"
]);

export const RECORD_STATUSES = new Set([
  "NORMATIVE-CURRENT",
  "SUPERSEDED",
  "SPECIFIED-PENDING-IMPLEMENTATION",
  "RATIFICATION-PENDING",
  "MODEL-PROPOSAL",
  "REJECTED-ALTERNATIVE",
  "OPEN-QUESTION",
  "HUMAN-AUTHORIZED-EXCEPTION",
  "ADVISORY"
]);

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

export function hasValidContentAddress(record) {
  return typeof record?.id === "string"
    && /^sha256:[0-9a-f]{64}$/.test(record.id)
    && record.id === contentAddress(record);
}

export function renderRecordList(title, records) {
  const rows = records.map((record) =>
    `- **${record.id}** [${record.status || "unspecified"}] ${record.statement}`
  );
  return `# ${title} (rendered)\n\n${rows.join("\n")}\n`;
}

export function resolveWithin(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error("path must be nonempty and repository-relative");
  }
  const base = path.resolve(root);
  const resolved = path.resolve(base, relativePath);
  const relative = path.relative(base, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

export function importSpecifiers(source) {
  const found = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
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
