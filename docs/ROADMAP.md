# TELOS Roadmap — `ai-forge`

> Living tracking doc. Update **Status** and the **Decisions log** as work lands.
> This is the map; each phase still gets its own spec → plan → build.

## Vision

Expand TELOS from `saas-forge` (a hard-coded 7-team SaaS generator) into
**`ai-forge`**: a *pattern-library-driven* forge that produces **AI architectures**
— both the **design** and the **runnable system** — on the unchanged TELOS trust
spine.

The four things originally asked for collapse into **one forge + a library**:

| Asked for | Where it lives in this design |
| --- | --- |
| Reference architecture library | the **catalog** — patterns as data (teams + fact-checks + design template) |
| Architecture design / spec | the **plan-stage** output (council-approved before build) |
| Runnable AI system | the **build-stage** output (artifacts fact-checked on disk, settled) |
| TELOS-style systems | **one library entry** — "the trust-spine pattern" (self-similar, no new code) |

## Core principle (don't break this)

**Mechanism stays; policy becomes data.** The spine — plan → content-addressed
plan → council approval gate → team build (Rule 1) → Rule-3 verify → signed Ed25519
ledger → `done()` — is untouched. What changes: the **workstream registry +
per-team fact-checks** become a **value chosen from a pattern library** instead of
being hard-coded. `saas-forge` is the existing proof the seam works; `ai-forge` is
the second instance through it (two instances validate the abstraction).

The build/verify invariant carries over unchanged: *the thing that builds is never
the thing that certifies.* A team's claim is data; the disk is truth; fail-closed.

## Phases

Each phase is an independent spec → plan → build cycle. Build order A → B → C.

### Phase A — Library substrate + one pattern end-to-end (MVP)  ⬜ not started
- **Objective:** make the workstream set data-driven; prove it with ONE concrete
  pattern driven to `merge_status: "ready"`.
- **Deliverable:** `ai-forge/` consuming a **pattern** (data), + the **RAG** pattern
  end-to-end → a design *and* a runnable system, both fact-checked.
- **Key components (anticipated):** pattern schema (`pattern = { id, workstreams[],
  per-team artifact + breakout fact-checks, design template }`); `ai-forge/forge.mjs`
  (loads a pattern, reuses the spine); `ai-forge/patterns/rag.mjs` (first entry);
  generators + breakout checks for the RAG teams.
- **Verification / exit criteria:** keyless e2e test → RAG pattern's teams generate,
  each survives breakout-on-facts, gate passes, ledger settles, `done(): ready`;
  fail-closed test (break one artifact → no converge). All packages `npm test` green.
- **De-risks:** the entire idea — B and C are additive once this exists.

### Phase B — Design stage as a first-class verified artifact  ⬜ not started
- **Objective:** emit the **architecture design/spec** (component boundaries, data
  flow, model/infra choices, eval plan, risks) as a council-approved artifact
  *before* build, with its own fact-checks (completeness/consistency, not "it runs").
- **Deliverable:** a design-doc + diagram artifact per forge run, gate-verified.
- **Depends on:** A (the plan stage may already emit a partial design — B makes it
  first-class and independently checkable).

### Phase C — Library breadth  ⬜ not started
- **Objective:** grow the catalog; each pattern is mostly **data + fact-checks**.
- **Deliverable (candidate patterns):** multi-agent system, eval-harness,
  serving + guardrails, and **the TELOS trust-spine pattern itself** (the
  self-similar / meta entry — satisfies the original "TELOS-style systems" ask).
- **Depends on:** A (the pattern schema + loader must be stable first).

## Status

| Phase | State | Spec | Plan | Built | Notes |
| --- | --- | --- | --- | --- | --- |
| A — substrate + RAG | ⬜ not started | — | — | — | next: brainstorm Phase A in detail |
| B — design stage | ⬜ not started | — | — | — | after A |
| C — library breadth | ⬜ not started | — | — | — | after A |

Legend: ⬜ not started · 🟡 in progress · ✅ done

## Next action

**Brainstorm Phase A** (library substrate + RAG pattern) to a written spec, then
`writing-plans` → build. (Resume the `superpowers:brainstorming` flow on Phase A.)

## Decisions log

- **2026-06-29 — Unifying abstraction.** "Expand into AI architecture" (all four
  asks) is realized as *one pattern-library-driven forge*, not four subsystems.
  Reference library = data; design = plan stage; runnable system = build stage;
  TELOS-style systems = one library entry. Rationale: reuses the saas-forge seam
  (mechanism vs. policy); makes every "kind of AI architecture" a library entry.
- **2026-06-29 — Build order A → B → C.** Phase A (substrate + one RAG pattern
  end-to-end) is the MVP and de-risks the rest; B and C are additive.
- **2026-06-29 — First pattern = RAG.** Concrete, well-understood, exercises both a
  design and a runnable system; chosen to prove the seam.

## Out of scope (YAGNI — revisit only if needed)

- A UI / wizard for choosing patterns (CLI/dossier-driven is enough to prove it).
- Auto-discovering patterns from the wild; the library is hand-curated.
- Changing the trust spine, gate, signing, or merkle-dag substrate.
