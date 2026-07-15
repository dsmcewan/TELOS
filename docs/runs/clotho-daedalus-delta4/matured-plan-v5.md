# Clotho Phase 1 Implementation Plan

> **SUPERSEDED historical artifact.** The Eye's fourth hold-review of PR #90
> head `e77e61b` found two residual execution blockers in this candidate
> (`docs/clotho-phase-1-remediation.md` § Fifth review); it was re-converged
> under spec v2.3 by the fifth delta workshop. The canonical submission
> candidate is **`docs/runs/clotho-daedalus-delta6/matured-plan-v7.md`**. The
> extracted copy below is unmodified apart from this banner; the
> content-addressed, provenance-bearing round artifacts under `artifacts/` are
> the authoritative record.

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

Workshop round artifacts are **content-addressed, provenance-bearing round
artifacts**: provider response ids and a reviewer-bound hash are provenance, not
cryptographic signatures. Nothing in this plan, its banners, or its evidence may
call them "signed".

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
| D12 | CI workflow changes ship alone, after the package exists. | The `.github/workflows/ci.yml` matrix edit is Task 0: a minimal, explicitly flagged, workflow-only PR, human-reviewed and merged immediately after the Task 1 scaffold, so the matrix never names an absent package and no knowingly red workflow PR lands. |
| D13 | Locators are content-bound version identities. | Every repository-scoped locator carries `repository_ref` and a content hash of the exact bytes it names (`blob_sha`, `text_sha256`, `entry_hash`, or `summary_sha256`). The single named globally-addressed exception is `commit = {sha}`. A changed body, file, section, or summary is a NEW version node; lineage is explicit `supersedes` (`old_version --supersedes--> new_version`; the edge points forward through version lineage); no fact silently reattaches to changed bytes. |
| D14 | Coverage provenance binds the whole mechanism, mechanically. | Manifest weaver entries carry `implementation_refs` equal to the exact transitive static relative-import closure of the weaver module (content-addressed); the manifest carries `orchestrator_refs` for the driver and shared machinery; `inventories_consumed` entries carry a `source_ref` content address. A committed test proves each implementation inventory equal to the derived closure. Manual integer versions remain human-readable labels only and prove nothing. |
| D15 | Any weaver failure aborts the weave. | A throwing weaver destroys the temporary ledger; the destination is never published; there is no partial advisory artifact in Phase 1. Published manifests contain only `executed` and `skipped` states; `failed` survives solely in verifier fixtures and internal diagnostics, and the verifier rejects a published manifest containing it. |
| D16 | `repository_ref` is defined, not delegated. | `repository_ref = "git-root:" + <full 40-hex SHA of the repository's root commit>`, derived mechanically: first `git rev-parse --is-shallow-repository` must return exactly `false` (a shallow repository is rejected with a stable error), then `git rev-list --max-parents=0 HEAD`; more than one root commit is fatal in Phase 1. The weave derives it, records it in the header, and validators reject locators whose `repository_ref` differs from the derived value. Rename/re-hosting does not change identity; clones of the same history share the namespace; forks share it exactly as far as they share the root commit; cross-repository accession preserves Phase 1 node ids. |
| D17 | Committed inventories name only files that exist. | No inventory may name a file that does not yet exist in the repository at the PR that commits it. Task 4a commits the closure scanner and per-weaver inventories only; Task 5 creates `weave.mjs`, commits the complete orchestrator inventory, and enforces orchestrator closure equality in the same PR. Per-weaver closure equality is enforced from Task 4a/4b as those weavers land; orchestrator closure equality from Task 5 onward. |

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
  configured ledger formats, manifest/record contradictions, shallow repository
  history, and untrusted evidence are rejected or omitted with deterministic
  warnings. They never produce an inferred edge.
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
  ledger or query input containing an edge asserted by a non-`executed` weaver is
  inconsistent and rejected.
- **No partial weave artifacts:** a weaver failure aborts the entire weave; the
  temporary ledger is removed and the destination is never published. A published,
  verified manifest contains only `executed` and `skipped` weaver states.
- **Exit:** `cd clotho && npm test` is green, every existing package remains green,
  no spine file changed, and verified reproduction evidence is committed.

## File structure

| Path | Responsibility |
|---|---|
| `clotho/package.json` | Private ESM package, Node engine, fixed check/test commands, no dependencies. |
| `clotho/inventory.mjs` | Closed package, document, ledger-adapter, run-summary, weaver-id, weaver-version, weaver-implementation-file, orchestrator-file, exclusion, and fatal-warning inventories. Each inventory names only files existing at the PR that commits it (D17): per-weaver implementation-file lists land in Tasks 4a/4b; the orchestrator-file list lands in Task 5. |
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
| `clotho/scripts/test-closure.mjs` | Derives each weaver's static relative-import closure (Task 4a onward) and, from Task 5, the orchestrator closure; fails on any divergence from the committed inventories. |
| `clotho/scripts/test-flagship.mjs` | Real-repository full and skipped-weaver acceptance with review-set reporting. |
| `clotho/scripts/expected-flagship.json` | Hand-audited exact-subset expectations for eight source groups. |
| `clotho/scripts/fixtures/` | Miniature packages, Markdown, ledgers, streams, and run summaries. |
| `.github/workflows/ci.yml` | Adds `clotho` to the package matrix with `fetch-depth: 0` (Task 0, workflow-only PR, after Task 1). |
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

### `repository_ref` definition

`repository_ref` is defined mechanically, not delegated:

```text
repository_ref = "git-root:" + <full 40-hex SHA of the repository's root commit>
```

The derivation is guarded against shallow history, then resolves the root:

```text
deriveRepositoryRef:
  git rev-parse --is-shallow-repository
  require exactly "false"
  otherwise fail with a stable shallow-repository error
  then git rev-list --max-parents=0 HEAD
  require exactly one commit (multiple roots fatal)
```

