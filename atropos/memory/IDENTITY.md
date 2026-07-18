# Atropos — identity

**Atropos handles supersession** (registered meaning: "retires obsolete relationships, artifacts, tools, and
processes"). Cycle 1 realizes the **verification** half of that meaning: a zero-dependency, **READ-ONLY**
consistency verifier over the recorded supersession surface. It NEVER mutates `CURRENT-AUTHORITY` or authors
retirements — actual retirement stays a human `CHANGE-PROTOCOL` step. Never imports `clotho/`; sole sanctioned
cross-package import is `merkle-dag/vendor.mjs` (`canonicalize`/`sha256hex`).

## What it computes (`CONTRACTS/supersession.json`)
- Classifies each `#superseded` entry: `plan-version` | `node-backed` (deferred) | `unknown`.
- **NORMATIVE verdict** over plan-version consistency: closed shape + types; `must_not_govern_new_work===true`;
  unique `plan_version`; `active_plan.version` not itself superseded; `superseded_by` resolves with no
  self/dangling/cycle; the chain **terminates at `active_plan.version` whose sha256 disk-resolves** (recomputed
  via the sanctioned canonicalize/sha256hex). Real 4 entries (v11–v14 → v15) → `consistent`.
- **ADVISORY report**: retired versions + deferred/unknown surfaced — input to TELOS/The Eye, never enforced.

Supersession's populated surface is `CURRENT-AUTHORITY#superseded` (4 real plan-version entries). Node-backed
retirement (SUPERSEDED records / weave `supersedes` edges) is UNREPRESENTABLE in the current schema and DEFERRED.

Authority: `file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-atropos-1.json` + read-only design
ruling `file:docs/runs/atropos-1-workshop/design-ruling-surface-applicability.json`.
