# ai-forge Phase B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a generic, pattern-agnostic `design` workstream that authors `docs/DESIGN.md` (a structured component block + 5 narrative sections + a mermaid diagram) and a render-written `docs/design/verify.mjs` node test, which verifies the design against `.telos/plan.json` + `.telos/ledger.jsonl` + the built artifacts — fail-closed on drift — demonstrated by adding it to the RAG pattern.

**Architecture:** No new forge machinery. A factory `makeDesignWorkstream(buildWorkstreams)` returns a Phase-A-shaped workstream; the RAG pattern appends it (now 8 workstreams, `design` depends on all 7 so it runs last). The render copies the canonical verifier `ai-forge/workstreams/design-verify.mjs` into the build tree as `docs/design/verify.mjs`; the build's Rule-3 verify runs it as the design node's `nodeTest`. Spine, `gate.mjs`, `sign.mjs`, `merkle-dag`, `saas-forge`, and the 7 RAG build workstreams are unchanged.

**Tech Stack:** Node ≥18, ESM, zero runtime dependencies. `node:assert/strict` + terminal `console.log("... OK")` test idiom (match existing ai-forge suites).

## Global Constraints

- **Zero new runtime dependencies**; Node `>=18`; ESM. (Spec §Testing.)
- **Do not modify** the TELOS spine (`merkle-dag/`, `build-gate/`, `breakout/`, `connectors/`), `saas-forge/`, or the 7 existing RAG build workstreams. The only edits to existing ai-forge files are: appending `makeDesignWorkstream(...)` to `patterns/rag.mjs`'s workstream list, rewriting `scripts/test-forge.mjs`, the `package.json` check/test lines, and `docs/runs/ai-forge-rag/*` + roadmap/README. (Spec §Non-goals.)
- **Component block schema (exact):** a single fenced ` ```json ` array in `DESIGN.md`; each entry `{ "workstream": <plan node id>, "model": <model>, "artifact": <relative path>, "depends_on": [<plan node id>...] }`. (Spec §"The design artifact".)
- **`verify.mjs` ground truth (exact, all relative to cwd = project root):** `.telos/plan.json` (`.nodes[].{id,files,dependencies}`), `.telos/ledger.jsonl` (one JSON record per line, `.task_id` + `.signer`), on-disk artifacts, `docs/DESIGN.md`. Plan nodes carry NO signer — the signer comes from the ledger.
- **The 5 checks (full set), fail-closed (exit non-zero on first failure):** (a) coverage exact = component `workstream` set == plan node ids minus `"design"`; (b) data-flow: each component's sorted `depends_on` == plan node's sorted `dependencies`; (c) realized: each `artifact` ∈ that node's `files` AND exists on disk; (d) model: each `model` == the ledger `signer` for that `task_id`; (e) the 5 section headers present + non-empty. (Spec §verify.mjs.)
- **The 5 narrative section headers (exact strings):** `Component boundaries`, `Data flow`, `Model/infra choices`, `Eval plan`, `Risks`.
- **Design author seat:** `signer`/`lens` = `claude`. (Spec §"The design workstream".)
- **Coverage excludes the `design` node itself** (it is the meta-view). The ledger has only the 7 build nodes when `verify.mjs` runs (design settles after).
- **Keyless + deterministic** committed tests. Each task lands via branch → `gh` PR → CI → squash-merge (branch protection on `main`; `gh` at `/c/Program Files/GitHub CLI/gh`, authed as `dsmcewan`).
- **Exit:** `ai-forge` `npm test` exit 0 (RAG e2e: 8 workstreams converge + 4 fail-closed design sub-cases + the isolated `verify.mjs` unit test); `docs/runs/ai-forge-rag/` regenerated (8 workstreams `meets`); all packages green.

---

## File Structure

| File | Responsibility |
|---|---|
| `ai-forge/workstreams/design-verify.mjs` | Canonical verifier (standalone script, cwd-relative). The 5 checks. Unit-tested directly; copied verbatim into the build tree by the render. |
| `ai-forge/workstreams/design.mjs` | `makeDesignWorkstream(buildWorkstreams)` → a workstream; render authors `DESIGN.md` (component block + narrative + mermaid) and writes `docs/design/verify.mjs` (the bytes of `design-verify.mjs`); `checks(ctx)` (surface); `nodeTest`; `findingsKey`/`finding`. |
| `ai-forge/scripts/test-design-verify.mjs` | Unit test for the verifier over synthetic plan/ledger/DESIGN fixtures: consistent → exit 0; each of 5 drift kinds → non-zero. |
| `ai-forge/scripts/test-design.mjs` | Unit test for `makeDesignWorkstream` + its render (shape; DESIGN.md has block matching the build workstreams + 5 sections + mermaid; verify.mjs written). |
| `ai-forge/patterns/rag.mjs` (modify) | Append `makeDesignWorkstream([the 7])` → 8 workstreams. |
| `ai-forge/scripts/test-forge.mjs` (modify) | e2e now asserts 8 records converge; + 4 fail-closed design sub-cases. |
| `ai-forge/package.json` (modify) | Add the two new modules + two new test scripts to check/test (incremental). |
| `docs/runs/ai-forge-rag/{run.mjs,run-summary.json,README.md}` (modify) | Regenerate evidence with 8 workstreams + the design artifact. |
| `docs/ROADMAP.md`, `README.md` (modify) | Phase B → done; note the design workstream. |

---

### Task 1: The verifier `design-verify.mjs` + isolated unit test

**Files:**
- Create: `ai-forge/workstreams/design-verify.mjs`, `ai-forge/scripts/test-design-verify.mjs`
- Modify: `ai-forge/package.json`

**Interfaces:**
- Produces: a standalone Node script `design-verify.mjs` that, run with cwd = a project root containing `.telos/plan.json`, `.telos/ledger.jsonl`, `docs/DESIGN.md`, and the artifacts, exits `0` when the design is consistent and `1` (with a `DESIGN_DRIFT: <reason>` message on stderr) on the first failed check.

- [ ] **Step 1: Write the failing unit test** `ai-forge/scripts/test-design-verify.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERIFY = fileURLToPath(new URL("../workstreams/design-verify.mjs", import.meta.url));

