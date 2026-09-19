# Daedalus Deterministic Sparse Review Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the five-call production-profile Daedalus workshop while replacing repeated
full-frame prompts and model-authored obligation matrices with a controller-owned registry,
deterministic preflight, hash-bound role capsules, sparse findings, and controller-materialized matrix
rows.

**Architecture:** A workshop-local zero-dependency review compiler validates a canonical JSON registry,
binds source passages to frozen input hashes, evaluates closed mechanical predicates before provider
dispatch, and builds role-specific capsules. Models return sparse findings, replacements, and candidate
quotes; the controller applies exact changes, resolves quotes, constructs the complete matrix, reruns
mechanical checks over full integrated bytes, and sends only affected deltas to the two verifiers.

**Tech Stack:** Node.js `>=18`, ESM `.mjs`, `node:` standard library only, canonical JSON, SHA-256,
existing TELOS artifact store and signed proposal events, Claude Code and Codex CLI strict JSON output.

## Global Constraints

- Governing design:
  `docs/superpowers/specs/2026-07-20-daedalus-sparse-review-compiler-design.md`.
- Scope is only `docs/runs/production-profile-compiler-1-workshop/` plus its governing design, plan,
  and tests. Do not modify `build-gate/daedalus.mjs` or the generic enrolled Daedalus protocol in this
  change.
- Preserve exactly five distinct live seat calls: constraints author, implementation author,
  integrator, constraints verifier, implementation verifier.
- The controller owns the exact `PPC-W01` through `PPC-W29` registry and materializes the final matrix.
  Models cannot add, remove, rename, waive, or satisfy obligations.
- Preserve attempts 009–011 byte-for-byte. Never rewrite, remove, or relabel historical attempts.
- Every source passage and candidate quote is bound to exact input, byte offsets, and raw SHA-256.
- A failed registry check, source binding, mechanical preflight, byte budget, replacement, mapping, or
  full-candidate recheck blocks before the next provider stage.
- Preflight failure makes the seat-call count exactly zero.
- Use only `node:` and repository-relative imports. Add no dependency or lockfile.
- Node.js 18 and 20 are binding; local newer-Node results are supplementary.
- Use code-unit ordering, not locale-sensitive ordering. No absolute host path, wall clock, random ID,
  provider token, or ambient environment value enters semantic hashes.
- Claude and Codex transport schemas remain closed. Unknown and missing response keys fail.
- Subscription-backed Claude Code execution has no implicit dollar estimate or default monetary abort
  threshold. API-backed connectors may accept an explicit caller-provided limit.
- Prompt caching, conversation continuation, and provider-reported status are never correctness proof.
- Smoke and test execution make no live provider call.
- No implementation authorization, Argo entry, authority-file change, commit, merge, enrollment,
  deployment, or release is in scope.
- Preserve unrelated work and the modified production-profile candidate plan.
- Every production behavior is test-first: write a discriminating test, observe the expected failure,
  add the smallest implementation, and rerun focused and regression tests.

---

## File Structure

- Create `docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs`
  - Validates the registry, resolves source bindings and candidate quotes, evaluates mechanical checks,
    creates role capsules, applies exact replacements, and materializes matrix rows.
- Create `docs/runs/production-profile-compiler-1-workshop/review-registry.v1.json`
  - Stores the closed controller-owned `PPC-W01`–`PPC-W29` contract and mechanical checks.
- Modify `docs/runs/production-profile-compiler-1-workshop/run-workshop.mjs`
  - Uses sparse response schemas and capsule prompts; never appends the full frozen frame to
    integration or verification prompts.
- Modify `docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs`
  - Runs registry/preflight before `runParallelDaedalus`, persists their artifacts, applies sparse
    integration through the review compiler, and verifies the new artifacts.
- Modify `docs/runs/production-profile-compiler-1-workshop/claude-code-seat.mjs`
  - Adds bare mode, pre-spawn byte limits, usage capture, and removes the default monetary cap.