The shallow guard is load-bearing: git treats a shallow-boundary commit as
parentless, so an unguarded derivation in a shallow clone (the
`actions/checkout@v4` default) would return the checkout boundary — not the
root — and CI and a full local clone would mint **different** repository
identities for the same repository. Task 0's workflow-only PR therefore sets
`fetch-depth: 0` for the `clotho` matrix entry, and a test proves both
directions: a shallow clone is rejected with the stable error, and a full clone
resolves the actual root commit.

After the guard, exactly one full 40-hex output line is required from
`git rev-list --max-parents=0 HEAD`; more than one root commit is fatal in
Phase 1, as is a malformed or non-40-hex result. The deliberate consequences
(per spec v2.2/v2.3): repository rename or re-hosting does not change identity;
clones of the same history weave into the same namespace; forks share the
namespace exactly as far as they share the root commit; and later
cross-repository accession preserves every Phase 1 node id unchanged.

The weave driver derives `repository_ref` once per weave, records it in the ledger
header, and supplies it to every weaver through `ctx.repositoryRef`. Locator
validators reject any locator whose `repository_ref` differs from the derived
value. `inventory.mjs` commits no hardcoded ref value; the derivation command and
its validation are the committed constants.

### Locator schemas

Objects reject missing and extra fields. **Every repository-scoped locator is a
content-bound version identity:** it carries `repository_ref` (validated against
the derived value defined above) and a content hash of the exact bytes it names.
A changed function body, file, section, contract, or summary produces a NEW
version node; lineage across versions is carried only by explicit evidenced
`supersedes` edges (`old_version --supersedes--> new_version`; the edge points
forward through version lineage). No fact may silently reattach to a node whose
named bytes changed.

| Kind | Locator |
|---|---|
| `code-symbol` | `{repository_ref, path, symbol, blob_sha}` where `symbol` is a nonempty JavaScript identifier exported by the Phase 1 grammar and `blob_sha` is the lowercase full 40-hex git blob SHA of the defining file's exact scanned bytes, from `git hash-object --no-filters -- <path>`. |
| `repository-file` | `{repository_ref, path, blob_sha}` with `blob_sha` produced identically. |
| `test` | `{repository_ref, path, blob_sha}` with `blob_sha` produced identically. |
| `commit` | `{sha}` with a lowercase full 40-hex SHA. **This is the single named globally-addressed exception to the repository-scoped invariant:** a git commit SHA is already a globally addressed content identity and takes no `repository_ref`. |
| `doc-section` | `{repository_ref, path, heading_path, text_sha256}`. |
| `contract-clause` | `{repository_ref, path, heading_path, text_sha256}`. |
| `decision` | `{repository_ref, path, heading_path, text_sha256}`. |
| `concern` | `{repository_ref, ledger_path, entry_hash}`. |
| `obligation` | `{repository_ref, ledger_path, entry_hash}`. |
| `check-contract` | `{repository_ref, path, contract_id, blob_sha}` with a nonblank contract id and `blob_sha` of the governing file's exact bytes, so the governing bytes cannot change without changing the node identity. |
| `run-evidence` | `{repository_ref, path, summary_sha256}` where `path` names a configured directory below `docs/runs/` and `summary_sha256` is the lowercase 64-hex SHA-256 of the configured summary file's exact validated bytes. |

For `concern` and `obligation`, the `entry_hash` (lowercase 64-hex SHA-256 of the
signed ledger entry) is the content binding; the existing entry identity is
preserved inside the locator per the identity-preservation constraint. Locator
validators reject missing and extra fields as everywhere else. Content hashes are
computed from the exact bytes actually scanned, matching the `file:` source-ref
discipline; a non-40-hex `hash-object` result or malformed digest is fatal.

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

Append and verification both enforce this matrix, which matches the spec v2.3
canonical-semantics statement exactly (`code-symbol --motivated-by--> concern`,
`code-symbol --discharges--> obligation`,
`obligation --discharges--> contract-clause`):

| Edge | Allowed direction |
|---|---|
| `introduced-by` | `code-symbol -> commit` or `repository-file -> commit` |
| `depends-on` | `code-symbol -> code-symbol`, `code-symbol -> repository-file`, `repository-file -> code-symbol`, or `repository-file -> repository-file` |
| `verified-by` | `code-symbol -> test` or `repository-file -> test` |
| `documented-in` | `code-symbol` or `repository-file` `->` `doc-section` or `contract-clause` |
| `motivated-by` | `code-symbol -> concern` |
| `evidenced-by` | `code-symbol -> run-evidence` |
| `discharges` | `code-symbol -> obligation` or `obligation -> contract-clause` |
| `supersedes` | old node -> new node of the same kind — `old_version --supersedes--> new_version`, the edge points forward through version lineage (including `repository-file` renames and content-changed `code-symbol`, `test`, and `run-evidence` versions); `asserted_by` must be `human` or begin with `model:` |

A consumer module with no representable exported symbol is itself represented as a
`repository-file` node. A used named import that resolves to a seeded symbol emits
`repository-file -> code-symbol`; an import terminating at a module emits
`repository-file -> repository-file`. `unrepresentable-consumer` remains only for
genuinely unresolvable references, such as an import specifier that cannot be
resolved to a real file below the closed roots.

### Header, signed records, and coverage trailer

The first canonical JSONL line is structurally equivalent to:

```text
{clotho_weave_header: {pub_key, woven_at, repo_head, repository_ref, weave_version: 1}}
```