// Build a temp project root with a consistent plan + ledger + DESIGN.md + artifacts,
// then allow a mutator to perturb exactly one thing.
function makeRoot(mutate = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "dverify-"));
  mkdirSync(path.join(root, ".telos"), { recursive: true });
  mkdirSync(path.join(root, "docs", "design"), { recursive: true });
  mkdirSync(path.join(root, "a"), { recursive: true });
  mkdirSync(path.join(root, "b"), { recursive: true });

  // two build nodes + the design node
  const nodes = [
    { id: "alpha", files: ["a/alpha.txt"], dependencies: [] },
    { id: "beta", files: ["b/beta.txt"], dependencies: ["alpha"] },
    { id: "design", files: ["docs/DESIGN.md", "docs/design/verify.mjs"], dependencies: ["alpha", "beta"] }
  ];
  writeFileSync(path.join(root, ".telos", "plan.json"), JSON.stringify({ nodes }));
  // ledger: only the build nodes (design settles after verify)
  const ledger = [
    { task_id: "alpha", signer: "codex" },
    { task_id: "beta", signer: "claude" }
  ].map((r) => JSON.stringify(r)).join("\n");
  writeFileSync(path.join(root, ".telos", "ledger.jsonl"), ledger);
  // artifacts on disk
  writeFileSync(path.join(root, "a/alpha.txt"), "alpha");
  writeFileSync(path.join(root, "b/beta.txt"), "beta");

  // the design's component block + 5 sections (consistent by default)
  let components = [
    { workstream: "alpha", model: "codex", artifact: "a/alpha.txt", depends_on: [] },
    { workstream: "beta", model: "claude", artifact: "b/beta.txt", depends_on: ["alpha"] }
  ];
  if (mutate.components) components = mutate.components(components);
  const sections = mutate.sections || {
    "Component boundaries": "alpha ingests; beta builds on alpha.",
    "Data flow": "alpha -> beta.",
    "Model/infra choices": "codex for alpha, claude for beta.",
    "Eval plan": "node tests gate each artifact.",
    "Risks": "none material at this scale."
  };
  let md = "# Design\n\n```json\n" + JSON.stringify(components, null, 2) + "\n```\n";
  for (const [h, body] of Object.entries(sections)) md += `\n## ${h}\n\n${body}\n`;
  writeFileSync(path.join(root, "docs", "DESIGN.md"), md);
  return root;
}

