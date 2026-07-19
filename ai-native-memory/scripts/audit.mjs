#!/usr/bin/env node
// audit.mjs — the fail-closed sweep over a host repo's memory record sets.
// Families: three-representation · taxonomy · query-freshness · mirror-sync · staleness.
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECORD_KINDS,
  RECORD_STATUSES,
  hasValidContentAddress,
  readJson,
  finding,
  printFindings,
  renderRecordList,
  resolveWithin,
  sha256hex
} from "./lib/record.mjs";

const SKIP = new Set(["node_modules", ".git"]);
const PLACEHOLDER = /^(?:NAME-|REPLACE:|PLACEHOLDER)/;
const isRegularFile = (file) => existsSync(file) && statSync(file).isFile();
const isRecord = (record) => Boolean(record) && typeof record === "object" && !Array.isArray(record);

function recordOracle(record) {
  if (record.kind === "contract") return record.oracle?.test;
  if (record.kind === "invariant") return record.oracle;
  return null;
}

function validateRecord(record, recordPath, root, out) {
  if (!isRecord(record)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "record must be an object"));
    return;
  }
  if (!RECORD_KINDS.has(record.kind)) {
    out.push(finding("FAIL", "taxonomy", recordPath, `unknown record kind: ${record.kind}`));
  }
  if (!RECORD_STATUSES.has(record.status)) {
    out.push(finding("FAIL", "taxonomy", recordPath, `unknown record status: ${record.status}`));
  }
  if (!hasValidContentAddress(record)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "id must equal sha256(canonicalize(record minus id))"));
  }
  if (record.status === "NORMATIVE-CURRENT") {
    const oracle = recordOracle(record);
    if ((record.kind === "contract" || record.kind === "invariant")
      && (typeof oracle !== "string" || !oracle || PLACEHOLDER.test(oracle))) {
      out.push(finding("FAIL", "taxonomy", recordPath, "NORMATIVE-CURRENT requires a non-placeholder oracle"));
    } else if (oracle) {
      try {
        const oraclePath = resolveWithin(root, oracle);
        if (!isRegularFile(oraclePath)) {
          out.push(finding("FAIL", "taxonomy", recordPath, `oracle file does not resolve: ${oracle}`));
        }
      } catch (error) {
        out.push(finding("FAIL", "taxonomy", recordPath, error.message));
      }
    }
  }
  if (record.status === "SPECIFIED-PENDING-IMPLEMENTATION"
    && (typeof record.becomes_normative_when !== "string"
      || !record.becomes_normative_when
      || PLACEHOLDER.test(record.becomes_normative_when))) {
    out.push(finding("FAIL", "taxonomy", recordPath, "pending record requires a real becomes_normative_when"));
  }
  if (record.status === "SUPERSEDED"
    && !(record.superseded_by && record.must_not_govern_new_work === true)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "SUPERSEDED requires successor plus must_not_govern_new_work:true"));
  }
}

export function findMemoryDirs(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink() || !e.isDirectory() || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.name === "memory") out.push(full);
      else walk(full);
    }
  };
  walk(root);
  return out;
}

const rel = (root, p) => path.relative(root, p) || ".";

function auditThreeRep(dir, out, root) {
  const where = rel(root, dir);
  for (const base of ["INVARIANTS", "NON-CLAIMS"]) {
    const j = path.join(dir, base + ".json");
    if (!existsSync(j)) {
      out.push(finding("FAIL", "three-representation", where, `${base}.md/${base} present without machine record ${base}.json (prose-only load-bearing claim)`));
      continue;
    }
    let recs;
    try { recs = readJson(j); } catch (e) { out.push(finding("FAIL", "three-representation", where, e.message)); continue; }
    if (!Array.isArray(recs)) { out.push(finding("FAIL", "three-representation", where, `${base}.json must be an array of records`)); continue; }
    const recordsAreObjects = recs.every(isRecord);
    for (const r of recs) {
      validateRecord(r, `${where}/${base}.json`, root, out);
      if (!isRecord(r)) continue;
      if (!r.id || !r.statement) out.push(finding("FAIL", "three-representation", where, `${base}.json entry missing id/statement: ${JSON.stringify(r).slice(0, 80)}`));
      if (base === "INVARIANTS" && !r.oracle) out.push(finding("FAIL", "three-representation", where, `invariant ${r.id} has no oracle ref (NORMATIVE claims need executable verification)`));
    }
    const rendered = path.join(dir, `${base}.md`);
    const title = base === "INVARIANTS" ? "Invariants" : "Non-claims";
    if (!existsSync(rendered)) {
      out.push(finding("FAIL", "three-representation", where, `${base}.json has no rendered ${base}.md projection`));
    } else if (recordsAreObjects && readFileSync(rendered, "utf8") !== renderRecordList(title, recs)) {
      out.push(finding("FAIL", "three-representation", where, `${base}.md drifted from ${base}.json`));
    }
  }
}

