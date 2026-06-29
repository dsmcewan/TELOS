# ai-forge Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `ai-forge/` — a pattern-parameterized sibling of `saas-forge/` — and prove it with a production-shaped 7-workstream **RAG** pattern driven to `merge_status: "ready"` over the real gate + Ed25519 ledger + merkle-dag, keyless and reproducible.

**Architecture:** `ai-forge` mirrors `saas-forge`'s proven composition (compute plan → `runBuild` with generator dispatch → ledger-gate `done()` → per-workstream adversarial breakout-on-facts → market gate with required-seat approvals), but the workstream registry is supplied by a **pattern** (data) instead of the hard-coded `workstreams.mjs` + `research.mjs`. The TELOS spine (`merkle-dag`, `build-gate/gate.mjs`, `breakout/`) is reused verbatim; nothing in it changes.

**Tech Stack:** Node ≥18, ESM, zero runtime dependencies. `node:test`-free assertion style via `node:assert/strict` + terminal `console.log("... OK")` (match existing suites).

## Global Constraints

- **Zero new runtime dependencies**; Node `>=18`; ESM (`"type":"module"`). (Spec §Testing, §Layout.)
- **Do not modify the spine or `saas-forge`**: `merkle-dag/*`, `build-gate/*`, `breakout/*`, `connectors/*`, and all of `saas-forge/` are read-only references. `ai-forge` gets its own copies of the small generic helpers (`check-node.mjs`, `generatorDispatch`, `factBreakout`). (Spec §Non-goals.)
- **Pattern shape (exact):** a pattern = `{ id, workstreams: [...] }`; each workstream = `{ id, signer, lens, dependencies, files, requirements, render(ctx)->{relPath:content}, checks(ctx)->check[], findingsKey, finding, nodeTest?, isUi? }` — the **same field shape** as `saas-forge/workstreams.mjs` entries, so the generic machinery works unchanged. `render`/`checks` take a pattern-supplied `ctx` (not saas-forge's `architecture`).
- **`signer`/`lens` = the workstream's strength-matched lead model** (`claude`/`codex`/`grok`/`agy`) — NOT a `build-gate/teams.mjs` team id. (Reconciles spec "team" wording with saas-forge mechanics.)
- **Fully-live is an injected-boundary capability; the committed test is keyless + deterministic.** Boundaries: embedding backend, vector store, LLM generation. (Spec §"Live vs. test boundaries".)
- **Check object shape:** `{ type: "file_exists" | "file_contains", path, needle? }` (`needle` required for `file_contains`). (From `saas-forge/checks/check-node.mjs`.)
- **Add `ai-forge` to `.github/workflows/ci.yml`** matrix `package:` list (ubuntu, Node 18 & 20).
- **Each task lands via branch → PR → CI → squash-merge** (branch protection on `main`): `git checkout -B <branch> origin/main` … `gh pr create` … `gh pr merge --squash --delete-branch`, then `git checkout main && git fetch && git merge --ff-only origin/main`.
- **Exit:** `node ai-forge/scripts/test-forge.mjs` converges (`merge_status: "ready"` + gate `pass`) keyless; `cd ai-forge && npm test` exit 0; all existing packages stay green; evidence in `docs/runs/ai-forge-rag/`.

---

## File Structure

All paths under `C:/Users/dsmce/telos/`.

| File | Responsibility |
|---|---|
| `ai-forge/package.json` | ESM package; `check` + `test` scripts (mirror `saas-forge/package.json`). |
| `ai-forge/pattern.mjs` | Pattern schema helpers: `validatePattern`, `patternTaskDefs(pattern, ctx)`, `signerForTask(pattern)`, `nodeTestFor(ws, ctx)`, `workstreamById(pattern, id)`. Pattern-generic versions of `saas-forge/plan.mjs` + `workstreams.mjs` helpers. |
| `ai-forge/checks/check-node.mjs` | Standalone CLI: `JSON.parse(argv[2])` → `reverifyRecord({checks}, cwd)` → non-zero on any fail. Copy of `saas-forge/checks/check-node.mjs`. |
| `ai-forge/generators.mjs` | `generatorDispatch({baseDir, generateFiles, signerForTask})` + `makePatternGenerators(pattern, ctx)`. Generic copy of `saas-forge/generator.mjs`. |
| `ai-forge/breakouts.mjs` | `factBreakout({checks, baseDir, repair})` + `runPatternBreakouts({pattern, ctx, baseDir, maxRounds, makeFns})`. Generic copy of `saas-forge/breakouts.mjs`. |
| `ai-forge/forge.mjs` | `forge({pattern, ctx, projectRoot, dossierMeta, makeGenerators?, makeBreakoutFns?, makeApprovals?, maxCycles})` — the driver. |
| `ai-forge/patterns/rag.mjs` | The RAG pattern: `{ id:"rag", workstreams:[…7…] }` + `ragContext(params)`. |
| `ai-forge/live.mjs` | Injected live boundaries (embeddings + vector store + LLM) + `runForgeLive(...)`. |
| `ai-forge/scripts/test-forge.mjs` | Keyless e2e: RAG pattern converges; fail-closed when guardrails artifact corrupted. |
| `ai-forge/scripts/test-live.mjs` | Live path wired with a stubbed transport (keyless), proves wiring. |
| `ai-forge/scripts/test-pattern.mjs` | Unit tests for `pattern.mjs` (schema validation, task-def derivation). |
| `.github/workflows/ci.yml` | Add `- ai-forge` to the matrix. |
| `docs/runs/ai-forge-rag/run-summary.json` + `run.mjs` | Reproducible evidence. |
| `docs/ROADMAP.md` | Phase A status → built. |

---

### Task 1: Package scaffold + CI wiring

**Files:**
- Create: `ai-forge/package.json`, `ai-forge/scripts/test-pattern.mjs` (smoke stub)
- Modify: `.github/workflows/ci.yml` (matrix list)

**Interfaces:**
- Produces: an `ai-forge` package whose `npm test` runs `node --check` over its modules + the test scripts.

- [ ] **Step 1: Write `ai-forge/package.json`** (mirror `saas-forge/package.json`; scripts reference files added in later tasks — list them now so `check` is complete by the end):

```json
{
  "name": "telos-ai-forge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "TELOS ai-forge: a pattern-library-driven forge for AI architectures. Phase A: library substrate + a production-shaped RAG pattern, driven to merge_status:ready over the real gate + Ed25519 ledger + merkle-dag.",
  "scripts": {
    "check": "node --check pattern.mjs && node --check generators.mjs && node --check breakouts.mjs && node --check forge.mjs && node --check live.mjs && node --check checks/check-node.mjs && node --check patterns/rag.mjs && node --check scripts/test-pattern.mjs && node --check scripts/test-forge.mjs && node --check scripts/test-live.mjs",
    "test": "npm run check && node scripts/test-pattern.mjs && node scripts/test-forge.mjs && node scripts/test-live.mjs"
  },
  "engines": { "node": ">=18" }
}
```

> Note: `npm run check` will fail until all referenced files exist. That is expected mid-plan; each task adds its file and its own focused run. The package becomes fully green at Task 9.

- [ ] **Step 2: Write a temporary smoke test** so Task 1 is independently verifiable. Create `ai-forge/scripts/test-pattern.mjs`:

```js
import assert from "node:assert/strict";
assert.equal(1 + 1, 2);
console.log("test-pattern.mjs OK");
```

- [ ] **Step 3: Run it.** Run: `node ai-forge/scripts/test-pattern.mjs`  → Expected: `test-pattern.mjs OK`.

- [ ] **Step 4: Add `ai-forge` to CI.** In `.github/workflows/ci.yml`, append to the matrix `package:` list (after `- saas-forge`):

```yaml
          - ai-forge
```

- [ ] **Step 5: Commit + land.**
```bash
git checkout -B feat/ai-forge-scaffold origin/main
git add ai-forge/package.json ai-forge/scripts/test-pattern.mjs .github/workflows/ci.yml
git commit -m "feat(ai-forge): package scaffold + CI matrix entry"
git push -u origin feat/ai-forge-scaffold
gh pr create --repo dsmcewan/TELOS --base main --head feat/ai-forge-scaffold --title "feat(ai-forge): scaffold + CI" --body "ai-forge package scaffold; adds ai-forge to the CI matrix."
gh pr checks feat/ai-forge-scaffold --repo dsmcewan/TELOS   # confirm ai-forge job appears
gh pr merge feat/ai-forge-scaffold --repo dsmcewan/TELOS --squash --delete-branch
git checkout main && git fetch origin && git merge --ff-only origin/main
```
Expected: the CI run now includes `ai-forge (node 18)` / `ai-forge (node 20)` jobs, both green.

---

### Task 2: Pattern schema + task-def derivation (`pattern.mjs`)

**Files:**
- Create: `ai-forge/pattern.mjs`
- Modify (replace smoke stub): `ai-forge/scripts/test-pattern.mjs`

**Interfaces:**
- Consumes: `computePlan` from `../merkle-dag/merkle.mjs` is **not** called here (called in `forge.mjs`); this module only shapes task defs.
- Produces:
  - `validatePattern(pattern) -> { ok:true } | { ok:false, errors: string[] }` — checks `id` non-empty string; `workstreams` non-empty array; each workstream has string `id` (unique), `signer` string, `lens` string, `files` non-empty string[], `requirements` string, `render` function, `checks` function, `findingsKey` string, `finding` string; `dependencies` (if present) string[]; `nodeTest`/`isUi` optional.
  - `workstreamById(pattern, id) -> ws | undefined`.
  - `nodeTestFor(ws, ctx) -> { cmd:"node", args:[<abs check-node.mjs>, JSON.stringify(ws.checks(ctx))] }` when no `ws.nodeTest`, else `ws.nodeTest`. The check-node path is absolute via `fileURLToPath(new URL("./checks/check-node.mjs", import.meta.url))`.
  - `signerForTask(pattern) -> (id) => workstreamById(pattern,id)?.signer || "claude"`.
  - `patternTaskDefs(pattern, ctx) -> taskDef[]` where each = `{ id: ws.id, files: ws.files, requirements: ws.requirements, test: nodeTestFor(ws, ctx), dependencies: ws.dependencies || [] }` (shape required by `computePlan`).

- [ ] **Step 1: Write the failing tests.** Replace `ai-forge/scripts/test-pattern.mjs`:

```js
import assert from "node:assert/strict";
import { validatePattern, patternTaskDefs, signerForTask, workstreamById, nodeTestFor } from "../pattern.mjs";

const ctx = { telos: "t" };
const ws = (over = {}) => ({
  id: "a", signer: "codex", lens: "codex", dependencies: [],
  files: ["a.txt"], requirements: "make a", render: () => ({ "a.txt": "x" }),
  checks: () => [{ type: "file_exists", path: "a.txt" }],
  findingsKey: "k", finding: "f", ...over
});

// valid pattern passes
{
  const r = validatePattern({ id: "p", workstreams: [ws()] });
  assert.equal(r.ok, true, JSON.stringify(r));
}
// missing fields fail closed (no throw)
{
  const r = validatePattern({ id: "", workstreams: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
}
// duplicate workstream ids rejected
{
  const r = validatePattern({ id: "p", workstreams: [ws(), ws()] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /duplicate/i.test(e)));
}
// task defs match computePlan's expected shape
{
  const p = { id: "p", workstreams: [ws({ dependencies: [] })] };
  const defs = patternTaskDefs(p, ctx);
  assert.equal(defs.length, 1);
  assert.deepEqual(defs[0].files, ["a.txt"]);
  assert.equal(defs[0].test.cmd, "node");
  assert.ok(defs[0].test.args[0].endsWith("check-node.mjs"));
  assert.equal(JSON.parse(defs[0].test.args[1])[0].type, "file_exists");
}
// signer + lookup
{
  const p = { id: "p", workstreams: [ws({ id: "b", signer: "grok" })] };
  assert.equal(signerForTask(p)("b"), "grok");
  assert.equal(signerForTask(p)("missing"), "claude");
  assert.equal(workstreamById(p, "b").signer, "grok");
}
// nodeTest override respected
{
  const w = ws({ nodeTest: { cmd: "node", args: ["-e", "process.exit(0)"] } });
  assert.deepEqual(nodeTestFor(w, ctx), { cmd: "node", args: ["-e", "process.exit(0)"] });
}
console.log("test-pattern.mjs OK");
```

- [ ] **Step 2: Run to confirm it FAILS.** Run: `node ai-forge/scripts/test-pattern.mjs` → Expected: FAIL (`Cannot find module '../pattern.mjs'`).

- [ ] **Step 3: Implement `ai-forge/pattern.mjs`:**

```js
// pattern.mjs — pattern schema + task-def derivation. A pattern supplies the
// workstream registry (data) that saas-forge hard-codes; the generic forge
// machinery consumes these helpers. render/checks take a pattern-supplied ctx.
import { fileURLToPath } from "node:url";

const CHECK_NODE = fileURLToPath(new URL("./checks/check-node.mjs", import.meta.url));

export function validatePattern(pattern) {
  const errors = [];
  if (!pattern || typeof pattern.id !== "string" || !pattern.id) errors.push("pattern.id must be a non-empty string");
  const ws = pattern && pattern.workstreams;
  if (!Array.isArray(ws) || ws.length === 0) { errors.push("pattern.workstreams must be a non-empty array"); return { ok: false, errors }; }
  const seen = new Set();
  for (const w of ws) {
    const id = w && w.id;
    if (typeof id !== "string" || !id) { errors.push("workstream.id must be a non-empty string"); continue; }
    if (seen.has(id)) errors.push(`duplicate workstream id '${id}'`);
    seen.add(id);
    if (typeof w.signer !== "string" || !w.signer) errors.push(`${id}: signer must be a string`);
    if (typeof w.lens !== "string" || !w.lens) errors.push(`${id}: lens must be a string`);
    if (!Array.isArray(w.files) || w.files.length === 0) errors.push(`${id}: files must be a non-empty array`);
    if (typeof w.requirements !== "string") errors.push(`${id}: requirements must be a string`);
    if (typeof w.render !== "function") errors.push(`${id}: render must be a function`);
    if (typeof w.checks !== "function") errors.push(`${id}: checks must be a function`);
    if (typeof w.findingsKey !== "string") errors.push(`${id}: findingsKey must be a string`);
    if (typeof w.finding !== "string") errors.push(`${id}: finding must be a string`);
    if (w.dependencies != null && !Array.isArray(w.dependencies)) errors.push(`${id}: dependencies must be an array`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function workstreamById(pattern, id) {
  return pattern.workstreams.find((w) => w.id === id);
}

export function nodeTestFor(ws, ctx) {
  if (ws.nodeTest) return ws.nodeTest;
  return { cmd: "node", args: [CHECK_NODE, JSON.stringify(ws.checks(ctx))] };
}

export function signerForTask(pattern) {
  return (id) => workstreamById(pattern, id)?.signer || "claude";
}

export function patternTaskDefs(pattern, ctx) {
  return pattern.workstreams.map((ws) => ({
    id: ws.id,
    files: ws.files,
    requirements: ws.requirements,
    test: nodeTestFor(ws, ctx),
    dependencies: ws.dependencies || []
  }));
}
```

- [ ] **Step 4: Run to confirm it PASSES.** Run: `node ai-forge/scripts/test-pattern.mjs` → Expected: `test-pattern.mjs OK`.

- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-pattern`, same PR→CI→merge flow as Task 1 Step 5).

---

### Task 3: Check CLI + generators

**Files:**
- Create: `ai-forge/checks/check-node.mjs`, `ai-forge/generators.mjs`
- Test: extend `ai-forge/scripts/test-pattern.mjs` is NOT right home — create `ai-forge/scripts/test-generators.mjs`; add it to `package.json` `check` + `test`.

**Interfaces:**
- Consumes: `reverifyRecord` from `../breakout/verifier.mjs` (used by check-node.mjs — confirm the export name by reading `saas-forge/checks/check-node.mjs`, which is the exact template to copy).
- Produces:
  - `check-node.mjs` (CLI, no exports): `const checks = JSON.parse(process.argv[2]); const r = reverifyRecord({ checks }, process.cwd()); process.exit(<non-zero if any check fails or zero re-verifiable>)`. **Copy `saas-forge/checks/check-node.mjs` verbatim** — it is already generic.
  - `generatorDispatch({ baseDir, generateFiles, signerForTask }) -> async (injected) => { ok:true, signer } | { ok:false, reason }` — calls `generateFiles(injected)` (returns `{relPath: content}`), writes each `injected.files` path under `baseDir` (mkdir -p), returns signer from `signerForTask(injected.id)`. **Copy `saas-forge/generator.mjs`'s `generatorDispatch` verbatim** (generic).
  - `makePatternGenerators(pattern, ctx) -> async (injected) => workstreamById(pattern, injected.id).render(ctx)`.

- [ ] **Step 1: Write the failing test** `ai-forge/scripts/test-generators.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatorDispatch, makePatternGenerators } from "../generators.mjs";

