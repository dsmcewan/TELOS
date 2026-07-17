# Daedalus complete-lineage corpus-review v1 — revised implementation approach

## Scope and completion condition

Implement the first advisory Daedalus corpus review named by
`docs/daedalus-methodology.md#corpus-level`. The review may be called complete
only after a fail-closed coverage preflight proves that its input contains the
Daedalus plans, findings, amendments, dispositions, tests, and authorization
results within the declared review boundary, together with the published
Clotho weave.

If complete-lineage coverage cannot be established, the run emits only a
coverage report, exits nonzero, and makes no corpus-level findings. A partial
weave report must not be presented as satisfying the frozen methodology.
Findings from a complete run remain ADVISORY and never affect a gate result.

The implementation is Node >=18 ESM, has ZERO runtime dependencies, is keyless,
and does not modify the spine or `LEDGER_SOURCES`. Path validation and an
injectable filesystem adapter provide application-level I/O confinement and
test observability; this is not an OS sandbox and is not represented as one.

## Deliverables

All new files live under
`docs/runs/daedalus-corpus-review-1/` except the already-existing workshop
infrastructure, which is not part of this report's trust base.

1. `lineage-scope.json`
   - Pins the Clotho snapshot and manifest paths.
   - Declares every proposal-lifecycle source root and artifact class included
     in the review boundary.
   - Enumerates explicit exclusions; an exclusion of a required lineage class
     makes coverage incomplete rather than silently narrowing the claim.
   - Records content hashes for every included source file.

2. `lineage-map.json`
   - Provides a run-local, source-cited projection for lineage relationships not
     represented as first-class Clotho edges.
   - Covers plans, findings, amendments, dispositions, tests, authorization
     results, subsystem assignments, amendment ordering, redesign events, and
     any explicit repair-induced relation.
   - Every projected node or edge carries a source path, content hash, and
     stable anchor. Hash or anchor mismatch is an input-integrity failure.
   - Uses explicit IDs where the source supplies them. Legacy records without a
     stable cross-revision ID remain unlinked; the implementation must not use
     fuzzy names or prose similarity to invent identity.

3. `inventory-lineage.mjs`
   - Exports a deterministic inventory function used by `run-review.mjs` and
     `test-review.mjs`; it has no independent writer or exit-state machine.
   - Re-enumerates the declared lifecycle roots and compares the result with
     `lineage-scope.json`.
   - Detects unlisted files, missing files, hash mismatches, inconsistent or
     unknown artifact classes, and absent required artifact classes.
   - Reads repository evidence but performs no writes.

4. `run-review.mjs`
   - Exports `runReview(options)` for tests and provides the sole guarded CLI
     entry point. Both callers receive the same terminal state and exit code;
     the CLI assigns that code to `process.exitCode`.
   - Verifies the committed
     `docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl` and its manifest
     through the published verification surface; any `!ok` result fails before
     projection or querying.
   - Validates the inventory and lineage map, then merges the verified weave and
     run-local lineage projection in memory without changing the published
     ledger.
   - Runs every query coverage-aware. Omission, truncation, or indeterminate
     coverage is `unknown`, never zero evidence or an affirmative finding. A
     query required for one of the five methodology targets must be complete or
     the run takes the coverage-incomplete exit.
   - Writes a staged deterministic output directory and atomically renames that
     directory only after the selected terminal evidence set is complete.

5. `test-review.mjs`
   - Uses only Node built-ins, an injected filesystem adapter, and committed
     fixtures.
   - Exercises verification, inventory coverage, evidence classification,
     threshold handling, every terminal state, determinism, cleanup, and
     read/write boundaries.

6. Generated evidence under `generated/`:
   - `coverage-report.json`
   - `lineage-projection.jsonl`
   - `corpus-review-report.json`
   - `corpus-review-report.md`

A complete run publishes all four files as one staged generation. A
coverage-incomplete run publishes a generation containing only
`coverage-report.json`. Input-invalid and internal-error runs publish no new
generation. The corpus report is UNSCORED, lists all findings in total
deterministic order, and does not select or label “top” findings.

