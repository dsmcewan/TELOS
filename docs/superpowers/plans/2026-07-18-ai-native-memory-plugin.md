# ai-native-memory Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the AI-native institutional-memory standard (spec: `docs/superpowers/specs/2026-07-18-ai-native-memory-plugin-design.md`) as a self-contained Claude Code plugin at `ai-native-memory/` — skills + commands + agents + zero-dep oracles + a dogfooded record set.

**Architecture:** Markdown skills/commands/agents wrap four zero-dependency Node ESM oracles (`init`/`audit`/`verify`/`gate`) built on a small vendored lib (`canonicalize`/`sha256hex`/record helpers). The plugin documents itself in its own format (`ai-native-memory/memory/`), and its test suite proves every audit check can fail via per-branch violation fixtures, then runs the dogfood audit+gate over the plugin itself.

**Tech Stack:** Node ≥18, ESM `.mjs`, `node:` stdlib only. No TypeScript, no bundler, no dependencies.

## Global Constraints

- **Zero runtime dependencies**: `package.json` `"dependencies": {}`; imports only `node:*` or in-plugin relative paths. NEVER import from TELOS packages (`clotho/`, `merkle-dag/`, etc.) — primitives are vendored.
- **Plain language everywhere**: no mythological terms (no Clotho/Daedalus/Iliad/Eye/etc.) in any plugin file. The human authority role is called "the human authority gate".
- **Fail-closed exits**: `0` clean · `2` findings/denied · `1` cannot-run (drifted authority, unreadable input).
- **Style**: double quotes, semicolons, 2-space indent, small pure functions, `#!/usr/bin/env node` on executable scripts.
- **Findings format** (audit/verify): one JSON object per finding `{level:"FAIL"|"WARN", check, path, detail}` printed as JSON lines, then a human summary line `audit: N FAIL, M WARN`.
- **Every audit check ships with a violating fixture proving it can fail** (spec: "No check ships without a fixture proving it can fail").
- Commit after every task on branch `lachesis-quest-1`.

## File Structure

```
ai-native-memory/
├── .claude-plugin/plugin.json
├── package.json
├── scripts/
│   ├── lib/record.mjs        # canonicalize, sha256hex, contentAddress, readJson, findings helpers
│   ├── gate.mjs              # deterministic comprehension gate (port, generalized)
│   ├── audit.mjs             # the 5-family sweep
│   ├── verify.mjs            # contracts == reality via host verify-map.json
│   └── init.mjs              # scaffolder (only writer)
├── skills/{memory-standard,memory-authoring,memory-lifecycle}/SKILL.md
├── commands/{memory-init,memory-audit,memory-verify,memory-gate}.md
├── agents/{memory-auditor,comprehension-grader,adversarial-reviewer}.md
├── memory/                   # dogfood record set (Task 10)
└── tests/
    ├── run.mjs               # runs all test files
    ├── test-lib.mjs · test-gate.mjs · test-audit.mjs · test-verify.mjs · test-init.mjs · test-dogfood.mjs
    └── fixtures/             # per-branch passing + violating trees (built in Tasks 3-6)
```

---

### Task 1: Plugin scaffold + manifest

**Files:**
- Create: `ai-native-memory/.claude-plugin/plugin.json`
- Create: `ai-native-memory/package.json`
- Create: `ai-native-memory/tests/run.mjs`

**Interfaces:**
- Produces: `npm test` entry (runs `tests/run.mjs`, which executes every `tests/test-*.mjs` and fails if any child fails). All later tasks add `tests/test-*.mjs` files that run.mjs auto-discovers.

- [ ] **Step 1: Write the manifest + package + runner**

`ai-native-memory/.claude-plugin/plugin.json`:
```json
{
  "name": "ai-native-memory",
  "version": "0.1.0",
  "description": "AI-native institutional memory: the succession interface between generations of models. Machine-first records, executable oracles, comprehension-gated authority, governance lifecycle."
}
```

`ai-native-memory/package.json`:
```json
{
  "name": "ai-native-memory",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "description": "AI-native institutional-memory standard as a Claude Code plugin (zero-dep oracles + skills + agents).",
  "scripts": {
    "check": "node --check scripts/lib/record.mjs && node --check scripts/gate.mjs && node --check scripts/audit.mjs && node --check scripts/verify.mjs && node --check scripts/init.mjs",
    "test": "node tests/run.mjs"
  },
  "dependencies": {}
}
```

