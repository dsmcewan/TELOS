# Clotho Phase 1 — Plan Amendments, Round 2 (normative deltas to plan v2)

Input to the second Daedalus delta workshop, applying The Eye's hold-review of
PR #90 head `2623758` (four blocking defects + one contract ambiguity in
`docs/runs/clotho-daedalus-delta/matured-plan-v2.md`) and spec v2.1. Amendment
requirements are fixed; the workshop may object to a mechanism and integrate a
better one, never drop the requirement. This is a **narrow delta** — reaffirmed
mechanisms must not be reinvented.

## AM-7: content-bound, repository-scoped locators (blocking defect 1)

- `code-symbol`, `test`, and `run-evidence` locators are version identities, not
  labels. Minimum schemas:

```
code-symbol  = {repository_ref, path, symbol, blob_sha}
test         = {repository_ref, path, blob_sha}
run-evidence = {repository_ref, path, summary_sha256}
```

- **Every** repository-scoped locator includes `repository_ref` (consistent with
  `repository-file`; no future cross-repository schema break). `blob_sha` via
  `git hash-object --no-filters` of the exact scanned bytes, matching the
  existing `file:` source-ref discipline.
- A changed body/file/summary produces a NEW version node; lineage is
  `supersedes`. No fact may silently reattach to a node whose named bytes
  changed. Locator validators reject missing/extra fields as before.
- Ripple: weaver outputs, endpoint matrix examples, dedupe keys, fixtures, and
  the flagship expected set all carry the enriched locators.

## AM-8: blastRadius semantics frozen to the spec (blocking defect 2)

- `affected` = inverse transitive closure of `depends-on` (from the changed
  dependency to its consumers). Forward `depends-on` is never followed.
- `evidence` = outgoing `verified-by` edges of affected artifacts. **Traversal
  stops at test nodes** — test co-coverage is not a dependency relationship and
  must not pull sibling artifacts into `affected`.
- `truncated` is computed from dependency traversal only, never from evidence
  attachment.
- The Task 5 unit tests must include: a forward-dependency non-inclusion case,
  a shared-test non-propagation case, and a truncation-source case.

## AM-9: task execution order (blocking defect 3)

- The CI workflow does not skip absent packages; adding `clotho` to the matrix
  before the package exists lands a knowingly failing workflow-only PR.
- Corrected order: **Task 1 first** (scaffold lands under existing CI, exit =
  local `npm test` green), **then Task 0** (isolated, explicitly-flagged
  workflow-only PR adds the now-existing package to the matrix), then Task 2
  onward under CI enforcement. Task 0 keeps its isolation and honest review; no
  branch-protection bypass, no red PR.

## AM-10: coverage provenance binds the mechanism bytes (blocking defect 4)

- Manifest weaver entries become
  `{id, version, implementation_refs, state, inspected_source_counts}` with
  `implementation_refs` = content addresses of the extractor files that ran
  (e.g. `file:clotho/weavers/code.mjs@<blob_sha>`, plus shared substrate files
  it imports, e.g. `weavers/util.mjs`, `registry.mjs`).
- `inventories_consumed` entries become `{id, source_ref}` with
  `source_ref = file:clotho/inventory.mjs@<blob_sha>`.
- Manual integer versions remain as human-readable labels only; they prove
  nothing. Verification recomputes and checks the refs' shape; the flagship run
  evidence records them.

## AM-11: weaver failure aborts — one contract (ambiguity 5)

- **Chosen contract: any weaver failure aborts the weave.** The temporary file
  is removed; the destination is never published; there is no partial advisory
  artifact in Phase 1.
- `failed` is retired from published manifests: a closed, verified, published
  ledger contains only `executed` and `skipped` weaver states. `failed` remains
  expressible solely in verifier fixtures / internal diagnostics (the verifier
  must still reject a published manifest containing it).
- The deliberate coverage-unknown path is `skipped`; the Task 6 gap test drives
  `skipped`, not `failed`. Queries treat any non-`executed` state as
  coverage-unknown (unchanged behavior, now with one meaning).
- The rejected alternative (partial advisory artifacts) is recorded here for
  provenance and may be revisited by a future authorized phase.

## Reaffirmed (no change intended)

Everything else in plan v2: assertion-status quarantine with human-only
adjudication, embedded locator descriptors, payload/envelope split, per-weave
immutable ledgers, Clotho-owned verifier, signed coverage trailer cross-checked
against emitted records, repository-file integration, review-set flagship
acceptance, review-governance section, D1–D8 as amended.
