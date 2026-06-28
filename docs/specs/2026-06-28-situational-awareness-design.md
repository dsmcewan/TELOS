---
title: "Situational Awareness — Project Sense + Runtime Adaptation (design)"
author: claude-code
date: 2026-06-28
type: spec
tags:
  - topic/agentic-teams
  - workflow/build-gate
---

# Situational Awareness — Project Sense + Runtime Adaptation (design)

## Problem

`buildProject` was **blind**: hand it a dossier + tasks and it runs, discovering
problems only at the gate. It should *sense its context* and adapt — scoped to two
senses: **project sense** (read the real project before building) and **runtime
adaptation** (teams self-correct on test failure during the build). Constraint:
keep the load-bearing `merkle-dag` substrate **pure** — both capabilities live in
`build-gate/`.

## Capability 1 — Project sense (`build-gate/situation.mjs`, pure)

`senseProject({baseDir, dossier, tasks})` → `{ mode, collisions, conventions,
protectedOnDisk, advisories }`, reusing substrate primitives (no new reader):
- `collectWriteTargets` = `dossier.write_targets` ∪ each task's `writes`.
- collisions = `computeDiskTreeHash(targets, baseDir)` entries with `status:"present"`.
- `detectConventions` reads `baseDir/package.json` → `{ type, testCmd, scripts }`;
  malformed/absent → nulls, never throws.
- `detectProtectedOnDisk` = `DEFAULT_PROTECTED_PATHS` (now exported from `gate.mjs`)
  ∪ `dossier.protected_paths`, kept if `existsSync` under baseDir.

Consumed in `buildProject`: `detectConventions` runs **before** decompose and is
threaded through `decompose(...)` → `callSeat({intent:"decompose", conventions})` →
`decomposePrompt(dossier, telos, conventions)` so the Planning team prefers the
project's real test command. The full `senseProject` report runs after the task
list is known and is returned as `situation`. **Collisions are advisory** (Rule 3
re-derives every artifact; `validateProtectedPaths` is the protected-write
authority); opt-in `dossier.block_on_collision` blocks at a new `situation` phase.

## Capability 2 — Runtime adaptation (dispatch loop, substrate untouched)

`merkle-dag/orchestrate.mjs` `runOne` treats `verify-failed` as terminal and
`runTest` captures only exit status. Rather than touch it, adaptation lives in
`build-gate`:
- `build-gate/test-runner.mjs` `runNodeTest(node, baseDir)` mirrors
  `defaultVerifyNode`'s cwd-escape guard but **captures stdout/stderr** + a bounded
  failure tail (~800 chars).
- `makeTeamDispatch({..., maxAttempts=2})`: after the team writes its files, run
  `runNodeTest`; on pass settle; on fail re-call `callTeam({..., attempt,
  priorFailure})` with the captured failure so the team self-corrects. On
  exhaustion return `ok:false` + `respec.requirements` carrying the failure, so the
  substrate's existing `halt → mutateNode → re-dispatch` re-hashes the node and
  retries next round (a second, outer level).
- `teamPrompts.mjs`: `nodeBuildPrompt(node, priorFailure)` appends the failure tail
  on retries; `makeLiveCallTeam` passes `priorFailure` through. `buildProject`
  threads `adaptAttempts` (default 2).

## Trust invariants (preserved)

- **Rule 1:** a team only ever learns about its **own node** + its **own prior test
  failure** (`attempt` int + `priorFailure` from its own test). The outer respec
  embeds the same own-failure into the node's own `requirements`.
- **Rule 3:** `defaultVerifyNode` still re-derives the artifact hash + re-runs the
  test after dispatch returns `ok:true` — a team can never self-certify.
- **Fail-closed:** council gate still must pass first; project sense adds advisories
  only; a team that can't pass its own test never settles → `done()` blocks.
- **Substrate purity:** `merkle-dag/*` unmodified; only `gate.mjs` edit is the
  one-line `export` of `DEFAULT_PROTECTED_PATHS`.

### Tradeoff
A *successful* node's test runs twice (dispatch runner + `defaultVerifyNode`). The
accepted price of not modifying the pure substrate; `adaptAttempts` bounds it.

## Files
- New: `build-gate/situation.mjs`, `build-gate/test-runner.mjs`,
  `build-gate/scripts/test-situation.mjs`, `build-gate/scripts/test-runtime-adaptation.mjs`.
- Edit: `build-gate/build-orchestrator.mjs` (sense wiring + dispatch loop),
  `build-gate/teamPrompts.mjs`, `build-gate/decompose.mjs`, `build-gate/gate.mjs`
  (export), `build-gate/package.json`.

## Verification
- `cd build-gate && npm test` (exit 0, incl. breakout); `cd merkle-dag && npm test`
  (exit 0, substrate unchanged).
- `node docs/runs/agentic-teams-situational/run-teams-situational.mjs` → a
  brownfield build: project sense reports the collision + real `node --test`
  command; a team self-corrects after its own test fails; `merge_status: "ready"`.
