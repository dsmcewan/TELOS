#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  contentAddress,
  renderRecordList,
  sha256hex
} from "../scripts/lib/record.mjs";
import { auditRoot } from "../scripts/audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "audit");
const AUDIT = path.join(HERE, "..", "scripts", "audit.mjs");
const roots = [];

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function address(record) {
  const copy = { ...record };
  copy.id = contentAddress(copy);
  return copy;
}

function outsideSymlink(link, contents) {
  const outside = mkdtempSync(path.join(tmpdir(), "anm-audit-outside-"));
  roots.push(outside);
  const target = path.join(outside, "target");
  writeFileSync(target, contents);
  rmSync(link, { force: true });
  symlinkSync(target, link);
}

function normalizeTree(root) {
  const memory = path.join(root, "comp", "memory");
  const ids = {
    INVARIANTS: [],
    "NON-CLAIMS": []
  };
  for (const base of ["INVARIANTS", "NON-CLAIMS"]) {
    const file = path.join(memory, `${base}.json`);
    let records;
    try {
      records = JSON.parse(readFileSync(file, "utf8")).map((record) => address({
        ...record,
        lifecycle: record.lifecycle || "docs-first",
        evidence: record.evidence || []
      }));
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    ids[base] = records.map((record) => record.id);
    writeJson(file, records);
    writeFileSync(
      path.join(memory, `${base}.md`),
      renderRecordList(base === "INVARIANTS" ? "Invariants" : "Non-claims", records)
    );
  }
  const contracts = path.join(memory, "CONTRACTS");
  for (const name of ["example.json", "mirror.json"]) {
    const file = path.join(contracts, name);
    try {
      writeJson(file, address(JSON.parse(readFileSync(file, "utf8"))));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const queriesFile = path.join(memory, "comprehension-queries.json");
  try {
    const document = JSON.parse(readFileSync(queriesFile, "utf8"));
    if (Array.isArray(document.queries)) {
      if (ids.INVARIANTS.length > 0) document.required_invariants = ids.INVARIANTS;
      if (ids["NON-CLAIMS"].length > 0) document.required_non_claims = ids["NON-CLAIMS"];
      writeJson(queriesFile, document);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(path.join(root, "scripts", "test-readonly.mjs"), "process.exit(0);\n");
  writeFileSync(path.join(root, "scripts", "test-example.mjs"), "process.exit(0);\n");
}

function rewriteRecordList(root, base, mutate) {
  const memory = path.join(root, "comp", "memory");
  const file = path.join(memory, `${base}.json`);
  const records = JSON.parse(readFileSync(file, "utf8"));
  mutate(records[0]);
  const addressed = records.map(address);
  writeJson(file, addressed);
  writeFileSync(
    path.join(memory, `${base}.md`),
    renderRecordList(base === "INVARIANTS" ? "Invariants" : "Non-claims", addressed)
  );
  return addressed;
}

function stage(name, mutate = () => {}) {
  const root = mkdtempSync(path.join(tmpdir(), `anm-audit-${name}-`));
  roots.push(root);
  mkdirSync(path.join(root, "comp"), { recursive: true });
  cpSync(path.join(FX, name, "comp", "record-set"), path.join(root, "comp", "memory"), { recursive: true });
  for (const top of ["CURRENT-AUTHORITY.json", "authority-doc.md"]) {
    try {
      cpSync(path.join(FX, name, top), path.join(root, top));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  normalizeTree(root);
  if (name === "v-missing-rendered-invariants") {
    rmSync(path.join(root, "comp", "memory", "INVARIANTS.md"));
  }
  mutate(root);
  return root;
}

const failures = (root, check) =>
  auditRoot(root).filter((finding) => finding.level === "FAIL" && finding.check === check);
const auditCli = (root, env = process.env) =>
  spawnSync(process.execPath, [AUDIT, root], { encoding: "utf8", env });

try {
  const passing = stage("passing");
  assert.equal(auditRoot(passing).filter((finding) => finding.level === "FAIL").length, 0);

  for (const [base, record, expectedKind] of [
    [
      "INVARIANTS",
      {
        kind: "contract",
        title: "Smuggled contract",
        statement: "This contract does not belong in the invariant container.",
        status: "ADVISORY",
        lifecycle: "docs-first",
        oracle: { test: "scripts/test-example.mjs" },
        evidence: []
      },
      "invariant"
    ],
    [
      "NON-CLAIMS",
      {
        kind: "invariant",
        statement: "This invariant does not belong in the non-claim container.",
        status: "NORMATIVE-CURRENT",
        lifecycle: "docs-first",
        oracle: "scripts/test-example.mjs",
        evidence: []
      },
      "non-claim"
    ]
  ]) {
    const wrongContainerKind = stage("passing", (root) => {
      const memory = path.join(root, "comp", "memory");
      const file = path.join(memory, `${base}.json`);
      const records = JSON.parse(readFileSync(file, "utf8"));
      records.push(address(record));
      writeJson(file, records);
      writeFileSync(
        path.join(memory, `${base}.md`),
        renderRecordList(base === "INVARIANTS" ? "Invariants" : "Non-claims", records)
      );
    });
    assert.ok(
      failures(wrongContainerKind, "three-representation").some((finding) =>
        finding.detail.includes(`must have kind ${expectedKind}`)
      ),
      `${base}.json rejects a correctly addressed record of the wrong kind`
    );
  }

  const missingQueryDocument = stage("passing", (root) => {
    rmSync(path.join(root, "comp", "memory", "comprehension-queries.json"));
  });
  assert.ok(failures(missingQueryDocument, "query-freshness").length >= 1);

  const emptyQueries = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.queries = [];
    writeJson(file, document);
  });
  assert.ok(failures(emptyQueries, "query-freshness").length >= 1);

  for (const field of ["required_invariants", "required_non_claims"]) {
    const emptyRequired = stage("passing", (root) => {
      const file = path.join(root, "comp", "memory", "comprehension-queries.json");
      const document = JSON.parse(readFileSync(file, "utf8"));
      document[field] = [];
      writeJson(file, document);
    });
    assert.ok(
      failures(emptyRequired, "query-freshness").length >= 1,
      `${field} must be nonempty`
    );
  }

  const duplicateRequired = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.required_invariants.push(document.required_invariants[0]);
    writeJson(file, document);
  });
  assert.ok(failures(duplicateRequired, "query-freshness").length >= 1);

  const invalidRequired = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.required_non_claims = ["not-a-content-address"];
    writeJson(file, document);
  });
  assert.ok(failures(invalidRequired, "query-freshness").length >= 1);

  const danglingRequired = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.required_invariants = [`sha256:${"f".repeat(64)}`];
    writeJson(file, document);
  });
  assert.ok(failures(danglingRequired, "query-freshness").length >= 1);

  const wrongKindRequired = stage("passing", (root) => {
    const memory = path.join(root, "comp", "memory");
    const nonClaim = JSON.parse(
      readFileSync(path.join(memory, "NON-CLAIMS.json"), "utf8")
    )[0];
    const file = path.join(memory, "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.required_invariants = [nonClaim.id];
    writeJson(file, document);
  });
  assert.ok(failures(wrongKindRequired, "query-freshness").length >= 1);

  const snapshotDrift = stage("passing", (root) => {
    const source = path.join(root, "snapshot-source.txt");
    writeFileSync(source, "current\n");
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.snapshot = {
      source_path: "snapshot-source.txt",
      sha256: "sha256:" + sha256hex("different\n")
    };
    writeJson(file, address(record));
  });
  assert.ok(failures(snapshotDrift, "staleness").length >= 1);

  const snapshotMissing = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.snapshot = {
      source_path: "missing-snapshot-source.txt",
      sha256: `sha256:${"a".repeat(64)}`
    };
    writeJson(file, address(record));
  });
  assert.ok(failures(snapshotMissing, "staleness").length >= 1);

  const snapshotMalformedHash = stage("passing", (root) => {
    writeFileSync(path.join(root, "snapshot-source.txt"), "current\n");
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.snapshot = {
      source_path: "snapshot-source.txt",
      sha256: "sha256:not-a-hash"
    };
    writeJson(file, address(record));
  });
  assert.ok(failures(snapshotMalformedHash, "staleness").length >= 1);

  const unresolvedCommit = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.as_of = "a".repeat(40);
    writeJson(file, address(record));
  });
  assert.ok(failures(unresolvedCommit, "staleness").length >= 1);

  const gitRoot = stage("passing");
  execFileSync("git", ["init", "-q"], { cwd: gitRoot });
  execFileSync("git", ["config", "user.email", "audit@example.invalid"], { cwd: gitRoot });
  execFileSync("git", ["config", "user.name", "Audit Fixture"], { cwd: gitRoot });
  execFileSync("git", ["add", "."], { cwd: gitRoot });
  execFileSync("git", ["commit", "-qm", "first"], { cwd: gitRoot });
  const first = execFileSync("git", ["rev-parse", "HEAD"], { cwd: gitRoot, encoding: "utf8" }).trim();
  writeFileSync(path.join(gitRoot, "later.txt"), "later\n");
  execFileSync("git", ["add", "."], { cwd: gitRoot });
  execFileSync("git", ["commit", "-qm", "second"], { cwd: gitRoot });
  const contractFile = path.join(gitRoot, "comp", "memory", "CONTRACTS", "example.json");
  const contract = JSON.parse(readFileSync(contractFile, "utf8"));
  contract.as_of = first;
  writeJson(contractFile, address(contract));
  assert.ok(auditRoot(gitRoot).some((finding) =>
    finding.level === "WARN" && finding.check === "staleness" && finding.detail.includes("1 commit")
  ));

  const malformedJson = stage("passing", (root) => {
    writeFileSync(path.join(root, "comp", "memory", "CONTRACTS", "example.json"), "{\n");
  });
  const malformedResult = auditCli(malformedJson);
  assert.equal(malformedResult.status, 1, malformedResult.stdout + malformedResult.stderr);
  assert.match(malformedResult.stderr, /^AUDIT_ERROR:/);

  const malformedDerivedJson = stage("passing", (root) => {
    const derived = path.join(root, "comp", "memory", "DERIVED");
    mkdirSync(derived);
    writeFileSync(path.join(derived, "invalid.json"), "{\n");
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.queries[0].derived_from.file = "DERIVED/invalid.json";
    writeJson(file, document);
  });
  const malformedDerivedResult = auditCli(malformedDerivedJson);
  assert.equal(malformedDerivedResult.status, 2, malformedDerivedResult.stdout + malformedDerivedResult.stderr);
  assert.match(malformedDerivedResult.stdout, /"level":"FAIL","check":"query-freshness"/);
  assert.match(malformedDerivedResult.stdout, /invalid JSON/);
  assert.match(malformedDerivedResult.stdout, /audit: 1 FAIL, \d+ WARN/);

  const unavailableGit = stage("passing", (root) => {
    rmSync(path.join(root, "CURRENT-AUTHORITY.json"));
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.as_of = "a".repeat(40);
    writeJson(file, address(record));
  });
  const unavailableGitResult = auditCli(unavailableGit, { ...process.env, PATH: "" });
  assert.equal(unavailableGitResult.status, 1, unavailableGitResult.stdout + unavailableGitResult.stderr);
  assert.match(unavailableGitResult.stderr, /^AUDIT_ERROR:/);

  const nonObjectRecord = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    writeJson(file, null);
  });
  assert.ok(failures(nonObjectRecord, "taxonomy").length >= 1);

  const queryTraversal = stage("passing", (root) => {
    writeJson(path.join(root, "outside-query.json"), { status: "NORMATIVE-CURRENT" });
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.queries[0].derived_from.file = "../../outside-query.json";
    writeJson(file, document);
  });
  assert.ok(failures(queryTraversal, "query-freshness").length >= 1);

  const mirrorTraversal = stage("passing", (root) => {
    writeJson(path.join(root, "outside-mirror.json"), { value: "scripts/test-example.mjs" });
    const file = path.join(root, "comp", "memory", "CONTRACTS", "mirror.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.mirror_of = { file: "../../outside-mirror.json", pointer: "value" };
    writeJson(file, address(record));
  });
  assert.ok(failures(mirrorTraversal, "mirror-sync").length >= 1);

  const querySymlink = stage("passing", (root) => {
    const link = path.join(root, "comp", "memory", "CONTRACTS", "outside-query.json");
    outsideSymlink(link, JSON.stringify({ status: "NORMATIVE-CURRENT" }));
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.queries[0].derived_from.file = "CONTRACTS/outside-query.json";
    writeJson(file, document);
  });
  assert.ok(failures(querySymlink, "query-freshness").length >= 1);

  const memoryTarget = stage("passing");
  const memorySymlinkRoot = mkdtempSync(path.join(tmpdir(), "anm-audit-memory-link-"));
  roots.push(memorySymlinkRoot);
  mkdirSync(path.join(memorySymlinkRoot, "comp"));
  symlinkSync(
    path.join(memoryTarget, "comp", "memory"),
    path.join(memorySymlinkRoot, "comp", "memory"),
    "dir"
  );
  assert.ok(
    failures(memorySymlinkRoot, "three-representation").length >= 1,
    "a conventionally named memory symlink is never silently skipped"
  );
  const memorySymlinkCli = auditCli(memorySymlinkRoot);
  assert.equal(
    memorySymlinkCli.status,
    2,
    `public root audit rejects a memory symlink:\n${memorySymlinkCli.stdout}\n${memorySymlinkCli.stderr}`
  );
  assert.match(memorySymlinkCli.stdout, /memory directory must not be a symlink/);

  const primaryRecordSymlink = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "INVARIANTS.json");
    outsideSymlink(file, readFileSync(file, "utf8"));
  });
  assert.ok(
    failures(primaryRecordSymlink, "three-representation").length >= 1,
    "a primary record file cannot escape through a symlink"
  );
  assert.equal(auditCli(primaryRecordSymlink).status, 2);

  const mirrorSymlink = stage("passing", (root) => {
    const link = path.join(root, "comp", "memory", "CONTRACTS", "outside-mirror.json");
    outsideSymlink(link, JSON.stringify({ value: "scripts/test-example.mjs" }));
    const file = path.join(root, "comp", "memory", "CONTRACTS", "mirror.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.mirror_of = { file: "CONTRACTS/outside-mirror.json", pointer: "value" };
    writeJson(file, address(record));
  });
  assert.ok(failures(mirrorSymlink, "mirror-sync").length >= 1);

  const oracleSymlink = stage("passing", (root) => {
    outsideSymlink(path.join(root, "scripts", "test-example.mjs"), "process.exit(0);\n");
  });
  assert.ok(failures(oracleSymlink, "taxonomy").length >= 1);

  const snapshotSymlink = stage("passing", (root) => {
    outsideSymlink(path.join(root, "snapshot-source.txt"), "current\n");
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.snapshot = {
      source_path: "snapshot-source.txt",
      sha256: "sha256:" + sha256hex("current\n")
    };
    writeJson(file, address(record));
  });
  assert.ok(failures(snapshotSymlink, "staleness").length >= 1);

  const authoritySymlink = stage("passing", (root) => {
    const file = path.join(root, "authority-doc.md");
    outsideSymlink(file, readFileSync(file, "utf8"));
  });
  assert.ok(failures(authoritySymlink, "staleness").length >= 1);

  const unknownKind = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.kind = "invented-kind";
    writeJson(file, address(record));
  });
  assert.ok(failures(unknownKind, "taxonomy").length >= 1);

  const unknownStatus = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.status = "INVENTED-STATUS";
    writeJson(file, address(record));
  });
  assert.ok(failures(unknownStatus, "taxonomy").length >= 1);

  const missingContractLifecycle = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    delete record.lifecycle;
    writeJson(file, address(record));
  });
  assert.ok(failures(missingContractLifecycle, "taxonomy").length >= 1);

  const invalidContractLifecycle = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.lifecycle = "built-sometime";
    writeJson(file, address(record));
  });
  assert.ok(failures(invalidContractLifecycle, "taxonomy").length >= 1);

  for (const base of ["INVARIANTS", "NON-CLAIMS"]) {
    const missingLifecycle = stage("passing", (root) => {
      rewriteRecordList(root, base, (record) => {
        delete record.lifecycle;
      });
    });
    assert.ok(
      failures(missingLifecycle, "taxonomy").length >= 1,
      `${base} record requires lifecycle`
    );
  }

  const invalidDecider = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.decided_by = "model";
    writeJson(file, address(record));
  });
  assert.ok(failures(invalidDecider, "taxonomy").length >= 1);

  const decisionWithoutDecider = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.kind = "decision";
    delete record.decided_by;
    writeJson(file, address(record));
  });
  assert.ok(failures(decisionWithoutDecider, "taxonomy").length >= 1);

  const rulingWithoutDecider = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.authority = { ruling: "The public behavior is frozen." };
    delete record.decided_by;
    writeJson(file, address(record));
  });
  assert.ok(failures(rulingWithoutDecider, "taxonomy").length >= 1);

  for (const base of ["INVARIANTS", "NON-CLAIMS"]) {
    const missingStatement = stage("passing", (root) => {
      rewriteRecordList(root, base, (record) => {
        delete record.statement;
      });
    });
    assert.ok(
      failures(missingStatement, "taxonomy").length >= 1,
      `${base} record requires a statement`
    );
  }

  const missingContractTitle = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    delete record.title;
    writeJson(file, address(record));
  });
  assert.ok(failures(missingContractTitle, "taxonomy").length >= 1);

  const malformedEvidence = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.evidence = "not-an-array";
    writeJson(file, address(record));
  });
  assert.ok(failures(malformedEvidence, "taxonomy").length >= 1);

  for (const transition of [
    "   ",
    " implemented after review ",
    "name-the-test",
    "replace: later",
    "placeholder",
    "todo",
    "tbd",
    "implementation completes after review",
    "../future-oracle.mjs",
    "/absolute/future-oracle.mjs",
    "tests/../future-oracle.mjs",
    "tests/future-oracle.txt",
    "CON/future-oracle.mjs"
  ]) {
    const badPendingTransition = stage("passing", (root) => {
      const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
      const record = JSON.parse(readFileSync(file, "utf8"));
      record.status = "SPECIFIED-PENDING-IMPLEMENTATION";
      record.becomes_normative_when = transition;
      writeJson(file, address(record));
    });
    assert.ok(failures(badPendingTransition, "taxonomy").length >= 1);
  }

  const futurePendingOracle = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.status = "SPECIFIED-PENDING-IMPLEMENTATION";
    record.becomes_normative_when = "tests/future-contract-oracle.mjs";
    writeJson(file, address(record));
  });
  assert.equal(
    failures(futurePendingOracle, "taxonomy").length,
    0,
    "a contained portable future JavaScript oracle path may be absent while pending"
  );

  for (const successor of [
    42,
    "   ",
    "successor-id",
    " sha256:" + "a".repeat(64),
    "sha256:not-a-content-address"
  ]) {
    const badSuccessor = stage("passing", (root) => {
      const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
      const record = JSON.parse(readFileSync(file, "utf8"));
      record.status = "SUPERSEDED";
      record.superseded_by = successor;
      record.must_not_govern_new_work = true;
      writeJson(file, address(record));
    });
    assert.ok(failures(badSuccessor, "taxonomy").length >= 1);
  }

  const staleId = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    const record = JSON.parse(readFileSync(file, "utf8"));
    record.title = "changed after addressing";
    writeJson(file, record);
  });
  assert.ok(failures(staleId, "taxonomy").length >= 1);

  for (const oracle of ["NAME-THE-ORACLE-TEST-FILE", "scripts/missing.mjs"]) {
    const badOracle = stage("passing", (root) => {
      const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
      const record = JSON.parse(readFileSync(file, "utf8"));
      record.oracle.test = oracle;
      writeJson(file, address(record));
    });
    assert.ok(failures(badOracle, "taxonomy").length >= 1);
  }

  for (const derivedFrom of [undefined, "CONTRACTS/example.json#status", { file: "missing.json", pointer: "status" }]) {
    const badQuery = stage("passing", (root) => {
      const file = path.join(root, "comp", "memory", "comprehension-queries.json");
      const document = JSON.parse(readFileSync(file, "utf8"));
      if (derivedFrom === undefined) delete document.queries[0].derived_from;
      else document.queries[0].derived_from = derivedFrom;
      writeJson(file, document);
    });
    assert.ok(failures(badQuery, "query-freshness").length >= 1);
  }

  const unresolvedDerivedPointer = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "comprehension-queries.json");
    const document = JSON.parse(readFileSync(file, "utf8"));
    document.queries[0].derived_from = {
      file: "CONTRACTS/example.json",
      pointer: "missing.path"
    };
    writeJson(file, document);
  });
  assert.ok(failures(unresolvedDerivedPointer, "query-freshness").length >= 1);

  const renderDrift = stage("passing", (root) => {
    writeFileSync(path.join(root, "comp", "memory", "INVARIANTS.md"), "# stale\n");
  });
  assert.ok(failures(renderDrift, "three-representation").length >= 1);

  for (const [name, check] of [
    ["v-missing-rendered-invariants", "three-representation"],
    ["v-invariant-no-oracle", "three-representation"],
    ["v-normative-no-oracle", "taxonomy"],
    ["v-pending-no-becomes", "taxonomy"],
    ["v-superseded-loose", "taxonomy"],
    ["v-stale-query", "query-freshness"],
    ["v-mirror-drift", "mirror-sync"],
    ["v-dangling-anchor", "staleness"],
    ["v-authority-drift", "staleness"]
  ]) {
    const fixtureRoot = stage(name);
    assert.ok(failures(fixtureRoot, check).length >= 1, `${name} produces ${check} FAIL`);
    assert.deepEqual(
      [...new Set(
        auditRoot(fixtureRoot)
          .filter((finding) => finding.level === "FAIL")
          .map((finding) => finding.check)
      )],
      [check],
      `${name} isolates the ${check} family`
    );
  }
} finally {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false, `temporary audit root removed: ${root}`);
  }
}

console.log("test-audit: all assertions passed");
