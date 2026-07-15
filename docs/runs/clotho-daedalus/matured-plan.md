# Clotho Phase 1 Implementation Plan

> **SUPERSEDED historical artifact.** This first-workshop convergence was
> cold-reviewed (`docs/clotho-phase-1-remediation.md`) and re-converged under the
> challengeable spec v2 by the delta workshop. The canonical submission candidate
> is **`docs/runs/clotho-daedalus-delta7/matured-plan-v8.md`**. The extracted copy
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

## Decisions

| ID | Decision | Binding consequence |
|---|---|---|
| D1 | Symbol renames are not inferred. | Git history is path-scoped and stops at a rename boundary. A missing lineage remains a gap until a human or model appends an evidenced `supersedes` assertion. |
| D2 | Documentation identity uses a heading path plus section-text SHA-256. | Current-document maps detect changed, deleted, or ambiguous sections without rewriting historical locators. |
| D3 | Static weavers favor visible over-threading over scores or inferred confidence. | An imported binding used in a module is attributed to every Phase 1 exported symbol in that module. Extra flagship facts are allowed, but every expected fact must match distinctly. |
| D4 | Ledger scale is measured rather than indexed in Phase 1. | Full weave runtime, edge count, and bytes are recorded; `readEdges` must prove that it yields before its input ends. |
| D5 | A weave owns one timestamp and one signing keypair. | Weavers never receive or emit time, signatures, record hashes, or chain fields. The ledger captures one canonical timestamp and uses it for its header and every edge. |
| D6 | Weaver implementation is split into two PRs. | Task 4a establishes the substrate and git/code weavers; Task 4b adds test/doc/ledger weavers against the already-merged contract. |
| D7 | Each weave is a separately created immutable artifact. | Ledger creation uses exclusive create, append is serialized, completed output is closed and verified, and the CLI never silently overwrites an existing ledger. |
| D8 | Input inventories are closed and the self-weave output directory is never an input. | Package, document, ledger, and run-evidence sources are committed constants. `docs/runs/clotho-self-weave/` is excluded from all weavers, preventing recursive or stale self-reference. |

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
  unknown source-reference schemes, malformed locators, mismatched node ids,
  unsupported configured ledger formats, and untrusted evidence are rejected or
  omitted with deterministic warnings. They never produce an inferred edge.
- **Identity preservation:** existing commit SHAs, ledger entry hashes, concern refs,
  obligation refs, and contract ids remain inside their locators. Clotho derives a
  containing node id; it does not replace the existing identity.
- **Evidence required:** every edge has nonblank `asserted_by` and a fully validated
  `source_ref`.
- **Read-only weaving:** weavers perform static reads and invoke only allowlisted
  `git` commands with `execFileSync` and no shell. They do not import scanned modules
  or execute package scripts.
- **Write boundary:** normal output is below `.telos/clotho/`, which is ignored.
  Only the explicit snapshot export below `docs/runs/clotho-self-weave/` is committed.
- **Warnings are data, not edges:** malformed or missing evidence produces a stable
  warning. A caller requesting the corresponding evidence kind receives a query gap.
- **Exit:** `cd clotho && npm test` is green, every existing package remains green,
  no spine file changed, and verified reproduction evidence is committed.

## File structure

