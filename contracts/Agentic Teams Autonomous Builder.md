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

| Team | Lifecycle | Workstream | Mission |
|---|---|---|---|
| planning | plan | — | decompose idea+telos into a content-addressed task DAG |
| architecture | build | product-architecture | system shape, boundaries, file footprints |
| backend | build | backend-schema | data model, services, migrations |
| frontend | build | frontend-brand-experience | UI / LEXI-class brand experience |
| evals | verify | accuracy-evals | acceptance tests that decide a node's `meets` verdict |
| security | verify | security-trust | threat model, secrets hygiene, abuse cases |
| ops | verify | scale-operations | deploy, scale, rollback readiness |
| business | plan | business-positioning | thesis, differentiation, market positioning |
| breakout | verify | — | adversarial verdict-on-facts; gate of last resort |

## Dynamic sizing (from the dossier)

`planTeams(dossier)` is the team analogue of `planSeats(dossier)`:

- The meta backbone — **planning, architecture, breakout** — convenes for every job.
- A **market-bound** job additionally convenes one team per entry in
  `required_market_workstreams` (deduped by id).

So the team count is a function of the job, not a fixed roster.

## The lifecycle (fail-closed sequencing)

```
idea + telos
  → [planning] decompose() → tasks[] {id,writes,reads,requirements,test,workstream}
  → compileAndHashPlan() → content-addressed plan (+ authorized_signers); writePlan()
  → COUNCIL APPROVAL GATE: runCouncil → validateRecords      [MUST pass before execution]
  → runBuild(): each ready node dispatched to its OWNING TEAM (team = worker)
        Rule 1 — the team sees only the node spec; it writes the node's files
  → Rule 3 defaultVerifyNode re-derives the artifact hash + runs node.test
  → [breakout] reverifyRecord on declarative checks for "meets"-class nodes
  → settle: the controller (sole writer) signs the Ed25519 ledger record
  → ledger-gate.verify() done() → merge_status:"ready"
  → merge
```

The orchestrator (`build-gate/build-orchestrator.mjs`, `buildProject`) STOPS at the
first failing phase and **never advances to execution unless the council approval
gate passed**. The phases it reports: `decompose | approval | plan | build`.

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

`build-gate/teamPrompts.mjs` builds the live `callSeat` (approval, via
`liveSeatCaller` + `approvalPromptFor`) and `callTeam` (execution, via
`makeLiveCallTeam`) over `ai-peer-mcp`. Each team gets its own system prompt;
build seats are asked to emit `{files:[...]}` clamped to the node's declared
files. As with the council, a seat with no API key fail-closes.

## Evidence

`docs/runs/agentic-teams/` contains a keyless, reproducible end-to-end run
(`run-teams.mjs` → `run-summary.json`): deterministic mock seats over the real
gate, real Ed25519 ledger, and real merkle-dag substrate, reaching
`merge_status: "ready"`.
