# ai-forge Phase C Implementation Plan (the TELOS pattern)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new pure-data pattern `ai-forge/patterns/telos.mjs` that forges a TELOS-like trust system — 7 components (sign · plan · provenance · gate · council · ledger/done · breakout) each emitted as a `telos/<x>.mjs` that wraps the real spine (via a ctx `spineRoot` `file://` URL) and runs a keyless executable selftest as its node test — plus the generic Phase B `design` workstream (8 total), driven to `merge_status: "ready"`.

**Architecture:** No new forge machinery. `telos.mjs` mirrors `patterns/rag.mjs`: a `componentWorkstream(...)` helper turns each component's `makeSelftest(spineRoot) -> source` into a Phase-A-shaped workstream whose `render` writes the selftest and whose `nodeTest` runs it. The selftest imports the real spine through an absolute `file://` URL so it genuinely executes. The self-similar capstone: ai-forge forges a TELOS-based system.

**Tech Stack:** Node ≥18, ESM, zero runtime dependencies. `node:assert/strict` + terminal `console.log("... OK")` idiom; ESM top-level `await` where a selftest is async.

## Global Constraints

- **Zero new runtime dependencies**; Node `>=18`; ESM.
- **Do NOT modify** the spine (`merkle-dag/`, `build-gate/`, `breakout/`, `connectors/`), `saas-forge/`, the RAG pattern, or the Phase A/B ai-forge modules. Only ADD `ai-forge/patterns/telos.mjs` + `ai-forge/scripts/test-telos.mjs` + `ai-forge/scripts/test-telos-forge.mjs`, append to `package.json` check/test, and regenerate `docs/runs/ai-forge-telos/*` + roadmap/README.
- **`spineRoot` (exact):** `const spineRoot = new URL("../../", import.meta.url).href;` in `patterns/telos.mjs` → a `file://` URL ending in `/` (repo root). Imports are baked as `import {...} from "${spineRoot}build-gate/sign.mjs"` etc.
- **Wrap the real spine — genuine executable checks.** Each forged `telos/<x>.mjs` is a runnable selftest that imports the listed spine export(s) and asserts real behavior; the workstream's `nodeTest` is `{cmd:"node", args:["telos/<x>.mjs"]}`, run by the build's Rule-3 verify.
- **CRITICAL fixture isolation:** any selftest that needs a `.telos`/ledger or scratch files (notably `ledger`, `plan`) MUST build them in an isolated `os.tmpdir()` dir — NEVER the project root or its `.telos/` (which holds the *forge's* live plan+ledger for the in-progress build). A selftest must leave the project tree untouched except for its own declared `files`.
- **Keyless + deterministic + sanitized:** no API keys (council/sign/ledger use ephemeral local `TELOS_SECRET_*` strings + locally-generated Ed25519 keypairs); fixed inline fixtures; no `Date.now`/`Math.random`/network; the absolute `spineRoot` never appears in committed `run-summary.json`.
- **Exact spine exports** (verified): `build-gate/sign.mjs` → `signPacket(packet,secret)`, `verifyPacket(packet,secret)`; `build-gate/gate.mjs` → `validateRecords(dossier,packets)` (REQUIRED_MODELS = claude/agy/codex; legacy mode needs no signing); `build-gate/council.mjs` → `runCouncil({seats,callSeat,dossier})` (async; signs via `secretFor(model)` reading `TELOS_SECRET_*`); `merkle-dag/merkle.mjs` → `computePlan(defs,opts)`, `mutateNode(plan,id,newSpec)`, `writePlan(telosDir,plan)`; `merkle-dag/crypto.mjs` → `generateKeypair()`, `makeRecord(tx,model,privatePem)`, `appendLedger(path,record)`, `readLedger(path)`; `merkle-dag/ledger-gate.mjs` → `verify(telosDir,{baseDir})`; `merkle-dag/artifact.mjs` → `computeDiskTreeHash(files,baseDir)`; `connectors/ai-peer-mcp/lib.mjs` → `agyAttestation(checkpoint)`, `extractOpenAIResult(json)`; `breakout/verifier.mjs` → `buildCheck(spec,baseDir)`, `reverifyRecord(record,baseDir)`.
- **Dependency DAG:** roots `sign`,`plan`,`provenance`; `gate ← {sign,provenance}`; `council ← {sign,provenance}`; `ledger ← {sign,plan}`; `breakout ← {gate}`; `design ← {all 7}`.
- **findingsKey:** each component uses `"architecture_findings"` (an existing gate-safe SaaS key — RAG/Phase-B precedent that shared keys pass the market gate).
- **Each task lands via branch → `gh` PR → CI → squash-merge** (branch protection; `gh` at `/c/Program Files/GitHub CLI/gh`, authed `dsmcewan`). The controller pre-creates the branch; implementers commit LOCALLY on it (explicit `git add`, never `-A`).
- **Exit:** `ai-forge` `npm test` exit 0 (TELOS e2e: 8 workstreams converge + ≥2 fail-closed + inherited design checks + the per-component standalone selftests); `docs/runs/ai-forge-telos/` regenerated (8 `meets`, sanitized); all packages green.

---

## File Structure

| File | Responsibility |
|---|---|
| `ai-forge/patterns/telos.mjs` | `telosContext()` (spineRoot); `componentWorkstream(...)` helper; the 7 component `makeSelftest` functions + workstream entries; `telosPattern` (8 workstreams incl. the generic `design`). |
| `ai-forge/scripts/test-telos.mjs` | Unit tests: render each component, write its selftest to a temp file, run `node <file>` → exit 0 (proves each wrap genuinely executes the spine). Built up across Tasks 1–3. |
| `ai-forge/scripts/test-telos-forge.mjs` | e2e: forge the TELOS pattern → 8 converge, gate pass; + ≥2 fail-closed sub-cases. |
| `ai-forge/package.json` (modify) | Append the new module + 2 test scripts to check/test (incremental). |
| `docs/runs/ai-forge-telos/{run.mjs,run-summary.json,README.md}` | Sanitized evidence of a converged TELOS-pattern run. |
| `docs/ROADMAP.md`, `README.md` (modify) | Phase C → done; note the TELOS pattern. |

---

### Task 1: Scaffold + `spineRoot` + `componentWorkstream` helper + the `sign` component (proves the wrap)

**Files:**
- Create: `ai-forge/patterns/telos.mjs`, `ai-forge/scripts/test-telos.mjs`
- Modify: `ai-forge/package.json`

**Interfaces:**
- Produces:
  - `telosContext(params = {}) -> { spineRoot, ...params }` where `spineRoot = new URL("../../", import.meta.url).href`.
  - `componentWorkstream({ id, signer, dependencies, file, makeSelftest, finding }) -> workstream` — Phase-A shape: `{ id, signer, lens:signer, dependencies, files:[file], requirements, render:(ctx)=>({[file]: makeSelftest(ctx.spineRoot)}), checks:(ctx)=>[{type:"file_exists",path:file}], nodeTest:{cmd:"node",args:[file]}, findingsKey:"architecture_findings", finding }`.
  - `signWorkstream` (the `sign` component) via `componentWorkstream`.
  - `telosPattern` exported but, for Task 1, with workstreams `[signWorkstream]` (full set assembled in Task 4 — the partial pattern is only exercised by the standalone selftest unit test here, not a forge run).

- [ ] **Step 1: Write the failing unit test** `ai-forge/scripts/test-telos.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { telosContext, signWorkstream } from "../patterns/telos.mjs";

// Render a component's selftest to a temp file and run it; return exit code (0 = pass).
function runSelftest(ws) {
  const ctx = telosContext();
  const out = ws.render(ctx);
  const file = ws.files[0];               // e.g. "telos/sign.mjs"
  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-st-"));
  const abs = path.join(dir, path.basename(file));
  writeFileSync(abs, out[file]);
  try { execFileSync("node", [abs], { cwd: dir, stdio: "pipe" }); return 0; }
  catch (e) { return e.status ?? 1; }
}

// sign: the selftest genuinely executes build-gate/sign.mjs via the spineRoot file:// import
assert.equal(runSelftest(signWorkstream), 0, "sign selftest must execute the real spine and pass");

console.log("test-telos.mjs OK");
```

- [ ] **Step 2: Run → FAIL** (`Cannot find module '../patterns/telos.mjs'`).

- [ ] **Step 3: Implement `ai-forge/patterns/telos.mjs`** (Task 1 portion):

```js
// telos.mjs — the TELOS pattern: ai-forge forges a TELOS-like trust system. Each
// component wraps the REAL spine through an absolute file:// spineRoot and ships a
// keyless executable selftest run as its node test. Pure data; mirrors rag.mjs.
import { makeDesignWorkstream } from "../workstreams/design.mjs";

// spineRoot: absolute file:// URL to the repo root (ai-forge/patterns/ -> ../../).
// Ends with "/", so `${spineRoot}build-gate/sign.mjs` is a valid absolute import.
export function telosContext(params = {}) {
  return { spineRoot: new URL("../../", import.meta.url).href, ...params };
}

function componentWorkstream({ id, signer, dependencies, file, makeSelftest, finding }) {
  return {
    id,
    signer,
    lens: signer,
    dependencies,
    files: [file],
    requirements: `Forge the ${id} trust component (wraps the real spine) and prove it executes.`,
    render: (ctx) => ({ [file]: makeSelftest(ctx.spineRoot) }),
    checks: () => [{ type: "file_exists", path: file }],
    nodeTest: { cmd: "node", args: [file] },
    findingsKey: "architecture_findings",
    finding
  };
}

// --- sign ---
function signSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { signPacket, verifyPacket } from "${spineRoot}build-gate/sign.mjs";
const p = { build_id: "t", model: "claude", decision: "approve" };
const s = signPacket(p, "k");
assert.equal(verifyPacket(s, "k").ok, true, "roundtrip verifies");
assert.equal(verifyPacket({ ...s, decision: "reject" }, "k").ok, false, "tamper fails");
console.log("telos/sign selftest OK");
`;
}