| Path | Responsibility |
|---|---|
| `clotho/package.json` | Private ESM package, Node engine, fixed check/test commands, no dependencies. |
| `clotho/inventory.mjs` | Closed package, document, ledger-adapter, run-summary, weaver-id, exclusion, and fatal-warning inventories. |
| `clotho/registry.mjs` | Read-only kind registries, canonical encoding, locator/source/endpoint validation, document keys, and node-id derivation. |
| `clotho/thread-ledger.mjs` | Exclusive creation, signing, chaining, closing, verification, and incremental edge reads. |
| `clotho/weavers/util.mjs` | Closed-root walks, lexical extraction, Markdown sections, token matching, current-byte blob refs, and the git wrapper. |
| `clotho/weavers/git.mjs` | `code-symbol -> commit` `introduced-by` edges. |
| `clotho/weavers/code.mjs` | `code-symbol -> code-symbol` `depends-on` edges. |
| `clotho/weavers/test.mjs` | `code-symbol -> test` `verified-by` edges. |
| `clotho/weavers/doc.mjs` | `code-symbol -> doc-section` or `contract-clause` `documented-in` edges. |
| `clotho/weavers/ledger.mjs` | Concern, obligation, contract-discharge, and run-evidence edges through closed adapters. |
| `clotho/query.mjs` | `threadsOf`, `blastRadius`, `why`, and `reportGaps`. |
| `clotho/weave.mjs` | Guarded CLI entry point and complete-weave orchestration. |
| `clotho/scripts/check.mjs` | Recursively invokes `node --check` for every Clotho `.mjs` file. |
| `clotho/scripts/test-all.mjs` | Spawns every named `test-*.mjs` script in a committed fixed order. |
| `clotho/scripts/test-registry.mjs` | Registry, canonicalization, locator, endpoint, and identity units. |
| `clotho/scripts/test-ledger.mjs` | Creation, append, signature, chain, tamper, truncation, and streaming units. |
| `clotho/scripts/test-weavers.mjs` | Fixture-based exact-output and determinism tests. |
| `clotho/scripts/test-query.mjs` | Query traversal, validation, truncation, gap, and drift units. |
| `clotho/scripts/test-advisory.mjs` | Repository-wide structural no-import check and scanner units. |
| `clotho/scripts/test-flagship.mjs` | Real-repository full and skipped-weaver acceptance. |
| `clotho/scripts/expected-flagship.json` | Hand-audited exact-subset expectations for eight source groups. |
| `clotho/scripts/fixtures/` | Miniature packages, Markdown, ledgers, streams, and run summaries. |
| `.github/workflows/ci.yml` | Adds `clotho` to the package matrix. |
| `.gitignore` | Ignores `.telos/clotho/`. |
| `docs/runs/clotho-self-weave/` | Reproduction script, snapshot, summary, match report, and verification report. |
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
NODE_KINDS = contract-clause, code-symbol, test, commit, concern, obligation,
             check-contract, run-evidence, doc-section, decision

EDGE_KINDS = depends-on, introduced-by, motivated-by, verified-by,
             documented-in, evidenced-by, discharges, supersedes
```

Both exports are read-only Set facades backed by private native Sets. They expose
`size`, `has`, iteration, `keys`, `values`, `entries`, and `forEach`. Their `add`,
`delete`, and `clear` methods always throw. Kind literals may appear as record values,
switch cases, and expectations; no second authoritative membership list is allowed.

### Locator schemas

Objects reject missing and extra fields.

| Kind | Locator |
|---|---|
| `code-symbol` | `{path, symbol}` where `symbol` is a nonempty JavaScript identifier exported by the Phase 1 grammar. |
| `test` | `{path}`. |
| `commit` | `{sha}` with a lowercase full 40-hex SHA. |
| `doc-section` | `{path, heading_path, text_sha256}`. |
| `contract-clause` | `{path, heading_path, text_sha256}`. |
| `concern` | `{ledger_path, entry_hash}`. |
| `obligation` | `{ledger_path, entry_hash}`. |
| `check-contract` | `{path, contract_id}` with a nonblank contract id. |
| `run-evidence` | `{path}` naming a configured directory below `docs/runs/`. |
| `decision` | `{path, heading_path, text_sha256}`. |

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

### Endpoint compatibility

Append and verification both enforce this matrix:

| Edge | Allowed direction |
|---|---|
| `introduced-by` | `code-symbol -> commit` |
| `depends-on` | `code-symbol -> code-symbol` |
| `verified-by` | `code-symbol -> test` |
| `documented-in` | `code-symbol -> doc-section` or `code-symbol -> contract-clause` |
| `motivated-by` | `code-symbol -> concern` |
| `evidenced-by` | `code-symbol -> run-evidence` |
| `discharges` | `code-symbol -> obligation` or `obligation -> contract-clause` |
| `supersedes` | old node -> new node of the same kind; `asserted_by` must be `human` or begin with `model:` |

There is no file or module node. A consumer module with no representable exported
symbol yields `unrepresentable-consumer` and no `depends-on` edge.

### Header and signed records

The first canonical JSONL line is structurally equivalent to:

```text
{clotho_weave_header: {pub_key, woven_at, repo_head, weave_version: 1}}
```

`pub_key` is canonical base64 SPKI for an Ed25519 public key. `woven_at` must equal
`new Date(value).toISOString()`. `repo_head` is a lowercase full 40-hex SHA.

Each following canonical line contains the edge payload:

```text
edge_kind, from_node, to_node,
from_locator: {kind, locator}, to_locator: {kind, locator},
asserted_by, source_ref, woven_at
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

