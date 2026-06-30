# ai-forge Phase C.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three standalone full-depth AI-architecture patterns to the ai-forge catalog — **multi-agent**, **eval-harness**, and **serving+guardrails** — each an 8-workstream `patterns/<name>.mjs` on the unchanged forge.

**Architecture:** Each pattern is pure data (the proven `{id, workstreams[]}` shape). Every workstream's `render` writes a self-contained ESM module whose inline keyless selftest (guarded by a `--selftest` arg, the RAG idiom) is run as its `nodeTest`; the gate independently re-runs it (Rule 3). Each pattern appends the generic `makeDesignWorkstream`. Standalone — no `spineRoot` wrap (that was TELOS's special case).

**Tech Stack:** Node ≥18, ESM, zero runtime deps. `node:assert/strict`, `node:fs`, `node:os`, `node:path`, `node:url`, `node:child_process` only.

## Global Constraints

- Do **not** modify the spine (`merkle-dag/`, `build-gate/`, `breakout/`, `connectors/`), `saas-forge/`, the RAG or TELOS patterns, or the Phase A/B forge modules (`forge.mjs`, `pattern.mjs`, `generators.mjs`, `breakouts.mjs`, `live.mjs`, `workstreams/design.mjs`, `workstreams/design-verify.mjs`, `checks/`). Phase C.2 only **adds** `patterns/{multiagent,eval,serving}.mjs`, their test scripts, evidence dirs, and **edits** `ai-forge/package.json`, `docs/ROADMAP.md`, top-level `README.md`.
- **Keyless + deterministic:** no API keys; no `Date.now`/`Math.random`/network on the test path. Clocks are injected (`now` params).
- **Fixture isolation (load-bearing):** any selftest that writes scratch/state (`scorecard`, `audit`) builds it under `os.tmpdir()` — never the project root or its `.telos/`.
- **Genuine executable checks:** every `nodeTest` runs the real module against a fixed fixture and exits non-zero if it misbehaves. No tautologies.
- Each pattern includes `makeDesignWorkstream(buildWorkstreams)` (8 workstreams total) and proves **≥2 fail-closed** sub-cases (one component-break + the inherited design drift).
- **Branch protection:** each task lands via its own branch → PR → CI → squash-merge. The controller pre-creates the branch; the implementer commits LOCALLY on it with explicit `git add` of the listed paths (never `-A`). `.superpowers/` is gitignored.
- **Incremental `package.json`:** each pattern's tasks append their `node --check` lines to `check` and their `node` run lines to `test`, preserving existing entries.
- **Sanitized evidence:** committed `run-summary.json` files contain no absolute paths, secrets, or timestamps.

## Shared workstream conventions (read once; applies to all three patterns)

