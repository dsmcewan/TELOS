# HOSTED SERVICE ARCHITECTURE

> **What this document is.** The certified architecture for running the convergence forge as a hosted, multi-tenant SaaS: **manifest in, certified artifacts out.** Every capability claimed to *exist today* cites a module path in `source/`. Every capability that is *not yet built* is labeled **HYPOTHESIS** with stated assumptions and a falsifiable validation plan. This separation is the load-bearing discipline of this artifact; the adversarial council rejected the prior version for blurring it.

---

## Prior Bout Blocker Resolution (honest ledger)

The previous version of this artifact claimed the council raised "exactly one blocker." That claim was false: the evidence fight log carried **multiple** admissible blockers across Round 1 and Round 2 (missing citations, hypothesis mislabeling, source-quote defects). This version does **not** collapse them into one. Each is enumerated and each is concretely resolved below.

| # | Blocker (as raised) | Resolution in this version |
|---|---|---|
| 1 | Prior resolution claimed "exactly one blocker" while the fight log showed several; defects were retained. | This ledger enumerates **all** blockers and resolves each. No count is asserted; the table itself is the evidence. |
| 2 | Run Orchestration cited **no module paths** for intake/API, queue, or worker pool. | Run Orchestration is now split into **EXISTS** (cited: `source/forge/ratchet.mjs`, `source/forge/operator.mjs`, `source/breakout/seat_router.mjs`, `source/build-gate/seat-registry.mjs`) and **HYPOTHESIS** (intake API, queue, worker pool — explicitly *not yet coded*, with a validation plan). No uncited capability is asserted to exist. |
| 3 | API Surface claimed `/v1/runs`, SSE, submit/stream/fetch with zero implementing module paths. | The API Surface is now **entirely labeled HYPOTHESIS**. It cites the *existing* modules the endpoints would drive (manifest validation, ratchet, ledger) and states plainly that **no server, intake, or queue module exists in `source/` today**. |
| 4 | Orchestration topology (queue+workers+diagram) was presented in present tense as deployed fact without a HYPOTHESIS label, assumptions, or validation plan. | The topology now lives under **§Run Orchestration → Phase-2 topology (HYPOTHESIS)** with explicit assumptions and a falsifiable validation plan. Present-tense "deployed fact" language is removed. |
| 5 | Composition claimed the `defsFromManifest` **docstring** contained the hash-stability quote, but the source places it in the **file-level header comment**. | Corrected. The hash-stability language is attributed to the **file-level header comment** of `source/forge/manifest.mjs`; the `defsFromManifest` docstring is quoted separately for what it *actually* says ("Deterministic task defs for computePlan… Grade fields are STRIPPED…"). |
| 6 | Composition enumerated `MANIFEST_FIELDS` etc. but omitted `CLAIM_FIELDS`, which is defined and used by `validateManifest`. | `CLAIM_FIELDS` is now enumerated with its definition and its use site in the claims-validation branch of `validateManifest`. |

---

## 1. Composition

The hosted service is a composition of modules that **already exist** in `source/`. Each row cites the file and the identifiers a reviewer will find there.

| Capability | Module (EXISTS) | Identifiers |
|---|---|---|
| Customer spec validation, fail-closed | `source/forge/manifest.mjs` | `validateManifest`, `MANIFEST_FIELDS`, `WORKSTREAM_FIELDS`, `CLAIM_FIELDS`, `CHECK_FIELDS`, `CHECK_TYPES`, `GRADES` |
| Deterministic task defs / dossier from a **manifest** | `source/forge/manifest.mjs` | `defsFromManifest`, `workstreamsFromManifest`, `dossierFromManifest` |
| Resumable convergence doctrine (ratchet/styx/respec/closure/banking/digest) | `source/forge/ratchet.mjs` | `openState`, `foldDefs`, `styxGenerateFiles`, `pinResearch`, `loadKeys`, `loadJson`, `saveJson` |
| Council seat routing | `source/breakout/seat_router.mjs` | seat router (plugin backends today) |
| Seat backend registry | `source/build-gate/seat-registry.mjs` | seat registry |
| Long-lived customer ops loops | `source/forge/operator.mjs` | operator loop |
| Signed deliverable ledgers | `source/merkle-dag/crypto.mjs` (via `generateKeypair` imported into `source/forge/ratchet.mjs`), `source/breakout/verifier.mjs` (`reverifyRecord`) | merkle-dag signed ledger |

