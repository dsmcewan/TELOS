# ai-forge — Phase A Design (library substrate + RAG pattern)

**Goal:** Make TELOS's workstream set **data-driven from a pattern library**, and
prove it with one production-shaped **RAG** pattern driven end-to-end to
`merge_status: "ready"` — producing a genuinely-runnable AI system (preceded by
the content-addressed plan that designs it), on the unchanged TELOS trust spine.
Formalizing that plan into a standalone, gate-checked **design artifact** is
Phase B, not Phase A.

**Architecture:** `ai-forge` is a sibling of `saas-forge` on the same spine
(plan → content-addressed plan → council approval gate → team build → Rule-3
verify → signed Ed25519 ledger → `done()`). The one new abstraction is the
**pattern**: a library entry (data) supplying the workstreams + per-workstream
artifact / fact-checks / generator that `saas-forge` currently hard-codes.

**Status:** design approved 2026-06-29; spec → (this doc) → `writing-plans` → build.
See [`docs/ROADMAP.md`](../ROADMAP.md) Phase A.

---

## Context

`saas-forge` proved the engine's policy/mechanism seam: it hard-codes 7 SaaS
workstreams and rides the spine. Phase A turns that hard-coded set into a **value
chosen from a library**, so every "kind of AI architecture" becomes a library
entry. RAG is the first entry, chosen because it is well-understood and exercises a
genuinely-runnable system (retrieval + eval that actually execute). This is the MVP that de-risks Phases B
(design-as-artifact) and C (library breadth) — both additive once the pattern
schema + loader are stable.

**Core principle (do not violate):** mechanism stays, policy becomes data. The
gate, signing (`sign.mjs`), and the `merkle-dag` substrate are untouched. The
build/verify invariant carries over: *the thing that builds is never the thing
that certifies* — a team's claim is data; the disk is truth; fail-closed.

## The pattern abstraction (the new, reusable unit)

A pattern is **data + per-workstream functions**. `ai-forge/forge.mjs` is generic
over it.

```
pattern = {
  id: "rag",
  workstreams: [
    {
      id,                       // stable workstream id (also the node id basis)
      mission,                  // one line: what this workstream delivers
      artifact,                 // relative path it owns under baseDir
      team,                     // existing build-gate team (by strength) that builds it
      generate,                 // deterministic stand-in generator (Rule 1 dispatch);
                                //   live boundary overrides for fully-live runs
      checks: [ /* on-disk fact-checks over the BUILT artifact */ ]
    },
    ...
  ]
}
```

Key decision: each workstream **assigns itself to an existing strength-matched
team** (`build-gate/teams.mjs`) via `team`. So a new pattern needs **no new
model-seat machinery** — RAG, multi-agent, and the TELOS-pattern itself all reuse
the same ten teams, wiring different workstreams to them. (`saas-forge`'s
`workstreams.mjs` becomes "the SaaS pattern" conceptually; it is **not** refactored
in Phase A.)

## The RAG pattern — 7 workstreams

Each owns one artifact, is built by a strength-matched team, and is gated by
fact-checks re-verified on disk by the gate (Rule 3).

| # | Workstream | Builder (team · strength) | Artifact(s) | Breakout asserts (on the built artifact, on disk) |
|---|---|---|---|---|
| 1 | ingestion + chunking | backend · codex | `rag/ingest.mjs`, `rag/chunks.jsonl` | chunks non-empty; respect max-token bound + configured overlap; deterministic over the fixed corpus |
| 2 | embedding + index | backend · codex | `rag/index.build.mjs`, `rag/index.json` | vector count == chunk count; consistent dimension; index references the chunk ids |
| 3 | retrieval | architecture · claude | `rag/retrieve.mjs` | a known query returns the expected doc in top-k — **the test runs retrieval** |
| 4 | generation + prompt | architecture · claude | `rag/prompt.md`, `rag/generate.mjs` | template contains a retrieved-context slot + a citation instruction; a generated answer cites a retrieved chunk |
| 5 | eval-harness | evals · codex | `rag/evals/scorecard.json`, `rag/evals/run.mjs` | precision@k and faithfulness clear declared thresholds — **the test runs the eval** |
| 6 | serving + guardrails | security · grok | `rag/serve.config.json`, `rag/guardrails.mjs` | a known injection/PII input is blocked; the grounding gate rejects an ungrounded answer |
| 7 | observability / ops | ops · agy | `rag/OPERATIONS.md` (+ trace hooks) | required tracing fields present; cost + latency SLOs declared |

The eval-harness (5) and retrieval (3) are the on-brand pieces: their node tests
**execute** (retrieval returns the right doc; the eval clears a threshold), so the
gate's Rule-3 re-run genuinely exercises the AI system, not just file shape.

## Data flow (one forge run)