export const signWorkstream = componentWorkstream({
  id: "sign", signer: "codex", dependencies: [], file: "telos/sign.mjs",
  makeSelftest: signSelftest, finding: "HMAC signing verifies and rejects tampering."
});

export const telosPattern = {
  id: "telos",
  workstreams: [signWorkstream] // full 8-workstream set assembled in Task 4
};
```

- [ ] **Step 4: Run → PASS.** Run: `node ai-forge/scripts/test-telos.mjs` → `test-telos.mjs OK`.

- [ ] **Step 5: Update `ai-forge/package.json`** (incremental): `check` append `node --check patterns/telos.mjs` and `node --check scripts/test-telos.mjs`; `test` append `node scripts/test-telos.mjs`. Verify `cd ai-forge && npm test` exit 0.

- [ ] **Step 6: Commit + land** (branch `feat/ai-forge-telos-scaffold`): commit `ai-forge/patterns/telos.mjs ai-forge/scripts/test-telos.mjs ai-forge/package.json`.

---

### Task 2: Components `plan`, `provenance`, `gate`

**Files:**
- Modify: `ai-forge/patterns/telos.mjs` (add 3 components + export them), `ai-forge/scripts/test-telos.mjs` (assert each new selftest executes)

**Interfaces:**
- Produces `planWorkstream`, `provenanceWorkstream`, `gateWorkstream` (via `componentWorkstream`), with `dependencies`: plan `[]`, provenance `[]`, gate `["sign","provenance"]`.

- [ ] **Step 1: Add assertions** to `test-telos.mjs` (before the final `console.log`):

```js
import { planWorkstream, provenanceWorkstream, gateWorkstream } from "../patterns/telos.mjs";
assert.equal(runSelftest(planWorkstream), 0, "plan selftest executes");
assert.equal(runSelftest(provenanceWorkstream), 0, "provenance selftest executes");
assert.equal(runSelftest(gateWorkstream), 0, "gate selftest executes");
```

- [ ] **Step 2: Run → FAIL** (those exports don't exist yet).

- [ ] **Step 3: Add the 3 components to `telos.mjs`** (each a `makeSelftest` + a `componentWorkstream` export):

```js
// --- plan ---
function planSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { computePlan, mutateNode } from "${spineRoot}merkle-dag/merkle.mjs";
const defs = [
  { id: "a", files: ["a.txt"], requirements: "ra", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: [] },
  { id: "b", files: ["b.txt"], requirements: "rb", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: ["a"] }
];
const r1 = computePlan(defs, {});
assert.ok(r1.plan, "plan built");
const r2 = computePlan(defs, {});
assert.equal(r1.plan.plan_hash, r2.plan.plan_hash, "plan_hash deterministic");
const bEff = r1.plan.nodes.find((n) => n.id === "b").effective_hash;
const m = mutateNode(r1.plan, "a", { files: ["a.txt"], requirements: "CHANGED", test: { cmd: "node", args: ["-e", "process.exit(0)"] } });
assert.ok(m.plan, "mutated plan");
const bEff2 = m.plan.nodes.find((n) => n.id === "b").effective_hash;
assert.notEqual(bEff, bEff2, "downstream effective_hash cascades (forward-invalidation)");
console.log("telos/plan selftest OK");
`;
}
export const planWorkstream = componentWorkstream({
  id: "plan", signer: "codex", dependencies: [], file: "telos/plan.mjs",
  makeSelftest: planSelftest, finding: "Content-addressed plan is deterministic and forward-invalidates."
});

// --- provenance ---
function provenanceSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { agyAttestation, extractOpenAIResult } from "${spineRoot}connectors/ai-peer-mcp/lib.mjs";
const att = agyAttestation({ phase_gate_status: "advance" });
assert.match(att.response_id, /^agy-[0-9a-f]{40}$/, "content-addressed attestation id");
const noId = extractOpenAIResult({ choices: [{ message: { content: "x" } }] });
assert.equal(noId.id, null, "missing response id -> null (fail-closed)");
console.log("telos/provenance selftest OK");
`;
}
export const provenanceWorkstream = componentWorkstream({
  id: "provenance", signer: "codex", dependencies: [], file: "telos/provenance.mjs",
  makeSelftest: provenanceSelftest, finding: "Provenance binds a real id or fails closed to null."
});

