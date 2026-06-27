# telos-merkle-dag

Content-addressed Merkle-DAG planning, Ed25519 verified delegation, and a pure `done()` merge gate. Self-contained: vendored `canonicalize` and `resolveUnder` helpers so no external dependencies.

## What it does

Each TELOS task node carries two hashes:

- **spec_hash** — SHA-256 of `{files, requirements, test}` (the node's own declared spec).
- **effective_hash** — SHA-256 of `{spec_hash, sorted parent effective_hashes}`. Any upstream change cascades forward; parallel branches are unaffected.

The **ledger-gate** (`verify`) runs four checks per node before issuing a `done()` verdict:

| # | Check | Pass condition |
|---|-------|----------------|
| 1 | **lineage** | Ledger entry `effective_hash` matches recomputed plan hash |
| 2 | **signature** | Ed25519 signature verifies against published public key |
| 3 | **artifact** | SHA-256 tree hash of declared files on disk matches signed hash |
| 4 | **test** | Node's declared test command exits 0 |

All four must pass. A **spec change** cascades — the new `effective_hash` blocks the node and every downstream dependent (`STALE_LINEAGE`). A **post-settlement** failure with an unchanged spec (e.g. artifact drift) blocks that node directly; descendants are evaluated independently, but either way the overall merge fails closed (exit 1).

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | `merge_status: "ready"` — all nodes pass, safe to merge |
| `1` | `merge_status: "blocked"` — one or more nodes failed; blocked list in `report.blockers` |
| `2` | `merge_status: "error"` — plan invalid or tampered; do not proceed |

## Schemas

### Plan (`plan.json` / `merkle.mjs`)

```json
{
  "telos_plan_version": 1,
  "algo": "sha256",
  "canonicalization": "telos-canonical-v1",
  "plan_hash": "sha256:<hex>",
  "topo_order": ["A1", "B1", "C1"],
  "keyring_ref": ".telos/keys",
  "authorized_signers": { "<key_id>": { "kty": "OKP", "crv": "Ed25519", "x": "<base64url>" } },
  "meta": { "revision": 1, "prev_plan_root": null, "mutated_nodes": [], "reason_ref": null },
  "nodes": [
    {
      "id": "A1",
      "files": ["A1.txt"],
      "requirements": "build A1",
      "test": { "cmd": "node", "args": ["-e", "process.exit(0)"] },
      "dependencies": [],
      "spec_hash": "sha256:<hex>",
      "effective_hash": "sha256:<hex>"
    }
  ]
}
```

`plan_hash` is `SHA-256(canonical({ pairs: [[id, effective_hash], ...sorted], signers: [[key_id, jwk], ...sorted] }))`. It commits to both the node effective-hash set **and** the authorized-signer set, so any tampering of either is detected by the precheck.

### Ledger (`ledger.jsonl` / `crypto.mjs`)

One JSON record per line, append-only. Last record per `task_id` wins (retry semantics).

```json
{
  "task_id": "A1",
  "effective_hash": "sha256:<hex>",
  "artifact_tree_hash": "sha256:<hex>",
  "artifact_files": [{ "path": "A1.txt", "filehash": "sha256:<hex>", "status": "present" }],
  "signer": "tester",
  "key_id": "tester",
  "signed_at": null,
  "sig": { "alg": "Ed25519", "value": "<base64>", "signed_fields": "task_id,effective_hash,artifact_tree_hash,artifact_files,key_id" }
}
```

### Keyring (`.telos/keys/<model>.pub.jwk`)

One JWK file per signing model. Written by `writePublicKey(keysDir, model, publicJwk)`.

**Advisory / tooling only — NOT a trust path.** `ledger-gate` resolves verifying keys exclusively from `plan.authorized_signers` (committed into `plan_hash`); keys present in this directory are ignored for trust decisions. Use it to bootstrap/distribute public keys that you then pin into the plan's `authorized_signers`. (`keyring_ref` in the plan is a display/tooling pointer, not the lookup path.)

## Usage

```
node ledger-gate.mjs verify <telosDir> [baseDir]
```

- `telosDir` — directory containing `plan.json` + `ledger.jsonl` (the trust-bearing files); `keys/` may also be present but is tooling-only and **not** consulted for trust (trusted pubkeys live in `plan.authorized_signers` — see residual (b)).
- `baseDir` — workspace root from which declared artifact paths are resolved (defaults to `telosDir`'s parent).

Outputs a JSON report to stdout; sets `process.exitCode` to `0`, `1`, or `2`.

## Orchestrator (`orchestrate.mjs`)

`orchestrate.mjs` is the reference controller that drives a planned build end-to-end over the Merkle-DAG substrate. It is the **sole ledger writer**; worker processes never touch `.telos/`.

### Key exports

- **`readySet(plan, ledger)`** — returns the IDs of nodes that are not yet settled-valid and whose every dependency is settled-valid. Use this to inspect the work frontier without running a full build.
- **`runBuild({ telosDir, baseDir, dispatch, verifyNode?, signerFor, maxRounds?, concurrency? })`** — async loop that drives the build to completion; returns `{ report, trace }` where `report` is the ledger-gate verdict.

### Bounded parallel pool

Each round, `runBuild` dispatches the current ready-set through a CPU-bounded parallel worker pool:

1. **Write-disjoint batch guard** — before the pool starts, the controller filters the ready-set into a *write-disjoint batch*: if two ready nodes declare the same file in `files`, only the first is included in this round's batch; the other is deferred to the next round. This prevents simultaneous writes to the same file that could corrupt artifacts. Planner-compiled plans never trigger this guard (the planner enforces write-write serial ordering at plan-compile time).

2. **Critical-path scheduling** — the write-disjoint batch is sorted by descending *critical-path weight* (longest downstream chain) before entering the pool, so high-leverage nodes are dispatched first. Within the same weight, nodes are ordered by id for determinism. This is a pure scheduling hint; it does not change which nodes are ready or how they are verified.

3. **Bounded parallel pool** — `Math.min(maxConcurrency(concurrency), batch.length)` worker coroutines run concurrently via `Promise.all`. Each worker pulls items from the batch using an atomic index. The slow work — `dispatch` (subagent call), `verifyNode` (disk hash + async test spawn), and record signing — runs in parallel across all workers.

4. **Serialized state writes** — after the pool drains, outcomes are applied *serially* in deterministic batch order: `appendLedger` and `mutateNode` are never called concurrently. This preserves the sole-writer invariant and ensures the ledger is append-correct under concurrency.

The `concurrency` parameter is a worker-count hint, clamped by `maxConcurrency` (from `vendor.mjs`) to the range `[1, max(1, cpuCount − 2)]`. Omitting `concurrency` defaults to the upper bound. Pass `concurrency: 1` to force serial execution (useful for debugging or low-resource environments).

### Performance and robustness (Increment 3)

**In-memory ledger cache.** `readLedger` is called once before the build loop to seed an in-memory ledger array. Each `appendLedger` write is immediately followed by `ledger.push(record)` to keep the array in sync. Subsequent `readySet` calls use the in-memory array instead of re-reading and re-parsing the file every round. The controller is the sole ledger writer, so this cache is always coherent. The final `verify(telosDir, {baseDir})` call still reads the ledger file directly from disk (ground-truth gate) — drift between cache and disk would be caught there. No mtime/size cache was added (intentionally omitted: the trust path must read ground truth).

**Graceful `verifyNode` failures.** The verify-and-sign portion of `runOne` is wrapped in a try-catch. If an injected `verifyNode` throws (or if `makeRecord` throws), the outcome is a clean `{kind:"verify-failed"}` rather than a rejected promise that would bubble through `Promise.all` and skip the post-pool serial section. Throwing verify functions never cause `runBuild` to reject; they produce a `verify-failed` trace entry and leave the node without a ledger entry (which the final gate reports as `MISSING_LEDGER`).

**Async `spawn` verify.** `defaultVerifyNode` uses non-blocking `spawn` (via the internal `runTest` helper) instead of `spawnSync`. Multiple node tests now run concurrently within the worker pool: while one child process is sleeping or running, the event loop is free to start the next. Exit-0 semantics, `TEST_TIMEOUT_MS` / `SIGTERM` timeout, and `resolveUnder` cwd-confinement are preserved. `ledger-gate.mjs`'s own `spawnSync` is unchanged — it is a synchronous one-shot gate, not a hot loop.

### The 3 protocol rules

| # | Rule | Enforcement |
|---|------|-------------|
| 1 | **Spec-injection boundary** | `dispatch` receives ONLY `{ id, requirements, files, test, effective_hash }` — no plan-wide data, no ledger, no sibling nodes. Workers are never trusted to read the plan or ledger directly. |
| 2 | **Halt on failure / mutate on respec** | If `dispatch` returns `{ ok:false }`, the controller never signs. If a `respec` is provided, `mutateNode` cascades the change through the DAG, `writePlan` updates `plan.json`, and `appendPlanHistory` records the event. No respec → no-progress break. |
| 3 | **Verifier handshake before signing** | `verifyNode` re-derives artifact tree-hash and re-runs the declared test command *independently* before the controller calls `appendLedger`. A node whose verifier rejects it gets no ledger entry. |

### Injected dependencies (keyless, testable)

- **`dispatch(injected)`** — sends the spec to a worker; returns `{ ok:true, signer }` or `{ ok:false, reason, respec? }`. In production: spawns an implementer subagent with the injected spec.
- **`verifyNode(node, baseDir)`** — defaults to `defaultVerifyNode` (disk tree-hash + async `spawn` test). Override in tests or to add extra checks. A throwing `verifyNode` produces a graceful `verify-failed` outcome — it never rejects `runBuild`.
- **`signerFor(model)`** — maps a model key-id to its Ed25519 private PEM. In production: reads from `TELOS_ED25519_SK_<MODEL>` env var; the matching public key must be pinned in `plan.authorized_signers`.

## Honest residuals

**(a) Plan authorship is the trust anchor.** `ledger-gate` runs each node's declared test command as written in `plan.json`. The test is arbitrary code. Bounds: no shell glob expansion (args are passed directly to `spawnSync`), `cwd` is confined under `baseDir`, and the test command is itself included in `spec_hash`. A tampered plan is caught by the precheck, but the precheck trusts the plan was written by an authorised author.

**(b) Signing trust is now folded into plan authorship (hole closed).** The authorized-signer set is pinned inside the content-addressed plan (`authorized_signers` map, committed into `plan_hash`). `key_id` is bound into the signed payload (`signed_fields` now includes `key_id`). `ledger-gate` resolves the signing public key from `plan.authorized_signers[entry.key_id]` — the `.telos/keys/` directory is **not** consulted for trust decisions. An attacker with write access to `.telos/keys/` + `.telos/ledger.jsonl` but **not** `.telos/plan.json` cannot forge a `ready` verdict: their key is absent from `plan.authorized_signers`, so every entry they sign gets `UNKNOWN_SIGNER`. Tampering `authorized_signers` in `plan.json` without updating `plan_hash` is caught by the precheck (`PLAN_TAMPERED`, exit 2). The remaining narrower residual is: *whoever holds an authorized signer's private key can sign for that identity, and whoever authors the plan controls the authorized set* — this reduces to residual (a) (plan authorship).

**(c) Raw-byte artifact hashing.** `computeDiskTreeHash` hashes file bytes as-read. Line-ending rewrites (CRLF normalisation, OneDrive sync) or encoding changes cause `ARTIFACT_MISMATCH`. Recommendation: build artifacts in a temp directory; store private keys outside the vault via `TELOS_ED25519_SK_<MODEL>`.

**(d) `baseDir` is caller-supplied.** `verify` accepts `baseDir` as an argument; callers are responsible for supplying a confined workspace root. The path-escape guard (`resolveUnder`) rejects any declared file path that traverses outside `baseDir`, but the correctness of the boundary itself is the caller's responsibility.

**(e) Empty file scope is vacuously verifiable.** A node with `files: []` has a trivially-satisfied artifact check (the empty-set tree hash always matches), so its `done()` proof rests entirely on its test. Give every node either real output files or a meaningful test — ideally both. (Likewise, a plan with zero nodes verifies as `ready` vacuously.)

## Planner (`planner.mjs`)

`compileAndHashPlan({ tasks, authorizedSigners, repoRoot, strict? })` is a deterministic preprocessor that turns declared task footprints into a sound dependency graph and hands off to `merkle.computePlan` for hashing, topological sort, cycle detection, and signer pinning.

### Footprint rules

| Rule | Description |
|------|-------------|
| **Write-write serial** | If two tasks declare overlapping writes (same file), they are chained in declaration order — the later writer depends on the earlier writer. |
| **Read-after-write** | If a task reads a file that another task writes, the reader depends on the writer. |
| **Isolation** | A task with writes that no other task reads, and no shared reads, is a leaf node with only its `baseDependencies` (if any). |

### Write-write conflicts

Two tasks writing the same file is a smell: only the LAST writer can pass `ledger-gate` — the earlier writer's signed `artifact_tree_hash` drifts to `ARTIFACT_MISMATCH` once the later writer overwrites the file. The planner still produces a valid plan (Rule A chains them serially) but **prepends a `write-write conflict` advisory** to `advisories` so the problem is visible. Pass `strict: true` to hard-reject instead: the planner returns `{ errors: [{ code: "WriteWriteConflict", file, tasks }], advisories }` without calling `computePlan`. Prefer one writer per file.

### Implicit multi-parent convergence

A task that reads files from multiple writers lists all of them in `dependencies` — this is native multi-parent in the Merkle DAG. There are no synthetic join nodes or empty-`files` nodes. Any upstream spec change cascades forward through `effective_hash` automatically.

### Advisory import scan

The optional import scan (`advisoryScan`) inspects write-target files on disk for static `import`/`require` references to files written by other tasks. If a task's write target imports such a file but does not declare it as a `read`, a warning string is returned in `advisories`. **The advisory never modifies `dependencies`** — it is informational only. Declare the read explicitly to suppress it and wire the dependency edge.

### Return value

```
{ plan, warnings, advisories }                       // success
{ errors, advisories }                               // cycle / validation error, or strict WriteWriteConflict
```

`advisories` is always a `string[]` (empty if none). Write-write conflict advisories are prepended (most prominent). `plan` is the full `computePlan` output (see Plan schema above).