```
idea ("a RAG over corpus X") + telos
  → [Planning team] decompose() → the pattern's 7 workstreams as tasks[]
  → compileAndHashPlan() → content-addressed plan; writePlan()
  → COUNCIL APPROVAL GATE: runCouncil → validateRecords   (must pass before execution)
  → runBuild(): each workstream node → its assigned strength-matched team (Rule 1)
        team writes its artifact; the node's OWN test runs (retrieval/eval execute)
  → Rule-3 verify: gate re-derives the artifact tree-hash from disk + re-runs the test
  → settle: controller (sole writer) signs the Ed25519 ledger line
  → ledger-gate.verify() done() → merge_status: "ready"
```

## Live vs. test boundaries (fully-live capability + zero-dep tests)

Three **injected boundaries**, defaulting to keyless deterministic stubs:

| Boundary | Test default (keyless, deterministic) | Live (`live.mjs`, your keys) |
|---|---|---|
| embedding backend | fixed/hash-based embeddings | real embeddings API |
| vector store | in-memory deterministic index | real vector store |
| LLM generation | deterministic stand-in via stubbed transport | `ai-peer-mcp` model seats |

The **same pipeline** runs fully-live on demand (genuine retrieval + generation)
and reproducibly in CI (keyless). `ai-forge/live.mjs` wires the real boundaries;
`scripts/test-forge.mjs` wires the stubs. This is the `saas-forge` live/offline
split applied to RAG.

## Directory layout

```
ai-forge/
  forge.mjs            # generic over a pattern (mirrors saas-forge/forge.mjs)
  patterns/
    rag.mjs            # the RAG pattern: 7 workstreams as data
  generators.mjs       # deterministic stand-in generators (keyless test path)
  breakouts.mjs        # fact-grounded breakout per workstream (reuses breakout/ engine)
  live.mjs             # injected live boundaries: embeddings + vector store + LLM
  package.json         # ESM, node>=18, zero runtime deps
  scripts/
    test-forge.mjs     # keyless e2e: 7 workstreams generate + breakout-survive + gate pass + fail-closed
    test-live.mjs      # live path wired with a stubbed transport (keyless), proves wiring
```

Reused unchanged: `build-gate/` (gate, council, sign, teams, build-orchestrator),
all of `merkle-dag/`, `breakout/`, `connectors/ai-peer-mcp/`.

## Trust model preserved (no new surface)

- Generators are `dispatch` — a team sees only its own node spec (Rule 1).
- The gate independently re-derives each artifact's tree-hash from disk and re-runs
  the node test (Rule 3); a team can never self-certify.
- Eval/market packets are **generated from breakout records**, never hand-asserted;
  the gate re-verifies them on disk.
- A missing key or missing evidence ⇒ fail-closed (no converge, no settle), never a
  fabricated pass.
- `sign.mjs`, the gate's decision logic, and `merkle-dag/*` are untouched.

## Testing

- `scripts/test-forge.mjs` (keyless, deterministic): all 7 workstreams generate,
  each survives its fact-grounded breakout, the gate passes, the ledger settles,
  `done(): ready`. **Fail-closed case:** corrupt the guardrails artifact (6) → its
  breakout does not converge → the forge does not converge.
- `scripts/test-live.mjs`: drives the live code path with a stubbed transport (no
  keys) to prove the wiring.
- Zero new dependencies; Node ≥ 18. Added to the CI matrix as `ai-forge`
  (ubuntu, Node 18 & 20).

## Exit criteria

- `node ai-forge/... ` produces `merge_status: "ready"` for the RAG pattern over the
  **real** gate + Ed25519 ledger + merkle-dag (keyless, reproducible).
- `ai-forge` `npm test` exit 0; all existing packages remain green.
- Evidence committed under `docs/runs/ai-forge-rag/` (run summary).

## Decisions log (from brainstorming, 2026-06-29)

- **Unifying abstraction:** "expand into AI architecture" = one pattern-library-driven
  forge; reference library = data, design = plan stage, runnable system = build
  stage, TELOS-style systems = one library entry. (See ROADMAP.)
- **Phase A scope:** library substrate + one RAG pattern end-to-end (the MVP).
- **RAG realism:** fully-live is the **runnable capability** (real embeddings + vector
  store + LLM behind injected boundaries, on demand with keys); the **committed test**
  stays keyless + deterministic. Live-in-CI was rejected — it breaks the zero-dep,
  reproducible-test discipline.
- **Workstreams:** the full production-shaped **7** (incl. serving+guardrails and
  observability/ops), not the leaner 5 or 3.
- **Routing:** each workstream assigns itself to an existing strength-matched team;
  no new model-seat teams for RAG.

## Non-goals (Phase A — YAGNI)

- No pattern-picker UI / wizard (CLI/dossier-driven is enough).
- No refactor of `saas-forge` into "the SaaS pattern" (conceptual parallel only).
- No change to the trust spine, gate, signing, or `merkle-dag` substrate.
- No second pattern (multi-agent, etc.) — that is Phase C.
- Phase B (design-as-first-class-artifact) is separate; Phase A's plan stage may
  emit a partial design but does not make it independently gate-checked.
