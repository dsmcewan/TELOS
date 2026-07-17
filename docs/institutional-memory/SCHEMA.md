---
type: specification
topic/architecture: telos
status: living
note: The specification of the AI-native institutional-memory record set. This is the reference for authoring future records. It is engineering best practice, not a mythological module.
---

# AI-native institutional-memory — schema

## Purpose

Documentation for a future AI model must **reconstruct the system's intended reality
without letting the model fill gaps with plausible invention.** The enhancer is a
memoryless, more-capable model that must be *complete at load* and must not be *left
enough ambiguity to be helpful in the wrong direction.* This record set is the
**succession interface** between generations of models. Human READMEs are a **rendered
projection** of it, not the source.

## Design disciplines

1. **Authority-anchored.** Every load-bearing statement terminates in a stable
   identifier — a plan `sha256:`, an `authz-N`, an Eye ruling (`AM-N`), a git commit, or a
   Clotho node id. Never a mutable label or bare prose.
2. **NORMATIVE requires an oracle.** A claim is `NORMATIVE` only if it has an executable
   verification (test/property/fixture) that passes. Prose without an oracle is `ADVISORY`
   and never enforced. This is what stops the memory layer from becoming the next drift
   source.
3. **Three representations** for every load-bearing claim: human prose (why),
   machine-readable contract (the exact data), executable verification.
4. **Machine-first, human-rendered.** Machine records are the source of truth; the human
   README is generated from them so it cannot silently drift.
5. **Reading ≠ understanding.** No implementation authority until a reader returns a
   validation artifact from the comprehension gate (below).

## Record kinds (closed set)

`mechanism` · `decision` · `rejected-alternative` · `non-claim` · `invariant` ·
`open-question` · `contract` · `evidence`. Unknown kinds are rejected.

## Six-dimension record (fields)

`id` (content address) · `kind` · `title` · `what` · `why` · `scope` · `authority`
(anchor) · `evidence` (oracle refs) · `non_claim` · `change_rule` · `status` ·
`normativity` · `superseded_by` · `effective_from_commit` · `must_not_govern_new_work`.

## Status / normativity taxonomy (closed set)

`NORMATIVE-CURRENT` · `SUPERSEDED` (with `superseded_by` + `must_not_govern_new_work:true`)
· `MODEL-PROPOSAL` · `REJECTED-ALTERNATIVE` · `OPEN-QUESTION` ·
`HUMAN-AUTHORIZED-EXCEPTION` · `ADVISORY`. **Preserve rejected alternatives** so a later
model does not rediscover them as novel; a superseded plan must not look like a second
valid plan merely because it still exists in the repo.

## Record set layout

**System-level:** root `AI-START-HERE.md`, `repository-manifest.json`,
`CURRENT-AUTHORITY.json`; `docs/institutional-memory/{INVARIANTS,NON-CLAIMS,OPEN-QUESTIONS,CHANGE-PROTOCOL}`.
**Per-component** (co-located, e.g. `clotho/memory/`): `IDENTITY`, `INVARIANTS(.json)`,
`CONTRACTS/*.json`, `DECISIONS/*` (incl. rejected alternatives), `NON-CLAIMS(.json)`,
`FAILURE-MODES`, `EVIDENCE/`, `comprehension-queries.json`, `README.md` (rendered).

## Executable protocol

- **`docs/institutional-memory/verify-contracts.mjs`** — proves each NORMATIVE
  machine-readable contract equals what the code enforces, and each plan hash in
  `CURRENT-AUTHORITY.json` matches disk. Fail-closed; exit 0 only if all match.
- **`docs/institutional-memory/comprehension-gate.mjs`** — the reader-validation gate.
  A reader submits an answer set; the gate grades it **deterministically** against the
  authority-anchored `comprehension-queries.json` (each expected fact terminates in a
  stable identifier), verifies the active plan hash against disk, and checks the reader
  excluded superseded authorizations. Exit 0 → implementation authority may be granted;
  a wrong answer ("eight packages", "proves containment") → **DENIED**.

## Reuse (do not reinvent)

Clotho's `deriveNodeId`, closed node/edge kinds (incl. `decision`, `supersedes`,
`documented-in`, `evidenced-by`), and `source_ref` schemes (`sha256:`, `file:@`,
`ledger:#`, `git:`); `merkle-dag/vendor.mjs` `canonicalize`/`sha256hex`; the
`proposal-ledger`/`thread-ledger` hash-chain for any ledgered record stream. **Coin no
mythological term** — roles map to the registry (`docs/mythological-vocabulary.md`):
Clotho is the memory graph, Argo authors/renders, Atropos handles supersession, Lachesis
risk, The Iliad cross-system coherence, The Eye/TELOS authority.
