---
title: "Agentic Teams — Autonomous Builder"
type: contract
tags:
  - topic/agentic-teams
  - workflow/build-gate
---

# Agentic Teams — Autonomous Builder

This contract defines how TELOS turns an idea into merged software autonomously,
by composing its two existing halves — the **approval council** (`build-gate`) and
the **execution substrate** (`merkle-dag`) — through an **agentic-teams** layer.
It does **not** introduce a new trust model: every guarantee in the build-gate and
ledger contracts still holds. A team's self-report is never load-bearing.

## What a team is

A **team** is a named roster of model *seats* with a lifecycle role and an owned
workstream. A team is the missing organizing layer that says *who* does a unit of
work. Crucially, a build/verify team is just a **worker behind `runBuild`'s
`dispatch`** (`merkle-dag/orchestrate.mjs`): it sees only the node spec (Rule 1)
and its output is independently re-derived (Rule 3). So teams **propose**; the
deterministic substrate **disposes**.

The roster is data (`build-gate/teams.mjs`, `TEAMS`). Adding a model seat or a
team is a config edit plus a signer keypair + `TELOS_SECRET_*` — no trust bypass.

Each team's **lead is its strongest model** (see `build-gate/model-profiles.mjs`; a
test asserts every lead's role is in that model's `preferred_roles`), paired with a
complementary member so the composition itself encodes the collaboration.

| Team | Lead (why) | Lifecycle | Workstream | Mission |
|---|---|---|---|---|
| planning | claude (careful long-horizon design) | plan | — | decompose idea+telos into a content-addressed task DAG |
| architecture | claude | build | product-architecture | system shape, boundaries, file footprints |
| backend | codex (precise code-gen) | build | backend-schema | data model, services, migrations |
| frontend | claude (UX / brand voice) | build | frontend-brand-experience | UI / LEXI-class brand experience |
| evals | codex (tests = code-gen + strict output) | verify | accuracy-evals | acceptance tests that decide a node's `meets` verdict |
| security | grok (adversarial + threat intel) | verify | security-trust | threat model, secrets hygiene, abuse cases |
| ops | agy (deterministic gating) | verify | scale-operations | deploy, scale, rollback readiness |
| business | grok (live market intel) | plan | business-positioning | thesis, differentiation, market positioning |
| breakout | grok (adversary) | verify | — | adversarial verdict-on-facts; gate of last resort |
| integrity | gemini (independent verification) | verify | — | re-derive facts, cross-check claims |

Each seat also speaks its provider's **native structured-output** dialect (OpenAI/xAI
`json_schema`, Anthropic forced tool-use, Gemini `responseSchema`) for the shared JSON
contracts in `build-gate/schemas.mjs`, and is prompted in the mode it does best
(`teamPrompts.mjs` `profileFor`). This is reliability, not trust — the gate still
re-validates shape, injects identity from the dossier, and binds provenance to the
real API response.

## Dynamic sizing (from the dossier)

`planTeams(dossier)` is the team analogue of `planSeats(dossier)`:

- The meta backbone — **planning, architecture, breakout** — convenes for every job.
- A **market-bound** job additionally convenes one team per entry in
  `required_market_workstreams` (deduped by id).

So the team count is a function of the job, not a fixed roster.

## The lifecycle (fail-closed sequencing)

*Amended by `contracts/Proposal Lifecycle.md`: candidate compilation and writing
precede council review, and the council reviews the exact written plan hash.*

```
idea + telos
  → [planning] decompose() / Daedalus negotiation → tasks[] {id,writes,reads,requirements,test,workstream}
  → compileAndHashPlan() → content-addressed plan (+ authorized_signers); writePlan()
        the immutable candidate is on disk BEFORE any review
  → COUNCIL REVIEW of the exact candidate plan hash (recomputed from the written
        plan on disk): runCouncil → validateRecords
  → proposal authorization gate                              [MUST pass before execution]
  → runBuild(): re-verifies the written plan hash, then each ready node is
        dispatched to its OWNING TEAM (team = worker)
        Rule 1 — the team sees only the node spec; it writes the node's files
  → Rule 3 defaultVerifyNode re-derives the artifact hash + runs node.test
  → [breakout] reverifyRecord on declarative checks for "meets"-class nodes
  → settle: the controller (sole writer) signs the Ed25519 ledger record
  → ledger-gate.verify() done() → merge_status:"ready"
  → merge
```

The orchestrator (`build-gate/build-orchestrator.mjs`, `buildProject`) STOPS at the
first failing phase and **never advances to execution unless the proposal
authorization gate passed** (council approval is a necessary input to that gate,
never sufficient by itself). The target phase order is:

```text
situation | decompose | plan | approval | build
```

