# Clotho Phase 1 Implementation Plan

> **SUPERSEDED historical artifact.** The Eye's hold-review of PR #90 head
> `2623758` found four blocking defects and one contract ambiguity in this
> candidate (`docs/clotho-phase-1-remediation.md` § Second review); it was
> re-converged under spec v2.1 by the second delta workshop. The canonical
> submission candidate is
> **`docs/runs/clotho-daedalus-delta5/matured-plan-v6.md`**. The extracted copy
> below is unmodified apart from this banner; the content-addressed, provenance-bearing round artifacts under
> `artifacts/` are the authoritative record.

> **Status: implementation-ready.** Execute one task per branch, PR, CI run, and
> squash merge. Do not begin a task until the prior task is merged and every existing
> package is green.

**Goal:** Build `clotho/`, an advisory, zero-runtime-dependency knowledge-graph
package, and prove it by weaving TELOS itself. The flagship query for
`deriveExecutableRef` must be answered from a verified Clotho ledger and match a
hand-audited eight-source expected set. The governing specification remains
`docs/clotho-phase-1-design.md`; this plan does not duplicate or modify it.

**Architecture:** An append-only Ed25519-signed JSONL thread ledger following the
`merkle-dag/proposal-ledger.mjs` discipline; closed node and edge registries; five
deterministic, read-only weavers; and pure query functions. Clotho may import reusable
primitives from `merkle-dag/`; the reverse direction is forbidden.

**Technology:** Node >= 18, ESM, Node built-ins only, no runtime or development
packages, `node:assert/strict`, and test scripts that print a final `... OK` marker.

## Review governance

Every workshop prompt reviewing this plan must explicitly state that findings may
target both the implementation plan and the governing specification. A specification
defect must be raised as an explicit objection containing proposed replacement text
and routed to The Eye. Implementers and reviewers must not design around a known
specification mistake. Any proposal accepted by The Eye is recorded in a final
`Proposed spec amendments` section of the revised plan.

## Decisions

| ID | Decision | Binding consequence |
|---|---|---|
| D1 | Symbol renames are not inferred. | Git history is path-scoped and stops at a rename boundary. A missing lineage remains a gap until a human or model appends an evidenced `supersedes` assertion. |
| D2 | Documentation identity uses a heading path plus section-text SHA-256. | Current-document maps detect changed, deleted, or ambiguous sections without rewriting historical locators. |
| D3 | Static weavers favor visible over-threading over scores or inferred confidence. | An imported binding used in a module is attributed to every Phase 1 exported symbol in that module. Extra flagship facts are allowed but must be emitted as an explicit review-set artifact; every expected fact must match distinctly. |
| D4 | Ledger scale is measured rather than indexed in Phase 1. | Full weave runtime, edge count, and bytes are recorded; `readEdges` must prove that it yields before its input ends. |
| D5 | A weave owns one timestamp and one signing keypair. | Weavers never receive or emit time, signatures, record hashes, or chain fields. The ledger captures one canonical timestamp and uses it for its header and every edge. |
| D6 | Weaver implementation is split into two PRs. | Task 4a establishes the substrate and git/code weavers; Task 4b adds test/doc/ledger weavers against the already-merged contract. |
| D7 | Each weave is a separately created immutable artifact. | Ledger creation uses exclusive create, append is serialized, completed output is closed and verified, and the CLI never silently overwrites an existing ledger. |
| D8 | Input inventories are closed and the self-weave output directory is never an input. | Package, document, ledger, and run-evidence sources are committed constants. `docs/runs/clotho-self-weave/` is excluded from all weavers, preventing recursive or stale self-reference. |
| D9 | Files are first-class version-identified nodes. | `repository-file` nodes carry `{repository_ref, path, blob_sha}`; imports terminating at modules, manifests, workflows, and configuration thread to file nodes instead of being dropped. A module with no Phase 1 export uses its file node as the consumer endpoint, including `repository-file -> code-symbol` when a used named import resolves to a seeded symbol. `unrepresentable-consumer` survives only for genuinely unresolvable references. |
| D10 | Proposals are quarantined from facts. | Every record carries an `assertion_status` from a closed set, coupled at write time to `asserted_by`. Default queries exclude unresolved `model-proposal` records; status transitions are append-only human-authorized follow-up records, never rewrites. |
| D11 | Absence is classifiable. | Every weave ends with a signed coverage-manifest trailer inside the chain. Queries consult it and answer `coverage-unknown` for threads whose producing weaver did not execute, instead of returning a silently smaller answer. Weaver-asserted records are invalid unless that same manifest marks the asserting weaver `executed`. |
| D12 | CI workflow changes ship alone. | The `.github/workflows/ci.yml` matrix edit is Task 0: a minimal, explicitly flagged, workflow-only PR, human-reviewed and merged before any feature task. |

## Global constraints

- **Spine read-only:** do not modify `merkle-dag/`, `build-gate/`, `breakout/`, or
  `connectors/`. No gate, signing, lifecycle, or authorization decision may read
  Clotho data.
- **Advisory-only structure:** no package outside `clotho/` may import, bare-import,
  re-export, dynamically import, or require a module that resolves into `clotho/`.
- **Zero dependencies:** `clotho/package.json` contains neither `dependencies` nor
  `devDependencies`. Only Node built-ins and permitted relative repository imports
  are used.
- **Closed and fail-closed:** unknown kinds, invalid endpoint-kind combinations,
  unknown assertion statuses, invalid status/assertor couplings, unknown
  source-reference schemes, malformed locators, mismatched node ids, unsupported
  configured ledger formats, manifest/record contradictions, and untrusted evidence
  are rejected or omitted with deterministic warnings. They never produce an inferred
  edge.
- **Identity preservation:** existing commit SHAs, ledger entry hashes, concern refs,
  obligation refs, and contract ids remain inside their locators. Clotho derives a
  containing node id; it does not replace the existing identity.
- **Evidence required:** every edge has nonblank `asserted_by`, a valid
  `assertion_status`, and a fully validated `source_ref`.
- **Read-only weaving:** weavers perform static reads and invoke only allowlisted
  `git` commands with `execFileSync` and no shell. They do not import scanned modules
  or execute package scripts.
- **Write boundary:** normal output is below `.telos/clotho/`, which is ignored.
  Only the explicit snapshot export below `docs/runs/clotho-self-weave/` is committed.
- **Warnings are data, not edges:** malformed or missing evidence produces a stable
  warning. A caller requesting the corresponding evidence kind receives a query gap.
- **Coverage honesty:** a query over a ledger whose manifest shows a weaver did not
  execute answers `coverage-unknown` for that weaver's edge kinds; only the
  predefined flagship expected set may name a specific missing relationship. A
  ledger or query input containing an edge asserted by a skipped or failed weaver is
  inconsistent and rejected.
