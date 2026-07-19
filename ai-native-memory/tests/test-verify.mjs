#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { symlinkOrSkip } from "./lib/symlink.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "verify");
const V = path.join(HERE, "..", "scripts", "verify.mjs");
const PLUGIN_ORACLE = path.join(HERE, "oracle-plugin-contract.mjs");
const run = (fixture, prepare = () => {}) => {
  const temporary = mkdtempSync(path.join(tmpdir(), `anm-verify-${fixture}-`));
  const staged = path.join(temporary, "fixture");
  try {
    cpSync(path.join(FX, fixture), staged, { recursive: true });
    const recordSet = path.join(staged, "record-set");
    if (existsSync(recordSet)) renameSync(recordSet, path.join(staged, "memory"));
    prepare({ staged, temporary });
    return spawnSync(
      process.execPath,
      [V, path.join(staged, "verify-map.json")],
      { encoding: "utf8" }
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
const output = (result) => `${result.stdout || ""}${result.stderr || ""}`;
const findings = (result) => (result.stdout || "")
  .split("\n")
  .filter((line) => line.startsWith("{"))
  .map((line) => JSON.parse(line));
const entry = (contract = "memory/CONTRACTS/contract.json", cwd) => ({
  contract,
  oracle: "oracle-pass.mjs",
  ...(cwd === undefined ? {} : { cwd })
});
const writeMap = (staged, map) => {
  writeFileSync(path.join(staged, "verify-map.json"), `${JSON.stringify(map, null, 2)}\n`);
};
const selfTerminationDiagnostic = process.platform === "win32"
  ? /exited 1/
  : /signal SIGTERM/;
assert.equal(run("passing").status, 0, "declared oracle exits 0");
assert.equal(run("failing").status, 2, "declared failing oracle exits 2");
assert.equal(run("missing").status, 2, "missing contract exits 2");
assert.equal(run("empty").status, 2, "empty map cannot certify");
assert.equal(run("mismatch").status, 2, "map cannot substitute another oracle");
assert.equal(run("duplicate").status, 2, "duplicate contract entry rejected");
assert.equal(run("uncovered").status, 2, "uncovered normative contract rejected");
assert.equal(run("cwd-escape").status, 2, "oracle cwd cannot escape repository root");

let contractSymlinkCreated;
const contractSymlinkEscape = run("passing", ({ staged, temporary }) => {
  const contract = path.join(staged, "memory", "CONTRACTS", "contract.json");
  const outside = path.join(temporary, "outside-contract.json");
  cpSync(contract, outside);
  rmSync(contract);
  contractSymlinkCreated = symlinkOrSkip(
    outside,
    contract,
    { label: "verify contract escape" }
  );
});

let oracleSymlinkCreated;
const oracleSymlinkEscape = run("passing", ({ staged, temporary }) => {
  const oracle = path.join(staged, "oracle-pass.mjs");
  const outside = path.join(temporary, "outside-oracle.mjs");
  cpSync(oracle, outside);
  rmSync(oracle);
  oracleSymlinkCreated = symlinkOrSkip(
    outside,
    oracle,
    { label: "verify oracle escape" }
  );
});

let cwdSymlinkCreated;
const cwdSymlinkEscape = run("passing", ({ staged, temporary }) => {
  const outside = path.join(temporary, "outside-cwd");
  mkdirSync(outside);
  cwdSymlinkCreated = symlinkOrSkip(
    outside,
    path.join(staged, "cwd-link"),
    { type: "dir", label: "verify cwd escape" }
  );
  writeMap(staged, [entry(undefined, "cwd-link")]);
});

let hiddenMemorySymlinkCreated;
const hiddenMemorySymlink = run("passing", ({ staged, temporary }) => {
  const outsideMemory = path.join(temporary, "outside-memory");
  const outsideContracts = path.join(outsideMemory, "CONTRACTS");
  mkdirSync(outsideContracts, { recursive: true });
  cpSync(
    path.join(staged, "memory", "CONTRACTS", "contract.json"),
    path.join(outsideContracts, "hidden.json")
  );
  mkdirSync(path.join(staged, "hidden"));
  hiddenMemorySymlinkCreated = symlinkOrSkip(
    outsideMemory,
    path.join(staged, "hidden", "memory"),
    { type: "dir", label: "verify hidden memory escape" }
  );
});

let hiddenContractSymlinkCreated;
const hiddenContractSymlink = run("passing", ({ staged, temporary }) => {
  const outside = path.join(temporary, "outside-contract.json");
  cpSync(path.join(staged, "memory", "CONTRACTS", "contract.json"), outside);
  const contracts = path.join(staged, "hidden", "memory", "CONTRACTS");
  mkdirSync(contracts, { recursive: true });
  hiddenContractSymlinkCreated = symlinkOrSkip(
    outside,
    path.join(contracts, "hidden.json"),
    { label: "verify hidden contract escape" }
  );
});

const dotSegmentDuplicate = run("passing", ({ staged }) => {
  writeMap(staged, [
    entry(),
    entry("memory/CONTRACTS/./contract.json")
  ]);
});

let symlinkAliasCreated;
const symlinkAliasDuplicate = run("passing", ({ staged }) => {
  symlinkAliasCreated = symlinkOrSkip(
    "contract.json",
    path.join(staged, "memory", "CONTRACTS", "alias.json"),
    { label: "verify canonical alias duplicate" }
  );
  writeMap(staged, [
    entry(),
    entry("memory/CONTRACTS/alias.json")
  ]);
});

const falsyCwdStatuses = {};
for (const cwd of ["", false, null, 0]) {
  const result = run("passing", ({ staged }) => writeMap(staged, [entry(undefined, cwd)]));
  falsyCwdStatuses[JSON.stringify(cwd)] = result.status;
}
for (const [label, created, result] of [
  ["contract symlink escape", contractSymlinkCreated, contractSymlinkEscape],
  ["oracle symlink escape", oracleSymlinkCreated, oracleSymlinkEscape],
  ["cwd symlink escape", cwdSymlinkCreated, cwdSymlinkEscape],
  ["hidden memory symlink", hiddenMemorySymlinkCreated, hiddenMemorySymlink],
  ["hidden contract symlink", hiddenContractSymlinkCreated, hiddenContractSymlink],
  ["symlink alias duplicate", symlinkAliasCreated, symlinkAliasDuplicate]
]) {
  if (created) assert.equal(result.status, 2, label);
}
assert.deepEqual({
  dotSegmentDuplicate: dotSegmentDuplicate.status,
  falsyCwdStatuses
}, {
  dotSegmentDuplicate: 2,
  falsyCwdStatuses: {
    "\"\"": 2,
    "false": 2,
    "null": 2,
    "0": 2
  }
}, "physical containment, canonical identity, and provided cwd validation");

let duplicateOrderingSymlinkCreated;
const duplicateOrdering = run("passing", ({ staged }) => {
  const contracts = path.join(staged, "memory", "CONTRACTS");
  cpSync(path.join(contracts, "contract.json"), path.join(contracts, "second.json"));
  duplicateOrderingSymlinkCreated = symlinkOrSkip(
    "second.json",
    path.join(contracts, "second-alias.json"),
    { label: "verify duplicate finding order" }
  );
  writeMap(staged, [
    entry(undefined, false),
    entry("memory/CONTRACTS/./contract.json"),
    entry("memory/CONTRACTS/second.json"),
    entry("memory/CONTRACTS/second-alias.json")
  ]);
  const map = JSON.parse(readFileSync(path.join(staged, "verify-map.json"), "utf8"));
  map[2].oracle = "missing-oracle.mjs";
  writeMap(staged, map);
});
if (duplicateOrderingSymlinkCreated) {
  assert.deepEqual(
    findings(duplicateOrdering)
      .filter((item) => item.detail === "duplicate contract entry")
      .map((item) => item.path),
    [
      "memory/CONTRACTS/./contract.json",
      "memory/CONTRACTS/second-alias.json"
    ],
    "canonical duplicates are findings before oracle and cwd validation"
  );
}

const contractDirectory = run("passing", ({ staged }) => {
  writeMap(staged, [entry("memory/CONTRACTS")]);
});
assert.equal(contractDirectory.status, 2, "contract must be a file");
assert.match(output(contractDirectory), /contract path must be a file/, "contract type diagnostic");

const oracleDirectory = run("passing", ({ staged }) => {
  writeMap(staged, [{
    contract: "memory/CONTRACTS/contract.json",
    oracle: "memory"
  }]);
  const contract = path.join(staged, "memory", "CONTRACTS", "contract.json");
  const value = JSON.parse(readFileSync(contract, "utf8"));
  value.oracle.test = "memory";
  writeFileSync(contract, `${JSON.stringify(value, null, 2)}\n`);
});
assert.equal(oracleDirectory.status, 2, "oracle must be a file");
assert.match(output(oracleDirectory), /oracle path must be a file/, "oracle type diagnostic");

const cwdFile = run("passing", ({ staged }) => {
  writeMap(staged, [entry(undefined, "oracle-pass.mjs")]);
});
assert.equal(cwdFile.status, 2, "cwd must be a directory");
assert.match(output(cwdFile), /cwd path must be a directory/, "cwd type diagnostic");

const signaledOracle = run("passing", ({ staged }) => {
  writeFileSync(
    path.join(staged, "oracle-pass.mjs"),
    'process.kill(process.pid, "SIGTERM");\n'
  );
});
assert.equal(signaledOracle.status, 2, "signaled oracle is a finding");
assert.match(
  output(signaledOracle),
  selfTerminationDiagnostic,
  "oracle termination diagnostic"
);

const temporaryOracle = mkdtempSync(path.join(tmpdir(), "anm-plugin-oracle-"));
try {
  mkdirSync(path.join(temporaryOracle, "memory", "CONTRACTS"), { recursive: true });
  mkdirSync(path.join(temporaryOracle, "scripts"), { recursive: true });
  mkdirSync(path.join(temporaryOracle, "tests"), { recursive: true });
  writeFileSync(
    path.join(temporaryOracle, "memory", "CONTRACTS", "plugin.json"),
    `${JSON.stringify({ zero_dependencies: true }, null, 2)}\n`
  );
  writeFileSync(
    path.join(temporaryOracle, "scripts", "portable.mjs"),
    'import "node:path";\n'
  );
  for (const test of [
    "test-lib.mjs",
    "test-audit.mjs",
    "test-gate.mjs",
    "test-init.mjs",
    "test-verify.mjs"
  ]) {
    writeFileSync(path.join(temporaryOracle, "tests", test), "process.exit(0);\n");
  }
  writeFileSync(
    path.join(temporaryOracle, "tests", "test-lib.mjs"),
    'process.kill(process.pid, "SIGTERM");\n'
  );
  writeFileSync(
    path.join(temporaryOracle, "package.json"),
    `${JSON.stringify({ dependencies: {} }, null, 2)}\n`
  );
  const result = spawnSync(
    process.execPath,
    [PLUGIN_ORACLE, "--root", temporaryOracle],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 1, "plugin oracle preserves failing exit semantics");
  assert.match(
    output(result),
    process.platform === "win32"
      ? /test-lib\.mjs.*exited 1/
      : /test-lib\.mjs.*signal SIGTERM/,
    "plugin oracle termination diagnostic"
  );

  writeFileSync(
    path.join(temporaryOracle, "tests", "test-lib.mjs"),
    "process.exit(0);\n"
  );
  writeFileSync(
    path.join(temporaryOracle, "package.json"),
    `${JSON.stringify({ dependencies: { surprise: "1.0.0" } }, null, 2)}\n`
  );
  const dependencyResult = spawnSync(
    process.execPath,
    [PLUGIN_ORACLE, "--root", temporaryOracle],
    { encoding: "utf8" }
  );
  assert.equal(dependencyResult.status, 1, "runtime dependency fails terminating oracle");
  assert.match(output(dependencyResult), /runtime dependencies/, "dependency failure diagnostic");

  writeFileSync(
    path.join(temporaryOracle, "package.json"),
    `${JSON.stringify({ dependencies: {} }, null, 2)}\n`
  );
  const cleanResult = spawnSync(
    process.execPath,
    [PLUGIN_ORACLE, "--root", temporaryOracle],
    { encoding: "utf8" }
  );
  assert.equal(cleanResult.status, 0, output(cleanResult));
} finally {
  rmSync(temporaryOracle, { recursive: true, force: true });
}
console.log("test-verify: all assertions passed");