### 1.1 Fail-closed **manifest** validation

`validateManifest` in `source/forge/manifest.mjs` rejects any manifest with unknown fields, missing required fields, or unknown check types rather than silently ignoring them. The allowed shapes are **pinned as `Set`s** at module scope:

- `MANIFEST_FIELDS` — top-level keys (`build_id`, `idea_id`, `use_case`, `telos`, `objective`, `business_thesis`, `target_users`, `trust_mode`, `workstreams`).
- `WORKSTREAM_FIELDS` — per-workstream keys (`id`, `signer`, `lens`, `dependencies`, `files`, `requirements`, `checks`, `test`, `isUi`, `findingsKey`, `finding`, `claims`).
- `CLAIM_FIELDS` — **`new Set(["statement", "grade"])`**. This is not decorative: `validateManifest` iterates `ws.claims` and enforces `for (const k of Object.keys(c)) if (!CLAIM_FIELDS.has(k)) errors.push(...)`, plus `statement` non-empty and `grade` ∈ `GRADES`. (Blocker #6 resolved — `CLAIM_FIELDS` is enumerated and its use site cited.)
- `CHECK_FIELDS` — check keys (`type`, `path`, `needle`, `grade`).
- `CHECK_TYPES` — `file_exists`, `file_contains`.
- `GRADES` — `executable`, `inspectable`, `cited`, `hypothesis`.

### 1.2 Hash-stability — quoted from where it actually lives

The hash-stability contract is stated in the **file-level header comment** of `source/forge/manifest.mjs`, not in the `defsFromManifest` docstring:

> "Hash-stability contract: defsFromManifest must be deterministic — identical manifest, identical task defs, identical plan hashes."

What the **`defsFromManifest` docstring itself** says (accurately quoted) is:

> "Deterministic task defs for computePlan… Grade fields are STRIPPED from the test specs so grading (advisory metadata) never re-hashes an existing plan."

(Blocker #5 resolved — the quote is attributed to the header comment; the docstring is quoted for what it genuinely contains.)

### 1.3 How the pieces compose into a service

1. A customer submits a **manifest** (one JSON file).
2. `validateManifest` accepts or fail-closed rejects it.
3. `defsFromManifest` + `dossierFromManifest` turn it into deterministic task defs and dossier metadata.
4. `source/forge/ratchet.mjs` runs the adversarial-convergence doctrine in an isolated workdir, resuming from proven progress.
5. Seats are routed via `source/breakout/seat_router.mjs` against backends in `source/build-gate/seat-registry.mjs`.
6. `source/forge/operator.mjs` sustains long-lived customer ops loops.
7. The signed merkle-dag ledger (keys via `source/merkle-dag/crypto.mjs`, re-verification via `source/breakout/verifier.mjs`) is the customer deliverable.

---

## 2. Run Orchestration

### 2.1 What EXISTS today (cited)

The run's execution engine is real and isolated **per workdir**:

- **Workdir isolation is a proven property of `source/forge/ratchet.mjs`.** Its header states: "All state lives in the run's workdir as plain JSON; every helper is synchronous-IO, zero-dep, and safe to re-run." `openState(workdir)` roots every state file under the caller-supplied `workdir` (`checkpoint.blockers.json`, `checkpoint.teams.json`, `fight-counts.json`), and `loadKeys(workdir, ...)` persists signing keys under that same directory. A distinct `workdir` per customer per run is therefore a **hard isolation boundary today** — no shared mutable state exists across workdirs.
- **Resumability (RATCHET)** — `foldDefs`, `styxGenerateFiles`, and the checkpoint files mean a killed run costs only the unproven remainder.
- **Seat routing during a run** — `source/breakout/seat_router.mjs` + `source/build-gate/seat-registry.mjs`.
- **Long-lived loops** — `source/forge/operator.mjs`.

**Honest limit:** there is **no intake service, no run queue, and no worker-pool module in `source/` today.** A run is driven by invoking the ratchet/driver in a workdir. Any queue/worker/HTTP claim below is **HYPOTHESIS**.

### 2.2 Phase-2 topology — **HYPOTHESIS**

> **HYPOTHESIS.** The following queue-and-workers topology is *not deployed and not coded*. It is a design proposal to be validated. No module path is cited for it because none exists.

**Proposed topology (to be built):**

```
[submit manifest] --> intake --> validateManifest (EXISTS: source/forge/manifest.mjs)
                                      |
                                fail-closed reject / accept
                                      |
                                enqueue run  --> [run queue] (HYPOTHESIS)
                                      |
                     +----------------+----------------+
                     |                |                |
                 [worker]         [worker]         [worker]   (HYPOTHESIS)
                 mkdir per-customer workdir (isolation: EXISTS via ratchet)
                 drive ratchet.mjs (EXISTS)
                 route seats via seat_router.mjs (EXISTS)
                 emit signed ledger (EXISTS via merkle-dag)
```

**Stated assumptions:**
- A1: Each queued run gets a fresh, unique `workdir`; workers never share a `workdir`. (Leans on the *existing* ratchet isolation property.)
- A2: Seat backends are reachable from every worker via `seat-registry.mjs`.
- A3: Runs are idempotent under re-drive because ratchet checkpoints are safe to re-run.

**Falsifiable validation plan (Phase 2 exit criteria):**
- V1: Two concurrent runs on distinct workdirs produce byte-identical ledgers to their isolated single-run baselines (isolation holds).
- V2: A worker killed mid-run and re-dispatched resumes and settles only the unproven remainder — zero re-invocation of converged seats (verify `seat_calls`/`seat_call_breakdown` shows no re-fight; see §3).
- V3: A malformed manifest is rejected at intake by `validateManifest` before any workdir is created (fail-closed at the boundary).

(Blockers #2 and #4 resolved — orchestration cites the modules that exist, and the queue/worker topology is explicitly HYPOTHESIS with assumptions and a falsifiable validation plan.)

---

## 3. Metering

**The metering point already exists in the run summary schema.** `source/runs/demo-run-summary.json` emits two top-level fields per run:

- `seat_calls` — the integer count of billable council-seat invocations for the run (`"seat_calls": 0` in the cited demo, because every workstream re-settled from checkpoints).
- `seat_call_breakdown` — the per-seat map that itemizes those calls (`"seat_call_breakdown": {}` in the cited demo).

Because the doctrine in `source/forge/ratchet.mjs` never re-invokes a converged seat (STYX: `styxGenerateFiles` re-settles preserved artifacts from disk; the header: "a converged team's spec is FROZEN and its artifact PRESERVED; it never re-fights"), **`seat_call_breakdown` is a truthful, resume-aware meter**: resumed work is free, only genuine seat invocations are counted. Billing reads `seat_call_breakdown` (itemization) and `seat_calls` (total) directly from the run summary — no separate metering module is required or claimed.

**Metering invariant to preserve:** a re-driven run (V2 above) must not inflate `seat_calls`. This is the same property STYX already enforces in `source/forge/ratchet.mjs`.

---

## 4. API Surface — **HYPOTHESIS**

> **HYPOTHESIS.** No HTTP server, intake handler, SSE streamer, or bundle-fetch endpoint exists in `source/` today. The three operations below are the proposed surface; each names the *existing* module it would drive. No module path is cited as an implementing server because none exists yet.

| Op | Proposed endpoint | Drives (EXISTS) | Behavior |
|---|---|---|---|
| Submit manifest | `POST /v1/runs` | `validateManifest`, `defsFromManifest`, `dossierFromManifest` in `source/forge/manifest.mjs` | Fail-closed validation at the boundary; on accept, enqueue (queue = HYPOTHESIS §2.2). |
| Stream fight logs | `GET /v1/runs/{id}/logs` (SSE) | log output of `source/forge/ratchet.mjs` (`log` callbacks) and bout records | Server-sent-events stream of round/bout progress. |
| Fetch certified bundle | `GET /v1/runs/{id}/bundle` | signed merkle-dag ledger (keys via `source/merkle-dag/crypto.mjs`; re-verify via `reverifyRecord` in `source/breakout/verifier.mjs`) | Returns the signed, re-verifiable deliverable. |

**Assumptions:** the server is stateless per request and delegates all state to the per-run `workdir` (EXISTS isolation). **Validation plan:** a submitted valid manifest yields a run whose bundle re-verifies via `reverifyRecord`; a submitted invalid manifest returns the exact error list produced by `validateManifest` (fail-closed contract, unchanged).

(Blocker #3 resolved — the API surface is labeled HYPOTHESIS end-to-end, cites the existing modules it would drive, and states plainly that no server/intake/queue module exists.)

---

## 5. Tenancy — multi-tenant boundaries

### 5.1 Boundaries that EXIST today

- **Workdir = tenant boundary.** Every stateful helper in `source/forge/ratchet.mjs` is parameterized by `workdir` (`openState(workdir)`, `loadKeys(workdir, ...)`, `pinResearch(workdir, ...)`). One customer run = one workdir = one blast radius. No cross-workdir shared mutable state exists.
- **Per-run signing keys.** `loadKeys` persists a fresh keypair per workdir ("fresh keys would re-hash the plan and defeat resume"); one tenant's ledger cannot be signed with another tenant's keys.
- **Deliverable integrity.** `reverifyRecord` (`source/breakout/verifier.mjs`) lets a customer independently re-verify their signed bundle.

### 5.2 Seat-backend tenancy — a decision to argue (design)

Seats route today through `source/breakout/seat_router.mjs` against `source/build-gate/seat-registry.mjs` using **plugin backends** (see `source/runs/demo-run-summary.json` `transport`: "seat-router default (claude/agy_checkpoint via ai-peer-mcp; grok/gemini/codex via claude-plugins seat servers)").

**Design decision — pooled vs. customer-BYO API keys:**
- **Pooled keys (recommended default):** the operator holds provider credentials; `seat_call_breakdown` meters usage for billing. Pro: zero customer setup, uniform routing. Con: operator bears provider cost and must attribute it — mitigated because metering is per-run (§3).
- **Customer-BYO keys:** the tenant supplies provider credentials injected per-workdir. Pro: cost and rate-limit isolation, stronger data-handling story. Con: onboarding friction, per-tenant credential storage.
- **Argued position:** ship **pooled by default** (fastest onboarding, metering already solves attribution via `seat_call_breakdown`), offer **BYO as a per-tenant override** for enterprises needing cost/data isolation. The `seat-registry.mjs` indirection is the correct seam for a per-workdir credential source.

### 5.3 Boundary to build — **HYPOTHESIS**

> **HYPOTHESIS.** Tenant authentication, per-tenant workdir provisioning/quotas, and BYO-credential injection are **not coded** in `source/` today. They are Phase-2 items (below). The *isolation primitive* they build on (per-workdir state) already exists.

---

## 6. Phase 2 Work Items

Each item states what to build and its falsifiable exit criterion. None of these exist in `source/` today.

1. **Intake / HTTP server** implementing `POST /v1/runs` that calls `validateManifest` (EXISTS) before any workdir creation. *Exit:* invalid manifests rejected pre-workdir with the exact `validateManifest` error list (§2.2 V3).
2. **Run queue** decoupling submit from execution. *Exit:* backpressure holds under N queued runs; no dropped runs.
3. **Worker pool** that provisions a unique per-customer `workdir` and drives the ratchet. *Exit:* concurrent-run isolation (§2.2 V1) and kill/resume with zero re-fight (§2.2 V2).
4. **SSE fight-log streamer** wiring `source/forge/ratchet.mjs` `log` callbacks + bout records to `GET /v1/runs/{id}/logs`.
5. **Bundle-fetch endpoint** serving the signed merkle-dag ledger, re-verifiable via `reverifyRecord` (`source/breakout/verifier.mjs`).
6. **Billing reader** consuming `seat_calls` + `seat_call_breakdown` from the run summary (`source/runs/demo-run-summary.json` shape). *Exit:* re-driven run does not inflate `seat_calls`.
7. **Tenant auth + per-tenant quotas** on workdir provisioning.
8. **BYO-credential injection** through the `source/build-gate/seat-registry.mjs` seam (§5.2), pooled remaining the default.

---

*Every capability asserted to exist above cites a `source/` module path. Every not-yet-built capability is labeled HYPOTHESIS with assumptions and a falsifiable validation plan. The metering point is `seat_call_breakdown` (and `seat_calls`) in `source/runs/demo-run-summary.json`.*