- **Exit:** `cd clotho && npm test` is green, every existing package remains green,
  no spine file changed, and verified reproduction evidence is committed.

## File structure

| Path | Responsibility |
|---|---|
| `clotho/package.json` | Private ESM package, Node engine, fixed check/test commands, no dependencies. |
| `clotho/inventory.mjs` | Closed package, document, ledger-adapter, run-summary, weaver-id, weaver-version, repository-ref, exclusion, and fatal-warning inventories. |
| `clotho/registry.mjs` | Read-only kind and assertion-status registries, canonical encoding, locator/source/endpoint/status validation, document keys, and node-id derivation. |
| `clotho/thread-ledger.mjs` | Exclusive creation, signing, chaining, coverage-manifest trailer, closing, verification, and incremental edge reads. |
| `clotho/weavers/util.mjs` | Closed-root walks, lexical extraction, Markdown sections, token matching, current-byte blob refs, and the git wrapper. |
| `clotho/weavers/git.mjs` | `code-symbol -> commit` and `repository-file -> commit` `introduced-by` edges. |
| `clotho/weavers/code.mjs` | `code-symbol -> code-symbol`, `code-symbol -> repository-file`, `repository-file -> code-symbol`, and `repository-file -> repository-file` `depends-on` edges. |
| `clotho/weavers/test.mjs` | `code-symbol -> test` and `repository-file -> test` `verified-by` edges. |
| `clotho/weavers/doc.mjs` | `code-symbol` or `repository-file` `-> doc-section` or `contract-clause` `documented-in` edges. |
| `clotho/weavers/ledger.mjs` | Concern, obligation, contract-discharge, and run-evidence edges through closed adapters. |
| `clotho/query.mjs` | `threadsOf`, `blastRadius`, `why`, and `reportGaps`, all manifest- and status-aware. |
| `clotho/weave.mjs` | Guarded CLI entry point and complete-weave orchestration. |
| `clotho/scripts/check.mjs` | Recursively invokes `node --check` for every Clotho `.mjs` file. |
| `clotho/scripts/test-all.mjs` | Spawns every named `test-*.mjs` script in a committed fixed order. |
| `clotho/scripts/test-registry.mjs` | Registry, canonicalization, locator, endpoint, status, and identity units. |
| `clotho/scripts/test-ledger.mjs` | Creation, append, signature, chain, trailer, tamper, truncation, and streaming units. |
| `clotho/scripts/test-weavers.mjs` | Fixture-based exact-output and determinism tests. |
| `clotho/scripts/test-query.mjs` | Query traversal, validation, truncation, gap, coverage, status-filter, and drift units. |
| `clotho/scripts/test-advisory.mjs` | Repository-wide structural no-import check and scanner units. |
| `clotho/scripts/test-flagship.mjs` | Real-repository full and skipped-weaver acceptance with review-set reporting. |
| `clotho/scripts/expected-flagship.json` | Hand-audited exact-subset expectations for eight source groups. |
| `clotho/scripts/fixtures/` | Miniature packages, Markdown, ledgers, streams, and run summaries. |
| `.github/workflows/ci.yml` | Adds `clotho` to the package matrix (Task 0, workflow-only PR). |
| `.gitignore` | Ignores `.telos/clotho/`. |
| `docs/runs/clotho-self-weave/` | Reproduction script, snapshot, summary, match report, review set, and verification report. |
| `docs/STATUS.md`, `docs/ROADMAP.md` | Completion state and follow-on work. |

## Normative data model

### Canonical encoding and node ids

`canonicalJson` accepts JSON primitives, dense arrays, and plain objects only. It
rejects `undefined`, sparse arrays, non-finite numbers, `bigint`, symbols, functions,
cycles, and objects with non-plain prototypes. Object keys are sorted by JavaScript
string code-unit order; array order is preserved. Phase 1 locators have no optional
fields or implicit defaults.

`deriveNodeId({kind, locator})` validates the descriptor and returns lowercase
SHA-256 of the UTF-8 bytes of `canonicalJson({kind, locator})`.

A repository path is valid only when it is a nonempty canonical POSIX relative path:
no leading slash, backslash, NUL, empty segment, `.` segment, `..` segment, or trailing
slash. Paths are compared byte-for-byte after validation rather than silently
normalized.

### Closed registries

The authoritative membership lists appear exactly once in `registry.mjs`:

```text
NODE_KINDS = contract-clause, code-symbol, repository-file, test, commit, concern,
             obligation, check-contract, run-evidence, doc-section, decision

EDGE_KINDS = depends-on, introduced-by, motivated-by, verified-by,
             documented-in, evidenced-by, discharges, supersedes

ASSERTION_STATUS = deterministic-extraction, human-authorized,
                   model-proposal, rejected, superseded
```

All three exports are read-only Set facades backed by private native Sets. They
expose `size`, `has`, iteration, `keys`, `values`, `entries`, and `forEach`. Their
`add`, `delete`, and `clear` methods always throw. Kind and status literals may
appear as record values, switch cases, and expectations; no second authoritative
membership list is allowed.

### Locator schemas

Objects reject missing and extra fields.

| Kind | Locator |
|---|---|
| `code-symbol` | `{path, symbol}` where `symbol` is a nonempty JavaScript identifier exported by the Phase 1 grammar. |
| `repository-file` | `{repository_ref, path, blob_sha}` where `repository_ref` equals the committed Phase 1 constant `REPOSITORY_REF` in `inventory.mjs` and `blob_sha` is a lowercase full 40-hex git blob SHA produced by `git hash-object --no-filters -- <path>`. |
| `test` | `{path}`. |
| `commit` | `{sha}` with a lowercase full 40-hex SHA. |
| `doc-section` | `{path, heading_path, text_sha256}`. |
| `contract-clause` | `{path, heading_path, text_sha256}`. |
| `concern` | `{ledger_path, entry_hash}`. |
| `obligation` | `{ledger_path, entry_hash}`. |
| `check-contract` | `{path, contract_id}` with a nonblank contract id. |
| `run-evidence` | `{path}` naming a configured directory below `docs/runs/`. |
| `decision` | `{path, heading_path, text_sha256}`. |

`repository_ref` is kept explicit so cross-repository weaving later needs no schema
break; in Phase 1 any other value is rejected. A `repository-file` node is a version
reference: a rename or content change yields a new node, with lineage carried only
by explicit evidenced `supersedes` edges.

`heading_path` is a nonempty array of normalized nonempty headings. Heading
normalization applies Unicode NFC, trims leading/trailing whitespace, collapses
internal whitespace to one ASCII space, and preserves case and punctuation. Preamble
uses `['<preamble>']`. Section and ledger hashes are lowercase 64-hex strings.

`docAddressKey({path, heading_path})` returns canonical JSON of only those two fields
and is the sole key constructor for current-document maps.

### Source references

`source_ref` has exactly one validated form:

