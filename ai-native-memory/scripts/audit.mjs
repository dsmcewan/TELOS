#!/usr/bin/env node
// audit.mjs — the fail-closed sweep over a host repo's memory record sets.
// Families: three-representation · taxonomy · query-freshness · mirror-sync · staleness.
import { readdirSync, existsSync, statSync, readFileSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DECISION_PROVENANCE,
  RECORD_KINDS,
  RECORD_LIFECYCLES,
  RECORD_STATUSES,
  hasValidContentAddress,
  isPortableExecutablePath,
  readJson,
  finding,
  printFindings,
  renderRecordList,
  resolveWithin,
  sha256hex
} from "./lib/record.mjs";

const SKIP = new Set(["node_modules", ".git"]);
const CONTENT_ADDRESS = /^sha256:[0-9a-f]{64}$/;
const isRegularFile = (file) => existsSync(file) && statSync(file).isFile();
const isRecord = (record) => Boolean(record) && typeof record === "object" && !Array.isArray(record);
const isTrimmed = (value) => typeof value === "string" && value === value.trim() && value.length > 0;

class AuditCannotRunError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "AuditCannotRunError";
  }
}

function readAuditJson(file) {
  try {
    return readJson(file);
  } catch (error) {
    throw new AuditCannotRunError(error.message, { cause: error });
  }
}

function readAuditFile(file) {
  try {
    return readFileSync(file);
  } catch (error) {
    throw new AuditCannotRunError(`cannot read ${file}: ${error.message}`, { cause: error });
  }
}

function runGit(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (result.error) {
    throw new AuditCannotRunError(`cannot launch git: ${result.error.message}`, { cause: result.error });
  }
  if (result.status === null) {
    throw new AuditCannotRunError("git did not produce an exit status");
  }
  return result;
}