const CHECK_NODE = fileURLToPath(new URL("../checks/check-node.mjs", import.meta.url));
const dir = mkdtempSync(path.join(os.tmpdir(), "aiforge-gen-"));

// generator writes the workstream's files; dispatch returns the signer
{
  const pattern = { id: "p", workstreams: [{
    id: "w1", signer: "codex", lens: "codex", files: ["sub/a.txt"],
    requirements: "r", render: () => ({ "sub/a.txt": "hello #facts" }),
    checks: () => [{ type: "file_contains", path: "sub/a.txt", needle: "#facts" }],
    findingsKey: "k", finding: "f"
  }] };
  const dispatch = generatorDispatch({
    baseDir: dir,
    generateFiles: makePatternGenerators(pattern, { telos: "t" }),
    signerForTask: (id) => (id === "w1" ? "codex" : "claude")
  });
  const out = await dispatch({ id: "w1", files: ["sub/a.txt"], requirements: "r", test: {}, effective_hash: "x" });
  assert.equal(out.ok, true);
  assert.equal(out.signer, "codex");
  assert.ok(existsSync(path.join(dir, "sub/a.txt")));
  assert.match(readFileSync(path.join(dir, "sub/a.txt"), "utf8"), /#facts/);
}

// check-node CLI: passes when checks hold, non-zero when they don't
{
  const ok = [{ type: "file_contains", path: "sub/a.txt", needle: "#facts" }];
  execFileSync("node", [CHECK_NODE, JSON.stringify(ok)], { cwd: dir }); // throws on non-zero
  let failed = false;
  try { execFileSync("node", [CHECK_NODE, JSON.stringify([{ type: "file_contains", path: "sub/a.txt", needle: "ABSENT" }])], { cwd: dir, stdio: "ignore" }); }
  catch { failed = true; }
  assert.equal(failed, true, "check-node must exit non-zero on a failing check");
}
console.log("test-generators.mjs OK");
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module '../generators.mjs'`).

- [ ] **Step 3: Implement** — copy `saas-forge/checks/check-node.mjs` → `ai-forge/checks/check-node.mjs` verbatim. Then write `ai-forge/generators.mjs` by copying `saas-forge/generator.mjs`'s `generatorDispatch` verbatim and replacing `makeDemoGenerators(arch)` with:

```js
import { workstreamById } from "./pattern.mjs";
export function makePatternGenerators(pattern, ctx) {
  return async (injected) => workstreamById(pattern, injected.id).render(ctx);
}
```
(Keep `generatorDispatch` exactly as in `saas-forge/generator.mjs` — read it and copy.)

- [ ] **Step 4: Add `test-generators.mjs` to `package.json`** `check` (`&& node --check scripts/test-generators.mjs`) and `test` (`&& node scripts/test-generators.mjs`), placed before `test-forge.mjs`.

- [ ] **Step 5: Run → PASS.** Run: `node ai-forge/scripts/test-generators.mjs` → `test-generators.mjs OK`.

- [ ] **Step 6: Commit + land** (branch `feat/ai-forge-generators`).

---

### Task 4: Fact-grounded breakouts (`breakouts.mjs`)

**Files:**
- Create: `ai-forge/breakouts.mjs`, `ai-forge/scripts/test-breakouts.mjs`
- Modify: `ai-forge/package.json` (register the test)

**Interfaces:**
- Consumes: the `breakout/` engine the same way `saas-forge/breakouts.mjs` does (read it — `runBreakout` + a fact-grounded challenger). `workstreamById`, `patternTaskDefs` not needed here.
- Produces:
  - `factBreakout({ checks, baseDir, repair }) -> { challenge, revise }` — **copy `saas-forge/breakouts.mjs`'s `factBreakout` verbatim** (it re-verifies `checks` on disk under `baseDir`).
  - `runPatternBreakouts({ pattern, ctx, baseDir, maxRounds = 3, makeFns = factBreakout }) -> record[]` — one record per workstream: run the breakout over `ws.checks(ctx)`, then attach `{ checks: ws.checks(ctx), lens: ws.lens, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey }`. Mirror `saas-forge/breakouts.mjs`'s `runTeamBreakouts`, iterating `pattern.workstreams` instead of `workstreamsFor(architecture)`.
  - Record shape (consumed by Task 5): `{ workstream, finalStatus, converged, surviving_blockers, rounds, evidence, checks, lens, isUi, finding, findingsKey }`.

- [ ] **Step 1: Write the failing test** `ai-forge/scripts/test-breakouts.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPatternBreakouts } from "../breakouts.mjs";