- `git:<40-hex-commit-sha>`
- `file:<repo-relative-path>@<40-hex-git-blob-sha>`
- `ledger:<repo-relative-ledger-path>#<64-hex-entry-hash>`

File refs describe the bytes actually scanned. They are produced with
`git hash-object --no-filters -- <path>`, and a non-40-hex result is fatal. They are
not inferred from `HEAD`, so a changed worktree remains content-addressed.

`asserted_by` must equal its trimmed value, contain no control character, and match a
stable identifier of at most 128 characters. The five weaver ids are exactly:

```text
clotho-git-weaver
clotho-code-weaver
clotho-test-weaver
clotho-doc-weaver
clotho-ledger-weaver
```

Human assertions use `human`; model assertions use `model:<seat>`.

### Assertion status

Every edge payload carries `assertion_status` from the closed `ASSERTION_STATUS`
set. The ledger enforces the write-time coupling; a mismatch is an append rejection:

| `asserted_by` | Required status at initial edge write |
|---|---|
| one of the five weaver ids | `deterministic-extraction` |
| `human` | `human-authorized` |
| `model:<seat>` | `model-proposal` |

`rejected` and `superseded`, and acceptance of a `model-proposal`, are expressed as
append-only follow-up status records referencing the original edge `record_hash`;
nothing already written is rewritten. A status record carries
`{status_of: <record_hash>, new_status, asserted_by, assertion_status, source_ref}`
with the same envelope discipline as edges. Every status transition is an
adjudication: `asserted_by` must be exactly `human` and its own `assertion_status`
must be `human-authorized`. Model and weaver status transitions are rejected, so a
model cannot promote, reject, or supersede its own proposal. Verification checks that
`status_of` references an earlier edge record—not another status record or a
trailer—in the same ledger and that `new_status` is `human-authorized`, `rejected`, or
`superseded`.

Status records may be appended after their target edge and before `close()` in a
separately constructed ledger. A successfully closed weave remains immutable and is
never reopened in place; cross-ledger adjudication of an already published immutable
artifact is outside Phase 1.

The payload identity key used for determinism comparison and deduplication is
`(edge_kind, from_node, to_node, source_ref, asserted_by, assertion_status)`.

### Endpoint compatibility

Append and verification both enforce this matrix:

| Edge | Allowed direction |
|---|---|
| `introduced-by` | `code-symbol -> commit` or `repository-file -> commit` |
| `depends-on` | `code-symbol -> code-symbol`, `code-symbol -> repository-file`, `repository-file -> code-symbol`, or `repository-file -> repository-file` |
| `verified-by` | `code-symbol -> test` or `repository-file -> test` |
| `documented-in` | `code-symbol` or `repository-file` `->` `doc-section` or `contract-clause` |
| `motivated-by` | `code-symbol -> concern` |
| `evidenced-by` | `code-symbol -> run-evidence` |
| `discharges` | `code-symbol -> obligation` or `obligation -> contract-clause` |
| `supersedes` | old node -> new node of the same kind (including `repository-file` renames); `asserted_by` must be `human` or begin with `model:` |

A consumer module with no representable exported symbol is itself represented as a
`repository-file` node. A used named import that resolves to a seeded symbol emits
`repository-file -> code-symbol`; an import terminating at a module emits
`repository-file -> repository-file`. `unrepresentable-consumer` remains only for
genuinely unresolvable references, such as an import specifier that cannot be
resolved to a real file below the closed roots.

### Header, signed records, and coverage trailer

The first canonical JSONL line is structurally equivalent to:

```text
{clotho_weave_header: {pub_key, woven_at, repo_head, weave_version: 1}}
```

`pub_key` is canonical base64 SPKI for an Ed25519 public key. `woven_at` must equal
`new Date(value).toISOString()`. `repo_head` is a lowercase full 40-hex SHA.

Each following canonical edge line contains the edge payload:

```text
edge_kind, from_node, to_node,
from_locator: {kind, locator}, to_locator: {kind, locator},
asserted_by, assertion_status, source_ref, woven_at
```

and ledger-owned fields:

```text
prev_hash, record_hash, signature
```

`prev_hash` is SHA-256 of the exact previous canonical line bytes, excluding LF. The
first predecessor is the exact header line. `record_hash` is SHA-256 of canonical JSON
for the payload plus `prev_hash`. `signature` is canonical base64 Ed25519 signature of
the raw 32-byte record hash. Every emitted line ends in LF; CRLF and a missing final LF
are verification errors. The next chain link hashes the complete signed line,
including `record_hash` and `signature`.

The final canonical line of a complete weave is the ledger-owned **coverage-manifest
trailer**, signed and chained exactly like an edge record:

```text
{clotho_weave_trailer: {
  weavers: [{id, version, state, error_code?, inspected_source_counts}],
  inventories_consumed
}, woven_at, prev_hash, record_hash, signature}
```

`state` is from the closed set `executed | skipped | failed`; `error_code` is
present exactly when `state` is `failed`. `weavers` lists all five weaver ids in
inventory order with the committed weaver versions from `inventory.mjs`;
`inspected_source_counts` records deterministic per-weaver input counts (zero for a
skipped weaver); `inventories_consumed` names the closed inventories read. The
trailer is written by `close()` from driver-supplied coverage data; weavers never
see or emit it. A complete ledger has exactly one trailer as its final record; a
missing, duplicate, or non-final trailer is a verification error.

For every edge whose `asserted_by` is one of the five weaver ids, the trailer entry
for that exact id must have `state: executed`. `close()` rejects contradictory
coverage before writing the trailer, and `verifyLedger` independently enforces the
same cross-record invariant after reading the trailer. Human and model records do not
alter weaver coverage. The trailer also serves as the signed end-of-weave marker:
because it is chained and final, dropping it or any complete tail record is
detectable, leaving only tail deletion of a ledger that never received its trailer
(a crashed weave, which verification already rejects as incomplete) plus replacement
of the entire file, which the external snapshot checkpoint hash covers.

A weaver `edgeInput` contains only the edge payload fields except `woven_at`. The
ledger rejects caller-supplied time, predecessor, hash, signature, header, or trailer
fields.

### Weaver result and warning contract

```text
weave(ctx) -> Promise<{edges: edgeInput[], warnings: warning[]}>
warning = {weaver, code, path, detail}
```

Warning fields are repository-relative and contain no absolute paths, timestamps, or
platform-specific separators. Results sort edges by
`(edge_kind, from_node, to_node, source_ref, asserted_by, assertion_status)` and
warnings by `(weaver, code, path, detail)`. Exact duplicate edge inputs are removed;
records with different evidence, assertors, or statuses remain distinct.

