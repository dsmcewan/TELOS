---
title: "TELOS — build orchestrator code trace"
type: reference
tags:
  - topic/architecture
  - topic/agentic-teams
  - workflow/build-gate
---

# TELOS — build orchestrator code trace

A maintainer's line-level trace of `build-gate/build-orchestrator.mjs` (232 lines): what
`buildProject` does in what order, which module owns each decision, where disk is written, where a
team's output is re-derived, and what the shipped tests actually prove. It is the deep companion to
§3.1 of `docs/repository-code-trace.md`, which covers the same entry point in one table.

Every claim was read from source on `main` at commit `0c9b539` (2026-09-23). `file:line` references
point at that revision. Verified on Node 22.22.2:

| Check | Result |
|---|---|
| `node --check build-gate/build-orchestrator.mjs` | ok |
| `node build-gate/scripts/test-build-orchestrator.mjs` | 13 cases OK (1.5 s) |
| `node build-gate/scripts/test-runtime-adaptation.mjs` | OK (0.7 s) |
| `cd build-gate && npm test` (runs `breakout` too) | exit 0 |
| probe: legacy advisory build (see F1, F2) | `ok:true`, `certified:false`, node test ran 3× |

## 1. Where it sits

```
 build-gate/build-orchestrator.mjs            (this file: 3 exports)
 ├── makeTeamDispatch   :52   the runBuild `dispatch` worker adapter (team = worker)
 ├── makeTeamKeyring    :113  ephemeral Ed25519 keypair per team signer
 └── buildProject       :143  the autonomous entry point

 imports (build-gate/)                          imports (merkle-dag/)
   council.mjs      runCouncil                    planner.mjs     compileAndHashPlan
   gate.mjs         validateRecords               orchestrate.mjs runBuild, defaultVerifyNode
   teams.mjs        planTeams, teamForNode,       merkle.mjs      writePlan
                    authorizedSignersFor          crypto.mjs      generateKeypair
   decompose.mjs    decompose                     vendor.mjs      resolveUnder
   situation.mjs    senseProject, detectConventions
   test-runner.mjs  runNodeTest
   proposal-orchestrator.mjs  runProposalLifecycle   (cycle: it imports makeTeamDispatch back, :25)
```

Callers (static fan-in):

| Caller | Uses | Mode |
|---|---|---|
| `build-gate/scripts/test-build-orchestrator.mjs:12` | `buildProject`, `makeTeamDispatch`, `makeTeamKeyring` | keyless, advisory |
| `build-gate/scripts/test-runtime-adaptation.mjs:12` | same three | keyless, advisory |
| `build-gate/scripts/test-proposal-orchestrator.mjs:9` | `buildProject`, `makeTeamKeyring` | lifecycle |
| `build-gate/proposal-orchestrator.mjs:25` | `makeTeamDispatch` only (`:312`) | lifecycle execution |
| `docs/runs/agentic-teams/run-teams.mjs:15` | `buildProject`, `makeTeamKeyring` | keyless evidence, advisory |
| `docs/runs/agentic-teams-{market,situational,live,plugin-seats}/*.mjs` | `buildProject` (+ `makeLiveCallSeat`/`makeLiveCallTeam` for the two live ones) | evidence |
| `docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs:20` | `buildProject` with `proposal_lifecycle:true` | lifecycle evidence |

No product package (`forge/`, `saas-forge/`, `ai-forge/`) imports it; the products call the gate
directly. The only live (API-keyed) wiring is `build-gate/teamPrompts.mjs` (`makeLiveCallSeat :302`,
`makeLiveCallTeam :105`), which is injected, never imported here.

## 2. `buildProject` — the phase machine, line by line

Signature (`:143`):

```
buildProject({ dossier, telos, tasks, callSeat, callTeam, callWorkshopSeat, callParallelSeat,
               keyring, signerFor, baseDir, telosDir, marketPackets = [], source,
               maxRepairRounds = 8, adaptAttempts = 2, concurrency, nowMs = 0, maxRevisions })
```

`callWorkshopSeat`, `callParallelSeat`, `nowMs` and `maxRevisions` are pass-through to the
proposal-lifecycle path only; the legacy path never reads them.

### 2.1 Phase order as shipped

