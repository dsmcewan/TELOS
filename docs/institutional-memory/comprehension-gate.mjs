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

import { createHash } from "node:crypto";
import {
  closeSync,
  fstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
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
const isUniqueStringArray = (value, { allowEmpty = false } = {}) =>
  Array.isArray(value)
  && (allowEmpty || value.length > 0)
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

function registeredQueryArtifact(callerPath) {
  let manifest;
  try {
    manifest = readJson(path.join(ROOT, "repository-manifest.json"));
  } catch (error) {
    die(`cannot read repository-manifest.json: ${error.message}`);
  }
  const registrations = manifest?.entry_points?.comprehension_query_artifacts;
  if (!Array.isArray(registrations) || registrations.length === 0) {
    die("INVALID QUERY REGISTRY: repository-manifest.json entry_points.comprehension_query_artifacts must be a non-empty array");
  }
  const authoritativeMemoryDirs = manifest?.entry_points?.memory_dirs;
  if (!authoritativeMemoryDirs || typeof authoritativeMemoryDirs !== "object"
    || Array.isArray(authoritativeMemoryDirs)) {
    die("INVALID QUERY REGISTRY: repository-manifest.json entry_points.memory_dirs must be an object");
  }

  const moduleOwners = new Map();
  for (const section of ["components", "role_modules", "capability_modules"]) {
    const entries = manifest?.[section];
    if (!Array.isArray(entries)) {
      die(`INVALID QUERY REGISTRY: repository-manifest.json ${section} must be an array`);
    }
    for (const entry of entries) {
      if (!isTrimmedString(entry?.name)) continue;
      if (moduleOwners.has(entry.name)) {
        die(`INVALID QUERY REGISTRY: duplicate manifest module name ${JSON.stringify(entry.name)}`);
      }
      moduleOwners.set(entry.name, entry);
    }
  }

  const rootRealPath = realpathSync(ROOT);
  const byAbsolutePath = new Map();
  for (const [index, registration] of registrations.entries()) {
    if (!registration || typeof registration !== "object" || Array.isArray(registration)
      || Object.keys(registration).sort().join(",") !== "component,path,profile") {
      die(`INVALID QUERY REGISTRY: entry ${index} must contain exactly component, path, and profile`);
    }
    if (!isTrimmedString(registration.component)) {
      die(`INVALID QUERY REGISTRY: entry ${index} component must be a nonempty trimmed string`);
    }
    if (!["module", "advisory-reference"].includes(registration.profile)) {
      die(`INVALID QUERY REGISTRY: entry ${index} profile must be module or advisory-reference`);
    }
    const manifestPath = registration.path;
    const segments = typeof manifestPath === "string" ? manifestPath.split("/") : [];
    if (!isTrimmedString(manifestPath)
      || path.posix.isAbsolute(manifestPath)
      || manifestPath.includes("\\")
      || path.posix.normalize(manifestPath) !== manifestPath
      || segments.some((segment) => segment === "." || segment === "..")) {
      die(`INVALID QUERY REGISTRY: entry ${index} path must be a normalized repository-relative POSIX path`);
    }
    if (registration.profile === "module") {
      const owner = moduleOwners.get(registration.component);
      if (!owner) {
        die(`INVALID QUERY REGISTRY: module component ${JSON.stringify(registration.component)} is not manifest-declared`);
      }
      const memoryDir = authoritativeMemoryDirs[registration.component];
      if (!isTrimmedString(memoryDir) || memoryDir !== owner.memory_dir) {
        die(`INVALID QUERY REGISTRY: ${registration.component} memory_dir must agree between its module entry and entry_points.memory_dirs`);
      }
      const normalizedMemoryDir = memoryDir.endsWith("/") ? memoryDir.slice(0, -1) : memoryDir;
      const relativeToMemoryDir = path.posix.relative(normalizedMemoryDir, manifestPath);
      if (!isTrimmedString(normalizedMemoryDir)
        || path.posix.isAbsolute(normalizedMemoryDir)
        || normalizedMemoryDir.includes("\\")
        || path.posix.normalize(normalizedMemoryDir) !== normalizedMemoryDir
        || relativeToMemoryDir === ""
        || relativeToMemoryDir === ".."
        || relativeToMemoryDir.startsWith("../")
        || path.posix.isAbsolute(relativeToMemoryDir)) {
        die(`INVALID QUERY REGISTRY: ${manifestPath} is outside ${registration.component}'s memory_dir ${memoryDir}`);
      }
    } else if (!registration.component.startsWith("reference:")) {
      die(`INVALID QUERY REGISTRY: advisory-reference component ${JSON.stringify(registration.component)} must start with "reference:"`);
    }
    const absolutePath = path.join(ROOT, ...segments);
    if (byAbsolutePath.has(absolutePath)) {
      die(`INVALID QUERY REGISTRY: duplicate path ${JSON.stringify(manifestPath)}`);
    }
    let artifactRealPath;
    try {
      artifactRealPath = realpathSync(absolutePath);
    } catch (error) {
      die(`INVALID QUERY REGISTRY: cannot resolve ${manifestPath}: ${error.message}`);
    }
    if (!statSync(artifactRealPath).isFile()) {
      die(`INVALID QUERY REGISTRY: ${manifestPath} is not a regular file`);
    }
    const relativeRealPath = path.relative(rootRealPath, artifactRealPath);
    if (relativeRealPath === ".."
      || relativeRealPath.startsWith(`..${path.sep}`)
      || path.isAbsolute(relativeRealPath)) {
      die(`INVALID QUERY REGISTRY: ${manifestPath} resolves outside the repository`);
    }
    const expectedRealPath = path.join(rootRealPath, ...segments);
    if (artifactRealPath !== expectedRealPath) {
      die(`INVALID QUERY REGISTRY: ${manifestPath} must not traverse a symbolic link`);
    }
    byAbsolutePath.set(absolutePath, {
      component: registration.component,
      profile: registration.profile,
      path: manifestPath,
      absolutePath
    });
  }

  const requestedPath = path.resolve(callerPath);
  const registration = byAbsolutePath.get(requestedPath);
  if (!registration) {
    die(`UNREGISTERED QUERY ARTIFACT: ${requestedPath}`);
  }
  let descriptor;
  try {
    descriptor = openSync(registration.absolutePath, "r");
    const openedFile = fstatSync(descriptor);
    if (!openedFile.isFile()) {
      throw new Error("opened artifact is not a regular file");
    }
    const currentRealPath = realpathSync(registration.absolutePath);
    const currentPathFile = statSync(currentRealPath);
    const expectedRealPath = path.join(rootRealPath, ...registration.path.split("/"));
    if (currentRealPath !== expectedRealPath) {
      throw new Error("registered path traversed a symbolic link after validation");
    }
    if (openedFile.dev !== currentPathFile.dev || openedFile.ino !== currentPathFile.ino) {
      throw new Error("registered path changed while it was being opened");
    }
    return { ...registration, bytes: readFileSync(descriptor) };
  } catch (error) {
    die(`QUERY ARTIFACT RACE: cannot securely read ${registration.path}: ${error.message}`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function validateQueries(document, registration) {
  if (!isTrimmedString(document?.component)) {
    die("INVALID QUERIES: component must be a nonempty trimmed string");
  }
  if (!Array.isArray(document?.queries) || document.queries.length === 0) {
    die("INVALID QUERIES: queries must be a non-empty array");
  }
  for (const field of ["required_invariants", "required_non_claims"]) {
    const allowEmpty = registration.profile === "advisory-reference" && field === "required_invariants";
    if (!isUniqueStringArray(document[field], { allowEmpty })) {
      die(`INVALID QUERIES: ${field} must be ${allowEmpty ? "an array" : "a non-empty array"} of unique nonempty trimmed strings`);
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
  const requiredPointers = REQUIRED_LIVE_POINTERS.get(registration.component);
  for (const [id, pointer] of requiredPointers || []) {
    const query = document.queries.find((entry) => entry.id === id);
    if (!query || query.authority_anchor.pointer !== pointer) {
      die(`INVALID QUERIES: component ${JSON.stringify(registration.component)} requires query ${JSON.stringify(id)} to use live pointer ${JSON.stringify(pointer)}`);
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

const queryRegistration = registeredQueryArtifact(queriesPath);
const queryBytes = queryRegistration.bytes;
let queries, answers, authority;
try { queries = JSON.parse(queryBytes.toString("utf8")); } catch (e) { die(`cannot parse queries: ${e.message}`); }
try { answers = readJson(path.resolve(answersPath)); } catch (e) { die(`cannot read answers: ${e.message}`); }
try { authority = readJson(path.join(ROOT, "CURRENT-AUTHORITY.json")); } catch (e) { die(`cannot read CURRENT-AUTHORITY.json: ${e.message}`); }
if (queries?.component !== queryRegistration.component) {
  die(`QUERY COMPONENT MISMATCH: ${queryRegistration.path} is registered to ${JSON.stringify(queryRegistration.component)}, but declares ${JSON.stringify(queries?.component)}`);
}
validateQueries(queries, queryRegistration);
const queryArtifact = {
  path: queryRegistration.path,
  sha256: `sha256:${createHash("sha256").update(queryBytes).digest("hex")}`
};

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
  query_artifact: queryArtifact,
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