function resolveContained(root, relativePath) {
  const resolved = resolveWithin(root, relativePath);
  if (!existsSync(resolved)) return resolved;
  let realRoot;
  let realTarget;
  try {
    realRoot = realpathSync(root);
    realTarget = realpathSync(resolved);
  } catch (error) {
    throw new AuditCannotRunError(`cannot resolve real path for ${relativePath}: ${error.message}`, { cause: error });
  }
  const relative = path.relative(realRoot, realTarget);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path escapes permitted root through symlink: ${relativePath}`);
  }
  return resolved;
}

function primaryPath(file, root, check, recordPath, out) {
  try {
    return resolveContained(root, path.relative(root, file));
  } catch (error) {
    if (error instanceof AuditCannotRunError) throw error;
    out.push(finding("FAIL", check, recordPath, error.message));
    return null;
  }
}

function readPrimaryJson(file, root, check, recordPath, out) {
  const contained = primaryPath(file, root, check, recordPath, out);
  return contained ? { ok: true, value: readAuditJson(contained) } : { ok: false };
}

function readPrimaryFile(file, root, check, recordPath, out) {
  const contained = primaryPath(file, root, check, recordPath, out);
  return contained ? { ok: true, value: readAuditFile(contained) } : { ok: false };
}

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
  if (!RECORD_LIFECYCLES.has(record.lifecycle)) {
    out.push(finding(
      "FAIL",
      "taxonomy",
      recordPath,
      "lifecycle must be docs-first or build-first-then-ratified"
    ));
  }
  if (Object.hasOwn(record, "decided_by")
    && !DECISION_PROVENANCE.has(record.decided_by)) {
    out.push(finding(
      "FAIL",
      "taxonomy",
      recordPath,
      "decided_by must be human or model-advisory-adopted-by-human"
    ));
  }
  const contractCarriesRuling = record.kind === "contract"
    && (
      Object.hasOwn(record, "ruling")
      || Object.hasOwn(record, "rulings")
      || Object.hasOwn(record, "decision")
      || (
        isRecord(record.authority)
        && (
          Object.hasOwn(record.authority, "ruling")
          || Object.hasOwn(record.authority, "decision")
        )
      )
    );
  if ((record.kind === "decision" || contractCarriesRuling)
    && !DECISION_PROVENANCE.has(record.decided_by)) {
    out.push(finding(
      "FAIL",
      "taxonomy",
      recordPath,
      `${record.kind === "decision" ? "decision" : "contract ruling"} requires decided_by provenance`
    ));
  }
  if ((record.kind === "invariant" || record.kind === "non-claim")
    && !isTrimmed(record.statement)) {
    out.push(finding(
      "FAIL",
      "taxonomy",
      recordPath,
      `${record.kind} requires a nonempty statement`
    ));
  }
  if (record.kind === "contract" && !isTrimmed(record.title)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "contract requires a nonempty title"));
  }
  if (Object.hasOwn(record, "evidence") && !Array.isArray(record.evidence)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "evidence must be an array when present"));
  }
  if (record.status === "NORMATIVE-CURRENT") {
    const oracle = recordOracle(record);
    if ((record.kind === "contract" || record.kind === "invariant")
      && !isPortableExecutablePath(oracle)) {
      out.push(finding("FAIL", "taxonomy", recordPath, "NORMATIVE-CURRENT requires a portable repository-relative JavaScript oracle path"));
    } else if (oracle) {
      try {
        const oraclePath = resolveContained(root, oracle);
        if (!isRegularFile(oraclePath)) {
          out.push(finding("FAIL", "taxonomy", recordPath, `oracle file does not resolve: ${oracle}`));
        }
      } catch (error) {
        if (error instanceof AuditCannotRunError) throw error;
        out.push(finding("FAIL", "taxonomy", recordPath, error.message));
      }
    }
  }
  if (record.status === "SPECIFIED-PENDING-IMPLEMENTATION"
    && !isPortableExecutablePath(record.becomes_normative_when)) {
    out.push(finding(
      "FAIL",
      "taxonomy",
      recordPath,
      "pending record requires becomes_normative_when naming a portable repository-relative JavaScript oracle path"
    ));
  }
  if (record.status === "SUPERSEDED"
    && !(isTrimmed(record.superseded_by)
      && CONTENT_ADDRESS.test(record.superseded_by)
      && record.must_not_govern_new_work === true)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "SUPERSEDED requires a content-addressed successor plus must_not_govern_new_work:true"));
  }
}

export function findMemoryDirs(root, findings = []) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) {
        if (e.name === "memory") {
          findings.push(finding(
            "FAIL",
            "three-representation",
            rel(root, full),
            "conventionally named memory directory must not be a symlink"
          ));
        }
        continue;
      }
      if (!e.isDirectory() || SKIP.has(e.name)) continue;
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
    const parsed = readPrimaryJson(j, root, "three-representation", where, out);
    if (!parsed.ok) continue;
    const recs = parsed.value;
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
    } else if (recordsAreObjects) {
      const renderedBytes = readPrimaryFile(
        rendered,
        root,
        "three-representation",
        where,
        out
      );
      if (renderedBytes.ok
        && renderedBytes.value.toString("utf8") !== renderRecordList(title, recs)) {
        out.push(finding("FAIL", "three-representation", where, `${base}.md drifted from ${base}.json`));
      }
    }
  }
}

function auditTaxonomy(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (!existsSync(cdir)) return;
  for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
    const p = path.join(cdir, f);
    const recordPath = `${where}/CONTRACTS/${f}`;
    const parsed = readPrimaryJson(p, root, "taxonomy", recordPath, out);
    if (!parsed.ok) continue;
    const c = parsed.value;
    validateRecord(c, `${where}/CONTRACTS/${f}`, root, out);
    if (!isRecord(c)) continue;
  }
}

const dig = (obj, pointer) => pointer.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function auditRequiredQueryRecords(document, dir, out, root, where) {
  for (const {
    field,
    file,
    kind,
    singular
  } of [
    {
      field: "required_invariants",
      file: "INVARIANTS.json",
      kind: "invariant",
      singular: "invariant"
    },
    {
      field: "required_non_claims",
      file: "NON-CLAIMS.json",
      kind: "non-claim",
      singular: "non-claim"
    }
  ]) {
    const required = document[field];
    if (!Array.isArray(required) || required.length === 0) {
      out.push(finding(
        "FAIL",
        "query-freshness",
        where,
        `${field} must be a nonempty array`
      ));
    }
    const ids = Array.isArray(required) ? required : [];
    if (!ids.every((id) => typeof id === "string" && CONTENT_ADDRESS.test(id))) {
      out.push(finding(
        "FAIL",
        "query-freshness",
        where,
        `${field} entries must be content-addressed record IDs`
      ));
    }
    if (new Set(ids).size !== ids.length) {
      out.push(finding(
        "FAIL",
        "query-freshness",
        where,
        `${field} must not contain duplicate IDs`
      ));
    }

    const recordFile = path.join(dir, file);
    if (!existsSync(recordFile)) {
      out.push(finding(
        "FAIL",
        "query-freshness",
        where,
        `${field} cannot resolve because ${file} is missing`
      ));
      continue;
    }
    const parsed = readPrimaryJson(
      recordFile,
      root,
      "query-freshness",
      where,
      out
    );
    if (!parsed.ok) continue;
    if (!Array.isArray(parsed.value)) {
      out.push(finding(
        "FAIL",
        "query-freshness",
        where,
        `${file} must be an array of records`
      ));
      continue;
    }
    const records = parsed.value;
    for (const id of new Set(ids.filter((value) => CONTENT_ADDRESS.test(value)))) {
      if (!records.some((record) =>
        isRecord(record) && record.kind === kind && record.id === id
      )) {
        out.push(finding(
          "FAIL",
          "query-freshness",
          where,
          `required ${singular} ID does not resolve to a sibling ${kind} record: ${id}`
        ));
      }
    }
  }
}

function auditQueryFreshness(dir, out, root) {
  const where = rel(root, dir);
  const qp = path.join(dir, "comprehension-queries.json");
  if (!existsSync(qp)) {
    out.push(finding(
      "FAIL",
      "query-freshness",
      where,
      "load-bearing comprehension-queries.json is missing"
    ));
    return;
  }
  const parsed = readPrimaryJson(qp, root, "query-freshness", where, out);
  if (!parsed.ok) return;
  const q = parsed.value;
  if (!isRecord(q)) {
    out.push(finding(
      "FAIL",
      "query-freshness",
      where,
      "comprehension-queries.json must be an object"
    ));
    return;
  }
  auditRequiredQueryRecords(q, dir, out, root, where);
  if (!Array.isArray(q.queries) || q.queries.length === 0) {
    out.push(finding(
      "FAIL",
      "query-freshness",
      where,
      "queries must be a nonempty array"
    ));
  }
  for (const query of Array.isArray(q.queries) ? q.queries : []) {
    if (!isRecord(query)) {
      out.push(finding(
        "FAIL",
        "query-freshness",
        where,
        "each query must be an object"
      ));
      continue;
    }
    if (!query.derived_from) { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: no derived_from — expected fact is not machine-derivable`)); continue; }
    if (typeof query.derived_from !== "object" || query.derived_from === null || typeof query.derived_from.file !== "string" || typeof query.derived_from.pointer !== "string") { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: derived_from must be { file, pointer }`)); continue; }
    let src;
    try {
      src = resolveContained(dir, query.derived_from.file);
    } catch (error) {
      if (error instanceof AuditCannotRunError) throw error;
      out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: ${error.message}`));
      continue;
    }
    if (!existsSync(src)) { out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: derived_from file missing: ${query.derived_from.file}`)); continue; }
    let actual;
    try {
      actual = dig(readAuditJson(src), query.derived_from.pointer);
    } catch (error) {
      if (!(error instanceof AuditCannotRunError)) throw error;
      out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: ${error.message}`));
      continue;
    }
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
    const recordPath = `${where}/CONTRACTS/${f}`;
    const parsed = readPrimaryJson(
      path.join(cdir, f),
      root,
      "mirror-sync",
      recordPath,
      out
    );
    if (!parsed.ok) continue;
    const c = parsed.value;
    if (!isRecord(c)) continue;
    if (!c.mirror_of) continue;
    let src;
    try {
      src = resolveContained(dir, c.mirror_of.file);
    } catch (error) {
      if (error instanceof AuditCannotRunError) throw error;
      out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, error.message));
      continue;
    }
    if (!existsSync(src)) { out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, `mirror source missing: ${c.mirror_of.file}`)); continue; }
    const actual = dig(readAuditJson(src), c.mirror_of.pointer);
    if (!deepEq(c.values, actual)) out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, `mirror values ${JSON.stringify(c.values)} != source ${JSON.stringify(actual)} (declared mirror rotted)`));
  }
}

