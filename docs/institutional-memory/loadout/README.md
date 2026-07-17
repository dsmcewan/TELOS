---
type: reference
topic/architecture: telos
status: living
note: Rendered human projection of the loadout capability-module machine records. The JSON records are the source of truth; if this file disagrees with them, the records win.
---

# Loadout — capability module (institutional memory)

The **development loadout**: the seat backends, plugin servers, review harness,
and per-task tooling an agent works with — pinned where trust-relevant, declared
where convenient, honestly unpinned where it belongs to the operator. Named from
the code's own term (`seat-registry.mjs#withLoadout`).

## Load order (agentic reader)

1. `IDENTITY.md` — the three tiers (pinned / declared / unpinned) and the review
   harness.
2. `CONTRACTS/seat-backends.json` — every seat route + the no-shadow invariant,
   machine-verified against `seat-registry.mjs`.
3. `CONTRACTS/capability-packet.json` — the gate-enforced form of a loadout
   review.
4. `INVARIANTS.json` / `NON-CLAIMS.json` — incl. the honest ones: plugin bytes
   are not verified; session skills are not pinned; malformed loadout files fail
   silently.
5. `TASK-LOADOUTS/task-{4b,5,6,7}.json` — the per-task optimization reviews.
6. `FAILURE-MODES.md`.

## Starting a task? (the optimization-review step)

1. Read your task's `TASK-LOADOUTS/task-<id>.json` — entry ritual, oracles to
   flip, reuse list, opportunities.
2. Pass the task's comprehension queries through the gate (no authority without
   it).
3. If the review surfaces a missing external capability, write **capability
   packets** and attach them to the dossier (`--capabilities`) — the gate
   enforces what an advisory review cannot.

## Verify records == reality

```
node docs/institutional-memory/verify-contracts.mjs   # rebuilds the registry, deep-checks every route, probes the no-shadow invariant
cd build-gate && npm test                              # test-seat-registry + (via breakout) test-seat-router
```

## The one-sentence version

The loadout is trust-tiered: seat routes are pinned and probed, extra tools are
declared and namespaced below the seats, session tooling is the operator's — and
a task begins with a loadout review, not with code.
