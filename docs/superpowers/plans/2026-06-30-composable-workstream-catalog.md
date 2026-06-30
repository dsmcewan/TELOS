# Composable Workstream Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable `ai-forge` workstream catalog so patterns can assemble common module, guardrail, scorecard, audit, and design slices without duplicating workstream boilerplate.
**Architecture:** Create `ai-forge/workstreams/catalog.mjs` with validated factory functions that return the existing `pattern.mjs` workstream shape, add a focused catalog test file, wire the test into `ai-forge/package.json`, then migrate the serving pattern's schema, input guardrail, output guardrail, audit, and design slices to the catalog.
**Tech Stack:** Node.js ES modules, built-in `node:test`-free assertion style via `node:assert/strict`, built-in filesystem/path/process modules, existing `ai-forge` forge harness, npm scripts.

## Global Constraints

- Preserve the existing workstream contract consumed by `ai-forge/pattern.mjs`: `id`, `signer`, `lens`, `files`, `requirements`, `render`, `checks`, `findingsKey`, `finding`, plus optional `dependencies` and `nodeTest`.
- Keep the currently dirty Build Gate and Merkle DAG security fixes intact. Do not revert or rewrite files outside `ai-forge` and the new docs plan while implementing this feature.
- Use `apply_patch` for manual edits.
- Add no runtime dependencies.
- Keep generated catalog output deterministic.
- Reject absolute output file paths and parent traversal in catalog factory options.
- Every generated JavaScript module from a catalog factory must pass `node --check`.
- Every catalog-produced build workstream in tests must either provide a runnable `nodeTest` or intentionally opt out through an explicit factory option.
- Do not change CLI arguments, dossier format, trust protocol, or gate behavior.
- Keep serving behavior focused: migrate `schema`, `input-guardrail`, `output-guardrail`, `audit`, and `design`; leave `handler`, `ratelimit`, and `authz` as serving-specific hand-authored sources in this pass.

---

## Task 1: Add Catalog Regression Tests First

- [ ] Create `ai-forge/scripts/test-workstream-catalog.mjs`.

Use this structure:

