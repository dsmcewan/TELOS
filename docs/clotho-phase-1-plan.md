# Clotho Phase 1 Implementation Plan — SKELETON (SUPERSEDED historical artifact)

> **SUPERSEDED.** This skeleton was matured by the first Daedalus workshop
> (`docs/runs/clotho-daedalus/`), cold-reviewed
> (`docs/clotho-phase-1-remediation.md`), and re-converged under the challengeable
> spec v2 by the delta workshop. The canonical submission candidate is
> **`docs/runs/clotho-daedalus-delta5/matured-plan-v6.md`**. Kept for provenance.

> **Status: draft skeleton.** Task boundaries, file structure, and exit criteria are
> proposed; per-step detail (exact function signatures, fixture contents, edge-case
> tests) is deliberately thin — the Daedalus workshop matures it before the TELOS
> lifecycle authorizes and Argo executes.
>
> **For agentic workers (once matured):** use checkbox (`- [ ]`) steps task-by-task.

**Goal:** Build `clotho/` — an advisory, zero-dependency knowledge-graph package —
and prove it by weaving TELOS itself: the flagship query over `deriveExecutableRef`
answered from Clotho's signed thread ledger alone, matching a hand-audited expected
set. Spec: `docs/clotho-phase-1-design.md`.

**Architecture:** append-only Ed25519-signed JSONL thread ledger (the
`merkle-dag/proposal-ledger.mjs` pattern, reused via relative import); closed
`NODE_KINDS`/`EDGE_KINDS` registries; five deterministic read-only weavers; three
pure query functions. Structurally advisory: **no package in the repo gains an
import from `clotho/`** — Clotho imports from `merkle-dag/`, never the reverse.

**Tech stack:** Node ≥ 18, ESM, zero runtime dependencies, `node:assert/strict` +
`console.log("... OK")` test style (match existing suites).

## Global constraints

- **Spine is read-only.** `merkle-dag/*`, `build-gate/*`, `breakout/*`,
  `connectors/*` unmodified. Enforcement never keys off a Clotho record.
- **No minted identities for things that already have one** — commit shas, plan
  hashes, concern refs, ledger entry hashes are used as-is inside locators.
  `node_id = H({kind, locator})`; doc-section locators embed section-text sha256.
- **Every edge carries `source_ref`** (content address of its evidence) and
  `asserted_by` (weaver id / `"human"` / model seat). Writes without either fail.
- **Closed sets enforced at write time:** unknown node kind or edge kind → reject.
- **Ledger output** under `.telos/clotho/` (git-ignored) by default; committed
  snapshots only as explicit run evidence under `docs/runs/clotho-self-weave/`.
- Branch → PR → CI → squash-merge per task; add `clotho` to the CI matrix.
- **Exit:** `cd clotho && npm test` green (incl. flagship acceptance + fail-closed
  gap test); all existing packages stay green; evidence in
  `docs/runs/clotho-self-weave/`.

## File structure

| File | Responsibility |
|---|---|
| `clotho/package.json` | ESM package; `check` + `test` scripts (mirror sibling packages). |
| `clotho/registry.mjs` | `NODE_KINDS`, `EDGE_KINDS` (closed sets), `deriveNodeId({kind, locator})`, kind-specific locator validators. |
| `clotho/thread-ledger.mjs` | Append-only signed edge records `{edge_kind, from_node, to_node, asserted_by, source_ref, woven_at}`; verify (signature + chain); reject on missing provenance or unregistered kind. |
| `clotho/weavers/git.mjs` | Commits ↔ symbols/files (`introduced-by`) via `git log -S` / `--follow`. |
| `clotho/weavers/code.mjs` | Import/call graph across packages (`depends-on`). |
| `clotho/weavers/test.mjs` | Test scripts ↔ exercised symbols (`verified-by`). |
| `clotho/weavers/doc.mjs` | Docs/contracts sections naming a mechanism (`documented-in`), with section-text hashes. |
| `clotho/weavers/ledger.mjs` | Concerns/obligations/run evidence (`motivated-by`, `discharges`, `evidenced-by`). |
| `clotho/query.mjs` | Pure: `threadsOf(nodeId)`, `blastRadius(nodeId, depth)`, `why(nodeId)`. |
| `clotho/weave.mjs` | Driver: run all weavers over the repo → one ledger; `#!/usr/bin/env node`. |
| `clotho/scripts/test-registry.mjs` | Closed-set + node-id derivation units. |
| `clotho/scripts/test-ledger.mjs` | Append/verify/reject units (bad kind, missing source_ref, tampered record). |
| `clotho/scripts/test-weavers.mjs` | Each weaver against a small in-repo fixture; determinism (two runs → identical edges). |
| `clotho/scripts/test-flagship.mjs` | Acceptance: flagship query vs `expected-flagship.json`; fail-closed gap test. |
| `clotho/scripts/expected-flagship.json` | The hand-audited expected set for `deriveExecutableRef` (8 sources; spec table). |
| `.github/workflows/ci.yml` | Add `clotho` to the matrix. |
| `docs/runs/clotho-self-weave/` | `run.mjs` + snapshot + summary — reproducible evidence. |
| `docs/STATUS.md`, `docs/ROADMAP.md` | Status updates on land. |

