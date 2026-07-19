#!/usr/bin/env node
// The inheritance proof: the plugin audits, gates, and verifies ITSELF.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { packageBoundaryProblems } from "../scripts/lib/record.mjs";
import { symlinkOrSkip } from "./lib/symlink.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

// 1. the package and every script satisfy the zero-dependency/import boundary.
assert.deepEqual(packageBoundaryProblems(ROOT), []);
const packageMetadata = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf8")
);
const syntaxCheckCommands = packageMetadata.scripts.check.split(/\s*&&\s*/);
assert.ok(
  syntaxCheckCommands.includes(
    "node --check scripts/lib/vendor/es-module-lexer.mjs"
  ),
  "npm run check must syntax-check the vendored executable module"
);

// 2. self-audit: the public whole-root audit is clean.
const audit = spawnSync(process.execPath, [path.join(ROOT, "scripts", "audit.mjs"), ROOT], { encoding: "utf8" });
assert.equal(audit.status, 0, `whole-root self-audit:\n${audit.stdout}\n${audit.stderr}`);

// 3. self-gate: the example answers GRANT; a flipped answer DENIES
const gate = (answers) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "gate.mjs"),
  path.join(ROOT, "memory", "comprehension-queries.json"), answers,
  "--authority", path.join(ROOT, "CURRENT-AUTHORITY.json")], { encoding: "utf8" });
assert.equal(gate(path.join(ROOT, "memory", "answers-example.json")).status, 0, "self-gate GRANTED");
// negative: flip one answer in a temp copy
const a = JSON.parse(readFileSync(path.join(ROOT, "memory", "answers-example.json"), "utf8"));
a.answers[Object.keys(a.answers)[0]] = "WRONG";
const tmp = path.join(HERE, "tmp-neg-answers.json");
writeFileSync(tmp, JSON.stringify(a));
try { assert.equal(gate(tmp).status, 2, "flipped answer DENIED"); } finally { rmSync(tmp); }

// 4. self-verify
const v = spawnSync(process.execPath, [path.join(ROOT, "scripts", "verify.mjs"), path.join(ROOT, "verify-map.json")], { encoding: "utf8" });
assert.equal(v.status, 0, `self-verify green:\n${v.stdout}\n${v.stderr}`);

