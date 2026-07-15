# Clotho Phase 1 — Plan Amendments, Round 6 (normative deltas to plan v6)

Input to the sixth Daedalus delta workshop. Source: **the codex seat's
required-seat dissent in the TELOS authorization council**
(`docs/runs/clotho-authorization/` — six hard stops, high confidence), accepted
in full by The Eye (`docs/convergence-is-not-authorization.md`). AM-21..AM-25
are mandatory plan corrections; AM-26 applies spec v2.4 (the dissent's
normative items were routed through the challengeable-spec rule). Amendment
requirements are fixed; the workshop may object to a mechanism and integrate a
better one, never drop the requirement. Surgical delta — everything else in
plan v6 is reaffirmed.

## AM-21: atomic no-replace publication (TOCTOU)

Task 5's rename-to-destination publication has a window in which another
process can create the destination and be silently overwritten.

- Replace the final publication step with an atomic no-replace operation:
  link the closed-and-verified sibling temporary file to the destination with
  exclusive `link` semantics, then unlink the temporary name.
- `EEXIST` is failure; a pre-existing destination is preserved, never
  replaced.
- Add a race test that creates the destination after initial validation but
  before publication and asserts failure + preservation.

## AM-22: physical containment, not lexical (symlink escape)

CLI output containment is only lexical; a symlinked allowed directory or
parent component can redirect ledger creation outside authorized write
locations.

- Before creating temporary files or destination parents: reject every
  symlink in the allowed-root and parent-component chain and verify physical
  containment beneath the repository's real path.
- Repeat the containment check immediately before publication.
- Add allowed-root and nested-parent symlink escape tests.

## AM-23: fatal warnings abort; descriptors close (lifecycle)

Fatal-warning handling does not explicitly prohibit publication, and poisoned
ledger failures are not guaranteed to close the file descriptor before
temporary-file removal.

- Any `FATAL_WARNING_CODES` result aborts before close and publication, exits
  nonzero, and removes the temporary ledger.
- Poisoning closes the ledger descriptor automatically, or an explicit
  idempotent `abort()` operation is added.
- Tests: fatal warnings, append failures, and close failures each verify
  descriptor cleanup, no destination, and no remaining temporary file.

## AM-24: advisory-boundary hardening (evasion routes)

The advisory proof misses direct nonliteral `require()` / `module.require()`
outside Clotho, resolves module paths only lexically (symlink aliases into
`clotho/` evade it), and has no mechanical outbound check of Clotho's
zero-dependency boundary.

- Extend `test-advisory.mjs`: nonliteral `require()` and `module.require()`
  outside Clotho fail closed; tracked source symlinks are rejected; resolved
  path components / real paths are inspected so symlink aliases into `clotho/`
  fail.
- Add Clotho-side import checks rejecting non-built-in bare imports and
  relative imports outside `clotho/` except the explicitly permitted
  `merkle-dag/` closure.
- Synthetic tests for each evasion case.

## AM-25: `inspected_source_counts` normative schema (spec v2.4)

Adopt the spec v2.4 trailer schema: `inspected_source_counts` is a sorted
array of unique `{inventory_id, count}` entries with no extra fields and
nonnegative safe-integer counts; the exact inventory ids required per weaver
are stated; `executed` weavers carry actual inspected counts, `skipped`
weavers zero counts. Coverage in close-, verify-, driver-, and tamper-tests.

## AM-26: command-inferred `verified-by` provenance (spec v2.4)

Adopt the spec v2.4 evidence rule: a `verified-by` edge inferred from a
package `check`/`test` command carries
`source_ref = file:<package.json path>@<package.json blob_sha>` (the manifest
bytes that evidence execution); edges inferred from test-file imports or
classification keep the test file's source reference. Exact-output tests
distinguish the two provenance cases.

## Reaffirmed (no change intended)

Everything else in plan v6, including the four approving seats' grounds:
closed registries with throwing mutators, spine read-only with tested import
direction, D1–D19 as amended, the shallow/full-clone integration fixture, the
Task 3/Task 5 coverage split, quarantine with human-only adjudication,
review-set flagship acceptance, and review governance.
