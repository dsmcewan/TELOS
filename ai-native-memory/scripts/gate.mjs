#!/usr/bin/env node
// gate.mjs — deterministic comprehension gate. "Reading is not evidence of understanding."
// Grades a reader's answers against authority-anchored queries; verifies the active
// authority doc's hash against disk FIRST (a drifted authority certifies no one).
// Exit 0 GRANTED / 2 DENIED / 1 cannot-run.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  hasValidContentAddress,
  readJson,
  sha256hex
} from "./lib/record.mjs";

const die = (msg) => { console.error("GATE_ERROR: " + msg); process.exit(1); };
const [, , queriesPath, answersPath, ...rest] = process.argv;
if (!queriesPath || !answersPath) die("usage: gate.mjs <queries.json> <answers.json> --authority <AUTHORITY.json> [--out <artifact.json>]");
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
const authorityPath = flag("--authority");
if (!authorityPath) die("--authority <AUTHORITY.json> is required");
const outPath = flag("--out");

const lexicalQueriesPath = path.resolve(queriesPath);
const queryDirectory = path.dirname(lexicalQueriesPath);
let physicalQueryDirectory;
let physicalQueriesPath;
try {
  physicalQueryDirectory = realpathSync(queryDirectory);
  physicalQueriesPath = realpathSync(lexicalQueriesPath);
} catch (error) {
  die(`cannot resolve comprehension query document: ${error.message}`);
}
const queryRelative = path.relative(physicalQueryDirectory, physicalQueriesPath);
if (queryRelative === ".."
  || queryRelative.startsWith(`..${path.sep}`)
  || path.isAbsolute(queryRelative)) {
  die("comprehension query document escapes query record directory");
}

let queries, answers, authority;
try { queries = readJson(physicalQueriesPath); answers = readJson(answersPath); authority = readJson(authorityPath); }
catch (e) { die(e.message); }

// 0. authority-drift check (fail-closed)
const active = authority.active;
if (!active || !active.ref || !active.path || !/^sha256:[0-9a-f]{64}$/.test(active.sha256 || "")) die("authority.active {ref,path,sha256} required");
let real;
try { real = "sha256:" + sha256hex(readFileSync(path.resolve(path.dirname(authorityPath), active.path))); }
catch (e) { die(`cannot read active authority doc: ${e.message}`); }
if (real !== active.sha256) die(`AUTHORITY DRIFT: ${active.path} recomputes to ${real}, authority file says ${active.sha256}`);

const loadSiblingRecords = (name, kind) => {
  const lexicalFile = path.join(queryDirectory, name);
  let file;
  try {
    file = realpathSync(lexicalFile);
  } catch (error) {
    die(`cannot resolve sibling ${name}: ${error.message}`);
  }
  const relative = path.relative(physicalQueryDirectory, file);
  if (relative === ".."
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)) {
    die(`sibling ${name} escapes query record directory`);
  }
  let records;
  try {
    records = readJson(file);
  } catch (error) {
    die(error.message);
  }
  if (!Array.isArray(records)
    || records.some((record) =>
      !record
      || typeof record !== "object"
      || Array.isArray(record)
      || record.kind !== kind
      || !hasValidContentAddress(record)
    )) {
    die(`${name} must be an array of content-addressed ${kind} records`);
  }
  return new Map(records.map((record) => [record.id, record]));
};
const invariantRecords = loadSiblingRecords("INVARIANTS.json", "invariant");
const nonClaimRecords = loadSiblingRecords("NON-CLAIMS.json", "non-claim");

const checks = [];
const failures = [];
const record = (id, ok, detail) => { checks.push({ id, ok, detail }); if (!ok) failures.push(`${id}: ${detail}`); };
const asSet = (a) => new Set(Array.isArray(a) ? a : []);
const setEq = (a, b) => { const x = asSet(a), y = asSet(b); return x.size === y.size && [...x].every((v) => y.has(v)); };

record("resolved_active_authority", answers.resolved_authority_ref === active.ref,
  `reader resolved ${JSON.stringify(answers.resolved_authority_ref)}, expected ${JSON.stringify(active.ref)}`);
