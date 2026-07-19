#!/usr/bin/env node
// comprehension-gate.mjs — the reader-validation gate of the AI-native
// institutional-memory layer.
//
// "Reading files is not evidence that the system was understood." Before a reader
// (AI or human) is granted implementation authority, it must return an answer set
// that this gate grades DETERMINISTICALLY against authority-anchored expected
// facts. A wrong answer (e.g. "include every package", "Clotho proves loader
// containment") fails the entry precondition. A pass does not replace The Eye's
// implementation-authority decision. No council spend — the reviewed answer key,
// plus the closed live-pointer profile where applicable, terminates deterministically.
//
// Usage:
//   node comprehension-gate.mjs <queries.json> <reader-answers.json> [--out <artifact.json>]
//   exit 0  => reader passed (all checks green); a reader-validation-artifact is printed/written
//   exit 3  => reader failed comprehension (see artifact.failures)
//   exit 1  => the gate itself could not run (missing or drifted authority record, etc.)
//
// Fail-closed: the gate first verifies the ACTIVE plan's content hash against
// CURRENT-AUTHORITY.json (so a drifted authority record cannot certify anyone),
// then grades the reader.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const { canonicalize, sha256hex } = await import(pathToFileURL(path.join(ROOT, "merkle-dag/vendor.mjs")).href);

const planRefOf = (planText) => "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: planText }));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const asSet = (a) => new Set(Array.isArray(a) ? a : []);
const isUniqueArray = (a) =>
  Array.isArray(a) && new Set(a.map((member) => canonicalize(member))).size === a.length;
const setEq = (a, b) => {
  if (!isUniqueArray(a) || !isUniqueArray(b)) return false;
  const x = new Set(a.map((member) => canonicalize(member)));
  const y = new Set(b.map((member) => canonicalize(member)));
  return x.size === y.size && [...x].every((v) => y.has(v));
};
const answerEq = (kind, a, b) => kind === "set" ? setEq(a, b) : a === b;
const ANSWER_KINDS = new Set(["set", "boolean", "enum"]);
const isTrimmedString = (value) =>
  typeof value === "string" && value.length > 0 && value === value.trim();
const isUniqueStringArray = (value) =>
  Array.isArray(value)
  && value.length > 0
  && value.every(isTrimmedString)
  && new Set(value).size === value.length;
const REQUIRED_LIVE_POINTERS = new Map([
  ["argo", new Map([
    ["implementation-authority-holder", "CURRENT-AUTHORITY.json#implementation_authority.holder"],
    ["accepted-slices", "CURRENT-AUTHORITY.json#implementation_authority.accepted_slices"],
    ["next-slice", "CURRENT-AUTHORITY.json#implementation_authority.next_slice"],
    ["pending-slices", "CURRENT-AUTHORITY.json#implementation_authority.specified_pending_slices"]
  ])],
  ["daedalus", new Map([
    ["refused-versions", "CURRENT-AUTHORITY.json#superseded (authz_status NOT_AUTHORIZED)"]
  ])],
  ["telos", new Map([
    ["active-authorization", "CURRENT-AUTHORITY.json#active_authorization"],
    ["authz-007-superseded-by", "CURRENT-AUTHORITY.json#active_authorization.supersedes"]
  ])]
]);

function die(msg) { console.error("GATE_ERROR: " + msg); process.exit(1); }