## Input and path trust boundary

All data paths in either input file must be normalized repository-relative
paths. Reject absolute paths, `..` traversal, NUL-containing paths, paths whose
resolved target escapes the repository, and symlinked data or output path
components. Before any managed write, verify that the canonical run directory
is inside the canonical repository root and is not a symlink.

At `start`, remove only the known prior `generated/` directory and the known
staging-directory name after checking each with `lstat`; never recursively
follow a symlink. Stage outputs in a sibling directory on the same filesystem,
then rename it to `generated/`. On a controlled failure, remove staging files.
An inability to validate or clean the managed output location blocks the run.
The implementation makes no claim to resist concurrent hostile filesystem
mutation; its posture remains advisory and non-sandboxed.

Module loading is not classified as a review data read. Review data reads are
all routed through the injected filesystem adapter so tests can demonstrate
that the implementation requested only declared, validated inputs.

## Complete-lineage coverage gate

Before implementing detection queries, trace the proposal lifecycle's read and
write sites and record all authoritative evidence locations in
`lineage-scope.json`. The inventory must account for each required lineage
class:

- plans and their revisions;
- reviewer findings and objections;
- amendments and dispositions;
- tests or other proof evidence;
- authorization or rejection results;
- ordering and parentage needed to relate revisions.

The coverage report names every source, artifact class, record count, exclusion,
and validation result. Adding an otherwise valid fixture artifact beneath any
declared lifecycle root without adding it to the scope manifest must produce
`coverage-incomplete`. Removing every artifact of a required class must do the
same.

Failure classification is explicit:

- malformed JSON, schema violations, listed-file absence, hash mismatch,
  inconsistent class assignment, invalid ordering, duplicate identity,
  published-weave verification failure, or broken lineage-map anchor is
  `input-invalid`;
- an unlisted discovered artifact, an unknown discovered artifact class, an
  excluded or absent required lineage class, an unresolved relation required by
  a detection target, or an omitted, truncated, or indeterminate required query
  is `coverage-incomplete`;
- neither class can be interpreted as zero findings.

This local adapter is deliberately run-scoped. Promoting these relationships to
published Clotho ledger sources remains a separate reviewed change.

## Detection model and discriminating oracles

### 1. Repeated claim-to-proof gaps

For each explicit obligation, inspect the lineage for the full path:

`invariant → enforcement mechanism → task → negative test → exit criterion → proof result`

A missing member is a claim-to-proof gap. A gap is “repeated” only when the same
explicit obligation ID persists across at least two ordered revisions. Legacy
claims without stable identity are reported as unlinked coverage gaps and are
not heuristically grouped.

### 2. Repair-induced defects

Use two separate classifications:

- `confirmed-repair-induced`: the lineage explicitly attributes the finding to
  an amendment and cites causal test or authorization evidence occurring after
  that amendment;
- `repair-overlap-signal`: amendment ordering and touched subsystem or symbol
  overlap exist, but causal evidence is absent.

Symbol or subsystem overlap alone can create only a signal. Static
`blastRadius` output is not used to infer causality.

### 3. Behavioral widening

Read each amendment's required behavioral-delta accounting:

- behavior added and removed;
- new states and transitions;
- new input forms;
- new trust boundaries;
- new runtime obligations;
- new negative tests;
- net behavioral-surface change.

Widening is reported only from source-cited accounting or an exact set delta
between stable concept IDs in ordered amendments. Missing accounting produces
an `accounting-gap` and an `unknown` widening result. A static current-snapshot
radius is neither temporal growth nor evidence of widening.

### 4. Recurring subsystem failures

Group actual finding records by an explicit, source-cited subsystem ID. Report
recurrence counts and their disposition states. Findings with unknown subsystem
identity remain ungrouped rather than being assigned by filename heuristics.

### 5. Surgical-amendment versus redesign cases

For each subsystem, count `confirmed-repair-induced` findings since its last
source-cited redesign event. Two such findings produce the advisory citation to
methodology rule 3. Overlap signals, claim-to-proof gaps, and findings with
unknown causality do not count toward the threshold; they are listed separately
for human review.