`inventory.mjs` contains a closed `FATAL_WARNING_CODES` set for structural failures
such as root escape, symlink input, unsupported configured ledger format, invalid
configured ledger entry, chain failure, invalid content address, and duplicate
heading address. Missing matches and unrepresentable static grammar produce nonfatal
warnings; flagship expected-set and gap checks decide whether they are acceptable.

## Task 0: CI-workflow isolation PR

**Files:** modify only `.github/workflows/ci.yml`.

- [ ] Add `clotho` to the existing CI package matrix without changing any existing
      package command. No other file changes in this PR.
- [ ] Flag the PR explicitly as workflow-only in its title and description; it
      requires human review as a workflow change before any Clotho feature task
      lands (per the documented self-skipping-reviewer failure).
- [ ] The matrix entry runs the standard package command; until Task 1 merges, the
      `clotho` job is expected to be red or skipped exactly as the matrix treats an
      absent package, and Task 1 must turn it green.
- [ ] **Exit:** the workflow-only PR is human-reviewed and merged, and every
      existing package's CI job is unchanged and green.

## Task 1: Package scaffold

**Files:** create `clotho/package.json`, `clotho/scripts/check.mjs`,
`clotho/scripts/test-all.mjs`, and a scaffold `test-registry.mjs`; modify only
`.gitignore` outside `clotho/`.

- [ ] Set `name`, `private: true`, `type: module`, and `engines.node: >=18`; omit both
      dependency fields.
- [ ] `check.mjs` recursively enumerates every `.mjs` file below `clotho/` in POSIX
      path order and invokes `process.execPath --check` for each through
      `execFileSync`, with no shell.
- [ ] `test-all.mjs` contains the committed ordered test filename list and spawns
      each test in a fresh Node process. Adding a test file requires adding it to the
      list; a unit fails if an unlisted `test-*.mjs` file exists.
- [ ] `npm test` runs check and then test-all. The scaffold test prints
      `clotho scaffold OK`.
- [ ] Add `.telos/clotho/` to `.gitignore`. Do not touch `.github/workflows/`; the
      matrix change already landed in Task 0.
- [ ] **Exit:** package `npm test` is green locally, no spine or existing package
      source changed, and `package.json` has zero dependencies. CI enforcement of
      Clotho begins at Task 2, when the Task 0 matrix entry runs against the merged
      scaffold.

## Task 2: Closed registries, canonical identity, and endpoint validation

**Interfaces:**

```text
NODE_KINDS: ReadonlySet<string>
EDGE_KINDS: ReadonlySet<string>
ASSERTION_STATUS: ReadonlySet<string>
canonicalJson(value) -> string
deriveNodeId({kind, locator}) -> lowercase SHA-256
validateLocator(kind, locator) -> void | throws
validateSourceRef(sourceRef) -> void | throws
validateAssertionStatus(assertedBy, assertionStatus) -> void | throws
validateEdgeInput(edgeInput) -> void | throws
docAddressKey({path, heading_path}) -> string
```

- [ ] Implement the private-Set read-only facade for all three registries; do not use
      `Object.freeze(new Set(...))` as a mutation boundary.
- [ ] Implement the exact canonicalization, path, heading, locator, provenance,
      source-ref, status-coupling, node-id, and endpoint rules above, including the
      `repository-file` locator and the fixed `REPOSITORY_REF` constant check.
- [ ] Reject unknown kinds, unknown statuses, status/assertor coupling violations,
      extra or missing fields, inherited enumerable fields, malformed identifiers,
      traversal, noncanonical paths, short SHAs, uppercase hashes, empty provenance,
      wrong `repository_ref` values, endpoint-kind mismatches, and caller-owned
      ledger fields.
- [ ] Units cover exact registry membership and counts for all three sets; all three
      mutators on each facade; iteration; unknown kinds and statuses; each locator
      schema including `repository-file`; missing/extra fields; every path rejection;
      canonical key-order independence; array-order sensitivity; non-JSON values;
      same-input stability; malformed source refs; mismatched node ids; every allowed
      and representative forbidden endpoint pair, including all four `depends-on`
      rows involving `repository-file`; each valid and each invalid initial
      status/assertor coupling; and `supersedes` provenance including a
      `repository-file` rename pair.
- [ ] **Exit:** `registry.mjs` is the only authoritative node/edge/status membership
      source and `npm test` is green.

## Task 3: Signed thread ledger

**Interfaces:**

```text
createLedger(path, {signKey?, wovenAt?, repoHead?})
  -> {header, appendEdge(edgeInput), appendStatus(statusInput), close(coverage)}
verifyLedger(path)
  -> Promise<{ok, header?, manifest?, records, errors[]}>
readEdges(path, {openReadStream?} = {})
  -> AsyncIterable<signedRecord>
```

- [ ] Reuse exported Ed25519 or envelope primitives from `merkle-dag` only when they
      implement the normative bytes above. Otherwise modify no spine file and use
      `node:crypto`, with a comment naming the proposal-ledger pattern source.
- [ ] `createLedger` creates parent directories only for its requested file, opens
      the file with exclusive `wx`, and refuses an existing path. It generates an
      ephemeral Ed25519 keypair unless given a valid Ed25519 private key.
- [ ] Capture one canonical `wovenAt` and one validated `repoHead`; obtain the latter
      with exact arguments `git rev-parse HEAD` unless a test injects it.
- [ ] Write the canonical header immediately. Serialize appends through one file
      descriptor, reject appends after close, and make `close` idempotent only after
      a successful first close.
- [ ] `appendEdge` validates the complete edge input including `assertion_status`
      coupling, re-derives endpoint ids, adds the captured timestamp and chain
      fields, signs the record hash, writes one complete LF-terminated line, and
      returns the signed record.
- [ ] `appendStatus` validates a status-transition input: `status_of` names an
      already-appended edge record hash in this ledger; `new_status` is
      `human-authorized`, `rejected`, or `superseded`; `asserted_by` is exactly
      `human`; and `assertion_status` is exactly `human-authorized`. References to a
      status record, header, or trailer and transitions asserted by a model or weaver
      id are rejected. It appends a valid transition with the same envelope
      discipline. Phase 1 weaves emit no status records; the capability exists for
      human adjudication during construction of a separate ledger and is fully
      unit-tested.
- [ ] `close(coverage)` validates driver-supplied coverage data against the
      inventory weaver-id and version lists and the closed state set. It also rejects
      coverage that marks any weaver `skipped` or `failed` when an already-appended
      edge is asserted by that weaver. It writes the signed trailer as the final
      chained record, flushes, closes the descriptor, and only then reports success.
      A close without valid coverage data throws and poisons the ledger.
- [ ] An append or close failure poisons the ledger object; later appends throw and
      the CLI must not publish the temporary file.