function validateQueries(document) {
  if (!isTrimmedString(document?.component)) {
    die("INVALID QUERIES: component must be a nonempty trimmed string");
  }
  if (!Array.isArray(document?.queries) || document.queries.length === 0) {
    die("INVALID QUERIES: queries must be a non-empty array");
  }
  for (const field of ["required_invariants", "required_non_claims"]) {
    if (!isUniqueStringArray(document[field])) {
      die(`INVALID QUERIES: ${field} must be a non-empty array of unique nonempty trimmed strings`);
    }
  }
  const ids = new Set();
  for (const [index, query] of document.queries.entries()) {
    if (!isTrimmedString(query?.id)) {
      die(`INVALID QUERIES: queries[${index}].id must be a nonempty trimmed string`);
    }
    if (ids.has(query.id)) {
      die(`INVALID QUERIES: duplicate query id ${JSON.stringify(query.id)}`);
    }
    ids.add(query.id);
    if (!isTrimmedString(query.query)) {
      die(`INVALID QUERIES: query ${JSON.stringify(query.id)} query must be a nonempty trimmed string`);
    }
    if (!ANSWER_KINDS.has(query.answer_kind)) {
      die(`INVALID QUERIES: query ${JSON.stringify(query.id)} has unknown answer_kind ${JSON.stringify(query.answer_kind)}`);
    }
    if (query.answer_kind === "set" && !isUniqueArray(query.expected)) {
      die(`INVALID QUERIES: set query ${JSON.stringify(query.id)} expected must be an array with unique members`);
    }
    if (query.answer_kind === "boolean" && typeof query.expected !== "boolean") {
      die(`INVALID QUERIES: boolean query ${JSON.stringify(query.id)} expected must be a boolean`);
    }
    if (query.answer_kind === "enum"
      && (typeof query.expected !== "string" || query.expected.trim().length === 0)) {
      die(`INVALID QUERIES: enum query ${JSON.stringify(query.id)} expected must be a nonempty string`);
    }
    const anchor = query.authority_anchor;
    if (!anchor || typeof anchor !== "object" || Array.isArray(anchor)
      || Object.keys(anchor).length === 0) {
      die(`INVALID QUERIES: query ${JSON.stringify(query.id)} authority_anchor must be a nonempty object`);
    }
    if (anchor !== undefined) {
      if (Object.prototype.hasOwnProperty.call(anchor, "pointer")
        && (typeof anchor.pointer !== "string"
          || anchor.pointer.trim().length === 0
          || anchor.pointer !== anchor.pointer.trim())) {
        die(`INVALID QUERIES: query ${JSON.stringify(query.id)} authority_anchor.pointer must be a nonempty trimmed string`);
      }
    }
  }
  const requiredPointers = REQUIRED_LIVE_POINTERS.get(document.component);
  for (const [id, pointer] of requiredPointers || []) {
    const query = document.queries.find((entry) => entry.id === id);
    if (!query || query.authority_anchor.pointer !== pointer) {
      die(`INVALID QUERIES: component ${JSON.stringify(document.component)} requires query ${JSON.stringify(id)} to use live pointer ${JSON.stringify(pointer)}`);
    }
  }
}

function requireString(value, pointer) {
  if (typeof value !== "string" || value.length === 0) {
    die(`AUTHORITY POINTER SHAPE: ${pointer} did not resolve to a nonempty string`);
  }
  return value;
}

function requireStringArray(value, pointer) {
  if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || v.length === 0)) {
    die(`AUTHORITY POINTER SHAPE: ${pointer} did not resolve to an array of nonempty strings`);
  }
  return value;
}

const AUTHORITY_POINTERS = new Map([
  [
    "CURRENT-AUTHORITY.json#implementation_authority.holder",
    (a, pointer) => {
      const holder = requireString(a.implementation_authority?.holder, pointer);
      if (holder !== "The Eye") die(`AUTHORITY POINTER SHAPE: ${pointer} resolved to unsupported holder ${JSON.stringify(holder)}`);
      return "the-eye";
    }
  ],
  [
    "CURRENT-AUTHORITY.json#implementation_authority.accepted_slices",
    (a, pointer) => {
      const slices = a.implementation_authority?.accepted_slices;
      if (!Array.isArray(slices) || slices.some((s) => !s || typeof s.task !== "string" || s.task.length === 0)) {
        die(`AUTHORITY POINTER SHAPE: ${pointer} must resolve to slice objects with nonempty task ids`);
      }
      return slices.map((s) => s.task);
    }
  ],
  [
    "CURRENT-AUTHORITY.json#implementation_authority.next_slice",
    (a, pointer) => {
      const next = a.implementation_authority?.next_slice;
      if (next === null) return "none";
      return requireString(next, pointer);
    }
  ],
  [
    "CURRENT-AUTHORITY.json#implementation_authority.specified_pending_slices",
    (a, pointer) => requireStringArray(a.implementation_authority?.specified_pending_slices, pointer)
  ],
  [
    "CURRENT-AUTHORITY.json#active_authorization",
    (a, pointer) => requireString(a.active_authorization?.id, `${pointer}.id`)
  ],
  [
    "CURRENT-AUTHORITY.json#active_authorization.supersedes",
    (a, pointer, query) => {
      const predecessor = requireString(a.active_authorization?.supersedes, pointer);
      const subject = typeof query.id === "string" && query.id.endsWith("-superseded-by")
        ? query.id.slice(0, -"-superseded-by".length)
        : null;
      if (!subject || predecessor !== subject) {
        die(`AUTHORITY POINTER SHAPE: ${pointer} resolves to predecessor ${JSON.stringify(predecessor)}, which does not match query subject ${JSON.stringify(subject)}`);
      }
      return requireString(a.active_authorization?.id, "CURRENT-AUTHORITY.json#active_authorization.id");
    }
  ],
  [
    "CURRENT-AUTHORITY.json#superseded (authz_status NOT_AUTHORIZED)",
    (a, pointer) => {
      if (!Array.isArray(a.superseded)) die(`AUTHORITY POINTER SHAPE: ${pointer} requires a superseded array`);
      return requireStringArray(
        a.superseded
          .filter((s) => s?.authz_status === "NOT_AUTHORIZED")
          .map((s) => s.plan_version),
        pointer
      );
    }
  ]
]);