```
 :144  planTeams(dossier)                       teams.mjs:63     pure; roster from dossier
 :148  detectConventions({ baseDir })           situation.mjs:35  reads baseDir/package.json (confined)
 :153  tasks ?? decompose(...)                  decompose.mjs:43  ─┐ throws → phase "decompose"  :155
 :162  senseProject({ baseDir, dossier, tasks}) situation.mjs:72  │ read-only; collisions advisory
 :163  block_on_collision && collisions>0       ───────────────── │ → phase "situation"          :164
 :170  proposal_lifecycle === true              ───────────────── │ → return runProposalLifecycle :171
 :181  authorizedSignersFor(teams, keyring)     teams.mjs:97      │
 :182  compileAndHashPlan({tasks, signers, repoRoot: baseDir})    │ planner.mjs:42; errors → "plan" :184
 :186  writePlan(telosDir, plan)                merkle.mjs:176    │ FIRST DISK WRITE: plan.json + plans/<hash>.json
 :195  runCouncil({ callSeat, dossier, context }) council.mjs:92  │ context is always null here (F4)
 :196  packets = ok results' packets                              │
 :198  validateRecords(dossier, packets, source, [], marketPackets) gate.mjs:107
 :199  blockers.length > 0                      ───────────────── │ → phase "approval"           :200
 :205  nodeTeam = Map(task.id → teamForNode)    teams.mjs:81      │ decided BEFORE Rule 1 strips `workstream`
 :210  runBuild({ dispatch: makeTeamDispatch(...), verifyNode: defaultVerifyNode,
                  signerFor, maxRounds: maxRepairRounds, concurrency, authorizedPlanHash })
 :221  return { phase:"build", ok: report.merge_status === "ready", report, trace, council, plan,
                advisories, situation, teams }
```

The effective order is therefore **decompose → situation → (lifecycle branch) → plan → approval →
build**. The contract (`contracts/Agentic Teams Autonomous Builder.md:91-93`) lists it as
`situation | decompose | plan | approval | build`; the difference is only that `senseProject` needs
the task list to know its write targets, so the full situation report is computed after
decomposition while the conventions half (`detectConventions`) runs before it. The docstring at
`:141` still lists `"decompose"|"approval"|"plan"|"build"`, which is both missing `situation` and in
the pre-reorder order (F3).

### 2.2 What each phase can return

| `phase` | Line | `ok` | Fields | Disk state on exit |
|---|---|---|---|---|
| `decompose` | `:155` | false | `blocked:[message]`, `teams`, `situation` (sensed with `tasks: []`) | nothing written |
| `situation` | `:164` | false | `blocked:[…per collision]`, `situation`, `teams` | nothing written |
| `plan` | `:184` | false | `blocked: compiled.errors`, `advisories`, `teams`, `situation` | nothing written |
| `approval` | `:200` | false | `blocked: report.blockers`, `council: report`, `teams`, `situation`, `plan` | **`plan.json` exists**, no ledger |
| `build` | `:221` | `merge_status === "ready"` | `report`, `trace`, `council`, `plan`, `advisories`, `situation`, `teams` | plan + `ledger.jsonl` (+ `plan-history.jsonl` on respec) |
| lifecycle path | `proposal-orchestrator.mjs:316-320` | varies | adds `decision`, and `error`/`detail` on a runBuild refusal | see `docs/proposal-lifecycle-implementation.md` |

"Plan written before approval" is deliberate (contract Required Point 1: the council reviews the
exact hash it authorizes) and is asserted by the test at `test-build-orchestrator.mjs:101`.
The load-bearing fail-closed guarantee is **no ledger entry before approval**, asserted at `:102`.

### 2.3 Inputs the phases trust, and what re-derives them