The header is therefore bound by the first edge. A header-only ledger is invalid.
Dropping a final complete signed line remains intentionally undetectable without an
external checkpoint; a partial final line or removed middle line is detected.

A weaver `edgeInput` contains only the edge payload fields except `woven_at`. The
ledger rejects caller-supplied time, predecessor, hash, signature, or header fields.

### Weaver result and warning contract

```text
weave(ctx) -> Promise<{edges: edgeInput[], warnings: warning[]}>
warning = {weaver, code, path, detail}
```

Warning fields are repository-relative and contain no absolute paths, timestamps, or
platform-specific separators. Results sort edges by
`(edge_kind, from_node, to_node, source_ref, asserted_by)` and warnings by
`(weaver, code, path, detail)`. Exact duplicate edge inputs are removed; records with
different evidence or assertors remain distinct.

`inventory.mjs` contains a closed `FATAL_WARNING_CODES` set for structural failures
such as root escape, symlink input, unsupported configured ledger format, invalid
configured ledger entry, chain failure, invalid content address, and duplicate
heading address. Missing matches and unrepresentable static grammar produce nonfatal
warnings; flagship expected-set and gap checks decide whether they are acceptable.

## Task 1: Package scaffold and CI wiring

**Files:** create `clotho/package.json`, `clotho/scripts/check.mjs`,
`clotho/scripts/test-all.mjs`, and a scaffold `test-registry.mjs`; modify only
`.github/workflows/ci.yml` and `.gitignore` outside `clotho/`.

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
- [ ] Add `.telos/clotho/` to `.gitignore` and `clotho` to the existing CI package
      matrix without changing any existing package command.
- [ ] **Exit:** CI is green, no spine or existing package source changed, and
      `package.json` has zero dependencies.

## Task 2: Closed registries, canonical identity, and endpoint validation

**Interfaces:**

```text
NODE_KINDS: ReadonlySet<string>
EDGE_KINDS: ReadonlySet<string>
canonicalJson(value) -> string
deriveNodeId({kind, locator}) -> lowercase SHA-256
validateLocator(kind, locator) -> void | throws
validateSourceRef(sourceRef) -> void | throws
validateEdgeInput(edgeInput) -> void | throws
docAddressKey({path, heading_path}) -> string
```

- [ ] Implement the private-Set read-only facade; do not use
      `Object.freeze(new Set(...))` as a mutation boundary.
- [ ] Implement the exact canonicalization, path, heading, locator, provenance,
      source-ref, node-id, and endpoint rules above.
- [ ] Reject unknown kinds, extra or missing fields, inherited enumerable fields,
      malformed identifiers, traversal, noncanonical paths, short SHAs, uppercase
      hashes, empty provenance, endpoint-kind mismatches, and caller-owned ledger
      fields.
- [ ] Units cover exact registry membership and counts; all three mutators; iteration;
      unknown kinds; each locator schema; missing/extra fields; every path rejection;
      canonical key-order independence; array-order sensitivity; non-JSON values;
      same-input stability; malformed source refs; mismatched node ids; every allowed
      and representative forbidden endpoint pair; and `supersedes` provenance.
- [ ] **Exit:** `registry.mjs` is the only authoritative node/edge membership source
      and `npm test` is green.

## Task 3: Signed thread ledger

**Interfaces:**

```text
createLedger(path, {signKey?, wovenAt?, repoHead?})
  -> {header, appendEdge(edgeInput), close()}
verifyLedger(path)
  -> Promise<{ok, header?, records, errors[]}>
readEdges(path, {openReadStream?} = {})
  -> AsyncIterable<signedEdgeRecord>
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
- [ ] `appendEdge` validates the complete edge input, re-derives endpoint ids, adds
      the captured timestamp and chain fields, signs the record hash, writes one
      complete LF-terminated line, and returns the signed record.
- [ ] An append or close failure poisons the ledger object; later appends throw and
      the CLI must not publish the temporary file.
- [ ] `verifyLedger` incrementally parses exact lines, validates canonical encoding,
      the single first header, timestamps, all record fields, endpoint semantics,
      signatures, record hashes, and chain links. It returns only the trusted prefix
      in `records`, marks all records after the first failure untrusted, and returns
      `ok: false` for any error or for an empty ledger.
- [ ] `readEdges` uses `fs.createReadStream` and an incremental line splitter, skips
      the header, and yields signed records without buffering the complete file. It
      performs structural parsing but does not confer trust; callers query only
      records from a successful `verifyLedger` result.
- [ ] Units cover exclusive creation; generated and injected keys; happy append,
      close, and verify; append after close; every append rejection; malformed,
      missing, duplicate, and misplaced headers; noncanonical lines; signed unknown
      kinds; mismatched ids; wrong endpoint kinds; wrong timestamp; altered signature;
      altered record hash; middle-line byte tamper; middle-line removal; partial final
      line; removal of one complete tail record; and a valid human `supersedes` edge.
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
  packageRoots,
  docRoots,
  ledgerSources,
  runSources,
  symbols: [{path, symbol}],
  git(args, options?) -> stdout
}
```

