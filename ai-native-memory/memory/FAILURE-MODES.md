# ai-native-memory — failure modes

How this plugin fails, and that it fails closed.

## Authority drift

If the active governing document's bytes on disk no longer hash to the value pinned in
`CURRENT-AUTHORITY.json`, `gate.mjs` refuses to run at all (exit `1`, not a DENIED `2`) — "a drifted
authority cannot certify anyone." `audit.mjs`'s `auditAuthorityRoot` check independently flags the
same drift as a `FAIL` finding (exit `2`) so it surfaces on a routine sweep even if no one is
running the gate that day.

## Missing or malformed input

Exit `1` is the command-level "cannot-run" state. `gate.mjs` uses it when its queries, answers, or
current-authority input cannot be read or parsed. `audit.mjs` uses it when the selected audit root
cannot be treated as a readable audit root, including a primary record the sweep must parse.
`verify.mjs` uses it when the verify-map itself is unreadable, malformed, or not an array.

Certain subordinate data problems are graded findings at exit `2`. For example, malformed or
unreadable JSON reached through a query's `derived_from` pointer becomes a `query-freshness` FAIL,
and a malformed or unreadable contract named by a valid verify-map becomes a `verify` FAIL. Normal
audit, verify, and comprehension findings likewise use exit `2`. Other unreadable audit
dependencies, including mirror sources or snapshot bytes, can still make the audit unable to run
and exit `1`. The plugin never treats "I could not check this" as equivalent to "this checked out
fine."

## A load-bearing claim with no machine record

The three-representation check (`audit.mjs`) FAILs if `INVARIANTS.md` or `NON-CLAIMS.md` exists
without a corresponding `.json` machine record, and FAILs any invariant entry missing an `oracle`
field. It also requires every `INVARIANTS.json` entry to have `kind: "invariant"` and every
`NON-CLAIMS.json` entry to have `kind: "non-claim"`, recomputes every record's content-addressed
`id`, and byte-derives the expected Markdown from JSON. A wrong-container kind, stale ID, or
rendered-byte mismatch FAILs. Prose alone is never treated as a NORMATIVE claim.

## Comprehension queries drifting from their source contracts

The query-freshness check re-derives each query's `expected` value from the machine file its
`derived_from` pointer names, at audit time. If a contract changes and the queries are not
regenerated to match, the audit FAILs — the exact failure this hardening exists to catch (queries
and answers drifting in lockstep, invisible to a gate that only checks internal consistency between
queries and answers, never against the contract itself). Missing or malformed derivation, unreadable
or missing files, and unresolved pointers also FAIL.

## Stale commit and snapshot evidence

An `as_of` commit that resolves but trails HEAD produces a WARN with its commit distance. An
unresolved `as_of` commit FAILs. A snapshot FAILs when its source is missing, its hash is malformed,
or its current bytes do not match the pinned hash.

## A wrong or incomplete comprehension answer

`gate.mjs` DENIES (exit `2`) on any single wrong answer, any unacknowledged required invariant or
non-claim, or any un-excluded superseded authority reference. There is no partial credit and no
majority-vote pass; every check must hold. It also DENIES an empty query array, an empty required
array, duplicate or malformed required content addresses, and required IDs that do not resolve to
sibling `INVARIANTS.json` or `NON-CLAIMS.json` records of the correct kind. Missing, malformed, or
non-content-addressed sibling record files make the gate unable to run (exit `1`). Consequently a
freshly generated, still-empty scaffold cannot certify a reader even after authority is bound.
Every query must also have a unique nonempty trimmed ID, nonempty trimmed query text, supported
`answer_kind`, and an `expected` value of the exact declared type; submitted answers must have that
same type. Boolean-looking strings and nonarray set values are DENIED even when query and answer
contain the same malformed value. Set arrays are compared as canonical JSON members, so outer
member order and object-key order are irrelevant while nested-array order remains significant.
Before grading, `authority.superseded` must be an array of unique objects with one nonempty
trimmed `ref`; a missing array, string entry, missing/blank ref, duplicate ref, or nonarray value
is a cannot-run `GATE_ERROR` (exit `1`).

## Invalid lifecycle, provenance, or pending transition

Every hashed record must carry `lifecycle: docs-first | build-first-then-ratified`. A decision and
any contract carrying a ruling must carry `decided_by`, and any present `decided_by` value is closed
to `human | model-advisory-adopted-by-human`. Invariants and non-claims require nonempty statements;
contracts require nonempty titles; any present `evidence` value must be an array. A pending record's
`becomes_normative_when` must be a portable repository-relative JavaScript oracle path. Missing or
invalid values are taxonomy FAIL findings; pending future paths may remain absent until implemented.

## Hidden or escaping record sets

A directory entry conventionally named `memory` that is a symlink is a deterministic finding in
both audit and verify. Primary machine records are physically contained before parsing, so a record
file symlink cannot escape the repository and import apparently valid records from elsewhere.

## A verify-map oracle that fails or is missing

The structural audit validates that each NORMATIVE contract or invariant names an oracle path that
exists as a regular file, but it does not execute that file. `verify.mjs` executes each contract's
declared oracle and FAILs (exit `2`) if a named contract file is missing or malformed, if a named
oracle file does not exist, or if that oracle exits nonzero. A verify-map entry naming an oracle
that does not terminate cleanly is a documentation bug in the host repository's own
`verify-map.json`, not a silent pass.

## Self-recursion in the plugin's own verify oracle

Naming `tests/run.mjs` as the plugin contract's oracle would make self-verification spawn
`test-dogfood.mjs`, which calls `verify.mjs` again. The contract and `verify-map.json` instead
both name the terminating `tests/oracle-plugin-contract.mjs`. That dedicated oracle runs the five
non-dogfood tests (`test-lib`, `test-audit`, `test-gate`, `test-init`, and `test-verify`), but first
reads the contract's `zero_dependencies` field and directly checks `package.json` plus every
grammar-aware import record across `.js`, `.cjs`, and `.mjs` files under `scripts/`. Import
analysis uses the in-plugin vendored `es-module-lexer` 2.3.1 parser, recognizes static, dynamic,
source-phase, and defer-phase imports and re-exports, ignores only `import.meta`, and fails closed
when a real import has no lexer-resolved string or the source cannot be parsed. Non-`node:`
specifiers must begin with exactly `./` or `../`; they are resolved with Node file-URL semantics,
then rejected if either the normalized lexical path or the real path of the target (or its nearest
existing ancestor) leaves the plugin root. This also closes percent-dot, query/fragment, file-link,
and directory-link/junction ambiguities. The boundary requires an explicit empty `dependencies`
object and rejects runtime declarations through
`optionalDependencies`, `peerDependencies`, `bundledDependencies`, or `bundleDependencies`;
`devDependencies` remain outside the runtime claim. It therefore avoids recursion while
terminating the contract's zero-dependency claim itself.