const dir = mkdtempSync(path.join(os.tmpdir(), "aiforge-bk-"));
mkdirSync(path.join(dir, "rag"), { recursive: true });
writeFileSync(path.join(dir, "rag/a.txt"), "grounded #ok");

const pattern = { id: "p", workstreams: [
  { id: "good", signer: "codex", lens: "codex", files: ["rag/a.txt"], requirements: "r",
    render: () => ({}), checks: () => [{ type: "file_contains", path: "rag/a.txt", needle: "#ok" }],
    findingsKey: "k", finding: "f" },
  { id: "bad", signer: "grok", lens: "grok", files: ["rag/missing.txt"], requirements: "r",
    render: () => ({}), checks: () => [{ type: "file_exists", path: "rag/missing.txt" }],
    findingsKey: "k", finding: "f" }
]};

const records = await runPatternBreakouts({ pattern, ctx: { telos: "t" }, baseDir: dir });
const good = records.find((r) => r.workstream === "good");
const bad = records.find((r) => r.workstream === "bad");
assert.equal(good.converged, true, "present+matching evidence converges");
assert.equal(bad.converged, false, "missing artifact must NOT converge (fail-closed)");
assert.equal(good.lens, "codex");
assert.ok(Array.isArray(good.checks));
console.log("test-breakouts.mjs OK");
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `ai-forge/breakouts.mjs`** — read `saas-forge/breakouts.mjs`; copy `factBreakout` verbatim; write `runPatternBreakouts` mirroring `runTeamBreakouts` but looping `pattern.workstreams` and reading `ws.checks(ctx)` / `ws.lens` / `ws.isUi` / `ws.finding` / `ws.findingsKey`.
- [ ] **Step 4: Register the test** in `package.json` (`check` + `test`, before `test-forge.mjs`).
- [ ] **Step 5: Run → PASS.**
- [ ] **Step 6: Commit + land** (branch `feat/ai-forge-breakouts`).