---

### Task 1: Package scaffold + CI wiring
**Files:** create `clotho/package.json`, stub `clotho/scripts/test-registry.mjs`; modify `.github/workflows/ci.yml`.
- [ ] `package.json` with `check` (node --check over every module) + `test` scripts
- [ ] CI matrix entry; PR; existing packages green

### Task 2: Registries + identity (`registry.mjs`)
**Interfaces:** `NODE_KINDS`, `EDGE_KINDS`, `deriveNodeId`, `validateLocator(kind, locator)`.
- [ ] Closed sets exactly as spec'd (10 node kinds, 8 edge kinds) — extending is a human edit here, nowhere else
- [ ] `deriveNodeId` — stable hash, normalization rules mirrored from `deriveExecutableRef`'s discipline (omitted field ≡ default)
- [ ] Units: unknown kind rejected; same locator → same id; doc-section locator requires text hash

### Task 3: Thread ledger (`thread-ledger.mjs`)
**Interfaces:** `appendEdge(ledger, record, signKey)`, `verifyLedger(path, pubKey)`, `readEdges(path)`.
- [ ] Reuse merkle-dag Ed25519 signing/verify primitives via relative import (do not copy crypto)
- [ ] Reject: unregistered kinds, missing `source_ref`/`asserted_by`, node ids not derivable from the registry
- [ ] Units incl. tamper detection (bit-flip a record → verify fails)

### Task 4: Weavers (5 modules, one PR each or grouped — Daedalus decides)
**Shared contract:** `weave(ctx) -> edgeRecord[]`, deterministic, read-only, stable `asserted_by` id per weaver.
- [ ] `git.mjs`: `introduced-by` edges from `git log -S<symbol>`; commit sha as locator
- [ ] `code.mjs`: `depends-on` from static import + named-export usage scan (no execution)
- [ ] `test.mjs`: `verified-by` from test-script imports/spawned check commands
- [ ] `doc.mjs`: `documented-in` from symbol mentions in `docs/**/*.md` + `contracts/*.md`, section-hash locators
- [ ] `ledger.mjs`: `motivated-by`/`discharges`/`evidenced-by` from proposal-ledger records + `docs/runs/`
- [ ] Determinism test: weave twice → byte-identical edge sets (sorted)

### Task 5: Queries (`query.mjs`)
- [ ] `threadsOf` (group by edge kind), `blastRadius` (transitive `depends-on` ∪ `verified-by`, depth-bounded), `why` (`introduced-by` → `motivated-by` → `discharges` walk)
- [ ] Pure functions over `readEdges()` output; no ledger mutation; units on a synthetic mini-graph

### Task 6: Flagship acceptance + fail-closed gap
- [ ] Hand-audit `expected-flagship.json` from the spec's 8-source table (this is human work — The Eye reviews it)
- [ ] `test-flagship.mjs`: full weave of the repo → `why()` + `blastRadius()` over the `deriveExecutableRef` code-symbol node → assert ⊇ expected set
- [ ] Gap test: run weave with `doc.mjs` disabled → query result must REPORT the missing `documented-in` thread (explicit gap object), not silently shrink

### Task 7: Evidence + docs
- [ ] `docs/runs/clotho-self-weave/`: `run.mjs` (reproduces the weave keylessly with an ephemeral key), ledger snapshot, `summary.json` with the flagship answer
- [ ] `docs/STATUS.md` + `docs/ROADMAP.md` entries; move spec/plan to `docs/history/` on completion per convention

---

## Risks / open questions for the Daedalus workshop

1. **Symbol identity across history** — `git log -S` finds commits, but a renamed
   symbol breaks the thread. Phase 1 position: accept the break, record a gap;
   `supersedes` edges are the mechanism, human-asserted at first.
2. **Doc-section drift** — locators embed text hashes, so every doc edit orphans
   its edges. Decide: re-weave cadence vs. tolerant matching (hash of heading path
   as secondary locator).
3. **Weaver precision vs. recall** — grep-shaped weavers will over-match symbol
   names in prose. Decide the false-positive posture (Phase 1 lean: over-thread and
   let queries expose noise; Lachesis later scores relevance — that is HER job, do
   not smuggle scoring into Clotho).
4. **Ledger size** — full-repo weave volume unknown; JSONL append-only should hold
   for one repo, but measure in Task 4 and record in the run evidence.
5. **Signing key** — ephemeral per-weave (matches keyless-run precedent) vs. a
   durable `TELOS_CLOTHO_SK`. Skeleton assumes ephemeral; durable is a lifecycle
   decision.
