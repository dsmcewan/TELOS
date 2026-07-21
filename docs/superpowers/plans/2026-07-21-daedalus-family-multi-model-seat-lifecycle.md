# Daedalus Family Multi-Model Seat Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-dependency `multi-model-seats` lifecycle that makes every Daedalus, Icarus, Grok, Gemini, TELOS, and Eye decision grow an auditable Merkle-DAG and routes every non-pass or dead stage back through Daedalus until an exact-root pass or explicit Eye action.

**Architecture:** A declarative Daedalus-family profile defines seats, stages, pair gates, cold-review gates, and recovery edges. Small Node ESM modules implement canonical hashing, closed decision records, append-only signed storage, deterministic transitions, provider-result normalization, and a TELOS export packet; the model transports remain injected adapters and never become authority. Runtime records are plugin-managed disk truth, while TELOS receives a content-addressed export and retains its existing authorization boundary.

**Tech Stack:** Node.js 18 or newer, ESM `.mjs`, `node:test`, Node standard-library `crypto`/`fs`/`path`, canonical JSON, SHA-256 content addresses, Ed25519 controller signatures, JSON/JSONL, Superpowers workflow skills.

## Global Constraints

- The approved design is `/home/colchis/Projects/TELOS/docs/superpowers/specs/2026-07-21-daedalus-family-multi-model-seat-lifecycle-design.md`, commit `f7482daf7318cfb7341a739154ebb9b49d77d8c5`, raw file SHA-256 `5c972b176df402d22a65273520d2342541cd213717e80c8460577a7ad6c920c9`.
- TELOS authorization identity is the canonical candidate ref `sha256hex(canonicalize({ kind: "candidate", plan: planText }))`, not the raw file SHA-256. Raw SHA-256 may be recorded only as a transport-integrity checksum.
- This document is a candidate plan. `authz-008` governs Clotho v15 only and does not authorize this implementation. The Eye must authorize this exact plan root before Task 1 begins.
- Implement in `/home/colchis/plugins/multi-model-seats`; do not edit `/mnt/c/Users/dsmce/.codex/plugins/cache/multi-model-local/multi-model-seats/0.5.2` as source.
- Do not modify upstream Superpowers. Map the lifecycle onto `brainstorming`, `writing-plans`, `executing-plans` or `subagent-driven-development`, `requesting-code-review`, `receiving-code-review`, `verification-before-completion`, and `finishing-a-development-branch`.
- Keep Node ESM zero-dependency: Node 18 or newer, `.mjs`, double-quoted strings, semicolons, two-space indentation, and `node:` imports only.
- Model consensus is never authorization. Daedalus convergence permits submission; TELOS evaluates evidence; The Eye authorizes or accepts exact roots.
- Grok and Gemini are mandatory for profile gates `P2` and `C2`, but remain advisory in the existing TELOS authorization council. Do not change TELOS's required `claude`/`agy`/`codex` trio.
- Seat 5 / `agy` remains outside this profile. It participates only when the exported root enters the existing TELOS authorization flow.
- Every state-changing pass, non-pass, death, invalidation, mutation, retry, and Eye action appends a signed decision node and changes the lifecycle root.
- There are no automatic round, retry, elapsed-time, or cost caps. A non-pass or dead stage records the failure and routes to Daedalus recovery. Only a separately signed Eye pause, cancel, amendment, or adjudication may suspend or terminate the run.
- A required seat may not be skipped, spoofed, substituted, or self-approved. Provider/model IDs are per-call provenance, not authority labels.
- A plan mutation reruns `P1` and `P2`; an implementation mutation reruns `C1` and `C2`. Old decisions remain stored but cease to satisfy the descendant root.
- Runtime private keys, API keys, OAuth tokens, `.env*`, `*.pem`, and runtime `.telos/` artifacts never enter Git. The controller private key is supplied in memory or generated ephemerally; only its public key may be persisted.
- Deterministic tests use injected provider doubles. No live Anthropic, OpenAI, xAI, or Google call is required by the test suite.
- Plugin-local append-only records are the lifecycle source of truth. The TELOS adapter emits an exact-root export packet; it does not mutate `CURRENT-AUTHORITY.json`, grant authorization, merge, release, or enroll a module.
- The synthetic end-to-end feature is named `content-addressed-note`; it is plain descriptive vocabulary, not a new TELOS mythological component.

---

## File Structure

| Path | Responsibility |
|---|---|
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs` | JSON-domain validation, canonical bytes, SHA-256 refs, secret detection/redaction, closed decision-node validation |
| `/home/colchis/plugins/multi-model-seats/records/lifecycle-profiles/daedalus-family-v1.json` | Policy data for seats, stages, gate order, re-entry points, and explicit absence of automatic caps |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-profile.mjs` | Load and fail-closed validate the profile; expose stage lookup and profile hash |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-store.mjs` | Controller-only Ed25519 signing, append-only JSONL writer, parent/signature verification, leaf/root derivation |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-engine.mjs` | Pure state transition reducer for pair gates, cold gates, mutations, recovery, and Eye actions |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-seat-adapter.mjs` | Convert injected provider results, outages, and malformed provenance into decision inputs without seat substitution |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-disk-truth.mjs` | Re-hash a checkout and execute declared verification commands without a shell |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs` | Build a closed TELOS handoff packet bound to plan, implementation, policy, lifecycle, and evidence roots |
| `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs` | Run the synthetic `content-addressed-note` lifecycle, including one failed cold review and Daedalus recovery |
| `/home/colchis/plugins/multi-model-seats/tests/lifecycle-fixtures.mjs` | Shared deterministic profile/node builders and controller-key helper for lifecycle tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs` | Golden canonical-hash, schema, and secret tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs` | Profile topology and governance-boundary tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs` | DAG append, signature, missing-parent, duplicate, cycle-by-construction, and root tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs` | Gate order, independent reviewers, invalidation, recovery, no-cap, Eye action, and substitution tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs` | Success, outage, malformed provenance, provider spoof, and secret tests with injected doubles |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs` | Tree mutation, path, symlink, command-success, and command-failure disk-truth tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs` | Exact-root export and stale/incomplete state rejection tests |
| `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs` | Spawned end-to-end proof and on-disk verification |
| `/home/colchis/plugins/multi-model-seats/skills/daedalus-family-lifecycle/SKILL.md` | User-facing Superpowers sequence, stage responsibilities, commands, and fail-return rule |
| `/home/colchis/plugins/multi-model-seats/.codex-plugin/plugin.json` | Version/capability metadata for the new lifecycle skill |
| `/home/colchis/plugins/multi-model-seats/scripts/bootstrap.mjs` | Add lifecycle runtime output to generated-project ignore rules |

## Execution Preconditions

- [ ] Compute the candidate plan root and compare it with the Eye authorization record supplied for this work.