`pub_key` is canonical base64 SPKI for an Ed25519 public key. `woven_at` must equal
`new Date(value).toISOString()`. `repo_head` is a lowercase full 40-hex SHA.
`repository_ref` is the derived `git-root:<sha>` value defined above; verification
recomputes its shape and every locator in the ledger must carry exactly this value.

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
  weavers: [{id, version, implementation_refs, state, inspected_source_counts}],
  orchestrator_refs: [...],
  inventories_consumed: [{id, source_ref}]
}, woven_at, prev_hash, record_hash, signature}
```

`state` is from the closed set `executed | skipped` for any published manifest;
`failed` exists solely in verifier fixtures and internal diagnostics, and
`verifyLedger` rejects a manifest containing it (see the weaver-failure abort
contract below). `weavers` lists all five weaver ids in inventory order.
`version` is the committed integer from `inventory.mjs`, retained as a
human-readable label only; it proves nothing.

**Coverage provenance binds the whole mechanism, mechanically:**

- `implementation_refs` per weaver is a nonempty deterministically sorted array of
  `file:<path>@<blob_sha>` content addresses equal to the **exact transitive
  static relative-import closure** of that weaver's module — the weaver module
  itself, the shared substrate it imports (e.g. `clotho/weavers/util.mjs`,
  `clotho/registry.mjs`, `clotho/inventory.mjs`), and any permitted `merkle-dag`
  primitives participating in identity, canonicalization, or hashing. The driver
  computes each ref with `git hash-object --no-filters` from the committed
  per-weaver implementation-file inventory in `inventory.mjs`.
- `orchestrator_refs` is a nonempty deterministically sorted array of content
  addresses for the orchestration machinery — `clotho/weave.mjs`,
  `clotho/thread-ledger.mjs`, registry/canonicalization code, and other shared
  machinery from the committed orchestrator-file inventory — because the driver
  shapes the graph (tables, skip policy, dedupe, ordering, publication) even when
  every per-weaver ref is unchanged.
- The committed inventories are **proven equal to the derived closures, never
  trusted**: `scripts/test-closure.mjs` derives the static relative-import
  closure of each weaver module and, once Task 5 lands `weave.mjs`, of the
  orchestrator entry points, using the same lexical import scanner discipline as
  the advisory checker, and fails when any committed inventory omits or adds a
  file. Per D17, each inventory is committed in the PR whose files it names.

A skipped weaver still records its `implementation_refs` (the bytes that would
have run, identifying the mechanism version) with zero `inspected_source_counts`.
`inventories_consumed` entries are `{id, source_ref}` with
`source_ref = file:clotho/inventory.mjs@<blob_sha>` (one entry per closed
inventory read, all content-addressed). Verification recomputes and checks every
ref's shape (valid `file:` form, repo-relative path, 40-hex blob SHA) for
`implementation_refs`, `orchestrator_refs`, and `inventories_consumed`, and the
flagship run evidence records them.

The trailer is written by `close()` from driver-supplied coverage data; weavers never
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

### Weaver result, warning, and failure contract

```text
weave(ctx) -> Promise<{edges: edgeInput[], warnings: warning[]}>
warning = {weaver, code, path, detail}
```

Warning fields are repository-relative and contain no absolute paths, timestamps, or
platform-specific separators. Results sort edges by
`(edge_kind, from_node, to_node, source_ref, asserted_by, assertion_status)` and
warnings by `(weaver, code, path, detail)`. Exact duplicate edge inputs are removed;
records with different evidence, assertors, or statuses remain distinct.

**Any weaver failure aborts the weave.** A weaver that throws terminates the entire
weave: the temporary ledger file is removed, the destination is never published, and
the driver exits nonzero reporting the stable error code. There is no partial
advisory artifact in Phase 1; the deliberate coverage-unknown path is `--skip`
(`state: skipped`). The rejected alternative—publishing partial advisory artifacts
with `failed` manifest states—is recorded here for provenance and may be revisited
by a future authorized phase.

`inventory.mjs` contains a closed `FATAL_WARNING_CODES` set for structural failures
such as root escape, symlink input, unsupported configured ledger format, invalid
configured ledger entry, chain failure, invalid content address, and duplicate
heading address. Missing matches and unrepresentable static grammar produce nonfatal
warnings; flagship expected-set and gap checks decide whether they are acceptable.

## Task 1: Package scaffold

**Files:** create `clotho/package.json`, `clotho/scripts/check.mjs`,
`clotho/scripts/test-all.mjs`, and a scaffold `test-registry.mjs`; modify only
`.gitignore` outside `clotho/`.

This task lands first, under the existing CI, so that the Task 0 workflow PR adds a
package that already exists and passes: the CI workflow does not skip absent
packages, and a matrix entry naming a nonexistent package would land a knowingly
failing workflow-only PR.

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
      matrix change ships alone in Task 0, immediately after this task merges.
- [ ] **Exit:** package `npm test` is green locally, no spine or existing package
      source changed, and `package.json` has zero dependencies. CI enforcement of
      Clotho begins when Task 0 merges the matrix entry against this scaffold.

## Task 0: CI-workflow isolation PR (after Task 1)

**Files:** modify only `.github/workflows/ci.yml`.

- [ ] Add `clotho` to the existing CI package matrix without changing any existing
      package command. No other file changes in this PR.
- [ ] Set `fetch-depth: 0` for the `clotho` matrix entry's checkout so the job runs
      against full history: `actions/checkout@v4` is shallow by default, and
      `deriveRepositoryRef` rejects a shallow repository with a stable error
      (AM-16). Without full history the `clotho` job would fail closed rather than
      mint a wrong repository identity.
- [ ] Flag the PR explicitly as workflow-only in its title and description; it
      requires human review as a workflow change before any further Clotho feature
      task lands (per the documented self-skipping-reviewer failure).
- [ ] The matrix entry runs the standard package command against the already-merged
      Task 1 scaffold and must be green in this PR's own CI run; no red or skipped
      state is expected or tolerated, and no branch-protection bypass is used.
- [ ] **Exit:** the workflow-only PR is human-reviewed and merged, the `clotho` CI
      job is green against the scaffold with full-history checkout, and every
      existing package's CI job is unchanged and green. Task 2 onward proceeds
      under CI enforcement.

## Task 2: Closed registries, canonical identity, and endpoint validation

**Interfaces:**

```text
NODE_KINDS: ReadonlySet<string>
EDGE_KINDS: ReadonlySet<string>
ASSERTION_STATUS: ReadonlySet<string>
canonicalJson(value) -> string
deriveNodeId({kind, locator}) -> lowercase SHA-256
validateLocator(kind, locator, {repositoryRef}) -> void | throws
validateSourceRef(sourceRef) -> void | throws
validateAssertionStatus(assertedBy, assertionStatus) -> void | throws
validateEdgeInput(edgeInput, {repositoryRef}) -> void | throws
docAddressKey({path, heading_path}) -> string
deriveRepositoryRef(git) -> 'git-root:<40-hex>' | throws
```

- [ ] Implement the private-Set read-only facade for all three registries; do not use
      `Object.freeze(new Set(...))` as a mutation boundary.
- [ ] Implement the exact canonicalization, path, heading, locator, provenance,
      source-ref, status-coupling, node-id, and endpoint rules above. Every
      repository-scoped locator (all kinds except `commit`, the single named
      globally-addressed exception) carries `repository_ref` and its content
      binding: `blob_sha` for `code-symbol`, `repository-file`, `test`, and
      `check-contract`; `text_sha256` for `doc-section`, `contract-clause`, and
      `decision`; `entry_hash` for `concern` and `obligation`; `summary_sha256`
      for `run-evidence`.
- [ ] Implement `deriveRepositoryRef` with the shallow guard: invoke exactly
      `git rev-parse --is-shallow-repository` and require the output to be exactly
      `false`, otherwise throw the stable shallow-repository error; then invoke
      exactly `git rev-list --max-parents=0 HEAD`, require exactly one full 40-hex
      output line (more than one root commit is fatal in Phase 1), and return
      `git-root:<sha>`. Locator validation receives the derived value and rejects
      any locator whose `repository_ref` differs from it.
- [ ] Reject unknown kinds, unknown statuses, status/assertor coupling violations,
      extra or missing fields, inherited enumerable fields, malformed identifiers,
      traversal, noncanonical paths, short SHAs, uppercase hashes, empty provenance,
      wrong `repository_ref` values, missing or malformed `blob_sha`,
      `text_sha256`, `entry_hash`, and `summary_sha256` content hashes,
      endpoint-kind mismatches, and caller-owned ledger fields.
- [ ] Units cover exact registry membership and counts for all three sets; all three
      mutators on each facade; iteration; unknown kinds and statuses; each locator
      schema including the content-bound forms of every repository-scoped kind
      (`code-symbol`, `repository-file`, `test`, `doc-section`, `contract-clause`,
      `decision`, `concern`, `obligation`, `check-contract`, `run-evidence`) and
      the `commit` exception taking no `repository_ref`; missing/extra fields
      including missing `repository_ref` or content hash on each repository-scoped
      kind; `deriveRepositoryRef` happy path, shallow-repository rejection with
      the stable error (via an injected git function returning `true` and a
      non-`false` malformed value), multi-root fatality, and malformed output
      fatality; a mismatched `repository_ref` rejection; every path
      rejection; canonical key-order independence; array-order sensitivity;
      non-JSON values; same-input stability; malformed source refs; mismatched
      node ids; distinct node ids for the same `{path, symbol}` at two different
      `blob_sha` values; every allowed and representative forbidden endpoint pair,
      including all four `depends-on` rows involving `repository-file` and the
      exact spec v2.3 `discharges` matrix (`code-symbol -> obligation` and
      `obligation -> contract-clause` allowed; other `discharges` endpoint pairs
      rejected); each valid and each invalid initial status/assertor coupling; and
      `supersedes` provenance including a `repository-file` rename pair and a
      content-changed `code-symbol` version pair.
- [ ] **Exit:** `registry.mjs` is the only authoritative node/edge/status membership
      source and `npm test` is green.

## Task 3: Signed thread ledger

**Interfaces:**

```text
createLedger(path, {signKey?, wovenAt?, repoHead?, repositoryRef?})
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
- [ ] Capture one canonical `wovenAt`, one validated `repoHead`, and one validated
      `repositoryRef`; obtain the head with exact arguments `git rev-parse HEAD`
      and the ref with `deriveRepositoryRef` (including its shallow guard) unless a
      test injects them. Record `repository_ref` in the header; every appended
      locator must carry exactly that value.