record("queries_bound_to_active", queries.governing_authority && queries.governing_authority.ref === active.ref,
  `queries bound to ${JSON.stringify(queries.governing_authority)}, expected ref ${JSON.stringify(active.ref)}`);
const supersededRefs = (authority.superseded || []).map((s) => s.ref).filter(Boolean);
const excluded = asSet(answers.excluded_superseded);
const missing = supersededRefs.filter((r) => !excluded.has(r));
record("excluded_superseded", missing.length === 0,
  missing.length ? `superseded refs not excluded: ${missing.join(", ")}` : "all superseded refs excluded");

const contentAddress = /^sha256:[0-9a-f]{64}$/;
const validateRequired = (field, singular, records) => {
  const required = queries[field];
  const values = Array.isArray(required) ? required : [];
  const nonempty = Array.isArray(required) && required.length > 0;
  record(
    `${field}_nonempty`,
    nonempty,
    nonempty ? `${field} contains ${required.length} record ID(s)` : `${field} must be a nonempty array`
  );
  const addressed = Array.isArray(required)
    && required.every((id) => typeof id === "string" && contentAddress.test(id));
  record(
    `${field}_content_addresses`,
    addressed,
    addressed
      ? `all ${field} entries are content-addressed record IDs`
      : `${field} entries must be content-addressed record IDs`
  );
  const unique = Array.isArray(required) && new Set(required).size === required.length;
  record(
    `${field}_unique`,
    unique,
    unique ? `${field} contains no duplicate IDs` : `${field} must not contain duplicate IDs`
  );
  for (const id of new Set(values.filter((value) =>
    typeof value === "string" && contentAddress.test(value)
  ))) {
    const resolved = records.has(id);
    record(
      `required_${singular}_resolves:${id}`,
      resolved,
      resolved
        ? `resolved to sibling ${singular.replace("_", "-")} record: ${id}`
        : `required ${singular.replace("_", "-")} ID does not resolve to the sibling record set: ${id}`
    );
  }
  return values;
};
const requiredInvariants = validateRequired(
  "required_invariants",
  "invariant",
  invariantRecords
);
const requiredNonClaims = validateRequired(
  "required_non_claims",
  "non_claim",
  nonClaimRecords
);
const queryList = Array.isArray(queries.queries) ? queries.queries : [];
const queriesNonempty = Array.isArray(queries.queries) && queries.queries.length > 0;
record(
  "queries_nonempty",
  queriesNonempty,
  queriesNonempty ? `queries contains ${queries.queries.length} item(s)` : "queries must be a nonempty array"
);

const given = answers.answers || {};
for (const [index, q] of queryList.entries()) {
  if (!q || typeof q !== "object" || Array.isArray(q) || typeof q.id !== "string") {
    record(`query_structure:${index}`, false, "query must be an object with a string id");
    continue;
  }
  const v = given[q.id];
  let ok;
  if (v === undefined) ok = false;
  else if (q.answer_kind === "set") ok = setEq(v, q.expected);
  else if (q.answer_kind === "boolean" || q.answer_kind === "enum") ok = v === q.expected;
  else ok = false;
  record(`answer:${q.id}`, ok, ok ? "match" : `got ${JSON.stringify(v)} expected ${JSON.stringify(q.expected)}`);
}
for (const id of requiredInvariants) record(`invariant_read:${id}`, asSet(answers.invariants_read).has(id), `invariant ${id} not acknowledged`);
for (const id of requiredNonClaims) record(`non_claim_read:${id}`, asSet(answers.non_claims_read).has(id), `non-claim ${id} not acknowledged`);

const passed = failures.length === 0;
const artifact = {
  gate: "comprehension-gate",
  component: queries.component || null,
  reader: answers.reader || null,
  active_authority: { ref: active.ref, path: active.path, sha256: active.sha256 },
  authority_hash_verified: true,
  comprehension_checks: { passed: checks.filter((c) => c.ok).length, failed: failures.length, checks },
  unresolved: failures,
  result: passed ? "COMPREHENSION_PASSED" : "COMPREHENSION_FAILED",
  implementation_authority: passed ? "GRANTED" : "DENIED"
};
const json = JSON.stringify(artifact, null, 2);
if (outPath) writeFileSync(outPath, json);
console.log(json);
process.exit(passed ? 0 : 2);