```bash
node --input-type=module -e 'import { readFileSync } from "node:fs"; import { canonicalize, sha256hex } from "/home/colchis/Projects/TELOS/merkle-dag/vendor.mjs"; const plan = readFileSync("/home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md", "utf8"); console.log("sha256:" + sha256hex(canonicalize({ kind: "candidate", plan })));'
jq -r '.active_authorization.authorizes_plan, .implementation_authority.governs' /home/colchis/Projects/TELOS/CURRENT-AUTHORITY.json
sha256sum /home/colchis/Projects/TELOS/docs/superpowers/plans/2026-07-21-daedalus-family-multi-model-seat-lifecycle.md
```

Expected: the first command's canonical candidate ref equals both refs printed by the second command. The third command is recorded separately as a raw transport-integrity checksum and must never be substituted for the canonical authorization ref. If either authority ref differs, stop before touching plugin source and return the mismatch to Daedalus/The Eye.

- [ ] Re-prove the TELOS records and confirm plugin-source baseline tests.

```bash
node /home/colchis/Projects/TELOS/docs/institutional-memory/verify-contracts.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
```

Expected: `301/301 contracts match system reality`; plugin test summary reports 4 passing tests and 0 failures.

- [ ] Establish a git-backed plugin source before implementation commits.

```bash
test -d /home/colchis/plugins/multi-model-seats/.git || git -C /home/colchis/plugins/multi-model-seats init -b codex/daedalus-family-lifecycle
git -C /home/colchis/plugins/multi-model-seats add .
git -C /home/colchis/plugins/multi-model-seats commit -m "chore: baseline multi-model-seats source"
git -C /home/colchis/plugins/multi-model-seats status --short --branch
```

Expected: the source is on `codex/daedalus-family-lifecycle` and the status is clean. If a repository already exists, preserve its current branch and changes; create an isolated worktree with `superpowers:using-git-worktrees` instead of committing unknown work.

### Task 1: Canonical Hashing and Closed Decision Records

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs`

**Interfaces:**
- Consumes: Node `createHash` and JSON-domain values.
- Produces: `canonicalJson(value): string`, `sha256Ref(value): string`, `redactSecrets(value): JsonValue`, `assertSecretFree(value): void`, `validateUnsignedDecisionNode(node): string[]`, `validateDecisionNode(node): string[]`, `decisionRef(node): string`.

- [ ] **Step 1: Write the failing core tests**

Create `tests/test-lifecycle-core.mjs` with these exact assertions:

```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSecretFree,
  canonicalJson,
  decisionRef,
  redactSecrets,
  sha256Ref,
  validateDecisionNode
} from "../scripts/lifecycle-core.mjs";

const signedNode = {
  node_version: "dfm.decision.v1",
  node_type: "decision",
  stage: "p1-plan-pair",
  artifact_hash: `sha256:${"a".repeat(64)}`,
  parent_hashes: [],
  input_refs: [`sha256:${"b".repeat(64)}`],
  output_refs: [],
  actor: { seat: "icarus", provider: "openai", model: "test-model" },
  provenance_ref: `sha256:${"c".repeat(64)}`,
  decision: { verdict: "pass", findings: [], dispositions: [] },
  evidence_refs: [`sha256:${"d".repeat(64)}`],
  policy_ref: `sha256:${"e".repeat(64)}`,
  recorded_at: "2026-07-21T12:00:00.000Z",
  controller_signature: "dGVzdC1zaWduYXR1cmU"
};

test("canonical JSON is key-order independent with a golden SHA-256", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(sha256Ref({ b: 2, a: 1 }), "sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777");
});

test("non-JSON values fail closed", () => {
  assert.throws(() => canonicalJson({ value: undefined }), /unsupported JSON value/);
  assert.throws(() => canonicalJson({ value: Number.NaN }), /finite number/);
});

test("decision records have a closed valid shape", () => {
  assert.deepEqual(validateDecisionNode(signedNode), []);
  assert.match(decisionRef(signedNode), /^sha256:[0-9a-f]{64}$/);
  assert.match(validateDecisionNode({ ...signedNode, surprise: true })[0], /unknown field: surprise/);
});

test("secrets are redacted and rejected at persistence boundaries", () => {
  const unsafe = { authorization: "Bearer abcdefghijklmnopqrstuvwxyz", nested: { api_key: "sk-abcdefghijk" } };
  assert.deepEqual(redactSecrets(unsafe), { authorization: "<redacted>", nested: { api_key: "<redacted>" } });
  assert.throws(() => assertSecretFree(unsafe), /possible secret/);
  assert.doesNotThrow(() => assertSecretFree(redactSecrets(unsafe)));
});
```

- [ ] **Step 2: Run the test and confirm the module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-core.mjs`.

- [ ] **Step 3: Implement the core module**

Create `scripts/lifecycle-core.mjs` with:

```js
import { createHash } from "node:crypto";

const HASH_REF = /^sha256:[0-9a-f]{64}$/;
const SECRET_KEY = /(^|_)(api_?key|token|secret|authorization|private_?key|password)($|_)/i;
const SECRET_VALUE = /(\bsk-[A-Za-z0-9_-]{8,}|\bBearer\s+[A-Za-z0-9._~+/=-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,}|\bxox[baprs]-[A-Za-z0-9-]{10,}|\bAIza[0-9A-Za-z_-]{30,})/i;
const UNSIGNED_FIELDS = [
  "node_version", "node_type", "stage", "artifact_hash", "parent_hashes",
  "input_refs", "output_refs", "actor", "provenance_ref", "decision",
  "evidence_refs", "policy_ref", "recorded_at"
];

function canonicalPart(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("number must be finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalPart).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalPart(value[key])}`).join(",")}}`;
  }
  throw new TypeError("unsupported JSON value");
}

export function canonicalJson(value) {
  return canonicalPart(value);
}

export function sha256Ref(value) {
  const bytes = typeof value === "string" ? value : canonicalJson(value);
  return `sha256:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

export function redactSecrets(value, key = "") {
  if (SECRET_KEY.test(key)) return "<redacted>";
  if (typeof value === "string") return SECRET_VALUE.test(value) ? "<redacted>" : value;
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactSecrets(item, name)]));
  }
  return value;
}

export function assertSecretFree(value) {
  if (canonicalJson(redactSecrets(value)) !== canonicalJson(value)) throw new Error("possible secret in persistent lifecycle value");
}