Verification and documentation coverage (`verified-by` and `documented-in`) may
be included as supplemental weave observations, but they do not substitute for
any of the five methodology targets.

## Exit, evidence, and cleanup state machine

The transient phases are:

`start → verify-inputs → verify-coverage`

From `verify-coverage`, a complete inventory proceeds through:

`project → query → render-complete → complete`

Incomplete coverage discovered during coverage verification or querying
proceeds through:

`render-coverage → coverage-incomplete`

An input-integrity failure from any validation phase transitions to
`input-invalid`. An unexpected implementation or filesystem failure transitions
to `internal-error`. No failed phase resumes later in the pipeline.

| Terminal state | Exit code | Evidence published | Cleanup and test obligation |
|---|---:|---|---|
| `complete` | 0 | Complete generated set: coverage report, projection, JSON report, Markdown report | Atomic directory rename succeeds; fixture with advisory findings still exits 0 |
| `input-invalid` | 2 | None | Remove staging generation; corrupt weave, bad hash, malformed input, and broken anchor each reach this state |
| `coverage-incomplete` | 3 | Only an incomplete `coverage-report.json` generation | No projection or corpus report exists; unlisted artifact, absent required class, and truncated query each reach this state |
| `internal-error` | 1 | None | Remove staging generation where possible; injected read, render, write, and rename failures reach this state without a corpus report |

The prior managed generation is cleared during `start` before validation, so a
failed invocation cannot leave an earlier corpus report presented as the result
of the current invocation. Temporary files are removed on every controlled
failure path. No state writes outside the run directory.

## Negative tests and acceptance

- Corrupt snapshot or manifest: exit 2 before projection or querying.
- Malformed scope/map, missing listed file, hash mismatch, inconsistent class,
  duplicate ID, invalid ordering, or broken lineage-map anchor: exit 2 with no
  generated evidence.
- Unlisted or unknown-class lifecycle artifact, explicit required-class
  exclusion, or absence of every artifact in a required class: exit 3 with only
  an incomplete coverage report.
- Truncated or coverage-indeterminate required query: exit 3; the result cannot
  be classified as absent, confirmed, or complete.
- Amendment/symbol overlap without causal evidence: classified only as
  `repair-overlap-signal`.
- One confirmed repair-induced finding plus one overlap signal: rule 3 does not
  trigger.
- Two confirmed repair-induced findings in one subsystem since its last
  redesign: rule 3 is named with citations to both findings.
- Amendment lacking behavioral-delta accounting: widening is `unknown` and an
  accounting gap is emitted.
- Two consecutive complete runs over identical inputs produce byte-identical
  files; outputs contain no timestamps, environment-derived values, locale
  ordering, or absolute paths.
- Preseeded stale generated reports are removed before an input-invalid or
  coverage-incomplete run; the latter leaves only its coverage report.
- Injected failures in each transient phase produce exit 1 and no staged corpus
  report.
- Absolute, traversing, external-resolving, or symlinked data/output paths are
  rejected before use.
- A temporary-fixture integration test snapshots the fixture tree before and
  after execution and, using the injected filesystem adapter, demonstrates that
  data reads are confined to declared inputs and writes to the designated run
  directory. Module loading is not misrepresented as a data read or as sandbox
  coverage.
- Advisory findings alone retain exit 0.

## Proof-obligation matrix