- [ ] `verifyLedger` incrementally parses exact lines, validates canonical encoding,
      the single first header, timestamps, all record fields, endpoint semantics,
      status couplings, human-only status adjudication, `status_of` back-references
      to earlier edge records, signatures, record hashes, chain links, and the
      consistency of weaver assertors with manifest states. It requires exactly one
      trailer as the final record. It returns the parsed manifest; `records` contains
      only trusted signed edge and status records, not the header or trailer. On a
      failure it returns only records before the first failing line or trailer-level
      invariant, marks the result `ok: false`, and never confers trust on a suffix. It
      also returns `ok: false` for an empty ledger or a ledger missing its trailer.
- [ ] `readEdges` uses `fs.createReadStream` and an incremental line splitter, skips
      the header, and yields signed records including status records and the trailer
      without buffering the complete file. It performs structural parsing but does
      not confer trust; callers query only records from a successful `verifyLedger`
      result.
- [ ] Units cover exclusive creation; generated and injected keys; happy append,
      close-with-coverage, and verify; append after close; every append rejection
      including status-coupling violations; status-record append; edge-only
      back-reference validation; human acceptance, rejection, and supersession;
      model self-promotion rejection; weaver-transition rejection; unknown
      `status_of`; malformed, missing, duplicate, and misplaced headers; missing,
      duplicate, and non-final trailers; close without coverage; close-time rejection
      of skipped/failed weaver records; independently signed verification fixtures
      containing an edge from a skipped or failed weaver; noncanonical lines; signed
      unknown kinds; mismatched ids; every permitted `depends-on` endpoint including
      `repository-file -> code-symbol`; wrong endpoint kinds; wrong timestamp;
      altered signature; altered record hash; middle-line byte tamper; middle-line
      removal; partial final line; removal of the trailer; removal of a complete tail
      record plus the trailer; and a valid human `supersedes` edge.
- [ ] Prove incremental reading with a gated injected stream: release only a complete
      header and first complete edge; race `iterator.next()` against a short timeout
      and require the edge before ending the stream or releasing later chunks; then
      release the rest and require complete ordered output.
- [ ] **Exit:** all ledger tests are green and no spine file changed.

## Task 4a: Closed inventory, substrate, git-weaver, and code-weaver

**Context:**

```text
ctx = {
  repoRoot,
  repositoryRef,
  packageRoots,
  docRoots,
  ledgerSources,
  runSources,
  symbols: [{path, symbol}],
  files: [{path, blob_sha}],
  git(args, options?) -> stdout
}
```

- [ ] Inventory every current package root once and commit the exact sorted paths in
      `inventory.mjs`. Commit `REPOSITORY_REF` (the Phase 1 repo identity constant),
      `DOC_ROOTS`, exact configured ledger files plus adapter ids, exact run
      directories plus summary files, the five weaver ids, and a committed integer
      version per weaver for the coverage manifest. Do not discover new top-level
      inputs at runtime. A future package or evidence source requires an inventory
      change and tests.
- [ ] Set `DOC_ROOTS` to the reviewed documentation and contract roots. Exclude
      `docs/runs/` from doc-weaver because run evidence has a separate owner, and
      exclude `docs/runs/clotho-self-weave/` from every inventory.
- [ ] `util.mjs` walks only real regular files beneath configured roots. It rejects
      root escape and symlinked input rather than following it; normalizes all output
      paths to validated repository-relative POSIX paths; and sorts directory entries.
- [ ] The git wrapper permits only the exact subcommands and argument shapes needed
      for `rev-parse HEAD`, `hash-object --no-filters -- <path>`, and path-scoped
      `log`. It uses `execFileSync('git', args, {cwd: repoRoot, ...})` with no shell.
- [ ] Implement a dependency-free lexical scanner that skips comments and recognizes
      strings without executing code. Phase 1 export grammar is exactly
      `export function`, `export async function`, `export const`, and `export class`
      followed by an identifier. Unsupported re-exports, computed exports, default
      exports, and dynamic symbol flow warn and emit no inferred symbol.
- [ ] Seed `ctx.symbols` from `.mjs` files below closed package roots and sort by
      `(path, symbol)`. Duplicate descriptors are an error. Seed `ctx.files` with a
      `repository-file` descriptor for every walked file below the closed package
      roots (source modules, manifests, scripts, configuration), with `blob_sha`
      from `git hash-object --no-filters`, sorted by `path`.
- [ ] Identifier matching uses tokens or escaped guards against
      `[A-Za-z0-9_$]`; regex metacharacters in searched text can never alter the
      matcher.
- [ ] `git.mjs` invokes, for each symbol, exactly
      `git log -S<symbol> --format=%H --reverse -- <path>` and emits one
      `code-symbol -> commit` `introduced-by` edge for the first result with
      `source_ref` `git:<same-sha>`. For each seeded `repository-file` it invokes
      exactly `git log --format=%H --reverse -- <path>` and emits one
      `repository-file -> commit` `introduced-by` edge for the first result. Every
      output line is validated as a full SHA. No result warns and emits no edge.
- [ ] `code.mjs` accepts static relative imports with an explicit `.mjs` target.
      Named imports resolving to seeded exports thread at symbol level: if an
      imported local binding occurs as an identifier token outside its import
      declaration, emit a `depends-on` edge from every seeded export in the
      consuming module to the imported symbol.
- [ ] If that consuming module has no Phase 1 export, the same used named import
      emits `repository-file -> code-symbol` from the consuming module's seeded file
      descriptor to the imported symbol. It is not dropped or downgraded to an
      unresolvable warning.
- [ ] Imports that terminate at modules rather than named symbols—bare side-effect
      imports, namespace imports, and named imports that do not resolve to a seeded
      export of the target—thread at file level: emit `depends-on` to the target's
      `repository-file` node, from every seeded export of the consuming module
      (`code-symbol -> repository-file`), or from the consuming module's own
      `repository-file` node when it has no Phase 1 export
      (`repository-file -> repository-file`).
- [ ] Emit `unrepresentable-consumer` only for genuinely unresolvable references: an
      import whose specifier does not resolve to a real file below the closed roots.
      Unused imports emit no edge.
- [ ] Add fixture modules where `pkg-a/one.mjs` exports `alpha`, `pkg-b/two.mjs`
      imports it under an alias and uses it from two exports, another importer has no
      export and must emit `repository-file -> code-symbol`, a namespace import
      terminates at a module, an import specifier resolves to no file, and a mock git
      function records the exact path-scoped arguments.
- [ ] Units assert the exact git calls and edges for both symbol and file level;
      earliest-result selection; malformed git output failure; conservative code
      edges; alias resolution; all four permitted `depends-on` endpoint shapes;
      file-level fallback endpoints and locators including `repository_ref` and
      `blob_sha`; no-export named-import preservation as
      `repository-file -> code-symbol`; deduplication; unused imports; comments and
      strings not counting as uses; metacharacter-safe matching;
      `unrepresentable-consumer` only for unresolvable specifiers; root/symlink
      rejection; and byte-equal `{edges, warnings}` over two runs.