// --- gate ---
function gateSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { validateRecords } from "${spineRoot}build-gate/gate.mjs";
const dossier = { build_id: "t", use_case: "u", objective: "o", required_docs: [], write_targets: [], protected_paths: [] };
const pkt = (model, decision = "approve") => ({ build_id: "t", use_case: "u", model, role: "approver", docs_reviewed: [], proposal_ref: "r", decision, required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-30T00:00:00Z" });
const pass = validateRecords(dossier, [pkt("claude"), pkt("agy"), pkt("codex")]);
assert.equal(pass.gate_status, "pass", "all-approve -> pass");
const blocked = validateRecords(dossier, [pkt("claude", "reject"), pkt("agy"), pkt("codex")]);
assert.equal(blocked.gate_status, "blocked", "a reject -> blocked");
console.log("telos/gate selftest OK");
`;
}
export const gateWorkstream = componentWorkstream({
  id: "gate", signer: "agy", dependencies: ["sign", "provenance"], file: "telos/gate.mjs",
  makeSelftest: gateSelftest, finding: "Approval gate passes a unanimous council and blocks a dissent."
});
```

- [ ] **Step 4: Run → PASS.** `node ai-forge/scripts/test-telos.mjs` → `test-telos.mjs OK`.
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-telos-components-1`): commit `ai-forge/patterns/telos.mjs ai-forge/scripts/test-telos.mjs`.

---

### Task 3: Components `council`, `ledger`, `breakout`

**Files:**
- Modify: `ai-forge/patterns/telos.mjs` (add 3 components), `ai-forge/scripts/test-telos.mjs`

**Interfaces:**
- Produces `councilWorkstream` (deps `["sign","provenance"]`), `ledgerWorkstream` (deps `["sign","plan"]`), `breakoutWorkstream` (deps `["gate"]`).

> **`ledger` and `breakout` touch fiddly spine internals.** Before finalizing those two selftests, READ `merkle-dag/crypto.mjs` (`makeRecord` tx fields), `merkle-dag/artifact.mjs` (`computeDiskTreeHash` return shape — the `.tree_hash`/`.files` fields), `merkle-dag/ledger-gate.mjs` (`verify` return — `.merge_status`), and `breakout/verifier.mjs` (`buildCheck(spec,baseDir).run()` return — the `.ok` field). The sources below are the intended shape; adjust field names to the actual exports if they differ, and say so in the report. **The `ledger` selftest MUST use an isolated `os.tmpdir()` — never the project's `.telos`.**

- [ ] **Step 1: Add assertions** to `test-telos.mjs`:

```js
import { councilWorkstream, ledgerWorkstream, breakoutWorkstream } from "../patterns/telos.mjs";
assert.equal(runSelftest(councilWorkstream), 0, "council selftest executes");
assert.equal(runSelftest(ledgerWorkstream), 0, "ledger selftest executes");
assert.equal(runSelftest(breakoutWorkstream), 0, "breakout selftest executes");
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Add the 3 components to `telos.mjs`:**

```js
// --- council ---
function councilSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { runCouncil } from "${spineRoot}build-gate/council.mjs";
import { verifyPacket } from "${spineRoot}build-gate/sign.mjs";
process.env.TELOS_SECRET_CLAUDE = "k"; process.env.TELOS_SECRET_AGY = "k"; process.env.TELOS_SECRET_CODEX = "k";
const seats = [{ model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" }];
const callSeat = async ({ model }) => ({
  packet: { build_id: "t", use_case: "u", model, role: "approver", decision: "approve", docs_reviewed: [], required_edits: [], hard_stops: [], proposal_ref: "r", confidence: "high", timestamp: "2026-06-30T00:00:00Z" },
  provenance: { model, source: "stub", response_id: "r-" + model }
});
const results = await runCouncil({ seats, callSeat, dossier: { build_id: "t" } });
assert.equal(results.length, 3, "all seats");
assert.deepEqual(results.map((r) => r.model), ["claude", "agy", "codex"], "order preserved");
for (const r of results) { assert.equal(r.ok, true, r.model + " ok"); assert.equal(verifyPacket(r.packet, "k").ok, true, r.model + " signed packet verifies"); }
console.log("telos/council selftest OK");
`;
}
export const councilWorkstream = componentWorkstream({
  id: "council", signer: "claude", dependencies: ["sign", "provenance"], file: "telos/council.mjs",
  makeSelftest: councilSelftest, finding: "Council fan-out produces ordered, signed, verifiable packets."
});

// --- ledger (+ done) --- (ISOLATED tmpdir; never the project .telos)
function ledgerSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateKeypair, makeRecord, appendLedger } from "${spineRoot}merkle-dag/crypto.mjs";
import { computePlan, writePlan } from "${spineRoot}merkle-dag/merkle.mjs";
import { computeDiskTreeHash } from "${spineRoot}merkle-dag/artifact.mjs";
import { verify } from "${spineRoot}merkle-dag/ledger-gate.mjs";
const root = mkdtempSync(path.join(os.tmpdir(), "telos-ledger-"));   // ISOLATED — never the forge's .telos
const telosDir = path.join(root, ".telos");
mkdirSync(telosDir, { recursive: true });
writeFileSync(path.join(root, "a.txt"), "hello");
const kp = generateKeypair();
const defs = [{ id: "a", files: ["a.txt"], requirements: "r", test: { cmd: "node", args: ["-e", "process.exit(0)"] }, dependencies: [] }];
const { plan } = computePlan(defs, { authorizedSigners: { codex: kp.publicJwk } });
writePlan(telosDir, plan);
const node = plan.nodes.find((n) => n.id === "a");
const disk = computeDiskTreeHash(node.files, root);
const rec = makeRecord({ task_id: "a", effective_hash: node.effective_hash, artifact_tree_hash: disk.tree_hash, artifact_files: disk.files }, "codex", kp.privatePem);
appendLedger(path.join(telosDir, "ledger.jsonl"), rec);
assert.equal(verify(telosDir, { baseDir: root }).merge_status, "ready", "settled ledger verifies done()");
writeFileSync(path.join(root, "a.txt"), "TAMPERED");
assert.notEqual(verify(telosDir, { baseDir: root }).merge_status, "ready", "tampered artifact blocked");
console.log("telos/ledger selftest OK");
`;
}
export const ledgerWorkstream = componentWorkstream({
  id: "ledger", signer: "agy", dependencies: ["sign", "plan"], file: "telos/ledger.mjs",
  makeSelftest: ledgerSelftest, finding: "Append-only signed ledger settles and a tamper fails done()."
});

// --- breakout (verdict on facts) ---
function breakoutSelftest(spineRoot) {
  return `import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCheck } from "${spineRoot}breakout/verifier.mjs";