- [ ] Inventory every current package root once and commit the exact sorted paths in
      `inventory.mjs`. Commit `DOC_ROOTS`, exact configured ledger files plus adapter
      ids, and exact run directories plus summary files. Do not discover new top-level
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
      `(path, symbol)`. Duplicate descriptors are an error.
- [ ] Identifier matching uses tokens or escaped guards against
      `[A-Za-z0-9_$]`; regex metacharacters in searched text can never alter the
      matcher.
- [ ] `git.mjs` invokes, for each symbol, exactly
      `git log -S<symbol> --format=%H --reverse -- <path>`. It validates every output
      line as a full SHA and emits one `code-symbol -> commit` `introduced-by` edge
      for the first result with `source_ref` `git:<same-sha>`. No result warns and
      emits no edge.
- [ ] `code.mjs` accepts static named relative imports with optional aliases and an
      explicit `.mjs` target. It resolves only to seeded exports. If an imported local
      binding occurs as an identifier token outside its import declaration, emit a
      `depends-on` edge from every seeded export in the consuming module to the
      imported symbol. The consuming file blob is the source ref.
- [ ] If such a binding is used but the consumer has no Phase 1 export, emit one
      stable `unrepresentable-consumer` warning per imported target and no edge.
      Unused imports emit no edge.
- [ ] Add fixture modules where `pkg-a/one.mjs` exports `alpha`, `pkg-b/two.mjs`
      imports it under an alias and uses it from two exports, another importer has no
      export, and a mock git function records the exact path-scoped arguments.
- [ ] Units assert the exact git call and edge; earliest-result selection; malformed
      git output failure; conservative code edges; alias resolution; deduplication;
      unused imports; comments and strings not counting as uses; metacharacter-safe
      matching; no file node; root/symlink rejection; and byte-equal
      `{edges, warnings}` over two runs.
- [ ] **Exit:** the inventory and shared contract are merged, both weavers are
      deterministic, and `npm test` is green.

## Task 4b: Test, documentation, and ledger weavers

- [ ] `test.mjs` considers sorted `scripts/test-*.mjs` files plus literal `.mjs`
      test paths referenced by the package `check` or `test` command. Referenced paths
      must remain inside that package root. Command strings are parsed only as text;
      no command is executed.
- [ ] A static named import resolving to a seeded symbol emits
      `code-symbol -> test` `verified-by`; the test file blob is the source ref.
      Transitive test relevance is obtained later through `blastRadius`, not inferred
      by test-weaver.
- [ ] Markdown splitting recognizes ATX and Setext headings outside fenced code.
      A section is the exact byte slice from its heading through the byte before the
      next heading of any level; preamble is the preceding slice. Section hashes use
      SHA-256 of those exact bytes.
- [ ] Maintain heading-level stacks to form normalized heading paths. If two sections
      in one file produce the same `{path, heading_path}`, emit fatal
      `duplicate-heading-path`, mark that address absent in the current-doc map, and
      emit no edge to either ambiguous section.
- [ ] `doc.mjs` scans only configured documentation and contract Markdown, excluding
      `docs/runs/`. An identifier-token match emits `documented-in`; targets below
      the documentation root are `doc-section`, and targets below the contract root
      are `contract-clause`. The whole Markdown file blob is the source ref.
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
- [ ] Add fixtures for a direct test; a two-section document containing `alpha` and
      `alphabet`; duplicate headings; a matching contract clause; a valid concern;
      a discharged obligation with an exact clause ref; stale and missing clause refs;
      a malformed final ledger line; a chain break with a suffix; and one run summary.
