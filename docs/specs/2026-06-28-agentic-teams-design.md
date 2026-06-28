---
title: "Agentic Teams — Autonomous Builder (design)"
author: claude-code
date: 2026-06-28
type: spec
tags:
  - topic/agentic-teams
  - workflow/build-gate
---

# Agentic Teams — Autonomous Builder (design)

## Problem

TELOS had two halves that were never composed: the **approval council**
(`build-gate/council.mjs` → `gate.mjs`) that only *approves*, and the **execution
substrate** (`merkle-dag/`) that *executes* anonymous worker nodes. There was no
notion of *who* builds, and no single pipeline from idea to merged software. Goal:
an **autonomous builder** driven by **agentic teams**, without weakening any
fail-closed guarantee.

## Key insight

A build/verify team **is** a `runBuild` worker. `merkle-dag/orchestrate.mjs`
already injects `dispatch(injected)` where the worker sees only the node spec
(Rule 1), and `defaultVerifyNode` independently re-derives the artifact tree-hash
and runs the node test (Rule 3). So the teams layer is a thin **composition**
module — not a new engine — and a team's self-report cannot satisfy the gate.

## Modules added (all in `build-gate/`, zero new deps, ESM, `node:` stdlib only)

- **`teams.mjs`** — `TEAMS` roster (data); `planTeams(dossier)` (dossier-sized,
  mirrors `planSeats`); `teamForNode(node, teams)` (explicit-`workstream` routing);
  `authorizedSignersFor(teams, keyring)` (pins team signers into `plan_hash`).
- **`decompose.mjs`** — `decompose({dossier, telos, callSeat})`: the Planning team
  proposes a normalized, validated `tasks[]`. Data only; fail-closed on empty /
  duplicate / malformed.
- **`build-orchestrator.mjs`** — `buildProject(...)` composes the two halves with
  fail-closed sequencing (approval gate before execution); `makeTeamDispatch(...)`
  routes by id and lets a team write its node's files (verify stays in
  `verifyNode`); `makeTeamKeyring(teams)` mints per-signer Ed25519 keypairs.
- **`teamPrompts.mjs`** — live wiring over `ai-peer-mcp`: `makeLiveCallSeat`
  (approval council + live decompose) and `makeLiveCallTeam` (build execution),
  plus pure prompt/parse helpers (`approvalPromptFor`, `parseApprovalPacket`,
  `decomposePrompt`, `parseDecomposeTasks`, `promptForTeam`, `nodeBuildPrompt`,
  `parseTeamFiles`, `buildableSeat`, `extractJson`). The runnable entry point is
  `docs/runs/agentic-teams-live/run-teams-live.mjs`.

Reused unchanged: `council.mjs`, `gate.mjs`, `sign.mjs`, all of `merkle-dag/`,
`breakout/verifier.mjs`.

## Critical design decisions

1. **Route by node id, not by reading the node.** Rule 1 strips `workstream` from
   the dispatched spec and `compileAndHashPlan` drops it from the persisted node.
   So `buildProject` precomputes `id → team` from the task list (which still
   carries `workstream`) and `makeTeamDispatch` looks up by `injected.id`. This
   preserves the spec-injection boundary.
2. **Approval gate is on the build, before any plan is written or executed.**
   `validateRecords(dossier, packets)` must pass first; a `revise`/`reject` leaves
   no plan and no ledger.
3. **Market-bound builds still demand market-readiness evidence.** `buildProject`
   passes `marketPackets` straight to the gate, so the gate stays load-bearing for
   market-bound jobs (no weakening to make teams "pass").
4. **Open roster.** Seats are arbitrary model strings; a new seat/team is a `TEAMS`
   row + a signer keypair + `TELOS_SECRET_*`.

## Tests (all under `build-gate/scripts/`, registered in `package.json`)

- `test-teams.mjs` — roster shape, dossier sizing, deterministic routing, signer
  collection (fail-closed when a key is absent).
- `test-decompose.mjs` — extraction/normalization, invalid/empty/duplicate fail-closed.
- `test-build-orchestrator.mjs` — keyless end-to-end to `merge_status:"ready"`;
  approval `revise` blocks before execution (no plan/ledger); autonomous decompose
  path; Rule-3 verify is load-bearing (failing node never settles); dispatch path-
  escape rejection; respec passthrough.
- `test-team-prompts.mjs` — pure live-wiring helpers + fake-client `callTeam` round-trip.

## Evidence

- `docs/runs/agentic-teams/run-teams.mjs` → `run-summary.json`: keyless non-market
  run reaching `merge_status: "ready"` with both nodes settled and signed.
- `docs/runs/agentic-teams-market/run-teams-market.mjs` → `run-summary.json`:
  keyless **market-bound full fan-out** — nine teams convened, nodes routed to
  distinct teams (backend/frontend/security/ops) each settling under its own
  signer, market-readiness gate + frontend `meets` breakout re-verify passing,
  reaching `merge_status: "ready"`. Covered hermetically by two cases in
  `test-build-orchestrator.mjs` (full fan-out → ready; missing-workstream → blocked).

## Verification

```
cd build-gate && npm test     # gate, sign, trust, council, teams, decompose,
                              # build-orchestrator, team-prompts, stress×2, + breakout
cd merkle-dag && npm test     # unchanged substrate still green
node docs/runs/agentic-teams/run-teams.mjs   # end-to-end evidence -> ready
```