const dir = mkdtempSync(path.join(os.tmpdir(), "telos-verify-"));
writeFileSync(path.join(dir, "evidence.txt"), "proof");
const present = await buildCheck({ type: "file_exists", path: "evidence.txt" }, dir).run();
assert.equal(present.ok, true, "present evidence -> meets");
const absent = await buildCheck({ type: "file_exists", path: "NOPE.txt" }, dir).run();
assert.equal(absent.ok, false, "absent evidence -> blocked");
console.log("telos/verify selftest OK");
`;
}
export const breakoutWorkstream = componentWorkstream({
  id: "breakout", signer: "grok", dependencies: ["gate"], file: "telos/verify.mjs",
  makeSelftest: breakoutSelftest, finding: "Verdict-on-facts confirms present evidence and blocks absent."
});
```

- [ ] **Step 4: Run → PASS** (after reconciling any field-name differences per the note). `node ai-forge/scripts/test-telos.mjs` → `test-telos.mjs OK`.
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-telos-components-2`): commit `ai-forge/patterns/telos.mjs ai-forge/scripts/test-telos.mjs`.

---

### Task 4: Assemble the full pattern (8 workstreams + DAG) + forge e2e + fail-closed

**Files:**
- Modify: `ai-forge/patterns/telos.mjs` (final `telosPattern`)
- Create: `ai-forge/scripts/test-telos-forge.mjs`
- Modify: `ai-forge/package.json`

**Interfaces:**
- Consumes: all 7 component workstreams + `makeDesignWorkstream`, `forge`, `telosContext`.

- [ ] **Step 1: Finalize `telosPattern`** in `telos.mjs` — replace the Task-1 placeholder:

```js
const buildWorkstreams = [
  signWorkstream, planWorkstream, provenanceWorkstream,
  gateWorkstream, councilWorkstream, ledgerWorkstream, breakoutWorkstream
];

