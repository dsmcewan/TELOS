---
name: memory-authoring
description: Use when writing institutional-memory records — scaffolding, content addressing, anchors, mirrors, decision provenance, load order
---

# Authoring institutional-memory records

This skill is the practitioner's guide: how to actually write the records that
`memory-standard` defines. Read `memory-standard` first if you have not — this skill
assumes you already know the closed record kinds and status taxonomy.

## Scaffold layout

A component's record set is scaffolded by an idempotent init script (never overwrites
existing files) into a `memory/` directory co-located with the component, plus
repo-level files written on first run:

**Repo-level (written once):**
- `AI-START-HERE.md` — the entry point; tells a fresh model the load order and the
  ground rules before it reads anything else.
- `CURRENT-AUTHORITY.json` — `{ active: {ref, path, sha256}, superseded: [] }`. `active` is the
  governing document currently in force; it starts `null` until a human binds it — no
  record may claim `NORMATIVE` status against an unbound authority.
- `LOAD-ORDER.json` — the minimal reading order for a fresh model (see below).
- `MEMORY-MANIFEST.json` — the sorted, unique component-memory membership list.

**Per-component (under `<component>/memory/`):**
- `README.md` — the deterministic index of the generated record set.
- `IDENTITY.md` — what this component IS and is NOT, in a couple of paragraphs. State
  the boundary plainly.
- `INVARIANTS.json` + `INVARIANTS.md` — `kind: "invariant"` machine records and their
  rendered projection.
- `NON-CLAIMS.json` + `NON-CLAIMS.md` — likewise, for what this component deliberately
  does not do or prove; every entry has `kind: "non-claim"`.
- `CONTRACTS/*.json` — one file per frozen interface or protocol.
- `DECISIONS/rejected-alternatives.md` — paths considered and not taken.
- `FAILURE-MODES.md` — how this component fails, and that it fails closed.
- `EVIDENCE/` — pointers to oracle runs and golden data.
- `comprehension-queries.json` — the deterministic queries a reader must answer
  correctly before being granted implementation authority.

New contract, invariant, and non-claim templates are scaffolded as
`SPECIFIED-PENDING-IMPLEMENTATION` with empty `oracle`, `evidence`, and
`becomes_normative_when` values, and every generated record carries
`lifecycle: "docs-first"`; the generated contract also carries
`decided_by: "human"`. This is honest about being unproven from minute one, rather than
defaulting to a status the record has not earned. The empty transition is intentionally
audit-red, and the empty query/required-record sets are intentionally gate-denied.
Before a record can advance, replace the transition with a canonical, portable
repository-relative `.js`, `.cjs`, or `.mjs` oracle path. That future path may remain
absent while the record is pending. Before a contract or invariant becomes
`NORMATIVE-CURRENT`, the named oracle must exist. The structural audit validates that
the declared oracle path resolves to a regular file; `verify.mjs` executes each
contract's declared oracle and requires exit `0`.

## Content addressing

A record's `id` is a content address, not an author-chosen label:

```
"sha256:" + sha256hex(canonicalize(record minus id))
```

That is: take the record, remove its own `id` field (the id can't be part of what it
hashes — that would be circular), canonicalize the remainder (deterministic JSON: object
keys sorted at every level, arrays kept in given order, no incidental whitespace), and
SHA-256 the result. Two records with identical content, minus `id`, produce the same
address. This is what makes a record's identity tamper-evident: if the content changes,
the address changes, and any anchor pointing at the old address now fails to resolve —
loudly, not silently. Recompute the content-addressed `id` after every machine-record
change; retaining the old address is a taxonomy FAIL.

## Anchor forms

Every load-bearing statement's `authority` field terminates in one of these anchor
forms:

- **Content hash** — `sha256:<64 hex chars>`, the address of a specific byte sequence
  (a record, a document, a file). The strongest anchor: it cannot be satisfied by
  anything except the exact bytes it names.
- **File-at-commit** — a path plus the commit it was read at, so the anchor is pinned
  even if the file later changes on the branch.
- **Commit** — a bare commit identifier, when the anchor is to a point in history
  rather than a specific file.
- **Ledger entry** — a reference into an append-only signed log, when the authority
  lives in an event stream rather than a file.

Never anchor to a mutable label ("the current design doc," "the latest version") — if
the target can change without the anchor changing, it is not doing its job.

## `authority.source_path` — anchor a contract to its source document

A contract MAY carry an `authority` block naming the document that grounds it. The
audit's staleness family checks that this path still resolves from the repo root:

```json
"authority": { "source_path": "docs/specs/2026-07-18-example-design.md" }
```

If the file no longer exists at that path, the audit reports a FAIL (`staleness`) —
a load-bearing anchor must never dangle.

## `as_of` and snapshot staleness declarations (hardening 5)

An optional `as_of` value is a commit anchor. Audit requires it to resolve in the
current repository. An unresolved commit is a FAIL; a commit that resolves but trails
HEAD produces a WARN containing its commit distance.

An optional snapshot pins current source bytes:

```json
"snapshot": { "source_path": "path/to/source", "sha256": "sha256:<64 hex chars>" }
```