- [ ] **Exit:** the inventory and shared contract are merged, both weavers are
      deterministic, and `npm test` is green.

## Task 4b: Test, documentation, and ledger weavers

- [ ] `test.mjs` considers sorted `scripts/test-*.mjs` files plus literal `.mjs`
      test paths referenced by the package `check` or `test` command. Referenced paths
      must remain inside that package root. Command strings are parsed only as text;
      no command is executed.
- [ ] A static named import resolving to a seeded symbol emits
      `code-symbol -> test` `verified-by`; the test file blob is the source ref.
      A test that imports a module without resolving to seeded symbols, or whose
      package command executes a seeded file as a script, emits
      `repository-file -> test` `verified-by` for that file. Transitive test
      relevance is obtained later through `blastRadius`, not inferred by
      test-weaver.
- [ ] Markdown splitting recognizes ATX and Setext headings outside fenced code.
      A section is the exact byte slice from its heading through the byte before the
      next heading of any level; preamble is the preceding slice. Section hashes use
      SHA-256 of those exact bytes.
- [ ] Maintain heading-level stacks to form normalized heading paths. If two sections
      in one file produce the same `{path, heading_path}`, emit fatal
      `duplicate-heading-path`, mark that address absent in the current-doc map, and
      emit no edge to either ambiguous section.
- [ ] `doc.mjs` scans only configured documentation and contract Markdown, excluding
      `docs/runs/`. An identifier-token match for a seeded symbol emits
      `documented-in` from the `code-symbol`; an exact repository-path token match
      for a seeded file emits `documented-in` from the `repository-file`. Targets
      below the documentation root are `doc-section`, and targets below the contract
      root are `contract-clause`. The whole Markdown file blob is the source ref.
- [ ] `util.mjs` exposes an I/O helper that builds `currentDocs` with
      `docAddressKey`; query functions themselves remain I/O-free.
- [ ] `ledger.mjs` dispatches each configured ledger path through its exact adapter id
      from a closed adapter object. There is no generic JSON fallback. Each adapter
      validates its required schema, recorded entry hash, signature, and chain
      metadata using read-only existing primitives where compatible.
- [ ] An adapter returns only trusted normalized entries with
      `{entryKind, entryHash, evidenceText, dischargeEvidence, contractClauseRef}`.
      Missing integrity fields required by that format are invalid rather than treated
      as unsigned legacy data. After a parse, signature, or chain failure, valid prior
      entries remain usable and the failed line plus suffix produce no edges.
- [ ] Identifier matching is performed only over adapter-declared evidence fields.
      A trusted concern entry naming a symbol emits `code-symbol -> concern`
      `motivated-by` with a ledger source ref.
- [ ] A trusted obligation naming a symbol emits `code-symbol -> obligation`
      `discharges` only when the adapter returns nonempty validated discharge evidence.
      Missing discharge evidence warns and emits no edge.
- [ ] Emit `obligation -> contract-clause` `discharges` only when the same trusted
      obligation contains an exact `{path, heading_path, text_sha256}` reference that
      resolves uniquely in the current configured contract sections. A stale,
      partial, or ambiguous reference warns and emits no clause edge.
- [ ] Each configured run source names one directory below `docs/runs/` and one exact
      summary file. If its validated bytes contain the symbol token in declared
      summary fields, emit `code-symbol -> run-evidence` `evidenced-by`; the node
      locates the directory and the source ref locates the summary file.
- [ ] Add fixtures for a direct test; a script-executed test target; a two-section
      document containing `alpha` and `alphabet`; a document naming a file path;
      duplicate headings; a matching contract clause; a valid concern; a discharged
      obligation with an exact clause ref; stale and missing clause refs; a
      malformed final ledger line; a chain break with a suffix; and one run summary.
- [ ] Units assert exact endpoint kinds, directions, locators, hashes, source refs,
      assertor ids, statuses, warning codes, and counts; `alphabet` does not match
      `alpha`; ambiguous/stale clauses produce no edge; malformed input never
      validates a suffix; and all five weavers return byte-equal results across
      repeated runs.
- [ ] **Exit:** every weaver obeys the same `{edges, warnings}` contract and
      `npm test` is green.

## Task 5: Queries, complete-weave driver, and advisory invariant

**Interfaces:**

```text
threadsOf(records, nodeId, {manifest?, includeProposals?} = {})
  -> {byKind: Map<edgeKind, record[]>, coverageUnknown: weaverId[]}
blastRadius(records, nodeId, depth, {manifest?, includeProposals?} = {})
  -> {nodes: nodeDescriptor[], edges: record[], truncated, coverageUnknown: weaverId[]}
why(records, nodeId, {expectedKinds?, currentDocs?, manifest?, includeProposals?} = {})
  -> {chain: record[], gaps: gap[]}
reportGaps(records, nodeId, expectedKinds, {currentDocs?, manifest?, includeProposals?} = {})
  -> gap[]
```

The `records` arguments are the trusted edge and status records returned by a
successful `verifyLedger`; headers and trailers are not query records. All entry
points reject malformed records, malformed manifests, conflicting descriptors for
one node id, unknown kinds, unknown statuses, invalid semantic endpoints, invalid
node ids, invalid status transitions, invalid arguments, and any edge asserted by a
weaver whose supplied manifest state is not `executed`. They do no I/O or mutation.

- [ ] **Status filtering:** every query first resolves effective statuses. Only a
      valid human-authorized status record may override its target edge's initial
      status; the latest such transition in chain order wins. Status records are
      control records and are never returned as facts. By default queries exclude
      edges whose effective status is `model-proposal`, `rejected`, or `superseded`.
      `includeProposals: true` includes unresolved `model-proposal` edges and marks
      every such returned edge `proposal: true`. Accepted proposals are ordinary
      facts; rejected and superseded edges are never returned as facts. Model- or
      weaver-authored transition records are malformed and rejected rather than
      applied.
- [ ] **Coverage awareness:** when a verified `manifest` is supplied, each query
      determines which of its consulted edge kinds are produced by weavers whose
      manifest state is not `executed`, and reports those weaver ids in
      `coverageUnknown` (for `why`/`reportGaps`, as `{gap: 'coverage-unknown',
      weaver, expected_kind}` gap records instead of `missing-edge` claims). A
      missing manifest leaves `coverageUnknown` empty for `threadsOf`/`blastRadius`
      but is an error for `why`/`reportGaps` when `expectedKinds` is nonempty:
      naming a specific missing relationship requires knowing coverage. Independently
      of gap construction, an edge asserted by a skipped or failed weaver makes the
      records/manifest pair invalid and the query throws.
- [ ] `threadsOf` groups every touching edge by kind and sorts each group by the
      canonical edge tuple.
