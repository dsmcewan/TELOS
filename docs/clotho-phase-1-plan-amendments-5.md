# Clotho Phase 1 — Plan Amendments, Round 5 (normative deltas to plan v5)

Input to the fifth Daedalus delta workshop, applying The Eye's fourth hold-review
of PR #90 head `e77e61b` (two residual execution blockers; no spec defects — the
governing spec remains v2.3). Amendment requirements are fixed; the workshop may
object to a mechanism and integrate a better one, never drop the requirement.
This is a **surgical delta** — everything else in plan v5 is reaffirmed and must
not be reinvented.

## AM-19: the shallow/full-clone test must be real, not injected

Plan v5's Task 2 tests the shallow guard with an injected `git` function
returning `true` or malformed output. That covers the conditional logic but does
not exercise Git's actual shallow-boundary behavior, the command wrapper, or
root resolution in real repositories; Task 0's `fetch-depth: 0` *prevents* the
bad state without *proving* it is rejected.

- Add an integration fixture test:

```
create a multi-commit temporary origin repository
clone it with --depth 1 via file://
assert deriveRepositoryRef throws the stable shallow-history error

clone the same origin with full history
assert deriveRepositoryRef equals "git-root:" + <origin root SHA>
```

- The fixture uses only allowlisted `git` commands via the existing no-shell
  wrapper, builds under a temporary directory that is cleaned up, and runs in
  the normal `npm test` suite (real `git` is already a repo prerequisite).
- **Keep the injected units** as fast branch-coverage tests — they are useful;
  they are just not the promised end-to-end proof.

## AM-20: Task 3 must not depend on inventories that cannot legally exist yet

Plan v5's Task 3 requires `close(coverage)` to validate against the weaver-ID,
version, implementation-file, and orchestrator-file inventories (including
nonempty `orchestrator_refs`) — but per D17 and Tasks 4a/5, per-weaver
inventories first appear in Tasks 4a/4b, the orchestrator inventory must not
appear before Task 5, and no inventory may name a future file. Task 3 cannot
satisfy its own exit contract without violating that rule.

Chosen correction — split generic ledger integrity from repository-specific
inventory equality:

```
Task 3:
  validate manifest schema, signatures, chain structure, content-reference
  SHAPES, states, and record/coverage consistency using INJECTED FIXTURE
  coverage (no dependency on committed inventories)

Task 5:
  validate coverage against the actual committed per-weaver and orchestrator
  inventories before close(); prove exact inventory/closure equality
```

- Task 3's exit criteria reference fixture inventories only; the
  inventory-equality obligations move to Task 5's exit criteria (joining the
  orchestrator closure equality already landing there).
- Tasks 4a/4b continue to enforce per-weaver closure equality as those weavers
  land, unchanged.

## Reaffirmed (no change intended)

Everything else in plan v5: the frozen shallow-history guard and Task 0's
`fetch-depth: 0` (AM-19 adds the missing proof, not a new mechanism), the
Task 4a/Task 5 inventory sequencing and no-future-files rule, the agreed
`motivated-by`/`discharges` matrix across spec, endpoints, weavers, queries,
and flagship semantics, the completed locator invariant, mechanical mechanism
provenance, assertion-status quarantine, payload/envelope split, per-weave
immutable ledgers, abort-on-weaver-failure, review-set flagship acceptance,
review governance, and all decisions as amended.