function auditTaxonomy(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (!existsSync(cdir)) return;
  for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
    const p = path.join(cdir, f);
    let c;
    try { c = readJson(p); } catch (e) { out.push(finding("FAIL", "taxonomy", where, e.message)); continue; }
    validateRecord(c, `${where}/CONTRACTS/${f}`, root, out);
    if (!isRecord(c)) continue;
    if (!c.lifecycle) out.push(finding("WARN", "taxonomy", `${where}/CONTRACTS/${f}`, "no lifecycle field (truthful build order: docs-first | build-first-then-ratified)"));
    if (!c.decided_by && c.kind === "decision") out.push(finding("WARN", "taxonomy", `${where}/CONTRACTS/${f}`, "decision without decided_by provenance"));
  }
}

const dig = (obj, pointer) => pointer.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function auditQueryFreshness(dir, out, root) {
  const where = rel(root, dir);
  const qp = path.join(dir, "comprehension-queries.json");
  if (!existsSync(qp)) return;
  let q;
  try { q = readJson(qp); } catch (e) { out.push(finding("FAIL", "query-freshness", where, e.message)); return; }
  for (const query of q.queries || []) {
    if (!query.derived_from) { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: no derived_from — expected fact is not machine-derivable`)); continue; }
    if (typeof query.derived_from !== "object" || query.derived_from === null || typeof query.derived_from.file !== "string" || typeof query.derived_from.pointer !== "string") { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: derived_from must be { file, pointer }`)); continue; }
    const src = path.join(dir, query.derived_from.file);
    if (!existsSync(src)) { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: derived_from file missing: ${query.derived_from.file}`)); continue; }
    let actual;
    try { actual = dig(readJson(src), query.derived_from.pointer); } catch (e) { out.push(finding("FAIL", "query-freshness", where, e.message)); continue; }
    if (actual === undefined) { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: derived_from pointer missing: ${query.derived_from.pointer}`)); continue; }
    const expected = query.answer_kind === "set" ? [...(query.expected || [])].sort() : query.expected;
    const got = query.answer_kind === "set" && Array.isArray(actual) ? [...actual].sort() : actual;
    if (!deepEq(expected, got)) out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: expected ${JSON.stringify(query.expected)} but source now says ${JSON.stringify(actual)} (queries drifted from the contract)`));
  }
}

function auditMirrorSync(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (!existsSync(cdir)) return;
  for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
    let c;
    try { c = readJson(path.join(cdir, f)); } catch { continue; } // parse errors already FAILed in taxonomy
    if (!isRecord(c)) continue;
    if (!c.mirror_of) continue;
    const src = path.join(dir, c.mirror_of.file);
    if (!existsSync(src)) { out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, `mirror source missing: ${c.mirror_of.file}`)); continue; }
    const actual = dig(readJson(src), c.mirror_of.pointer);
    if (!deepEq(c.values, actual)) out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, `mirror values ${JSON.stringify(c.values)} != source ${JSON.stringify(actual)} (declared mirror rotted)`));
  }
}

function auditDeclaredStaleness(record, recordPath, root, out) {
  if (record.authority?.source_path) {
    try {
      if (!isRegularFile(resolveWithin(root, record.authority.source_path))) {
        out.push(finding("FAIL", "staleness", recordPath, `authority.source_path does not resolve: ${record.authority.source_path}`));
      }
    } catch (error) {
      out.push(finding("FAIL", "staleness", recordPath, error.message));
    }
  }
  if (record.as_of) {
    const resolved = spawnSync("git", ["-C", root, "rev-parse", "--verify", `${record.as_of}^{commit}`], { encoding: "utf8" });
    if (resolved.status !== 0) {
      out.push(finding("FAIL", "staleness", recordPath, `as_of commit does not resolve: ${record.as_of}`));
    } else {
      const distance = spawnSync("git", ["-C", root, "rev-list", "--count", `${record.as_of}..HEAD`], { encoding: "utf8" });
      if (distance.status !== 0) {
        out.push(finding("FAIL", "staleness", recordPath, "cannot measure as_of distance"));
      } else if (Number(distance.stdout.trim()) > 0) {
        out.push(finding("WARN", "staleness", recordPath, `${distance.stdout.trim()} commit(s) since as_of ${record.as_of}`));
      }
    }
  }
  if (record.snapshot) {
    const { source_path: sourcePath, sha256 } = record.snapshot;
    if (typeof sourcePath !== "string" || !/^sha256:[0-9a-f]{64}$/.test(sha256 || "")) {
      out.push(finding("FAIL", "staleness", recordPath, "snapshot requires source_path and sha256:<64hex>"));
    } else {
      try {
        const source = resolveWithin(root, sourcePath);
        if (!isRegularFile(source)) {
          out.push(finding("FAIL", "staleness", recordPath, `snapshot source missing: ${sourcePath}`));
        } else {
          const actual = "sha256:" + sha256hex(readFileSync(source));
          if (actual !== sha256) out.push(finding("FAIL", "staleness", recordPath, `snapshot drifted: ${actual} != ${sha256}`));
        }
      } catch (error) {
        out.push(finding("FAIL", "staleness", recordPath, error.message));
      }
    }
  }
}

function auditStaleness(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (existsSync(cdir)) {
    for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
      let c;
      try { c = readJson(path.join(cdir, f)); } catch { continue; }
      if (!isRecord(c)) continue;
      auditDeclaredStaleness(c, `${where}/CONTRACTS/${f}`, root, out);
    }
  }
}

function repositoryRoot(scope) {
  const result = spawnSync("git", ["-C", scope, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : path.resolve(scope);
}

export function auditAuthorityRoot(root, out) {
  const ap = path.join(root, "CURRENT-AUTHORITY.json");
  if (!existsSync(ap)) return;
  let a;
  try { a = readJson(ap); } catch (e) { out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", e.message)); return; }
  const act = a.active;
  if (!act || !act.path || !act.sha256) { out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", "active {path,sha256} required")); return; }
  let document;
  try {
    const repo = repositoryRoot(root);
    const candidate = path.resolve(root, act.path);
    document = resolveWithin(repo, path.relative(repo, candidate));
  } catch (error) {
    out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", error.message));
    return;
  }
  if (!isRegularFile(document)) { out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", `active doc missing: ${act.path}`)); return; }
  const real = "sha256:" + sha256hex(readFileSync(document));
  if (real !== act.sha256) out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", `active doc drifted: disk ${real} != pinned ${act.sha256}`));
}

export function auditMemoryDir(dir, root = dir) {
  const out = [];
  auditThreeRep(dir, out, root);
  auditTaxonomy(dir, out, root);
  auditQueryFreshness(dir, out, root);
  auditMirrorSync(dir, out, root);
  auditStaleness(dir, out, root);
  return out;
}

export function auditRoot(root) {
  const out = [];
  auditAuthorityRoot(root, out);
  for (const dir of findMemoryDirs(root)) out.push(...auditMemoryDir(dir, root));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || ".");
  if (!existsSync(root) || !statSync(root).isDirectory()) { console.error(`audit: not a directory: ${root}`); process.exit(1); }
  process.exit(printFindings(auditRoot(root), "audit"));
}