```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { forge } from "../forge.mjs";
import { validatePattern } from "../pattern.mjs";
import {
  auditWorkstream,
  designWorkstream,
  guardrailWorkstream,
  moduleWorkstream,
  scorecardWorkstream,
} from "../workstreams/catalog.mjs";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-"));

function writeRendered(root, workstream, ctx = {}) {
  const rendered = workstream.render(ctx);
  for (const [rel, body] of Object.entries(rendered)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, body, "utf8");
  }
}

function runNodeTest(root, workstream) {
  assert.ok(workstream.nodeTest, `${workstream.id} exposes nodeTest`);
  execFileSync(workstream.nodeTest.cmd, workstream.nodeTest.args, {
    cwd: root,
    stdio: "pipe",
  });
}

function renderAndRun(workstream, ctx = {}) {
  const root = path.join(tmpRoot, workstream.id);
  writeRendered(root, workstream, ctx);
  for (const file of workstream.files) {
    assert.ok(existsSync(path.join(root, file)), `${file} rendered`);
  }
  runNodeTest(root, workstream);
  return root;
}

function toyContext() {
  return {
    dossier: {
      id: "catalog-toy",
      objective: "Exercise catalog factories",
      architecture: "Small generated modules with local selftests",
      acceptance: ["module, guardrail, scorecard, audit, and design slices converge"],
      non_goals: [],
      constraints: [],
      interfaces: [],
      risks: [],
      success_metrics: [],
    },
  };
}

function toyDossierMeta() {
  return {
    build_id: "catalog-toy",
    idea_id: "catalog-toy",
    use_case: "ai-architecture",
    objective: "Forge reusable catalog workstreams",
  };
}

function toyPattern({ broken = false } = {}) {
  const moduleSource = broken
    ? "export function answer(){ return 40; }\nif (process.argv.includes('--selftest')) { if (answer() !== 42) throw new Error('bad answer'); }\n"
    : "export function answer(){ return 42; }\nif (process.argv.includes('--selftest')) { if (answer() !== 42) throw new Error('bad answer'); }\n";

  const buildWorkstreams = [
    moduleWorkstream({
      id: "core",
      signer: "codex",
      file: "toy/core.mjs",
      requirements: "export a deterministic answer",
      source: moduleSource,
      needle: "answer",
      finding: "Core module did not satisfy its local invariant.",
    }),
    guardrailWorkstream({
      id: "guard",
      signer: "claude",
      dependencies: ["core"],
      file: "toy/guard.mjs",
      mode: "input",
      blockedTerms: ["secret"],
      finding: "Input guardrail did not reject blocked terms.",
    }),
    scorecardWorkstream({
      id: "scorecard",
      signer: "agy",
      dependencies: ["guard"],
      file: "toy/scorecard.mjs",
      thresholds: { accuracy: 0.9 },
      finding: "Scorecard threshold enforcement failed.",
    }),
    auditWorkstream({
      id: "audit",
      signer: "codex",
      dependencies: ["scorecard"],
      file: "toy/audit.mjs",
      finding: "Audit writer did not persist append-only events.",
    }),
  ];

  return {
    id: broken ? "catalog-toy-broken" : "catalog-toy",
    name: "Catalog Toy Pattern",
    description: "Exercises reusable catalog workstreams.",
    workstreams: [...buildWorkstreams, designWorkstream(buildWorkstreams)],
  };
}

async function main() {
  assert.throws(
    () =>
      moduleWorkstream({
        signer: "codex",
        file: "x.mjs",
      requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /id/
  );
  assert.throws(
    () =>
      moduleWorkstream({
        id: "bad",
        signer: "codex",
        file: path.resolve("x.mjs"),
      requirements: "bad",
        source: "export {};",
        finding: "bad",
      }),
    /relative/
  );
  assert.throws(
    () =>
      auditWorkstream({
        id: "bad-audit",
        signer: "codex",
        file: "../audit.mjs",
        finding: "bad",
      }),
    /relative/
  );

  const generated = [
    moduleWorkstream({
      id: "module",
      signer: "codex",
      file: "generated/module.mjs",
      requirements: "selftest passes",
      source:
        "export function value(){ return 7; }\nif (process.argv.includes('--selftest')) { if (value() !== 7) throw new Error('bad value'); }\n",
      needle: "value",
      finding: "Generated module selftest failed.",
    }),
    guardrailWorkstream({
      id: "input-guard",
      signer: "grok",
      file: "generated/input-guard.mjs",
      mode: "input",
      blockedTerms: ["password"],
      finding: "Input guardrail did not block password.",
    }),
    guardrailWorkstream({
      id: "output-guard",
      signer: "claude",
      file: "generated/output-guard.mjs",
      mode: "output",
      blockedTerms: ["secret"],
      finding: "Output guardrail did not redact secret.",
    }),
    scorecardWorkstream({
      id: "scorecard",
      signer: "agy",
      file: "generated/scorecard.mjs",
      thresholds: { quality: 0.8 },
      finding: "Scorecard selftest failed.",
    }),
    auditWorkstream({
      id: "audit",
      signer: "codex",
      file: "generated/audit.mjs",
      finding: "Audit selftest failed.",
    }),
  ];

  for (const workstream of generated) {
    const validation = validatePattern({ id: `single-${workstream.id}`, name: "single", workstreams: [workstream] });
    assert.equal(validation.ok, true, JSON.stringify(validation.errors || []));
    renderAndRun(workstream, toyContext());
  }

  const ok = await forge({
    pattern: toyPattern(),
    ctx: toyContext(),
    projectRoot: mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-ok-")),
    dossierMeta: toyDossierMeta(),
    maxCycles: 2,
  });
  assert.equal(ok.converged, true, "catalog toy pattern converges");

  const bad = await forge({
    pattern: toyPattern({ broken: true }),
    ctx: toyContext(),
    projectRoot: mkdtempSync(path.join(tmpdir(), "ai-forge-catalog-bad-")),
    dossierMeta: toyDossierMeta(),
    maxCycles: 1,
  });
  assert.equal(bad.converged, false, "broken catalog toy pattern fails closed");
  assert.notEqual(
    bad.cycles[0].ledger_status,
    "ready",
    `Expected ledger_status !== "ready"; got ${bad.cycles[0].ledger_status}`
  );

  const auditRoot = renderAndRun(
    auditWorkstream({
      id: "audit-read",
      signer: "codex",
      file: "generated/audit-read.mjs",
      finding: "Audit selftest failed.",
    }),
    toyContext()
  );
  const source = readFileSync(path.join(auditRoot, "generated/audit-read.mjs"), "utf8");
  assert.ok(source.includes("appendAudit"), "audit source exposes appendAudit");

  console.log("test-workstream-catalog: ok");
}

await main();
```

- [ ] Update `ai-forge/package.json` in the same patch so `npm test` tries to run the missing test before implementation:
  - Preserve every existing command already present in `scripts.check` and `scripts.test`.
  - Insert `node --check workstreams/catalog.mjs` in `scripts.check`.
  - Insert `node --check scripts/test-workstream-catalog.mjs` in `scripts.check`.
  - Insert `node scripts/test-workstream-catalog.mjs` in `scripts.test`, after `node scripts/test-eval-forge.mjs` and before the serving tests.