| Input | Trusted for | Re-derived by |
|---|---|---|
| `tasks` (hand-authored) or Planning-team output | dependency graph, `test` commands, `workstream` routing | `compileAndHashPlan` re-hashes every spec; `decompose.mjs:15-20` drops tasks lacking id/writes/requirements/test.cmd and throws on duplicates (`:63`) |
| `dossier` | `build_id`/`use_case` binding, `trust_mode`, `market_bound`, `required_market_workstreams`, `write_targets`, `protected_paths`, `block_on_collision`, `proposal_lifecycle` | `validateDossierShape` (`gate.mjs:111`); protected paths via `validateProtectedPaths` (`gate.mjs:667`) |
| `callSeat` packets | nothing — only signed+provenanced packets count in signed mode | `validateRecords` steps 4-8 (`gate.mjs:147-255`) |
| `callTeam` files | nothing — advisory pre-flight only | `makeTeamDispatch` clamps paths; `defaultVerifyNode` re-hashes + re-runs the test; `ledger-gate.verify` does it a third time |
| `keyring` / `signerFor` | which key ids may settle a node | pinned into `plan_hash` (`merkle.mjs:132-137`); `ledger-gate.mjs:47-49` rejects unknown/invalid signers |

## 3. `makeTeamDispatch` — the worker adapter (`:52-105`)

`runBuild` calls `dispatch(injected)` with exactly `{ id, requirements, files, test, effective_hash }`
(`orchestrate.mjs:150-156`, Rule 1). The adapter:

1. `:54` `routeFor(injected.id)` — the owning team, precomputed at `:205` from the original task list
   because `workstream` is not in the injected spec. Fallback (`:206`, `teams.mjs:88`): first
   `lifecycle:"build"` team in the roster, else `roster[0]`.