Audit FAILs when the source is missing, the hash is malformed, or the current source
bytes do not match the pinned hash.

## `derived_from` on queries (hardening 1)

Every entry in `comprehension-queries.json` that asserts an `expected` fact must carry
a `derived_from` pointer into the machine record that fact comes from, e.g.:

```json
{
  "id": "q-1",
  "query": "What is the current contract status?",
  "answer_kind": "enum",
  "expected": "NORMATIVE-CURRENT",
  "derived_from": { "file": "CONTRACTS/example.json", "pointer": "status" }
}
```

`derived_from.file` names the machine file, `derived_from.pointer` is the path into it
(dot-notation into the parsed JSON) that produces the expected value. A query without
`derived_from` is a query someone typed by hand and will eventually forget to update —
exactly the drift hardening 1 exists to catch. An audit walks every query and requires
`derived_from` to be a `{file, pointer}` object. Missing or malformed derivation,
unreadable or missing files, unresolved pointers, and values that differ from
`expected` are all FAIL findings.

The query document itself is load-bearing. `queries`, `required_invariants`, and
`required_non_claims` are all nonempty arrays. Each required-record array contains
unique `sha256:<64hex>` content addresses that resolve against the sibling
`INVARIANTS.json` or `NON-CLAIMS.json` record of the correct kind. The gate treats a
missing or malformed sibling file as cannot-run, and it DENIES empty, duplicate,
invalid, dangling, or wrong-kind required IDs. Every query needs a unique nonempty
trimmed `id`, nonempty trimmed `query` text, and `answer_kind` exactly `boolean`,
`enum`, or `set`. Its `expected` value is respectively a boolean, string, or array,
and the submitted answer must have that same exact type before equality is graded.

## `mirror_of` + `values` on mirrored sets (hardening 4)

If a record's closed set (values, kinds, whatever) is declared to mirror another
component's closed set, say so explicitly and make it checkable:

```json
{
  "mirror_of": { "file": "CONTRACTS/example.json", "pointer": "oracle.test" },
  "values": "scripts/test-example.mjs"
}
```

An audit resolves `mirror_of` against the named source file and pointer, then compares
the result to `values`. Mismatch is a FAIL — the mirror has rotted. A `change_rule`
comment promising future manual re-sync is not a substitute for this: if nothing checks
it, it is not enforced, it is a hope.

## `decided_by` provenance (hardening 8)

Any record of kind `decision` (and any contract carrying a ruling) states who decided.
If `decided_by` appears on any record, its value is closed to:

```
"decided_by": "human" | "model-advisory-adopted-by-human"
```

`human` — a human made the call directly. `model-advisory-adopted-by-human` — a model
proposed or advised, and a human adopted the proposal; the model's input was
collaboration, not authority. Never write a decision record without this field, and
never let a model's own self-report substitute for a human's adoption — the human
authority gate that grants `human` provenance is described in `memory-lifecycle`.

## `lifecycle` (hardening 3)

Every hashed record states its actual build order:

```
"lifecycle": "docs-first" | "build-first-then-ratified"
```

`docs-first` — the normal, default order: the record was specified and frozen before
the code that implements it was written. `build-first-then-ratified` — the exception:
code was built first, under explicit human direction, and the record documents that
history honestly rather than pretending a docs-first order that didn't happen. This
field is inside the hashed content, not a side note beside it — a record whose hash
claims a false history is exactly what an authorization review should reject on sight.
A `build-first-then-ratified` record pairs with `status: RATIFICATION-PENDING` until a
human formally ratifies it; see `memory-lifecycle` for that path in full.

## `LOAD-ORDER.json` + "load slim" (hardening 7)

`LOAD-ORDER.json` defines the minimal reading order for a fresh model, e.g.:

```json
{
  "order": [
    "AI-START-HERE.md",
    "CURRENT-AUTHORITY.json",
    "<component>/memory/IDENTITY.md",
    "<component>/memory/INVARIANTS.json",
    "<component>/memory/CONTRACTS/",
    "<component>/memory/NON-CLAIMS.json"
  ]
}
```

The order is: start-here, then the active authority, then the specific component's
identity, then that component's contracts. A fresh model working a task in one
component should stop once that component is loaded — it does not need every other
component's full record set to be "complete at load" for its task. Include
token-budget guidance alongside the order so a model can gauge how much of its context
window this reading order will consume before it starts. Loading slim is a discipline,
not a limitation: reading everything is not the same as reading what is load-bearing
for the task at hand.

## Render/drift discipline

Machine records (`.json`) are the source of truth. Rendered documents (`.md`) are
byte-derived FROM the machine records by the deterministic renderer —
`INVARIANTS.md` and `NON-CLAIMS.md`; the scaffolded `README.md` is a deterministic
index of the generated record set.
When a fact changes, edit the machine record and regenerate the rendered file; never
hand-edit a fact directly into the `.md`. A rendered file that has drifted from its
source machine record is worse than no rendered file at all, because it looks
authoritative while being wrong. Recompute the record's content-addressed `id` before
regenerating the rendered bytes.
