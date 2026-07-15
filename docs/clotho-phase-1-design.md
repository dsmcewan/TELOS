# Clotho — Phase 1 Design (the TELOS self-weave)

**Goal:** Build a provenance-aware graph of TELOS itself that can reconstruct **why a
load-bearing mechanism exists** and **what would be affected by changing it** — proven
against the system that already has the richest history, contracts, review rounds,
evidence, and governance artifacts: this repository.

**Registered meaning (binding):** per `docs/mythological-vocabulary.md`, **Clotho —
creates and maintains knowledge-graph threads across artifacts and repositories.**
This phase builds exactly that and nothing else. Measurement of threads is Lachesis;
retirement of threads is Atropos; both are explicitly out of scope here.

**Status:** draft for Daedalus workshop; spec → plan → build on the standard cycle.

---

## Flagship acceptance query

> "What depends on `deriveExecutableRef`, why was it introduced, which concern exposed
> the need, which tests prove it, and what breaks if its preimage changes?"

Phase 1 is done when Clotho answers this from its ledger alone, and the answer matches
a hand-audited expected set. Today that answer is scattered across at least:

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
primitives via relative import (precedent: `build-gate` imports from `breakout`).

### Nodes — identities, never labels

A node is a content-addressed locator of an existing artifact. Clotho **mints no new
identities for things that already have one** (commit shas, plan hashes, ledger entry
hashes, concern refs are used as-is). Node kinds are a **closed set**:

```
NODE_KINDS = { contract-clause, code-symbol, test, commit, concern, obligation,
               check-contract, run-evidence, doc-section, decision }
```

`node_id = H({kind, locator})`, where `locator` is kind-specific and content-anchored
(e.g. a doc-section locator includes the sha256 of the section text at weave time, so
drift is detectable, not silent).

### Edges — a closed registry, like everything else here

```
EDGE_KINDS = { depends-on, introduced-by, motivated-by, verified-by,
               documented-in, evidenced-by, discharges, supersedes }
```

Same discipline as `NA_ALLOWED`, `EVIDENCE_KINDS`, `check-registry.mjs`, and the
mythological namespace itself: closed sets over open assertions. An edge kind not in
the registry is rejected at write time. Extending the registry is a human decision.

### The thread ledger

Append-only, Ed25519-signed JSONL (the `proposal-ledger.mjs` pattern). Each record:

```
{ edge_kind, from_node, to_node,
  asserted_by,          // extractor id, or "human", or model seat — provenance, always
  source_ref,           // content address of the evidence for the assertion
  woven_at }
```

Every edge carries the evidence that justifies it. An edge without a `source_ref`
cannot be written — fail closed.

## Weavers (extractors)

Deterministic, read-only scanners, each with a stable id recorded in `asserted_by`:

1. **git-weaver** — commits ↔ symbols/files (`introduced-by`), via `git log -S`.
2. **code-weaver** — import/call graph across the packages (`depends-on`).
3. **test-weaver** — test scripts ↔ the symbols they exercise (`verified-by`).
4. **doc-weaver** — docs/contracts sections that name a symbol or mechanism
   (`documented-in`, with section-text hashes).
5. **ledger-weaver** — concerns/obligations/run evidence from the proposal ledgers
   and `docs/runs/` (`motivated-by`, `discharges`, `evidenced-by`).

Model-proposed edges (a council seat suggesting a `motivated-by` link) are permitted
**only** as records whose `asserted_by` names the seat and whose `source_ref` points
at real evidence — same posture as every other seat claim: the assertion is data,
the evidence is truth.

## Queries (pure functions, no mutation)

- `threadsOf(node_id)` — all edges touching a node, grouped by kind.
- `blastRadius(node_id, depth)` — transitive `depends-on`/`verified-by` closure:
  "what breaks if its preimage changes."
- `why(node_id)` — walks `introduced-by` → `motivated-by` → `discharges` back to the
  concern and contract clause: "why does this exist."

The flagship query is `why()` + `blastRadius()` composed over the
`deriveExecutableRef` code-symbol node.

## Trust posture (do not weaken)

- **Advisory, never authorizing.** No gate, sign, or lifecycle decision keys off a
  Clotho record. Threads inform humans and future Lachesis analysis. This is
  structural: `build-gate` gains no import from `clotho/`.
- Weavers are read-only over the repo; the only thing Clotho writes is its own ledger
  under `.telos/` (ephemeral, git-ignored) or an explicitly exported snapshot.
- Absent evidence yields an absent edge and a reported gap — never an inferred edge.

## Acceptance criteria

1. Flagship query returns the hand-audited expected set for `deriveExecutableRef`
   (all eight sources above threaded); a fail-closed test removes one source and
   asserts the gap is *reported*, not papered over.
2. Ledger records verify (signature + hash chain) via existing merkle-dag verifiers.
3. `clotho/ npm test` green (check pass + unit + the acceptance queries); no new
   dependencies anywhere; existing package tests untouched and green.

## Explicit non-goals (Phase 1)

- **Lachesis** (scoring/measuring threads) and **Atropos** (retiring them).
- Any coupling into gate/lifecycle enforcement.
- Cross-repository weaving. **LEXI stays untouched** until the machinery is mature
  enough to accession it properly.
- **The Iliad** — the umbrella system (registered) that will use the weave to
  organize the remaining module plans and detect cross-plan dependencies before
  development starts. It is the Phase 2 consumer, not part of this build.

## Sequence

1. **Clotho learns TELOS** (this phase).
2. **The Iliad** uses the weave to organize the remaining module plans (Phase 2).
3. **LEXI accession** only after 1–2 are proven.

Process: this spec → **Daedalus** matures the implementation plan → **TELOS**
lifecycle authorizes → **Argo** carries it through implementation, verification,
and documentation.
