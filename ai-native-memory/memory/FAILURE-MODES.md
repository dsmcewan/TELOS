# ai-native-memory — failure modes

How this plugin fails, and that it fails closed.

## Authority drift

If the active governing document's bytes on disk no longer hash to the value pinned in
`AUTHORITY.json`, `gate.mjs` refuses to run at all (exit `1`, not a DENIED `3`) — "a drifted
authority cannot certify anyone." `audit.mjs`'s `auditAuthorityRoot` check independently flags the
same drift as a `FAIL` finding (exit `2`) so it surfaces on a routine sweep even if no one is
running the gate that day.

## Missing or malformed input

`gate.mjs`, `audit.mjs`, and `verify.mjs` all exit `1` on unreadable files or invalid JSON — a
"cannot-run" state distinct from a graded failure. The plugin never treats "I could not check this"
as equivalent to "this checked out fine."

## A load-bearing claim with no machine record

The three-representation check (`audit.mjs`) FAILs if `INVARIANTS.md` or `NON-CLAIMS.md` exists
without a corresponding `.json` machine record, and FAILs any invariant entry missing an `oracle`
field. Prose alone is never treated as a NORMATIVE claim.

## Comprehension queries drifting from their source contracts

The query-freshness check re-derives each query's `expected` value from the machine file its
`derived_from` pointer names, at audit time. If a contract changes and the queries are not
regenerated to match, the audit FAILs — the exact failure this hardening exists to catch (queries
and answers drifting in lockstep, invisible to a gate that only checks internal consistency between
queries and answers, never against the contract itself).

## A wrong or incomplete comprehension answer

`gate.mjs` DENIES (exit `3`) on any single wrong answer, any unacknowledged required invariant or
non-claim, or any un-excluded superseded authority reference. There is no partial credit and no
majority-vote pass; every check must hold.

## A verify-map oracle that fails or is missing

`verify.mjs` FAILs (exit `2`) if a named contract file is missing or malformed, if a named oracle
file does not exist, or if a named oracle exits nonzero when run. A verify-map entry naming an
oracle that does not terminate cleanly is a documentation bug in the host repository's own
`verify-map.json`, not a silent pass.

## Self-recursion in the plugin's own verify oracle

Naively wiring the plugin's own `verify-map.json` to point its `plugin` contract's oracle at
`tests/run.mjs` would make `verify.mjs`'s self-verify step spawn a process that itself spawns
`test-dogfood.mjs`, which calls `verify.mjs` again. This is avoided by design, not by luck: the
verify-map instead names `tests/test-lib.mjs`, a real, terminating, leaf oracle; see
`DECISIONS/rejected-alternatives.md` for the record of why.
