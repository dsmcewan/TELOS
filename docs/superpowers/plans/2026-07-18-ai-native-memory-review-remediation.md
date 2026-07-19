# ai-native-memory Final-Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `ai-native-memory` plugin satisfy its governing specification, binding Global Constraints, public dogfood acceptance, and final whole-branch review.

**Architecture:** Keep the plugin zero-dependency and host-agnostic. Put shared record identity, rendering, and path-safety primitives in `scripts/lib/record.mjs`; keep `audit.mjs`, `verify.mjs`, `gate.mjs`, and `init.mjs` as small command-specific consumers. Negative audit fixtures are staged into temporary conventional `memory/` trees so the production plugin root can be audited without an ignore escape hatch.

**Tech Stack:** Node.js ESM, Node standard library only, JSON/Markdown records, `node:assert/strict`, Git CLI for commit-anchor checks.

## Global Constraints

- **Zero runtime dependencies:** `package.json` must retain `"dependencies": {}`; every script import is `node:*` or an in-plugin relative path.
- **Plain language everywhere:** plugin skills, commands, agents, and memory contain no reserved source-project vocabulary; the decision role is “the human authority gate.”
- **Fail-closed exits:** `0` clean/GRANTED; `2` findings/DENIED; `1` cannot-run.
- **Style:** double quotes, semicolons, 2-space indent, small pure functions, and `#!/usr/bin/env node` on executable scripts.
- **Findings:** audit and verify print JSON lines shaped `{level,check,path,detail}`, then `LABEL: N FAIL, M WARN`.
- **Fixture proof:** every audit check has a real violating tree that makes the production entry point fail.
- **No audit ignore mechanism:** fixture isolation is achieved by source layout plus temporary staging, never by weakening discovery.
- **TDD:** every production behavior is preceded by a regression test that is run and observed failing for the intended reason.
- **Repository hygiene:** preserve unrelated work, especially the untracked root `AGENTS.md`; each task commits only its named files.

---

## File structure

### Shared primitives

- Modify `ai-native-memory/scripts/lib/record.mjs`: record constants, content-address validation, deterministic record-list rendering, repository-contained path resolution.
- Modify `ai-native-memory/tests/test-lib.mjs`: focused primitive tests.

### Commands

- Modify `ai-native-memory/scripts/gate.mjs`: binding DENIED exit code.
- Modify `ai-native-memory/scripts/audit.mjs`: strict representations, taxonomy, derivation, staleness, and path safety.
- Modify `ai-native-memory/scripts/verify.mjs`: contract-declared oracle binding and coverage.
- Modify `ai-native-memory/scripts/init.mjs`: complete honest scaffold.

### Tests and fixtures

- Modify `ai-native-memory/tests/test-gate.mjs`.
- Modify `ai-native-memory/tests/test-audit.mjs`.
- Modify `ai-native-memory/tests/test-verify.mjs`.
- Modify `ai-native-memory/tests/test-init.mjs`.
- Modify `ai-native-memory/tests/test-dogfood.mjs`.
- Create `ai-native-memory/tests/oracle-plugin-contract.mjs`.
- Move audit fixture record sets from `comp/memory/` to `comp/record-set/`.
- Expand audit and verify fixtures for every reviewed failure mode.

### Dogfood and documentation

- Rename `ai-native-memory/AUTHORITY.json` to `ai-native-memory/CURRENT-AUTHORITY.json`.
- Modify `ai-native-memory/memory/**`, `ai-native-memory/verify-map.json`, commands, agents, and skills to match enforced schemas and exits.
- Modify `clotho/memory/CONTRACTS/package-roots.json` to remove stale cardinality prose.

---

### Task 1: Make gate denial use the binding exit code

**Files:**

- Modify: `ai-native-memory/tests/test-gate.mjs:23-26`
- Modify: `ai-native-memory/scripts/gate.mjs:5,74`
- Modify: `ai-native-memory/commands/memory-gate.md:9`

**Interfaces:**

- Consumes: the existing gate CLI and artifact schema.
- Produces: exit `0` GRANTED, exit `2` DENIED, exit `1` cannot-run.

- [ ] **Step 1: Change only the gate regression expectations**

```js
// wrong answer -> 2
assert.equal(run("answers-wrong.json").status, 2);
// missing superseded exclusion -> 2
assert.equal(run("answers-missing-exclusion.json").status, 2);
```

- [ ] **Step 2: Run the focused test and observe RED**

Run:

```bash
cd ai-native-memory
node tests/test-gate.mjs
```

Expected: assertion failure reporting actual status `3`, expected `2`.

- [ ] **Step 3: Make the minimal implementation and command-doc change**

In `scripts/gate.mjs`, use:

```js
// Exit 0 GRANTED / 2 DENIED / 1 cannot-run.
```

and:

```js
process.exit(passed ? 0 : 2);
```

In `commands/memory-gate.md`, state:

```markdown
Exit 0 means COMPREHENSION_PASSED / implementation authority GRANTED. Exit 2 means COMPREHENSION_FAILED / implementation authority DENIED — list each failed check from `unresolved`. Exit 1 means the gate could not run at all, most often because the authority file itself is drifted.
```