**Nonconformance note.** Earlier revisions of this contract were internally
contradictory: the lifecycle above declared compile-before-approval while the
phase list read `situation | decompose | approval | plan | build`. The code in
`build-gate/build-orchestrator.mjs` currently implements the latter (council
review before `compileAndHashPlan()`), which means the council does not yet
review the exact plan hash it authorizes. That implementation is **temporarily
nonconforming** with this contract and with `contracts/Proposal Lifecycle.md`;
the reorder is a required implementation point of the proposal-lifecycle
contract, not an optional cleanup.

## Situational awareness

The builder senses its context instead of running blind, across two senses
(`build-gate/situation.mjs`, `build-gate/test-runner.mjs`):

- **Project sense (pre-flight, read-only).** `senseProject({baseDir, dossier, tasks})`
  reads the real `baseDir`: greenfield vs brownfield, **write-target collisions**
  (reusing the substrate's `computeDiskTreeHash`), the project's **real test
  command** (`package.json scripts.test` — threaded into the Planning team's
  decompose prompt so autonomous tasks prefer it), and which **protected paths**
  exist on disk. Collisions are **advisory**, not a new blocker: Rule 3 still
  re-derives every artifact and the gate's `validateProtectedPaths` is still the
  authority on protected writes. Opt-in `dossier.block_on_collision` gives
  greenfield-only enforcement.
- **Runtime adaptation (during the build).** After a team writes its node's files,
  the dispatch runs the node's **own** test (capturing stdout/stderr) and, on
  failure, **re-calls the team with that failure detail** so it self-corrects —
  up to `adaptAttempts` (default 2). If the inner loop exhausts, it returns a
  `respec` so the substrate's existing `halt → mutateNode → re-dispatch` gives a
  second, outer adaptation level. The team only ever learns about its **own node's
  own prior failure** (Rule 1 intact), and `defaultVerifyNode` still independently
  re-verifies (Rule 3) — a team can never self-certify.

## Invariants (must not weaken)

- **Routing by id, not by reading the node.** Rule 1 strips `workstream` from the
  dispatched spec, so each node's owning team is decided *before* the build (from
  the task list) and looked up by id at dispatch time.
- **Verification stays in `verifyNode`.** The dispatch never certifies its own
  work; `defaultVerifyNode` re-derives the artifact tree-hash and runs the node
  test. A team that writes nothing, or fails its test, does not settle.
- **The controller is the sole ledger writer.** A team's `signer` key_id must be
  in `plan.authorized_signers` (pinned into `plan_hash`) or the ledger gate
  rejects the settlement.
- **Path confinement.** A team may only write its node's declared files, under
  `baseDir`; escapes are rejected before any write.
- **Decomposition is non-load-bearing.** The Planning team's task list is
  re-hashed by the planner and must still survive the approval gate and Rule-3
  verify — a fabricated decomposition cannot reach merge.

## Live wiring (opt-in)

`build-gate/teamPrompts.mjs` builds the full live path over `ai-peer-mcp`:
`makeLiveCallSeat` (approval via `approvalPromptFor` + `parseApprovalPacket`, and
live decomposition via `decomposePrompt` + `parseDecomposeTasks`) and
`makeLiveCallTeam` (execution — each team's lead emits `{files:[...]}` clamped to
the node's declared files). `parseApprovalPacket` injects identity fields from the
dossier and keeps only the model's judgment, so a sloppy model can't fail the
gate's identity checks or fabricate an approve. As with the council, a seat with
no API key fail-closes — the gate honest-blocks at approval.

A runnable end-to-end entry point lives at
`docs/runs/agentic-teams-live/run-teams-live.mjs` (see its README): with API keys
it runs real approvals + real team builds to `merge_status: "ready"`; without
them it fail-closes, which the committed `run-summary.json` records.

## Evidence

Two keyless, reproducible end-to-end runs (deterministic mock seats over the real
gate, real Ed25519 ledger, and real merkle-dag substrate), each reaching
`merge_status: "ready"`:

- `docs/runs/agentic-teams/` (`run-teams.mjs`) — a non-market build (the meta
  backbone convenes; nodes route to the architecture team).
- `docs/runs/agentic-teams-market/` (`run-teams-market.mjs`) — a **market-bound**
  build with the **full multi-team fan-out**: all nine teams convene, nodes route
  to distinct teams (backend, frontend, security, ops), each settling under its
  own signer, and the market-readiness gate — including the frontend `meets`
  breakout re-verify against an on-disk evidence file — stays load-bearing.
- `docs/runs/agentic-teams-situational/` (`run-teams-situational.mjs`) — a
  **brownfield** build where project sense reports the collision + the real
  `node --test` command, and a team **self-corrects** after its own node test
  fails (runtime adaptation), reaching `ready` with the corrected artifact.
