#!/usr/bin/env node
// audit.mjs — the fail-closed sweep over a host repo's memory record sets.
// Families: three-representation · taxonomy · query-freshness · mirror-sync · staleness.
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, finding, printFindings } from "./lib/record.mjs";

const SKIP = new Set(["node_modules", ".git"]);

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
    for (const r of recs) {
      if (!r.id || !r.statement) out.push(finding("FAIL", "three-representation", where, `${base}.json entry missing id/statement: ${JSON.stringify(r).slice(0, 80)}`));
      if (base === "INVARIANTS" && !r.oracle) out.push(finding("FAIL", "three-representation", where, `invariant ${r.id} has no oracle ref (NORMATIVE claims need executable verification)`));
    }
    if (!existsSync(path.join(dir, base + ".md"))) out.push(finding("WARN", "three-representation", where, `${base}.json has no rendered ${base}.md projection`));
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
    const st = c.status;
    if (st === "NORMATIVE-CURRENT" && !(c.oracle && c.oracle.test)) out.push(finding("FAIL", "taxonomy", `${where}/CONTRACTS/${f}`, "status NORMATIVE-CURRENT without oracle.test (prose without an oracle is ADVISORY)"));
    if (st === "SPECIFIED-PENDING-IMPLEMENTATION" && !c.becomes_normative_when) out.push(finding("FAIL", "taxonomy", `${where}/CONTRACTS/${f}`, "SPECIFIED-PENDING-IMPLEMENTATION requires becomes_normative_when"));
    if (st === "SUPERSEDED" && !(c.superseded_by && c.must_not_govern_new_work === true)) out.push(finding("FAIL", "taxonomy", `${where}/CONTRACTS/${f}`, "SUPERSEDED requires superseded_by + must_not_govern_new_work:true"));
    if (!c.lifecycle) out.push(finding("WARN", "taxonomy", `${where}/CONTRACTS/${f}`, "no lifecycle field (truthful build order: docs-first | build-first-then-ratified)"));
    if (!c.decided_by && c.kind === "decision") out.push(finding("WARN", "taxonomy", `${where}/CONTRACTS/${f}`, "decision without decided_by provenance"));
  }
}

export function auditMemoryDir(dir, root = dir) {
  const out = [];
  auditThreeRep(dir, out, root);
  auditTaxonomy(dir, out, root);
  return out;
}

export function auditRoot(root) {
  const out = [];
  for (const dir of findMemoryDirs(root)) out.push(...auditMemoryDir(dir, root));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || ".");
  if (!existsSync(root) || !statSync(root).isDirectory()) { console.error(`audit: not a directory: ${root}`); process.exit(1); }
  process.exit(printFindings(auditRoot(root), "audit"));
}