- [ ] **Step 4: Run the focused test and syntax check**

```bash
node --check scripts/gate.mjs
node tests/test-gate.mjs
```

Expected: `test-gate: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add ai-native-memory/scripts/gate.mjs ai-native-memory/tests/test-gate.mjs ai-native-memory/commands/memory-gate.md
git commit -m "fix(ai-native-memory): use binding denial exit code"
```

---

### Task 2: Add shared record, render, and path-safety primitives

**Files:**

- Modify: `ai-native-memory/tests/test-lib.mjs`
- Modify: `ai-native-memory/scripts/lib/record.mjs`

**Interfaces:**

- Produces:
  - `RECORD_KINDS: ReadonlySet<string>`
  - `RECORD_STATUSES: ReadonlySet<string>`
  - `hasValidContentAddress(record: object): boolean`
  - `renderRecordList(title: string, records: object[]): string`
  - `resolveWithin(root: string, relativePath: string): string`
  - `importSpecifiers(source: string): string[]`

- [ ] **Step 1: Add failing primitive tests**

Add imports:

```js
import {
  canonicalize,
  sha256hex,
  contentAddress,
  hasValidContentAddress,
  importSpecifiers,
  renderRecordList,
  resolveWithin,
  RECORD_KINDS,
  RECORD_STATUSES,
  finding,
  printFindings
} from "../scripts/lib/record.mjs";
```

Add assertions before the findings assertions:

```js
const addressed = { kind: "invariant", statement: "s" };
addressed.id = contentAddress(addressed);
assert.equal(hasValidContentAddress(addressed), true);
assert.equal(hasValidContentAddress({ ...addressed, statement: "changed" }), false);
assert.equal(RECORD_KINDS.has("contract"), true);
assert.equal(RECORD_KINDS.has("invented-kind"), false);
assert.equal(RECORD_STATUSES.has("NORMATIVE-CURRENT"), true);
assert.equal(RECORD_STATUSES.has("INVENTED-STATUS"), false);
assert.equal(
  renderRecordList("Example invariants", [addressed]),
  `# Example invariants (rendered)\n\n- **${addressed.id}** [unspecified] s\n`
);
assert.equal(resolveWithin("/repo", "component/memory"), "/repo/component/memory");
assert.throws(() => resolveWithin("/repo", "../outside"), /escapes repository root/);
assert.throws(() => resolveWithin("/repo", "/outside"), /repository-relative/);
assert.deepEqual(
  importSpecifiers('import x from "node:x"; import "./side.mjs"; await import("../dynamic.mjs");'),
  ["node:x", "./side.mjs", "../dynamic.mjs"]
);
```

- [ ] **Step 2: Run the focused test and observe RED**

```bash
node tests/test-lib.mjs
```

Expected: module import failure because the new exports do not exist.

- [ ] **Step 3: Add the exact shared primitives**

Add `node:path` to `record.mjs`:

```js
import path from "node:path";
```

Add:

```js
export const RECORD_KINDS = new Set([
  "mechanism",
  "decision",
  "rejected-alternative",
  "non-claim",
  "invariant",
  "open-question",
  "contract",
  "evidence"
]);

export const RECORD_STATUSES = new Set([
  "NORMATIVE-CURRENT",
  "SUPERSEDED",
  "SPECIFIED-PENDING-IMPLEMENTATION",
  "RATIFICATION-PENDING",
  "MODEL-PROPOSAL",
  "REJECTED-ALTERNATIVE",
  "OPEN-QUESTION",
  "HUMAN-AUTHORIZED-EXCEPTION",
  "ADVISORY"
]);

export function hasValidContentAddress(record) {
  return typeof record?.id === "string"
    && /^sha256:[0-9a-f]{64}$/.test(record.id)
    && record.id === contentAddress(record);
}

export function renderRecordList(title, records) {
  const rows = records.map((record) =>
    `- **${record.id}** [${record.status || "unspecified"}] ${record.statement}`
  );
  return `# ${title} (rendered)\n\n${rows.join("\n")}\n`;
}