function cleanString(value) {
  return typeof value === "string" && value.length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

function hashArray(value) {
  return Array.isArray(value) && value.every((item) => HASH_REF.test(item)) && new Set(value).size === value.length;
}

export function validateUnsignedDecisionNode(node) {
  const problems = [];
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["node must be an object"];
  for (const key of Object.keys(node)) if (!UNSIGNED_FIELDS.includes(key)) problems.push(`unknown field: ${key}`);
  for (const key of UNSIGNED_FIELDS) if (!(key in node)) problems.push(`missing field: ${key}`);
  if (node.node_version !== "dfm.decision.v1") problems.push("node_version must be dfm.decision.v1");
  if (node.node_type !== "decision") problems.push("node_type must be decision");
  if (!cleanString(node.stage)) problems.push("stage must be a clean non-empty string");
  if (!HASH_REF.test(node.artifact_hash ?? "")) problems.push("artifact_hash must be a SHA-256 ref");
  for (const key of ["parent_hashes", "input_refs", "output_refs", "evidence_refs"]) if (!hashArray(node[key])) problems.push(`${key} must contain unique SHA-256 refs`);
  if (!node.actor || !cleanString(node.actor.seat) || !cleanString(node.actor.provider) || !cleanString(node.actor.model) || Object.keys(node.actor).sort().join(",") !== "model,provider,seat") problems.push("actor must contain only clean seat, provider, and model strings");
  if (!HASH_REF.test(node.provenance_ref ?? "")) problems.push("provenance_ref must be a SHA-256 ref");
  if (!node.decision || !["pass", "non-pass", "eye-pause", "eye-cancel", "eye-amend", "eye-adjudicate"].includes(node.decision.verdict) || !Array.isArray(node.decision.findings) || !Array.isArray(node.decision.dispositions) || Object.keys(node.decision).sort().join(",") !== "dispositions,findings,verdict") problems.push("decision must have a closed verdict/findings/dispositions shape");
  if (!HASH_REF.test(node.policy_ref ?? "")) problems.push("policy_ref must be a SHA-256 ref");
  if (!cleanString(node.recorded_at) || Number.isNaN(Date.parse(node.recorded_at))) problems.push("recorded_at must be an ISO date-time string");
  try { assertSecretFree(node); } catch (error) { problems.push(error.message); }
  return problems;
}

export function validateDecisionNode(node) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return ["node must be an object"];
  const { controller_signature: signature, ...unsigned } = node;
  const problems = validateUnsignedDecisionNode(unsigned);
  if (!cleanString(signature)) problems.push("controller_signature must be a non-empty base64url string");
  for (const key of Object.keys(node)) if (![...UNSIGNED_FIELDS, "controller_signature"].includes(key) && !problems.includes(`unknown field: ${key}`)) problems.push(`unknown field: ${key}`);
  return problems;
}

export function decisionRef(node) {
  const problems = validateDecisionNode(node);
  if (problems.length) throw new Error(`invalid decision node: ${problems.join("; ")}`);
  return sha256Ref(node);
}
```

- [ ] **Step 4: Run the focused and baseline tests**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
```

Expected: 4 lifecycle-core tests pass; 4 baseline tests pass; 0 failures.

- [ ] **Step 5: Commit**

```bash
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-core.mjs tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: add canonical lifecycle decision records"
```

### Task 2: Daedalus-Family Policy Profile

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/records/lifecycle-profiles/daedalus-family-v1.json`
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-profile.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs`

**Interfaces:**
- Consumes: `sha256Ref(value)` from Task 1.
- Produces: `DEFAULT_PROFILE_PATH: string`, `validateProfile(profile): string[]`, `loadProfile(path?): object`, `stageById(profile, stageId): object`, `profileRef(profile): string`.

- [ ] **Step 1: Write the failing profile test**

Create `tests/test-lifecycle-profile.mjs` that asserts:

```js
#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { loadProfile, profileRef, stageById, validateProfile } from "../scripts/lifecycle-profile.mjs";

test("the profile fixes the four seats and exact gate order", () => {
  const profile = loadProfile();
  assert.deepEqual(Object.keys(profile.seats), ["daedalus", "icarus", "grok", "gemini", "eye", "telos-controller"]);
  assert.equal(stageById(profile, "p2-plan-adversarial").requires.join(","), "grok,gemini");
  assert.equal(stageById(profile, "c2-code-adversarial").requires.join(","), "grok,gemini");
  assert.equal(stageById(profile, "p2-plan-adversarial").prerequisite, "p1-plan-pair");
  assert.equal(stageById(profile, "c2-code-adversarial").prerequisite, "c1-code-pair");
  assert.match(profileRef(profile), /^sha256:[0-9a-f]{64}$/);
});

test("every failing stage returns to Daedalus with no automatic caps", () => {
  const profile = loadProfile();
  assert.deepEqual(profile.automatic_limits, { rounds: null, retries: null, elapsed_ms: null, cost: null });
  for (const stage of profile.stages.filter((item) => item.id !== "closed" && item.id !== "daedalus-recovery")) {
    assert.equal(stage.on_non_pass, "daedalus-recovery", stage.id);
    assert.ok(stage.reentry_stage, stage.id);
  }
});

test("Grok and Gemini lifecycle requirements do not rewrite TELOS authorization seats", () => {
  const profile = loadProfile();
  assert.deepEqual(profile.telos_handoff.authorization_required_seats, ["claude", "agy", "codex"]);
  assert.deepEqual(profile.telos_handoff.authorization_advisory_seats, ["grok", "gemini"]);
  assert.equal(profile.telos_handoff.profile_gate_results_are_authority, false);
});

test("unknown fields and seat substitution policy fail closed", () => {
  const profile = loadProfile();
  assert.match(validateProfile({ ...profile, surprise: true })[0], /unknown profile field/);
  assert.match(validateProfile({ ...profile, allow_seat_substitution: true }).join(";"), /allow_seat_substitution must be false/);
});
```