---

### Task 5: The forge driver (`forge.mjs`)

**Files:**
- Create: `ai-forge/forge.mjs`
- Test: covered by Task 7's `test-forge.mjs` with the real RAG pattern; for this task use a **2-workstream fixture pattern** inline in a temporary `ai-forge/scripts/test-forge.mjs`.

**Interfaces:**
- Consumes: `generateKeypair` (`../merkle-dag/crypto.mjs`), `computePlan`+`writePlan` (`../merkle-dag/merkle.mjs`), `runBuild` (`../merkle-dag/orchestrate.mjs`), `validateRecords` (`../build-gate/gate.mjs`), `patternTaskDefs`+`signerForTask`+`validatePattern` (`./pattern.mjs`), `generatorDispatch`+`makePatternGenerators` (`./generators.mjs`), `runPatternBreakouts` (`./breakouts.mjs`).
- Produces:
  - `forge({ pattern, ctx, projectRoot, dossierMeta, makeGenerators = makePatternGenerators, makeBreakoutFns, makeApprovals = syntheticApprovals, maxCycles = 3 }) -> { converged, cycles[], records[], verdict }`.
  - `syntheticApprovals(dossierMeta) -> packet[]` — the keyless required-seat approvals (mirror `saas-forge/forge.mjs`'s `syntheticApprovals`, REQUIRED_MODELS = claude/agy/codex).
- Behavior (mirror `saas-forge/forge.mjs`, simplified — no research stage, pattern supplies workstreams):
  1. `validatePattern(pattern)` → throw on `!ok`.
  2. Make a keypair per distinct `signer` across `pattern.workstreams`; `authorizedSigners = { signer: publicJwk }`; `signerForModel(m) = keys[m]?.privatePem`.
  3. Per cycle: `patternTaskDefs(pattern, ctx)` → `computePlan(defs, { authorizedSigners })` → throw on `errors` → `writePlan(telosDir, plan)`.
  4. `dispatch = generatorDispatch({ baseDir: projectRoot, generateFiles: makeGenerators(pattern, ctx), signerForTask: signerForTask(pattern) })`.
  5. `runBuild({ telosDir, baseDir: projectRoot, dispatch, signerFor: signerForModel })` → `built = report.merge_status === "ready"`.
  6. `records = built ? runPatternBreakouts({ pattern, ctx, baseDir: projectRoot, makeFns: makeBreakoutFns }) : []`; `allConverged = built && records.length && records.every(r => r.converged)`.
  7. `approvals = allConverged ? makeApprovals(dossierMeta) : []`; build a `market_bound` dossier with `required_market_workstreams = pattern.workstreams.map(w=>w.id)` and `marketPackets` from each record (mirror `marketPacketFromRecord`); `verdict = allConverged ? validateRecords(dossier, approvals, { dossierDir: projectRoot }, [], marketPackets) : null`.
  8. Return converged when `allConverged && verdict.gate_status === "pass"`.

> The required-market-workstream **ids** here are the RAG workstream ids, NOT the SaaS `DEFAULT_MARKET_WORKSTREAMS`. The gate treats `required_market_workstreams` as data from the dossier (it does not hard-require the SaaS set), so a market packet per RAG workstream satisfies it. Confirm by reading `gate.mjs`'s market-workstream handling; if the gate hard-codes SaaS workstream ids anywhere on the `market_bound` path, fall back to gating on `report.merge_status === "ready"` + a plain (non-market) `validateRecords` approval check, and record that decision in the task's report.

- [ ] **Step 1: Write the failing test** — temporary `ai-forge/scripts/test-forge.mjs` driving a 2-workstream fixture pattern (each renders a file containing a token its check asserts) through `forge(...)` in an `os.tmpdir()` project root; assert `result.converged === true`, `result.verdict.gate_status === "pass"`. Add a fail-closed case: a third workstream whose render writes the WRONG token → `converged === false`.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `ai-forge/forge.mjs`** per the behavior above (read `saas-forge/forge.mjs` for `syntheticApprovals` + `marketPacketFromRecord` + the cycle skeleton; drop the `research` stage and `makeContext7DocsFor`).
- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-driver`).

---

### Task 6: The RAG pattern (`patterns/rag.mjs`)

**Files:**
- Create: `ai-forge/patterns/rag.mjs`
- Test: `ai-forge/scripts/test-pattern.mjs` — add a block asserting the RAG pattern is valid + has 7 workstreams.

**Interfaces:**
- Produces:
  - `ragPattern -> { id:"rag", workstreams: [7 entries] }` — each entry matches the Global-Constraints workstream shape; `render(ctx)` returns deterministic content keyed by the artifact path(s); `checks(ctx)` returns the on-disk fact-checks from the spec table.
  - `ragContext(params = {}) -> ctx` — the deterministic context the renders/checks read (e.g. `{ telos, corpus: [...fixed docs...], embedDim: 8, topK: 3, brandToken, thresholds:{precision,faithfulness} }`). Keyless + fixed so tests are reproducible.
- The 7 workstreams (ids, `signer`/`lens` = lead model, artifact, key checks) — from the approved spec §"The RAG pattern":

| id | signer/lens | files | checks (on disk) |
|---|---|---|---|
| `ingestion` | codex | `rag/ingest.mjs`, `rag/chunks.jsonl` | `file_exists` both; `chunks.jsonl` `file_contains` a known chunk token; (overlap/token-bound encoded as content the check asserts) |
| `embed-index` | codex | `rag/index.build.mjs`, `rag/index.json` | `file_exists` both; `index.json` `file_contains` the embedding `"dim":8` and a chunk id |
| `retrieval` | claude | `rag/retrieve.mjs` | `file_exists`; **`nodeTest`** = `{cmd:"node",args:["rag/retrieve.mjs","--selftest"]}` that runs retrieval over the fixed index and exits 0 only if a known query returns the expected doc in top-k |
| `generation` | claude | `rag/prompt.md`, `rag/generate.mjs` | `prompt.md` `file_contains` a `{{context}}` slot + `"cite"`; `generate.mjs` `file_exists` |
| `eval-harness` | codex | `rag/evals/scorecard.json`, `rag/evals/run.mjs` | **`nodeTest`** = `{cmd:"node",args:["rag/evals/run.mjs"]}` that computes precision@k + faithfulness over the fixed corpus and exits non-zero if below `thresholds` |
| `guardrails` | grok | `rag/serve.config.json`, `rag/guardrails.mjs` | `guardrails.mjs` `file_contains` an injection/PII rule + a grounding gate; `serve.config.json` `file_exists` |
| `ops` | agy | `rag/OPERATIONS.md` | `file_contains` `"tracing"`, `"SLO"`, a cost line |

> `render` functions emit small, deterministic, **self-consistent** files: e.g. `ingestion` writes `chunks.jsonl` whose ids the `embed-index` render reads from the same `ctx.corpus` so `index.json`'s chunk ids match; `retrieval`'s `--selftest` and `eval-harness`'s `run.mjs` are tiny deterministic scripts (no external services) so their `nodeTest` genuinely executes and passes keyless. Dependencies: `embed-index` depends on `ingestion`; `retrieval` on `embed-index`; `generation` + `eval-harness` on `retrieval`; `guardrails` + `ops` independent.

- [ ] **Step 1: Write the failing test** (add to `test-pattern.mjs`):
```js
import { ragPattern } from "../patterns/rag.mjs";
{
  const r = validatePattern(ragPattern);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(ragPattern.workstreams.length, 7);
  assert.deepEqual(ragPattern.workstreams.map(w => w.id).sort(),
    ["embed-index","eval-harness","generation","guardrails","ingestion","ops","retrieval"]);
}
```
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `ai-forge/patterns/rag.mjs`** — the 7 workstreams + `ragContext`. Keep renders deterministic and self-consistent (see note). Each `render(ctx)` returns `{ "<relpath>": "<content>" }` for each of its `files`.
- [ ] **Step 4: Run → PASS** (`node ai-forge/scripts/test-pattern.mjs`).
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-rag-pattern`).