`ai-native-memory/tests/run.mjs`:
```js
#!/usr/bin/env node
// Runs every tests/test-*.mjs as a child process; exit 1 if any fails.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(HERE).filter((f) => /^test-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(HERE, f)], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(`run: ${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Verify the runner runs (0 test files = pass)**

Run: `cd ai-native-memory && npm test`
Expected: `run: 0/0 test files passed`, exit 0. (`npm run check` fails until scripts exist — that's expected; do NOT run check yet.)

- [ ] **Step 3: Commit**

```bash
git add ai-native-memory
git commit -m "feat(ai-native-memory): plugin scaffold — manifest, zero-dep package, test runner"
```

---

### Task 2: `scripts/lib/record.mjs` — vendored primitives

**Files:**
- Create: `ai-native-memory/scripts/lib/record.mjs`
- Test: `ai-native-memory/tests/test-lib.mjs`

**Interfaces:**
- Produces (all later scripts consume): `canonicalize(value) -> string` (deterministic JSON: object keys sorted, arrays in order, no whitespace); `sha256hex(string|Buffer) -> hex string`; `contentAddress(record) -> "sha256:<64hex>"` (over `canonicalize(record minus its "id" field)`); `readJson(path) -> value` (throws with path on parse error); `finding(level, check, path, detail) -> object`; `printFindings(findings, label) -> exitCode` (prints JSON lines + summary; returns 2 if any FAIL else 0).

- [ ] **Step 1: Write the failing test**

`ai-native-memory/tests/test-lib.mjs`:
```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import { canonicalize, sha256hex, contentAddress, finding, printFindings } from "../scripts/lib/record.mjs";

// canonicalize: key order does not matter; array order does
assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
assert.notEqual(canonicalize({ a: [1, 2] }), canonicalize({ a: [2, 1] }));
assert.equal(canonicalize({ a: 1, b: 2 }), '{"a":1,"b":2}');
// sha256hex deterministic
assert.equal(sha256hex("x"), sha256hex("x"));
assert.match(sha256hex("x"), /^[0-9a-f]{64}$/);
// contentAddress: minus-id rule — id in the record does not change the address
const rec = { kind: "invariant", statement: "s", id: "sha256:junk" };
const { id, ...rest } = rec;
assert.equal(contentAddress(rec), "sha256:" + sha256hex(canonicalize(rest)));
// findings
const f = finding("FAIL", "three-representation", "x/memory", "missing INVARIANTS.json");
assert.deepEqual(Object.keys(f).sort(), ["check", "detail", "level", "path"]);
assert.equal(printFindings([f], "audit"), 2);
assert.equal(printFindings([], "audit"), 0);
console.log("test-lib: all assertions passed");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node ai-native-memory/tests/test-lib.mjs`
Expected: FAIL — `Cannot find module .../scripts/lib/record.mjs`

- [ ] **Step 3: Implement**

`ai-native-memory/scripts/lib/record.mjs`:
```js
// record.mjs — vendored primitives for the ai-native-memory oracles. Zero-dep, stdlib only.
// Deliberately self-contained: the plugin never imports from a host repo's packages.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Deterministic JSON: object keys sorted at every level, arrays in given order, no whitespace.
export function canonicalize(v) {
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  if (v && typeof v === "object") {
    return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonicalize(v[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

export function sha256hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

// Content address of a record: sha256 over its canonical form MINUS its own "id" field.
export function contentAddress(record) {
  const { id, ...rest } = record;
  return "sha256:" + sha256hex(canonicalize(rest));
}

export function readJson(p) {
  let raw;
  try { raw = readFileSync(p, "utf8"); } catch (e) { throw new Error(`cannot read ${p}: ${e.message}`); }
  try { return JSON.parse(raw); } catch (e) { throw new Error(`invalid JSON in ${p}: ${e.message}`); }
}

export function finding(level, check, path, detail) {
  return { level, check, path, detail };
}

// Prints one JSON line per finding + a human summary. Returns the fail-closed exit code.
export function printFindings(findings, label) {
  for (const f of findings) console.log(JSON.stringify(f));
  const fails = findings.filter((f) => f.level === "FAIL").length;
  const warns = findings.filter((f) => f.level === "WARN").length;
  console.log(`${label}: ${fails} FAIL, ${warns} WARN`);
  return fails ? 2 : 0;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node ai-native-memory/tests/test-lib.mjs`
Expected: `test-lib: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add ai-native-memory/scripts/lib/record.mjs ai-native-memory/tests/test-lib.mjs
git commit -m "feat(ai-native-memory): vendored primitives — canonicalize, sha256hex, contentAddress, findings"
```

---

### Task 3: `scripts/gate.mjs` — the deterministic comprehension gate

**Files:**
- Create: `ai-native-memory/scripts/gate.mjs`
- Create: `ai-native-memory/tests/fixtures/gate/{AUTHORITY.json,authority-doc.md,queries.json,answers-pass.json,answers-wrong.json,answers-missing-exclusion.json}`
- Test: `ai-native-memory/tests/test-gate.mjs`

**Interfaces:**
- Consumes: `readJson`, `sha256hex` from `lib/record.mjs`.
- Produces: CLI `node gate.mjs <queries.json> <answers.json> --authority <AUTHORITY.json> [--out <artifact.json>]`. Exit 0 GRANTED / 3 DENIED / 1 cannot-run. Authority file schema: `{ "active": { "ref": "<label>", "path": "<repo-relative doc>", "sha256": "sha256:<64hex of raw file bytes>" }, "superseded": [ { "ref": "<label>" } ] }` (paths resolved relative to the authority file's directory). Queries schema: `{ component, governing_authority: { ref }, required_invariants: [ids], required_non_claims: [ids], queries: [ { id, query, answer_kind: "set"|"boolean"|"enum", expected } ] }`. Answers schema: `{ reader, resolved_authority_ref, excluded_superseded: [refs], invariants_read: [ids], non_claims_read: [ids], answers: { <id>: value } }`.

- [ ] **Step 1: Write fixtures + failing test**

`ai-native-memory/tests/fixtures/gate/authority-doc.md`:
```md
The governing authority document. Version A1.
```

`ai-native-memory/tests/fixtures/gate/AUTHORITY.json` — compute the real hash first:
Run: `node -e 'import("node:crypto").then(c=>console.log("sha256:"+c.createHash("sha256").update(require("node:fs").readFileSync("ai-native-memory/tests/fixtures/gate/authority-doc.md")).digest("hex")))'` — wait, simpler: create it with a placeholder then fix with the printed hash:
```json
{
  "active": { "ref": "A1", "path": "authority-doc.md", "sha256": "sha256:REPLACE_ME" },
  "superseded": [ { "ref": "A0" } ]
}
```
Run: `node -e 'const{createHash}=await import("node:crypto");const{readFileSync}=await import("node:fs");console.log("sha256:"+createHash("sha256").update(readFileSync("ai-native-memory/tests/fixtures/gate/authority-doc.md")).digest("hex"))' --input-type=module` and paste the output over `sha256:REPLACE_ME`.

`ai-native-memory/tests/fixtures/gate/queries.json`:
```json
{
  "component": "example",
  "governing_authority": { "ref": "A1" },
  "required_invariants": ["inv-read-only"],
  "required_non_claims": ["nc-no-proof"],
  "queries": [
    { "id": "q-bool", "query": "Does the component write? (boolean)", "answer_kind": "boolean", "expected": false },
    { "id": "q-enum", "query": "Failure posture? (enum)", "answer_kind": "enum", "expected": "fail-closed" },
    { "id": "q-set", "query": "Which kinds are deferred? (set)", "answer_kind": "set", "expected": ["node-backed", "unknown"] }
  ]
}
```

`ai-native-memory/tests/fixtures/gate/answers-pass.json`:
```json
{
  "reader": "test-reader",
  "resolved_authority_ref": "A1",
  "excluded_superseded": ["A0"],
  "invariants_read": ["inv-read-only"],
  "non_claims_read": ["nc-no-proof"],
  "answers": { "q-bool": false, "q-enum": "fail-closed", "q-set": ["unknown", "node-backed"] }
}
```

`answers-wrong.json`: copy of answers-pass with `"q-enum": "fail-open"`.
`answers-missing-exclusion.json`: copy of answers-pass with `"excluded_superseded": []`.

`ai-native-memory/tests/test-gate.mjs`:
```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "gate");
const GATE = path.join(HERE, "..", "scripts", "gate.mjs");
const run = (answers, extra = []) => spawnSync(process.execPath,
  [GATE, path.join(FX, "queries.json"), path.join(FX, answers), "--authority", path.join(FX, "AUTHORITY.json"), ...extra],
  { encoding: "utf8" });

// pass -> 0, artifact GRANTED
const out = path.join(FX, "artifact.json");
const p = run("answers-pass.json", ["--out", out]);
assert.equal(p.status, 0, p.stdout + p.stderr);
const art = JSON.parse(readFileSync(out, "utf8"));
assert.equal(art.result, "COMPREHENSION_PASSED");
assert.equal(art.implementation_authority, "GRANTED");
rmSync(out);
// wrong answer -> 3
assert.equal(run("answers-wrong.json").status, 3);
// missing superseded exclusion -> 3
assert.equal(run("answers-missing-exclusion.json").status, 3);
// drifted authority -> 1 (mutate the doc so the hash no longer matches)
const doc = path.join(FX, "authority-doc.md");
const orig = readFileSync(doc, "utf8");
writeFileSync(doc, orig + "tamper\n");
try { assert.equal(run("answers-pass.json").status, 1); }
finally { writeFileSync(doc, orig); }
console.log("test-gate: all assertions passed");
```

- [ ] **Step 2: Run to verify it fails**

Run: `node ai-native-memory/tests/test-gate.mjs`
Expected: FAIL (gate.mjs does not exist → spawn status null/1 ≠ 0)

- [ ] **Step 3: Implement `gate.mjs`**

```js
#!/usr/bin/env node
// gate.mjs — deterministic comprehension gate. "Reading is not evidence of understanding."
// Grades a reader's answers against authority-anchored queries; verifies the active
// authority doc's hash against disk FIRST (a drifted authority certifies no one).
// Exit 0 GRANTED / 3 DENIED / 1 cannot-run.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readJson, sha256hex } from "./lib/record.mjs";

const die = (msg) => { console.error("GATE_ERROR: " + msg); process.exit(1); };
const [, , queriesPath, answersPath, ...rest] = process.argv;
if (!queriesPath || !answersPath) die("usage: gate.mjs <queries.json> <answers.json> --authority <AUTHORITY.json> [--out <artifact.json>]");
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
const authorityPath = flag("--authority");
if (!authorityPath) die("--authority <AUTHORITY.json> is required");
const outPath = flag("--out");

let queries, answers, authority;
try { queries = readJson(queriesPath); answers = readJson(answersPath); authority = readJson(authorityPath); }
catch (e) { die(e.message); }

// 0. authority-drift check (fail-closed)
const active = authority.active;
if (!active || !active.ref || !active.path || !/^sha256:[0-9a-f]{64}$/.test(active.sha256 || "")) die("authority.active {ref,path,sha256} required");
let real;
try { real = "sha256:" + sha256hex(readFileSync(path.resolve(path.dirname(authorityPath), active.path))); }
catch (e) { die(`cannot read active authority doc: ${e.message}`); }
if (real !== active.sha256) die(`AUTHORITY DRIFT: ${active.path} recomputes to ${real}, authority file says ${active.sha256}`);

const checks = [];
const failures = [];
const record = (id, ok, detail) => { checks.push({ id, ok, detail }); if (!ok) failures.push(`${id}: ${detail}`); };
const asSet = (a) => new Set(Array.isArray(a) ? a : []);
const setEq = (a, b) => { const x = asSet(a), y = asSet(b); return x.size === y.size && [...x].every((v) => y.has(v)); };

record("resolved_active_authority", answers.resolved_authority_ref === active.ref,
  `reader resolved ${JSON.stringify(answers.resolved_authority_ref)}, expected ${JSON.stringify(active.ref)}`);
record("queries_bound_to_active", queries.governing_authority && queries.governing_authority.ref === active.ref,
  `queries bound to ${JSON.stringify(queries.governing_authority)}, expected ref ${JSON.stringify(active.ref)}`);
const supersededRefs = (authority.superseded || []).map((s) => s.ref).filter(Boolean);
const excluded = asSet(answers.excluded_superseded);
const missing = supersededRefs.filter((r) => !excluded.has(r));
record("excluded_superseded", missing.length === 0,
  missing.length ? `superseded refs not excluded: ${missing.join(", ")}` : "all superseded refs excluded");

const given = answers.answers || {};
for (const q of queries.queries || []) {
  const v = given[q.id];
  let ok;
  if (v === undefined) ok = false;
  else if (q.answer_kind === "set") ok = setEq(v, q.expected);
  else if (q.answer_kind === "boolean" || q.answer_kind === "enum") ok = v === q.expected;
  else ok = false;
  record(`answer:${q.id}`, ok, ok ? "match" : `got ${JSON.stringify(v)} expected ${JSON.stringify(q.expected)}`);
}
for (const id of queries.required_invariants || []) record(`invariant_read:${id}`, asSet(answers.invariants_read).has(id), `invariant ${id} not acknowledged`);
for (const id of queries.required_non_claims || []) record(`non_claim_read:${id}`, asSet(answers.non_claims_read).has(id), `non-claim ${id} not acknowledged`);

const passed = failures.length === 0;
const artifact = {
  gate: "comprehension-gate",
  component: queries.component || null,
  reader: answers.reader || null,
  active_authority: { ref: active.ref, path: active.path, sha256: active.sha256 },
  authority_hash_verified: true,
  comprehension_checks: { passed: checks.filter((c) => c.ok).length, failed: failures.length, checks },
  unresolved: failures,
  result: passed ? "COMPREHENSION_PASSED" : "COMPREHENSION_FAILED",
  implementation_authority: passed ? "GRANTED" : "DENIED"
};
const json = JSON.stringify(artifact, null, 2);
if (outPath) writeFileSync(outPath, json);
console.log(json);
process.exit(passed ? 0 : 3);
```

- [ ] **Step 4: Run to verify it passes**

Run: `node ai-native-memory/tests/test-gate.mjs`
Expected: `test-gate: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add ai-native-memory/scripts/gate.mjs ai-native-memory/tests/test-gate.mjs ai-native-memory/tests/fixtures/gate
git commit -m "feat(ai-native-memory): deterministic comprehension gate + pass/deny/drift fixtures"
```

---

### Task 4: `scripts/audit.mjs` — families 1+2 (three-representation, taxonomy integrity)

**Files:**
- Create: `ai-native-memory/scripts/audit.mjs`
- Create: `ai-native-memory/tests/fixtures/audit/passing/comp/memory/{INVARIANTS.json,INVARIANTS.md,NON-CLAIMS.json,NON-CLAIMS.md,IDENTITY.md,CONTRACTS/example.json,comprehension-queries.json}`
- Create violation trees (each a minimal copy of `passing` with ONE defect):
  `tests/fixtures/audit/v-md-only-invariants/` (delete `INVARIANTS.json`),
  `tests/fixtures/audit/v-invariant-no-oracle/` (an INVARIANTS.json entry without `oracle`),
  `tests/fixtures/audit/v-normative-no-oracle/` (contract `status: NORMATIVE-CURRENT`, empty `oracle.test`),
  `tests/fixtures/audit/v-pending-no-becomes/` (contract `status: SPECIFIED-PENDING-IMPLEMENTATION`, no `becomes_normative_when`),
  `tests/fixtures/audit/v-superseded-loose/` (contract `status: SUPERSEDED`, no `superseded_by`/`must_not_govern_new_work`)
- Test: `ai-native-memory/tests/test-audit.mjs`

**Interfaces:**
- Consumes: `readJson`, `finding`, `printFindings` from `lib/record.mjs`.
- Produces: CLI `node audit.mjs <root-dir>`. Discovers every `**/memory/` directory under root (skipping `node_modules`, `.git`). Exported for tests: `auditMemoryDir(dir) -> findings[]` and `auditRoot(root) -> findings[]`.

- [ ] **Step 1: Write the passing fixture**

`passing/comp/memory/INVARIANTS.json`:
```json
[
  { "id": "inv-read-only", "kind": "invariant", "statement": "The component never writes.", "oracle": "scripts/test-readonly.mjs", "normativity": "NORMATIVE", "status": "NORMATIVE-CURRENT" }
]
```
`passing/comp/memory/NON-CLAIMS.json`:
```json
[
  { "id": "nc-no-proof", "kind": "non-claim", "statement": "Static scan, not a proof or sandbox.", "status": "NORMATIVE-CURRENT" }
]
```
`passing/comp/memory/INVARIANTS.md`: `# Invariants (rendered)\n- inv-read-only: never writes.`
`passing/comp/memory/NON-CLAIMS.md`: `# Non-claims (rendered)\n- nc-no-proof.`
`passing/comp/memory/IDENTITY.md`: `# comp — identity\nWhat it is.`
`passing/comp/memory/CONTRACTS/example.json`:
```json
{
  "kind": "contract", "id": "example", "title": "Example contract",
  "status": "NORMATIVE-CURRENT", "normativity": "NORMATIVE",
  "oracle": { "test": "scripts/test-example.mjs" },
  "lifecycle": "docs-first",
  "decided_by": "human"
}
```
`passing/comp/memory/comprehension-queries.json`:
```json
{ "component": "comp", "governing_authority": { "ref": "A1" }, "queries": [], "required_invariants": [], "required_non_claims": [] }
```

- [ ] **Step 2: Write the failing test**

`ai-native-memory/tests/test-audit.mjs`:
```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditRoot } from "../scripts/audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "audit");
const fails = (dir, check) => auditRoot(path.join(FX, dir)).filter((f) => f.level === "FAIL" && f.check === check);

assert.equal(auditRoot(path.join(FX, "passing")).filter((f) => f.level === "FAIL").length, 0, "passing tree must have 0 FAIL");
assert.ok(fails("v-md-only-invariants", "three-representation").length >= 1, "md-only invariants flagged");
assert.ok(fails("v-invariant-no-oracle", "three-representation").length >= 1, "invariant without oracle flagged");
assert.ok(fails("v-normative-no-oracle", "taxonomy").length >= 1, "NORMATIVE without oracle flagged");
assert.ok(fails("v-pending-no-becomes", "taxonomy").length >= 1, "PENDING without becomes_normative_when flagged");
assert.ok(fails("v-superseded-loose", "taxonomy").length >= 1, "loose SUPERSEDED flagged");
console.log("test-audit: all assertions passed");
```

- [ ] **Step 3: Run to verify it fails**

Run: `node ai-native-memory/tests/test-audit.mjs`
Expected: FAIL — cannot find `../scripts/audit.mjs`

- [ ] **Step 4: Implement families 1+2**

`ai-native-memory/scripts/audit.mjs`:
```js
#!/usr/bin/env node
// audit.mjs — the fail-closed sweep over a host repo's memory record sets.
// Families: three-representation · taxonomy · query-freshness · mirror-sync · staleness.
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, finding, printFindings } from "./lib/record.mjs";

const SKIP = new Set(["node_modules", ".git"]);

export function findMemoryDirs(root) {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isSymbolicLink() || !e.isDirectory() || SKIP.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.name === "memory") out.push(full);
      else walk(full);
    }
  };
  walk(root);
  return out;
}

const rel = (root, p) => path.relative(root, p) || ".";

function auditThreeRep(dir, out, root) {
  const where = rel(root, dir);
  for (const base of ["INVARIANTS", "NON-CLAIMS"]) {
    const j = path.join(dir, base + ".json");
    if (!existsSync(j)) {
      out.push(finding("FAIL", "three-representation", where, `${base}.md/${base} present without machine record ${base}.json (prose-only load-bearing claim)`));
      continue;
    }
    let recs;
    try { recs = readJson(j); } catch (e) { out.push(finding("FAIL", "three-representation", where, e.message)); continue; }
    if (!Array.isArray(recs)) { out.push(finding("FAIL", "three-representation", where, `${base}.json must be an array of records`)); continue; }
    for (const r of recs) {
      if (!r.id || !r.statement) out.push(finding("FAIL", "three-representation", where, `${base}.json entry missing id/statement: ${JSON.stringify(r).slice(0, 80)}`));
      if (base === "INVARIANTS" && !r.oracle) out.push(finding("FAIL", "three-representation", where, `invariant ${r.id} has no oracle ref (NORMATIVE claims need executable verification)`));
    }
    if (!existsSync(path.join(dir, base + ".md"))) out.push(finding("WARN", "three-representation", where, `${base}.json has no rendered ${base}.md projection`));
  }
}

function auditTaxonomy(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (!existsSync(cdir)) return;
  for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
    const p = path.join(cdir, f);
    let c;
    try { c = readJson(p); } catch (e) { out.push(finding("FAIL", "taxonomy", where, e.message)); continue; }
    const st = c.status;
    if (st === "NORMATIVE-CURRENT" && !(c.oracle && c.oracle.test)) out.push(finding("FAIL", "taxonomy", `${where}/CONTRACTS/${f}`, "status NORMATIVE-CURRENT without oracle.test (prose without an oracle is ADVISORY)"));
    if (st === "SPECIFIED-PENDING-IMPLEMENTATION" && !c.becomes_normative_when) out.push(finding("FAIL", "taxonomy", `${where}/CONTRACTS/${f}`, "SPECIFIED-PENDING-IMPLEMENTATION requires becomes_normative_when"));
    if (st === "SUPERSEDED" && !(c.superseded_by && c.must_not_govern_new_work === true)) out.push(finding("FAIL", "taxonomy", `${where}/CONTRACTS/${f}`, "SUPERSEDED requires superseded_by + must_not_govern_new_work:true"));
    if (!c.lifecycle) out.push(finding("WARN", "taxonomy", `${where}/CONTRACTS/${f}`, "no lifecycle field (truthful build order: docs-first | build-first-then-ratified)"));
    if (!c.decided_by && c.kind === "decision") out.push(finding("WARN", "taxonomy", `${where}/CONTRACTS/${f}`, "decision without decided_by provenance"));
  }
}

export function auditMemoryDir(dir, root = dir) {
  const out = [];
  auditThreeRep(dir, out, root);
  auditTaxonomy(dir, out, root);
  return out;
}

export function auditRoot(root) {
  const out = [];
  for (const dir of findMemoryDirs(root)) out.push(...auditMemoryDir(dir, root));
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || ".");
  if (!existsSync(root) || !statSync(root).isDirectory()) { console.error(`audit: not a directory: ${root}`); process.exit(1); }
  process.exit(printFindings(auditRoot(root), "audit"));
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node ai-native-memory/tests/test-audit.mjs`
Expected: `test-audit: all assertions passed`

- [ ] **Step 6: Commit**

```bash
git add ai-native-memory/scripts/audit.mjs ai-native-memory/tests/test-audit.mjs ai-native-memory/tests/fixtures/audit
git commit -m "feat(ai-native-memory): audit families 1-2 (three-representation, taxonomy) + per-branch fixtures"
```

---

### Task 5: audit families 3+4+5 (query-freshness, mirror-sync, staleness)

**Files:**
- Modify: `ai-native-memory/scripts/audit.mjs` (add three functions + wire into `auditMemoryDir`/`auditRoot`)
- Create violation fixtures:
  `tests/fixtures/audit/v-stale-query/` (queries file with `derived_from` pointing at a contract value that differs),
  `tests/fixtures/audit/v-mirror-drift/` (a record with `mirror_of` whose values ≠ source),
  `tests/fixtures/audit/v-dangling-anchor/` (a contract whose `authority.source_path` names a missing file),
  `tests/fixtures/audit/v-authority-drift/` (root `AUTHORITY.json` whose active.sha256 ≠ doc bytes)
- Modify: `ai-native-memory/tests/test-audit.mjs` (add four assertions)
- Modify: `tests/fixtures/audit/passing/` (add the healthy counterparts so the passing tree exercises all families)

**Interfaces:**
- Produces: query conventions — a query MAY carry `"derived_from": { "file": "<path relative to the memory dir>", "pointer": "<dot.path>" }`; audit recomputes the value at pointer and compares to `expected` (deep-equal; FAIL `query-freshness` on mismatch, WARN if file/pointer unresolvable). A record MAY carry `"mirror_of": { "file": "<path relative to memory dir>", "pointer": "<dot.path>" }` + `"values": <array|object>`; audit deep-compares (FAIL `mirror-sync`). Contracts MAY carry `"authority": { "source_path": "<path relative to repo root>" }`; missing file = FAIL `staleness`. Repo-root `AUTHORITY.json` (if present at the audited root): active doc hash must match disk (FAIL `staleness`).

- [ ] **Step 1: Add healthy counterparts to `passing/`**

To `passing/comp/memory/comprehension-queries.json`, replace `queries: []` with:
```json
"queries": [
  { "id": "q-status", "query": "Contract status?", "answer_kind": "enum", "expected": "NORMATIVE-CURRENT",
    "derived_from": { "file": "CONTRACTS/example.json", "pointer": "status" } }
]
```
To `passing/comp/memory/CONTRACTS/example.json` add:
```json
"mirror_of": null
```
(omit — instead add a healthy mirror record) Create `passing/comp/memory/CONTRACTS/mirror.json`:
```json
{
  "kind": "contract", "id": "mirror", "title": "Mirrored closed set", "status": "NORMATIVE-CURRENT",
  "normativity": "NORMATIVE", "oracle": { "test": "scripts/test-example.mjs" }, "lifecycle": "docs-first",
  "mirror_of": { "file": "CONTRACTS/example.json", "pointer": "oracle.test" },
  "values": "scripts/test-example.mjs"
}
```
Create `passing/AUTHORITY.json` + `passing/authority-doc.md` with a correct hash (same technique as Task 3 Step 1).

- [ ] **Step 2: Add the four violation fixtures** (each = copy of `passing` with one defect as named above; for `v-stale-query` change the contract's `status` to `"ADVISORY"` while the query still expects `"NORMATIVE-CURRENT"`; for `v-mirror-drift` change `mirror.json`.`values` to `"scripts/other.mjs"`; for `v-dangling-anchor` add `"authority": { "source_path": "does/not/exist.md" }` to `example.json`; for `v-authority-drift` append a byte to `authority-doc.md` without updating `AUTHORITY.json`).

- [ ] **Step 3: Add failing assertions to `test-audit.mjs`**

```js
assert.ok(fails("v-stale-query", "query-freshness").length >= 1, "stale derived query flagged");
assert.ok(fails("v-mirror-drift", "mirror-sync").length >= 1, "mirror drift flagged");
assert.ok(fails("v-dangling-anchor", "staleness").length >= 1, "dangling anchor flagged");
assert.ok(fails("v-authority-drift", "staleness").length >= 1, "authority drift flagged");
```

Run: `node ai-native-memory/tests/test-audit.mjs` — Expected: the new assertions FAIL.

- [ ] **Step 4: Implement the three families in `audit.mjs`**

Add:
```js
import { readFileSync } from "node:fs";
import { sha256hex } from "./lib/record.mjs";

const dig = (obj, pointer) => pointer.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function auditQueryFreshness(dir, out, root) {
  const where = rel(root, dir);
  const qp = path.join(dir, "comprehension-queries.json");
  if (!existsSync(qp)) return;
  let q;
  try { q = readJson(qp); } catch (e) { out.push(finding("FAIL", "query-freshness", where, e.message)); return; }
  for (const query of q.queries || []) {
    if (!query.derived_from) { out.push(finding("WARN", "query-freshness", where, `query ${query.id}: no derived_from — expected fact is not machine-derivable`)); continue; }
    const src = path.join(dir, query.derived_from.file);
    if (!existsSync(src)) { out.push(finding("WARN", "query-freshness", where, `query ${query.id}: derived_from file missing: ${query.derived_from.file}`)); continue; }
    let actual;
    try { actual = dig(readJson(src), query.derived_from.pointer); } catch (e) { out.push(finding("WARN", "query-freshness", where, e.message)); continue; }
    const expected = query.answer_kind === "set" ? [...(query.expected || [])].sort() : query.expected;
    const got = query.answer_kind === "set" && Array.isArray(actual) ? [...actual].sort() : actual;
    if (!deepEq(expected, got)) out.push(finding("FAIL", "query-freshness", where, `query ${query.id}: expected ${JSON.stringify(query.expected)} but source now says ${JSON.stringify(actual)} (queries drifted from the contract)`));
  }
}

function auditMirrorSync(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (!existsSync(cdir)) return;
  for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
    let c;
    try { c = readJson(path.join(cdir, f)); } catch { continue; } // parse errors already FAILed in taxonomy
    if (!c.mirror_of) continue;
    const src = path.join(dir, c.mirror_of.file);
    if (!existsSync(src)) { out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, `mirror source missing: ${c.mirror_of.file}`)); continue; }
    const actual = dig(readJson(src), c.mirror_of.pointer);
    if (!deepEq(c.values, actual)) out.push(finding("FAIL", "mirror-sync", `${where}/CONTRACTS/${f}`, `mirror values ${JSON.stringify(c.values)} != source ${JSON.stringify(actual)} (declared mirror rotted)`));
  }
}

function auditStaleness(dir, out, root) {
  const where = rel(root, dir);
  const cdir = path.join(dir, "CONTRACTS");
  if (existsSync(cdir)) {
    for (const f of readdirSync(cdir).filter((f) => f.endsWith(".json"))) {
      let c;
      try { c = readJson(path.join(cdir, f)); } catch { continue; }
      const sp = c.authority && c.authority.source_path;
      if (sp && !existsSync(path.join(root, sp))) out.push(finding("FAIL", "staleness", `${where}/CONTRACTS/${f}`, `authority.source_path does not resolve: ${sp}`));
    }
  }
}

function auditAuthorityRoot(root, out) {
  const ap = path.join(root, "AUTHORITY.json");
  if (!existsSync(ap)) return;
  let a;
  try { a = readJson(ap); } catch (e) { out.push(finding("FAIL", "staleness", "AUTHORITY.json", e.message)); return; }
  const act = a.active;
  if (!act || !act.path || !act.sha256) { out.push(finding("FAIL", "staleness", "AUTHORITY.json", "active {path,sha256} required")); return; }
  const doc = path.join(root, act.path);
  if (!existsSync(doc)) { out.push(finding("FAIL", "staleness", "AUTHORITY.json", `active doc missing: ${act.path}`)); return; }
  const real = "sha256:" + sha256hex(readFileSync(doc));
  if (real !== act.sha256) out.push(finding("FAIL", "staleness", "AUTHORITY.json", `active doc drifted: disk ${real} != pinned ${act.sha256}`));
}
```
Wire in: `auditMemoryDir` additionally calls `auditQueryFreshness(dir,out,root)`, `auditMirrorSync(dir,out,root)`, `auditStaleness(dir,out,root)`; `auditRoot` calls `auditAuthorityRoot(root,out)` before the loop.

- [ ] **Step 5: Run the full audit test**

Run: `node ai-native-memory/tests/test-audit.mjs`
Expected: `test-audit: all assertions passed` (passing tree still 0 FAIL — the healthy counterparts satisfy all five families)

- [ ] **Step 6: Commit**

```bash
git add ai-native-memory/scripts/audit.mjs ai-native-memory/tests
git commit -m "feat(ai-native-memory): audit families 3-5 (query-freshness, mirror-sync, staleness) + fixtures"
```

---

### Task 6: `scripts/verify.mjs` — contracts == reality

**Files:**
- Create: `ai-native-memory/scripts/verify.mjs`
- Create: `tests/fixtures/verify/{verify-map.json,contract.json,oracle-pass.mjs,oracle-fail.mjs,verify-map-fail.json,verify-map-missing.json}`
- Test: `ai-native-memory/tests/test-verify.mjs`

**Interfaces:**
- Produces: CLI `node verify.mjs <verify-map.json>`. Map schema: `[ { "contract": "<path>", "oracle": "<node script path>", "cwd": "<optional dir>" } ]` (paths relative to the map file). For each entry: contract file must exist and parse; oracle script is run with `node`; exit 0 required. Findings check name: `verify`.

- [ ] **Step 1: Fixtures**

`tests/fixtures/verify/contract.json`: `{ "kind": "contract", "id": "c1", "status": "NORMATIVE-CURRENT", "oracle": { "test": "oracle-pass.mjs" } }`
`tests/fixtures/verify/oracle-pass.mjs`: `process.exit(0);`
`tests/fixtures/verify/oracle-fail.mjs`: `console.error("oracle failed"); process.exit(1);`
`tests/fixtures/verify/verify-map.json`: `[ { "contract": "contract.json", "oracle": "oracle-pass.mjs" } ]`
`tests/fixtures/verify/verify-map-fail.json`: `[ { "contract": "contract.json", "oracle": "oracle-fail.mjs" } ]`
`tests/fixtures/verify/verify-map-missing.json`: `[ { "contract": "nope.json", "oracle": "oracle-pass.mjs" } ]`

- [ ] **Step 2: Failing test**

`ai-native-memory/tests/test-verify.mjs`:
```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.join(HERE, "fixtures", "verify");
const V = path.join(HERE, "..", "scripts", "verify.mjs");
const run = (map) => spawnSync(process.execPath, [V, path.join(FX, map)], { encoding: "utf8" });
assert.equal(run("verify-map.json").status, 0, "all-green map exits 0");
assert.equal(run("verify-map-fail.json").status, 2, "failing oracle exits 2");
assert.equal(run("verify-map-missing.json").status, 2, "missing contract exits 2");
console.log("test-verify: all assertions passed");
```

Run: `node ai-native-memory/tests/test-verify.mjs` — Expected: FAIL (no verify.mjs).

- [ ] **Step 3: Implement**

`ai-native-memory/scripts/verify.mjs`:
```js
#!/usr/bin/env node
// verify.mjs — proves each NORMATIVE contract equals what reality enforces, by running
// the oracle the host names for it. Exit 0 only if every pair is green.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readJson, finding, printFindings } from "./lib/record.mjs";

const mapPath = process.argv[2];
if (!mapPath) { console.error("usage: verify.mjs <verify-map.json>"); process.exit(1); }
let map;
try { map = readJson(mapPath); } catch (e) { console.error("VERIFY_ERROR: " + e.message); process.exit(1); }
if (!Array.isArray(map)) { console.error("VERIFY_ERROR: verify-map must be an array"); process.exit(1); }
const base = path.dirname(path.resolve(mapPath));
const out = [];
for (const entry of map) {
  const cpath = path.resolve(base, entry.contract || "");
  if (!existsSync(cpath)) { out.push(finding("FAIL", "verify", entry.contract, "contract file missing")); continue; }
  try { readJson(cpath); } catch (e) { out.push(finding("FAIL", "verify", entry.contract, e.message)); continue; }
  const opath = path.resolve(base, entry.oracle || "");
  if (!existsSync(opath)) { out.push(finding("FAIL", "verify", entry.contract, `oracle missing: ${entry.oracle}`)); continue; }
  const r = spawnSync(process.execPath, [opath], { cwd: entry.cwd ? path.resolve(base, entry.cwd) : base, encoding: "utf8" });
  if (r.status !== 0) out.push(finding("FAIL", "verify", entry.contract, `oracle ${entry.oracle} exited ${r.status}: ${(r.stderr || r.stdout || "").trim().slice(0, 200)}`));
}
process.exit(printFindings(out, "verify"));
```

- [ ] **Step 4: Run to verify pass** — `node ai-native-memory/tests/test-verify.mjs` → `test-verify: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add ai-native-memory/scripts/verify.mjs ai-native-memory/tests/test-verify.mjs ai-native-memory/tests/fixtures/verify
git commit -m "feat(ai-native-memory): verify.mjs — contract/oracle pairs, fail-closed"
```

---

### Task 7: `scripts/init.mjs` — the scaffolder

**Files:**
- Create: `ai-native-memory/scripts/init.mjs`
- Test: `ai-native-memory/tests/test-init.mjs`

**Interfaces:**
- Produces: CLI `node init.mjs <repo-root> [component-dir]`. Idempotent (never overwrites an existing file; prints `skip:` lines). First run at a root also writes `AI-START-HERE.md`, `AUTHORITY.json` (with `active: null` and a comment field telling the human to bind it), `LOAD-ORDER.json`. With `component-dir`, writes the per-component `memory/` skeleton. Every scaffolded contract starts `"status": "SPECIFIED-PENDING-IMPLEMENTATION", "becomes_normative_when": ""` — with the empty `becomes_normative_when` deliberately left for the author to fill (the audit will WARN-not-FAIL on empty-string via the taxonomy rule only when status demands it; scaffold sets it to the literal string `"NAME-THE-ORACLE-TEST-FILE"` so audit FAILs until the author makes it true — honest from minute one).

- [ ] **Step 1: Failing test**

`ai-native-memory/tests/test-init.mjs`:
```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const INIT = path.join(HERE, "..", "scripts", "init.mjs");
const root = mkdtempSync(path.join(tmpdir(), "anm-init-"));
try {
  const r1 = spawnSync(process.execPath, [INIT, root, "widget"], { encoding: "utf8" });
  assert.equal(r1.status, 0, r1.stderr);
  for (const f of ["AI-START-HERE.md", "AUTHORITY.json", "LOAD-ORDER.json",
    "widget/memory/IDENTITY.md", "widget/memory/INVARIANTS.json", "widget/memory/NON-CLAIMS.json",
    "widget/memory/CONTRACTS/component.json", "widget/memory/comprehension-queries.json",
    "widget/memory/DECISIONS/rejected-alternatives.md", "widget/memory/FAILURE-MODES.md"]) {
    assert.ok(existsSync(path.join(root, f)), `scaffolded: ${f}`);
  }
  // idempotent: second run must not overwrite (marker survives)
  const marker = path.join(root, "widget/memory/IDENTITY.md");
  const orig = readFileSync(marker, "utf8");
  const r2 = spawnSync(process.execPath, [INIT, root, "widget"], { encoding: "utf8" });
  assert.equal(r2.status, 0);
  assert.equal(readFileSync(marker, "utf8"), orig, "no overwrite");
  // scaffolded contract is honest: SPECIFIED-PENDING
  const c = JSON.parse(readFileSync(path.join(root, "widget/memory/CONTRACTS/component.json"), "utf8"));
  assert.equal(c.status, "SPECIFIED-PENDING-IMPLEMENTATION");
} finally { rmSync(root, { recursive: true, force: true }); }
console.log("test-init: all assertions passed");
```

Run: `node ai-native-memory/tests/test-init.mjs` — Expected: FAIL.

- [ ] **Step 2: Implement**

`ai-native-memory/scripts/init.mjs`:
```js
#!/usr/bin/env node
// init.mjs — scaffolds a machine-first record set. Idempotent: never overwrites.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , rootArg, componentArg] = process.argv;
if (!rootArg) { console.error("usage: init.mjs <repo-root> [component-dir]"); process.exit(1); }
const root = path.resolve(rootArg);
const put = (rel, content) => {
  const p = path.join(root, rel);
  if (existsSync(p)) { console.log(`skip: ${rel}`); return; }
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log(`write: ${rel}`);
};

put("AI-START-HERE.md", `# AI START HERE

You are inheriting an institution, not just source code. Do not begin from a confident guess.

Read in this order (see LOAD-ORDER.json):
1. This file.
2. AUTHORITY.json — the active governing authority. If active is null, a human must bind it before any record can claim NORMATIVE status.
3. Each component's memory/IDENTITY.md, then its CONTRACTS/.

Rules: machine records are the source of truth; human docs are rendered projections. A claim is NORMATIVE only with a passing oracle. No implementation authority until the comprehension gate GRANTS it.
`);
put("AUTHORITY.json", JSON.stringify({
  note: "Bind active to the governing document: { ref, path, sha256: 'sha256:<64hex of raw bytes>' }. Superseded entries must never govern new work.",
  active: null,
  superseded: []
}, null, 2) + "\n");
put("LOAD-ORDER.json", JSON.stringify({
  note: "Minimal reading order for a fresh model. Load slim: stop when the task's component is loaded.",
  order: ["AI-START-HERE.md", "AUTHORITY.json", "<component>/memory/IDENTITY.md", "<component>/memory/INVARIANTS.json", "<component>/memory/CONTRACTS/", "<component>/memory/NON-CLAIMS.json"]
}, null, 2) + "\n");

if (componentArg) {
  const m = path.join(componentArg, "memory");
  const name = path.basename(componentArg);
  put(path.join(m, "IDENTITY.md"), `# ${name} — identity\n\nWhat this component IS and is NOT, in two paragraphs. State the boundary.\n`);
  put(path.join(m, "INVARIANTS.json"), JSON.stringify([
    { id: `${name}-example-invariant`, kind: "invariant", statement: "REPLACE: a load-bearing always-true property.", oracle: "NAME-THE-ORACLE-TEST-FILE", normativity: "NORMATIVE", status: "SPECIFIED-PENDING-IMPLEMENTATION" }
  ], null, 2) + "\n");
  put(path.join(m, "INVARIANTS.md"), `# ${name} — invariants (rendered)\n\nRendered projection of INVARIANTS.json. Regenerate; do not hand-edit facts here.\n`);
  put(path.join(m, "NON-CLAIMS.json"), JSON.stringify([
    { id: `${name}-example-non-claim`, kind: "non-claim", statement: "REPLACE: something this component deliberately does NOT do or prove.", status: "NORMATIVE-CURRENT" }
  ], null, 2) + "\n");
  put(path.join(m, "NON-CLAIMS.md"), `# ${name} — non-claims (rendered)\n`);
  put(path.join(m, "CONTRACTS", "component.json"), JSON.stringify({
    kind: "contract", id: `${name}-component`, title: `${name} — frozen semantics`,
    status: "SPECIFIED-PENDING-IMPLEMENTATION", normativity: "NORMATIVE",
    becomes_normative_when: "NAME-THE-ORACLE-TEST-FILE",
    lifecycle: "docs-first", decided_by: "human",
    oracle: { test: "" }
  }, null, 2) + "\n");
  put(path.join(m, "comprehension-queries.json"), JSON.stringify({
    component: name, governing_authority: { ref: "BIND-TO-AUTHORITY-REF" },
    required_invariants: [], required_non_claims: [], queries: []
  }, null, 2) + "\n");
  put(path.join(m, "DECISIONS", "rejected-alternatives.md"), `# ${name} — rejected alternatives\n\nPreserve every rejected path so a successor does not rediscover it as novel.\n`);
  put(path.join(m, "FAILURE-MODES.md"), `# ${name} — failure modes\n\nHow it fails, and that it fails closed.\n`);
  put(path.join(m, "EVIDENCE", "README.md"), `# ${name} — evidence\n\nPointers to oracle runs and golden data.\n`);
}
```

- [ ] **Step 3: Run to verify pass** — `node ai-native-memory/tests/test-init.mjs` → `test-init: all assertions passed`

- [ ] **Step 4: Run the whole suite + syntax check**

Run: `cd ai-native-memory && npm run check && npm test`
Expected: check clean; `run: 5/5 test files passed`

- [ ] **Step 5: Commit**

```bash
git add ai-native-memory/scripts/init.mjs ai-native-memory/tests/test-init.mjs
git commit -m "feat(ai-native-memory): init.mjs scaffolder — idempotent, honest SPECIFIED-PENDING templates"
```

---

### Task 8: The three skills

**Files:**
- Create: `ai-native-memory/skills/memory-standard/SKILL.md`
- Create: `ai-native-memory/skills/memory-authoring/SKILL.md`
- Create: `ai-native-memory/skills/memory-lifecycle/SKILL.md`

Content source: the approved spec (`docs/superpowers/specs/2026-07-18-ai-native-memory-plugin-design.md`) — the Skills section defines each skill's content; expand each bullet into full prose. The load-bearing verbatim rules each SKILL.md MUST contain:

- [ ] **Step 1: `memory-standard/SKILL.md`** — frontmatter `name: memory-standard`, `description: Use when authoring or evaluating documentation intended to be inherited by an AI model — machine-first records, executable oracles, closed taxonomies`. Body MUST include, verbatim: the purpose sentence ("Documentation whose inheritor is an AI model: a memoryless successor must reconstruct the system's intended reality without filling gaps with plausible invention."); the five disciplines (authority-anchored · NORMATIVE-requires-oracle · three representations · machine-first/human-rendered · reading ≠ understanding); the closed record kinds `mechanism · decision · rejected-alternative · non-claim · invariant · open-question · contract · evidence`; the status taxonomy `NORMATIVE-CURRENT · SUPERSEDED · SPECIFIED-PENDING-IMPLEMENTATION (+becomes_normative_when) · RATIFICATION-PENDING · MODEL-PROPOSAL · REJECTED-ALTERNATIVE · OPEN-QUESTION · HUMAN-AUTHORIZED-EXCEPTION · ADVISORY`; and the eight hardenings, each with its one-line origin story from the spec's hardenings table.

- [ ] **Step 2: `memory-authoring/SKILL.md`** — frontmatter `name: memory-authoring`, `description: Use when writing institutional-memory records — scaffolding, content addressing, anchors, mirrors, decision provenance, load order`. Body: the scaffold layout (as `init.mjs` produces); content addressing (`"sha256:" + sha256hex(canonicalize(record minus id))`); anchor forms (content hash / file-at-commit / commit / ledger entry); `derived_from` on queries (hardening 1); `mirror_of` + `values` on mirrored sets (hardening 4); `decided_by: human | model-advisory-adopted-by-human` (hardening 8); `lifecycle: docs-first | build-first-then-ratified` (hardening 3); LOAD-ORDER.json + "load slim" guidance (hardening 7); render/drift rule (machine → rendered .md; regenerate, never hand-edit facts).

- [ ] **Step 3: `memory-lifecycle/SKILL.md`** — frontmatter `name: memory-lifecycle`, `description: Use when governing changes to a system with institutional memory — stage order, comprehension-gated authority, deferred ratification, supersession`. Body: the stage order (pre-review → adversarial plan workshop → authorization council → comprehension-gated implementation authority → oracles green → host-index integration → retrospective); the workshop drift-monitor discriminators (objection count trending down = converging; re-raised verified-false finding = malfunction; out-of-lane thread = drift, quarantine + escalate once) (hardening 6); deferred ratification as a RECORDED exception (the truth lives inside the hashed record); supersession protocol (registry entry + `must_not_govern_new_work: true` + successor link; retired authority must never look like a second valid authority); the human authority gate (a human role the host assigns; models advise, humans rule, records attribute).

- [ ] **Step 4: Commit**

```bash
git add ai-native-memory/skills
git commit -m "feat(ai-native-memory): the three skills — standard, authoring, lifecycle"
```

---

### Task 9: Commands + agents

**Files:**
- Create: `ai-native-memory/commands/{memory-init,memory-audit,memory-verify,memory-gate}.md`
- Create: `ai-native-memory/agents/{memory-auditor,comprehension-grader,adversarial-reviewer}.md`

- [ ] **Step 1: The four commands.** Each is markdown with frontmatter `description:` and a body instructing Claude to run the plugin script with `${CLAUDE_PLUGIN_ROOT}`. Complete content for `memory-audit.md` (the others follow the same pattern with their script + args as defined in Tasks 3/6/7):

```markdown
---
description: Audit the repo's institutional-memory record sets (three-representation, taxonomy, query-freshness, mirror-sync, staleness). Fail-closed.
---

Run the audit oracle against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/audit.mjs ${1:-.}`

Report the findings verbatim (JSON lines + summary). Exit 2 means FAIL findings exist — list each with its check family and the minimal fix. Do NOT soften findings; the audit is fail-closed by design. If the user wants interpretation (root causes, fix ordering), suggest the memory-auditor agent.
```

`memory-init.md`: description "Scaffold a machine-first institutional-memory record set"; body runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs ${1:-.} ${2:-}` and then tells the author the honest-scaffold rule (everything starts SPECIFIED-PENDING; replace REPLACE markers; bind AUTHORITY.json).
`memory-verify.md`: description "Prove NORMATIVE contracts equal reality via the host's verify-map"; body runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs ${1:-verify-map.json}`.
`memory-gate.md`: description "Grade a reader's answers deterministically; GRANT or DENY implementation authority"; body runs `node ${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs <queries> <answers> --authority <AUTHORITY.json> --out <artifact>` and states: exit 0 GRANTED / 3 DENIED / 1 the authority itself is drifted (fix the authority before certifying anyone).

- [ ] **Step 2: The three agents.** Each markdown with frontmatter (`name`, `description`, `tools: Read, Grep, Glob, Bash`). Bodies (complete, from the spec's Agents section):

`memory-auditor.md` — role: run `audit.mjs` + `verify.mjs`, then interpret: rank findings by blast (dangling authority anchor > stale as_of), trace root causes (did the contract move or the mirror rot?), distinguish drifted-together from genuinely-current, output the minimal ordered fix list. HARD RULES: read-only — report, never edit; never soften a FAIL; if the authority file itself is drifted, that finding outranks everything.

`comprehension-grader.md` — role: for a named component, author deterministic queries FROM the machine records (every `expected` carries `derived_from` so it terminates in a contract value, never model opinion); generate negative answer fixtures each flipping exactly one answer; run the gate to prove pass→0 and every negative→3; when contracts change, re-derive and update queries. HARD RULES: an expected fact with no `derived_from` must be justified in a comment; never author a query whose answer is opinion.

`adversarial-reviewer.md` — role: adversarially review a candidate record set or plan; each round return structured objections `{scope, claim, severity}`; AND self-score the round against the drift discriminators: objection count vs. last round (down = converging), any re-raise of a finding previously refuted with evidence (= malfunction — flag it on YOURSELF and drop the claim), any thread outside the technical lane (design escalated to governance = drift: quarantine, note it for the human authority gate, do not re-raise). Verdict per round: `converged | needs-work | i-am-drifting`. HARD RULES: verify claims against the actual files before asserting; an empty objection list must mean genuinely nothing found.

- [ ] **Step 3: Commit**

```bash
git add ai-native-memory/commands ai-native-memory/agents
git commit -m "feat(ai-native-memory): commands + agent suite (auditor, grader, adversarial reviewer)"
```

---

### Task 10: Dogfood — the plugin's own record set + dogfood test

**Files:**
- Create: `ai-native-memory/AUTHORITY.json` + `ai-native-memory/memory/{IDENTITY.md,INVARIANTS.json,INVARIANTS.md,NON-CLAIMS.json,NON-CLAIMS.md,CONTRACTS/plugin.json,comprehension-queries.json,DECISIONS/rejected-alternatives.md,FAILURE-MODES.md,EVIDENCE/README.md}`
- Create: `ai-native-memory/memory/answers-example.json`, `ai-native-memory/verify-map.json`
- Test: `ai-native-memory/tests/test-dogfood.mjs`

**Interfaces:**
- Consumes: `auditRoot` (Task 4/5), `gate.mjs` CLI (Task 3), `verify.mjs` CLI (Task 6).

- [ ] **Step 1: Author the record set** (machine-first, real content — the plugin described in its own format):
  - `AUTHORITY.json`: active = `{ ref: "spec-2026-07-18", path: "../docs/superpowers/specs/2026-07-18-ai-native-memory-plugin-design.md", sha256: <computed raw-byte hash> }`, superseded `[]`.
  - `INVARIANTS.json` (each with real oracle refs): `anm-zero-dependencies` (oracle `tests/test-dogfood.mjs`), `anm-fail-closed-exits` (oracle `tests/test-gate.mjs` + `tests/test-audit.mjs` — one entry per, or one invariant citing run.mjs), `anm-no-host-imports` (statement: scripts import only node:* and in-plugin paths; oracle `tests/test-dogfood.mjs`), `anm-every-check-can-fail` (oracle `tests/test-audit.mjs` — the violation fixtures).
  - `NON-CLAIMS.json`: `anm-audit-not-a-proof` (static checks, not semantic proof); `anm-no-authority-authentication` (hash pinning ≠ publisher identity); `anm-agents-advise` (agents report; humans and host CI decide).
  - `CONTRACTS/plugin.json`: status `NORMATIVE-CURRENT`, `lifecycle: "docs-first"`, `decided_by: "human"`, oracle `{ test: "tests/run.mjs" }`, plus `mirror_of: null` omitted; carries the closed sets (record kinds, statuses) as data with a `derived_from`-able shape.
  - `comprehension-queries.json`: governing_authority ref `spec-2026-07-18`; queries with `derived_from` into `CONTRACTS/plugin.json` (e.g. q `plugin-status` expects `NORMATIVE-CURRENT` derived from `status`; q `zero-deps` boolean expects `true` derived from a `zero_dependencies: true` field in the contract; q `exit-codes` set expects `["0","1","2","3"]` derived from a `exit_codes` array field). required_invariants: all four invariant ids; required_non_claims: all three.
  - `answers-example.json`: the correct reader answers (resolved_authority_ref `spec-2026-07-18`, excluded_superseded `[]`, all ids read, all answers correct).
  - `verify-map.json`: `[ { "contract": "memory/CONTRACTS/plugin.json", "oracle": "tests/run.mjs" } ]` — NOTE: run.mjs would recurse into test-dogfood → itself; instead point the oracle at `tests/test-lib.mjs` (a real, terminating oracle) and note in the contract that the full suite is the CI entry.

- [ ] **Step 2: Write the dogfood test**

`ai-native-memory/tests/test-dogfood.mjs`:
```js
#!/usr/bin/env node
// The inheritance proof: the plugin audits, gates, and verifies ITSELF.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditRoot } from "../scripts/audit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

// 1. self-audit: zero FAIL findings on the plugin's own record set
const findings = auditRoot(ROOT).filter((f) => f.level === "FAIL");
assert.deepEqual(findings, [], "self-audit clean: " + JSON.stringify(findings));

// 2. self-gate: the example answers GRANT; a flipped answer DENIES
const gate = (answers) => spawnSync(process.execPath, [path.join(ROOT, "scripts", "gate.mjs"),
  path.join(ROOT, "memory", "comprehension-queries.json"), answers,
  "--authority", path.join(ROOT, "AUTHORITY.json")], { encoding: "utf8" });
assert.equal(gate(path.join(ROOT, "memory", "answers-example.json")).status, 0, "self-gate GRANTED");
// negative: flip one answer in a temp copy
import { writeFileSync, rmSync } from "node:fs";
const a = JSON.parse(readFileSync(path.join(ROOT, "memory", "answers-example.json"), "utf8"));
a.answers[Object.keys(a.answers)[0]] = "WRONG";
const tmp = path.join(HERE, "tmp-neg-answers.json");
writeFileSync(tmp, JSON.stringify(a));
try { assert.equal(gate(tmp).status, 3, "flipped answer DENIED"); } finally { rmSync(tmp); }

// 3. self-verify
const v = spawnSync(process.execPath, [path.join(ROOT, "scripts", "verify.mjs"), path.join(ROOT, "verify-map.json")], { encoding: "utf8" });
assert.equal(v.status, 0, "self-verify green: " + v.stdout);

// 4. no-host-imports: every script imports only node:* or ./ paths
const scan = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { scan(full); continue; }
    if (!e.name.endsWith(".mjs")) continue;
    for (const m of readFileSync(full, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(m[1].startsWith("node:") || m[1].startsWith("."), `${e.name}: non-portable import ${m[1]}`);
    }
  }
};
scan(path.join(ROOT, "scripts"));
console.log("test-dogfood: all assertions passed");
```

- [ ] **Step 3: Run the full suite** — `cd ai-native-memory && npm run check && npm test`
Expected: `run: 6/6 test files passed`. Iterate on the record set until the self-audit is genuinely clean (fix the records, never weaken the audit).

- [ ] **Step 4: Commit**

```bash
git add ai-native-memory
git commit -m "feat(ai-native-memory): dogfood — the plugin's own record set, self-audit/gate/verify green"
```

---

### Task 11: Classify into the host registry (AM-40 conscious classification)

**Files:**
- Modify: `clotho/inventory.mjs` (PACKAGE_ROOTS_EXCLUDE + `"ai-native-memory"`, keep sorted)
- Modify: `clotho/memory/CONTRACTS/package-roots.json` (same, lockstep)
- Modify: `clotho/scripts/test-inventory.mjs` (the frozen expected array gains `"ai-native-memory"`)
- Modify: `docs/institutional-memory/iliad/CONTRACTS/enrollment.json` (`deferred_pending_conscious_enrollment` gains `"ai-native-memory"`, sorted)

**Interfaces:**
- Consumes: the host completeness contract — a new `package.json` dir FAILS classification until consciously assigned.

- [ ] **Step 1: Make the four lockstep edits** (each array gains `"ai-native-memory"` in sorted position — it sorts first, before `"ai-forge"`? No: `"ai-forge" < "ai-native-memory"` lexicographically (`f` < `n`), so it goes AFTER `ai-forge`: `["ai-forge", "ai-native-memory", "forge", "narcissus/flagship", "saas-forge"]`).

- [ ] **Step 2: Verify the host stays green**

Run: `cd clotho && npm run check && node scripts/test-inventory.mjs && cd .. && node docs/institutional-memory/verify-contracts.mjs | tail -1`
Expected: `test-inventory: all assertions passed`; `-> 211/211 contracts match system reality` (the deferred==exclusions cross-check sees both lists updated).

- [ ] **Step 3: Commit**

```bash
git add clotho/inventory.mjs clotho/memory/CONTRACTS/package-roots.json clotho/scripts/test-inventory.mjs docs/institutional-memory/iliad/CONTRACTS/enrollment.json
git commit -m "chore: classify ai-native-memory into package_roots_exclude + deferred registry (AM-40 conscious classification)"
```

---

## Self-Review (done at authoring)

- **Spec coverage:** scaffold+manifest (T1) · vendored lib (T2) · gate (T3) · audit all five families (T4-5) · verify (T6) · init (T7) · three skills (T8) · four commands + three agents (T9) · dogfood record set + inheritance proof (T10) · host classification (T11). Hardenings: 1→T5 query-freshness · 2→T4 three-rep · 3→`lifecycle` field T4/T8 · 4→T5 mirror-sync · 5→T5 staleness · 6→T9 adversarial-reviewer · 7→T7 LOAD-ORDER + T8 authoring · 8→`decided_by` T4/T8. Exit codes global. Dogfood = spec's acceptance. ✔
- **Placeholders:** none — every code step carries complete code; skills/commands content is specified with its load-bearing text and its source (the committed spec) named. ✔
- **Type consistency:** `finding{level,check,path,detail}` used identically in audit/verify tests; gate exit codes 0/3/1 consistent between T3 impl and T10 dogfood; `auditRoot` signature consistent T4→T10. ✔
