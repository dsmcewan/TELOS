# Clotho Phase 1 — Plan Amendments, Round 3 (normative deltas to plan v3)

Input to the third Daedalus delta workshop, applying The Eye's second hold-review
of PR #90 head `21ed226` (two incomplete fixes, one provenance-coverage gap, two
governance wordings) and spec v2.2. Amendment requirements are fixed; the workshop
may object to a mechanism and integrate a better one, never drop the requirement.
This is a **narrow delta** — reaffirmed mechanisms must not be reinvented.

## AM-12: the locator invariant applies to EVERY repository-scoped kind

Plan v3's authoritative locator table violates its own invariant (and AM-7) by
omitting `repository_ref` and/or content binding from six kinds. Corrected table
(spec v2.2 is authoritative):

```
doc-section     = {repository_ref, path, heading_path, text_sha256}
contract-clause = {repository_ref, path, heading_path, text_sha256}
decision        = {repository_ref, path, heading_path, text_sha256}
concern         = {repository_ref, ledger_path, entry_hash}
obligation      = {repository_ref, ledger_path, entry_hash}
check-contract  = {repository_ref, path, contract_id, blob_sha}
```

- `check-contract` in particular gains `blob_sha`: its governing bytes must not
  be able to change without changing the node identity.
- `commit = {sha}` is the single **named globally-addressed exception** — state
  it as such in the table, so no locator silently contradicts "every".
- Ripple: locator validators, node-id fixtures, weaver outputs, dedupe keys, and
  the flagship expected set all carry the completed forms.

## AM-13: `repository_ref` is defined, not delegated

- `repository_ref = "git-root:" + <full 40-hex sha of the repository's root
  commit>`, derived mechanically via `git rev-list --max-parents=0 HEAD`; more
  than one root commit is fatal in Phase 1.
- Consequences (deliberate, from spec v2.2): rename/re-hosting does not change
  identity; clones of the same history share the namespace; forks share it
  exactly as far as they share the root commit; cross-repository accession
  preserves Phase 1 node ids.
- The weave derives it, records it in the header, and validators reject locators
  whose `repository_ref` differs from the derived value. Argo receives a frozen
  definition, not a design decision.

## AM-14: mechanism provenance covers the whole mechanism, mechanically

- `implementation_refs` per weaver = the **exact transitive static
  relative-import closure** of the weaver module — including shared substrate
  (`weavers/util.mjs`, `registry.mjs`) and any permitted `merkle-dag` primitives
  participating in identity, canonicalization, or hashing.
- The manifest gains `orchestrator_refs` = content addresses for `weave.mjs`,
  `thread-ledger.mjs`, registry/canonicalization code, and other shared
  machinery — the driver shapes the graph (tables, skip policy, dedupe,
  ordering, publication) even when per-weaver refs are unchanged.
- A committed test **derives the static relative-import closure and fails when
  the implementation inventory omits or adds a file** — the inventory is proven
  equal to the closure, never trusted. Manual integer versions remain
  human-readable labels with no evidentiary weight.

## AM-15: governance wordings (plain-language corrections)

- Wherever the plan or its banners describe workshop round artifacts, the term
  is **"content-addressed, provenance-bearing round artifacts"** — provider
  response ids and a reviewer-bound hash are provenance, not cryptographic
  signatures. Nothing may call them "signed".
- Freeze the `supersedes` direction in plain language everywhere it is stated:
  `old_version --supersedes--> new_version`; the edge points forward through
  version lineage. (The candidate matrix already has this direction — keep it;
  this fixes prose, not semantics.)

## Reaffirmed (no change intended)

Everything else in plan v3: resolved hold findings 2–5 (inverse-`depends-on`
blastRadius terminating at tests; Task 1 → Task 0 → Task 2 ordering;
abort-on-weaver-failure with `executed|skipped`-only published manifests; the
content-reference manifest structure that AM-14 completes), the assertion-status
quarantine with human-only adjudication, embedded locator descriptors,
payload/envelope split, per-weave immutable ledgers, Clotho-owned verifier,
review-set flagship acceptance, review governance, and decisions D1–D13 as
amended.
