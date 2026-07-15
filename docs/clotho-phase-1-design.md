# Clotho — Phase 1 Design v2 (the TELOS self-weave)

**Goal:** Build a provenance-aware graph of TELOS itself that can reconstruct **why a
load-bearing mechanism exists** and **what would be affected by changing it** — proven
against the system that already has the richest history, contracts, review rounds,
evidence, and governance artifacts: this repository.

**Registered meaning (binding):** per `docs/mythological-vocabulary.md`, **Clotho —
creates and maintains knowledge-graph threads across artifacts and repositories.**
This phase builds exactly that and nothing else. Measurement of threads is Lachesis;
retirement of threads is Atropos; both are explicitly out of scope here.

**Status:** v2.2 — v2 revised after cold review of `2d93816` and the first
Daedalus workshop (`docs/runs/clotho-daedalus/`); v2.1 incorporated The Eye's
second review (content-bound locators, frozen blastRadius semantics,
mechanism-bound coverage provenance, abort-on-weaver-failure); v2.2 incorporates
The Eye's third review (repository-wide locator invariant with the named `commit`
exception, the `repository_ref` definition, mechanical mechanism-provenance
closure, and the `supersedes`-direction wording fix). See
`docs/clotho-phase-1-remediation.md` for the finding-by-finding dispositions.

**Process rule (The Eye, 2026-07-15):** *a governing specification is normative,
not immune from challenge.* Daedalus workshops over this spec's plans MUST permit
findings against both the implementation plan and this specification. Spec defects
produce explicit proposed amendments for The Eye — seats are never forced to design
around an unchangeable mistake.

---

## Flagship acceptance query

> "What depends on `deriveExecutableRef`, why was it introduced, which concern exposed
> the need, which tests prove it, and what breaks if its preimage changes?"

Phase 1 is done when Clotho answers this from its verified ledger alone, and the
answer satisfies the acceptance discipline in §Acceptance. Today that answer is
scattered across at least:

| Source | What it holds |
| --- | --- |
| `merkle-dag/obligation.mjs:38` | the definition and its preimage rule `H({cmd, args, cwd})` |
| `build-gate/proposal-gate.mjs`, `build-gate/check-registry.mjs` | the enforcement consumers (executable↔check-contract binding) |
| `build-gate/scripts/test-proposal-gate.mjs`, `merkle-dag/scripts/test-obligation.mjs` | the tests that prove it |
| commit `0901c66` (PR #84) | when and with what rationale it landed |
| `docs/proposal-lifecycle-implementation.md` §"binding" | the documented invariant |
| `docs/proposal-lifecycle-review-packet.md` | the review concern lineage |
| `docs/runs/proposal-lifecycle/` | run evidence exercising it end-to-end |
| `contracts/Proposal Lifecycle.md` | the contract requirement it discharges |

Clotho's job is to make that table a *queryable, signed, append-only fact*, not
tribal knowledge.

## Core model

**A new top-level package `clotho/`** — independent, ESM, Node ≥ 18, **zero runtime
dependencies**, same conventions as every other package. It reuses `merkle-dag`
canonicalization and hash conventions plus Node's Ed25519 primitives via relative
import; it **owns its own thread-specific ledger verifier** (the proposal-ledger
*verifier* is proposal-specific and is not reused or modified — only its pattern is
followed). Precedent for the cross-package import: `build-gate` imports from
`breakout`.

### Nodes — identities, never labels

A node is a content-addressed locator of an existing artifact. Clotho **mints no new
identities for things that already have one** (commit shas, plan hashes, ledger entry
hashes, concern refs are used as-is inside locators). Node kinds are a **closed
set**:

```
NODE_KINDS = { contract-clause, code-symbol, repository-file, test, commit, concern,
               obligation, check-contract, run-evidence, doc-section, decision }
```

`node_id = H({kind, locator})`, with kind-specific locator schemas that reject
missing and extra fields.

**Locators are content-bound version identities (v2.1).** A node id that can keep
pointing at changed bytes is a mutable label, not a version reference. Every
repository-scoped locator therefore includes `repository_ref` (consistent with
`repository-file`, so cross-repository weaving later needs no schema break) and a
content hash of the exact bytes it names — at minimum:

```
code-symbol     = {repository_ref, path, symbol, blob_sha}
repository-file = {repository_ref, path, blob_sha}
test            = {repository_ref, path, blob_sha}
run-evidence    = {repository_ref, path, summary_sha256}
doc-section     = {repository_ref, path, heading_path, text_sha256}
contract-clause = {repository_ref, path, heading_path, text_sha256}
decision        = {repository_ref, path, heading_path, text_sha256}
concern         = {repository_ref, ledger_path, entry_hash}
obligation      = {repository_ref, ledger_path, entry_hash}
check-contract  = {repository_ref, path, contract_id, blob_sha}
```

The single **named exception** is `commit = {sha}`: a git commit sha is already a
globally addressed content identity and takes no `repository_ref`. Every other
kind is repository-scoped and content-bound — no locator may name bytes that can
change without changing the node id. A changed function body, test file, section,
contract, or run summary is a NEW version node; lineage across versions is
`supersedes`, never silent reattachment.

**`repository_ref` is defined, not delegated (v2.2):**
`repository_ref = "git-root:" + <full 40-hex sha of the repository's root commit>`
(`git rev-list --max-parents=0 HEAD`; more than one root commit is fatal in
Phase 1). Consequences, chosen deliberately: a repository *rename or re-hosting
does not change identity*; clones of the same history weave into the *same*
namespace (reproducibility); forks share the namespace exactly as far as they
share the root commit (identity is history lineage, not hosting); and later
cross-repository accession preserves every Phase 1 node id unchanged. The weave
derives it mechanically and records it in the header; validators reject locators
whose `repository_ref` does not match the derived value.

**`repository-file` (The Eye, 2026-07-15):** files are genuine architectural objects
— imports often terminate at modules rather than named symbols; workflow files and
package manifests contain no useful code symbol; rename history is naturally
file-level; some tests execute files or commands rather than importing symbols. Its
immutable version locator binds at least `{repository_ref, path, blob_sha}`: path is
the logical location, blob hash the exact version identity. It covers source
modules, workflows, manifests, scripts, and configuration — never overloading
`code-symbol` (a file and a symbol have different identity and lineage semantics).

**Version identity, not lineage identity:** a `node_id` is an immutable **version
reference** (a symbol-version, a file-version, a section-version) — it is *not* a
durable identity across renames and edits. Lineage across versions is carried by
explicit, evidenced `supersedes` edges (human- or model-asserted; see §Assertion
status). Doc-sections carry both a stable logical location (file + heading path)
and an immutable version identity (section-content hash); the hash detects drift,
the heading path supports re-threading after drift.

### Edges — a closed registry, like everything else here

```
EDGE_KINDS = { depends-on, introduced-by, motivated-by, verified-by,
               documented-in, evidenced-by, discharges, supersedes }
```

Same discipline as `NA_ALLOWED`, `EVIDENCE_KINDS`, `check-registry.mjs`, and the
mythological namespace itself: closed sets over open assertions. An edge kind not in
the registry is rejected at write time. Extending either registry is a human
decision made in exactly one place (`clotho/registry.mjs`).

**Directions are frozen** in an endpoint-compatibility matrix enforced at both
append and verification time (canonical semantics: consumer —`depends-on`→
dependency; artifact —`verified-by`→ test; artifact —`introduced-by`→ commit;
artifact —`motivated-by`→ concern; obligation —`discharges`→ concern or
contract-clause; and `old_version` —`supersedes`→ `new_version` — the edge points
forward through version lineage, old node → new node of the same kind). The implementation plan
carries the full matrix, extended for `repository-file` endpoints
(e.g. `repository-file → commit` for `introduced-by`, `code-symbol →
repository-file` and `repository-file → repository-file` for `depends-on` where
imports terminate at modules).

### Records — facts and envelopes are separate

Every edge record **embeds its endpoints' full canonical descriptors** —
`from_locator: {kind, locator}` and `to_locator: {kind, locator}` alongside the
derived `from_node`/`to_node` ids — so the verifier recomputes every reference and
queries answer **from the ledger alone**, returning locators, not bare hashes.

The **edge fact payload** is deterministic:
`{edge_kind, from_node, to_node, from_locator, to_locator, asserted_by,
assertion_status, source_ref}`. Weavers emit payloads only — never time,
signatures, hashes, or chain fields.

The **signed observation envelope** is ledger-owned: one canonical `woven_at`
timestamp and one Ed25519 keypair per weave, hash-chained records, per-record
signatures. Determinism is asserted by comparing sorted payload identity keys
across runs — never complete ledger records. Each weave is a **separate immutable
artifact** (exclusive create, serialized append, closed and verified on
completion); idempotence means a re-weave produces a new ledger whose payload set
is comparable, not an ever-growing single log.

Every edge carries a validated `source_ref` (content address of the evidence for
the assertion) and `asserted_by` (weaver id, `human`, or `model:<seat>`). An edge
without either cannot be written — fail closed.

### Assertion status — proposals are not facts

A `source_ref` proves the evidence *exists*; it does not prove the asserted
relationship *follows* from that evidence. Every record carries an
`assertion_status` from a closed set:

```
ASSERTION_STATUS = { deterministic-extraction, human-authorized,
                     model-proposal, rejected, superseded }
```

- Weaver output is `deterministic-extraction` by construction.
- `model:<seat>` assertions enter as `model-proposal` — **default queries exclude
  unresolved model proposals**. They become canonical only through an explicit
  `human-authorized` acceptance record (or a future TELOS-authorized path); they
  can be `rejected` without deletion (append-only).
- Model judgment may propose a thread; it never silently becomes graph truth.

### Coverage manifest — absence must be classifiable

Absence of an edge alone cannot distinguish "no relationship" from "weaver skipped /
source unavailable / extraction failed / relationship unrecognized". Each weave
therefore records a **signed coverage manifest** (in the weave header/trailer):
per-weaver `{id, version, implementation_refs, state, inspected_source_counts}`
plus `inventories_consumed`, each entry carrying a `source_ref` — where
`implementation_refs`/`source_ref` are content addresses of the extractor and
inventory bytes that actually ran (`file:<path>@<blob_sha>`). Names and
manually-bumped integer versions identify nothing; the manifest binds the
**mechanism itself**. An ephemeral signature proves the ledger did not mutate
after signing — the implementation refs identify the algorithm that made its
assertions.

**Mechanism coverage is mechanical, not curated (v2.2):**

- `implementation_refs` for each weaver = the **exact transitive static
  relative-import closure** of that weaver's module — including shared substrate
  (`weavers/util.mjs`, `registry.mjs`) and any permitted `merkle-dag` primitives
  that participate in identity, canonicalization, or hashing.
- The manifest additionally carries `orchestrator_refs` = content addresses of
  the orchestration machinery (`weave.mjs`, `thread-ledger.mjs`,
  registry/canonicalization code, and other shared machinery) — the driver
  constructs the fact tables, applies skip policy, deduplicates, orders, and
  decides what publishes; a changed driver changes the graph even when every
  per-weaver ref is unchanged.
- A test derives the static relative-import closure and **fails when the
  committed implementation inventory omits or adds a file** — the list is proven
  equal to the closure, never trusted.

**Weaver failure aborts the weave (v2.1).** A throwing weaver means the temporary
ledger is destroyed and never published; published manifests contain only
`executed` and `skipped` states. `failed` exists solely as an internal /
verifier-fixture diagnostic. The deliberate coverage-unknown path is `skipped`.
General queries answer **coverage-unknown** when the relevant weaver did not
execute; only a predefined expected set (the flagship test) may name a *specific*
missing relationship.

## Weavers (extractors)

Deterministic, read-only scanners, each with a stable id recorded in `asserted_by`:

1. **git-weaver** — commits ↔ symbols/files (`introduced-by`), via path-scoped
   `git log -S`; rename boundaries end a thread (gap + optional evidenced
   `supersedes`, never inference).
2. **code-weaver** — import/dependency graph across the packages (`depends-on`),
   at symbol level where exports are representable and at `repository-file` level
   where imports terminate at modules, manifests, or configuration.
3. **test-weaver** — test scripts ↔ the symbols/files they exercise (`verified-by`),
   including tests that execute files or commands rather than importing symbols.
4. **doc-weaver** — docs/contracts sections that name a symbol or mechanism
   (`documented-in`, with heading-path + section-text-hash locators).
5. **ledger-weaver** — concerns/obligations/run evidence from the proposal ledgers
   and `docs/runs/` (`motivated-by`, `discharges`, `evidenced-by`).

Weavers return `{edges, warnings}`; warnings are deterministic data, never edges.
Missing or malformed evidence yields a warning and a gap — never an inferred edge.

## Queries (pure functions, no mutation)

- `threadsOf(node_id)` — all edges touching a node, grouped by kind, locators
  included.
- `blastRadius(node_id, depth)` — `affected` = the **inverse transitive closure of
  `depends-on`** (from the changed dependency to its consumers); `evidence` = the
  outgoing `verified-by` edges of affected artifacts. Traversal **stops at test
  nodes** (test co-coverage is not a dependency relationship), never follows
  forward `depends-on` (a target's own dependencies do not break when the target
  changes), and `truncated` is computed from dependency traversal only: "what
  breaks if its preimage changes."
- `why(node_id)` — walks `introduced-by` → `motivated-by` → `discharges` to the
  concern and contract clause: "why does this exist."

All default query results exclude unresolved `model-proposal` records and report
`coverage-unknown` where the manifest shows the relevant weaver did not execute.
The flagship query is `why()` + `blastRadius()` composed over the
`deriveExecutableRef` code-symbol node.

## Trust posture (do not weaken)

- **Advisory, never authorizing.** No gate, sign, or lifecycle decision keys off a
  Clotho record. Threads inform humans and future Lachesis analysis. This is
  structural: no package in the repo gains an import from `clotho/`.
- Weavers are read-only over the repo; the only thing Clotho writes is its own
  ledger under `.telos/` (ephemeral, git-ignored) or an explicitly exported
  snapshot. The self-weave output directory is never a weave input.
- The per-weave signing key is ephemeral: it proves internal consistency, not
  external authority. Committed snapshots record a separate external checkpoint
  hash because append-only tail deletion is otherwise undetectable.

## Acceptance criteria

1. **Flagship:** every edge in the hand-audited expected set for
   `deriveExecutableRef` (the source table above) matches distinctly; every
   unexpected edge in the flagship neighborhood is emitted as an explicit **review
   set** artifact; no unexpected edge is silently treated as validated; no
   relevance scoring is introduced (that is Lachesis's domain).
2. **Fail-closed gap:** a weave with a weaver disabled must yield
   `coverage-unknown` / an explicit reported gap for the affected thread — never a
   silently smaller answer.
3. **Ledger integrity:** records verify (signature + hash chain + locator/id
   recomputation) via Clotho's own verifier; tampering and truncation (except
   checkpointed tail deletion) are detected.
4. `clotho/ npm test` green; no new dependencies anywhere; existing package tests
   untouched and green.

## Explicit non-goals (Phase 1)

- **Lachesis** (scoring/measuring threads) and **Atropos** (retiring them).
- Any coupling into gate/lifecycle enforcement.
- Cross-repository weaving. **LEXI stays untouched** until the machinery is mature
  enough to accession it properly.
- **The Iliad** — the system-of-systems lifecycle umbrella (see the registry) — is
  a *later consumer* of the weave: organizing module plans and detecting cross-plan
  dependencies is one Iliad capability exercised in Phase 2, not the umbrella's
  identity and not part of this build.
- Rename/lineage inference (lineage is explicit `supersedes` only).

## Delivery constraints

- One task per branch → PR → CI → squash-merge; existing packages stay green.
- **CI-workflow isolation:** the `.github/workflows/ci.yml` matrix edit ships in
  its own minimal, explicitly-flagged workflow-only PR, reviewed as such — never
  inside feature work (per the documented self-skipping-reviewer failure).

## Sequence

1. **Clotho learns TELOS** (this phase).
2. **The Iliad** uses the weave to organize the remaining module plans (Phase 2).
3. **LEXI accession** only after 1–2 are proven.

Process: this spec (challengeable) + the matured plan + amendments → **Daedalus**
delta workshop → **The Eye** reviews → **TELOS** lifecycle authorizes → **Argo**
carries it through implementation, verification, and documentation.