Each forged module follows ONE shape — a reusable factory `mod(...)` defined at the top of each pattern file (mirrors TELOS's `componentWorkstream`; small per-file helper, no shared module, per the no-forge-kit non-goal):

```js
// the per-pattern helper — defined once at the top of each patterns/<name>.mjs
function mod({ id, signer, dependencies, file, source, finding, needle }) {
  return {
    id, signer, lens: signer, dependencies,
    files: [file],
    requirements: finding,
    render: () => ({ [file]: source }),
    checks: (ctx) => [
      { type: "file_exists", path: file },
      ...(needle ? [{ type: "file_contains", path: file, needle }] : [])
    ],
    nodeTest: { cmd: "node", args: [file, "--selftest"] },
    findingsKey: "architecture_findings",
    finding
  };
}
```

Every forged module ends with a `--selftest` guard so importing it (a sibling module does) never runs its asserts, but `node <file> --selftest` does:

```js
if (process.argv.includes("--selftest")) {
  /* assertions; console.log("<id> OK") on success, throw/exit non-zero on failure */
}
```

Each pattern file exports three things: `<name>Context` (a fixed, keyless ctx — forge passes it to renders, even when a render ignores it), `<name>BuildWorkstreams` (the 7-element array, for the selftest script), and `<name>Pattern` (`{ id, workstreams: [...build, makeDesignWorkstream(build)] }`).

**The per-component selftest script** (`scripts/test-<name>.mjs`) renders ALL build workstreams into ONE tmpdir (so sibling imports resolve), then runs each module with `--selftest`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { <name>Context, <name>BuildWorkstreams } from "../patterns/<name>.mjs";

const ctx = <name>Context();
const dir = mkdtempSync(path.join(os.tmpdir(), "aiforge-<name>-st-"));
for (const ws of <name>BuildWorkstreams) {
  for (const [rel, content] of Object.entries(ws.render(ctx))) {
    const abs = path.join(dir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}
for (const ws of <name>BuildWorkstreams) {
  try { execFileSync("node", [path.join(dir, ws.files[0]), "--selftest"], { cwd: dir, stdio: "pipe" }); }
  catch (e) { assert.fail(`${ws.id} selftest failed: ${e.stderr ? e.stderr.toString() : e.message}`); }
}
console.log("test-<name>.mjs OK");
```

**The e2e + fail-closed script** (`scripts/test-<name>-forge.mjs`) mirrors `scripts/test-telos-forge.mjs` exactly (happy path: converged, gate pass, 8 records; FC1: break one component's render so its selftest asserts the wrong thing → not converged; FC2: drift the design's DESIGN.md → not converged). The FC2 block is **identical** to TELOS's (it operates on the generic design workstream), reproduced in each e2e task below.

---

# PATTERN 1 — multi-agent (`patterns/multiagent.mjs`)

DAG: roots `roles`,`protocol`; `router←{roles}`; `blackboard←{protocol}`; `orchestrator←{roles,router,blackboard,protocol}`; `aggregator←{orchestrator}`; `termination←{orchestrator}`; `design←all 7`.

### Task 1: multi-agent scaffold — context, helper, and the four base modules

**Files:**
- Create: `ai-forge/patterns/multiagent.mjs`
- Create: `ai-forge/scripts/test-multiagent.mjs`

**Interfaces:**
- Produces: `multiagentContext()`, `multiagentBuildWorkstreams` (array; this task adds the first 4), `mod(...)` helper, and the four modules `roles`/`protocol`/`router`/`blackboard`.
- Consumes: nothing (first task).

- [ ] **Step 1: Create `ai-forge/patterns/multiagent.mjs`** with the helper, context, and the first four module sources. Use the exact `mod` helper and `--selftest` guard from the conventions section.

```js
// patterns/multiagent.mjs — a standalone multi-role agent system as DATA.
// 7 build workstreams (each a self-contained ESM module with an inline --selftest
// run as its nodeTest) + the generic design workstream. Keyless, deterministic.
import { makeDesignWorkstream } from "../workstreams/design.mjs";

function mod({ id, signer, dependencies, file, source, finding, needle }) {
  return {
    id, signer, lens: signer, dependencies,
    files: [file],
    requirements: finding,
    render: () => ({ [file]: source }),
    checks: (ctx) => [
      { type: "file_exists", path: file },
      ...(needle ? [{ type: "file_contains", path: file, needle }] : [])
    ],
    nodeTest: { cmd: "node", args: [file, "--selftest"] },
    findingsKey: "architecture_findings",
    finding
  };
}

export function multiagentContext(params = {}) {
  return { telos: params.telos || "coordinated multi-role agents over a shared blackboard", maxRounds: params.maxRounds || 3 };
}

const ROLES_SRC = `import assert from "node:assert/strict";
export const ROLES = [
  { id: "researcher", capability: "search", lens: "exploration" },
  { id: "coder", capability: "implement", lens: "synthesis" },
  { id: "reviewer", capability: "verify", lens: "adversarial" }
];
export function getRole(id) { return ROLES.find((r) => r.id === id) || null; }
if (process.argv.includes("--selftest")) {
  assert.ok(ROLES.length >= 3, "need >=3 roles");
  const ids = ROLES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "role ids must be unique");
  for (const r of ROLES) assert.ok(r.id && r.capability && r.lens, "role missing a field");
  assert.equal(getRole("coder").capability, "implement");
  console.log("roles OK: " + ids.join(","));
}
`;

const PROTOCOL_SRC = `import assert from "node:assert/strict";
const TYPES = new Set(["task", "result", "error"]);
// message shape: { from, to, type, payload }
export function validate(msg) {
  if (!msg || typeof msg !== "object") return { ok: false, error: "not an object" };
  for (const f of ["from", "to", "type", "payload"]) if (!(f in msg)) return { ok: false, error: "missing " + f };
  if (typeof msg.from !== "string" || typeof msg.to !== "string") return { ok: false, error: "from/to must be strings" };
  if (!TYPES.has(msg.type)) return { ok: false, error: "bad type" };
  return { ok: true };
}
if (process.argv.includes("--selftest")) {
  assert.equal(validate({ from: "a", to: "b", type: "task", payload: {} }).ok, true, "well-formed passes");
  assert.equal(validate({ from: "a", to: "b", type: "task" }).ok, false, "missing payload rejected");
  assert.equal(validate({ from: "a", to: "b", type: "nope", payload: {} }).ok, false, "bad type rejected");
  assert.equal(validate(null).ok, false, "non-object rejected");
  console.log("protocol OK");
}
`;

const ROUTER_SRC = `import assert from "node:assert/strict";
import { ROLES } from "./roles.mjs";
// route a task { capability } to the first role whose capability matches; else null.
export function route(task, roles = ROLES) {
  const match = roles.find((r) => r.capability === task.capability);
  return match ? match.id : null;
}
if (process.argv.includes("--selftest")) {
  assert.equal(route({ capability: "implement" }), "coder", "routes to coder");
  assert.equal(route({ capability: "verify" }), "reviewer", "routes to reviewer");
  assert.equal(route({ capability: "unknown" }), null, "unmatched -> null fallback");
  console.log("router OK");
}
`;

const BLACKBOARD_SRC = `import assert from "node:assert/strict";
import { validate } from "./protocol.mjs";
// shared store: generic put/get + a protocol-validated post().
export function createBlackboard() {
  const store = new Map();
  return {
    put(key, value) { store.set(key, value); return true; },
    get(key) { return store.has(key) ? store.get(key) : null; },
    post(msg) { const v = validate(msg); if (!v.ok) return { ok: false, error: v.error }; store.set(msg.from + ":" + msg.type, msg); return { ok: true }; },
    keys() { return [...store.keys()]; }
  };
}
if (process.argv.includes("--selftest")) {
  const bb = createBlackboard();
  bb.put("x", 1);
  assert.equal(bb.get("x"), 1, "put/get round-trip");
  assert.equal(bb.get("absent"), null, "absent key -> null");
  assert.equal(bb.post({ from: "a", to: "b", type: "task", payload: {} }).ok, true, "valid message posts");
  assert.equal(bb.post({ bad: true }).ok, false, "invalid message rejected");
  console.log("blackboard OK");
}
`;

const rolesWorkstream = mod({ id: "roles", signer: "codex", dependencies: [], file: "agents/roles.mjs", source: ROLES_SRC, needle: "export const ROLES", finding: "Role registry exposes >=3 unique, well-formed agent roles." });
const protocolWorkstream = mod({ id: "protocol", signer: "codex", dependencies: [], file: "agents/protocol.mjs", source: PROTOCOL_SRC, needle: "export function validate", finding: "Message protocol accepts well-formed messages and rejects malformed ones (fail-closed)." });
const routerWorkstream = mod({ id: "router", signer: "agy", dependencies: ["roles"], file: "agents/router.mjs", source: ROUTER_SRC, needle: "export function route", finding: "Router maps a task to the capability-matching role; unmatched -> null." });
const blackboardWorkstream = mod({ id: "blackboard", signer: "codex", dependencies: ["protocol"], file: "agents/blackboard.mjs", source: BLACKBOARD_SRC, needle: "createBlackboard", finding: "Blackboard round-trips values and gates posted messages through the protocol." });

// NOTE (Task 2 appends orchestrator/aggregator/termination, then assembles the arrays/exports).
export const multiagentBuildWorkstreams = [rolesWorkstream, protocolWorkstream, routerWorkstream, blackboardWorkstream];
```

- [ ] **Step 2: Create `ai-forge/scripts/test-multiagent.mjs`** using the per-component selftest-script template from the conventions section, with `<name>` = `multiagent`.

- [ ] **Step 3: Run the selftest script**

Run: `node ai-forge/scripts/test-multiagent.mjs`
Expected: `test-multiagent.mjs OK` (the four modules render into one tmpdir; each `--selftest` exits 0).

- [ ] **Step 4: Commit**

```bash
git add ai-forge/patterns/multiagent.mjs ai-forge/scripts/test-multiagent.mjs
git commit -m "feat(ai-forge): multi-agent pattern scaffold (roles/protocol/router/blackboard)"
```

### Task 2: multi-agent — orchestrator, aggregator, termination + finalize the build set

**Files:**
- Modify: `ai-forge/patterns/multiagent.mjs` (append three modules; replace the `multiagentBuildWorkstreams` export to include all 7)

**Interfaces:**
- Consumes: `mod`, `multiagentContext`, the four Task-1 modules.
- Produces: `multiagentBuildWorkstreams` (all 7). (The `multiagentPattern` export is added in Task 3.)

- [ ] **Step 1: Append the three module sources** before the `multiagentBuildWorkstreams` line in `patterns/multiagent.mjs`:

```js
const ORCHESTRATOR_SRC = `import assert from "node:assert/strict";
import { ROLES } from "./roles.mjs";
import { route } from "./router.mjs";
import { createBlackboard } from "./blackboard.mjs";
// runRound: each role acts in order via an injected deterministic callAgent;
// outputs are recorded on a fresh blackboard and returned in role order.
export function runRound(task, callAgent, roles = ROLES) {
  const bb = createBlackboard();
  const lead = route({ capability: "implement" }, roles);
  const outputs = [];
  for (const role of roles) { const out = callAgent(role, task); bb.put(role.id, out); outputs.push({ role: role.id, out }); }
  return { lead, outputs, blackboard: bb };
}
if (process.argv.includes("--selftest")) {
  const stub = (role, task) => role.id + ":" + task.goal;
  const { lead, outputs, blackboard } = runRound({ goal: "g" }, stub);
  assert.equal(outputs.length, 3, "one output per role");
  assert.deepEqual(outputs.map((o) => o.role), ["researcher", "coder", "reviewer"], "role order preserved");
  assert.equal(blackboard.get("coder"), "coder:g", "output recorded on blackboard");
  assert.equal(lead, "coder", "lead routed by capability");
  console.log("orchestrator OK");
}
`;

const AGGREGATE_SRC = `import assert from "node:assert/strict";
import { runRound } from "./orchestrator.mjs";
// majority vote over outputs; deterministic tie-break = lexicographically smallest value.
export function aggregate(outputs) {
  const tally = new Map();
  for (const o of outputs) { const k = String(o.out); tally.set(k, (tally.get(k) || 0) + 1); }
  let best = null, bestN = -1;
  for (const [k, n] of [...tally.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (n > bestN) { best = k; bestN = n; }
  return { decision: best, votes: bestN };
}
if (process.argv.includes("--selftest")) {
  assert.deepEqual(aggregate([{ out: "a" }, { out: "a" }, { out: "b" }]), { decision: "a", votes: 2 }, "majority wins");
  assert.equal(aggregate([{ out: "b" }, { out: "a" }]).decision, "a", "tie -> lexicographically smallest");
  const { outputs } = runRound({ goal: "g" }, (role) => (role.id === "reviewer" ? "x" : "y"));
  assert.equal(aggregate(outputs).decision, "y", "aggregates real orchestrator outputs (2 y vs 1 x)");
  console.log("aggregate OK");
}
`;

const TERMINATE_SRC = `import assert from "node:assert/strict";
import { runRound } from "./orchestrator.mjs";
// shouldStop: stop on convergence, else halt at maxRounds (runaway guard).
export function shouldStop(state, maxRounds) {
  if (state.converged) return { stop: true, reason: "converged" };
  if (state.round >= maxRounds) return { stop: true, reason: "max-rounds" };
  return { stop: false, reason: "continue" };
}
if (process.argv.includes("--selftest")) {
  assert.deepEqual(shouldStop({ converged: true, round: 1 }, 5), { stop: true, reason: "converged" }, "stops early on convergence");
  assert.deepEqual(shouldStop({ converged: false, round: 5 }, 5), { stop: true, reason: "max-rounds" }, "runaway halts at bound");
  assert.equal(shouldStop({ converged: false, round: 2 }, 5).stop, false, "continues mid-run");
  // drive a bounded loop over the real orchestrator: must terminate, never infinite.
  let round = 0, stop = false;
  while (!stop) { runRound({ goal: "g" }, (role) => role.id); round++; ({ stop } = shouldStop({ converged: false, round }, 3)); }
  assert.equal(round, 3, "loop halts at maxRounds=3");
  console.log("terminate OK");
}
`;
```

- [ ] **Step 2: Replace** the `export const multiagentBuildWorkstreams = [...]` line with the full set (and add the three `mod(...)` calls just above it):

```js
const orchestratorWorkstream = mod({ id: "orchestrator", signer: "claude", dependencies: ["roles", "router", "blackboard", "protocol"], file: "agents/orchestrator.mjs", source: ORCHESTRATOR_SRC, needle: "export function runRound", finding: "Orchestrator runs each role once in order and records outputs on the blackboard." });
const aggregatorWorkstream = mod({ id: "aggregator", signer: "claude", dependencies: ["orchestrator"], file: "agents/aggregate.mjs", source: AGGREGATE_SRC, needle: "export function aggregate", finding: "Aggregator takes a majority vote with a deterministic tie-break." });
const terminationWorkstream = mod({ id: "termination", signer: "grok", dependencies: ["orchestrator"], file: "agents/terminate.mjs", source: TERMINATE_SRC, needle: "export function shouldStop", finding: "Termination stops on convergence and halts a runaway loop at maxRounds." });

export const multiagentBuildWorkstreams = [
  rolesWorkstream, protocolWorkstream, routerWorkstream, blackboardWorkstream,
  orchestratorWorkstream, aggregatorWorkstream, terminationWorkstream
];
```

- [ ] **Step 3: Run the selftest script (now 7 modules)**

Run: `node ai-forge/scripts/test-multiagent.mjs`
Expected: `test-multiagent.mjs OK`.

- [ ] **Step 4: Commit**

```bash
git add ai-forge/patterns/multiagent.mjs
git commit -m "feat(ai-forge): multi-agent orchestrator/aggregator/termination (7 modules)"
```

### Task 3: multi-agent — assemble pattern + forge e2e + 2 fail-closed + package.json

**Files:**
- Modify: `ai-forge/patterns/multiagent.mjs` (append the `multiagentPattern` export)
- Create: `ai-forge/scripts/test-multiagent-forge.mjs`
- Modify: `ai-forge/package.json`

**Interfaces:**
- Consumes: `multiagentBuildWorkstreams`, `makeDesignWorkstream`, `forge`.
- Produces: `multiagentPattern` (`{ id: "multiagent", workstreams: [...7, design] }`).

- [ ] **Step 1: Append the pattern export** to `patterns/multiagent.mjs`:

```js
export const multiagentPattern = {
  id: "multiagent",
  workstreams: [...multiagentBuildWorkstreams, makeDesignWorkstream(multiagentBuildWorkstreams)]
};
```

- [ ] **Step 2: Create `ai-forge/scripts/test-multiagent-forge.mjs`** (mirror `scripts/test-telos-forge.mjs`; the FC1 component is `protocol`):

```js
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { multiagentPattern, multiagentContext } from "../patterns/multiagent.mjs";

const dossierMeta = { build_id: "multiagent-e2e", idea_id: "multiagent", use_case: "agents", objective: "Forge a multi-agent system" };

// Happy path: all 8 workstreams converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-"));
  const result = await forge({ pattern: multiagentPattern, ctx: multiagentContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.converged), "every component converges");
}

// Fail-closed #1: break `protocol` so its selftest asserts a malformed message is VALID -> node test fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-fc1-"));
  const broken = {
    ...multiagentPattern,
    workstreams: multiagentPattern.workstreams.map((w) => w.id !== "protocol" ? w : {
      ...w,
      render: () => ({ "agents/protocol.mjs": 'import assert from "node:assert/strict";\nexport function validate(){ return { ok: false }; }\nif (process.argv.includes("--selftest")) { assert.equal(validate({}).ok, true, "WRONG: malformed should not validate"); }\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: multiagentContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken protocol component must NOT converge");
}

// Fail-closed #2: drift the design (omit a component from DESIGN.md) -> design verify fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-fc2-"));
  const build = multiagentPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = multiagentPattern.workstreams.find((w) => w.id === "design");
  const brokenDesign = {
    ...realDesign,
    render: (ctx) => {
      const out = realDesign.render(ctx);
      const md = out["docs/DESIGN.md"];
      const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]).slice(1);
      out["docs/DESIGN.md"] = md.replace(/```json\s*[\s\S]*?```/, "```json\n" + JSON.stringify(block, null, 2) + "\n```");
      return out;
    }
  };
  const result = await forge({ pattern: { ...multiagentPattern, workstreams: [...build, brokenDesign] }, ctx: multiagentContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a drifted design must NOT converge");
}

console.log("test-multiagent-forge.mjs OK");
```

- [ ] **Step 3: Append to `ai-forge/package.json`** — add `node --check scripts/test-multiagent.mjs && node --check scripts/test-multiagent-forge.mjs` to the `check` script and `node scripts/test-multiagent.mjs && node scripts/test-multiagent-forge.mjs` to the `test` script, preserving existing `&&`-chained entries.

- [ ] **Step 4: Run the e2e**

Run: `node ai-forge/scripts/test-multiagent-forge.mjs`
Expected: `test-multiagent-forge.mjs OK` (happy path converges with 8 records; FC1 and FC2 each not-converged).
Then: `cd ai-forge && npm test` → exit 0 (all suites). If a workstream does not converge, read `result.cycles` blockers and fix the module source in `patterns/multiagent.mjs` (a dep, the model/signer, or the selftest wiring) — NEVER the forge/spine.

- [ ] **Step 5: Commit**

```bash
git add ai-forge/patterns/multiagent.mjs ai-forge/scripts/test-multiagent-forge.mjs ai-forge/package.json
git commit -m "feat(ai-forge): assemble multi-agent pattern (8 workstreams) + forge e2e + fail-closed"
```

### Task 4: multi-agent — sanitized run evidence

**Files:**
- Create: `docs/runs/ai-forge-multiagent/run.mjs`, `docs/runs/ai-forge-multiagent/run-summary.json`, `docs/runs/ai-forge-multiagent/README.md`

**Interfaces:**
- Consumes: `multiagentPattern`, `multiagentContext`, `forge`.

- [ ] **Step 1: Create `docs/runs/ai-forge-multiagent/run.mjs`** — forge into an `os.tmpdir()` root and write a sanitized summary. Mirror `docs/runs/ai-forge-rag/run.mjs` for import depth (`../../../ai-forge/...`):

```js
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { forge } from "../../../ai-forge/forge.mjs";
import { multiagentPattern, multiagentContext } from "../../../ai-forge/patterns/multiagent.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = mkdtempSync(path.join(os.tmpdir(), "aiforge-multiagent-run-"));
mkdirSync(path.join(projectRoot, ".telos"), { recursive: true });

const dossierMeta = {
  build_id: "ai-forge-multiagent-evidence",
  idea_id: "ai-forge-multiagent-evidence",
  use_case: "AI architecture: multi-agent pattern evidence run",
  objective: "Prove the multi-agent pattern converges over the forge gate."
};

const result = await forge({ pattern: multiagentPattern, ctx: multiagentContext(), projectRoot, dossierMeta });

// Sanitized summary — mirrors docs/runs/ai-forge-telos/run.mjs exactly.
const summary = {
  converged: result.converged,
  merge_status: result.converged ? "ready" : "not-ready",
  gate_status: result.verdict ? result.verdict.gate_status : "not-run",
  workstreams: (result.records || []).map((r) => ({ id: r.workstream, converged: r.converged, finalStatus: r.finalStatus })),
  generated_at_note: "deterministic; no timestamps"
};
const raw = JSON.stringify(summary);
if (raw.includes("file://") || /[A-Za-z]:[\\/]/.test(raw) || raw.includes("/home/") || raw.includes("/Users/")) {
  throw new Error("SANITIZATION FAILURE: absolute path detected in summary — do not commit.");
}
writeFileSync(path.join(here, "run-summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`multiagent run: converged=${summary.converged} gate_status=${summary.gate_status} workstreams=${summary.workstreams.length}`);
process.exit(result.converged ? 0 : 1);
```

(This is the exact shape of the committed `docs/runs/ai-forge-telos/run.mjs` — `r.workstream`/`r.converged`/`r.finalStatus`, `merge_status` derived from `converged`. The eval/serving runs in Tasks 8 and 12 copy this and change only imports/prefix/dossier ids.)

- [ ] **Step 2: Run it and confirm sanitization**

Run: `node docs/runs/ai-forge-multiagent/run.mjs`
Expected: `multiagent run: converged=true gate_status=pass workstreams=8`; `run-summary.json` written with no `file://`/absolute path (the script throws otherwise).

- [ ] **Step 3: Create `docs/runs/ai-forge-multiagent/README.md`** — what the run proves: ai-forge forges a coordinating multi-role agent system (roles · protocol · router · blackboard · orchestrator · aggregator · termination) + a verified design; 8 workstreams converge; keyless; genuine per-component executable checks.

- [ ] **Step 4: Commit**

```bash
git add docs/runs/ai-forge-multiagent/run.mjs docs/runs/ai-forge-multiagent/run-summary.json docs/runs/ai-forge-multiagent/README.md
git commit -m "docs(ai-forge): multi-agent pattern run evidence (sanitized)"
```

---

# PATTERN 2 — eval-harness (`patterns/eval.mjs`)

DAG: root `dataset`; `target←{dataset}`; `runner←{dataset,target}`; `metrics←{runner}`; `scorecard←{metrics}`; `threshold←{scorecard}`; `regression←{scorecard}`; `design←all 7`.

### Task 5: eval scaffold — context, helper, and dataset/target/runner/metrics

**Files:**
- Create: `ai-forge/patterns/eval.mjs`
- Create: `ai-forge/scripts/test-eval.mjs`

- [ ] **Step 1: Create `ai-forge/patterns/eval.mjs`** with the helper, context, and the first four modules. The `mod` helper and `evalContext` follow the conventions section (`evalContext(params={})` returns `{ telos: "...", epsilon: 1e-9 }`). Module sources:

```js
const DATASET_SRC = `import assert from "node:assert/strict";
// fixed labelled eval set (binary sentiment). expected in {positive, negative}.
export const DATASET = [
  { id: "c1", input: "great product love it", expected: "positive" },
  { id: "c2", input: "terrible broke immediately", expected: "negative" },
  { id: "c3", input: "works as described happy", expected: "positive" },
  { id: "c4", input: "awful waste of money", expected: "negative" }
];
if (process.argv.includes("--selftest")) {
  assert.ok(DATASET.length >= 4, "need >=4 cases");
  const ids = DATASET.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, "case ids unique");
  for (const c of DATASET) assert.ok(c.input && c.expected, "case missing input/expected");
  console.log("dataset OK: " + DATASET.length + " cases");
}
`;

const TARGET_SRC = `import assert from "node:assert/strict";
import { DATASET } from "./dataset.mjs";
const POS = new Set(["great", "love", "works", "happy", "good", "excellent"]);
const NEG = new Set(["terrible", "broke", "awful", "waste", "bad", "horrible"]);
// deterministic keyword classifier; ties -> negative.
export function predict(input) {
  const toks = String(input).toLowerCase().match(/[a-z]+/g) || [];
  let p = 0, n = 0;
  for (const t of toks) { if (POS.has(t)) p++; if (NEG.has(t)) n++; }
  return p > n ? "positive" : "negative";
}
if (process.argv.includes("--selftest")) {
  const a = DATASET.map((c) => predict(c.input));
  const b = DATASET.map((c) => predict(c.input));
  assert.deepEqual(a, b, "predict is deterministic");
  assert.equal(a.length, DATASET.length, "total over dataset inputs");
  assert.equal(predict("great love"), "positive");
  console.log("target OK");
}
`;

const RUNNER_SRC = `import assert from "node:assert/strict";
import { DATASET } from "./dataset.mjs";
import { predict } from "./target.mjs";
// run the target over the dataset -> one prediction per case, aligned by id.
export function runTarget() {
  return DATASET.map((c) => ({ id: c.id, predicted: predict(c.input), expected: c.expected }));
}
if (process.argv.includes("--selftest")) {
  const preds = runTarget();
  assert.equal(preds.length, DATASET.length, "one prediction per case");
  assert.deepEqual(preds.map((p) => p.id), DATASET.map((c) => c.id), "aligned by id, in order");
  for (const p of preds) assert.ok(p.predicted === "positive" || p.predicted === "negative", "valid label");
  console.log("runner OK");
}
`;

const METRICS_SRC = `import assert from "node:assert/strict";
import { runTarget } from "./run-target.mjs";
// accuracy + precision/recall for the "positive" class. predictions/expected: label arrays.
export function computeMetrics(predicted, expected) {
  let correct = 0, tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < expected.length; i++) {
    if (predicted[i] === expected[i]) correct++;
    if (predicted[i] === "positive" && expected[i] === "positive") tp++;
    if (predicted[i] === "positive" && expected[i] === "negative") fp++;
    if (predicted[i] === "negative" && expected[i] === "positive") fn++;
  }
  const n = expected.length;
  return {
    accuracy: correct / n,
    precision: tp + fp === 0 ? 1 : tp / (tp + fp),
    recall: tp + fn === 0 ? 1 : tp / (tp + fn)
  };
}
if (process.argv.includes("--selftest")) {
  // hand-computed fixture: TP=1, FP=1, FN=1, TN=1 -> all 0.5
  const m = computeMetrics(["positive", "negative", "negative", "positive"], ["positive", "positive", "negative", "negative"]);
  assert.equal(m.accuracy, 0.5, "accuracy 0.5");
  assert.equal(m.precision, 0.5, "precision 0.5");
  assert.equal(m.recall, 0.5, "recall 0.5");
  // over the real runner: perfect target -> 1.0
  const preds = runTarget();
  const real = computeMetrics(preds.map((p) => p.predicted), preds.map((p) => p.expected));
  assert.equal(real.accuracy, 1, "target is perfect on the fixed dataset");
  console.log("metrics OK");
}
`;
```

Then the four `mod(...)` calls + a partial `evalBuildWorkstreams` export:

```js
const datasetWorkstream = mod({ id: "dataset", signer: "codex", dependencies: [], file: "eval/dataset.mjs", source: DATASET_SRC, needle: "export const DATASET", finding: "Eval dataset has >=4 unique, well-formed labelled cases." });
const targetWorkstream = mod({ id: "target", signer: "claude", dependencies: ["dataset"], file: "eval/target.mjs", source: TARGET_SRC, needle: "export function predict", finding: "Target classifier is total over the dataset and deterministic." });
const runnerWorkstream = mod({ id: "runner", signer: "codex", dependencies: ["dataset", "target"], file: "eval/run-target.mjs", source: RUNNER_SRC, needle: "export function runTarget", finding: "Runner produces one id-aligned prediction per case." });
const metricsWorkstream = mod({ id: "metrics", signer: "agy", dependencies: ["runner"], file: "eval/metrics.mjs", source: METRICS_SRC, needle: "export function computeMetrics", finding: "Metrics compute accuracy/precision/recall, proven against a hand-computed fixture." });

export const evalBuildWorkstreams = [datasetWorkstream, targetWorkstream, runnerWorkstream, metricsWorkstream];
```

- [ ] **Step 2: Create `ai-forge/scripts/test-eval.mjs`** from the selftest-script template (`<name>` = `eval`).
- [ ] **Step 3: Run** `node ai-forge/scripts/test-eval.mjs` → `test-eval.mjs OK`.
- [ ] **Step 4: Commit**

```bash
git add ai-forge/patterns/eval.mjs ai-forge/scripts/test-eval.mjs
git commit -m "feat(ai-forge): eval-harness scaffold (dataset/target/runner/metrics)"
```

### Task 6: eval — scorecard (stored≈recomputed), threshold, regression + finalize build set

**Files:**
- Modify: `ai-forge/patterns/eval.mjs`

- [ ] **Step 1: Append the three module sources.** `scorecard` is fixture-isolated (writes under `os.tmpdir()`), re-reads, asserts stored≈recomputed, and tamper→fail (resolves #30 item 2):

```js
const SCORECARD_SRC = `import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runTarget } from "./run-target.mjs";
import { computeMetrics } from "./metrics.mjs";
const EPS = 1e-9;
export function writeScorecard(dir) {
  const preds = runTarget();
  const metrics = computeMetrics(preds.map((p) => p.predicted), preds.map((p) => p.expected));
  const card = { dataset: "eval-binary-sentiment-v1", n: preds.length, metrics };
  writeFileSync(path.join(dir, "scorecard.json"), JSON.stringify(card, null, 2) + "\\n");
  return card;
}
export function verifyScorecard(dir) {
  const stored = JSON.parse(readFileSync(path.join(dir, "scorecard.json"), "utf8"));
  const preds = runTarget();
  const recomputed = computeMetrics(preds.map((p) => p.predicted), preds.map((p) => p.expected));
  for (const k of Object.keys(recomputed)) {
    if (Math.abs(stored.metrics[k] - recomputed[k]) > EPS) return { ok: false, error: "stored " + k + " != recomputed" };
  }
  return { ok: true };
}
if (process.argv.includes("--selftest")) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "eval-scorecard-"));
  writeScorecard(dir);
  assert.equal(verifyScorecard(dir).ok, true, "stored == recomputed");
  // tamper a stored metric -> verify must fail (fail-closed)
  const file = path.join(dir, "scorecard.json");
  const card = JSON.parse(readFileSync(file, "utf8"));
  card.metrics.accuracy = card.metrics.accuracy - 0.5;
  writeFileSync(file, JSON.stringify(card, null, 2) + "\\n");
  assert.equal(verifyScorecard(dir).ok, false, "tampered scorecard is rejected");
  console.log("scorecard OK");
}
`;

const THRESHOLD_SRC = `import assert from "node:assert/strict";
// gate metrics against minimum thresholds.
export function gate(metrics, thresholds) {
  const failing = Object.keys(thresholds).filter((k) => metrics[k] < thresholds[k]);
  return { pass: failing.length === 0, failing };
}
if (process.argv.includes("--selftest")) {
  assert.equal(gate({ accuracy: 0.9, precision: 0.9 }, { accuracy: 0.8, precision: 0.8 }).pass, true, "above thresholds -> pass");
  const r = gate({ accuracy: 0.5 }, { accuracy: 0.8 });
  assert.equal(r.pass, false, "below threshold -> blocked");
  assert.deepEqual(r.failing, ["accuracy"], "names the failing metric");
  console.log("threshold OK");
}
`;

const REGRESSION_SRC = `import assert from "node:assert/strict";
// flag any metric that drops more than tolerance below the baseline.
export function detectRegression(baseline, current, tolerance = 0.0) {
  const regressed = Object.keys(baseline).filter((k) => current[k] < baseline[k] - tolerance);
  return { regressed, ok: regressed.length === 0 };
}
if (process.argv.includes("--selftest")) {
  const base = { accuracy: 0.9, precision: 0.9 };
  assert.equal(detectRegression(base, { accuracy: 0.9, precision: 0.95 }).ok, true, "equal/better -> clean");
  const r = detectRegression(base, { accuracy: 0.7, precision: 0.9 });
  assert.equal(r.ok, false, "worse than baseline -> flagged");
  assert.deepEqual(r.regressed, ["accuracy"], "names the regressed metric");
  console.log("regression OK");
}
`;
```

- [ ] **Step 2: Replace** the `evalBuildWorkstreams` export with the full set (add the three `mod(...)` calls above it):

```js
const scorecardWorkstream = mod({ id: "scorecard", signer: "agy", dependencies: ["metrics"], file: "eval/scorecard.mjs", source: SCORECARD_SRC, needle: "stored == recomputed", finding: "Scorecard asserts stored metrics equal recomputed and rejects tampering (fail-closed)." });
const thresholdWorkstream = mod({ id: "threshold", signer: "grok", dependencies: ["scorecard"], file: "eval/threshold.mjs", source: THRESHOLD_SRC, needle: "export function gate", finding: "Threshold gate passes metrics above bounds and blocks those below." });
const regressionWorkstream = mod({ id: "regression", signer: "grok", dependencies: ["scorecard"], file: "eval/regression.mjs", source: REGRESSION_SRC, needle: "export function detectRegression", finding: "Regression check flags metrics that drop below a baseline." });

export const evalBuildWorkstreams = [
  datasetWorkstream, targetWorkstream, runnerWorkstream, metricsWorkstream,
  scorecardWorkstream, thresholdWorkstream, regressionWorkstream
];
```

Note: `scorecard`'s `needle` is `"stored == recomputed"` — that exact comment/string appears in `SCORECARD_SRC` (the `assert` message), so the surface `file_contains` check matches.

- [ ] **Step 3: Run** `node ai-forge/scripts/test-eval.mjs` → `test-eval.mjs OK` (now 7 modules).
- [ ] **Step 4: Commit**

```bash
git add ai-forge/patterns/eval.mjs
git commit -m "feat(ai-forge): eval scorecard (stored=recomputed)/threshold/regression (7 modules)"
```

### Task 7: eval — assemble pattern + forge e2e + 2 fail-closed + package.json

**Files:**
- Modify: `ai-forge/patterns/eval.mjs` (append `evalPattern`)
- Create: `ai-forge/scripts/test-eval-forge.mjs`
- Modify: `ai-forge/package.json`

- [ ] **Step 1: Append** to `patterns/eval.mjs`:

```js
export const evalPattern = {
  id: "eval",
  workstreams: [...evalBuildWorkstreams, makeDesignWorkstream(evalBuildWorkstreams)]
};
```

- [ ] **Step 2: Create `ai-forge/scripts/test-eval-forge.mjs`** — copy `scripts/test-multiagent-forge.mjs` and change: imports → `evalPattern, evalContext`; `dossierMeta` ids → `eval`; tmpdir prefixes → `aiforge-eval-`. **FC1 breaks `scorecard`** (assert a tampered card verifies):

```js
// FC1 block (replace the multiagent FC1 with this):
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-eval-fc1-"));
  const broken = {
    ...evalPattern,
    workstreams: evalPattern.workstreams.map((w) => w.id !== "scorecard" ? w : {
      ...w,
      render: () => ({ "eval/scorecard.mjs": 'import assert from "node:assert/strict";\nexport function verifyScorecard(){ return { ok: false }; }\nif (process.argv.includes("--selftest")) { assert.equal(verifyScorecard().ok, true, "WRONG: tampered card should not verify"); }\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: evalContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken scorecard component must NOT converge");
}
```

(Keep the happy-path and FC2 blocks structurally identical to `test-multiagent-forge.mjs`, with eval imports/prefixes. End with `console.log("test-eval-forge.mjs OK");`.)

- [ ] **Step 3: Append** the eval lines to `package.json` `check`/`test` (`node --check scripts/test-eval.mjs && node --check scripts/test-eval-forge.mjs` and `node scripts/test-eval.mjs && node scripts/test-eval-forge.mjs`).

- [ ] **Step 4: Run** `node ai-forge/scripts/test-eval-forge.mjs` → `test-eval-forge.mjs OK`; then `cd ai-forge && npm test` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add ai-forge/patterns/eval.mjs ai-forge/scripts/test-eval-forge.mjs ai-forge/package.json
git commit -m "feat(ai-forge): assemble eval-harness pattern (8 workstreams) + forge e2e + fail-closed"
```

### Task 8: eval — sanitized run evidence

**Files:**
- Create: `docs/runs/ai-forge-eval/run.mjs`, `docs/runs/ai-forge-eval/run-summary.json`, `docs/runs/ai-forge-eval/README.md`

- [ ] **Step 1:** Create `docs/runs/ai-forge-eval/run.mjs` by copying `docs/runs/ai-forge-multiagent/run.mjs` and changing imports to `evalPattern, evalContext`, the tmpdir prefix to `aiforge-eval-run-`, and the `dossierMeta` ids to `eval`.
- [ ] **Step 2:** Run `node docs/runs/ai-forge-eval/run.mjs` → `eval run: converged=true gate_status=pass workstreams=8`; sanitization guard passes.
- [ ] **Step 3:** Create `docs/runs/ai-forge-eval/README.md` — ai-forge forges an eval harness (dataset · target · runner · metrics · scorecard · threshold · regression) + verified design; the scorecard's stored≈recomputed assertion is the first-class form of the #30 item-2 cross-check; 8 workstreams converge; keyless.
- [ ] **Step 4: Commit**

```bash
git add docs/runs/ai-forge-eval/run.mjs docs/runs/ai-forge-eval/run-summary.json docs/runs/ai-forge-eval/README.md
git commit -m "docs(ai-forge): eval-harness pattern run evidence (sanitized)"
```

---

# PATTERN 3 — serving+guardrails (`patterns/serving.mjs`)

DAG: root `schema`; `handler←{schema}`; `input-guardrail←{schema}`; `output-guardrail←{handler}`; `ratelimit←{schema}`; `authz←{schema}`; `audit←{handler,authz}`; `design←all 7`.

### Task 9: serving scaffold — context, helper, and schema/handler/input-guardrail/output-guardrail

**Files:**
- Create: `ai-forge/patterns/serving.mjs`
- Create: `ai-forge/scripts/test-serving.mjs`

- [ ] **Step 1: Create `ai-forge/patterns/serving.mjs`** with helper, `servingContext(params={})` (returns `{ telos: "...", denylist: ["password", "ssn"], maxBodyLen: 256 }`), and four module sources:

```js
const SCHEMA_SRC = `import assert from "node:assert/strict";
// request: { path:string, method:"GET"|"POST", body:object }
export function validate(req) {
  if (!req || typeof req !== "object") return { ok: false, error: "not an object" };
  if (typeof req.path !== "string" || !req.path.startsWith("/")) return { ok: false, error: "bad path" };
  if (req.method !== "GET" && req.method !== "POST") return { ok: false, error: "bad method" };
  if (typeof req.body !== "object" || req.body === null) return { ok: false, error: "bad body" };
  return { ok: true };
}
if (process.argv.includes("--selftest")) {
  assert.equal(validate({ path: "/echo", method: "POST", body: {} }).ok, true, "conforming passes");
  assert.equal(validate({ path: "echo", method: "POST", body: {} }).ok, false, "bad path rejected");
  assert.equal(validate({ path: "/x", method: "PUT", body: {} }).ok, false, "bad method rejected");
  console.log("schema OK");
}
`;

const HANDLER_SRC = `import assert from "node:assert/strict";
import { validate } from "./schema.mjs";
// pure handler: validate then echo the body with a 200; invalid -> 400.
export function handle(req) {
  const v = validate(req);
  if (!v.ok) return { status: 400, body: { error: v.error } };
  return { status: 200, body: { echo: req.body } };
}
if (process.argv.includes("--selftest")) {
  const r = handle({ path: "/echo", method: "POST", body: { a: 1 } });
  assert.equal(r.status, 200, "valid -> 200");
  assert.deepEqual(r.body.echo, { a: 1 }, "echoes body");
  assert.equal(handle({ path: "bad", method: "POST", body: {} }).status, 400, "invalid -> 400");
  console.log("handler OK");
}
`;

const GUARD_IN_SRC = `import assert from "node:assert/strict";
const MAX = 256;
const DENY = ["<script", "drop table", "ignore previous"];
// reject oversized or denylisted input.
export function checkInput(req) {
  const s = JSON.stringify(req.body || {}).toLowerCase();
  if (s.length > MAX) return { allow: false, reason: "oversized" };
  for (const bad of DENY) if (s.includes(bad)) return { allow: false, reason: "denylisted" };
  return { allow: true };
}
if (process.argv.includes("--selftest")) {
  assert.equal(checkInput({ body: { q: "hello" } }).allow, true, "clean input passes");
  assert.equal(checkInput({ body: { q: "<script>x" } }).allow, false, "denylisted input rejected");
  assert.equal(checkInput({ body: { q: "a".repeat(300) } }).allow, false, "oversized input rejected");
  console.log("input-guardrail OK");
}
`;

const GUARD_OUT_SRC = `import assert from "node:assert/strict";
import { handle } from "./handler.mjs";
const BLOCK = [/password/gi, /\\b\\d{3}-\\d{2}-\\d{4}\\b/g];
// redact blocked tokens in an outgoing response body.
export function redactOutput(res) {
  let s = JSON.stringify(res.body);
  for (const re of BLOCK) s = s.replace(re, "[redacted]");
  return { status: res.status, body: JSON.parse(s) };
}
if (process.argv.includes("--selftest")) {
  const out = redactOutput({ status: 200, body: { echo: { note: "my password is x", ssn: "123-45-6789" } } });
  const s = JSON.stringify(out.body);
  assert.ok(!/password/i.test(s), "password redacted");
  assert.ok(!/123-45-6789/.test(s), "ssn redacted");
  const clean = redactOutput(handle({ path: "/echo", method: "POST", body: { a: 1 } }));
  assert.deepEqual(clean.body.echo, { a: 1 }, "clean output unchanged");
  console.log("output-guardrail OK");
}
`;
```

Then four `mod(...)` calls + partial export:

```js
const schemaWorkstream = mod({ id: "schema", signer: "codex", dependencies: [], file: "serving/schema.mjs", source: SCHEMA_SRC, needle: "export function validate", finding: "Request schema accepts conforming requests and rejects malformed ones." });
const handlerWorkstream = mod({ id: "handler", signer: "claude", dependencies: ["schema"], file: "serving/handler.mjs", source: HANDLER_SRC, needle: "export function handle", finding: "Handler validates then echoes; invalid requests get a 400." });
const inputGuardWorkstream = mod({ id: "input-guardrail", signer: "grok", dependencies: ["schema"], file: "serving/guard-in.mjs", source: GUARD_IN_SRC, needle: "export function checkInput", finding: "Input guardrail rejects oversized and denylisted input (fail-closed)." });
const outputGuardWorkstream = mod({ id: "output-guardrail", signer: "grok", dependencies: ["handler"], file: "serving/guard-out.mjs", source: GUARD_OUT_SRC, needle: "export function redactOutput", finding: "Output guardrail redacts blocked tokens and passes clean output unchanged." });

export const servingBuildWorkstreams = [schemaWorkstream, handlerWorkstream, inputGuardWorkstream, outputGuardWorkstream];
```

- [ ] **Step 2:** Create `ai-forge/scripts/test-serving.mjs` from the selftest-script template (`<name>` = `serving`).
- [ ] **Step 3:** Run `node ai-forge/scripts/test-serving.mjs` → `test-serving.mjs OK`.
- [ ] **Step 4: Commit**

```bash
git add ai-forge/patterns/serving.mjs ai-forge/scripts/test-serving.mjs
git commit -m "feat(ai-forge): serving scaffold (schema/handler/input+output guardrails)"
```

### Task 10: serving — ratelimit, authz, audit + finalize build set

**Files:**
- Modify: `ai-forge/patterns/serving.mjs`

- [ ] **Step 1: Append the three module sources.** `ratelimit` uses an injected `now` (no `Date.now`); `authz` is a keyless fake token→caps map (no real secrets); `audit` writes to an injected `os.tmpdir()` path (fixture-isolated):

```js
const RATELIMIT_SRC = `import assert from "node:assert/strict";
// deterministic token bucket; 'now' is injected (ms). capacity tokens per windowMs.
export function createLimiter(capacity, windowMs) {
  const state = new Map();
  return function allow(key, now) {
    const e = state.get(key) || { count: 0, windowStart: now };
    if (now - e.windowStart >= windowMs) { e.count = 0; e.windowStart = now; }
    if (e.count >= capacity) { state.set(key, e); return { allow: false }; }
    e.count++; state.set(key, e); return { allow: true };
  };
}
if (process.argv.includes("--selftest")) {
  const allow = createLimiter(2, 1000);
  assert.equal(allow("k", 0).allow, true, "1st allowed");
  assert.equal(allow("k", 10).allow, true, "2nd allowed");
  assert.equal(allow("k", 20).allow, false, "3rd blocked in window");
  assert.equal(allow("k", 1100).allow, true, "allowed after refill");
  console.log("ratelimit OK");
}
`;

const AUTHZ_SRC = `import assert from "node:assert/strict";
// keyless capability check over a FAKE token->caps map (NOT real secrets/auth).
const CAPS = { "tok-reader": ["read"], "tok-admin": ["read", "write"] };
export function authorize(token, action) {
  const caps = CAPS[token] || [];
  return { allow: caps.includes(action) };
}
if (process.argv.includes("--selftest")) {
  assert.equal(authorize("tok-admin", "write").allow, true, "admin can write");
  assert.equal(authorize("tok-reader", "write").allow, false, "reader cannot write");
  assert.equal(authorize("nope", "read").allow, false, "unknown token denied");
  console.log("authz OK");
}
`;

const AUDIT_SRC = `import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, appendFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { handle } from "./handler.mjs";
import { authorize } from "./authz.mjs";
// append-only structured audit line to an injected dir.
export function appendAudit(dir, entry) {
  const line = JSON.stringify({ path: entry.path, action: entry.action, status: entry.status, allow: entry.allow }) + "\\n";
  appendFileSync(path.join(dir, "audit.log"), line);
}
if (process.argv.includes("--selftest")) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "serving-audit-"));
  const req = { path: "/echo", method: "POST", body: { a: 1 } };
  const res = handle(req);
  const az = authorize("tok-admin", "write");
  appendAudit(dir, { path: req.path, action: "write", status: res.status, allow: az.allow });
  const lines = readFileSync(path.join(dir, "audit.log"), "utf8").trim().split("\\n");
  assert.equal(lines.length, 1, "exactly one line appended");
  const rec = JSON.parse(lines[0]);
  for (const f of ["path", "action", "status", "allow"]) assert.ok(f in rec, "audit line has " + f);
  console.log("audit OK");
}
`;
```

- [ ] **Step 2: Replace** the `servingBuildWorkstreams` export (add the three `mod(...)` calls above it):

```js
const ratelimitWorkstream = mod({ id: "ratelimit", signer: "agy", dependencies: ["schema"], file: "serving/ratelimit.mjs", source: RATELIMIT_SRC, needle: "export function createLimiter", finding: "Rate limiter allows N per window and blocks the next, refilling after the window." });
const authzWorkstream = mod({ id: "authz", signer: "agy", dependencies: ["schema"], file: "serving/authz.mjs", source: AUTHZ_SRC, needle: "export function authorize", finding: "Authz allows capability-matched actions and denies others (keyless fake map)." });
const auditWorkstream = mod({ id: "audit", signer: "codex", dependencies: ["handler", "authz"], file: "serving/audit.mjs", source: AUDIT_SRC, needle: "export function appendAudit", finding: "Audit appends one structured line per request to an isolated tmpdir log." });

export const servingBuildWorkstreams = [
  schemaWorkstream, handlerWorkstream, inputGuardWorkstream, outputGuardWorkstream,
  ratelimitWorkstream, authzWorkstream, auditWorkstream
];
```

- [ ] **Step 3:** Run `node ai-forge/scripts/test-serving.mjs` → `test-serving.mjs OK` (7 modules).
- [ ] **Step 4: Commit**

```bash
git add ai-forge/patterns/serving.mjs
git commit -m "feat(ai-forge): serving ratelimit/authz/audit (7 modules)"
```

### Task 11: serving — assemble pattern + forge e2e + 2 fail-closed + package.json

**Files:**
- Modify: `ai-forge/patterns/serving.mjs` (append `servingPattern`)
- Create: `ai-forge/scripts/test-serving-forge.mjs`
- Modify: `ai-forge/package.json`

- [ ] **Step 1: Append** to `patterns/serving.mjs`:

```js
export const servingPattern = {
  id: "serving",
  workstreams: [...servingBuildWorkstreams, makeDesignWorkstream(servingBuildWorkstreams)]
};
```

- [ ] **Step 2: Create `ai-forge/scripts/test-serving-forge.mjs`** — copy `test-multiagent-forge.mjs`, change imports → `servingPattern, servingContext`, ids → `serving`, prefixes → `aiforge-serving-`. **FC1 breaks `input-guardrail`** (accept a denylisted input):

```js
// FC1 block:
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-serving-fc1-"));
  const broken = {
    ...servingPattern,
    workstreams: servingPattern.workstreams.map((w) => w.id !== "input-guardrail" ? w : {
      ...w,
      render: () => ({ "serving/guard-in.mjs": 'import assert from "node:assert/strict";\nexport function checkInput(){ return { allow: true }; }\nif (process.argv.includes("--selftest")) { assert.equal(checkInput({ body: { q: "<script>x" } }).allow, false, "WRONG: denylisted should be rejected"); }\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: servingContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken input-guardrail must NOT converge");
}
```

(Happy-path + FC2 blocks identical in structure with serving imports/prefixes; end `console.log("test-serving-forge.mjs OK");`.)

- [ ] **Step 3: Append** serving lines to `package.json` `check`/`test`.
- [ ] **Step 4: Run** `node ai-forge/scripts/test-serving-forge.mjs` → OK; then `cd ai-forge && npm test` → exit 0.
- [ ] **Step 5: Commit**

```bash
git add ai-forge/patterns/serving.mjs ai-forge/scripts/test-serving-forge.mjs ai-forge/package.json
git commit -m "feat(ai-forge): assemble serving+guardrails pattern (8 workstreams) + forge e2e + fail-closed"
```

### Task 12: serving — sanitized run evidence

**Files:**
- Create: `docs/runs/ai-forge-serving/run.mjs`, `docs/runs/ai-forge-serving/run-summary.json`, `docs/runs/ai-forge-serving/README.md`

- [ ] **Step 1:** Create `docs/runs/ai-forge-serving/run.mjs` by copying the multiagent run and changing imports to `servingPattern, servingContext`, prefix `aiforge-serving-run-`, ids `serving`.
- [ ] **Step 2:** Run `node docs/runs/ai-forge-serving/run.mjs` → `serving run: converged=true gate_status=pass workstreams=8`; sanitization guard passes.
- [ ] **Step 3:** Create `docs/runs/ai-forge-serving/README.md` — ai-forge forges a serving layer with guardrails (schema · handler · input/output guardrails · ratelimit · authz · audit) + verified design; keyless (the authz map is a fake, not real secrets); 8 workstreams converge.
- [ ] **Step 4: Commit**

```bash
git add docs/runs/ai-forge-serving/run.mjs docs/runs/ai-forge-serving/run-summary.json docs/runs/ai-forge-serving/README.md
git commit -m "docs(ai-forge): serving+guardrails pattern run evidence (sanitized)"
```

---

### Task 13: Phase C.2 close-out — roadmap + top-level README

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `README.md`

- [ ] **Step 1: `docs/ROADMAP.md`** — add a **Phase C.2** subsection under Phases marked `✅ done` (three patterns: multi-agent, eval-harness, serving+guardrails); add a Status-table row `C.2 — catalog breadth | ✅ done | [phase-c2-design](specs/2026-06-29-ai-forge-phase-c2-design.md) | — | [multiagent](runs/ai-forge-multiagent/) · [eval](runs/ai-forge-eval/) · [serving](runs/ai-forge-serving/) | three 8-workstream patterns converge; PRs <range>`; add a Decisions-log line dated 2026-06-29 ("Phase C.2 built — three standalone patterns, ~24 workstreams converge; eval scorecard makes #30 item-2 cross-check first-class"). Preserve all existing content.

- [ ] **Step 2: top-level `README.md`** — in the AI Forge section, extend the catalog line: the library now includes **multi-agent**, **eval-harness**, and **serving+guardrails** patterns (alongside RAG and the self-similar TELOS pattern). Preserve everything else.

- [ ] **Step 3:** Sanity: `cd ai-forge && npm test` → exit 0 (unchanged by docs).

- [ ] **Step 4: Commit**

```bash
git add docs/ROADMAP.md README.md
git commit -m "docs(ai-forge): Phase C.2 close-out — roadmap + README (three new patterns)"
```

---

## Notes for the executor

- The controller pre-creates each task's branch; implementers commit LOCALLY (explicit `git add` of the listed paths, never `-A`). The controller does push → PR → CI → squash-merge. `.superpowers/` is gitignored.
- **Do not touch** the spine, `saas-forge`, the RAG/TELOS patterns, or the Phase A/B forge modules. If a forged module doesn't converge, the fix is in its `patterns/<name>.mjs` source (a dependency edge, the signer, or the selftest wiring) — never the forge/spine.
- **Fixture isolation is load-bearing** — `scorecard` and `audit` selftests MUST write under `os.tmpdir()`. A selftest that writes into the project `.telos/` corrupts the forge's live plan/ledger mid-run.
- **The fail-closed sub-cases prove the gates are real** — if a broken component still converges, a node test isn't genuinely executing; fix the wiring, not the test.
- **Design model-traceability** holds by construction: each `mod(...)` sets `signer`, and `makeDesignWorkstream` derives `model` from `signer`, so the design's model claims match the ledger signer. Keep each workstream's `signer` stable between the build set and any later edit.
- The two RAG/Phase-B follow-ups (#30 item 2 applied to `patterns/rag.mjs`; #37) remain separate; this plan only makes the eval-harness scorecard's cross-check first-class in the new pattern.
```