export const telosPattern = {
  id: "telos",
  workstreams: [...buildWorkstreams, makeDesignWorkstream(buildWorkstreams)]
};
```

- [ ] **Step 2: Write the e2e + fail-closed** `ai-forge/scripts/test-telos-forge.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { forge } from "../forge.mjs";
import { telosPattern, telosContext } from "../patterns/telos.mjs";

const dossierMeta = { build_id: "telos-e2e", idea_id: "telos", use_case: "trust-system", objective: "Forge a TELOS-like trust system" };

// Happy path: all 8 workstreams (7 components wrapping the real spine + design) converge.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-telos-"));
  const result = await forge({ pattern: telosPattern, ctx: telosContext(), projectRoot: root, dossierMeta, maxCycles: 2 });
  assert.equal(result.converged, true, JSON.stringify(result.cycles, null, 2));
  assert.equal(result.verdict.gate_status, "pass");
  assert.equal(result.records.length, 8);
  assert.ok(result.records.every((r) => r.converged), "every component converges");
}

// Fail-closed #1: break the `sign` component's selftest so its node test fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-telos-fc1-"));
  const broken = {
    ...telosPattern,
    workstreams: telosPattern.workstreams.map((w) => w.id !== "sign" ? w : {
      ...w,
      // selftest that asserts a TAMPERED packet verifies (false) -> assertion throws -> node test fails
      render: () => ({ "telos/sign.mjs": 'import assert from "node:assert/strict";\nimport { signPacket, verifyPacket } from "' + telosContext().spineRoot + 'build-gate/sign.mjs";\nconst s = signPacket({ model: "claude" }, "k");\nassert.equal(verifyPacket({ ...s, model: "x" }, "k").ok, true, "WRONG: tamper should not verify");\n' })
    })
  };
  const result = await forge({ pattern: broken, ctx: telosContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a broken sign component must NOT converge");
}

// Fail-closed #2: drift the design (omit a component from DESIGN.md) -> design verify fails -> not converged.
{
  const root = mkdtempSync(path.join(os.tmpdir(), "aiforge-telos-fc2-"));
  const build = telosPattern.workstreams.filter((w) => w.id !== "design");
  const realDesign = telosPattern.workstreams.find((w) => w.id === "design");
  const brokenDesign = {
    ...realDesign,
    render: (ctx) => {
      const out = realDesign.render(ctx);
      const md = out["docs/DESIGN.md"];
      const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]).slice(1); // drop one component
      out["docs/DESIGN.md"] = md.replace(/```json\s*[\s\S]*?```/, "```json\n" + JSON.stringify(block, null, 2) + "\n```");
      return out;
    }
  };
  const result = await forge({ pattern: { ...telosPattern, workstreams: [...build, brokenDesign] }, ctx: telosContext(), projectRoot: root, dossierMeta, maxCycles: 1 });
  assert.equal(result.converged, false, "a drifted design must NOT converge");
}