function expectedFor(query) {
  const anchor = query.authority_anchor;
  const hasPointer = Object.prototype.hasOwnProperty.call(anchor ?? {}, "pointer");
  if (!hasPointer) {
    return {
      value: query.expected,
      pointer: null,
      citation: anchor || null
    };
  }
  const pointer = anchor.pointer;
  const resolve = AUTHORITY_POINTERS.get(pointer);
  if (!resolve) die(`UNSUPPORTED AUTHORITY POINTER: query ${query.id || "<missing-id>"} names ${JSON.stringify(pointer)}`);
  const value = resolve(authority, pointer, query);
  if (!answerEq(query.answer_kind, query.expected, value)) {
    die(`AUTHORITY ANCHOR DRIFT: query ${query.id || "<missing-id>"} embeds expected=${JSON.stringify(query.expected)}, but ${pointer} resolves to ${JSON.stringify(value)}`);
  }
  return { value, pointer, citation: null };
}

const [, , queriesPath, answersPath, ...rest] = process.argv;
if (!queriesPath || !answersPath) die("usage: comprehension-gate.mjs <queries.json> <reader-answers.json> [--out <file>]");
const outIdx = rest.indexOf("--out");
const outPath = outIdx >= 0 ? rest[outIdx + 1] : null;

let queries, answers, authority;
try { queries = readJson(path.resolve(queriesPath)); } catch (e) { die(`cannot read queries: ${e.message}`); }
try { answers = readJson(path.resolve(answersPath)); } catch (e) { die(`cannot read answers: ${e.message}`); }
try { authority = readJson(path.join(ROOT, "CURRENT-AUTHORITY.json")); } catch (e) { die(`cannot read CURRENT-AUTHORITY.json: ${e.message}`); }
validateQueries(queries);

// ---- 0. verify the authority record against system reality (fail-closed) ------
const active = authority.active_plan;
if (!active || !active.path || !active.sha256) die("CURRENT-AUTHORITY.json: active_plan.{path,sha256} required");
let realPlanRef;
try { realPlanRef = planRefOf(readFileSync(path.join(ROOT, active.path), "utf8")); }
catch (e) { die(`cannot read active plan ${active.path}: ${e.message}`); }
if (realPlanRef !== active.sha256) {
  die(`AUTHORITY DRIFT: active plan ${active.path} recomputes to ${realPlanRef}, but CURRENT-AUTHORITY.json says ${active.sha256}. The authority record does not match reality; refusing to certify any reader.`);
}
const activeAuthorization = authority.active_authorization;
if (!activeAuthorization || typeof activeAuthorization !== "object"
  || Array.isArray(activeAuthorization)
  || !isTrimmedString(activeAuthorization.id)) {
  die("CURRENT-AUTHORITY.json: active_authorization.id must be a nonempty trimmed string");
}
if (activeAuthorization.status !== "AUTHORIZED"
  || activeAuthorization.authorizes_plan !== active.sha256) {
  die("CURRENT-AUTHORITY.json: active_authorization must be AUTHORIZED for active_plan.sha256");
}
if (!Array.isArray(authority.superseded)) {
  die("CURRENT-AUTHORITY.json: superseded must be an array");
}
const supersededAuthz = new Set();
for (const [index, superseded] of authority.superseded.entries()) {
  if (!superseded || typeof superseded !== "object" || Array.isArray(superseded)
    || !isTrimmedString(superseded.authorization)) {
    die(`CURRENT-AUTHORITY.json: superseded[${index}].authorization must be a nonempty trimmed string`);
  }
  if (superseded.authorization === activeAuthorization.id
    || supersededAuthz.has(superseded.authorization)) {
    die(`CURRENT-AUTHORITY.json: superseded authorization must be unique and cannot be active: ${superseded.authorization}`);
  }
  supersededAuthz.add(superseded.authorization);
}
const activeAuthz = activeAuthorization.id;

// ---- grade the reader ---------------------------------------------------------
const failures = [];
const checks = [];
const record = (id, ok, detail) => { checks.push({ id, ok, detail }); if (!ok) failures.push(`${id}: ${detail}`); };

// 1. resolved the ACTIVE authority (not a superseded one)
record("resolved_active_plan", answers.resolved_plan_ref === active.sha256,
  `reader.resolved_plan_ref=${answers.resolved_plan_ref} expected active ${active.sha256}`);