function auditDeclaredStaleness(record, recordPath, root, out) {
  if (record.authority?.source_path) {
    try {
      if (!isRegularFile(resolveContained(root, record.authority.source_path))) {
        out.push(finding("FAIL", "staleness", recordPath, `authority.source_path does not resolve: ${record.authority.source_path}`));
      }
    } catch (error) {
      if (error instanceof AuditCannotRunError) throw error;
      out.push(finding("FAIL", "staleness", recordPath, error.message));
    }
  }
  if (record.as_of) {
    const resolved = runGit(root, ["rev-parse", "--verify", `${record.as_of}^{commit}`]);
    if (resolved.status !== 0) {
      out.push(finding("FAIL", "staleness", recordPath, `as_of commit does not resolve: ${record.as_of}`));
    } else {
      const distance = runGit(root, ["rev-list", "--count", `${record.as_of}..HEAD`]);
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
        const source = resolveContained(root, sourcePath);
        if (!isRegularFile(source)) {
          out.push(finding("FAIL", "staleness", recordPath, `snapshot source missing: ${sourcePath}`));
        } else {
          const actual = "sha256:" + sha256hex(readAuditFile(source));
          if (actual !== sha256) out.push(finding("FAIL", "staleness", recordPath, `snapshot drifted: ${actual} != ${sha256}`));
        }
      } catch (error) {
        if (error instanceof AuditCannotRunError) throw error;
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
      const recordPath = `${where}/CONTRACTS/${f}`;
      const parsed = readPrimaryJson(
        path.join(cdir, f),
        root,
        "staleness",
        recordPath,
        out
      );
      if (!parsed.ok) continue;
      const c = parsed.value;
      if (!isRecord(c)) continue;
      auditDeclaredStaleness(c, recordPath, root, out);
    }
  }
}

