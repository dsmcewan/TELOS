# Clotho Phase 1 — Plan Amendments (normative deltas to the matured plan)

Input to the Daedalus delta workshop, applying spec v2
(`docs/clotho-phase-1-design.md`) and The Eye's decisions
(`docs/clotho-phase-1-remediation.md`) to the converged plan at
`docs/runs/clotho-daedalus/matured-plan.md`. Each amendment is normative; the
workshop integrates them into a single re-converged plan and may object to the
*mechanism* of an amendment (proposing a better one), not to its requirement.

## AM-1: `repository-file` node kind (The Eye, 2026-07-15)

- Add `repository-file` to `NODE_KINDS` with locator `{repository_ref, path,
  blob_sha}` (blob sha via `git hash-object --no-filters`; `repository_ref` is the
  repo identity — Phase 1 constant for this repo — kept explicit so cross-repo
  weaving later needs no schema break).
- Extend the endpoint-compatibility matrix: `repository-file -> commit`
  (`introduced-by`); `code-symbol -> repository-file` and `repository-file ->
  repository-file` (`depends-on`, for imports terminating at modules, manifests,
  workflows, config); `repository-file -> test` (`verified-by`, for tests that
  execute files/commands); `repository-file -> doc-section | contract-clause`
  (`documented-in`); `supersedes` same-kind rule now covers file renames.
- The code-weaver's `unrepresentable-consumer` warning is retired where a
  `repository-file` endpoint now represents the consumer; the warning remains only
  for genuinely unresolvable references.
- The git-weaver may thread `introduced-by` at file level directly.

## AM-2: `assertion_status` (proposal quarantine)

- Add `assertion_status` to the edge fact payload; closed set
  `{deterministic-extraction, human-authorized, model-proposal, rejected,
  superseded}` lives in `registry.mjs` beside the other closed sets.
- Write-time coupling enforced by the ledger: weaver ids =>
  `deterministic-extraction`; `model:<seat>` => `model-proposal`; `human` =>
  `human-authorized`. Status transitions (`rejected`, acceptance of a proposal)
  are append-only follow-up records referencing the original record hash — nothing
  is rewritten.
- **Default queries exclude unresolved `model-proposal` records**; an opt-in flag
  includes them, clearly marked. The payload identity key for determinism/dedupe
  gains `assertion_status`.

## AM-3: signed coverage manifest

- The weave trailer (a final ledger-owned record, inside the signed chain) carries
  `{weavers: [{id, version, state: executed|skipped|failed, error_code?,
  inspected_source_counts}], inventories_consumed}`.
- `readEdges`/verifier expose the manifest; queries consult it and answer
  `coverage-unknown` for threads whose producing weaver did not execute.
- The Task 6 "skipped-source failure" test asserts the `coverage-unknown` path,
  not merely a smaller result.

## AM-4: flagship acceptance tightening

- Exit criteria become: every expected edge matches distinctly; every unexpected
  edge in the flagship neighborhood is emitted as an explicit **review set**
  artifact in the run evidence; no unexpected edge is silently treated as
  validated; no relevance scoring (Lachesis's domain).

## AM-5: CI-workflow isolation

- Remove the `.github/workflows/ci.yml` edit from Task 1. It becomes **Task 0**:
  a minimal, explicitly-flagged, workflow-only PR (adds `clotho` to the matrix),
  landed and human-reviewed before any feature task. Task 1's exit criterion
  changes to "package `npm test` green locally"; CI enforcement begins at Task 2.

## AM-6: spec-challenge rule for this and future workshops

- Workshop prompts must state: findings may target the implementation plan **and**
  the governing specification; spec defects yield explicit proposed amendments
  (an objection plus replacement text) routed to The Eye — seats never design
  around an unchangeable mistake.

## Already-converged mechanisms reaffirmed (no change intended)

Embedded `from_locator`/`to_locator` descriptors; payload/envelope split with the
single per-weave timestamp/keypair; per-weave immutable ledgers; Clotho-owned
thread verifier; frozen endpoint matrix (as extended by AM-1); D1–D8 and the
accepted-risks register, including the external checkpoint hash for tail deletion.