- Modify `docs/runs/production-profile-compiler-1-workshop/codex-cli-seat.mjs`
  - Adds the same pre-spawn byte limits and captures usage from the completion event.
- Modify `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`
  - Adds registry, preflight, capsule, materialization, prompt-size, transport-budget, and immutable
    historical-attempt tests.

---

### Task 1: Validate and bind the controller-owned review registry

**Files:**
- Create: `docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs`
- Create: `docs/runs/production-profile-compiler-1-workshop/review-registry.v1.json`
- Test: `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`

**Interfaces:**
- Produces:
  `loadReviewRegistry({ registryText, inputs }) -> { registry, registry_ref, bindings }`.
- `inputs` is the existing map returned by `prepareWorkshopFrame`, where each value contains
  `{ path, absolute, text }`.
- A binding is `{ input, start, end, bytes_sha256, text }`.

- [ ] **Step 1: Write the failing closed-registry and binding tests**

Add cases that import `loadReviewRegistry` and prove:

```js
const loaded = loadReviewRegistry({
  registryText: JSON.stringify(validRegistry),
  inputs: fixtureInputs
});
assert.deepEqual(
  loaded.registry.obligations.map((entry) => entry.obligation_id),
  ["PPC-W01", "PPC-W02"]
);
assert.match(loaded.registry_ref, /^sha256:[0-9a-f]{64}$/);
assert.equal(loaded.bindings["PPC-W01"][0].text, "binding text");
```

Mutations must reject unknown keys, duplicate/unsorted obligation IDs, unknown inputs/check kinds,
empty fields, duplicate check IDs, ambiguous/missing source literals, invalid scopes, and unsupported
registry versions.

- [ ] **Step 2: Run the focused test and observe the missing-export failure**

Run:

```bash
node docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs
```

Expected: failure because `review-compiler.mjs` or `loadReviewRegistry` does not exist.

- [ ] **Step 3: Implement strict registry validation and source binding**

Implement:

```js
export function loadReviewRegistry({ registryText, inputs }) {
  const registry = parseAndValidateClosedRegistry(registryText);
  const bindings = bindEveryUniqueSourceLiteral(registry, inputs);
  return {
    registry,
    registry_ref: `sha256:${sha256hex(Buffer.from(canonicalize(registry)))}`,
    bindings
  };
}
```

Use `TextEncoder`-equivalent UTF-8 `Buffer` offsets rather than JavaScript character offsets when
recording evidence. Hash each exact passage's bytes with raw SHA-256.

- [ ] **Step 4: Populate the exact 29-obligation registry**

Migrate invariant, negative-test, and exit-criterion text from the verified attempt-011 constraints
artifact. Record sorted source bindings and the first closed mechanical checks. The JSON must be
canonicalizable, contain no commentary or provider provenance, and list `PPC-W01` through `PPC-W29`
exactly once in code-unit order.

- [ ] **Step 5: Run focused and existing workshop tests**

Run:

```bash
node docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs
```

Expected: registry cases pass and all existing Cases 0–14 remain green.

---

### Task 2: Block mechanical conflicts before provider dispatch

**Files:**
- Modify: `docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/review-registry.v1.json`
- Modify: `docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs`
- Test: `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`

**Interfaces:**
- Consumes `loadReviewRegistry`.
- Produces:
  `runReviewPreflight({ loadedRegistry, inputs }) -> preflight`.
- `preflight.status` is exactly `"pass"` or `"blocked"`.
- A check row is exactly
  `{ obligation_id, check_id, status, evidence_refs, detail }`.

- [ ] **Step 1: Write failing tests for all closed check kinds**

Create minimal fixtures for:

```text
contains-all
excludes-all
exact-count
```

Each test must show one passing and one failing result, scoped and unscoped behavior, unique evidence
locators, deterministic ordering, and aggregate `blocked` status if any row fails.

- [ ] **Step 2: Write the zero-seat-call preflight regression**