export function resolveWithin(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error("path must be nonempty and repository-relative");
  }
  const base = path.resolve(root);
  const resolved = path.resolve(base, relativePath);
  const relative = path.relative(base, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path escapes repository root: ${relativePath}`);
  }
  return resolved;
}

export function importSpecifiers(source) {
  const found = [];
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}
```

- [ ] **Step 4: Run RED-to-GREEN verification**

```bash
node --check scripts/lib/record.mjs
node tests/test-lib.mjs
```

Expected: `test-lib: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add ai-native-memory/scripts/lib/record.mjs ai-native-memory/tests/test-lib.mjs
git commit -m "feat(ai-native-memory): add strict record primitives"
```

---

### Task 3: Make audit strict and make whole-root dogfood discoverable

**Files:**

- Modify: `ai-native-memory/tests/test-audit.mjs`
- Modify: `ai-native-memory/scripts/audit.mjs`
- Modify: `ai-native-memory/tests/test-dogfood.mjs`
- Rename: `ai-native-memory/AUTHORITY.json` to `ai-native-memory/CURRENT-AUTHORITY.json`
- Modify: `ai-native-memory/memory/CONTRACTS/plugin.json`
- Modify: `ai-native-memory/memory/INVARIANTS.json`
- Modify: `ai-native-memory/memory/INVARIANTS.md`
- Modify: `ai-native-memory/memory/NON-CLAIMS.json`
- Modify: `ai-native-memory/memory/NON-CLAIMS.md`
- Modify: `ai-native-memory/memory/comprehension-queries.json`
- Modify: `ai-native-memory/memory/answers-example.json`
- Move: `ai-native-memory/tests/fixtures/audit/*/comp/memory/` to `ai-native-memory/tests/fixtures/audit/*/comp/record-set/`

**Interfaces:**

- Consumes: `contentAddress`, `hasValidContentAddress`, `renderRecordList`, `resolveWithin`, `RECORD_KINDS`, `RECORD_STATUSES`.
- Produces: `auditRoot(root): Finding[]` with strict FAIL behavior and staleness WARN behavior.

- [ ] **Step 1: Make dogfood demand the public whole-root audit**

In `tests/test-dogfood.mjs`, replace the selective imported audit with:

```js
const audit = spawnSync(process.execPath, [path.join(ROOT, "scripts", "audit.mjs"), ROOT], { encoding: "utf8" });
assert.equal(audit.status, 0, `whole-root self-audit:\n${audit.stdout}\n${audit.stderr}`);
```

Run:

```bash
node tests/test-dogfood.mjs
```

Expected RED: whole-root audit returns exit `2` and reports the deliberately violating fixture trees.

- [ ] **Step 2: Move fixture source directories out of production discovery**

Run this mechanical move from `ai-native-memory`:

```bash
find tests/fixtures/audit -type d -path '*/comp/memory' -print0 |
  while IFS= read -r -d '' dir; do git mv "$dir" "${dir%/memory}/record-set"; done
find tests/fixtures/audit -type f -name AUTHORITY.json -print0 |
  while IFS= read -r -d '' file; do git mv "$file" "${file%/AUTHORITY.json}/CURRENT-AUTHORITY.json"; done
```

Verify:

```bash
find tests/fixtures/audit -type d -name memory
```

Expected: no output.

- [ ] **Step 3: Replace the audit test setup with a real staged tree**

Use these imports:

```js
import assert from "node:assert/strict";
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
  renderRecordList
} from "../scripts/lib/record.mjs";
import { auditRoot } from "../scripts/audit.mjs";
```

Define staging helpers:

```js
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
```

Wrap all assertions in:

```js
try {
  // assertions from Steps 3 and 4
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}
```

- [ ] **Step 4: Add strict taxonomy, oracle, query, and render assertions**

Inside the `try` block, create a passing root and mutations:

```js
const passing = stage("passing");
assert.equal(auditRoot(passing).filter((finding) => finding.level === "FAIL").length, 0);

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
```

Run:

```bash
node tests/test-audit.mjs
```

Expected RED: one of the new assertions fails because current audit accepts that defect.

- [ ] **Step 5: Add staleness assertions**

Add imports:

```js
import { execFileSync } from "node:child_process";
import { sha256hex } from "../scripts/lib/record.mjs";
```

Add:

```js
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

```

Run:

```bash
node tests/test-audit.mjs
```

Expected RED: strict staleness assertion fails.

- [ ] **Step 6: Implement strict audit helpers**

Update imports:

```js
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECORD_KINDS,
  RECORD_STATUSES,
  hasValidContentAddress,
  readJson,
  finding,
  printFindings,
  renderRecordList,
  resolveWithin,
  sha256hex
} from "./lib/record.mjs";
```

Add:

```js
const PLACEHOLDER = /^(?:NAME-|REPLACE:|PLACEHOLDER)/;
const isRegularFile = (file) => existsSync(file) && statSync(file).isFile();

function recordOracle(record) {
  if (record.kind === "contract") return record.oracle?.test;
  if (record.kind === "invariant") return record.oracle;
  return null;
}

function validateRecord(record, recordPath, root, out) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "record must be an object"));
    return;
  }
  if (!RECORD_KINDS.has(record.kind)) {
    out.push(finding("FAIL", "taxonomy", recordPath, `unknown record kind: ${record.kind}`));
  }
  if (!RECORD_STATUSES.has(record.status)) {
    out.push(finding("FAIL", "taxonomy", recordPath, `unknown record status: ${record.status}`));
  }
  if (!hasValidContentAddress(record)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "id must equal sha256(canonicalize(record minus id))"));
  }
  if (record.status === "NORMATIVE-CURRENT") {
    const oracle = recordOracle(record);
    if ((record.kind === "contract" || record.kind === "invariant")
      && (typeof oracle !== "string" || !oracle || PLACEHOLDER.test(oracle))) {
      out.push(finding("FAIL", "taxonomy", recordPath, "NORMATIVE-CURRENT requires a non-placeholder oracle"));
    } else if (oracle) {
      try {
        const oraclePath = resolveWithin(root, oracle);
        if (!isRegularFile(oraclePath)) {
          out.push(finding("FAIL", "taxonomy", recordPath, `oracle file does not resolve: ${oracle}`));
        }
      } catch (error) {
        out.push(finding("FAIL", "taxonomy", recordPath, error.message));
      }
    }
  }
  if (record.status === "SPECIFIED-PENDING-IMPLEMENTATION"
    && (typeof record.becomes_normative_when !== "string"
      || !record.becomes_normative_when
      || PLACEHOLDER.test(record.becomes_normative_when))) {
    out.push(finding("FAIL", "taxonomy", recordPath, "pending record requires a real becomes_normative_when"));
  }
  if (record.status === "SUPERSEDED"
    && !(record.superseded_by && record.must_not_govern_new_work === true)) {
    out.push(finding("FAIL", "taxonomy", recordPath, "SUPERSEDED requires successor plus must_not_govern_new_work:true"));
  }
}
```

Replace missing-render WARN behavior with exact rendering:

```js
const rendered = path.join(dir, `${base}.md`);
const title = base === "INVARIANTS" ? "Invariants" : "Non-claims";
if (!existsSync(rendered)) {
  out.push(finding("FAIL", "three-representation", where, `${base}.json has no rendered ${base}.md projection`));
} else if (readFileSync(rendered, "utf8") !== renderRecordList(title, recs)) {
  out.push(finding("FAIL", "three-representation", where, `${base}.md drifted from ${base}.json`));
}
```

Call `validateRecord` for every invariant, non-claim, and contract. Call `auditDeclaredStaleness` for every contract after it parses. For queries, change each missing/malformed/unreadable derivation finding from `WARN` to `FAIL`, and additionally fail when `dig` returns `undefined`.

Implement staleness declarations:

```js
function auditDeclaredStaleness(record, recordPath, root, out) {
  if (record.authority?.source_path) {
    try {
      if (!isRegularFile(resolveWithin(root, record.authority.source_path))) {
        out.push(finding("FAIL", "staleness", recordPath, `authority.source_path does not resolve: ${record.authority.source_path}`));
      }
    } catch (error) {
      out.push(finding("FAIL", "staleness", recordPath, error.message));
    }
  }
  if (record.as_of) {
    const resolved = spawnSync("git", ["-C", root, "rev-parse", "--verify", `${record.as_of}^{commit}`], { encoding: "utf8" });
    if (resolved.status !== 0) {
      out.push(finding("FAIL", "staleness", recordPath, `as_of commit does not resolve: ${record.as_of}`));
    } else {
      const distance = spawnSync("git", ["-C", root, "rev-list", "--count", `${record.as_of}..HEAD`], { encoding: "utf8" });
      if (distance.status !== 0) {
        out.push(finding("FAIL", "staleness", recordPath, "cannot measure as_of distance"));
      } else if (Number(distance.stdout.trim()) > 0) {
        out.push(finding("WARN", "staleness", recordPath, `${distance.stdout.trim()} commit(s) since as_of ${record.as_of}`));
      }
    }
  }
  if (record.snapshot) {
    const { source_path: sourcePath, sha256 } = record.snapshot;
    if (typeof sourcePath !== "string" || !/^sha256:[0-9a-f]{64}$/.test(sha256 || "")) {
      out.push(finding("FAIL", "staleness", recordPath, "snapshot requires source_path and sha256:<64hex>"));
    } else {
      try {
        const source = resolveWithin(root, sourcePath);
        if (!isRegularFile(source)) {
          out.push(finding("FAIL", "staleness", recordPath, `snapshot source missing: ${sourcePath}`));
        } else {
          const actual = "sha256:" + sha256hex(readFileSync(source));
          if (actual !== sha256) out.push(finding("FAIL", "staleness", recordPath, `snapshot drifted: ${actual} != ${sha256}`));
        }
      } catch (error) {
        out.push(finding("FAIL", "staleness", recordPath, error.message));
      }
    }
  }
}
```

Use `CURRENT-AUTHORITY.json` in `auditAuthorityRoot`. Because the plugin's dogfood authority lives inside a larger Git repository and legitimately points to the governing spec one directory above the plugin, contain that path within the Git top level rather than the narrower audit scope:

```js
function repositoryRoot(scope) {
  const result = spawnSync("git", ["-C", scope, "rev-parse", "--show-toplevel"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : path.resolve(scope);
}

const repo = repositoryRoot(root);
const candidate = path.resolve(root, act.path);
const document = resolveWithin(repo, path.relative(repo, candidate));
```

The same code still rejects a path outside the host repository.

- [ ] **Step 7: Migrate the dogfood records required by strict audit**

Run:

```bash
git mv ai-native-memory/AUTHORITY.json ai-native-memory/CURRENT-AUTHORITY.json
```

Finalize the plugin contract's exit-code set as `["0", "1", "2"]`. For each contract, invariant, and non-claim:

1. remove the semantic `id`;
2. calculate `contentAddress(record)` with `scripts/lib/record.mjs`;
3. insert the resulting hash as `id`;
4. regenerate `INVARIANTS.md` and `NON-CLAIMS.md` with `renderRecordList`.

Update the comprehension query required-ID arrays, example answer acknowledgment arrays, and exit-code answer to the new content-addressed IDs and `["0", "1", "2"]`. Update the dogfood gate path to `CURRENT-AUTHORITY.json` and its negative expectation to exit `2`.

- [ ] **Step 8: Run focused and full tests**

```bash
node --check scripts/audit.mjs
node tests/test-audit.mjs
npm test
```

Expected: audit test passes and `run: 6/6 test files passed`.

- [ ] **Step 9: Commit**

```bash
git add -A -- ai-native-memory/scripts/audit.mjs ai-native-memory/tests/test-audit.mjs ai-native-memory/tests/test-dogfood.mjs ai-native-memory/tests/fixtures/audit ai-native-memory/AUTHORITY.json ai-native-memory/CURRENT-AUTHORITY.json ai-native-memory/memory
git commit -m "fix(ai-native-memory): make memory audit fail closed"
```

---

### Task 4: Bind verification to declared contract oracles

**Files:**

- Modify: `ai-native-memory/tests/test-verify.mjs`
- Modify: `ai-native-memory/tests/fixtures/verify/**`
- Modify: `ai-native-memory/scripts/verify.mjs`
- Create: `ai-native-memory/tests/oracle-plugin-contract.mjs`
- Modify: `ai-native-memory/memory/CONTRACTS/plugin.json`
- Modify: `ai-native-memory/verify-map.json`
- Modify: `ai-native-memory/commands/memory-verify.md`

**Interfaces:**

- Produces: every map entry exactly matches `contract.oracle.test`; empty, duplicate, mismatched, and incomplete maps exit `2`.

- [ ] **Step 1: Reshape verify fixtures into isolated roots**

Create these independent roots beneath `tests/fixtures/verify/`:

```text
passing/
failing/
missing/
empty/
mismatch/
duplicate/
uncovered/
```

Every source root except `missing/` contains `record-set/CONTRACTS/contract.json`; no committed verify fixture directory is named `memory`. The test stages `record-set` as `memory` before invoking the production verifier. Use this contract in `passing/`, `empty/`, `mismatch/`, `duplicate/`, and `uncovered/`:

```json
{
  "kind": "contract",
  "id": "fixture-contract",
  "title": "Fixture contract",
  "status": "NORMATIVE-CURRENT",
  "oracle": { "test": "oracle-pass.mjs" }
}
```

Use the same shape with `"oracle": { "test": "oracle-fail.mjs" }` in `failing/`. Each root contains the oracle file its contract names. Use this passing map in `passing/` and `failing/`, substituting the declared oracle name:

```json
[
  {
    "contract": "memory/CONTRACTS/contract.json",
    "oracle": "oracle-pass.mjs"
  }
]
```

Use `[]` in `empty/verify-map.json`. Use this in `mismatch/verify-map.json`:

```json
[
  {
    "contract": "memory/CONTRACTS/contract.json",
    "oracle": "oracle-fail.mjs"
  }
]
```

Use the passing entry twice in `duplicate/verify-map.json`. In `uncovered/`, add `record-set/CONTRACTS/second.json` as another `NORMATIVE-CURRENT` contract declaring `oracle-pass.mjs`, while the map names only `contract.json`. In `missing/`, point the map at `memory/CONTRACTS/missing.json`.

- [ ] **Step 2: Add failing verify assertions**

Import `cpSync`, `existsSync`, `mkdtempSync`, `renameSync`, and `rmSync` from `node:fs`, plus `tmpdir` from `node:os`. Change the runner to:

```js
const run = (fixture) => {
  const temporary = mkdtempSync(path.join(tmpdir(), `anm-verify-${fixture}-`));
  const staged = path.join(temporary, "fixture");
  try {
    cpSync(path.join(FX, fixture), staged, { recursive: true });
    const recordSet = path.join(staged, "record-set");
    if (existsSync(recordSet)) renameSync(recordSet, path.join(staged, "memory"));
    return spawnSync(
      process.execPath,
      [V, path.join(staged, "verify-map.json")],
      { encoding: "utf8" }
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
};
```

Use:

```js
assert.equal(run("passing").status, 0, "declared oracle exits 0");
assert.equal(run("failing").status, 2, "declared failing oracle exits 2");
assert.equal(run("missing").status, 2, "missing contract exits 2");
assert.equal(run("empty").status, 2, "empty map cannot certify");
assert.equal(run("mismatch").status, 2, "map cannot substitute another oracle");
assert.equal(run("duplicate").status, 2, "duplicate contract entry rejected");
assert.equal(run("uncovered").status, 2, "uncovered normative contract rejected");
```

Run:

```bash
node tests/test-verify.mjs
```

Expected RED: empty or mismatched map returns the current incorrect status.

- [ ] **Step 3: Implement exact oracle binding and map coverage**

Add a production contract finder modeled on `findMemoryDirs`, skipping only `.git` and `node_modules`. Resolve all paths through `resolveWithin`.

Inside the map loop, use:

```js
const seen = new Set();
for (const entry of map) {
  if (!entry || typeof entry !== "object") {
    out.push(finding("FAIL", "verify", "verify-map.json", "entry must be an object"));
    continue;
  }
  if (seen.has(entry.contract)) {
    out.push(finding("FAIL", "verify", entry.contract, "duplicate contract entry"));
    continue;
  }
  seen.add(entry.contract);
  let cpath;
  let opath;
  try {
    cpath = resolveWithin(base, entry.contract);
    opath = resolveWithin(base, entry.oracle);
  } catch (error) {
    out.push(finding("FAIL", "verify", entry.contract, error.message));
    continue;
  }
  if (!existsSync(cpath)) {
    out.push(finding("FAIL", "verify", entry.contract, "contract file missing"));
    continue;
  }
  let contract;
  try {
    contract = readJson(cpath);
  } catch (error) {
    out.push(finding("FAIL", "verify", entry.contract, error.message));
    continue;
  }
  if (contract.status !== "NORMATIVE-CURRENT") {
    out.push(finding("FAIL", "verify", entry.contract, `contract status is ${contract.status}`));
    continue;
  }
  if (contract.oracle?.test !== entry.oracle) {
    out.push(finding("FAIL", "verify", entry.contract, `map oracle ${entry.oracle} != declared ${contract.oracle?.test}`));
    continue;
  }
  if (!existsSync(opath)) {
    out.push(finding("FAIL", "verify", entry.contract, `oracle missing: ${entry.oracle}`));
    continue;
  }
  const result = spawnSync(process.execPath, [opath], {
    cwd: entry.cwd ? resolveWithin(base, entry.cwd) : base,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    out.push(finding("FAIL", "verify", entry.contract, `oracle ${entry.oracle} exited ${result.status}: ${(result.stderr || result.stdout || "").trim().slice(0, 200)}`));
  }
}
```

Before the loop, reject an empty map:

```js
if (map.length === 0) out.push(finding("FAIL", "verify", "verify-map.json", "map must name at least one contract"));
```

After the loop, compare every discovered `NORMATIVE-CURRENT` contract path with `seen` and add a FAIL for each uncovered contract.

- [ ] **Step 4: Create a terminating plugin contract oracle**

Create `tests/oracle-plugin-contract.mjs`:

```js
#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tests = [
  "test-lib.mjs",
  "test-audit.mjs",
  "test-gate.mjs",
  "test-init.mjs",
  "test-verify.mjs"
];
let failed = 0;
for (const test of tests) {
  const result = spawnSync(process.execPath, [path.join(HERE, test)], { stdio: "inherit" });
  if (result.status !== 0) failed++;
}
console.log(`oracle-plugin-contract: ${tests.length - failed}/${tests.length} checks passed`);
process.exit(failed ? 1 : 0);
```

Set both the plugin contract and map to `tests/oracle-plugin-contract.mjs`, removing the recursion workaround prose. Recompute the contract's content-addressed ID after all contract fields are final.

- [ ] **Step 5: Correct verify command prose**

`commands/memory-verify.md` must say contract file parse/read failures are findings and exit `2`; only an unreadable or malformed verify-map itself exits `1`.

- [ ] **Step 6: Run focused verification**

```bash
node --check scripts/verify.mjs
node tests/test-verify.mjs
node scripts/verify.mjs verify-map.json
```

Expected: focused tests pass and self-verify reports `verify: 0 FAIL, 0 WARN`.

- [ ] **Step 7: Commit**

```bash
git add ai-native-memory/scripts/verify.mjs ai-native-memory/tests/test-verify.mjs ai-native-memory/tests/fixtures/verify ai-native-memory/tests/oracle-plugin-contract.mjs ai-native-memory/memory/CONTRACTS/plugin.json ai-native-memory/verify-map.json ai-native-memory/commands/memory-verify.md
git commit -m "fix(ai-native-memory): verify declared contract oracles"
```

---

### Task 5: Complete the fresh-host scaffold

**Files:**

- Modify: `ai-native-memory/tests/test-init.mjs`
- Modify: `ai-native-memory/scripts/init.mjs`
- Modify: `ai-native-memory/commands/memory-init.md`

**Interfaces:**

- Consumes: `contentAddress`, `renderRecordList`.
- Produces: complete idempotent repo and component scaffold using `CURRENT-AUTHORITY.json`.

- [ ] **Step 1: Expand the init regression**

Change the expected file list to:

```js
const expected = [
  "AI-START-HERE.md",
  "CURRENT-AUTHORITY.json",
  "MEMORY-MANIFEST.json",
  "LOAD-ORDER.json",
  "widget/memory/README.md",
  "widget/memory/IDENTITY.md",
  "widget/memory/INVARIANTS.json",
  "widget/memory/INVARIANTS.md",
  "widget/memory/NON-CLAIMS.json",
  "widget/memory/NON-CLAIMS.md",
  "widget/memory/CONTRACTS/component.json",
  "widget/memory/comprehension-queries.json",
  "widget/memory/DECISIONS/rejected-alternatives.md",
  "widget/memory/FAILURE-MODES.md",
  "widget/memory/EVIDENCE/README.md"
];
```

Add:

```js
for (const file of expected) assert.ok(existsSync(path.join(root, file)), `scaffolded: ${file}`);
const authority = JSON.parse(readFileSync(path.join(root, "CURRENT-AUTHORITY.json"), "utf8"));
assert.equal(authority.active, null);
const loadOrder = JSON.parse(readFileSync(path.join(root, "LOAD-ORDER.json"), "utf8"));
assert.equal(typeof loadOrder.token_budget.guidance, "string");
const manifest = JSON.parse(readFileSync(path.join(root, "MEMORY-MANIFEST.json"), "utf8"));
assert.deepEqual(manifest.components, ["widget"]);
for (const file of [
  "widget/memory/INVARIANTS.json",
  "widget/memory/NON-CLAIMS.json",
  "widget/memory/CONTRACTS/component.json"
]) {
  const value = JSON.parse(readFileSync(path.join(root, file), "utf8"));
  const records = Array.isArray(value) ? value : [value];
  for (const record of records) {
    assert.equal(record.status, "SPECIFIED-PENDING-IMPLEMENTATION");
    assert.equal(record.becomes_normative_when, "");
    assert.equal(record.id, contentAddress(record));
  }
}
```

Import `contentAddress` and `renderRecordList`, then assert the rendered invariant and non-claim files equal `renderRecordList`.

- [ ] **Step 2: Run the focused test and observe RED**

```bash
node tests/test-init.mjs
```

Expected: missing `CURRENT-AUTHORITY.json` or `MEMORY-MANIFEST.json`.

- [ ] **Step 3: Implement the complete scaffold**

Import:

```js
import { contentAddress, renderRecordList } from "./lib/record.mjs";
```

Use:

```js
const address = (record) => ({ ...record, id: contentAddress(record) });
```

Create `CURRENT-AUTHORITY.json` with:

```js
{
  note: "A human binds active to {ref,path,sha256}. Superseded entries never govern new work.",
  active: null,
  superseded: []
}
```

Create `MEMORY-MANIFEST.json` with:

```js
{
  version: 1,
  components: componentArg ? [componentArg] : []
}
```

Add to `LOAD-ORDER.json`:

```js
token_budget: {
  guidance: "Load the start file, current authority, and only the component records needed for the task; stop before unrelated components."
}
```

Generate the invariant, non-claim, and contract with exact empty `oracle`/`becomes_normative_when`, pending status, then apply `address`. Render JSON arrays through `renderRecordList`. Generate `memory/README.md` as a deterministic index of the component memory files.

- [ ] **Step 4: Update init command prose**

State that every scaffold record begins pending, empty evidence is deliberately uncertified, `CURRENT-AUTHORITY.json` begins unbound, and authors must recompute the content address after replacing a statement or evidence field.

- [ ] **Step 5: Run focused verification**

```bash
node --check scripts/init.mjs
node tests/test-init.mjs
```

Expected: `test-init: all assertions passed`.

- [ ] **Step 6: Commit**

```bash
git add ai-native-memory/scripts/init.mjs ai-native-memory/tests/test-init.mjs ai-native-memory/commands/memory-init.md
git commit -m "fix(ai-native-memory): scaffold complete honest memory sets"
```

---

### Task 6: Prove public-command inheritance

**Files:**

- Modify: `ai-native-memory/tests/test-dogfood.mjs`

**Interfaces:**

- Produces: the public root audit, public gate, and exact self-verify all green.

- [ ] **Step 1: Strengthen the dogfood import oracle**

Import `importSpecifiers` from `scripts/lib/record.mjs`. Replace the `from`-only regex with:

```js
for (const specifier of importSpecifiers(source)) {
  assert.ok(
    specifier.startsWith("node:") || specifier.startsWith("."),
    `${file}: non-portable import ${specifier}`
  );
  }
```

Retain the public whole-root audit, `CURRENT-AUTHORITY.json`, exit `2` negative gate, and exact self-verify assertions established by Tasks 3 and 4:

```js
assert.equal(v.status, 0, `self-verify green:\n${v.stdout}\n${v.stderr}`);
```

- [ ] **Step 2: Run dogfood**

```bash
node tests/test-dogfood.mjs
```

Expected: `test-dogfood: all assertions passed`. Literal static, side-effect, and dynamic import parsing was already proven RED-to-GREEN in Task 2.

- [ ] **Step 3: Run dogfood and public commands**

```bash
node tests/test-dogfood.mjs
node scripts/audit.mjs .
node scripts/verify.mjs verify-map.json
```

Expected:

```text
test-dogfood: all assertions passed
audit: 0 FAIL, 0 WARN
verify: 0 FAIL, 0 WARN
```

- [ ] **Step 4: Commit**

```bash
git add ai-native-memory/tests/test-dogfood.mjs
git commit -m "fix(ai-native-memory): prove whole-root inheritance"
```

---

### Task 7: Align skills, agents, language, and host prose

**Files:**

- Modify: `ai-native-memory/skills/memory-standard/SKILL.md`
- Modify: `ai-native-memory/skills/memory-authoring/SKILL.md`
- Modify: `ai-native-memory/skills/memory-lifecycle/SKILL.md`
- Modify: `ai-native-memory/commands/memory-audit.md`
- Modify: `ai-native-memory/agents/memory-auditor.md`
- Modify: `ai-native-memory/agents/comprehension-grader.md`
- Modify: `ai-native-memory/memory/DECISIONS/rejected-alternatives.md`
- Modify: `ai-native-memory/memory/FAILURE-MODES.md`
- Modify: `clotho/memory/CONTRACTS/package-roots.json`
- Modify: `ai-native-memory/tests/test-audit.mjs`

**Interfaces:**

- Produces: prose that teaches exactly the enforced field names, statuses, authority filename, and exit codes.

- [ ] **Step 1: Add a cleanup assertion to the audit test**

Ensure temporary directories created by `test-audit.mjs` are removed in a `finally` block. Run the test once and confirm it remains green.

- [ ] **Step 2: Make prose mechanically consistent**

Apply these exact semantic corrections:

- use `CURRENT-AUTHORITY.json` for generated/current authority;
- use exit `2` for DENIED;
- state that malformed or unresolved `derived_from` is FAIL;
- state that audit checks oracle path existence while verify executes contract oracles;
- state that IDs are recomputed content addresses and rendered Markdown is byte-derived from JSON;
- document `as_of` commit WARN and snapshot hash FAIL behavior;
- remove the sentence claiming the structural audit cannot verify oracle existence.

- [ ] **Step 3: Remove reserved host vocabulary**

Run:

```bash
rg -n -i 'TELOS|Clotho|Daedalus|Iliad|Lachesis|Atropos|The Eye|build-gate|merkle-dag' \
  ai-native-memory/skills ai-native-memory/commands ai-native-memory/agents ai-native-memory/memory
```

Replace the two rejected-alternative references with:

```markdown
reserved source-project vocabulary
```

and:

```markdown
the source project's core rule: never certify from a model's self-report
```

Rerun the scan. Expected: no output.

- [ ] **Step 4: Correct stale host classification prose**

Change `clotho/memory/CONTRACTS/package-roots.json` from “The three sibling products” to “The sibling products”. Do not change any registry arrays.

- [ ] **Step 5: Run focused documentation-adjacent checks**

```bash
node tests/test-audit.mjs
node tests/test-dogfood.mjs
cd ../clotho
npm run check
node scripts/test-inventory.mjs
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```bash
git add ai-native-memory/skills ai-native-memory/commands ai-native-memory/agents ai-native-memory/memory/DECISIONS/rejected-alternatives.md ai-native-memory/memory/FAILURE-MODES.md ai-native-memory/tests/test-audit.mjs clotho/memory/CONTRACTS/package-roots.json
git commit -m "docs(ai-native-memory): align the standard with enforcement"
```

---

### Task 8: Final whole-branch verification

**Files:**

- Modify only if a verification command exposes a defect, and then return to the responsible task's red-green cycle before continuing.

**Interfaces:**

- Produces: fresh evidence for every merge claim.

- [ ] **Step 1: Run syntax and complete plugin tests**

```bash
cd ai-native-memory
npm run check
npm test
```

Expected: all syntax checks pass and `run: 6/6 test files passed`.

- [ ] **Step 2: Run public dogfood commands directly**

```bash
node scripts/audit.mjs .
node scripts/verify.mjs verify-map.json
node scripts/gate.mjs memory/comprehension-queries.json memory/answers-example.json \
  --authority CURRENT-AUTHORITY.json
```

Expected: audit and verify report `0 FAIL`; gate reports `GRANTED` and exits `0`.

- [ ] **Step 3: Prove the negative gate exit**

Use the existing negative gate fixture:

```bash
node scripts/gate.mjs tests/fixtures/gate/queries.json tests/fixtures/gate/answers-wrong.json \
  --authority tests/fixtures/gate/AUTHORITY.json
test "$?" -eq 2
```

Expected: artifact says DENIED; shell assertion exits `0`.

- [ ] **Step 4: Run dependency, import, and vocabulary scans**

```bash
node -e 'const p=require("./package.json"); if (Object.keys(p.dependencies || {}).length) process.exit(1)'
rg -n --pcre2 "(?:from\\s+|import\\s*\\(\\s*|import\\s+)[\"'](?!node:|\\./|\\.\\./)" scripts -g '*.mjs'
rg -n -i 'TELOS|Clotho|Daedalus|Iliad|Lachesis|Atropos|The Eye|build-gate|merkle-dag' \
  skills commands agents memory
```

Expected: dependency command exits `0`; both scans produce no output.

- [ ] **Step 5: Run host checks**

```bash
cd ../clotho
npm run check
node scripts/test-inventory.mjs
cd ..
node docs/institutional-memory/verify-contracts.mjs
```

Expected:

```text
clotho check OK (27 files)
test-inventory: all assertions passed
-> 211/211 contracts match system reality
```

- [ ] **Step 6: Run branch hygiene checks**

```bash
git diff --check
git status --short
git log --oneline cdd3f76..HEAD
```

Expected: no whitespace errors; only the pre-existing untracked `AGENTS.md` may remain outside committed changes.

- [ ] **Step 7: Commit any verification-only correction**

Skip this step when no correction was needed. If a correction was needed, stage only its regression test and implementation, then use:

```bash
git commit -m "fix(ai-native-memory): close final verification gap"
```