- [ ] Units assert exact endpoint kinds, directions, locators, hashes, source refs,
      assertor ids, warning codes, and counts; `alphabet` does not match `alpha`;
      ambiguous/stale clauses produce no edge; malformed input never validates a
      suffix; and all five weavers return byte-equal results across repeated runs.
- [ ] **Exit:** every weaver obeys the same `{edges, warnings}` contract and
      `npm test` is green.

## Task 5: Queries, complete-weave driver, and advisory invariant

**Interfaces:**

```text
threadsOf(edges, nodeId)
  -> {byKind: Map<edgeKind, record[]>}
blastRadius(edges, nodeId, depth)
  -> {nodes: nodeDescriptor[], edges: record[], truncated}
why(edges, nodeId, {expectedKinds?, currentDocs?} = {})
  -> {chain: record[], gaps: gap[]}
reportGaps(edges, nodeId, expectedKinds, {currentDocs?} = {})
  -> gap[]
```

All entry points reject malformed records, conflicting descriptors for one node id,
unknown kinds, invalid semantic endpoints, invalid node ids, and invalid arguments.
They do no I/O or mutation.

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
      the requested node. Expected `discharges` additionally requires every reached
      obligation to have at least one valid outgoing discharge to a contract clause.
      Missing evidence produces stable `{gap: 'missing-edge', expected_kind,
      at_node}` records without stopping other branches.
- [ ] For every reached `doc-section` or `contract-clause`, compare its woven hash to
      `currentDocs` when supplied. A missing key, null value, or changed hash emits
      `{gap: 'doc-drift', node, last_woven_hash}`. Deduplicate and sort all gaps.
- [ ] `why` delegates gap construction to `reportGaps`. Its defaults are
      `introduced-by`, `motivated-by`, and `discharges`; flagship callers explicitly
      add `documented-in` and `evidenced-by`.
- [ ] Query units cover touching-edge grouping; malformed input rejection; BFS depth
      zero and larger depths; cycles; stable node descriptors; true and false
      truncation; complete why traversal; a missing target concern; missing target
      documentation; missing target obligation; obligation without clause discharge;
      changed, deleted, ambiguous, and unchanged document sections; and stable gap
      ordering.
- [ ] `weave.mjs` exports guarded orchestration and runs as a CLI only when it is the
      invoked entry point. It has a Node shebang and imports all roots and the five
      exact ids from `inventory.mjs`.
- [ ] `--skip <id>` is repeatable but rejects unknown or duplicate ids. `--out`
      accepts a validated repository-relative path only below `.telos/clotho/` or the
      explicit self-export directory. Existing destinations are rejected.
- [ ] The driver captures one timestamp and repo head, builds one symbol table, runs
      non-skipped weavers, aggregates and canonical-sorts warnings and deduplicated
      edges, and appends edges in that exact order.
- [ ] Write to an exclusive sibling temporary file. Close and run `verifyLedger`
      before atomically renaming to the absent destination. On weaving, append, close,
      or verification failure, exit nonzero, remove the temporary file, and never
      publish the destination.
- [ ] Print stable JSON containing output path, edge count, ledger bytes, warnings,
      and fatal-warning count. A fatal warning exits nonzero; nonfatal warnings remain
      visible and do not fabricate records.
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
- [ ] **Exit:** a real-repository weave completes, verifies, and remains below the
      advisory boundary; `npm test` is green.

## Task 6: Flagship acceptance and skipped-source failure

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
      must obtain a distinct match. Extra facts are allowed under D3 and are reported
      separately rather than used to hide a missing expected match.
- [ ] Commit expectations use the audited full 40-hex introduction SHA. File and
      ledger source refs are exact content addresses from the reviewed repository
      state.
- [ ] Step 1: spawn a full real-repository weave to a unique ignored path below
      `.telos/clotho/`; require exit zero, no fatal warning, and wall time below 120
      seconds. Capture edge count, bytes, and all nonfatal warnings.
- [ ] Step 2: call `verifyLedger`; require `ok: true` before any query or expected-set
      match. Queries use only `records` returned by this successful verification.
- [ ] Step 3: derive the target from
      `{path: 'merkle-dag/obligation.mjs', symbol: 'deriveExecutableRef'}`. Call `why`
      with all five expected rationale/support kinds and call `blastRadius` at depth
      3. Build node descriptors solely from the target and verified edge endpoint
      descriptors. The fact set is the stable union of the target, `why.chain`, and
      `blastRadius.edges`.