Invoke `runWorkshop` with a candidate fixture violating one required literal and a `callSeat` function
that increments a counter. Assert:

```js
assert.equal(result.state, "blocked");
assert.equal(result.reason, "mechanical-preflight");
assert.equal(seatCalls, 0);
```

- [ ] **Step 3: Run the focused test and observe the missing-preflight failure**

Run the workshop test and confirm failure is caused by missing `runReviewPreflight`/pre-dispatch wiring.

- [ ] **Step 4: Implement deterministic preflight**

Resolve each scope from exact unique start/end literals, evaluate checks over the complete scoped bytes,
and emit sorted evidence refs. `exact-count` counts non-overlapping literal occurrences. Empty values,
ambiguous scopes, or stale bindings throw before model dispatch.

- [ ] **Step 5: Encode attempt-011 mechanical findings**

Add registry checks for:

```text
PPC-W01 complete authority anchors
PPC-W04 distinct roots and path separators
PPC-W14 Task 6 and Task 7 registry coverage
PPC-W15 no structural-for-runtime substitution
PPC-W28 immutable attempt and forensic-hold publication
PPC-W14 artifact.mjs and crypto.mjs source closure
PPC-W14 no false complete-closure assertion
```

Use exact candidate literals that express the required contract rather than natural-language keyword
counts detached from the owning section.

- [ ] **Step 6: Persist and sign the preflight artifact**

Store the registry and preflight as content-addressed artifacts before the first seat call. Add both refs
to the draft event and result envelope. Verification must re-read the registry, rerun preflight against
the exact attempt candidate, and compare canonical bytes.

- [ ] **Step 7: Run tests**

Expected: all mechanical mutations block with zero calls; a corrected fixture advances to the authors.

---

### Task 3: Compile hash-bound role capsules and sparse author responses

**Files:**
- Modify: `docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/run-workshop.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs`
- Test: `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`

**Interfaces:**
- Produces:
  `createReviewCapsule({ role, loadedRegistry, preflight, inputs, findings, integration })`.
- Author response schema is exactly `{ findings }`.
- Every registered obligation has exactly one finding; unregistered discoveries use a null obligation
  ID and route to `needs-eye`.

- [ ] **Step 1: Write failing capsule tests**

Assert stable ordering, deduplicated passages, exact passage hashes, no absolute paths, and role-specific
content. Mutating one source byte after capsule creation must fail `verifyReviewCapsule`.

- [ ] **Step 2: Write failing sparse-author schema tests**

Prove missing/extra/duplicate obligation findings, unknown dispositions, empty satisfied evidence,
violated-without-detail, ambiguous quotes, and automatic integration of an unregistered obligation all
fail closed.

- [ ] **Step 3: Run tests and observe missing capsule behavior**

Run `test-workshop.mjs`; confirm the new tests fail before implementation.

- [ ] **Step 4: Implement capsule creation and verification**

Capsules include registry rows and only the bound source/candidate passages selected for the role.
Canonicalize and hash the complete capsule before dispatch.

- [ ] **Step 5: Replace author schemas and prompts**

Remove `plan` and model-owned `obligations` from author responses. Prompts receive a serialized capsule,
request exactly one finding per registered obligation, and forbid full-plan rewriting.

- [ ] **Step 6: Persist sparse author artifacts**

Keep content-addressed source nodes and distinct provenance, but store the capsule ref and sparse finding
set in each node. Parentage and signed event behavior remain unchanged.

- [ ] **Step 7: Run tests**

Expected: sparse author fixtures pass, schema mutations fail, and no author prompt contains the complete
candidate bytes outside its selected passages.

---

### Task 4: Apply sparse integration and materialize the matrix in the controller

**Files:**
- Modify: `docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/run-workshop.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs`
- Test: `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`

**Interfaces:**
- Produces:
  `applySparseIntegration({ candidate, registry, response })`.
- Returns exactly:
  `{ plan, changed, replacements, obligation_matrix, maturation_summary, mapping_evidence }`.
