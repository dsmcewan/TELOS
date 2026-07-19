---
type: reference
topic/architecture: telos
status: living
note: What the Argo role IS, what it owns, and what it explicitly does not own. Registered meaning is fixed by docs/mythological-vocabulary.md; this file maps the role to its on-disk artifacts for a memoryless reader.
---

# Argo — identity

**Registered meaning (fixed):** *Argo carries an authorized plan through
implementation, verification, and documentation.* (`docs/mythological-vocabulary.md`)

Argo is a **role module**, and the most workflow-shaped of the three: there is **no
autonomous Argo runner** (system non-claim). What exists is a disciplined,
evidence-heavy path from an authorized plan to accepted code — plus the entry
ritual (the comprehension gate) every implementer must pass first.

## Owns

- **The entry ritual** — `docs/institutional-memory/comprehension-gate.mjs`: no
  implementation authority until a reader-validation artifact passes (exit 0),
  graded deterministically against authority-anchored facts.
- **The slice path** — bounded slice → deterministic slice gate at `meets` →
  signed required-seat review (as many rounds as The Eye directs) → **The Eye's
  acceptance** → merge, with anchors recorded.
- **The accepted-slice ledger** — `CONTRACTS/accepted-slices.json`, deep-equal to
  `CURRENT-AUTHORITY.json#implementation_authority`.
- **Documentation duty** — the slice's records (review rounds, gate result,
  deferred backlog) are committed evidence, not chat history.

## Does NOT own

- **Scope** — the plan is frozen; ambiguities escalate (Daedalus/TELOS/The Eye).
- **Authorization** — TELOS. **Maturation** — Daedalus. **Authority** — The Eye.
- **A runtime** — no daemon, no service; every slice is human-initiated.

## Artifact map (for a fresh model)

| artifact | path |
|---|---|
| entry ritual | `docs/institutional-memory/comprehension-gate.mjs` (+ per-module `comprehension-queries*.json`) |
| slice 4a evidence | `docs/runs/clotho-impl-slice-4a/` — 13 review rounds × 5 seats, `gate-result.json`, `DEFERRED-MINOR-FIXES.md` |
| accepted-slice ledger | `CONTRACTS/accepted-slices.json` ↔ `CURRENT-AUTHORITY.json#implementation_authority` |
| protocol | `CONTRACTS/implementation-protocol.json` (incl. the dissent asymmetry) |
| completed Phase 1 substrate | `clotho/memory/` (all records NORMATIVE-CURRENT; historical `comprehension-queries.{4b,5,6,7}.json` retained as entry-ritual evidence) |

Verification, one command each:
```
node docs/institutional-memory/verify-contracts.mjs   # executes the comprehension gate both ways; re-checks the ledger
```