- [ ] Run `cd ai-forge; npm test`.

Expected result: it fails because `ai-forge/workstreams/catalog.mjs` does not exist yet. Keep the failure output in the work log.

---

## Task 2: Implement `ai-forge/workstreams/catalog.mjs`

- [ ] Add `ai-forge/workstreams/catalog.mjs` with these exports:

```js
import path from "node:path";

import { makeDesignWorkstream } from "./design.mjs";

export const designWorkstream = makeDesignWorkstream;

export function moduleWorkstream(options) {}
export function guardrailWorkstream(options) {}
export function scorecardWorkstream(options) {}
export function auditWorkstream(options) {}
```

- [ ] Implement shared validators:

```js
function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(value, name) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${name} must be an array of non-empty strings`);
  }
  return value;
}

function normalizeRequirements(value) {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.trim() !== "")) {
    return value.join("\n");
  }
  throw new Error("requirements must be a non-empty string or an array of non-empty strings");
}

function requireRelativeFile(file) {
  requireString(file, "file");
  if (path.isAbsolute(file)) {
    throw new Error("file must be relative to the project root");
  }
  const normalized = file.replaceAll("\\", "/");
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    throw new Error("file must be relative to the project root");
  }
  return normalized;
}
```

- [ ] Implement a shared `baseWorkstream` helper that:
  - Validates `id`, `signer`, `file`, `requirements`, `finding`, and each dependency.
  - Sets `lens` to `signer`.
  - Sets `files` to `[file]`.
  - Sets `requirements` to a string by calling `normalizeRequirements`.
  - Sets `checks` to a function returning at least `{ type: "file_exists", path: file }`.
  - Adds `{ type: "file_contains", path: file, needle }` to that returned array when `needle` is provided.
  - Sets `findingsKey` to the provided value or `"architecture_findings"`.
  - Sets `nodeTest` to `{ cmd: "node", args: [file, "--selftest"] }` unless `selftest` is exactly `false`.
  - Uses `render: () => ({ [file]: source })`.

- [ ] Implement `moduleWorkstream(options)`:
  - Required options: `id`, `signer`, `file`, `requirements`, `source`, `finding`.
  - Optional options: `dependencies`, `needle`, `findingsKey`, `selftest`.
  - It should validate source as a non-empty string and delegate to `baseWorkstream`.

- [ ] Implement `guardrailWorkstream(options)`:
  - Required options: `id`, `file`, `mode`, `finding`.
  - Optional options: `signer` defaulting to `"grok"`, `dependencies`, `blockedTerms` defaulting to `["password", "secret"]`, `maxBodyLen` defaulting to `256` for input mode, `findingsKey`.
  - `mode: "input"` generates a module exporting `checkInput(input)` and running a selftest that accepts harmless input, rejects a blocked term, and rejects an oversized JSON body.
  - `mode: "output"` generates a module exporting `redactOutput(output)` and running a selftest that redacts blocked terms case-insensitively.
  - The generated source must include `export function checkInput` for input mode and `export function redactOutput` for output mode.
  - The generated source must use a JSON-encoded `blockedTerms` array inside the module, not interpolation into a regular expression source string.
  - It should throw when mode is not `"input"` or `"output"`.

- [ ] Implement `scorecardWorkstream(options)`:
  - Required options: `id`, `file`, `thresholds`, `finding`.
  - Optional options: `signer` defaulting to `"agy"`, `dependencies`, `findingsKey`.
  - `thresholds` must be a non-empty object with values in `0..1` and at least one threshold greater than `0`, so the generated selftest can exercise a real below-threshold case.
  - Generated module exports `computeScorecard(scores)` and `assertThresholds(scores)`.
  - `computeScorecard` validates score keys against the configured threshold keys and returns `{ scores, passed }`.
  - `assertThresholds` throws on missing scores, unknown score keys, non-numeric scores, scores outside `0..1`, or scores below their threshold.
  - Selftest must cover a passing score set and at least one below-threshold score.

- [ ] Implement `auditWorkstream(options)`:
  - Required options: `id`, `file`, `finding`.
  - Optional options: `signer` defaulting to `"codex"`, `dependencies`, `findingsKey`.
  - Generated module exports `appendAudit(file, event)` that appends one JSON line with an ISO timestamp and event payload.
  - Selftest must create a temp directory, call `appendAudit`, read the file, parse the JSON line, and verify the event payload.

- [ ] Run `cd ai-forge; npm test`.

Expected result: catalog tests pass or expose precise source generation issues. Fix only `ai-forge/workstreams/catalog.mjs` and the test if the test expectation itself is inconsistent with the approved design.

---

## Task 3: Migrate Serving Pattern to Catalog Slices

- [ ] Edit `ai-forge/patterns/serving.mjs`.

- [ ] Replace the `makeDesignWorkstream` import with:

```js
import {
  auditWorkstream,
  designWorkstream,
  guardrailWorkstream,
  moduleWorkstream,
} from "../workstreams/catalog.mjs";
```

- [ ] Keep `HANDLER_SRC`, `RATELIMIT_SRC`, and `AUTHZ_SRC` in `serving.mjs`.

- [ ] Keep a small local helper only for the serving-specific hand-authored slices:

```js
function localServingWorkstream({ id, signer, dependencies = [], file, requirements, source, needle, finding }) {
  return {
    id,
    signer,
    lens: signer,
    dependencies,
    files: [file],
    requirements,
    render: () => ({ [file]: source }),
    checks: () => [
      { type: "file_exists", path: file },
      ...(needle ? [{ type: "file_contains", path: file, needle }] : []),
    ],
    nodeTest: { cmd: "node", args: [file, "--selftest"] },
    findingsKey: "architecture_findings",
    finding,
  };
}
```

- [ ] Replace the existing `schema` workstream with `moduleWorkstream` using current `SCHEMA_SRC`, file `serving/schema.mjs`, needle `export function validate`, and current finding text.

- [ ] Replace the existing `input-guardrail` workstream with `guardrailWorkstream`:

```js
guardrailWorkstream({
  id: "input-guardrail",
  signer: "grok",
  dependencies: ["schema"],
  file: "serving/guard-in.mjs",
  mode: "input",
  blockedTerms: ["<script", "drop table", "ignore previous"],
  maxBodyLen: 256,
  finding: "Input guardrail rejects oversized and denylisted input (fail-closed).",
})
```

- [ ] Keep `handler`, `ratelimit`, and `authz` as `localServingWorkstream` calls with their current source strings, dependencies, requirements, needles, and finding text.

- [ ] Replace the existing `output-guardrail` workstream with `guardrailWorkstream`:

```js
guardrailWorkstream({
  id: "output-guardrail",
  signer: "grok",
  dependencies: ["handler"],
  file: "serving/guard-out.mjs",
  mode: "output",
  blockedTerms: ["password", "123-45-6789"],
  finding: "Output guardrail redacts blocked tokens and passes clean output unchanged.",
})
```

- [ ] Replace the existing `audit` workstream with `auditWorkstream`:

```js
auditWorkstream({
  id: "audit",
  signer: "codex",
  dependencies: ["output-guardrail", "ratelimit", "authz"],
  file: "serving/audit.mjs",
  finding: "Audit trail did not persist structured events.",
})
```

- [ ] Replace `makeDesignWorkstream(servingBuildWorkstreams)` with `designWorkstream(servingBuildWorkstreams)`.

- [ ] Remove unused `GUARD_IN_SRC`, `GUARD_OUT_SRC`, `AUDIT_SRC`, and the old generic `mod` helper once the compiler confirms they are unused.

- [ ] Run `cd ai-forge; npm test`.

Expected result: all `ai-forge` tests pass, including existing serving forge regression tests.

---

## Task 4: Verify Cross-Package Safety

- [ ] Run `cd ai-forge; npm test`.
- [ ] Run `cd build-gate; npm test`.
- [ ] Run `cd merkle-dag; npm test`.
- [ ] Run `git diff --check`.

Expected result: all commands pass. `git diff --check` may report the repository's existing CRLF warnings only; it must not report trailing whitespace or conflict markers.

- [ ] Inspect `git diff --stat` and confirm changed feature files are limited to:
  - `ai-forge/package.json`
  - `ai-forge/patterns/serving.mjs`
  - `ai-forge/scripts/test-workstream-catalog.mjs`
  - `ai-forge/workstreams/catalog.mjs`
  - `docs/superpowers/plans/2026-06-30-composable-workstream-catalog.md`

The pre-existing dirty security-fix files may remain in the working tree:

- `build-gate/examples/convergence-demo/dossier.json`
- `build-gate/gate.mjs`
- `build-gate/scripts/stress-tests.mjs`
- `build-gate/scripts/test-gate.mjs`
- `build-gate/scripts/test-trust.mjs`
- `merkle-dag/ledger-gate.mjs`
- `merkle-dag/scripts/test-ledger-gate.mjs`

---

## Task 5: Final Review Notes

- [ ] Summarize the catalog exports and which serving workstreams now use them.
- [ ] Report the exact verification commands and whether each passed.
- [ ] Call out that `handler`, `ratelimit`, and `authz` remain serving-local by design.
- [ ] Do not claim the feature is complete until Task 4 passes in the current workspace.
