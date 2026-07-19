#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const GATE = path.join(HERE, "comprehension-gate.mjs");
const examples = (name) => path.join(HERE, "examples", name);
const queries = (rel) => path.join(ROOT, rel);

function run(query, reader) {
  return spawnSync(process.execPath, [GATE, queries(query), examples(reader)], {
    encoding: "utf8"
  });
}

const tempDir = mkdtempSync(path.join(tmpdir(), "comprehension-gate-test-"));
process.on("exit", () => rmSync(tempDir, { recursive: true, force: true }));
let mutationSequence = 0;
function runData(query, reader) {
  mutationSequence += 1;
  const queryPath = path.join(tempDir, `queries-${mutationSequence}.json`);
  const readerPath = path.join(tempDir, `reader-${mutationSequence}.json`);
  writeFileSync(queryPath, JSON.stringify(query));
  writeFileSync(readerPath, JSON.stringify(reader));
  return spawnSync(process.execPath, [GATE, queryPath, readerPath], {
    encoding: "utf8"
  });
}

function artifactOf(result) {
  assert.equal(result.stderr, "", `unexpected gate stderr:\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

const argoQueries = JSON.parse(readFileSync(
  queries("docs/institutional-memory/argo/comprehension-queries.json"),
  "utf8"
));
const argoReader = JSON.parse(readFileSync(examples("reader-argo-correct.json"), "utf8"));

function runWithAuthorityMutation(mutateAuthority, mutateReader = () => {}) {
  mutationSequence += 1;
  const isolatedRoot = path.join(tempDir, `authority-root-${mutationSequence}`);
  const isolatedGate = path.join(isolatedRoot, "docs", "institutional-memory", "comprehension-gate.mjs");
  const isolatedVendor = path.join(isolatedRoot, "merkle-dag", "vendor.mjs");
  const authority = JSON.parse(readFileSync(path.join(ROOT, "CURRENT-AUTHORITY.json"), "utf8"));
  const reader = structuredClone(argoReader);
  mutateAuthority(authority);
  mutateReader(reader);

  mkdirSync(path.dirname(isolatedGate), { recursive: true });
  mkdirSync(path.dirname(isolatedVendor), { recursive: true });
  writeFileSync(isolatedGate, readFileSync(GATE));
  writeFileSync(isolatedVendor, readFileSync(path.join(ROOT, "merkle-dag", "vendor.mjs")));
  const planPath = path.join(isolatedRoot, authority.active_plan.path);
  mkdirSync(path.dirname(planPath), { recursive: true });
  writeFileSync(planPath, readFileSync(path.join(ROOT, authority.active_plan.path)));
  writeFileSync(path.join(isolatedRoot, "CURRENT-AUTHORITY.json"), JSON.stringify(authority));
  const queryPath = path.join(isolatedRoot, "queries.json");
  const readerPath = path.join(isolatedRoot, "reader.json");
  writeFileSync(queryPath, JSON.stringify(argoQueries));
  writeFileSync(readerPath, JSON.stringify(reader));
  return spawnSync(process.execPath, [isolatedGate, queryPath, readerPath], {
    encoding: "utf8"
  });
}

for (const [label, mutateAuthority, mutateReader] of [
  [
    "missing active authorization",
    (authority) => { delete authority.active_authorization; },
    (reader) => { delete reader.resolved_authorization; }
  ],
  [
    "missing superseded array",
    (authority) => { delete authority.superseded; },
    (reader) => { reader.excluded_superseded = []; }
  ],
  [
    "malformed superseded entry",
    (authority) => { authority.superseded[0] = {}; },
    () => {}
  ]
]) {
  const malformedAuthority = runWithAuthorityMutation(mutateAuthority, mutateReader);
  assert.equal(
    malformedAuthority.status,
    1,
    `${label} must fail before grading:\n${malformedAuthority.stdout}\n${malformedAuthority.stderr}`
  );
  assert.match(malformedAuthority.stderr, /GATE_ERROR: CURRENT-AUTHORITY\.json/);
}

const argo = run(
  "docs/institutional-memory/argo/comprehension-queries.json",
  "reader-argo-correct.json"
);
assert.equal(argo.status, 0, `current Argo reader must pass:\n${argo.stdout}\n${argo.stderr}`);
const argoArtifact = artifactOf(argo);
for (const id of ["accepted-slices", "next-slice", "pending-slices"]) {
  const check = argoArtifact.comprehension_checks.checks.find((c) => c.id === `answer:${id}`);
  assert.equal(check?.ok, true, `${id} must be validated against live authority`);
  assert.match(check.detail, /authority anchor resolved/, `${id} detail must say the anchor was resolved`);
}
for (const check of argoArtifact.comprehension_checks.checks.filter((c) =>
  /^(invariant_read|non_claim_read):/.test(c.id))) {
  assert.doesNotMatch(check.detail, /did not acknowledge/, `${check.id} pass detail must not describe failure`);
}

const scalarEmptySetReader = structuredClone(argoReader);
scalarEmptySetReader.answers["pending-slices"] = {};
const scalarEmptySet = runData(argoQueries, scalarEmptySetReader);
assert.equal(
  scalarEmptySet.status,
  3,
  `a scalar/object reader answer must not equal an authoritative empty set:\n${scalarEmptySet.stdout}\n${scalarEmptySet.stderr}`
);

const duplicateSetReader = structuredClone(argoReader);
duplicateSetReader.answers["accepted-slices"].push("4a");
const duplicateSetAnswer = runData(argoQueries, duplicateSetReader);
assert.equal(
  duplicateSetAnswer.status,
  3,
  `a reader set answer with duplicate members must be denied:\n${duplicateSetAnswer.stdout}\n${duplicateSetAnswer.stderr}`
);

const contradictoryAuthorityReader = structuredClone(argoReader);
contradictoryAuthorityReader.excluded_superseded.push(
  contradictoryAuthorityReader.resolved_authorization
);
const contradictoryAuthority = runData(argoQueries, contradictoryAuthorityReader);
assert.equal(
  contradictoryAuthority.status,
  3,
  `a reader must not both resolve an authorization as active and exclude it as superseded:\n${contradictoryAuthority.stdout}\n${contradictoryAuthority.stderr}`
);

const scalarEmptySetExpected = structuredClone(argoQueries);
scalarEmptySetExpected.queries.find((q) => q.id === "pending-slices").expected = {};
const scalarExpected = runData(scalarEmptySetExpected, argoReader);
assert.equal(
  scalarExpected.status,
  1,
  `a malformed embedded set expectation must fail closed:\n${scalarExpected.stdout}\n${scalarExpected.stderr}`
);

const duplicateSetExpected = structuredClone(argoQueries);
duplicateSetExpected.queries.find((q) => q.id === "accepted-slices").expected.push("4a");
const duplicateExpected = runData(duplicateSetExpected, argoReader);
assert.equal(
  duplicateExpected.status,
  1,
  `an embedded set expectation with duplicate members must fail closed:\n${duplicateExpected.stdout}\n${duplicateExpected.stderr}`
);

for (const [label, mutate] of [
  ["empty query list", (q) => { q.queries = []; }],
  ["non-array query list", (q) => { q.queries = {}; }],
  ["duplicate query id", (q) => { q.queries.push(structuredClone(q.queries[0])); }],
  ["empty query id", (q) => { q.queries[0].id = " "; }],
  ["empty query text", (q) => { q.queries[0].query = " "; }],
  ["unknown answer kind", (q) => { q.queries[0].answer_kind = "freeform"; }],
  ["missing required invariants", (q) => { delete q.required_invariants; }],
  ["empty required invariants", (q) => { q.required_invariants = []; }],
  ["non-array required non-claims", (q) => { q.required_non_claims = {}; }],
  ["missing authority anchor", (q) => { delete q.queries[0].authority_anchor; }],
  ["blank authority pointer", (q) => {
    q.queries.find((entry) => entry.id === "accepted-slices").authority_anchor.pointer = "";
  }],
  ["non-string authority pointer", (q) => {
    q.queries.find((entry) => entry.id === "accepted-slices").authority_anchor.pointer = 0;
  }]
]) {
  const malformedQueries = structuredClone(argoQueries);
  mutate(malformedQueries);
  const result = runData(malformedQueries, argoReader);
  assert.equal(
    result.status,
    1,
    `${label} must be rejected as a gate error:\n${result.stdout}\n${result.stderr}`
  );
  assert.match(result.stderr, /GATE_ERROR: INVALID QUERIES/, `${label} must produce an explicit query-schema error`);
}

const downgradedLivePointer = structuredClone(argoQueries);
const downgradedLiveReader = structuredClone(argoReader);
const downgradedAccepted = downgradedLivePointer.queries.find((q) => q.id === "accepted-slices");
delete downgradedAccepted.authority_anchor.pointer;
downgradedAccepted.expected = ["forged"];
downgradedLiveReader.answers["accepted-slices"] = ["forged"];
const downgradedPointer = runData(downgradedLivePointer, downgradedLiveReader);
assert.equal(
  downgradedPointer.status,
  1,
  `removing a required live pointer must not downgrade it to a citation and trust matching in-band bytes:\n${downgradedPointer.stdout}\n${downgradedPointer.stderr}`
);
assert.match(downgradedPointer.stderr, /GATE_ERROR: INVALID QUERIES/);

const nonBooleanExpected = structuredClone(argoQueries);
const nonBooleanReader = structuredClone(argoReader);
nonBooleanExpected.queries.find((q) => q.id === "autonomous-runner-exists").expected = "false";
nonBooleanReader.answers["autonomous-runner-exists"] = "false";
const malformedBoolean = runData(nonBooleanExpected, nonBooleanReader);
assert.equal(
  malformedBoolean.status,
  1,
  `a non-boolean expectation and matching reader answer must not grant a boolean query:\n${malformedBoolean.stdout}\n${malformedBoolean.stderr}`
);
assert.match(malformedBoolean.stderr, /GATE_ERROR: INVALID QUERIES/);

const emptyEnumExpected = structuredClone(argoQueries);
const emptyEnumReader = structuredClone(argoReader);
emptyEnumExpected.queries.find((q) => q.id === "entry-precondition").expected = "";
emptyEnumReader.answers["entry-precondition"] = "";
const malformedEnum = runData(emptyEnumExpected, emptyEnumReader);
assert.equal(
  malformedEnum.status,
  1,
  `an empty enum expectation and matching reader answer must fail closed:\n${malformedEnum.stdout}\n${malformedEnum.stderr}`
);
assert.match(malformedEnum.stderr, /GATE_ERROR: INVALID QUERIES/);

for (const [query, reader] of [
  ["docs/institutional-memory/daedalus/comprehension-queries.json", "reader-daedalus-correct.json"],
  ["docs/institutional-memory/telos/comprehension-queries.json", "reader-telos-correct.json"]
]) {
  const result = run(query, reader);
  assert.equal(result.status, 0, `${query} live pointer forms must pass:\n${result.stdout}\n${result.stderr}`);
}

const stale = run(
  "docs/institutional-memory/examples/queries-argo-stale-anchor.json",
  "reader-argo-correct.json"
);
assert.equal(stale.status, 1, `stale in-band expected data must be a gate error:\n${stale.stdout}\n${stale.stderr}`);
assert.match(stale.stderr, /AUTHORITY ANCHOR DRIFT/, "stale expected data must name authority-anchor drift");

const unsupported = run(
  "docs/institutional-memory/examples/queries-unsupported-pointer.json",
  "reader-argo-correct.json"
);
assert.equal(unsupported.status, 1, `unsupported pointers must fail closed:\n${unsupported.stdout}\n${unsupported.stderr}`);
assert.match(unsupported.stderr, /UNSUPPORTED AUTHORITY POINTER/, "unsupported pointer failure must be explicit");

const lachesis = run(
  "lachesis/memory/comprehension-queries.json",
  "reader-lachesis-correct.json"
);
assert.equal(lachesis.status, 0, `correct Lachesis reader must pass:\n${lachesis.stdout}\n${lachesis.stderr}`);
const lachesisArtifact = artifactOf(lachesis);
assert.equal(lachesisArtifact.component, "lachesis");
assert.equal(lachesisArtifact.result, "COMPREHENSION_PASSED");
assert.ok(
  lachesisArtifact.comprehension_checks.checks.some((c) => c.id === "queries_declare_active_plan"),
  "the query artifact must declare the active plan without claiming its own bytes are authority-hash-bound"
);
for (const check of lachesisArtifact.comprehension_checks.checks.filter((c) => c.id.startsWith("answer:"))) {
  assert.match(
    check.detail,
    /evidence citation only; expected value comes from the reviewed query artifact/,
    `${check.id} must label non-pointer anchor metadata as a citation, not live authority`
  );
  assert.doesNotMatch(check.detail, /authority anchor resolved/);
}

const misconceptions = run(
  "lachesis/memory/comprehension-queries.json",
  "reader-lachesis-misconceptions.json"
);
assert.equal(misconceptions.status, 3, `Lachesis misconceptions must be denied:\n${misconceptions.stdout}\n${misconceptions.stderr}`);
const misconceptionArtifact = artifactOf(misconceptions);
assert.equal(misconceptionArtifact.result, "COMPREHENSION_FAILED");
assert.ok(
  misconceptionArtifact.comprehension_checks.checks.some((c) =>
    c.id === "answer:risk-class-enforces" && c.ok === false),
  "the risk-enforcement misconception must be discriminated by id"
);
assert.ok(
  misconceptionArtifact.comprehension_checks.checks.every((c) => c.id !== "answer:undefined"),
  "Lachesis queries must use the host schema"
);

console.log("test-comprehension-gate OK");