2. `:57` inner loop `attempt = 1..maxAttempts` (`adaptAttempts`, default 2):
   - `:60` `callTeam({ team, node, dossier, attempt, priorFailure })`. A throw → `{ ok:false,
     reason:"team … threw" }` (`:62`); `ok:false` → pass through `reason` and the team's own
     `respec` (`:65`).
   - `:74-78` `declared` = the node's `files` resolved with `resolveUnder(baseDir, rel)`
     (`vendor.mjs:58`: rejects absolute paths, any symlinked component, anything resolving outside
     `baseDir`; missing trailing components are allowed).
   - `:79-88` per returned file: malformed → reject; escape → reject; **not in `declared` → reject**
     (added in #64, `be5796d`, closing the `.telos/` control-plane write); `mkdirSync` the parent;
     **re-resolve after mkdir** (added in #133, `0cfb280`, so a directory created by this very call
     cannot have been swapped for a link) and write only if the two resolutions agree.
   - `:91` `runNodeTest(injected, baseDir)` (`test-runner.mjs:28`): spawn `test.cmd` in a confined
     cwd, capture stdio tails (800 chars), 60 s timeout, never throws.
   - `:92` pass → `{ ok:true, signer: team.signer || team.id }`. The signer string is what `runOne`
     passes to `signerFor` (`orchestrate.mjs:170-175`).
   - `:93` fail → `priorFailure = { detail, stdout, stderr, status }` for the next attempt. Only the
     node's own failure is fed back (Rule 1 intact).
3. `:97-103` exhausted → `{ ok:false, reason, respec:{ requirements: original + "[adaptation] prior
   test failure: …" } }`. `runBuild` turns a `respec` into `mutateNode` + `writePlan` +
   `appendPlanHistory` (`orchestrate.mjs:264-268`); the node's `spec_hash` and `effective_hash`
   change, so `readySet` re-dispatches it next round. That is the outer adaptation level.

The adapter never touches `.telos/`: the controller (`runBuild`) is the sole ledger writer
(`crypto.mjs:39-50`, wx-lock + fsync).

### 3.1 Test coverage of the adapter

| Behaviour | Test |
|---|---|
| `../escape.txt` rejected | `test-build-orchestrator.mjs:163` |
| symlink/junction component rejected, nothing lands outside | `:182` |
| undeclared `.telos/ledger.jsonl` write rejected | `:185-205` |
| decline passes `respec` through | `:208-220` |
| self-correct on attempt 2 with `priorFailure` | `test-runtime-adaptation.mjs:64-82` |
| exhaustion hands a `respec` up | `:84-93` |
| two-level adaptation reaches `ready` via `buildProject` | `:95-112` |
| team's own runner passes but Rule 3 fails → never settles | `:114-132` |

Not covered by a test: the re-resolve-after-mkdir branch at `:85-86` (both tests that exercise
escapes fail earlier, at `:82`); a `callTeam` that throws (`:61-63`); a `team` of `undefined` from
`routeFor` (the `team?.id` at `:62,:65` tolerates it, the `team.id` at `:80-86` and `team.signer` at
`:92` would throw, which `runOne` catches into a halt at `orchestrate.mjs:158`).

## 4. `makeTeamKeyring` (`:113-125`)

One `generateKeypair()` (`crypto.mjs:7`, Ed25519 pkcs8/JWK) per distinct `team.signer || team.id`
in the roster (defaults to `planTeams({})` when none given). Returns `{ keyring: {key_id: jwk},
signerFor: key_id → pem }`. Keys are ephemeral per process by design (`:110-112`); nothing persists
them, so `plan_hash` differs every run (`docs/runs/agentic-teams/run-teams.mjs:65-66` omits it from
evidence for that reason). `authorizedSignersFor` (`teams.mjs:97`) then pins only signers present
in `keyring`, so a team without a key can never settle a node (`UNKNOWN_SIGNER` at the ledger gate).

## 5. The execution half, as reached from here

`runBuild` (`orchestrate.mjs:190`) with the legacy arguments:

1. `:193` `readPlan(telosDir)` — reads back the plan `buildProject` just wrote.
2. `:202-206` `authorizedPlanHash` check: `recompute(plan)`, refuse `PLAN_INVALID` / `PLAN_TAMPERED`
   / `PLAN_HASH_MISMATCH`. These return `{ error, detail, trace }` **without `report`** (F5).
3. `:212` ledger seeded once into memory; `:214` rounds up to `maxRounds` (= `maxRepairRounds`,
   default 8 here vs 1000 in `runBuild` itself).
4. Per round: `recompute` → `readySet` (`:68`: unsettled nodes whose every dependency is
   settled-valid) → write-disjoint batch (`:225-232`) → critical-path sort (`:236-237`) → bounded
   pool `maxConcurrency(concurrency)` (`vendor.mjs:41`, clamped to `[1, cores-2]`) running `runOne`.
5. `runOne` (`:148`): dispatch (§3) → `defaultVerifyNode` (`:121`: `computeDiskTreeHash` of the
   declared files, reject escapes, re-run `test.cmd` with a 60 s timeout) → `makeRecord` signed with
   `signerFor(signer)`.
6. Outcomes applied serially (`:256-274`): `settle` → `appendLedger`; `halt` with `respec` →
   `mutateNode` (`MUTATE_FAILED` also returns without `report`); `verify-failed` → trace only.
   `:275` no progress → stop.
7. `:278` `verify(telosDir, { baseDir })` (`ledger-gate.mjs:13`) is the returned `report`: per node
   ledger → lineage → signature → artifact hash → **test run again** → obligations. `merge_status`
   is `ready` only with zero blockers and zero undischarged obligations (`:94-99`).

## 6. Findings

**F1 — `ok:true` is not "certified".** `:223` sets `ok` from `report.merge_status === "ready"`
alone. In the legacy path with `trust_mode:"advisory"` the council gate cannot block on signatures,
so `buildProject` returns `ok:true` while `result.council.certified === false` and
`safe_next_action === "advisory-only-NOT-certified-do-not-merge"` (`gate.mjs:287-300`). Reproduced
with the probe in the table above. Every shipped test and every `docs/runs/agentic-teams*` evidence
script runs in advisory mode (`test-build-orchestrator.mjs:23`, `examples/agentic-teams/dossier.json`),
and `run-summary.json` reports `"ok": true` with `"council_pass": true` — both accurate, neither
meaning certified. A consumer that reads only `ok` gets the ledger verdict, not the trust verdict.
Cheap fix: `ok: build.report.merge_status === "ready" && report.certified`, or surface `certified`
at the top level; the lifecycle path already carries `decision` for the same purpose.

**F2 — Each node's test runs three times on the happy path.** `makeTeamDispatch :91`
(`runNodeTest`), `defaultVerifyNode` (`orchestrate.mjs:128`) and `ledger-gate.verify`
(`ledger-gate.mjs:64`) each spawn `test.cmd`. Confirmed by the probe (counter file written 3×). This is
by design (advisory pre-flight, Rule-3 handshake, pure done() gate) and each is independently
justified, but a slow or non-idempotent node test costs 3× and a flaky one can settle at step two and
block at step three with `TEST_FAILED`, leaving a signed ledger entry for a node the report calls
blocked. Worth stating in the contract; nothing here is unsafe.

**F3 — Stale docstring.** `:137-141` documents the phases as `"decompose"|"approval"|"plan"|"build"`.
The shipped set is `decompose | situation | plan | approval | build` (plus the lifecycle path's
`build` with `error`). The `situation` phase has existed since #13 (`7378804`, 2026-06-28); the
plan-before-approval order since M4 (`947e3ed`, 2026-07-14).

**F4 — Dead lifecycle branches on the legacy path** (already F7 in `docs/repository-code-trace.md`).
`:170` returns for `proposal_lifecycle === true`, so `councilContext` (`:192-194`) is always `null`
and `gateSource` (`:197`) is always `source || {}`. Eight lines and two comments describe a mode the
function can no longer be in at that point.

**F5 — A `runBuild` refusal would throw, not return a phase.** `runBuild` returns `{ error, detail,
trace }` with no `report` for `PLAN_INVALID`, `PLAN_TAMPERED`, `PLAN_HASH_MISMATCH` (`orchestrate.mjs:204-206`)
and `MUTATE_FAILED` (`:266`). `:223` dereferences `build.report.merge_status` unconditionally, so any
of them surfaces as a `TypeError` from `buildProject` rather than `{ phase:"build", ok:false, error }`.
`proposal-orchestrator.mjs:316` handles the same case correctly. Reachability from the shipped
adapter is low: the plan was written at `:186` and read at `orchestrate.mjs:193` in the same process,
and the adapter's `respec` only rewrites `requirements`, which cannot fail `computePlan`. A
`callTeam` that returns its own `respec` with a changed `test` on a plan carrying obligations could
hit `MUTATE_FAILED`, but obligations exist only on the lifecycle path. A one-line guard mirroring
`proposal-orchestrator.mjs:316` closes it.

**F6 — Capability packets are never supplied.** `:198` passes `[]` for `capabilityPackets`. A dossier
that declares required capabilities would block at `approval` on every run through this entry point
(`gate.mjs:564-636`). No shipped dossier or test does, so this is a limitation to document rather
than a bug.

## 7. Lineage of the file

Seven commits on `main` touch `build-gate/build-orchestrator.mjs`:

| Date | Commit | PR | Change to this file |
|---|---|---|---|
| 2026-06-28 | `17bffa6` | #11 | Created (160 lines): decompose → council gate → plan → `runBuild` with team dispatch |
| 2026-06-28 | `7378804` | #13 | +66/−27: `senseProject`/`detectConventions` wiring, `block_on_collision`, inner adaptation loop, `respec` on exhaustion |
| 2026-07-01 | `be5796d` | #64 | +12: clamp writes to the node's declared files (control-plane write hole) |
| 2026-07-14 | `947e3ed` | merged via #83 | +22/−15: compile + `writePlan` moved **before** council review; `councilContext`/`gateSource` for lifecycle mode |
| 2026-07-15 | `0901c66` | #84 | +13/−1: delegate to `runProposalLifecycle` when `proposal_lifecycle === true` |
| 2026-07-16 | `2e530b2` | #99 | +2/−2: thread `callParallelSeat` through |
| 2026-07-19 | `0cfb280` | #133 | +3/−1: re-resolve the path after `mkdirSync` before writing |

Open on GitHub at the time of tracing: PR #193 (`docs: repository code trace`, which this document
extends) and PR #192 (`WIP: per-node verify stage`, which would change §5 step 5 if merged).

## 8. Reading order

1. `contracts/Agentic Teams Autonomous Builder.md` (lifecycle diagram, invariants).
2. `build-gate/build-orchestrator.mjs:143-232`, then `:52-105`.
3. `merkle-dag/orchestrate.mjs:148-180` (`runOne`) and `:190-279` (`runBuild`).
4. `merkle-dag/ledger-gate.mjs:13-100` (what `ok` actually measures).
5. `build-gate/scripts/test-build-orchestrator.mjs` top to bottom; then run
   `node docs/runs/agentic-teams/run-teams.mjs` and compare with `run-summary.json`.
