---
title: "Clotho Phase 1 — Slice 1 Proposal (Task 1 Package Scaffold)"
type: reference
tags:
  - topic/clotho
  - workflow/implementation
  - status/proposal
author: argo
---

# Clotho Phase 1 — Slice 1 Proposal (bounded, for review)

**Status: PROPOSAL ONLY — not implemented.** This document scopes the smallest
viable first implementation slice and its acceptance criteria for review. No
`clotho/` code is written by this document.

**Governed by:** `docs/clotho-phase-1-implementation-authorization.md` (The Eye),
which authorizes implementation of v12 (`sha256:bdc93901…`, release anchor
`c5b6838…`, authz-005) strictly within frozen scope.

## The slice: v12 **Task 1 — Package scaffold**

Verbatim source: `docs/runs/clotho-daedalus-delta11/matured-plan-v12.md`, §"Task 1:
Package scaffold" (lines 727–752). This is the smallest self-contained unit and
v12's own first task — it lands under the existing CI, before the Task 0 CI-matrix
change.

### Why this slice proves the loop end-to-end

The purpose of Slice 1 is to prove the **implementation governance loop**, not to
deliver Clotho functionality:

> Argo (agent/human) authors a bounded slice of frozen v12 → the slice PR
> **re-enters TELOS** (seat review + deterministic gate/verifier over real
> on-disk artifacts) → **human approval** → accepted.

Task 1 is the minimal complete unit that can traverse that full path: it is real,
mergeable, zero-dependency, self-testing, and touches nothing outside its declared
files. It exercises every stage of the loop without requiring the weaver stack
(Tasks 2–7).

### Files (exactly v12 Task 1 — no more)

- `clotho/package.json` — `name`, `private: true`, `type: module`,
  `engines.node: >=18`; **no dependency fields** (zero-dependency).
- `clotho/scripts/check.mjs` — recursively enumerates every `.mjs` below `clotho/`
  in POSIX path order and runs `process.execPath --check` on each via
  `execFileSync` (no shell).
- `clotho/scripts/test-all.mjs` — committed ordered test-filename list; spawns each
  test in a fresh Node process; a unit fails if an unlisted `test-*.mjs` exists.
- `clotho/scripts/test-registry.mjs` — scaffold test that prints
  `clotho scaffold OK`.
- `.gitignore` — add `.telos/clotho/` (the only permitted change outside `clotho/`).

Explicitly **out of this slice:** `.github/workflows/ci.yml` (that is Task 0, a
separate workflow-only PR *after* this scaffold merges), and Tasks 2–7.

## Acceptance criteria (drawn from v12 Task 1 exit + checklist)

A future implementation PR is accepted **only if all hold**:

- [ ] `clotho/package.json` sets `name`, `private: true`, `type: module`,
      `engines.node: >=18`, and has **zero dependencies** (no `dependencies` or
      `devDependencies`).
- [ ] `check.mjs` enumerates `clotho/**/*.mjs` in POSIX order and `--check`s each
      via `execFileSync` with **no shell invocation**.
- [ ] `test-all.mjs` holds an explicit ordered test list, spawns each in a fresh
      Node process, and **fails if an unlisted `test-*.mjs` file exists**.
- [ ] `npm test` runs check → test-all and is **green locally**; the scaffold test
      prints exactly `clotho scaffold OK`.
- [ ] `.gitignore` gains `.telos/clotho/`; **no change to `.github/workflows/`**.
- [ ] **No spine or existing-package source changed**; the diff is confined to
      `clotho/` plus the single `.gitignore` line.
- [ ] Repo conventions honored: ESM only, Node ≥18, `node:`-prefixed stdlib,
      zero runtime dependencies, no bundler/transpiler/TypeScript.

## Governance path for the implementation PR (how it re-enters TELOS)

1. Argo (agent/human) authors the slice on a branch off the authorized repo state,
   confined to the files above.
2. The slice PR is opened as an **implementation PR**, explicitly bound to the
   authorization anchors (v12 `bdc93901…`, authz-005).
3. It **re-enters TELOS**: the deterministic gate/verifier re-runs the acceptance
   criteria against the real on-disk artifacts (e.g. `clotho` `npm test` green,
   diff-confinement check, zero-dependency check), and a seat review confirms the
   code matches frozen v12 with no reinterpretation or expansion.
4. **Human approval (The Eye)** merges it. No self-report is trusted; a failing
   check or any out-of-scope change fails closed.
5. Only after Slice 1 merges does **Task 0** (CI-matrix, workflow-only PR) follow,
   then Tasks 2–7 each as their own gated slice.

## Boundaries

- This is a **proposal**; it authorizes nothing and implements nothing.
- It does not expand or reinterpret v12; every item traces to Task 1's text.
- PR #104 is unrelated and untouched.
- Argo is not autonomous — "execution" is human/agent implementation under the
  authorized scope, each slice separately gated.