- [ ] **Step 2: Run the test and confirm the profile module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-profile.mjs`.

- [ ] **Step 3: Add the exact profile data**

Create `records/lifecycle-profiles/daedalus-family-v1.json`:

```json
{
  "profile_version": "dfm.profile.v1",
  "id": "daedalus-family-v1",
  "initial_stage": "requirements-freeze",
  "recovery_stage": "daedalus-recovery",
  "terminal_stage": "closed",
  "allow_seat_substitution": false,
  "automatic_limits": { "rounds": null, "retries": null, "elapsed_ms": null, "cost": null },
  "seats": {
    "daedalus": { "provider": "anthropic", "role": "plan-author-architecture-review-recovery" },
    "icarus": { "provider": "openai", "role": "feasibility-review-code-author-remediation" },
    "grok": { "provider": "xai", "role": "cold-adversarial-review" },
    "gemini": { "provider": "google", "role": "cold-independent-verification" },
    "eye": { "provider": "human", "role": "exact-root-authority" },
    "telos-controller": { "provider": "local", "role": "deterministic-controller" }
  },
  "stages": [
    { "id": "requirements-freeze", "artifact_kind": "requirements", "requires": ["eye"], "prerequisite": null, "produces_artifact": false, "on_pass": "plan-draft", "on_non_pass": "daedalus-recovery", "reentry_stage": "requirements-freeze" },
    { "id": "plan-draft", "artifact_kind": "plan", "requires": ["daedalus"], "prerequisite": "requirements-freeze", "produces_artifact": true, "on_pass": "p1-plan-pair", "on_non_pass": "daedalus-recovery", "reentry_stage": "plan-draft" },
    { "id": "p1-plan-pair", "artifact_kind": "plan", "requires": ["daedalus", "icarus"], "prerequisite": "plan-draft", "produces_artifact": false, "on_pass": "p2-plan-adversarial", "on_non_pass": "daedalus-recovery", "reentry_stage": "p1-plan-pair" },
    { "id": "p2-plan-adversarial", "artifact_kind": "plan", "requires": ["grok", "gemini"], "prerequisite": "p1-plan-pair", "produces_artifact": false, "on_pass": "eye-plan-authorization", "on_non_pass": "daedalus-recovery", "reentry_stage": "p1-plan-pair" },
    { "id": "eye-plan-authorization", "artifact_kind": "plan", "requires": ["eye"], "prerequisite": "p2-plan-adversarial", "produces_artifact": false, "on_pass": "code-draft", "on_non_pass": "daedalus-recovery", "reentry_stage": "p1-plan-pair" },
    { "id": "code-draft", "artifact_kind": "implementation", "requires": ["icarus"], "prerequisite": "eye-plan-authorization", "produces_artifact": true, "on_pass": "c1-code-pair", "on_non_pass": "daedalus-recovery", "reentry_stage": "code-draft" },
    { "id": "c1-code-pair", "artifact_kind": "implementation", "requires": ["icarus", "daedalus"], "prerequisite": "code-draft", "produces_artifact": false, "on_pass": "c2-code-adversarial", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "c2-code-adversarial", "artifact_kind": "implementation", "requires": ["grok", "gemini"], "prerequisite": "c1-code-pair", "produces_artifact": false, "on_pass": "disk-truth", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "disk-truth", "artifact_kind": "implementation", "requires": ["telos-controller"], "prerequisite": "c2-code-adversarial", "produces_artifact": false, "on_pass": "eye-implementation-acceptance", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "eye-implementation-acceptance", "artifact_kind": "implementation", "requires": ["eye"], "prerequisite": "disk-truth", "produces_artifact": false, "on_pass": "iliad-retrospective", "on_non_pass": "daedalus-recovery", "reentry_stage": "c1-code-pair" },
    { "id": "iliad-retrospective", "artifact_kind": "implementation", "requires": ["telos-controller"], "prerequisite": "eye-implementation-acceptance", "produces_artifact": false, "on_pass": "closed", "on_non_pass": "daedalus-recovery", "reentry_stage": "iliad-retrospective" },
    { "id": "daedalus-recovery", "artifact_kind": "recovery", "requires": ["daedalus"], "prerequisite": null, "produces_artifact": true, "on_pass": "$reentry", "on_non_pass": "daedalus-recovery", "reentry_stage": "daedalus-recovery" },
    { "id": "closed", "artifact_kind": "implementation", "requires": [], "prerequisite": "iliad-retrospective", "produces_artifact": false, "on_pass": null, "on_non_pass": null, "reentry_stage": null }
  ],
  "telos_handoff": {
    "authorization_required_seats": ["claude", "agy", "codex"],
    "authorization_advisory_seats": ["grok", "gemini"],
    "profile_gate_results_are_authority": false
  }
}
```

- [ ] **Step 4: Implement the profile loader and closed validator**

Create `scripts/lifecycle-profile.mjs`. It must resolve the default path relative to `import.meta.url`, parse JSON, reject unknown top-level/stage/seat/handoff fields, require unique stage IDs and known seat/transition references, require the exact null `automatic_limits`, require `allow_seat_substitution === false`, and require every nonterminal stage to route non-pass to `daedalus-recovery`. Export the five interfaces listed above and compute `profileRef` with `sha256Ref(profile)`.

The stage validator must also assert this exact ordered path:

```js
const REQUIRED_PATH = [
  "requirements-freeze", "plan-draft", "p1-plan-pair", "p2-plan-adversarial",
  "eye-plan-authorization", "code-draft", "c1-code-pair", "c2-code-adversarial",
  "disk-truth", "eye-implementation-acceptance", "iliad-retrospective", "closed"
];
```

`loadProfile()` must throw `invalid lifecycle profile: <joined problems>` when validation returns any problem; it must not repair or default malformed profile data.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats add records/lifecycle-profiles/daedalus-family-v1.json scripts/lifecycle-profile.mjs tests/test-lifecycle-profile.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: define Daedalus family lifecycle profile"
```

Expected: 8 lifecycle tests pass across the two files; commit succeeds.

### Task 3: Signed Append-Only Merkle-DAG Store

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-store.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/lifecycle-fixtures.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs`

**Interfaces:**
- Consumes: `canonicalJson`, `decisionRef`, `sha256Ref`, `validateDecisionNode`, `validateUnsignedDecisionNode` from Task 1.
- Produces: `createLifecycleStore({ dir, privateKey, publicKey }): { putArtifact, readArtifact, appendDecision, readEntries, verify }`, `verifyLifecycleStore({ dir }): object`, `signDecision(unsignedNode, privateKey): object`, `verifyDecision(node, publicKey): boolean`, `deriveLifecycleRoot(entries): string`.

- [ ] **Step 1: Add reusable test fixtures**

Create `tests/lifecycle-fixtures.mjs` exporting:

```js
import { generateKeyPairSync } from "node:crypto";
import { sha256Ref } from "../scripts/lifecycle-core.mjs";

export function controllerKeys() {
  return generateKeyPairSync("ed25519");
}

export function unsignedDecision(overrides = {}) {
  return {
    node_version: "dfm.decision.v1",
    node_type: "decision",
    stage: "requirements-freeze",
    artifact_hash: sha256Ref("requirements-v1"),
    parent_hashes: [],
    input_refs: [sha256Ref("requirements-v1")],
    output_refs: [],
    actor: { seat: "eye", provider: "human", model: "eye-record-v1" },
    provenance_ref: sha256Ref("eye-provenance"),
    decision: { verdict: "pass", findings: [], dispositions: [] },
    evidence_refs: [sha256Ref("requirements-evidence")],
    policy_ref: sha256Ref("policy-v1"),
    recorded_at: "2026-07-21T12:00:00.000Z",
    ...overrides
  };
}
```

- [ ] **Step 2: Write failing store tests**

Create `tests/test-lifecycle-store.mjs` with eight `node:test` cases:

1. persist the requirement, policy, provenance, and evidence artifacts, append a genesis node and child, then assert two JSONL lines, valid signatures, one leaf, and a `sha256:` lifecycle root;
2. append two independent cold-review children with the same parent, then assert two sorted leaves and a different lifecycle root after each appended decision;
3. reject a node whose parent is absent with `missing parent`;
4. reject a duplicate full node with `duplicate decision ref`;
5. modify one stored verdict byte and assert `verify()` throws `decision ref mismatch` or `invalid controller signature`;
6. modify one canonical artifact byte and assert `verifyLifecycleStore({ dir })` throws `artifact ref mismatch`;
7. assert that a node whose provenance/evidence/policy/artifact refs were never stored is rejected with `missing artifact`;
8. give two seats provenance artifacts with whitespace-equivalent response IDs and assert the second decision is rejected with `reused provenance response_id`.

Each test creates a temporary directory with `mkdtempSync`, removes it with `t.after`, uses keys from `controllerKeys()`, and asserts that no file contains `PRIVATE KEY`.

- [ ] **Step 3: Run the store test and confirm the module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-store.mjs`.