function repositoryRoot(scope) {
  const result = runGit(scope, ["rev-parse", "--show-toplevel"]);
  return result.status === 0 ? result.stdout.trim() : path.resolve(scope);
}

export function auditAuthorityRoot(root, out) {
  const ap = path.join(root, "CURRENT-AUTHORITY.json");
  if (!existsSync(ap)) return;
  const a = readAuditJson(ap);
  const act = a.active;
  if (!act || !act.path || !act.sha256) { out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", "active {path,sha256} required")); return; }
  let document;
  try {
    const repo = repositoryRoot(root);
    const candidate = path.resolve(root, act.path);
    document = resolveContained(repo, path.relative(repo, candidate));
  } catch (error) {
    if (error instanceof AuditCannotRunError) throw error;
    out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", error.message));
    return;
  }
  if (!isRegularFile(document)) { out.push(finding("FAIL", "staleness", "CURRENT-AUTHORITY.json", `active doc missing: ${act.path}`)); return; }
  const real = "sha256:" + sha256hex(readAuditFile(document));
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
  for (const dir of findMemoryDirs(root, out)) out.push(...auditMemoryDir(dir, root));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const root = path.resolve(process.argv[2] || ".");
    if (!existsSync(root) || !statSync(root).isDirectory()) {
      throw new AuditCannotRunError(`not a directory: ${root}`);
    }
    process.exit(printFindings(auditRoot(root), "audit"));
  } catch (error) {
    console.error(`AUDIT_ERROR: ${error.message}`);
    process.exit(1);
  }
}
