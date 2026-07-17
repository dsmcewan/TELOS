---
type: reference
topic/architecture: telos
status: living
note: What The Iliad role IS as realized here — the implementation lifecycle umbrella — and what it explicitly does not own. Registered meaning is fixed by docs/mythological-vocabulary.md.
---

# The Iliad — identity (role module)

**Registered meaning (fixed):** *the system-of-systems lifecycle umbrella under
which registered components coordinate the creation, governance, maintenance,
recovery, evolution, and retirement of enrolled systems; it uses Clotho's weave
to preserve cross-plan and cross-system coherence.*

Realized here as the **implementation lifecycle**:

```
PRE-REVIEW                    IMPLEMENTATION                 POST-REVIEW
latest models per seat   →    Argo-carried, logged,     →    retrospective +
+ capabilities + prior        verifiable; result is an       feed-forward
retrospectives read           ENROLLED sub-system            optimizations
        ▲                                                        │
        └────────────── next run's pre-review reads ─────────────┘
```

## Owns

- **The enrollment registry** — `CONTRACTS/enrollment.json`: every sub-system an
  implementation creates, with evidence, memory dirs, status, and its lifecycle
  records. The deferred products list is AM-40's exclusions, cross-checked.
- **Pre-reviews** — `PRE-REVIEWS/` (template + one per run): the model review
  (env-resolved seat ids over `seats.json`; new models considered; seat changes
  proposed as data edits) and the capability review (task loadout + prior
  retrospectives; adoptions recorded).
- **Retrospectives** — `RETROSPECTIVES/`: evaluation after every delivery —
  including process mistakes, preserved — with feed-forward optimizations that
  name where they land.

## Does NOT own

- **Authorization** — TELOS. **Implementation** — Argo. **Plan maturation** —
  Daedalus. **Human authority** — The Eye. **Weaving** — Clotho (the corpus-level
  coherence consumer is a Phase-2-class capability, per the methodology).
- **A runtime** — no orchestrator service exists (`NON-CLAIMS.json`).

## Artifact map

| artifact | path |
|---|---|
| lifecycle protocol | `CONTRACTS/implementation-lifecycle.json` |
| enrollment registry | `CONTRACTS/enrollment.json` |
| pre-review template | `PRE-REVIEWS/TEMPLATE.json` |
| first retrospective | `RETROSPECTIVES/pr-126-institutional-memory-role-modules.json` |
| first enrolled sub-system's evidence | `docs/runs/institutional-memory-role-modules/STEP-LEDGER.json` |

Verification: `node docs/institutional-memory/verify-contracts.mjs` (enrollment
integrity, retrospective completeness, pre-review requirement armed for every
future enrollment, AM-40 cross-check).