- Integration response contains `{ decision, maturation_summary, replacements, mappings }`; it never
  contains `obligation_matrix`.

- [ ] **Step 1: Write failing exact-replacement and quote-resolution tests**

Cover preserve/revise/needs-eye, no-op, missing/ambiguous/overlapping/stale `old` text, duplicate or
unknown obligation IDs, missing mappings, and ambiguous mechanism/task quotes.

- [ ] **Step 2: Write the controller-matrix test**

Use a two-obligation registry and integration mappings. Assert matrix rows take invariant,
negative-test, and exit-criterion fields only from the registry and mechanism/task only from uniquely
resolved integrated-candidate quotes.

- [ ] **Step 3: Run tests and observe the missing-materializer failure**

Run the focused suite and confirm it fails because `applySparseIntegration` is absent.

- [ ] **Step 4: Implement exact replacement application**

Reuse the existing unique-old-text and non-overlap semantics. Reject any replacement whose obligation ID
is unknown or whose reason is empty. Apply replacements from the highest offset down.

- [ ] **Step 5: Implement deterministic matrix materialization**

Resolve mechanism/task quotes against post-replacement bytes, derive byte evidence, and join with the
registry. Require an exact sorted bijection over all 29 IDs.

- [ ] **Step 6: Rerun full mechanical preflight on the integrated candidate**

No integration artifact is written unless the complete integrated bytes pass every mechanical check.
Persist the full recheck artifact and bind it into the integration event.

- [ ] **Step 7: Replace integration schema and prompt**

Send only author findings and implicated candidate passages. Assert in tests that the integration prompt
does not contain the full frozen design, full pre-review, full methodology, or entire candidate.

- [ ] **Step 8: Run tests**

Expected: the controller creates the exact matrix, model matrix fields are impossible by schema, and a
stale/ambiguous mapping blocks before verification.

---

### Task 5: Verify only the affected dependency closure without weakening convergence

**Files:**
- Modify: `docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/run-workshop.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs`
- Test: `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`

**Interfaces:**
- Verification capsule consumes original role findings, applied replacements, matrix rows, mapping
  evidence, and integrated candidate bytes.
- Verifier response is exactly `{ verdict, conflicts }`, where each conflict is structured as
  `{ obligation_id, evidence_quotes, detail }`.

- [ ] **Step 1: Write failing delta-capsule tests**

Prove a changed obligation includes its matrix row, replacement, and implicated passages; an unaffected
obligation is represented by its unchanged hash only; stale hashes, omitted changed dependencies, and
invented conflicts fail.

- [ ] **Step 2: Run tests and observe the missing delta closure**

Confirm the tests fail for the expected missing implementation.

- [ ] **Step 3: Implement verification capsules**

Compute affected IDs from author violations, replacement obligation IDs, and changed mapping evidence.
Include complete controller results for affected IDs and hash-only preservation records for unaffected
IDs.

- [ ] **Step 4: Update verifier schemas and prompts**

Keep literal `preserved`/`violated` semantics. Require structured conflicts and reject arbitrary prose.
Do not append the full frozen frame or integrated full plan.

- [ ] **Step 5: Preserve the generic five-call state-machine contract**

Adapt workshop-local responses into the existing `runParallelDaedalus` envelopes so dual descent,
pairwise-distinct provenance, exact matrix coverage, and conflict routing remain enforced without
modifying `build-gate/daedalus.mjs`.

- [ ] **Step 6: Run tests**

Expected: converging smoke still has five unique provenance keys and four signed events; any real
conflict routes to `needs-eye`.

---

### Task 6: Add transport budgets, bare Claude mode, and usage evidence

**Files:**
- Modify: `docs/runs/production-profile-compiler-1-workshop/claude-code-seat.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/codex-cli-seat.mjs`
- Modify: `docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs`
- Test: `docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs`

