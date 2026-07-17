---
type: reference
topic/architecture: telos
status: living
note: Rendered human projection of the Iliad role-module machine records. The JSON records are the source of truth; if this file disagrees with them, the records win.
---

# The Iliad — role module (institutional memory)

The implementation lifecycle umbrella: **pre-review → enrolled sub-system →
post-review**, with the loop closed — every retrospective's optimizations are
inputs to the next run's pre-review.

## Load order (agentic reader)

1. `IDENTITY.md` — the lifecycle diagram; owns / does-not-own; no orchestrator.
2. `CONTRACTS/implementation-lifecycle.json` — the three phases and their steps.
3. `CONTRACTS/enrollment.json` — what the umbrella maintains; deferred products
   (AM-40, cross-checked).
4. `INVARIANTS.json` / `NON-CLAIMS.json` — incl. the honest limits: the verifier
   cannot detect an implementation that never registered; the pre-review records
   intent, provenance proves actuality.
5. `RETROSPECTIVES/` — read the latest BEFORE starting new work (that IS the
   protocol).
6. `PRE-REVIEWS/TEMPLATE.json` — copy and fill before implementing.

## Starting an implementation? (the whole protocol in four lines)

```
1. Fill PRE-REVIEWS/<run>.json  (models per seat, capabilities, prior retrospectives adopted)
2. Implement per Argo (comprehension gate first; every step logged + verifiable)
3. Append your sub-system to CONTRACTS/enrollment.json (post_protocol: true)
4. Write RETROSPECTIVES/<run>.json — delivered status is refused without it
```

## Verify records == reality

```
node docs/institutional-memory/verify-contracts.mjs
```

## The one-sentence version

Before you build, learn what the last build taught; what you build is enrolled
and maintained, not abandoned; after you build, write what the next builder
must know — and the verifier refuses "delivered" until you have.