record("resolved_active_authorization", answers.resolved_authorization === activeAuthz,
  `reader.resolved_authorization=${answers.resolved_authorization} expected ${activeAuthz}`);

// 2. the reviewed query artifact must declare the active plan. This detects a
// stale declaration; it is not a content-address binding of the query file.
const qref = queries.governing_authority && queries.governing_authority.plan_ref;
record("queries_declare_active_plan", qref === active.sha256,
  `queries.governing_authority.plan_ref=${qref} expected active ${active.sha256}`);

// 3. reader must explicitly exclude every superseded authorization as non-governing
const excludedListValid = Array.isArray(answers.excluded_superseded)
  && answers.excluded_superseded.every(isTrimmedString)
  && new Set(answers.excluded_superseded).size === answers.excluded_superseded.length;
const excluded = asSet(answers.excluded_superseded);
const missingExcl = [...supersededAuthz].filter((a) => !excluded.has(a));
const extraExcl = [...excluded].filter((a) => !supersededAuthz.has(a));
const exclusionsExact = excludedListValid && missingExcl.length === 0 && extraExcl.length === 0;
const exclusionProblems = [
  ...(!excludedListValid ? ["excluded_superseded must be an array of unique nonempty trimmed strings"] : []),
  ...(missingExcl.length ? [`did not mark superseded authorizations as non-governing: ${missingExcl.join(", ")}`] : []),
  ...(extraExcl.length ? [`marked active or unknown authorizations as superseded: ${extraExcl.join(", ")}`] : [])
];
record("excluded_superseded", exclusionsExact,
  exclusionsExact ? "reader exclusions exactly match superseded authorizations" : exclusionProblems.join("; "));

// 4. deterministic comprehension answers
const ans = answers.answers || {};
for (const q of queries.queries || []) {
  const given = ans[q.id];
  const resolved = expectedFor(q);
  const expected = resolved.value;
  let ok, detail;
  if (given === undefined) { ok = false; detail = "no answer provided"; }
  else if (q.answer_kind === "set") { ok = setEq(given, expected); detail = ok ? "set match" : `got ${JSON.stringify(given)} expected ${JSON.stringify(expected)}`; }
  else if (q.answer_kind === "boolean") { ok = given === expected; detail = ok ? "match" : `got ${JSON.stringify(given)} expected ${JSON.stringify(expected)}`; }
  else if (q.answer_kind === "enum") { ok = given === expected; detail = ok ? "match" : `got ${JSON.stringify(given)} expected ${JSON.stringify(expected)}`; }
  else { ok = false; detail = `unknown answer_kind ${q.answer_kind}`; }
  if (resolved.pointer) {
    detail += `; authority anchor resolved ${resolved.pointer} -> ${JSON.stringify(expected)}`;
  } else if (resolved.citation) {
    detail += ` [evidence citation only; expected value comes from the reviewed query artifact: ${JSON.stringify(resolved.citation)}]`;
  }
  record(`answer:${q.id}`, ok, detail);
}

// 5. required invariants + non-claims acknowledged (by id)
for (const reqId of queries.required_invariants || []) {
  const acknowledged = asSet(answers.invariants_read).has(reqId);
  record(`invariant_read:${reqId}`, acknowledged, acknowledged ? `reader acknowledged invariant ${reqId}` : `reader did not acknowledge invariant ${reqId}`);
}
for (const reqId of queries.required_non_claims || []) {
  const acknowledged = asSet(answers.non_claims_read).has(reqId);
  record(`non_claim_read:${reqId}`, acknowledged, acknowledged ? `reader acknowledged non-claim ${reqId}` : `reader did not acknowledge non-claim ${reqId}`);
}

const passed = failures.length === 0;
const artifact = {
  gate: "comprehension-gate",
  component: queries.component || null,
  reader: answers.reader || null,
  active_authority: { plan: active.path, plan_ref: active.sha256, authorization: activeAuthz },
  plan_hash_verified: true,
  authority_resolved: passed ? activeAuthz : null,
  superseded_artifacts_excluded: exclusionsExact,
  comprehension_checks: { passed: checks.filter((c) => c.ok).length, failed: failures.length, checks },
  unresolved_contradictions: failures,
  result: passed ? "COMPREHENSION_PASSED" : "COMPREHENSION_FAILED",
  implementation_authority: passed ? "GRANTED" : "DENIED"
};
const json = JSON.stringify(artifact, null, 2);
if (outPath) writeFileSync(path.resolve(outPath), json);
console.log(json);
process.exit(passed ? 0 : 3);