- [ ] Write the canonical header immediately. Serialize appends through one file
      descriptor, reject appends after close, and make `close` idempotent only after
      a successful first close.
- [ ] `appendEdge` validates the complete edge input including `assertion_status`
      coupling and `repository_ref` agreement with the header, re-derives endpoint
      ids, adds the captured timestamp and chain fields, signs the record hash,
      writes one complete LF-terminated line, and returns the signed record.
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
      inventory weaver-id, version, implementation-file, and orchestrator-file
      lists and the closed published state set (`executed | skipped`): five entries
      in inventory order, each with well-formed nonempty `implementation_refs`
      content addresses and deterministic `inspected_source_counts`, plus nonempty
      well-formed `orchestrator_refs` and content-addressed `inventories_consumed`
      entries. It rejects any `failed` or unknown state and rejects coverage that
      marks any weaver `skipped` when an already-appended edge is asserted by that
      weaver. It writes the signed trailer as the final chained record, flushes,
      closes the descriptor, and only then reports success. A close without valid
      coverage data throws and poisons the ledger.
- [ ] An append or close failure poisons the ledger object; later appends throw and
      the CLI must not publish the temporary file.
- [ ] `verifyLedger` incrementally parses exact lines, validates canonical encoding,
      the single first header including its `repository_ref` shape, timestamps, all
      record fields, locator `repository_ref` agreement with the header, endpoint
      semantics, status couplings, human-only status adjudication, `status_of`
      back-references to earlier edge records, signatures, record hashes, chain
      links, the shape of every manifest `implementation_refs`,
      `orchestrator_refs`, and `inventories_consumed` content address, the absence
      of `failed` or unknown weaver states in the manifest, and the consistency of
      weaver assertors with manifest states. It requires exactly one trailer as the
      final record. It returns the parsed manifest; `records` contains only trusted
      signed edge and status records, not the header or trailer. On a failure it
      returns only records before the first failing line or trailer-level
      invariant, marks the result `ok: false`, and never confers trust on a suffix.
      It also returns `ok: false` for an empty ledger or a ledger missing its
      trailer.
