#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
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
const roots = [];

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function address(record) {
  const copy = { ...record };
  copy.id = contentAddress(copy);
  return copy;
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

  const nonObjectRecord = stage("passing", (root) => {
    const file = path.join(root, "comp", "memory", "CONTRACTS", "example.json");
    writeJson(file, null);
  });
  assert.ok(failures(nonObjectRecord, "taxonomy").length >= 1);

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
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}

console.log("test-audit: all assertions passed");