---

### Task 7: Keyless end-to-end + fail-closed (`test-forge.mjs`)

**Files:**
- Modify (replace Task 5's fixture-based temp): `ai-forge/scripts/test-forge.mjs`

**Interfaces:**
- Consumes: `forge` (`../forge.mjs`), `ragPattern` + `ragContext` (`../patterns/rag.mjs`).

- [ ] **Step 1: Write the e2e test** (replaces the fixture test):
```js
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { ragPattern, ragContext } from "../patterns/rag.mjs";

const dossierMeta = { build_id: "rag-e2e", idea_id: "rag", use_case: "ai-architecture", objective: "Forge a RAG architecture" };

// happy path: all 7 workstreams generate, breakout-survive, gate passes
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-rag-"));
  const result = await forge({ pattern: ragPattern, ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 7);
  assert.ok(result.records.every(r => r.converged));
}

// fail-closed: inject a broken generator for guardrails so its artifact lacks the
// required rule → its node test (Rule 3) and breakout fail → the forge does not converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-rag-fc-"));
  const broken = { ...ragPattern, workstreams: ragPattern.workstreams.map(w =>
    w.id === "guardrails" ? { ...w, render: () => ({ "rag/serve.config.json": "{}", "rag/guardrails.mjs": "// empty — no rule" }) } : w) };
  const result = await forge({ pattern: broken, ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a guardrails artifact missing its rule must not converge");
}
console.log("test-forge.mjs OK");
```

- [ ] **Step 2: Run → likely FAIL first** (surfaces real integration gaps — e.g. a render whose content doesn't satisfy its own check, or a `nodeTest` script that doesn't run). Use `superpowers:systematic-debugging` on any failure: read the `result.cycles` blockers, fix the offending `render`/`nodeTest` in `patterns/rag.mjs` (NOT the spine), re-run.
- [ ] **Step 3: Run → PASS.** Run: `node ai-forge/scripts/test-forge.mjs` → `test-forge.mjs OK`.
- [ ] **Step 4: Full package green.** Run: `cd ai-forge && npm test` → exit 0 (check + pattern + generators + breakouts + forge; test-live added next task).
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-e2e`).

---

### Task 8: Live boundaries (`live.mjs` + `test-live.mjs`)

**Files:**
- Create: `ai-forge/live.mjs`, `ai-forge/scripts/test-live.mjs`

**Interfaces:**
- Consumes: `forge` (`../forge.mjs`), `spawnMcpClient` (`../breakout/mcp_client.mjs`) for the live LLM path (read `saas-forge/live.mjs` for the pattern).
- Produces:
  - `liveBoundaries({ embed, vectorStore, callTool }) -> { makeGenerators, makeBreakoutFns, makeApprovals }` — injected real implementations: `embed` (text→vector), `vectorStore` (index/query), `callTool` (ai-peer-mcp seat). Defaults stay **undefined** → caller must supply; tests supply **stubs** (no keys).
  - `runForgeLive({ projectRoot, telos, dossierMeta, embed, vectorStore, callTool }) -> forge result` — wires the boundaries into `forge`. Mirror `saas-forge/live.mjs`'s `runForgeLive` (spawn server, wire `callTool`, run, close).
- The committed `test-live.mjs` drives `runForgeLive` with **stubbed** `embed`/`vectorStore`/`callTool` (deterministic, keyless) and asserts the wiring runs (a generator authored via the stub `callTool`, the forge reaches a verdict). No API keys.

- [ ] **Step 1: Write the failing test** `ai-forge/scripts/test-live.mjs` — stub `callTool` returns a fixed JSON packet/artifact; stub `embed` returns a deterministic vector; stub `vectorStore` is an in-memory map; assert `runForgeLive(...)` returns a result object with `cycles` (wiring executed). Keyless.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement `ai-forge/live.mjs`** mirroring `saas-forge/live.mjs` (injected boundaries; real embeddings/vector store/LLM are the caller's to supply; the default export wires `spawnMcpClient` for the LLM seat).
- [ ] **Step 4: Register `test-live.mjs`** is already in `package.json` from Task 1; run `cd ai-forge && npm test` → exit 0 (all suites).
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-live`).