- [ ] `readEdges` uses `fs.createReadStream` and an incremental line splitter, skips
      the header, and yields signed records including status records and the trailer
      without buffering the complete file. It performs structural parsing but does
      not confer trust; callers query only records from a successful `verifyLedger`
      result.
- [ ] Units cover exclusive creation; generated and injected keys; happy append,
      close-with-coverage, and verify; append after close; every append rejection
      including status-coupling violations and a locator whose `repository_ref`
      differs from the header; status-record append; edge-only back-reference
      validation; human acceptance, rejection, and supersession; model
      self-promotion rejection; weaver-transition rejection; unknown `status_of`;
      malformed, missing, duplicate, and misplaced headers; missing, duplicate, and
      non-final trailers; close without coverage; malformed, empty, or missing
      `implementation_refs`; malformed or missing `orchestrator_refs`; malformed
      `inventories_consumed` refs; close-time rejection of a `failed` state and of
      skipped-weaver records; independently signed verification fixtures containing
      an edge from a skipped weaver and containing a manifest with a `failed` state
      (both must fail verification); noncanonical lines; signed unknown kinds;
      mismatched ids; every permitted `depends-on` endpoint including
      `repository-file -> code-symbol`; wrong endpoint kinds; wrong timestamp;
      altered signature; altered record hash; middle-line byte tamper; middle-line
      removal; partial final line; removal of the trailer; removal of a complete
      tail record plus the trailer; and a valid human `supersedes` edge.
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
  symbols: [{path, symbol, blob_sha}],
  files: [{path, blob_sha}],
  git(args, options?) -> stdout
}
```

- [ ] Inventory every current package root once and commit the exact sorted paths in
      `inventory.mjs`. Commit `DOC_ROOTS`, exact configured ledger files plus
      adapter ids, exact run directories plus summary files, the five weaver ids, a
      committed integer version per weaver (a human-readable label only; the
      manifest's `implementation_refs` carry the proving content addresses), and a
      committed per-weaver implementation-file list equal to the transitive static
      relative-import closure of each weaver module (the weaver module, shared
      substrate such as `clotho/weavers/util.mjs`, `clotho/registry.mjs`, and
      `clotho/inventory.mjs`, and any permitted `merkle-dag` primitives
      participating in identity, canonicalization, or hashing). The driver computes
      `implementation_refs` from these lists. **Per D17 (AM-17), this task commits
      per-weaver inventories only, covering the weavers that exist at this PR
      (git and code); Task 4b extends them for its weavers; the orchestrator-file
      inventory is committed in Task 5, the PR that creates `weave.mjs`. No
      inventory may name a file that does not yet exist in the repository at the PR
      that commits it.** `repository_ref` is derived per weave via
      `deriveRepositoryRef`, never hardcoded. Do not discover new top-level inputs
      at runtime. A future package or evidence source requires an inventory change
      and tests.
- [ ] `scripts/test-closure.mjs` derives the transitive static relative-import
      closure of each committed weaver module with the lexical import scanner, and
      fails when any committed implementation-file inventory omits a file in the
      derived closure or lists a file outside it — including any inventory entry
      naming a nonexistent file. The inventories are proven equal to the closures,
      never trusted. This test lands with the first weaver inventories in this task
      and extends in Task 4b as its weavers land; Task 5 adds the orchestrator
      closure assertion in the same PR that commits the orchestrator inventory.
- [ ] Set `DOC_ROOTS` to the reviewed documentation and contract roots. Exclude
      `docs/runs/` from doc-weaver because run evidence has a separate owner, and
      exclude `docs/runs/clotho-self-weave/` from every inventory.
- [ ] `util.mjs` walks only real regular files beneath configured roots. It rejects
      root escape and symlinked input rather than following it; normalizes all output
      paths to validated repository-relative POSIX paths; and sorts directory entries.
- [ ] The git wrapper permits only the exact subcommands and argument shapes needed
      for `rev-parse HEAD`, `rev-parse --is-shallow-repository`,
      `rev-list --max-parents=0 HEAD`, `hash-object --no-filters -- <path>`, and
      path-scoped `log`. It uses `execFileSync('git', args, {cwd: repoRoot, ...})`
      with no shell.
- [ ] Implement a dependency-free lexical scanner that skips comments and recognizes
      strings without executing code. Phase 1 export grammar is exactly
      `export function`, `export async function`, `export const`, and `export class`
      followed by an identifier. Unsupported re-exports, computed exports, default
      exports, and dynamic symbol flow warn and emit no inferred symbol.
- [ ] Seed `ctx.symbols` from `.mjs` files below closed package roots, each
      descriptor carrying the defining file's `blob_sha` from
      `git hash-object --no-filters`, and sort by `(path, symbol)`. Duplicate
      descriptors are an error. Seed `ctx.files` with a `repository-file` descriptor
      for every walked file below the closed package roots (source modules,
      manifests, scripts, configuration), with `blob_sha` from the same command,
      sorted by `path`. Symbol and file descriptors for the same path carry the
      same `blob_sha` by construction (one hash per walked file per weave).
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
      `blob_sha`; symbol-level locators carrying `repository_ref` and the defining
      file's `blob_sha`; no-export named-import preservation as
      `repository-file -> code-symbol`; deduplication; unused imports; comments and
      strings not counting as uses; metacharacter-safe matching;
      `unrepresentable-consumer` only for unresolvable specifiers; root/symlink
      rejection; closure-equality failure fixtures (an inventory missing a closure
      file, an inventory listing an extra file, and an inventory naming a
      nonexistent file all fail); and byte-equal `{edges, warnings}` over two runs.
- [ ] **Exit:** the inventory and shared contract are merged, the closure test
      proves the committed per-weaver inventories name only existing files equal to
      their derived closures, both weavers are deterministic, and `npm test` is
      green.

## Task 4b: Test, documentation, and ledger weavers

- [ ] `test.mjs` considers sorted `scripts/test-*.mjs` files plus literal `.mjs`
      test paths referenced by the package `check` or `test` command. Referenced paths
      must remain inside that package root. Command strings are parsed only as text;
      no command is executed. `test` node locators carry `{repository_ref, path,
      blob_sha}` with the test file's exact scanned-byte blob SHA.
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
      root are `contract-clause`; both node locators carry
      `{repository_ref, path, heading_path, text_sha256}`. The whole Markdown file
      blob is the source ref.
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
      `motivated-by` with a ledger source ref; `concern` and `obligation` node
      locators carry `{repository_ref, ledger_path, entry_hash}`.
- [ ] A trusted obligation naming a symbol emits `code-symbol -> obligation`
      `discharges` only when the adapter returns nonempty validated discharge evidence.
      Missing discharge evidence warns and emits no edge.
- [ ] Emit `obligation -> contract-clause` `discharges` only when the same trusted
      obligation contains an exact `{path, heading_path, text_sha256}` reference that
      resolves uniquely in the current configured contract sections. A stale,
      partial, or ambiguous reference warns and emits no clause edge. (These two
      `discharges` shapes are exactly the spec v2.3 matrix: `code-symbol ->
      obligation` and `obligation -> contract-clause`.)
- [ ] Each configured run source names one directory below `docs/runs/` and one exact
      summary file. If its validated bytes contain the symbol token in declared
      summary fields, emit `code-symbol -> run-evidence` `evidenced-by`; the node
      locator is `{repository_ref, path, summary_sha256}` where `path` locates the
      directory and `summary_sha256` is the SHA-256 of the summary file's exact
      validated bytes; the source ref locates the summary file by blob SHA.
- [ ] Extend the committed per-weaver implementation-file inventories and the
      closure test for the three weavers added in this task, per D17: every newly
      committed inventory entry names a file that exists at this PR.
- [ ] Add fixtures for a direct test; a script-executed test target; a two-section
      document containing `alpha` and `alphabet`; a document naming a file path;
      duplicate headings; a matching contract clause; a valid concern; a discharged
      obligation with an exact clause ref; stale and missing clause refs; a
      malformed final ledger line; a chain break with a suffix; and one run summary.
- [ ] Units assert exact endpoint kinds, directions, locators (including
      `repository_ref` plus the content binding on every node kind these weavers
      emit: `test`, `doc-section`, `contract-clause`, `concern`, `obligation`, and
      `run-evidence`), hashes, source refs, assertor ids, statuses, warning codes,
      and counts; `alphabet` does not match `alpha`; ambiguous/stale clauses
      produce no edge; malformed input never validates a suffix; and all five
      weavers return byte-equal results across repeated runs.
- [ ] **Exit:** every weaver obeys the same `{edges, warnings}` contract, all five
      per-weaver inventories are closure-proven, and `npm test` is green.

## Task 5: Queries, complete-weave driver, and advisory invariant

**Interfaces:**

```text
threadsOf(records, nodeId, {manifest?, includeProposals?} = {})
  -> {byKind: Map<edgeKind, record[]>, coverageUnknown: weaverId[]}
