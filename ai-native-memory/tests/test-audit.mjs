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
  for (const base of ["INVARIANTS", "NON-CLAIMS"]) {
    const file = path.join(memory, `${base}.json`);
    let records;
    try {
      records = JSON.parse(readFileSync(file, "utf8")).map(address);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
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
  mkdirSync(path.join(root, "scripts"), { recursive: true });
  writeFileSync(path.join(root, "scripts", "test-readonly.mjs"), "process.exit(0);\n");
  writeFileSync(path.join(root, "scripts", "test-example.mjs"), "process.exit(0);\n");
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

  for (const transition of [
    "   ",
    " implemented after review ",
    "name-the-test",
    "replace: later",
    "placeholder",
    "todo",
    "tbd"
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

  const renderDrift = stage("passing", (root) => {
    writeFileSync(path.join(root, "comp", "memory", "INVARIANTS.md"), "# stale\n");
  });
  assert.ok(failures(renderDrift, "three-representation").length >= 1);

  for (const [name, check] of [
    ["v-md-only-invariants", "three-representation"],
    ["v-invariant-no-oracle", "three-representation"],
    ["v-normative-no-oracle", "taxonomy"],
    ["v-pending-no-becomes", "taxonomy"],
    ["v-superseded-loose", "taxonomy"],
    ["v-stale-query", "query-freshness"],
    ["v-mirror-drift", "mirror-sync"],
    ["v-dangling-anchor", "staleness"],
    ["v-authority-drift", "staleness"]
  ]) {
    assert.ok(failures(stage(name), check).length >= 1, `${name} produces ${check} FAIL`);
  }
} finally {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false, `temporary audit root removed: ${root}`);
  }
}

console.log("test-audit: all assertions passed");