---

### Task 9: Evidence + roadmap bump

**Files:**
- Create: `docs/runs/ai-forge-rag/run.mjs`, `docs/runs/ai-forge-rag/run-summary.json`, `docs/runs/ai-forge-rag/README.md`
- Modify: `docs/ROADMAP.md` (Phase A → built/✅), `README.md` (mention `ai-forge/` in Components + the SaaS-Forge-adjacent section)

**Interfaces:**
- `run.mjs`: imports `forge` + `ragPattern` + `ragContext`, runs into a temp dir, writes a sanitized `run-summary.json` (`converged`, per-workstream `{id, converged, finalStatus}`, `gate_status`, `merge_status`). Mirror `saas-forge`'s run evidence.

- [ ] **Step 1:** Write `docs/runs/ai-forge-rag/run.mjs` that runs the forge and writes `run-summary.json`. Run it; confirm `converged: true`.
- [ ] **Step 2:** Write `docs/runs/ai-forge-rag/README.md` (what the run proves; keyless; live via `ai-forge/live.mjs`).
- [ ] **Step 3:** Update `docs/ROADMAP.md` Phase A row → `✅ done`, Built column → link the run; Decisions log → add "Phase A built (RAG pattern → ready)".
- [ ] **Step 4:** Update top-level `README.md`: add `ai-forge/` to Components ("pattern-library-driven forge for AI architectures; Phase A: RAG pattern") and a one-line pointer near the SaaS Forge section.
- [ ] **Step 5:** Full-repo sanity: `cd ai-forge && npm test` (exit 0); spot-check the other packages unaffected.
- [ ] **Step 6: Commit + land** (branch `docs/ai-forge-phase-a-evidence`).

---

## Notes for the executor

- **Branch protection:** every task's Step "Commit + land" uses the `gh` PR→CI→squash-merge flow (see Task 1 Step 5 for the exact commands). After each merge, `git checkout main && git fetch origin && git merge --ff-only origin/main`, and delete the local feature branch.
- **`gh` is at `/c/Program Files/GitHub CLI/gh`** (authenticated as `dsmcewan`, `repo` scope). Pushes use the local git credential, not the MCP token.
- **Do not touch the spine or `saas-forge`.** If you believe a spine change is required, stop and escalate — it likely means a `pattern`/`ctx` design fix instead.
- **Keyless + deterministic** is non-negotiable for the committed tests; anything needing a key belongs behind a `live.mjs` boundary.