| Invariant | Enforcement mechanism | Task | Negative test | Exit criterion |
|---|---|---|---|---|
| The report covers the complete declared lineage | Scope manifest, inventory, required artifact classes | Implement and validate `lineage-scope.json` and `inventory-lineage.mjs` | Add an unmanifested lifecycle artifact | Coverage succeeds with no missing, extra, excluded, or unclassified required artifact |
| Published weave evidence is authentic and coverage-aware | Published verifier and per-query coverage checks | Verify before projection and reject incomplete required queries | Corrupt manifest; force truncation | All required verification and coverage results are complete |
| Causality is not inferred from proximity | Typed confirmed-versus-signal evidence rules | Implement repair-induced classifier | Supply touch overlap without causal evidence | Overlap remains a signal and cannot affect rule 3 |
| Widening is temporal and source-backed | Behavioral-delta records or stable-ID set deltas | Implement ordered amendment accounting | Supply only a static radius or omit accounting | Result is `unknown`, not widening |
| Redesign threshold uses only qualifying findings | Per-subsystem count since last redesign | Implement rule-3 query | Combine one confirmed finding with one signal | No trigger until two confirmed findings exist |
| Findings are advisory | Exit-state separation | Keep findings out of failure transitions | Fixture containing many findings | Valid complete run exits 0 |
| Every terminal state is fail-closed and externally distinguishable | Exact transition table, exit codes, and generated evidence sets | Implement CLI/test caller mapping and controlled cleanup | Force each integrity, coverage, and internal failure | Terminal state, code, evidence set, and cleanup match the table |
| The run is reproducible and spine read-only | Validated application-level I/O boundary, total sorting, staged local generation | Implement determinism, path, and I/O tests | Run twice; attempt traversal, symlink, undeclared input, or external output | Outputs are byte-identical and no spine or external path changes |

## Maintenance boundary

The flagship-matcher duplication is recorded as requiring a dedicated Clotho
maintenance slice; `clotho/scripts/test-flagship.mjs` is not changed here. The
parameterized workshop harness used to conduct this cycle is cycle
infrastructure, not a corpus-review mechanism, and is not silently bundled into
this implementation delta. Any further harness change requires its own bounded
interface, tests, and behavioral accounting.

## Behavioral-delta accounting

- **Behavior added:** complete-lineage inventory validation; run-local lineage
  projection; typed confirmed/signal/unknown classifications; five
  source-backed corpus queries; deterministic advisory reports; canonical path
  validation; and atomic generated-evidence publication.
- **Behavior removed:** static blast radius as an oracle for temporal widening,
  repair causality, or the redesign threshold; partial-weave output presented
  as a complete corpus review; unscored “top” selection; and stale prior reports
  surviving a failed current invocation.
- **New states:** transient `start`, `verify-inputs`, `verify-coverage`,
  `project`, `query`, `render-coverage`, and `render-complete`; terminal
  `input-invalid`, `coverage-incomplete`, `internal-error`, and `complete`.
  `runReview` is called only by the guarded CLI and tests in this slice, and
  both observe the same terminal-state result.
- **New transitions:** inputs must verify before coverage; coverage must be
  complete before projection; projection must complete before querying; a
  complete query renders the full generation; incomplete coverage renders only
  coverage evidence; integrity and internal failures terminate immediately.
  Exact exit codes, evidence paths, cleanup paths, and tests are specified in
  the terminal-state table.
- **New input forms:** `lineage-scope.json` and source-cited
  `lineage-map.json`, both confined to this run directory and restricted to
  normalized repository-relative nonsymlink paths.
- **New trust boundaries:** the run-local lineage projection is untrusted until
  every source hash and anchor validates; declared filesystem paths are
  untrusted until canonical validation; neither boundary is promoted into the
  published Clotho ledger or represented as an OS sandbox.
- **New runtime obligations:** verify the weave; prove inventory coverage;
  validate projected citations and paths; preserve query coverage; sort
  totally; map every terminal state to its exact code and evidence set; stage
  and rename generated evidence locally; and clean managed temporary or stale
  output without following symlinks.
- **New negative tests:** omitted/unlisted artifacts, bad hashes and anchors,
  malformed identities and ordering, incomplete queries, correlation without
  causality, missing behavioral accounting, false redesign thresholds, every
  terminal transition, stale-output cleanup, injected internal failures,
  determinism, path traversal, symlink rejection, and I/O confinement.
- **Net behavioral-surface change:** one local coverage adapter, one advisory
  report state machine, and one application-level path/output boundary are
  added; three unsound proxy behaviors and stale-result ambiguity are removed.
  No gate, index, ledger source, runtime dependency, sandbox claim, or spine
  writer is added.