**Interfaces:**
- Both adapters accept `max_input_bytes`.
- Both return `{ text, model, id, usage }`.
- Usage is a closed nullable record of provider-reported counters plus
  `{ prompt_bytes, response_bytes, elapsed_ms }`.

- [ ] **Step 1: Write failing pre-spawn budget tests**

Use fixture executables that write a marker on spawn. Pass an oversized prompt and assert rejection while
the marker remains absent for Claude and Codex.

- [ ] **Step 2: Write failing transport-argument and usage tests**

Assert Claude arguments include `--bare`, do not include a default `--max-budget-usd`, and still include
strict JSON schema output. Assert both adapters capture prompt/response bytes and available usage.

- [ ] **Step 3: Run tests and observe expected failures**

Confirm current adapters spawn oversized calls, Claude lacks `--bare`, and the default `$3` flag remains.

- [ ] **Step 4: Implement byte budgets before spawn**

Compute UTF-8 bytes over the actual transmitted system-plus-prompt payload. Reject invalid/non-positive
limits and oversized input before creating a child process.

- [ ] **Step 5: Update Claude transport**

Add `--bare`. Add `--max-budget-usd` only when an explicit
`CLAUDE_CODE_MAX_BUDGET_USD` value is supplied. Preserve OAuth credential isolation and schema output.

- [ ] **Step 6: Capture usage without trusting it**

Parse provider usage fields defensively into a closed local record. Usage may be null but prompt bytes,
response bytes, and elapsed time are always controller-computed.

- [ ] **Step 7: Run tests**

Expected: oversized prompts never spawn; adapter fixture tests and workshop suite pass.

---

### Task 7: Verify the complete workshop-local amendment

**Files:**
- Modify only for verified defects:
  `docs/runs/production-profile-compiler-1-workshop/**`
- Verify:
  `docs/superpowers/specs/2026-07-20-daedalus-sparse-review-compiler-design.md`
  and this plan.

**Interfaces:**
- Produces no live workshop result and performs no provider call.
- Leaves attempts 009–011 unchanged.

- [ ] **Step 1: Run syntax and import checks**

```bash
node --check docs/runs/production-profile-compiler-1-workshop/review-compiler.mjs
node --check docs/runs/production-profile-compiler-1-workshop/run-workshop.mjs
node --check docs/runs/production-profile-compiler-1-workshop/workshop-lib.mjs
node --check docs/runs/production-profile-compiler-1-workshop/claude-code-seat.mjs
node --check docs/runs/production-profile-compiler-1-workshop/codex-cli-seat.mjs
```

Expected: all exit `0`.

- [ ] **Step 2: Run workshop tests**

```bash
node docs/runs/production-profile-compiler-1-workshop/test-workshop.mjs
```

Expected: every original and sparse-review case passes.

- [ ] **Step 3: Run generic Daedalus tests**

```bash
node build-gate/scripts/test-daedalus.mjs
```

Expected: generic serial and parallel behavior remains green.

- [ ] **Step 4: Run package checks**

```bash
npm --prefix build-gate run check
npm --prefix build-gate test
npm --prefix merkle-dag run check
npm --prefix merkle-dag test
```

Expected: all exit `0`.

- [ ] **Step 5: Run institutional verification**

```bash
node docs/institutional-memory/verify-contracts.mjs
node docs/institutional-memory/test-comprehension-gate.mjs
```

Expected: all registered contracts and comprehension checks pass.

- [ ] **Step 6: Prove historical attempt preservation and no live call**

Hash every file under attempts 009–011 before and after verification and compare exact sorted manifests.
Inspect new test output for fixture transports only. Do not set `CLAUDE_CODE_OAUTH`,
`CODEX_CLI_OAUTH`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY`.

- [ ] **Step 7: Check the worktree**

```bash
git diff --check
git status --short
```

Expected: only the existing candidate-plan modification, historical workshop directory, approved
design/plan, registry, compiler, and named workshop-tooling changes are present. No Argo, authority,
product implementation, lockfile, credential, or generated live-provider artifact appears.