- [ ] `blastRadius` requires a nonnegative integer depth and performs cycle-safe BFS
      over both directions of `depends-on` and `verified-by`. It returns unique stable
      node descriptors and edges. `truncated` is true exactly when a traversable
      neighbor remains unvisited beyond the requested depth.
- [ ] `why` collects the target's outgoing `introduced-by`, `motivated-by`,
      `documented-in`, and `evidenced-by` records. It follows target
      `code-symbol -> obligation` `discharges` records and then each obligation's
      outgoing `obligation -> contract-clause` `discharges` records. Traversal is
      cycle-safe and the stable chain contains both direct and obligation records.
- [ ] `expectedKinds` is a deduplicated subset of exactly `introduced-by`,
      `motivated-by`, `documented-in`, `evidenced-by`, and `discharges`; other values,
      including other registered edge kinds, throw.
- [ ] Direct expected kinds are satisfied only by an outgoing edge of that kind from
      the requested node whose designated producing weaver executed. Expected
      `discharges` additionally requires every reached obligation to have at least
      one valid outgoing discharge to a contract clause. Missing evidence with
      executed coverage produces stable `{gap: 'missing-edge', expected_kind,
      at_node}` records; missing coverage produces `{gap: 'coverage-unknown', weaver,
      expected_kind}` records. Neither stops other branches.
- [ ] For every reached `doc-section` or `contract-clause`, compare its woven hash to
      `currentDocs` when supplied. A missing key, null value, or changed hash emits
      `{gap: 'doc-drift', node, last_woven_hash}`. Deduplicate and sort all gaps.
- [ ] `why` delegates gap construction to `reportGaps`. Its defaults are
      `introduced-by`, `motivated-by`, and `discharges`; flagship callers explicitly
      add `documented-in` and `evidenced-by`.
- [ ] Query units cover touching-edge grouping; malformed input rejection; all four
      `depends-on` endpoint shapes including traversal through
      `repository-file -> code-symbol`; BFS depth zero and larger depths; cycles;
      stable node descriptors; true and false truncation; complete why traversal; a
      missing target concern; missing target documentation; missing target
      obligation; obligation without clause discharge; changed, deleted, ambiguous,
      and unchanged document sections; default exclusion of `model-proposal` records
      and opt-in marked inclusion; effective status resolution through human
      acceptance and rejection records; rejection of model self-promotion and
      status-of-status records; never returning status records or
      `rejected`/`superseded` facts; `coverage-unknown` gaps for skipped and failed
      weavers versus `missing-edge` for executed ones; rejection of edges asserted by
      skipped or failed weavers; the missing-manifest error for expected-kind
      queries; and stable gap ordering.
- [ ] `weave.mjs` exports guarded orchestration and runs as a CLI only when it is the
      invoked entry point. It has a Node shebang and imports all roots and the five
      exact ids from `inventory.mjs`.
- [ ] `--skip <id>` is repeatable but rejects unknown or duplicate ids. `--out`
      accepts a validated repository-relative path only below `.telos/clotho/` or the
      explicit self-export directory. Existing destinations are rejected.
- [ ] The driver captures one timestamp and repo head, builds one symbol and one file
      table, runs non-skipped weavers, records per-weaver
      `{id, version, state, error_code?, inspected_source_counts}` (skipped weavers
      recorded as `skipped` with zero counts; a throwing weaver recorded as `failed`
      with its stable error code), aggregates and canonical-sorts warnings and
      deduplicated edges, appends edges in that exact order, and closes with the
      complete coverage data so the signed trailer is written. It never appends an
      edge returned under the id of a skipped or failed weaver.
- [ ] Write to an exclusive sibling temporary file. Close and run `verifyLedger`
      before atomically renaming to the absent destination. On weaving, append, close,
      coverage-consistency, or verification failure, exit nonzero, remove the
      temporary file, and never publish the destination.
- [ ] Print stable JSON containing output path, edge count, ledger bytes, per-weaver
      manifest states, warnings, and fatal-warning count. A fatal warning exits
      nonzero; nonfatal warnings remain visible and do not fabricate records.
- [ ] `test-advisory.mjs` inventories package roots from tracked `package.json` files
      and scans every tracked JavaScript or TypeScript-family source file assigned to
      a package. The scanner is lexical, ignores comments, and recognizes string
      literals and no-substitution templates without executing code.
- [ ] Extract static imports with and without `from`, bare side-effect imports,
      `export ... from`, `export * from`, dynamic `import()`, and literal CommonJS
      `require()`/`module.require()`. Resolve relative and `file:` specifiers
      lexically against the source file. Reject any outside-Clotho source resolving
      into `clotho/` or using `clotho`, Clotho's package name, or their subpaths as a
      bare specifier.
- [ ] A nonliteral dynamic `import()` outside Clotho is an unresolved structural risk
      and fails closed. Include synthetic scanner units for every recognized form,
      comments and lookalike strings, aliases, path traversal into Clotho, safe nearby
      paths, and a nonliteral dynamic import.
- [ ] **Exit:** a real-repository weave completes, verifies, carries a complete and
      record-consistent signed manifest, and remains below the advisory boundary;
      `npm test` is green.

## Task 6: Flagship acceptance and skipped-source coverage failure

- [ ] Hand-audit `expected-flagship.json`; The Eye reviews the exact artifact. It
      contains entries from exactly these eight groups:
      `definition`, `consumers`, `tests`, `introduction`, `documentation`, `concern`,
      `run-evidence`, and `contract`.
- [ ] A node expectation is
      `{source_group, subject: 'node', kind, locator_match}`. An edge expectation is
      `{source_group, subject: 'edge', edge_kind, from_kind, from_locator_match,
      to_kind, to_locator_match, source_ref}`. Match objects contain exact JSON values
      only: no regex, glob, prefix, short SHA, or node id.
- [ ] Validate group semantics: definition is the target node; consumers are incoming
      `depends-on` edges; tests are reachable `verified-by` edges; introduction is
      `introduced-by`; documentation targets `doc-section`; concern is
      `motivated-by`; run-evidence is `evidenced-by`; and contract includes the
      audited discharge path ending at a `contract-clause`.
- [ ] Duplicate expectations are invalid. Matching is one-to-one: one returned fact
      cannot satisfy two expectations. Every audited consumer and test expectation
      must obtain a distinct match.