blastRadius(records, nodeId, depth, {manifest?, includeProposals?} = {})
  -> {affected: nodeDescriptor[], evidence: record[], edges: record[],
      truncated, coverageUnknown: weaverId[]}
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
      weaver, expected_kind}` gap records instead of `missing-edge` claims). Any
      non-`executed` state means coverage-unknown; in a verified published manifest
      that state is always `skipped`, and internal verifier fixtures carrying
      `failed` never reach queries because verification rejects them. A missing
      manifest leaves `coverageUnknown` empty for `threadsOf`/`blastRadius` but is
      an error for `why`/`reportGaps` when `expectedKinds` is nonempty: naming a
      specific missing relationship requires knowing coverage. Independently of gap
      construction, an edge asserted by a non-`executed` weaver makes the
      records/manifest pair invalid and the query throws.
- [ ] `threadsOf` groups every touching edge by kind and sorts each group by the
      canonical edge tuple.
- [ ] `blastRadius` requires a nonnegative integer depth and implements the frozen
      spec semantics. `affected` is the **inverse transitive closure of
      `depends-on`**: cycle-safe BFS from the target node following `depends-on`
      edges only in the inverse direction, from the changed dependency to its
      consumers. Forward `depends-on` is never followed: a target's own dependencies
      do not break when the target changes. `evidence` is the set of outgoing
      `verified-by` edges of affected artifacts (including the target). **Traversal
      stops at test nodes:** a test node reached through `verified-by` contributes
      evidence but is never expanded, so test co-coverage cannot pull sibling
      artifacts into `affected`. `edges` is the stable union of traversed
      `depends-on` records and `evidence` records; `affected` contains unique stable
      node descriptors. `truncated` is true exactly when an inverse-`depends-on`
      neighbor remains unvisited beyond the requested depth; evidence attachment
      never sets it.
- [ ] `why` collects the target's outgoing `introduced-by`, `motivated-by`,
      `documented-in`, and `evidenced-by` records. It follows target
      `code-symbol -> obligation` `discharges` records and then each obligation's
      outgoing `obligation -> contract-clause` `discharges` records — the exact
      spec v2.3 walk (code-symbol → obligation → contract-clause). Traversal is
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
      stable node descriptors; **a forward-dependency non-inclusion case** (the
      target's own dependency is absent from `affected`); **a shared-test
      non-propagation case** (two artifacts verified by one test where only the
      dependency-connected artifact appears in `affected`); **a truncation-source
      case** (`truncated` set only by unvisited inverse-dependency neighbors, and
      not set when only evidence attachment remains); true and false truncation;
      complete why traversal including the two-hop discharge walk (code-symbol →
      obligation → contract-clause); a missing target concern; missing target
      documentation; missing target obligation; obligation without clause
      discharge; changed, deleted, ambiguous, and unchanged document sections;
      default exclusion of `model-proposal` records and opt-in marked inclusion;
      effective status resolution through human acceptance and rejection records;
      rejection of model self-promotion and status-of-status records; never
      returning status records or `rejected`/`superseded` facts; `coverage-unknown`
      gaps for skipped weavers versus `missing-edge` for executed ones; rejection of
      edges asserted by non-`executed` weavers; the missing-manifest error for
      expected-kind queries; and stable gap ordering.
- [ ] `weave.mjs` exports guarded orchestration and runs as a CLI only when it is the
      invoked entry point. It has a Node shebang and imports all roots, the five
      exact ids, and the per-weaver implementation-file and orchestrator-file lists
      from `inventory.mjs`.
- [ ] **Commit the complete orchestrator-file inventory in this PR** (D17/AM-17):
      the list covering `clotho/weave.mjs`, `clotho/thread-ledger.mjs`, and the
      shared registry/canonicalization machinery lands here, in the same PR that
      creates `weave.mjs`, so no inventory ever names a file that does not yet
      exist. The driver computes `orchestrator_refs` from this list.
- [ ] Extend `scripts/test-closure.mjs` in this same PR to derive the static
      relative-import closure of the orchestrator entry points (`weave.mjs` and
      `thread-ledger.mjs`) and fail on any omitted or extra file in the committed
      orchestrator-file inventory. Orchestrator closure equality is enforced from
      this task onward; per-weaver closure equality has been enforced since Tasks
      4a/4b.
- [ ] `--skip <id>` is repeatable but rejects unknown or duplicate ids. `--out`
      accepts a validated repository-relative path only below `.telos/clotho/` or the
      explicit self-export directory. Existing destinations are rejected.
- [ ] The driver captures one timestamp and repo head, derives `repository_ref`
      with `deriveRepositoryRef` (a shallow repository or multi-root output is
      fatal), computes every weaver's `implementation_refs`, the
      `orchestrator_refs`, and every inventory `source_ref` with
      `git hash-object --no-filters` from the committed implementation-file and
      orchestrator-file lists, builds one symbol and one file table, and runs
      non-skipped weavers. **Any weaver failure aborts the weave:** if a weaver
      throws, the driver removes the temporary file, never publishes the
      destination, and exits nonzero reporting the weaver id and its stable error
      code. No partial advisory artifact exists in Phase 1. For a successful run it
      records per-weaver
      `{id, version, implementation_refs, state, inspected_source_counts}` (skipped
      weavers recorded as `skipped` with zero counts and their implementation refs
      intact), aggregates and canonical-sorts warnings and deduplicated edges,
      appends edges in that exact order, and closes with the complete coverage data
      including `orchestrator_refs` so the signed trailer is written. It never
      appends an edge returned under the id of a skipped weaver.
- [ ] Write to an exclusive sibling temporary file. Close and run `verifyLedger`
      before atomically renaming to the absent destination. On weaving, append,
      close, coverage-consistency, or verification failure, exit nonzero, remove the
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
- [ ] Driver units cover the abort contract: a fixture weaver that throws must
      leave no temporary file, publish no destination, and exit nonzero with the
      stable error code; a `--skip` run must publish a manifest whose only
      non-`executed` state is `skipped`.
- [ ] **Exit:** a real-repository weave completes, verifies, carries a complete and
      record-consistent signed manifest with mechanism-bound provenance (weaver
      closures and orchestrator refs, all inventories closure-proven in the PRs
      that created their files), and remains below the advisory boundary;
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
      only: no regex, glob, prefix, short SHA, or node id. Locator matches carry the
      full content-bound schemas, including the derived `repository_ref` and the
      audited `blob_sha`, `text_sha256`, `entry_hash`, or `summary_sha256` values
      from the reviewed repository state, for every repository-scoped kind they
      name.
- [ ] Validate group semantics: definition is the target node; consumers are incoming
      `depends-on` edges; tests are reachable `verified-by` edges; introduction is
      `introduced-by`; documentation targets `doc-section`; concern is
      `motivated-by`; run-evidence is `evidenced-by`; and contract includes the
      audited discharge path ending at a `contract-clause` (the spec v2.3 two-hop
      walk: `code-symbol --discharges--> obligation --discharges-->
      contract-clause`).
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
- [ ] Step 2: call `verifyLedger`; require `ok: true`, a header whose
      `repository_ref` equals the independently derived value, and a manifest
      showing all five weavers `executed`, well-formed `implementation_refs` for
      every weaver, well-formed `orchestrator_refs`, and content-addressed
      `inventories_consumed` entries before any query or expected-set match.
      Queries use only `records` and `manifest` returned by this successful
      verification. Verification must already have established that every
      weaver-asserted edge agrees with that manifest.
- [ ] Step 3: derive the target `code-symbol` from
      `{repository_ref, path: 'merkle-dag/obligation.mjs',
      symbol: 'deriveExecutableRef', blob_sha}` with the derived repository ref and
      the audited current blob SHA. Call `why` with all five expected
      rationale/support kinds and call `blastRadius` at depth 3, both with the
      verified manifest. Build node descriptors solely from the target and verified
      edge endpoint descriptors. The fact set is the stable union of the target,
      `why.chain`, and `blastRadius.edges` (the inverse-dependency `affected`
      closure plus its `verified-by` evidence, per the frozen semantics).
- [ ] Require every expectation to match distinctly, all eight groups to be present,
      audited consumer/test multiplicities to match, ledger-only `why.gaps` to be
      empty, and the review set to be complete per the rule above.
- [ ] Independently build `currentDocs` from current configured docs/contracts and
      repeat `why` with that map. Require no drift gap. This freshness check may read
      current files; the preceding fact reconstruction remains ledger-only.
- [ ] Step 4: weave to a second unique ledger with
      `--skip clotho-doc-weaver`. Verify it and require its manifest to record
      `clotho-doc-weaver` as `skipped` with zero inspected sources (implementation
      refs intact) and the other four as `executed`. Require verification and the
      manifest-aware query validation to establish that no edge is asserted by
      `clotho-doc-weaver`. Rerun the same ledger-only calls with that manifest and
      require exactly the expected coverage failure containing
      `{gap: 'coverage-unknown', weaver: 'clotho-doc-weaver', expected_kind:
      'documented-in'}`—not a `missing-edge` claim, not merely a smaller result, and
      no fabricated `documented-in` edge. The deliberate coverage-unknown path is
      `skipped`; `failed` never appears in any published manifest.
- [ ] Remove documentation expectations for this negative run and require the other
      seven groups, including the ledger-derived contract discharge, still to match.
      Any gap other than the asserted `coverage-unknown` fails the test.
- [ ] Clean temporary ledgers in `finally` blocks without masking a prior assertion.
- [ ] **Exit:** `npm test` proves valid signatures, the signed and record-consistent
      coverage manifest with mechanism-bound provenance, the runtime ceiling, all
      eight groups, distinct expected matching, complete review-set reporting,
      current-doc freshness, and fail-closed `coverage-unknown` skipped-source
      behavior.

## Task 7: Reproduction evidence and documentation

- [ ] Update `docs/STATUS.md` and `docs/ROADMAP.md`, and move completed design and plan
      artifacts to `docs/history/` according to repository convention before
      generating final evidence.
- [ ] `docs/runs/clotho-self-weave/run.mjs` invokes a keyless full weave to a unique
      temporary path below `.telos/clotho/`. The self-export directory remains
      excluded from all input inventories, so repeated runs cannot consume an old
      summary or snapshot.
- [ ] Verify the temporary ledger—including its header `repository_ref`, its
      coverage manifest showing all five weavers `executed`, well-formed
      mechanism-bound `implementation_refs` and `orchestrator_refs` and
      `inventories_consumed` content addresses, and no manifest/record
      contradiction—and complete the flagship expected-set, review-set, gap, and
      current-doc checks before publishing any evidence file.
- [ ] Copy the verified ledger bytes to a temporary export file, compute its SHA-256,
      and atomically replace `thread-ledger.snapshot.jsonl`. This explicit export is
      not an append operation and never modifies the source temporary ledger.
- [ ] Write `summary.json` with input repo head, derived `repository_ref`, weave
      timestamp, public key, snapshot SHA-256, wall time, edge count, ledger bytes,
      per-weaver manifest entries including their `implementation_refs`, the
      `orchestrator_refs`, the `inventories_consumed` refs, all warnings, full why
      chain, blast-radius affected nodes, evidence, and edges, empty gaps, and all
      eight matched groups.
- [ ] Write `expected-match-report.json` with each expected entry, its unique matched
      fact, and zero unmatched expectations. Write `review-set.json` with every
      unmatched flagship-neighborhood fact, deterministically sorted, carrying no
      score or rank of any kind.
- [ ] Write `verification.json` with snapshot verification status, trusted record
      count, manifest weaver states, implementation refs, and orchestrator refs,
      manifest/record consistency status, closure-test status, advisory scanner
      file/package counts, every executed package test command, exit status, and
      Node version. Do not record absolute paths or nondeterministic process ids.
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
   evidenced `supersedes` (same-kind, `old_version --supersedes--> new_version`,
   including `repository-file` renames and content-changed symbol, test, and
   run-evidence versions).
2. **Document drift:** historical section hashes remain facts; a current-doc map
   reports changed, deleted, or ambiguous sections.
3. **Over-threading:** module-level conservative attribution and file-level fallback
   endpoints can add dependency edges; deterministic output and the mandatory
   flagship review-set artifact expose the noise without scoring it.
4. **Ledger growth:** runtime, count, bytes, and incremental reads are measured; no
   Phase 1 index is introduced. Content-bound locators enlarge every
   repository-scoped node descriptor; the same measurements cover the cost.
5. **Static grammar:** unsupported exports, re-exports, dynamic symbol flow, and
   indirect semantic references are not inferred. Imports terminating at modules are
   captured as `repository-file` facts rather than dropped; used named imports from a
   no-export consumer retain their resolved symbol through
   `repository-file -> code-symbol`; missing audited evidence still fails the
   flagship test.
6. **Self-signed identity:** an embedded ephemeral key proves internal consistency,
   not external authority. Clotho remains advisory and no durable-key policy is
   introduced. Manifest `implementation_refs` and `orchestrator_refs` identify the
   mechanism bytes that made each assertion; they do not confer external authority
   either.
7. **Tail deletion:** the signed final coverage trailer makes deletion of complete
   tail records detectable in a completed weave; wholesale file replacement or a
   never-completed weave remains covered by the external snapshot checkpoint SHA-256
   recorded in the summary.
8. **Proposal quarantine limits:** `model-proposal` records are excluded from
   default query results but still occupy ledger bytes and appear when explicitly
   included. Acceptance, rejection, or supersession requires an explicit
   human-authored, human-authorized status record targeting the earlier edge; model
   self-adjudication is invalid, and no automatic promotion path exists in Phase 1.
9. **Version-node churn:** because repository-scoped locators are content-bound,
   any byte change to a defining file, section, entry, or summary mints new version
   nodes across a re-weave. Cross-weave lineage is not inferred; it is carried only
   by explicit evidenced `supersedes` assertions, and each immutable per-weave
   ledger remains internally consistent.
10. **Abort-on-failure availability:** a single throwing weaver yields no advisory
    artifact at all rather than a partial one. This is the chosen Phase 1 contract;
    the rejected alternative (publishing partial artifacts with `failed` states) is
    recorded for provenance and may be revisited by a future authorized phase.
11. **Shared-history namespace:** because `repository_ref` is the root-commit
    lineage, clones and forks sharing the root commit weave into the same
    namespace by design. This is the deliberate spec v2.2 trade (identity is
    history lineage, not hosting); no hosting-based disambiguation exists in
    Phase 1.
12. **Full-history requirement:** the shallow guard means Clotho cannot weave in a
    shallow clone at all; it fails closed with a stable error rather than minting
    a boundary-commit identity. CI must check out full history (`fetch-depth: 0`),
    and any future consumer environment must do the same. This is the chosen trade:
    a refused weave over a wrong repository identity.