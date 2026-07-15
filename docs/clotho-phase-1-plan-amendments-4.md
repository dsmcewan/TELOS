# Clotho Phase 1 — Plan Amendments, Round 4 (normative deltas to plan v4)

Input to the fourth Daedalus delta workshop, applying The Eye's third hold-review
of PR #90 head `b68210b` (three execution-level blockers) and spec v2.3.
Amendment requirements are fixed; the workshop may object to a mechanism and
integrate a better one, never drop the requirement. This is a **surgical delta**
— everything else in plan v4 is reaffirmed and must not be reinvented.

## AM-16: `repository_ref` derivation must reject shallow history

Git treats a shallow-boundary commit as parentless, so the unguarded derivation
returns the checkout boundary — not the root — in a shallow clone. CI's
`actions/checkout@v4` is shallow by default, so CI and a full local clone would
mint **different** repository identities for the same repository.

- The derivation becomes:

```
deriveRepositoryRef:
  git rev-parse --is-shallow-repository
  require exactly "false"
  otherwise fail with a stable shallow-repository error
  then git rev-list --max-parents=0 HEAD
  require exactly one commit (multiple roots fatal)
```

- Task 0's isolated workflow-only PR sets `fetch-depth: 0` for the `clotho`
  matrix entry.
- A test proves both directions: a shallow clone is **rejected** with the stable
  error, and a full clone resolves the actual root commit.

## AM-17: orchestrator-inventory sequencing must be executable

Plan v4's Task 4a requires a committed orchestrator inventory naming
`clotho/weave.mjs`, which is not created until Task 5 — an exact-closure test
cannot simultaneously require a future file, reject nonexistent files, and wait
for Task 5. Corrected sequencing:

```
Task 4a: establish the closure scanner and PER-WEAVER inventories only
Task 5:  create weave.mjs; commit the complete orchestrator
         entrypoints/inventory; require orchestrator closure equality
         in that same PR
```

**No inventory may name a file that does not yet exist in the repository at the
PR that commits it.** Per-weaver closure equality is enforced from Task 4a/4b as
those weavers land; orchestrator closure equality is enforced from Task 5 onward.

## AM-18: adopt the spec's exact `discharges` matrix (spec v2.3 fixed the spec side)

The governing spec's canonical-semantics sentence contradicted the plan's
enforced matrix; spec v2.3 now states exactly:

```
code-symbol --motivated-by--> concern
code-symbol --discharges--> obligation
obligation  --discharges--> contract-clause
```

The plan's matrix and query implementation already follow this — the amendment
obligation on the plan is verification, not change: confirm the matrix, the
`why()` walk (code-symbol → obligation → contract-clause), fixtures, and the
flagship expected set are consistent with the now-corrected spec sentence, and
remove any residual text mirroring the old spec wording.

## Reaffirmed (no change intended)

Everything else in plan v4: the completed locator invariant with the named
`commit = {sha}` exception, mechanical mechanism provenance (closure scanner,
`orchestrator_refs`, closure-equality testing — AM-17 fixes only its
sequencing), assertion-status quarantine with human-only adjudication,
payload/envelope split, per-weave immutable ledgers, abort-on-weaver-failure
with `executed|skipped`-only published manifests, inverse-`depends-on`
blastRadius terminating at tests, review-set flagship acceptance, review
governance, and all decisions as amended.