- [ ] Require every expectation to match distinctly, all eight groups to be present,
      audited consumer/test multiplicities to match, and ledger-only `why.gaps` to be
      empty.
- [ ] Independently build `currentDocs` from current configured docs/contracts and
      repeat `why` with that map. Require no drift gap. This freshness check may read
      current files; the preceding fact reconstruction remains ledger-only.
- [ ] Step 4: weave to a second unique ledger with
      `--skip clotho-doc-weaver`. Verify it, rerun the same ledger-only calls, and
      require exactly the expected documentation failure containing
      `{gap: 'missing-edge', expected_kind: 'documented-in', at_node: targetId}` with
      no fabricated `documented-in` edge.
- [ ] Remove documentation expectations for this negative run and require the other
      seven groups, including the ledger-derived contract discharge, still to match.
      Any other query gap fails the test.
- [ ] Clean temporary ledgers in `finally` blocks without masking a prior assertion.
- [ ] **Exit:** `npm test` proves valid signatures, the runtime ceiling, all eight
      groups, distinct expected matching, current-doc freshness, and fail-closed
      skipped-source behavior.

## Task 7: Reproduction evidence and documentation

- [ ] Update `docs/STATUS.md` and `docs/ROADMAP.md`, and move completed design and plan
      artifacts to `docs/history/` according to repository convention before
      generating final evidence.
- [ ] `docs/runs/clotho-self-weave/run.mjs` invokes a keyless full weave to a unique
      temporary path below `.telos/clotho/`. The self-export directory remains
      excluded from all input inventories, so repeated runs cannot consume an old
      summary or snapshot.
- [ ] Verify the temporary ledger and complete the flagship expected-set, gap, and
      current-doc checks before publishing any evidence file.
- [ ] Copy the verified ledger bytes to a temporary export file, compute its SHA-256,
      and atomically replace `thread-ledger.snapshot.jsonl`. This explicit export is
      not an append operation and never modifies the source temporary ledger.
- [ ] Write `summary.json` with input repo head, weave timestamp, public key, snapshot
      SHA-256, wall time, edge count, ledger bytes, all warnings, full why chain,
      blast-radius nodes and edges, empty gaps, and all eight matched groups.
- [ ] Write `expected-match-report.json` with each expected entry, its unique matched
      fact, unmatched extra facts, and zero unmatched expectations.
- [ ] Write `verification.json` with snapshot verification status, trusted record
      count, advisory scanner file/package counts, every executed package test command,
      exit status, and Node version. Do not record absolute paths or nondeterministic
      process ids.
- [ ] The reproduction script exits nonzero on a fatal warning, failed ledger
      verification, expected mismatch, query gap, drift gap, or failed atomic publish;
      partial temporary exports are removed in `finally`.
- [ ] Run `cd clotho && npm test`, then every other tracked package's existing test
      command. Run the advisory scanner once more after documentation moves and retain
      its counts in `verification.json`.
- [ ] Review the final diff: only `clotho/`, CI wiring, `.gitignore`, status/roadmap,
      history moves, and self-weave evidence may change. Any spine source change
      blocks merge.
- [ ] **Exit:** evidence verifies from committed bytes, all package suites are green,
      advisory structure is proven repository-wide, no spine source changed, and the
      roadmap is current.

## Accepted risks with explicit boundaries

1. **Rename discontinuity:** path-scoped `git -S` does not infer renames. Missing
   lineage is exposed through warnings/gaps or an explicit evidenced `supersedes`.
2. **Document drift:** historical section hashes remain facts; a current-doc map
   reports changed, deleted, or ambiguous sections.
3. **Over-threading:** module-level conservative attribution can add dependency edges;
   deterministic output and separate extra-fact reporting expose the noise.
4. **Ledger growth:** runtime, count, bytes, and incremental reads are measured; no
   Phase 1 index is introduced.
5. **Static grammar:** unsupported exports, re-exports, dynamic symbol flow, and
   indirect semantic references are not inferred. Missing audited evidence fails the
   flagship test.
6. **Self-signed identity:** an embedded ephemeral key proves internal consistency,
   not external authority. Clotho remains advisory and no durable-key policy is
   introduced.
7. **Tail deletion:** removal of a final complete record is not detectable without an
   external checkpoint. Committed snapshots therefore record a separate SHA-256 in
   the summary and are verified against that checkpoint.