- [ ] **Step 4: Implement the controller-only store**

Implement `scripts/lifecycle-store.mjs` with these exact persistence rules:

```js
const FILES = {
  decisions: "decisions.jsonl",
  publicKey: "controller-public-key.json",
  artifacts: "artifacts"
};
```

- `signDecision` validates the unsigned node, signs `Buffer.from(canonicalJson(unsignedNode), "utf8")` with Ed25519 `sign(null, bytes, privateKey)`, and returns the node plus a base64url `controller_signature`.
- `verifyDecision` removes `controller_signature` and calls Ed25519 `verify(null, canonical bytes, publicKey, Buffer.from(signature, "base64url"))`.
- `createLifecycleStore` creates `dir` recursively, persists only `{ "key_type": "ed25519", "public_key_der_base64": "..." }` using the public key's SPKI DER bytes, and rejects a different existing public key.
- `putArtifact(value)` calls `assertSecretFree`, computes `sha256Ref(value)`, writes canonical JSON with `flag: "wx"` to `artifacts/<64-hex>.json`, and returns the ref. If the file already exists it must re-read and confirm identical canonical bytes.
- `readArtifact(ref)` rejects malformed refs, reads the exact artifact path, recomputes its ref, and throws `artifact ref mismatch` on drift.
- `readEntries` parses every nonblank JSONL line as `{ ref, node }` and returns disk order.
- `appendDecision` re-runs `verify()` first, requires `artifact_hash`, every `input_ref`, every `output_ref`, `provenance_ref`, every `evidence_ref`, and `policy_ref` to resolve through `readArtifact`, signs the input, computes `decisionRef(node)`, rejects duplicate refs, requires every parent to appear earlier in disk order, appends one canonical JSON line through an `openSync(..., "a")`/`writeSync`/`fsyncSync`/`closeSync` sequence, then re-runs `verify()` and returns `{ ref, node, lifecycle_root, leaves }`.
- `verify()` recomputes every decision and artifact ref, validates every closed node, verifies every signature, rejects duplicate/missing/later parents, and requires every provenance artifact to have the closed shape `{ provenance_version: "dfm.provenance.v1", provider, model, attempt_ref, response_id, status, source }`. `attempt_ref` is always a unique SHA-256 ref; `response_id` is a non-empty provider ID when `status` is `issued` and is `null` when `status` is `failed`. Burn whitespace-equivalent non-null response IDs reused by any seat. Derive leaves as refs never named as parents and return `{ count, decision_refs, leaves: sortedLeaves, lifecycle_root }`.
- `verifyLifecycleStore({ dir })` reads the persisted SPKI public key and performs the same read-only verification without accepting or reconstructing a private key.
- `deriveLifecycleRoot(entries)` returns `sha256Ref({ root_version: "dfm.root.v1", leaves: sortedLeaves })`; an empty store has `sha256Ref({ root_version: "dfm.root.v1", leaves: [] })`.
- Because parents must already exist in the append-only log, a cycle cannot be appended; retain a test comment that this ordering rule is the cycle negative control.

- [ ] **Step 5: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-store.mjs tests/lifecycle-fixtures.mjs tests/test-lifecycle-store.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: add signed append-only lifecycle store"
```

Expected: all core and store tests pass; the repository contains no private-key file.

### Task 4: Deterministic Lifecycle Engine and Pass-or-Return Rule

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-engine.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs`

**Interfaces:**
- Consumes: validated profile from Task 2 and stored `{ ref, node }` entries from Task 3.
- Produces: `createLifecycleState({ profile, requirementRoot }): LifecycleState`, `applyDecision(state, entry, profile): LifecycleState`, `currentStage(state, profile): Stage`, `isClosed(state): boolean`.

`LifecycleState` has this closed JSON shape:

```js
{
  state_version: "dfm.state.v1",
  profile_ref: "sha256:...",
  requirement_root: "sha256:...",
  status: "active",
  stage_id: "requirements-freeze",
  artifact_hash: "sha256:...",
  stage_base_hashes: [],
  stage_entries: [],
  heads: [],
  completed_stages: [],
  return_stage: null,
  authorized_plan_root: null,
  accepted_implementation_root: null
}
```

- [ ] **Step 1: Write failing transition tests**

Create `tests/test-lifecycle-engine.mjs` using `loadProfile()`, `profileRef()`, `unsignedDecision()`, `signDecision()`, and `decisionRef()` to build entries without disk I/O. Include these exact negative and positive cases:

- `P2` entry while state is at `P1` throws `decision stage p2-plan-adversarial does not match active stage p1-plan-pair`.
- A single Daedalus `P1` pass does not advance; the independent Icarus pass against the same `stage_base_hashes` advances to `P2`.
- Icarus cannot supply Grok's `P2` decision; it throws `seat icarus is not required at p2-plan-adversarial`.
- A Grok `non-pass` at `P2` moves to `daedalus-recovery`, retains every stage entry as heads, and sets `return_stage` to `p1-plan-pair`.
- Daedalus recovery must provide exactly one new `output_ref`; its pass changes `artifact_hash`, clears old stage approvals, and re-enters `P1`, so old `P1`/`P2` passes cannot satisfy the descendant plan.
- A `C2` non-pass followed by recovery re-enters `C1` while preserving `authorized_plan_root` and invalidating implementation-stage completions.
- A plan mutation clears `authorized_plan_root`; attempting `code-draft` before a fresh `P1`/`P2`/Eye authorization fails closed as a stale authorization.
- `eye-pause`, `eye-cancel`, `eye-amend`, and `eye-adjudicate` are accepted only from seat `eye`; pause sets `status: "paused"`, cancel sets `status: "cancelled"`, amendment routes through recovery, adjudication resumes only from paused state, and every action entry changes the head/root.
- Applying 25 consecutive non-pass/recovery pairs remains valid and active; no counter or elapsed field terminates the run.
- `closed` is reached only after the ordered pass path and the state records both exact authorized plan and accepted implementation roots.