console.log("test-telos-forge.mjs OK");
```

- [ ] **Step 3: Run → debug to green.** Run: `node ai-forge/scripts/test-telos-forge.mjs`. If a component doesn't converge, read `result.cycles` blockers; fix in `telos.mjs` (a selftest or a dependency), NOT the spine/forge. Likely culprits: a selftest field-name mismatch (ledger/breakout), or the `design` model-traceability check (component `model` must equal the ledger `signer` for that workstream — `componentWorkstream` sets `signer`, and the design derives `model` from it, so they match by construction). Use systematic debugging. Expected: `test-telos-forge.mjs OK`.
- [ ] **Step 4: Update `ai-forge/package.json`** (incremental): `check` append `node --check scripts/test-telos-forge.mjs`; `test` append `node scripts/test-telos-forge.mjs`. `cd ai-forge && npm test` exit 0 (all suites).
- [ ] **Step 5: Commit + land** (branch `feat/ai-forge-telos-pattern`): commit `ai-forge/patterns/telos.mjs ai-forge/scripts/test-telos-forge.mjs ai-forge/package.json`.

---

### Task 5: Evidence + roadmap/README

**Files:**
- Create: `docs/runs/ai-forge-telos/run.mjs`, `docs/runs/ai-forge-telos/run-summary.json`, `docs/runs/ai-forge-telos/README.md`
- Modify: `docs/ROADMAP.md`, `README.md`

**Interfaces:**
- `run.mjs` forges the TELOS pattern into an `os.tmpdir()` root and writes a SANITIZED `run-summary.json` (`{ converged, merge_status, gate_status, workstreams:[{id,converged,finalStatus}], generated_at_note:"deterministic; no timestamps" }`) — NO absolute paths (esp. not `spineRoot`), no secrets, no timestamps. Mirror `docs/runs/ai-forge-rag/run.mjs`.

- [ ] **Step 1:** Write `docs/runs/ai-forge-telos/run.mjs` (mirror the RAG run; import `telosPattern`+`telosContext` from `../../../ai-forge/patterns/telos.mjs`, `forge` from `../../../ai-forge/forge.mjs`). Run it; confirm `converged: true`, 8 workstreams. Commit the regenerated `run-summary.json`. **Verify the JSON contains no `file://` or absolute path.**
- [ ] **Step 2:** Write `docs/runs/ai-forge-telos/README.md` — what the run proves: ai-forge forges a TELOS-like trust system; 7 components wrap the real spine + a verified design; keyless; the self-similar capstone.
- [ ] **Step 3:** Update `docs/ROADMAP.md` — Phase C heading + status row → `✅ done`; Built column → `docs/runs/ai-forge-telos/`; add a Decisions-log line "Phase C built (the TELOS pattern → 8 workstreams converge; PRs <range>)". Preserve everything else.
- [ ] **Step 4:** Update top-level `README.md` — in the AI Forge section, add one line: the catalog now includes the self-similar **TELOS pattern** (ai-forge forges a TELOS-like trust system). Preserve everything else.
- [ ] **Step 5:** Sanity: `cd ai-forge && npm test` exit 0; other packages unaffected.
- [ ] **Step 6: Commit + land** (branch `docs/ai-forge-telos-evidence`): commit the 5 files.

---

## Notes for the executor

- The controller pre-creates each task's branch; implementers commit LOCALLY (explicit `git add` of the listed paths, never `-A`; `.superpowers/` is gitignored). The controller does push → PR → CI → squash-merge.
- **Do not touch** the spine, `saas-forge`, the RAG pattern, or the Phase A/B ai-forge modules. If a forged selftest can't pass, the fix is in `telos.mjs` (a selftest's wiring or a field-name reconciliation), never the spine.
- **The fixture-isolation rule is load-bearing** — a selftest that writes into the project's `.telos` will corrupt the forge's in-progress plan/ledger and cause confusing failures. Always `os.tmpdir()`.
- **The fail-closed sub-cases prove the gates are real** — if a broken component still converges, a node test isn't genuinely executing; fix the wiring, not the test.
