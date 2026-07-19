#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "gate");
const GATE = path.join(HERE, "..", "scripts", "gate.mjs");
const COMMAND = path.join(HERE, "..", "commands", "memory-gate.md");
const roots = [];

function stage(mutate = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), "anm-gate-"));
  roots.push(root);
  cpSync(FX, root, { recursive: true });
  mutate(root);
  return root;
}

function readJson(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

function writeJson(root, file, value) {
  writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

function run(root, answers = "answers-pass.json", extra = []) {
  return spawnSync(process.execPath, [
    GATE,
    path.join(root, "queries.json"),
    path.join(root, answers),
    "--authority",
    path.join(root, "AUTHORITY.json"),
    ...extra
  ], { encoding: "utf8" });
}

function stagedResult(mutate, answers = "answers-pass.json") {
  const root = stage(mutate);
  return run(root, answers);
}

function artifact(result) {
  return JSON.parse(result.stdout);
}

function artifactCheck(result, id) {
  return artifact(result).comprehension_checks.checks.find((check) => check.id === id);
}

function assertDeniedWithCheck(result, id) {
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.equal(
    artifactCheck(result, id)?.ok,
    false,
    `expected a failing ${id} artifact check:\n${result.stdout}`
  );
}

try {
  const passing = stage();
  const out = path.join(passing, "artifact.json");
  const granted = run(passing, "answers-pass.json", ["--out", out]);
  assert.equal(granted.status, 0, granted.stdout + granted.stderr);
  const grantedArtifact = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(grantedArtifact.result, "COMPREHENSION_PASSED");
  assert.equal(grantedArtifact.implementation_authority, "GRANTED");
  assert.match(
    grantedArtifact.comprehension_checks.checks.find((check) =>
      check.id.startsWith("required_invariant_resolves:")
    ).detail,
    /^resolved to sibling invariant record:/
  );
  for (const prefix of ["invariant_read:", "non_claim_read:"]) {
    const acknowledgement = grantedArtifact.comprehension_checks.checks.find((check) =>
      check.id.startsWith(prefix)
    );
    assert.match(acknowledgement.detail, / acknowledged$/);
    assert.doesNotMatch(acknowledgement.detail, / not acknowledged$/);
  }

  assert.equal(run(stage(), "answers-wrong.json").status, 2);
  assert.equal(run(stage(), "answers-missing-exclusion.json").status, 2);

  const booleanStrings = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    const answers = readJson(root, "answers-pass.json");
    queries.queries.find((query) => query.id === "q-bool").expected = "false";
    answers.answers["q-bool"] = "false";
    writeJson(root, "queries.json", queries);
    writeJson(root, "answers-pass.json", answers);
  });
  assertDeniedWithCheck(booleanStrings, "query_expected_type:0");
  assertDeniedWithCheck(booleanStrings, "answer_type:q-bool");

  const numericSets = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    const answers = readJson(root, "answers-pass.json");
    queries.queries.find((query) => query.id === "q-set").expected = 42;
    answers.answers["q-set"] = 999;
    writeJson(root, "queries.json", queries);
    writeJson(root, "answers-pass.json", answers);
  });
  assertDeniedWithCheck(numericSets, "query_expected_type:2");
  assertDeniedWithCheck(numericSets, "answer_type:q-set");

  for (const [id, malformed] of [
    ["q-bool", "false"],
    ["q-enum", false],
    ["q-set", "unknown"]
  ]) {
    const malformedAnswer = stagedResult((root) => {
      const answers = readJson(root, "answers-pass.json");
      answers.answers[id] = malformed;
      writeJson(root, "answers-pass.json", answers);
    });
    assertDeniedWithCheck(malformedAnswer, `answer_type:${id}`);
  }

  const duplicateQueryId = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    queries.queries.push({ ...queries.queries[0] });
    writeJson(root, "queries.json", queries);
  });
  assertDeniedWithCheck(duplicateQueryId, "query_ids_unique");

  const unsupportedAnswerKind = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    queries.queries[1].answer_kind = "number";
    writeJson(root, "queries.json", queries);
  });
  assertDeniedWithCheck(unsupportedAnswerKind, "query_answer_kind:1");

  const malformedEnumExpected = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    const answers = readJson(root, "answers-pass.json");
    queries.queries[1].expected = false;
    answers.answers["q-enum"] = false;
    writeJson(root, "queries.json", queries);
    writeJson(root, "answers-pass.json", answers);
  });
  assertDeniedWithCheck(malformedEnumExpected, "query_expected_type:1");

  for (const [field, value, check] of [
    ["id", "   ", "query_id:0"],
    ["query", "   ", "query_text:0"]
  ]) {
    const malformedQueryText = stagedResult((root) => {
      const queries = readJson(root, "queries.json");
      queries.queries[0][field] = value;
      writeJson(root, "queries.json", queries);
    });
    assertDeniedWithCheck(malformedQueryText, check);
  }

  const unacknowledged = stagedResult((root) => {
    const answers = readJson(root, "answers-pass.json");
    answers.invariants_read = [];
    writeJson(root, "answers-pass.json", answers);
  });
  assert.equal(unacknowledged.status, 2, unacknowledged.stdout + unacknowledged.stderr);
  assert.match(
    artifact(unacknowledged).comprehension_checks.checks.find((check) =>
      check.id.startsWith("invariant_read:")
    ).detail,
    / not acknowledged$/
  );

  const emptyQueries = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    queries.queries = [];
    writeJson(root, "queries.json", queries);
  });
  assert.equal(emptyQueries.status, 2, emptyQueries.stdout + emptyQueries.stderr);
  assert.match(emptyQueries.stdout, /queries_nonempty/);

  for (const field of ["required_invariants", "required_non_claims"]) {
    const emptyRequired = stagedResult((root) => {
      const queries = readJson(root, "queries.json");
      const answers = readJson(root, "answers-pass.json");
      queries[field] = [];
      answers[field === "required_invariants" ? "invariants_read" : "non_claims_read"] = [];
      writeJson(root, "queries.json", queries);
      writeJson(root, "answers-pass.json", answers);
    });
    assert.equal(emptyRequired.status, 2, `${field}:\n${emptyRequired.stdout}\n${emptyRequired.stderr}`);
    assert.match(emptyRequired.stdout, new RegExp(`${field}_nonempty`));
  }

  const nonexistent = `sha256:${"f".repeat(64)}`;
  const danglingRequired = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    const answers = readJson(root, "answers-pass.json");
    queries.required_invariants = [nonexistent];
    answers.invariants_read = [nonexistent];
    writeJson(root, "queries.json", queries);
    writeJson(root, "answers-pass.json", answers);
  });
  assert.equal(danglingRequired.status, 2, danglingRequired.stdout + danglingRequired.stderr);
  assert.match(danglingRequired.stdout, /required_invariant_resolves/);

  const duplicateRequired = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    queries.required_invariants.push(queries.required_invariants[0]);
    writeJson(root, "queries.json", queries);
  });
  assert.equal(duplicateRequired.status, 2, duplicateRequired.stdout + duplicateRequired.stderr);
  assert.match(duplicateRequired.stdout, /required_invariants_unique/);

  const invalidRequired = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    const answers = readJson(root, "answers-pass.json");
    queries.required_non_claims = ["not-a-content-address"];
    answers.non_claims_read = ["not-a-content-address"];
    writeJson(root, "queries.json", queries);
    writeJson(root, "answers-pass.json", answers);
  });
  assert.equal(invalidRequired.status, 2, invalidRequired.stdout + invalidRequired.stderr);
  assert.match(invalidRequired.stdout, /required_non_claims_content_addresses/);

  const wrongKind = stagedResult((root) => {
    const queries = readJson(root, "queries.json");
    const answers = readJson(root, "answers-pass.json");
    queries.required_invariants = [...queries.required_non_claims];
    answers.invariants_read = [...queries.required_non_claims];
    writeJson(root, "queries.json", queries);
    writeJson(root, "answers-pass.json", answers);
  });
  assert.equal(wrongKind.status, 2, wrongKind.stdout + wrongKind.stderr);
  assert.match(wrongKind.stdout, /required_invariant_resolves/);

  const missingSibling = stagedResult((root) => {
    rmSync(path.join(root, "INVARIANTS.json"));
  });
  assert.equal(missingSibling.status, 1, missingSibling.stdout + missingSibling.stderr);
  assert.match(missingSibling.stderr, /GATE_ERROR:/);

  const malformedSibling = stagedResult((root) => {
    writeFileSync(path.join(root, "NON-CLAIMS.json"), "{\n");
  });
  assert.equal(malformedSibling.status, 1, malformedSibling.stdout + malformedSibling.stderr);
  assert.match(malformedSibling.stderr, /GATE_ERROR:/);

  const invalidSiblingAddress = stagedResult((root) => {
    const records = readJson(root, "INVARIANTS.json");
    records[0].id = `sha256:${"0".repeat(64)}`;
    writeJson(root, "INVARIANTS.json", records);
  });
  assert.equal(
    invalidSiblingAddress.status,
    1,
    invalidSiblingAddress.stdout + invalidSiblingAddress.stderr
  );
  assert.match(invalidSiblingAddress.stderr, /content-addressed invariant records/);

  const siblingSymlinkEscape = stagedResult((root) => {
    const outside = mkdtempSync(path.join(tmpdir(), "anm-gate-outside-"));
    roots.push(outside);
    const sibling = path.join(root, "INVARIANTS.json");
    cpSync(sibling, path.join(outside, "INVARIANTS.json"));
    rmSync(sibling);
    symlinkSync(path.join(outside, "INVARIANTS.json"), sibling);
  });
  assert.equal(
    siblingSymlinkEscape.status,
    1,
    siblingSymlinkEscape.stdout + siblingSymlinkEscape.stderr
  );
  assert.match(siblingSymlinkEscape.stderr, /escapes query record directory/);

  const drifted = stage((root) => {
    const doc = path.join(root, "authority-doc.md");
    writeFileSync(doc, readFileSync(doc, "utf8") + "tamper\n");
  });
  assert.equal(run(drifted).status, 1);

  const command = readFileSync(COMMAND, "utf8");
  assert.match(
    command,
    /<queries\.json> <answers\.json> \[CURRENT-AUTHORITY\.json\] \[gate-artifact\.json\]/
  );
  assert.match(
    command,
    /component(?:'s|’s) `memory\/comprehension-queries\.json`/
  );
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

console.log("test-gate: all assertions passed");