- [ ] **Step 2: Run the test and confirm the engine is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-engine.mjs`.

- [ ] **Step 3: Implement the pure reducer**

Implement `scripts/lifecycle-engine.mjs` with these transition rules:

1. Clone the input state with `structuredClone`; never mutate caller state.
2. Preserve the immutable `requirement_root` supplied to `createLifecycleState` and reject a state whose `profile_ref` differs from `profileRef(profile)`.
3. Reject a decision whose `stage`, `artifact_hash`, `policy_ref`, or sorted `parent_hashes` differs from the active state/profile/base heads.
4. Eye actions are global but require `actor.seat === "eye"`. `eye-pause` and `eye-cancel` append the head and set status; `eye-amend` routes through recovery; `eye-adjudicate` resumes only when the state was paused and its disposition names a valid stage.
5. For ordinary decisions, require the actor seat in the active stage's `requires` and allow at most one decision from each required seat per exact artifact.
6. Independent reviewers all parent the same immutable `stage_base_hashes`; they do not parent or observe sibling review decisions.
7. A `non-pass` sets `stage_id = profile.recovery_stage`, `return_stage = activeStage.reentry_stage`, and `heads = sorted refs of all decisions already recorded at the failed stage`; it never sets a terminal status.
8. A recovery pass requires seat `daedalus`, exactly one `output_ref` different from `artifact_hash`, and parents equal to all failure heads. It changes the artifact root, trims `completed_stages` from `return_stage` onward, clears `authorized_plan_root` when returning to `plan-draft`/`p1-plan-pair`, preserves it for `c1-code-pair`, and starts the re-entry stage with the recovery ref as its sole base head.
9. A stage advances only when every required seat has a literal `pass` against the same artifact and base heads. `produces_artifact` stages require their sole author to provide exactly one output ref and promote it as the next artifact.
10. Passing `eye-plan-authorization` stores the current artifact as `authorized_plan_root`. Passing `eye-implementation-acceptance` stores it as `accepted_implementation_root`. `code-draft` cannot run unless `authorized_plan_root` is set and exactly equals the plan root captured before code production.
11. Reaching `closed` sets `status = "closed"`; no other ordinary transition sets a terminal status.

- [ ] **Step 4: Run engine, store, profile, and core tests**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
```

Expected: every lifecycle test passes with 0 failures.

- [ ] **Step 5: Commit**

```bash
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-engine.mjs tests/test-lifecycle-engine.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: enforce pass-or-return lifecycle transitions"
```

### Task 5: Provider Seat Adapter Boundary

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-seat-adapter.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs`

**Interfaces:**
- Consumes: `redactSecrets`, `sha256Ref`, profile seat records, and an injected `invoke(request): Promise<SeatResponse>` callback.
- Produces: `invokeLifecycleSeat(options): Promise<{ decision, artifacts }>` where `decision` is an unsigned decision node and `artifacts` is a map from SHA-256 ref to redacted JSON.

The accepted successful `SeatResponse` shape is closed; its verdict is `pass` or `non-pass`. A provider refusal uses the same keys with verdict `refuse` and is mapped to a lifecycle non-pass:

```js
{
  provider: "openai",
  model: "recorded-per-call",
  response_id: "provider-issued-id",
  verdict: "pass",
  findings: [],
  dispositions: [],
  evidence: []
}
```

- [ ] **Step 1: Write failing adapter tests**

Create `tests/test-lifecycle-seat-adapter.mjs` with six cases:

1. a valid injected Icarus response produces actor `{ seat: "icarus", provider: "openai", model: "gpt-test" }`, a hashed closed `dfm.provenance.v1` artifact, hashed evidence artifacts, and verdict `pass`;
2. a thrown `invoke` error produces verdict `non-pass`, finding code `PROVIDER_DIED`, and a redacted failure artifact instead of throwing;
3. a missing/blank response ID produces `non-pass` with `INVALID_PROVENANCE`;
4. a result claiming provider `xai` for the Icarus/OpenAI seat produces `non-pass` with `PROVIDER_MISMATCH` and never changes the actor seat;
5. a provider refusal produces `non-pass` with `PROVIDER_REFUSED` and never becomes a pass through retry logic;
6. a response containing `Bearer abcdefghijklmnopqrstuvwxyz` persists only `<redacted>` and `assertSecretFree(artifacts)` succeeds.

- [ ] **Step 2: Run the test and confirm the adapter is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-seat-adapter.mjs`.

- [ ] **Step 3: Implement the injected adapter**

`invokeLifecycleSeat` must accept `{ profile, seat, requestedModel, stage, artifactHash, parentHashes, inputRefs, outputRefs, policyRef, request, attemptRef, invoke, recordedAt }`. It must:

- reject an unknown seat before calling the provider;
- call only the injected `invoke` function and never read provider API keys;
- validate the closed response keys and exact provider from the profile;
- convert outages, malformed responses, provider mismatches, truncated evidence, and invalid provenance to non-pass findings rather than exceptions;
- require a unique SHA-256 `attemptRef` supplied by the controller and the exact `requestedModel` before calling the provider;
- create a redacted closed provenance artifact with `status: "issued"` and a non-empty response ID for a valid response, or `status: "failed"` and `response_id: null` for an outage/refusal/malformed response; never invent a provider response ID;
- create redacted evidence artifacts and use only their SHA-256 refs in the decision;
- discard raw chain-of-thought/private reasoning fields rather than hashing or persisting them;
- set `actor.seat` from the requested/profile seat, never from provider output;
- return a Task-1-valid unsigned decision node with `recorded_at = recordedAt` supplied by the controller.

Use closed finding objects `{ code, message }`; allowed adapter codes are `PROVIDER_DIED`, `PROVIDER_REFUSED`, `MALFORMED_RESPONSE`, `INVALID_PROVENANCE`, `PROVIDER_MISMATCH`, and `TRUNCATED_EVIDENCE`.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-seat-adapter.mjs tests/test-lifecycle-seat-adapter.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: normalize lifecycle seat outcomes"
```

Expected: all adapter and engine tests pass; no provider credential is required.

### Task 6: Independent Disk Truth

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-disk-truth.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs`

**Interfaces:**
- Consumes: a target checkout path and closed command records `{ command: string, args: string[] }`.
- Produces: `hashTree(root, { exclude? }): object`, `runVerificationCommands(root, commands): object[]`, `deriveDiskTruth({ root, commands, exclude?, expectedImplementationRoot }): object`.

- [ ] **Step 1: Write failing disk-truth tests**

Create `tests/test-lifecycle-disk-truth.mjs` with temporary-checkout cases that:

1. write `src/index.mjs` and `tests/test.mjs`, derive a sorted manifest/root, and assert the same bytes produce the same root regardless of file creation order;
2. change one source byte and assert the tree root changes;
3. assert `.git/`, `.multi-model-seats/lifecycle/`, `.env`, `.env.*`, and `*.pem` are excluded by the closed default policy and never appear in the manifest;
4. create a symbolic link and assert `hashTree` throws `symbolic links are not accepted as disk truth`;
5. run `{ command: process.execPath, args: ["--check", "src/index.mjs"] }` and assert exit 0 plus hashed stdout/stderr evidence;
6. run a script that exits 3 and assert `deriveDiskTruth` returns `verdict: "non-pass"`, finding code `VERIFICATION_COMMAND_FAILED`, and no implementation-root match claim;
7. compare `expectedImplementationRoot` to the re-derived tree root and assert a mismatch returns `IMPLEMENTATION_ROOT_MISMATCH`.

- [ ] **Step 2: Run the test and confirm the disk-truth module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-disk-truth.mjs`.

- [ ] **Step 3: Implement checkout re-derivation**

Implement with `lstatSync`, `readdirSync`, `readFileSync`, `relative`, and `spawnSync`; do not invoke a shell. Normalize relative paths to `/`, sort before hashing, reject paths escaping the root, reject symlinks, and build:

```js
{
  tree_version: "dfm.tree.v1",
  files: [{ path: "src/index.mjs", bytes: 42, content_ref: "sha256:..." }]
}
```

The tree root is `sha256Ref(manifest)`. Each command record must contain only `command` and `args`; run it with `{ cwd: root, shell: false, encoding: "utf8" }`, redact stdout/stderr, hash the evidence record, and treat a spawn error, signal, or nonzero status as `VERIFICATION_COMMAND_FAILED`. `deriveDiskTruth` returns `{ verdict, tree_root, manifest, command_evidence, findings }`; only exact equality with `expectedImplementationRoot` and all exit-0 commands permits `pass`.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-disk-truth.mjs tests/test-lifecycle-disk-truth.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: re-derive lifecycle disk truth"
```

Expected: all disk-truth/core tests pass; no shell or live provider is used.

### Task 7: TELOS Exact-Root Export

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-export.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`

**Interfaces:**
- Consumes: closed `LifecycleState`, `profileRef(profile)`, and `store.verify()` result.
- Produces: `buildTelosExport({ state, profile, verification, evidenceRefs }): object`, `verifyTelosExport(packet): string[]`; `requirement_root` comes from the immutable engine state created in Task 4.

- [ ] **Step 1: Write failing export tests**

Create `tests/test-lifecycle-export.mjs` with these assertions:

- an active, paused, cancelled, or incomplete state throws `lifecycle must be closed before TELOS export`;
- a closed state with no exact `authorized_plan_root` or `accepted_implementation_root` throws the missing field name;
- a stale verification root that differs from `state.heads`/derived leaves throws `lifecycle root does not match disk verification`;
- a valid packet has only these keys: `export_version`, `profile_ref`, `requirement_root`, `authorized_plan_root`, `accepted_implementation_root`, `lifecycle_root`, `decision_refs`, `evidence_refs`, `authority_claim`;
- `authority_claim` equals `{ model_consensus_is_authority: false, eye_authorization_required: true, mutates_telos_authority: false }`;
- mutating any root makes `verifyTelosExport` return at least one problem.

- [ ] **Step 2: Run the test and confirm the export module is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-export.mjs`.

- [ ] **Step 3: Implement the closed handoff packet**

Implement the two interfaces. `buildTelosExport` must re-check `profile_ref`, closed status, exact stored roots, non-empty verified decision refs, unique/sorted evidence refs, and a disk-derived lifecycle root. It must not import from TELOS, edit `CURRENT-AUTHORITY.json`, or claim authorization. `verifyTelosExport` must reject unknown keys, malformed SHA-256 refs, duplicate refs, false authority-boundary values, and an empty decision list.

- [ ] **Step 4: Run focused tests and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-export.mjs tests/test-lifecycle-export.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: export exact lifecycle roots to TELOS"
```

### Task 8: Synthetic End-to-End Proof

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/scripts/lifecycle-demo.mjs`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`

**Interfaces:**
- Consumes: profile, store, engine, adapter, disk-truth, and export interfaces from Tasks 1-7.
- Produces: CLI `node scripts/lifecycle-demo.mjs --out <empty-dir>` and exported `runDemo({ outDir }): Promise<object>`.

- [ ] **Step 1: Write the failing spawned proof test**

Create `tests/test-lifecycle-demo.mjs`. It must create an empty temporary output directory, spawn the CLI, require exit 0 and `DAEDALUS_FAMILY_DEMO_OK`, read `summary.json`, and assert:

```js
assert.equal(summary.feature, "content-addressed-note");
assert.equal(summary.status, "closed");
assert.equal(summary.failure_routes_to_daedalus, 1);
assert.equal(summary.reentered_gate, "p1-plan-pair");
assert.ok(summary.decision_count >= 18);
assert.match(summary.lifecycle_root, /^sha256:[0-9a-f]{64}$/);
assert.match(summary.authorized_plan_root, /^sha256:[0-9a-f]{64}$/);
assert.match(summary.accepted_implementation_root, /^sha256:[0-9a-f]{64}$/);
assert.equal(summary.private_key_persisted, false);
```

It must also run the exported store verifier over the written JSONL and assert the summary root equals the re-derived root.

- [ ] **Step 2: Run the test and confirm the demo is missing**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs`

Expected: non-zero exit with `ERR_MODULE_NOT_FOUND` for `scripts/lifecycle-demo.mjs`.

- [ ] **Step 3: Implement the proof run**

`runDemo` must refuse a non-empty output directory, generate an ephemeral Ed25519 controller keypair, load the committed profile, and execute this exact scenario with injected deterministic provider doubles:

1. Eye freezes `sha256Ref("content-addressed-note requirements v1")`.
2. Daedalus produces plan root v1.
3. Daedalus and Icarus pass `P1` independently.
4. Grok returns `non-pass` at `P2` with finding `PLAN_TEST_ORACLE_MISSING`; the decision is appended.
5. Daedalus recovery emits plan root v2 and re-enters `P1`.
6. Daedalus/Icarus pass `P1`; Grok/Gemini independently pass `P2`; Eye authorizes plan v2.
7. Write the synthetic `content-addressed-note` source/test files, derive their disk tree as implementation root v1, then have Icarus produce that exact root; Icarus/Daedalus pass `C1`; Grok/Gemini pass `C2`.
8. Re-run the source syntax/test commands and tree hash through `deriveDiskTruth`; the local TELOS controller records pass only because the re-derived root equals implementation root v1. Eye accepts the implementation; the local controller records the retrospective; state closes.
9. Persist every referenced canonical artifact, re-verify the store from disk with `verifyLifecycleStore`, write `telos-export.json`, and write `summary.json` with roots/counts but no raw model output or private key material.

Use controller-supplied ISO timestamps derived from an incrementing fixed base solely for repeatable ordering; timestamps remain non-authoritative. Every decision must be appended before it is applied to engine state.