// 5. the same boundary check fails closed in both direct dogfood and the
// terminating contract oracle, without recursively spawning itself.
const fakeRoot = mkdtempSync(path.join(tmpdir(), "anm-dogfood-boundary-"));
const fakeOutsideRoot = mkdtempSync(
  path.join(tmpdir(), "anm-dogfood-boundary-outside-")
);
try {
  for (const directory of [
    "scripts",
    path.join("scripts", "nested"),
    "tests",
    path.join("memory", "CONTRACTS")
  ]) {
    mkdirSync(path.join(fakeRoot, directory), { recursive: true });
  }
  writeFileSync(
    path.join(fakeRoot, "package.json"),
    JSON.stringify({
      dependencies: {},
      optionalDependencies: { hiddenRuntime: "1.0.0" }
    })
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "runtime.js"),
    'import "external-runtime";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "unverifiable.mjs"),
    "await import(runtimeSelected);\n"
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "grammar.mjs"),
    [
      'import source moduleValue from "external-source";',
      'const methods = { import(value = "method-default") { return value; } };'
    ].join("\n")
  );
  writeFileSync(path.join(fakeRoot, "inside-root.mjs"), "export {};\n");
  writeFileSync(path.join(fakeRoot, "scripts", "local.mjs"), "export {};\n");
  writeFileSync(
    path.join(fakeRoot, "scripts", "nested", "legitimate-parent.mjs"),
    'import "../local.mjs";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "query-control.mjs"),
    'import "../inside-root.mjs?../../../../traversal-looking";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "lexical-escape.mjs"),
    'import "../../outside-lexical.mjs";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "percent-normalized-escape.mjs"),
    'import "./%2e%2e/%2e%2e/outside-percent.mjs";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "mixed-percent-dot-escape.mjs"),
    'import "./.%2e/%2e./outside-mixed.mjs";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "invalid-dot-prefix.mjs"),
    'import ".external";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "invalid-three-dot-prefix.mjs"),
    'import ".../external";\n'
  );
  writeFileSync(
    path.join(fakeRoot, "scripts", "url-conversion-error.mjs"),
    'import "./encoded%2Fslash.mjs";\n'
  );
  writeFileSync(
    path.join(fakeOutsideRoot, "external-file.mjs"),
    "export {};\n"
  );
  mkdirSync(path.join(fakeOutsideRoot, "external-directory"));
  writeFileSync(
    path.join(fakeOutsideRoot, "external-directory", "existing.mjs"),
    "export {};\n"
  );
  const fakeFileLinkCreated = symlinkOrSkip(
    path.join(fakeOutsideRoot, "external-file.mjs"),
    path.join(fakeRoot, "linked-file.mjs"),
    { type: "file", label: "dogfood external file target" }
  );
  const fakeDirectoryLinkCreated = symlinkOrSkip(
    path.join(fakeOutsideRoot, "external-directory"),
    path.join(fakeRoot, "linked-directory"),
    { type: "dir", label: "dogfood external directory target" }
  );
  if (process.platform === "win32") {
    assert.equal(
      fakeDirectoryLinkCreated,
      true,
      "native Windows directory-junction oracle coverage must run"
    );
  }
  if (fakeFileLinkCreated) {
    writeFileSync(
      path.join(fakeRoot, "scripts", "file-link-escape.mjs"),
      'import "../linked-file.mjs";\n'
    );
  }
  if (fakeDirectoryLinkCreated) {
    writeFileSync(
      path.join(fakeRoot, "scripts", "directory-link-escape.mjs"),
      'import "../linked-directory/missing/external.mjs";\n'
    );
  }
  writeFileSync(
    path.join(fakeRoot, "memory", "CONTRACTS", "plugin.json"),
    JSON.stringify({ zero_dependencies: true })
  );
  for (const test of [
    "test-lib.mjs",
    "test-audit.mjs",
    "test-gate.mjs",
    "test-init.mjs",
    "test-verify.mjs"
  ]) {
    writeFileSync(path.join(fakeRoot, "tests", test), "process.exit(0);\n");
  }

  const fakeProblems = packageBoundaryProblems(fakeRoot);
  const terminatingOracle = spawnSync(process.execPath, [
    path.join(ROOT, "tests", "oracle-plugin-contract.mjs"),
    "--root",
    fakeRoot
  ], {
    encoding: "utf8",
    timeout: 10_000
  });
  const hasDirectBoundaryFinding = (file, detail) =>
    fakeProblems.some((problem) =>
      problem.startsWith(`${path.join("scripts", file)}:`)
      && problem.includes(detail)
    );
  const hasOracleBoundaryFinding = (file, detail) =>
    terminatingOracle.stderr.includes(
      `oracle-plugin-contract: ${path.join("scripts", file)}: ${detail}`
    );
  assert.deepEqual(
    {
      directJsImportRejected: fakeProblems.some((problem) =>
        problem.includes("non-portable import external-runtime")
      ),
      directOptionalDependencyRejected: fakeProblems.some((problem) =>
        problem.includes("optionalDependencies")
      ),
      directUnverifiableDynamicRejected: fakeProblems.some((problem) =>
        problem.includes("cannot statically verify dynamic import")
      ),
      directSourcePhaseRejected: fakeProblems.some((problem) =>
        problem.includes("non-portable import external-source")
      ),
      directLexicalEscapeRejected: hasDirectBoundaryFinding(
        "lexical-escape.mjs",
        "relative import escapes plugin root"
      ),
      directPercentNormalizedEscapeRejected: hasDirectBoundaryFinding(
        "percent-normalized-escape.mjs",
        "relative import escapes plugin root"
      ),
      directMixedPercentDotEscapeRejected: hasDirectBoundaryFinding(
        "mixed-percent-dot-escape.mjs",
        "relative import escapes plugin root"
      ),
      directInvalidDotPrefixRejected: hasDirectBoundaryFinding(
        "invalid-dot-prefix.mjs",
        "non-portable import .external"
      ),
      directInvalidThreeDotPrefixRejected: hasDirectBoundaryFinding(
        "invalid-three-dot-prefix.mjs",
        "non-portable import .../external"
      ),
      directUrlConversionErrorRejected: hasDirectBoundaryFinding(
        "url-conversion-error.mjs",
        "cannot resolve relative import ./encoded%2Fslash.mjs"
      ),
      directContainedParentAccepted: !fakeProblems.some((problem) =>
        problem.startsWith(
          `${path.join("scripts", "nested", "legitimate-parent.mjs")}:`
        )
      ),
      directTraversalLookingQueryAccepted: !fakeProblems.some((problem) =>
        problem.startsWith(`${path.join("scripts", "query-control.mjs")}:`)
      ),
      methodNameNotRejected: !fakeProblems.some((problem) =>
        problem.startsWith(
          `${path.join("scripts", "grammar.mjs")}: cannot statically verify`
        )
      ),
      oracleStatus: terminatingOracle.status,
      oracleSignal: terminatingOracle.signal,
      oracleSpawnError: terminatingOracle.error?.message || null,
      oracleReportedBoundary: /external-runtime|optionalDependencies/.test(
        terminatingOracle.stderr
      ),
      oracleReportedUnverifiableDynamic:
        /cannot statically verify dynamic import/.test(terminatingOracle.stderr),
      oracleReportedSourcePhase: /external-source/.test(terminatingOracle.stderr),
      oracleReportedLexicalEscape: hasOracleBoundaryFinding(
        "lexical-escape.mjs",
        "relative import escapes plugin root"
      ),
      oracleReportedPercentNormalizedEscape: hasOracleBoundaryFinding(
        "percent-normalized-escape.mjs",
        "relative import escapes plugin root"
      ),
      oracleReportedMixedPercentDotEscape: hasOracleBoundaryFinding(
        "mixed-percent-dot-escape.mjs",
        "relative import escapes plugin root"
      ),
      oracleReportedInvalidDotPrefix: hasOracleBoundaryFinding(
        "invalid-dot-prefix.mjs",
        "non-portable import .external"
      ),
      oracleReportedInvalidThreeDotPrefix: hasOracleBoundaryFinding(
        "invalid-three-dot-prefix.mjs",
        "non-portable import .../external"
      ),
      oracleReportedUrlConversionError: hasOracleBoundaryFinding(
        "url-conversion-error.mjs",
        "cannot resolve relative import ./encoded%2Fslash.mjs"
      ),
      oracleAcceptedContainedParent: !terminatingOracle.stderr.includes(
        `oracle-plugin-contract: ${path.join(
          "scripts",
          "nested",
          "legitimate-parent.mjs"
        )}:`
      ),
      oracleAcceptedTraversalLookingQuery: !terminatingOracle.stderr.includes(
        `oracle-plugin-contract: ${path.join("scripts", "query-control.mjs")}:`
      ),
      oracleRemainedTerminating: /6\/7 checks passed/.test(terminatingOracle.stdout)
    },
    {
      directJsImportRejected: true,
      directOptionalDependencyRejected: true,
      directUnverifiableDynamicRejected: true,
      directSourcePhaseRejected: true,
      directLexicalEscapeRejected: true,
      directPercentNormalizedEscapeRejected: true,
      directMixedPercentDotEscapeRejected: true,
      directInvalidDotPrefixRejected: true,
      directInvalidThreeDotPrefixRejected: true,
      directUrlConversionErrorRejected: true,
      directContainedParentAccepted: true,
      directTraversalLookingQueryAccepted: true,
      methodNameNotRejected: true,
      oracleStatus: 1,
      oracleSignal: null,
      oracleSpawnError: null,
      oracleReportedBoundary: true,
      oracleReportedUnverifiableDynamic: true,
      oracleReportedSourcePhase: true,
      oracleReportedLexicalEscape: true,
      oracleReportedPercentNormalizedEscape: true,
      oracleReportedMixedPercentDotEscape: true,
      oracleReportedInvalidDotPrefix: true,
      oracleReportedInvalidThreeDotPrefix: true,
      oracleReportedUrlConversionError: true,
      oracleAcceptedContainedParent: true,
      oracleAcceptedTraversalLookingQuery: true,
      oracleRemainedTerminating: true
    }
  );
  if (fakeFileLinkCreated) {
    assert.deepEqual(
      {
        directFileLinkEscapeRejected: hasDirectBoundaryFinding(
          "file-link-escape.mjs",
          "relative import escapes plugin root through filesystem link"
        ),
        oracleReportedFileLinkEscape: hasOracleBoundaryFinding(
          "file-link-escape.mjs",
          "relative import escapes plugin root through filesystem link"
        )
      },
      {
        directFileLinkEscapeRejected: true,
        oracleReportedFileLinkEscape: true
      },
      "direct dogfood and the terminating oracle must reject an external file link"
    );
  }
  if (fakeDirectoryLinkCreated) {
    assert.deepEqual(
      {
        directDirectoryLinkEscapeRejected: hasDirectBoundaryFinding(
          "directory-link-escape.mjs",
          "relative import escapes plugin root through filesystem link"
        ),
        oracleReportedDirectoryLinkEscape: hasOracleBoundaryFinding(
          "directory-link-escape.mjs",
          "relative import escapes plugin root through filesystem link"
        )
      },
      {
        directDirectoryLinkEscapeRejected: true,
        oracleReportedDirectoryLinkEscape: true
      },
      "direct dogfood and the terminating oracle must reject an external directory link or junction"
    );
  }
} finally {
  rmSync(fakeRoot, { recursive: true, force: true });
  rmSync(fakeOutsideRoot, { recursive: true, force: true });
}

console.log("test-dogfood: all assertions passed");