function runVerify(root) {
  try { execFileSync("node", [VERIFY], { cwd: root, stdio: "pipe" }); return 0; }
  catch (e) { return e.status ?? 1; }
}

// consistent => exit 0
assert.equal(runVerify(makeRoot()), 0, "consistent design must pass");

// (a) coverage: omit a component => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.filter((x) => x.workstream !== "beta") })), 0, "missing component must fail");
// (a) coverage: phantom component => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => [...c, { workstream: "ghost", model: "codex", artifact: "a/alpha.txt", depends_on: [] }] })), 0, "phantom component must fail");
// (b) data-flow: wrong edge => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.map((x) => x.workstream === "beta" ? { ...x, depends_on: [] } : x) })), 0, "wrong dep edge must fail");
// (c) realized: artifact not on disk (claim a path not in files) => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.map((x) => x.workstream === "alpha" ? { ...x, artifact: "a/missing.txt" } : x) })), 0, "unrealized artifact must fail");
// (d) model: wrong model vs ledger signer => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.map((x) => x.workstream === "alpha" ? { ...x, model: "grok" } : x) })), 0, "wrong model must fail");
// (e) sections: empty section => fail
assert.notEqual(runVerify(makeRoot({ sections: { "Component boundaries": "", "Data flow": "x", "Model/infra choices": "x", "Eval plan": "x", "Risks": "x" } })), 0, "empty section must fail");

console.log("test-design-verify.mjs OK");
```

- [ ] **Step 2: Run → FAIL.** Run: `node ai-forge/scripts/test-design-verify.mjs` → Expected: FAIL (`design-verify.mjs` does not exist → the consistent case throws → `runVerify` returns 1 → first assert fails).

- [ ] **Step 3: Implement `ai-forge/workstreams/design-verify.mjs`:**

```js
#!/usr/bin/env node
// design-verify.mjs — verify docs/DESIGN.md against ground truth (plan + ledger +
// disk). Run with cwd = project root. Exit 0 if consistent; exit 1 with a
// "DESIGN_DRIFT: <reason>" message on the first failed check. Zero deps.
import { readFileSync, existsSync } from "node:fs";

function fail(msg) { console.error("DESIGN_DRIFT: " + msg); process.exit(1); }
function eqSet(a, b) { return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort()); }