- [ ] **Step 4: Run the entire lifecycle suite and commit**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
git -C /home/colchis/plugins/multi-model-seats add scripts/lifecycle-demo.mjs tests/test-lifecycle-demo.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "test: prove Daedalus family lifecycle end to end"
```

Expected: every lifecycle test passes; the demo reports one non-pass return through Daedalus and ends only after the exact ordered passes and Eye records.

### Task 9: Skill Entry Point, Plugin Metadata, Bootstrap Hygiene, and Installation Proof

**Files:**
- Create: `/home/colchis/plugins/multi-model-seats/skills/daedalus-family-lifecycle/SKILL.md`
- Create: `/home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs`
- Modify: `/home/colchis/plugins/multi-model-seats/.codex-plugin/plugin.json`
- Modify: `/home/colchis/plugins/multi-model-seats/scripts/bootstrap.mjs`

**Interfaces:**
- Consumes: lifecycle CLI and all existing provider-seat/Superpowers skills.
- Produces: discoverable `multi-model-seats:daedalus-family-lifecycle` skill and plugin version `0.6.0`.

- [ ] **Step 1: Write the failing packaging test**

Create `tests/test-lifecycle-skill.mjs` that asserts:

- `.codex-plugin/plugin.json` version is exactly `0.6.0` and its description mentions `Merkle-DAG lifecycle`;
- the new skill frontmatter name is `daedalus-family-lifecycle`;
- the skill contains all seven actual Superpowers names from Global Constraints;
- the skill contains `P1`, `P2`, `C1`, `C2`, `every non-pass returns to Daedalus`, `model consensus is not authority`, and `The Eye`;
- every line invoking a plugin script uses `node "<plugin-root>/scripts/<name>.mjs"` with a quoted resolved path;
- `bootstrap.mjs` generates `.multi-model-seats/lifecycle/` in `.gitignore`.

- [ ] **Step 2: Run the packaging test and confirm it fails**

Run: `node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs`

Expected: failures for missing skill and plugin version `0.5.2`.

- [ ] **Step 3: Add the lifecycle skill**

Create `skills/daedalus-family-lifecycle/SKILL.md` with frontmatter name/description and this enforced workflow:

1. Require an approved brainstorm and exact requirement root.
2. Use `superpowers:writing-plans` for Daedalus authorship and Icarus feasibility review; record `P1`.
3. Request blind Grok/Gemini plan reviews through their seat skills; record `P2` only when both independently pass the same descendant root.
4. Stop for The Eye's exact-root plan authorization.
5. Use `superpowers:executing-plans` or `superpowers:subagent-driven-development`; Icarus authors code and Daedalus reviews architecture; record `C1`.
6. Use `superpowers:requesting-code-review` and `superpowers:receiving-code-review` for cold Grok/Gemini code review; record `C2` only when both independently pass the same descendant root.
7. Use `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch` only after disk truth and The Eye acceptance.
8. State exactly: `every non-pass returns to Daedalus`; forbid automatic caps and seat substitution; state that model consensus is not authority.
9. Document the quoted demo command `node "<plugin-root>/scripts/lifecycle-demo.mjs" --out <empty-dir>` and the eight focused test commands from Task 8.

- [ ] **Step 4: Update metadata and generated-project hygiene**

Change plugin version from `0.5.2` to `0.6.0`, add `Merkle-DAG lifecycle` to the description/long description, and add `Run the Daedalus family lifecycle for this feature.` to `interface.defaultPrompt`.

Add this exact line to the generated `GITIGNORE` string in `scripts/bootstrap.mjs`:

```gitignore
.multi-model-seats/lifecycle/
```

- [ ] **Step 5: Run the full source verification**

```bash
node /home/colchis/plugins/multi-model-seats/tests/test-selected-fixes.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-core.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-profile.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-store.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-engine.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-seat-adapter.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-disk-truth.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-export.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-demo.mjs
node /home/colchis/plugins/multi-model-seats/tests/test-lifecycle-skill.mjs
```

Expected: every existing and new test passes with 0 failures.

- [ ] **Step 6: Commit the packaging change**

```bash
git -C /home/colchis/plugins/multi-model-seats add .codex-plugin/plugin.json scripts/bootstrap.mjs skills/daedalus-family-lifecycle/SKILL.md tests/test-lifecycle-skill.mjs
git -C /home/colchis/plugins/multi-model-seats commit -m "feat: publish Daedalus family lifecycle skill"
git -C /home/colchis/plugins/multi-model-seats status --short --branch
```

Expected: clean plugin source worktree.

- [ ] **Step 7: Refresh through the normal plugin path and verify source/cache identity**

First select the intended Codex profile. A Desktop-launched Windows Codex process uses the UNC marketplace source `\\wsl.localhost\\kali-linux\\home\\colchis\\plugins`; native Kali Codex uses `/home/colchis/plugins` with Windows `CODEX_HOME`/`CODEX_SQLITE_HOME` unset. Validate every configured marketplace before reinstalling because one invalid marketplace blocks all plugin commands.

```bash
test -f /home/colchis/plugins/.agents/plugins/marketplace.json
codex plugin marketplace list
codex plugin remove multi-model-seats@multi-model-local --json
codex plugin add multi-model-seats@multi-model-local --json
codex plugin list
```

Expected: `multi-model-seats@multi-model-local` is installed/enabled at `0.6.0`. If marketplace validation fails, do not copy files into the cache; report the invalid marketplace(s), keep the verified source commit, and resume installation only after the profile/source path is repaired.

Verify installed bytes without treating installation as provider authentication:

```bash
sha256sum /home/colchis/plugins/multi-model-seats/scripts/lifecycle-core.mjs /mnt/c/Users/dsmce/.codex/plugins/cache/multi-model-local/multi-model-seats/0.6.0/scripts/lifecycle-core.mjs
node /mnt/c/Users/dsmce/.codex/plugins/cache/multi-model-local/multi-model-seats/0.6.0/tests/test-lifecycle-demo.mjs
```

Expected: both hashes match and the installed-cache demo exits 0. Report Anthropic/OpenAI/xAI/Google authentication separately; deterministic plugin usability does not prove live provider credentials.

## Final Verification and Handoff

- [ ] Re-run TELOS contract verification; this plugin plan must not have changed TELOS authority records.

```bash
node /home/colchis/Projects/TELOS/docs/institutional-memory/verify-contracts.mjs
git -C /home/colchis/Projects/TELOS status --short --branch
```

Expected: `301/301 contracts match system reality`; no implementation artifact has silently modified `CURRENT-AUTHORITY.json`.

- [ ] Record the plugin commit, profile ref, lifecycle root, authorized plan root, accepted implementation root, test totals, installation version, cache/source hash comparison, and any provider-authentication gaps in the implementation handoff.

- [ ] Submit the exact plugin commit and TELOS export to The Eye. Do not call it accepted, enrolled, merged, released, or implementation-complete until the corresponding Eye/TELOS records exist.
