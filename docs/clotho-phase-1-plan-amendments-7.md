# Clotho Phase 1 — Plan Amendments, Round 7 (normative deltas to plan v7)

Input to the seventh Daedalus delta workshop, applying The Eye's hold of PR #91
head `314c772` (two incomplete dissent resolutions + one new state-machine
ambiguity introduced by the no-replace publication fix) and spec v2.5.
Amendment requirements are fixed; the workshop may object to a mechanism and
integrate a better one, never drop the requirement. Surgical delta —
everything else in plan v7 (including the four targets that passed: physical
containment, abort/descriptor lifecycle, manifest-byte provenance, dissent
provenance wording) is reaffirmed.

## AM-27: executable count accuracy (spec v2.5)

V7 defines the trailer's structural shape but delegates inventory ids to a
future `inventory.mjs`, gives only examples of what weavers might count, and
leaves the weaver interface `{edges, warnings}` with no mechanical source of
"actual inspected counts" — a weaver could silently under-inspect while the
driver records the configured inventory size: structurally valid,
semantically false.

- **Freeze the exact inventory-id table** for every weaver in the plan body,
  with the count definition per id. No delegation, no examples-as-normative.
- **Define "inspected"** (spec v2.5): opened, read, and processed to
  edge-extraction eligibility without fatal error. Discovered-but-unread does
  not count.
- **Driver-owned counted iterators**: the driver hands each weaver its sources
  through counting iterators and records the counts itself; the weaver
  interface remains `{edges, warnings}` and weavers never emit counts (the
  D5 discipline extended: no time, no signatures, no chain fields, no counts).
- **Behavioral accuracy tests**: under-count (weaver skips a handed source),
  over-count (driver iterator vs recorded count mismatch), and
  skipped-but-read (a `skipped` weaver whose iterator was consumed is a
  contradiction and fails verification) — in addition to malformed-schema
  tests.

## AM-28: the outbound scanner is closed over ALL specifier forms

V7's Clotho-side rule rejects only literal bare imports and literal relative
imports resolving outside the allowed roots — leaving `require(variable)`,
`module.require(variable)`, `import(variable)`, `import("file:///…")`, and
`import("/absolute/…")` unexamined inside `clotho/`.

- Adopt the closed rule verbatim: **inside `clotho/`, only Node built-ins and
  literal relative imports resolving physically into `clotho/` or the exact
  permitted `merkle-dag/` closure are accepted. Every other specifier form —
  including nonliteral, absolute, and `file:` forms — fails closed.**
- One synthetic test per rejected form: nonliteral `require`, nonliteral
  `module.require`, nonliteral dynamic `import()`, literal `file:` URL,
  literal absolute path (plus the existing bare/relative-escape cases).

## AM-29: the publication commit point is frozen

`linkSync(tmp, dest)` is correct and atomic — but once it succeeds the
destination IS published, so the blanket rule "publication failure means
nothing was published" is impossible to honor if the subsequent unlink of the
temporary name fails.

- **Successful `linkSync` is publication commit.** Failure to unlink the
  temporary name afterward is a **cleanup failure, not a publication
  rollback** — the destination exists and must not be disturbed.
- The outcome is a **distinct, machine-visible result**: publication reports
  `published-cleanup-incomplete` (with a stable warning naming the leftover
  temporary path) rather than either plain success or failure; callers and
  the run evidence can distinguish all three states (not published /
  published clean / published with incomplete cleanup).
- Add an injected unlink-failure test proving the destination remains
  byte-identical and is never removed, and that the result state is
  `published-cleanup-incomplete`.

## Reaffirmed (no change intended)

Physical containment (D21) with both escape tests; idempotent `abort()` and
descriptor lifecycle; manifest-byte provenance for command-inferred
`verified-by` edges with distinct exact-output records; the v6 banner's
released-but-not-authorized wording; and everything else in plan v7 as
converged.