- [ ] **Review set (D3):** after one-to-one matching, every unexpected fact in the
      flagship neighborhood—any fact in the assembled fact set that matched no
      expectation—is collected into an explicit, deterministically sorted review-set
      artifact written next to the test's temporary output and later published in the
      run evidence. No unexpected fact is silently treated as validated, none is
      used to hide a missing expected match, and no relevance score, rank, or
      confidence value of any kind is attached (relevance is Lachesis's domain). The
      test asserts the review set is exactly the fact-set minus the matched facts.
- [ ] Commit expectations use the audited full 40-hex introduction SHA. File and
      ledger source refs are exact content addresses from the reviewed repository
      state.
- [ ] Step 1: spawn a full real-repository weave to a unique ignored path below
      `.telos/clotho/`; require exit zero, no fatal warning, and wall time below 120
      seconds. Capture edge count, bytes, and all nonfatal warnings.
- [ ] Step 2: call `verifyLedger`; require `ok: true` and a manifest showing all five
      weavers `executed` before any query or expected-set match. Queries use only
      `records` and `manifest` returned by this successful verification. Verification
      must already have established that every weaver-asserted edge agrees with that
      manifest.
- [ ] Step 3: derive the target from
      `{path: 'merkle-dag/obligation.mjs', symbol: 'deriveExecutableRef'}`. Call `why`
      with all five expected rationale/support kinds and call `blastRadius` at depth
      3, both with the verified manifest. Build node descriptors solely from the
      target and verified edge endpoint descriptors. The fact set is the stable union
      of the target, `why.chain`, and `blastRadius.edges`.
- [ ] Require every expectation to match distinctly, all eight groups to be present,
      audited consumer/test multiplicities to match, ledger-only `why.gaps` to be
      empty, and the review set to be complete per the rule above.
- [ ] Independently build `currentDocs` from current configured docs/contracts and
      repeat `why` with that map. Require no drift gap. This freshness check may read
      current files; the preceding fact reconstruction remains ledger-only.
- [ ] Step 4: weave to a second unique ledger with
      `--skip clotho-doc-weaver`. Verify it and require its manifest to record
      `clotho-doc-weaver` as `skipped` with zero inspected sources and the other four
      as `executed`. Require verification and the manifest-aware query validation to
      establish that no edge is asserted by `clotho-doc-weaver`. Rerun the same
      ledger-only calls with that manifest and require exactly the expected coverage
      failure containing `{gap: 'coverage-unknown', weaver:
      'clotho-doc-weaver', expected_kind: 'documented-in'}`—not a `missing-edge`
      claim, not merely a smaller result, and no fabricated `documented-in` edge.
- [ ] Remove documentation expectations for this negative run and require the other
      seven groups, including the ledger-derived contract discharge, still to match.
      Any gap other than the asserted `coverage-unknown` fails the test.
- [ ] Clean temporary ledgers in `finally` blocks without masking a prior assertion.
- [ ] **Exit:** `npm test` proves valid signatures, the signed and record-consistent
      coverage manifest, the runtime ceiling, all eight groups, distinct expected
      matching, complete review-set reporting, current-doc freshness, and fail-closed
      `coverage-unknown` skipped-source behavior.

## Task 7: Reproduction evidence and documentation

- [ ] Update `docs/STATUS.md` and `docs/ROADMAP.md`, and move completed design and plan
      artifacts to `docs/history/` according to repository convention before
      generating final evidence.
- [ ] `docs/runs/clotho-self-weave/run.mjs` invokes a keyless full weave to a unique
      temporary path below `.telos/clotho/`. The self-export directory remains
      excluded from all input inventories, so repeated runs cannot consume an old
      summary or snapshot.
- [ ] Verify the temporary ledger—including its coverage manifest showing all five
      weavers executed and no manifest/record contradiction—and complete the flagship
      expected-set, review-set, gap, and current-doc checks before publishing any
      evidence file.
- [ ] Copy the verified ledger bytes to a temporary export file, compute its SHA-256,
      and atomically replace `thread-ledger.snapshot.jsonl`. This explicit export is
      not an append operation and never modifies the source temporary ledger.
- [ ] Write `summary.json` with input repo head, weave timestamp, public key, snapshot
      SHA-256, wall time, edge count, ledger bytes, per-weaver manifest entries, all
      warnings, full why chain, blast-radius nodes and edges, empty gaps, and all
      eight matched groups.
- [ ] Write `expected-match-report.json` with each expected entry, its unique matched
      fact, and zero unmatched expectations. Write `review-set.json` with every
      unmatched flagship-neighborhood fact, deterministically sorted, carrying no
      score or rank of any kind.
- [ ] Write `verification.json` with snapshot verification status, trusted record
      count, manifest weaver states, manifest/record consistency status, advisory
      scanner file/package counts, every executed package test command, exit status,
      and Node version. Do not record absolute paths or nondeterministic process ids.
- [ ] The reproduction script exits nonzero on a fatal warning, failed ledger
      verification, incomplete or record-inconsistent manifest, expected mismatch,
      incomplete review set, query gap, drift gap, or failed atomic publish; partial
      temporary exports are removed in `finally`.
- [ ] Run `cd clotho && npm test`, then every other tracked package's existing test
      command. Run the advisory scanner once more after documentation moves and retain
      its counts in `verification.json`.
- [ ] Review the final diff: only `clotho/`, `.gitignore`, status/roadmap, history
      moves, and self-weave evidence may change (the CI matrix edit already landed
      alone in Task 0). Any spine source change blocks merge.
- [ ] **Exit:** evidence verifies from committed bytes, all package suites are green,
      advisory structure is proven repository-wide, no spine source changed, and the
      roadmap is current.

## Accepted risks with explicit boundaries

1. **Rename discontinuity:** path-scoped `git -S` and path-scoped file `log` do not
   infer renames. Missing lineage is exposed through warnings/gaps or an explicit
   evidenced `supersedes` (same-kind, including `repository-file` renames).
2. **Document drift:** historical section hashes remain facts; a current-doc map
   reports changed, deleted, or ambiguous sections.
3. **Over-threading:** module-level conservative attribution and file-level fallback
   endpoints can add dependency edges; deterministic output and the mandatory
   flagship review-set artifact expose the noise without scoring it.
4. **Ledger growth:** runtime, count, bytes, and incremental reads are measured; no
   Phase 1 index is introduced.
5. **Static grammar:** unsupported exports, re-exports, dynamic symbol flow, and
   indirect semantic references are not inferred. Imports terminating at modules are
   captured as `repository-file` facts rather than dropped; used named imports from a
   no-export consumer retain their resolved symbol through
   `repository-file -> code-symbol`; missing audited evidence still fails the
   flagship test.
6. **Self-signed identity:** an embedded ephemeral key proves internal consistency,
   not external authority. Clotho remains advisory and no durable-key policy is
   introduced.
7. **Tail deletion:** the signed final coverage trailer makes deletion of complete
   tail records detectable in a completed weave; wholesale file replacement or a
   never-completed weave remains covered by the external snapshot checkpoint SHA-256
   recorded in the summary.
8. **Proposal quarantine limits:** `model-proposal` records are excluded from
   default query results but still occupy ledger bytes and appear when explicitly
   included. Acceptance, rejection, or supersession requires an explicit
   human-authored, human-authorized status record targeting the earlier edge; model
   self-adjudication is invalid, and no automatic promotion path exists in Phase 1.