let plan, ledger, designMd;
try { plan = JSON.parse(readFileSync(".telos/plan.json", "utf8")); } catch (e) { fail("cannot read .telos/plan.json: " + e.message); }
try { ledger = readFileSync(".telos/ledger.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch (e) { fail("cannot read .telos/ledger.jsonl: " + e.message); }
try { designMd = readFileSync("docs/DESIGN.md", "utf8"); } catch (e) { fail("cannot read docs/DESIGN.md: " + e.message); }

const m = designMd.match(/```json\s*([\s\S]*?)```/);
if (!m) fail("no fenced ```json component block in DESIGN.md");
let components;
try { components = JSON.parse(m[1]); } catch (e) { fail("component block is not valid JSON: " + e.message); }
if (!Array.isArray(components)) fail("component block must be a JSON array");

const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
const nodeById = new Map(nodes.map((n) => [n.id, n]));
const expected = nodes.map((n) => n.id).filter((id) => id !== "design");
const signerByTask = new Map(ledger.map((r) => [r.task_id, r.signer]));

// (a) coverage exact
const got = components.map((c) => c.workstream);
if (!eqSet(got, expected)) fail("coverage: components " + JSON.stringify([...got].sort()) + " != plan workstreams " + JSON.stringify([...expected].sort()));

for (const c of components) {
  const node = nodeById.get(c.workstream);
  if (!node) fail("phantom component: " + c.workstream);
  // (b) data-flow == dep DAG
  if (!eqSet(c.depends_on || [], node.dependencies || [])) fail("data-flow[" + c.workstream + "]: " + JSON.stringify([...(c.depends_on || [])].sort()) + " != plan deps " + JSON.stringify([...(node.dependencies || [])].sort()));
  // (c) realized: artifact in plan files + on disk (no path escape)
  if (typeof c.artifact !== "string" || c.artifact.includes("..")) fail("artifact[" + c.workstream + "]: invalid path " + c.artifact);
  if (!(node.files || []).includes(c.artifact)) fail("artifact[" + c.workstream + "]: " + c.artifact + " not in plan files " + JSON.stringify(node.files));
  if (!existsSync(c.artifact)) fail("artifact[" + c.workstream + "]: " + c.artifact + " not on disk");
  // (d) model == ledger signer
  const signer = signerByTask.get(c.workstream);
  if (signer === undefined) fail("no ledger entry for " + c.workstream);
  if (c.model !== signer) fail("model[" + c.workstream + "]: design says " + c.model + " but ledger signer is " + signer);
}

// (e) sections present + non-empty
const SECTIONS = ["Component boundaries", "Data flow", "Model/infra choices", "Eval plan", "Risks"];
for (const s of SECTIONS) {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp("(^|\\n)#+\\s*" + esc + "\\s*\\n([\\s\\S]*?)(?=\\n#+\\s|$)", "i");
  const mm = designMd.match(re);
  if (!mm || mm[2].trim().length === 0) fail("section missing or empty: " + s);
}

console.log("design-verify OK (" + components.length + " components, all checks passed)");
```

- [ ] **Step 4: Run → PASS.** Run: `node ai-forge/scripts/test-design-verify.mjs` → Expected: `test-design-verify.mjs OK`.

- [ ] **Step 5: Update `ai-forge/package.json`** (incremental check/test). Add `node --check workstreams/design-verify.mjs` and `node --check scripts/test-design-verify.mjs` to `check`; add `node scripts/test-design-verify.mjs` to `test`. Verify `cd ai-forge && npm test` exits 0.

- [ ] **Step 6: Commit + land** (branch `feat/ai-forge-design-verify`): commit `ai-forge/workstreams/design-verify.mjs ai-forge/scripts/test-design-verify.mjs ai-forge/package.json` locally; the controller pushes → PR → CI → squash-merge.

---

### Task 2: The `design` workstream factory `design.mjs` + unit test

**Files:**
- Create: `ai-forge/workstreams/design.mjs`, `ai-forge/scripts/test-design.mjs`
- Modify: `ai-forge/package.json`

**Interfaces:**
- Consumes: `design-verify.mjs` (Task 1) — read at render time via `new URL("./design-verify.mjs", import.meta.url)` and written verbatim to `docs/design/verify.mjs`.
- Produces:
  - `makeDesignWorkstream(buildWorkstreams) -> workstream` where `workstream` is the Phase-A shape `{ id:"design", signer:"claude", lens:"claude", dependencies:[...buildWorkstreams.map(w=>w.id)], files:["docs/DESIGN.md","docs/design/verify.mjs"], requirements, render(ctx)->{relPath:content}, checks(ctx)->check[], nodeTest:{cmd:"node",args:["docs/design/verify.mjs"]}, findingsKey:"design_findings", finding }`.
  - `render(ctx)` returns BOTH files: `docs/DESIGN.md` (a `# Design` heading, the fenced ```json component block derived from `buildWorkstreams` — per component `{workstream:w.id, model:w.signer, artifact:w.files[0], depends_on:w.dependencies||[]}` — the mermaid diagram built from those edges, then the 5 sections each with a non-empty body) and `docs/design/verify.mjs` (the bytes of `design-verify.mjs`).
  - `checks(ctx)` returns `[{type:"file_exists",path:"docs/DESIGN.md"},{type:"file_exists",path:"docs/design/verify.mjs"}, ...one {type:"file_contains",path:"docs/DESIGN.md",needle:"<section header>"} per the 5 headers]`.

- [ ] **Step 1: Write the failing test** `ai-forge/scripts/test-design.mjs`:

```js
import assert from "node:assert/strict";
import { makeDesignWorkstream } from "../workstreams/design.mjs";
import { validatePattern } from "../pattern.mjs";

const build = [
  { id: "alpha", signer: "codex", lens: "codex", dependencies: [], files: ["a/alpha.txt"], requirements: "r", render: () => ({}), checks: () => [], findingsKey: "k", finding: "f" },
  { id: "beta", signer: "claude", lens: "claude", dependencies: ["alpha"], files: ["b/beta.txt"], requirements: "r", render: () => ({}), checks: () => [], findingsKey: "k", finding: "f" }
];
const ws = makeDesignWorkstream(build);

// shape: a valid pattern workstream, design id, claude author, depends on all build ids
assert.equal(ws.id, "design");
assert.equal(ws.signer, "claude");
assert.deepEqual([...ws.dependencies].sort(), ["alpha", "beta"]);
assert.deepEqual(ws.files, ["docs/DESIGN.md", "docs/design/verify.mjs"]);
assert.ok(typeof ws.findingsKey === "string" && typeof ws.finding === "string");
assert.deepEqual(ws.nodeTest, { cmd: "node", args: ["docs/design/verify.mjs"] });
assert.equal(validatePattern({ id: "p", workstreams: [...build, ws] }).ok, true);

// render: DESIGN.md has a component block matching the build workstreams + mermaid + 5 sections; verify.mjs written
const out = ws.render({});
assert.ok(out["docs/DESIGN.md"], "writes DESIGN.md");
assert.ok(out["docs/design/verify.mjs"] && out["docs/design/verify.mjs"].includes("DESIGN_DRIFT"), "writes the real verify.mjs");
const md = out["docs/DESIGN.md"];
const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
assert.deepEqual(block.map((c) => c.workstream).sort(), ["alpha", "beta"]);
assert.equal(block.find((c) => c.workstream === "beta").model, "claude");
assert.deepEqual(block.find((c) => c.workstream === "beta").depends_on, ["alpha"]);
assert.equal(block.find((c) => c.workstream === "alpha").artifact, "a/alpha.txt");
assert.ok(md.includes("```mermaid"), "includes a mermaid diagram");
for (const h of ["Component boundaries", "Data flow", "Model/infra choices", "Eval plan", "Risks"]) assert.ok(new RegExp("#+\\s*" + h).test(md), "section " + h);

// surface checks include existence + the 5 section headers
const checks = ws.checks({});
assert.ok(checks.some((c) => c.type === "file_exists" && c.path === "docs/DESIGN.md"));
assert.ok(checks.some((c) => c.type === "file_exists" && c.path === "docs/design/verify.mjs"));
assert.equal(checks.filter((c) => c.type === "file_contains").length, 5);

console.log("test-design.mjs OK");
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module '../workstreams/design.mjs'`).

- [ ] **Step 3: Implement `ai-forge/workstreams/design.mjs`:**

```js
// design.mjs — a generic, pattern-agnostic `design` workstream. Authors
// docs/DESIGN.md (a structured component block + mermaid + 5 narrative sections)
// derived from the build workstreams, and writes the canonical verifier to
// docs/design/verify.mjs. The deep design<->plan<->build gate is that verifier
// (the workstream's nodeTest); checks(ctx) are the surface checks for the breakout.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const VERIFY_SRC = readFileSync(fileURLToPath(new URL("./design-verify.mjs", import.meta.url)), "utf8");
const SECTIONS = ["Component boundaries", "Data flow", "Model/infra choices", "Eval plan", "Risks"];

export function makeDesignWorkstream(buildWorkstreams) {
  const components = buildWorkstreams.map((w) => ({
    workstream: w.id,
    model: w.signer,
    artifact: w.files[0],
    depends_on: [...(w.dependencies || [])]
  }));

  function render() {
    const block = "```json\n" + JSON.stringify(components, null, 2) + "\n```";
    const edges = components.flatMap((c) => c.depends_on.map((d) => `  ${d} --> ${c.workstream}`));
    const mermaid = "```mermaid\nflowchart TD\n" + (edges.length ? edges.join("\n") : components.map((c) => `  ${c.workstream}`).join("\n")) + "\n```";
    const bodies = {
      "Component boundaries": components.map((c) => `- **${c.workstream}** (${c.model}) owns \`${c.artifact}\`.`).join("\n"),
      "Data flow": "Build order follows the dependency DAG:\n\n" + mermaid,
      "Model/infra choices": components.map((c) => `- ${c.workstream}: authored by **${c.model}**.`).join("\n"),
      "Eval plan": "Each component's node test gates its artifact on disk (Rule 3); this design is itself gated by `docs/design/verify.mjs` against the plan, ledger, and built tree.",
      "Risks": "Drift between design and build is caught fail-closed by `verify.mjs`; a missing/phantom component, wrong edge, wrong model, or unrealized artifact blocks the run."
    };
    let md = "# Architecture Design\n\n" + block + "\n";
    for (const h of SECTIONS) md += `\n## ${h}\n\n${bodies[h]}\n`;
    return { "docs/DESIGN.md": md, "docs/design/verify.mjs": VERIFY_SRC };
  }

  function checks() {
    return [
      { type: "file_exists", path: "docs/DESIGN.md" },
      { type: "file_exists", path: "docs/design/verify.mjs" },
      ...SECTIONS.map((h) => ({ type: "file_contains", path: "docs/DESIGN.md", needle: h }))
    ];
  }

  return {
    id: "design",
    signer: "claude",
    lens: "claude",
    dependencies: buildWorkstreams.map((w) => w.id),
    files: ["docs/DESIGN.md", "docs/design/verify.mjs"],
    requirements: "Author the architecture design and verify it against the plan, ledger, and built artifacts.",
    render,
    checks,
    nodeTest: { cmd: "node", args: ["docs/design/verify.mjs"] },
    findingsKey: "design_findings",
    finding: "Design is consistent with the content-addressed plan, signed ledger, and built artifacts."
  };
}
```

> Note: `model` in a component is the build workstream's `signer` (the lead-model name like `codex`/`claude`), which equals the ledger `signer` for that node by construction — so check (d) passes keyless. On the live path a model authors `DESIGN.md`; a wrong `model` then mismatches the ledger and `verify.mjs` blocks.

> **findingsKey fallback (read before Task 3):** the design uses `findingsKey: "design_findings"`. `marketPacketFromRecord` writes `packet["design_findings"] = [finding]` as an extra field; the market gate validates required fields and ignores extras, so this should pass. **If Task 3's e2e shows the gate blocking the design's market packet**, change `findingsKey` to an existing SaaS key (`"architecture_findings"`) — shared findings keys are gate-safe (confirmed in the Phase A review, where RAG workstreams already reuse SaaS keys). This is the one field to adjust if the gate complains; nothing else.

- [ ] **Step 4: Run → PASS.** Run: `node ai-forge/scripts/test-design.mjs` → `test-design.mjs OK`.

- [ ] **Step 5: Update `ai-forge/package.json`** (incremental): add `node --check workstreams/design.mjs` and `node --check scripts/test-design.mjs` to `check`; `node scripts/test-design.mjs` to `test`. `cd ai-forge && npm test` exits 0.

- [ ] **Step 6: Commit + land** (branch `feat/ai-forge-design-workstream`): commit `ai-forge/workstreams/design.mjs ai-forge/scripts/test-design.mjs ai-forge/package.json`.

---

### Task 3: Wire `design` into the RAG pattern + e2e + fail-closed

**Files:**
- Modify: `ai-forge/patterns/rag.mjs`, `ai-forge/scripts/test-forge.mjs`

**Interfaces:**
- Consumes: `makeDesignWorkstream` (Task 2), `forge`, `ragPattern`, `ragContext`.

- [ ] **Step 1: Add the design workstream to the RAG pattern.** In `ai-forge/patterns/rag.mjs`: import `makeDesignWorkstream` from `../workstreams/design.mjs`; where `ragPattern` is assembled, bind the 7 build workstreams to a `const` (e.g. `buildWorkstreams`) and set `ragPattern.workstreams = [...buildWorkstreams, makeDesignWorkstream(buildWorkstreams)]`. Do not otherwise change the 7 workstreams.

- [ ] **Step 2: Update the e2e happy path** in `ai-forge/scripts/test-forge.mjs`: change the records assertion from `=== 7` to `=== 8`, and add `assert.ok(result.records.some(r => r.workstream === "design" && r.converged), "design workstream converges")`. Keep the existing converged/gate-pass assertions.

- [ ] **Step 3: Run → the happy path should pass.** Run: `node ai-forge/scripts/test-forge.mjs`. If the design node fails to converge, read `result.cycles` blockers; the fix belongs in `workstreams/design.mjs`'s render or `design-verify.mjs` (NOT the spine/forge/RAG build workstreams). Use systematic debugging. Expected once green: `test-forge.mjs OK`.

- [ ] **Step 4: Add the 4 fail-closed design sub-cases** to `test-forge.mjs`. For each, build a pattern whose design workstream's `render` is wrapped to perturb the emitted `DESIGN.md` component block (parse the block, mutate, re-serialize) while leaving `verify.mjs` intact, then assert the forge does NOT converge:

```js
import { makeDesignWorkstream } from "../workstreams/design.mjs";

// helper: a RAG pattern whose design render mutates the component block
function ragWithBrokenDesign(mutateComponents) {
  const build = ragPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = makeDesignWorkstream(build);
  const brokenDesign = {
    ...realDesign,
    render: (ctx) => {
      const out = realDesign.render(ctx);
      const md = out["docs/DESIGN.md"];
      const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
      const mutated = JSON.stringify(mutateComponents(block), null, 2);
      out["docs/DESIGN.md"] = md.replace(/```json\s*[\s\S]*?```/, "```json\n" + mutated + "\n```");
      return out;
    }
  };
  return { ...ragPattern, workstreams: [...build, brokenDesign] };
}

const drifts = {
  "omit a component": (c) => c.slice(1),
  "phantom component": (c) => [...c, { workstream: "ghost", model: "codex", artifact: c[0].artifact, depends_on: [] }],
  "wrong dep edge": (c) => c.map((x, i) => i === c.length - 1 ? { ...x, depends_on: [] } : x),
  "unrealized artifact": (c) => c.map((x, i) => i === 0 ? { ...x, artifact: "rag/NOPE.txt" } : x)
};
for (const [name, mut] of Object.entries(drifts)) {
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-design-fc-"));
  const result = await forge({ pattern: ragWithBrokenDesign(mut), ctx: ragContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, `design drift '${name}' must NOT converge`);
}
```

(Use the existing `mkdtempSync`/`os`/`path`/`dossierMeta` already imported in `test-forge.mjs`.)

- [ ] **Step 5: Run → PASS.** Run: `node ai-forge/scripts/test-forge.mjs` → `test-forge.mjs OK`; then `cd ai-forge && npm test` exit 0 (all suites).

- [ ] **Step 6: Commit + land** (branch `feat/ai-forge-design-in-rag`): commit `ai-forge/patterns/rag.mjs ai-forge/scripts/test-forge.mjs`.

---

### Task 4: Regenerate evidence + roadmap/README

**Files:**
- Modify: `docs/runs/ai-forge-rag/run.mjs`, `docs/runs/ai-forge-rag/run-summary.json`, `docs/runs/ai-forge-rag/README.md`, `docs/ROADMAP.md`, `README.md`

**Interfaces:**
- `run.mjs` already runs the RAG forge and writes `run-summary.json`; with the design workstream added it now produces 8 workstreams + the design artifact.

- [ ] **Step 1: Re-run the evidence.** Run: `node docs/runs/ai-forge-rag/run.mjs`; confirm it prints/writes `converged: true` with 8 workstreams (including `design`). The regenerated `run-summary.json` now lists 8 workstreams. If `run.mjs` hard-codes a workstream count or list, update it to derive from the result. Commit the regenerated `run-summary.json`.

- [ ] **Step 2: Update `docs/runs/ai-forge-rag/README.md`** — add one line: the run now also produces a verified `docs/DESIGN.md` (design-as-artifact, gate-checked against plan + ledger + built tree by `docs/design/verify.mjs`).

- [ ] **Step 3: Update `docs/ROADMAP.md`** — Phase B heading and status row → `✅ done`; Built column → link `docs/runs/ai-forge-rag/`; add a Decisions-log line "Phase B built (design workstream → DESIGN.md verified vs plan+ledger+build; PRs <range>)". Preserve everything else.

- [ ] **Step 4: Update top-level `README.md`** — in the AI Forge section, add one line noting Phase B: every forge run now also emits a gate-verified `DESIGN.md` (a generic `design` workstream). Preserve everything else.

- [ ] **Step 5: Sanity.** `cd ai-forge && npm test` exit 0; the other packages unaffected.

- [ ] **Step 6: Commit + land** (branch `docs/ai-forge-phase-b-evidence`): commit the 5 files.

---

## Notes for the executor

- **Branch protection:** each task's "Commit + land" is the controller's `gh` PR→CI→squash-merge; implementers commit LOCALLY only (explicit `git add` of the listed paths — never `git add -A`; `.superpowers/` is gitignored).
- **Incremental package.json:** Tasks 1 and 2 each append their new module + test to the `check`/`test` scripts so the `ai-forge` CI job stays green at every task.
- **Do not touch** the spine, `saas-forge`, or the 7 RAG build workstreams. If the design node won't converge, the fix is in `design.mjs` / `design-verify.mjs`, never the spine.
- **The fail-closed sub-cases are the proof the gate is real** — like Phase A's eval gate. If any drift case still converges, `verify.mjs` has a hole; fix the verifier, not the test.
