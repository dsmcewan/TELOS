# TELOS Roadmap

> Living tracking doc. Update **Status** and the **Decisions log** as work lands.
> This is the map; each phase still gets its own spec → plan → build — and, since
> 2026-07-17, each implementation runs under the Iliad lifecycle
> (pre-review → entry ritual → implement → enroll → retrospective → next-phase
> Daedalus review; `docs/institutional-memory/iliad/`).
>
> The `ai-forge` expansion below is **complete** (Phases A–C.2). The Clotho
> Phase 1 section and the "What's next" candidates follow it.

## Vision (ai-forge expansion — complete)

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

### Phase A — Library substrate + one pattern end-to-end (MVP)  ✅ done
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

### Phase B — Design stage as a first-class verified artifact  ✅ done
- **Objective:** emit the **architecture design/spec** (component boundaries, data
  flow, model/infra choices, eval plan, risks) as a council-approved artifact
  *before* build, with its own fact-checks (completeness/consistency, not "it runs").
- **Deliverable:** a design-doc + diagram artifact per forge run, gate-verified.
- **Depends on:** A (the plan stage may already emit a partial design — B makes it
  first-class and independently checkable).

### Phase C — Library breadth (the TELOS pattern)  ✅ done
- **Objective:** grow the catalog; each pattern is mostly **data + fact-checks**.
- **This phase = the TELOS pattern** (self-similar / meta — the original "TELOS-style
  systems" ask): ai-forge forges a working TELOS-like trust system — 7 forged
  components (sign · plan · provenance · gate · council · ledger/done · breakout)
  that **wrap the real spine** via a ctx-injected `spineRoot`, each with a genuine
  executable selftest, + the generic design workstream (8 total).
- **Depends on:** A+B (pattern schema + generic design workstream — both settled).

### Phase C.2 — Catalog breadth (multi-agent, eval-harness, serving+guardrails)  ✅ done
- **Objective:** grow the catalog with three standalone patterns, each an independent
  8-workstream forge run that converges over the real gate + Ed25519 ledger.
- **Patterns added:**
  - **multi-agent** — orchestrator + worker agents, handoff contracts, fan-out/fan-in;
  - **eval-harness** — scorecard, stored≈recomputed cross-check (makes #30 item-2
    first-class), judge wiring, threshold gates;
  - **serving+guardrails** — inference serving, input/output guardrail layers,
    latency/cost SLOs.
- **Deliverable:** three patterns each with 8 workstreams (7 domain-specific + design),
  all adversarial breakouts pass, gates certify `merge_status: ready`; run evidence
  under `docs/runs/ai-forge-{multiagent,eval,serving}/`.
- **Depends on:** A+B+C (pattern schema, generic design workstream, TELOS pattern — all settled).

## Status

| Phase | State | Spec | Plan | Built | Notes |
| --- | --- | --- | --- | --- | --- |
| A — substrate + RAG | ✅ done | [phase-a-design](history/specs/2026-06-29-ai-forge-phase-a-design.md) | — | [ai-forge-rag](runs/ai-forge-rag/) | all 7 workstreams converged; PRs #21–28 |
| B — design stage | ✅ done | [phase-b-design](history/specs/2026-06-29-ai-forge-phase-b-design.md) | — | [ai-forge-rag](runs/ai-forge-rag/) | design workstream → DESIGN.md verified vs plan+ledger+build; PRs #33–35 |
| C — TELOS pattern | ✅ done | [phase-c-design](history/specs/2026-06-29-ai-forge-phase-c-design.md) | — | [ai-forge-telos](runs/ai-forge-telos/) | 8 workstreams converge (7 spine-wrapping + design); PRs #38–43 |
| C.2 — catalog breadth | ✅ done | [phase-c2-design](history/specs/2026-06-29-ai-forge-phase-c2-design.md) | — | [multiagent](runs/ai-forge-multiagent/) · [eval](runs/ai-forge-eval/) · [serving](runs/ai-forge-serving/) | three 8-workstream patterns converge; PRs #49–60 |

Legend: ⬜ not started · 🟡 in progress · ✅ done

## Clotho Phase 1 — provenance-aware knowledge-graph weaver (2026-07)

**State: slices 0–6 accepted; slice 7 (Phase 1 closure) in delivery.** Authority:
`CURRENT-AUTHORITY.json` (plan v15 `sha256:05a48700…`, authz-008); current honest
status: `docs/STATUS.md`.

Delivered so far, each slice lifecycle-governed (pre-review → comprehension-gate
entry ritual → implement → enroll → retrospective → next-phase Daedalus review):

- **Plan maturation:** Daedalus deltas v1→v15 with signed authorization runs
  authz-001..008 — including preserved refusals (authz-004/-007 correctly blocked
  defective plans; refusals are the system working).
- **Slices 0–4a** (scaffold, CI, registry/ledger, git+code weavers) — PR #117.
- **Slices 4b/5/6** (test/doc/ledger weavers; query surface + complete-weave
  driver; flagship acceptance) — PR #126. First real-repository weave: 3892
  edges, five weavers, signed ledger, `published` clean; successive delivery
  weaves 3898 → 3954 edges. Flagship acceptance (`deriveExecutableRef`, all
  eight groups, 76-fact unscored review set) runs in `cd clotho && npm test`
  (14 tests). Task 6 set the escalation precedent: proved-unsatisfiable →
  CHANGE-PROTOCOL escalation → The Eye's reviewed-data ruling → green.
- **Institutional memory + role modules + the Iliad lifecycle** (2026-07-17):
  machine-first records with executable oracles (`verify-contracts.mjs`,
  `comprehension-gate.mjs`); role modules Daedalus/TELOS/Argo/loadout/Iliad;
  enrollment registry with mandatory retrospectives; the suite named by The Eye
  ("AI Systems Architects Best Practices Suite: Rapid Full Deployment and SDLC
  Recursive Suite").
- **Slice 7 (in delivery):** STATUS/ROADMAP current + convention-conformant
  history moves (this change, agent-D) and the reproduction evidence run
  `docs/runs/clotho-self-weave/` (agent-R); acceptance requires the final
  evidence run from committed bytes, the Eye's re-binding of the expected
  flagship artifact against the integrated HEAD, and all package suites green.

## What's next (Phase-2-class candidates — named, not authorized)

Every item below routes through CHANGE-PROTOCOL (Daedalus → TELOS authorization →
Iliad lifecycle); naming here is not authorization.

1. **Corpus-level Daedalus review via the Clotho weave** — use the published
   real-repository weave (why chains, blast radius, review sets) as the input
   substrate for a corpus-wide Daedalus review pass, instead of per-document
   reading.
2. **README renderer + drift gate** — generate `clotho/memory/README.md` from
   the machine records and gate hand-drift (OPEN-QUESTIONS candidate, deferred
   out of slice 7 deliberately).
3. **Warning-shape harmonization amendment** — `{weaver, code, path, detail}`
   (frozen v15) vs `{weaver, message}` (accepted weavers); a small Daedalus
   delta when the weavers are next touched (slice-5 retrospective).
4. **Future modules** — Hermes (API management / inter-system communication),
   Medusa (defensive edge enforcement), Narcissus (iterative UI rendering and
   visual review), Lachesis (dependency/risk/blast-radius measurement), Atropos
   (retirement of obsolete artifacts): registered-unimplemented, names reserved
   with meaning (`docs/mythological-vocabulary.md`); implementing one follows
   CHANGE-PROTOCOL + the Iliad lifecycle.
5. **Forge products** (`ai-forge`, `forge`, `saas-forge`) remain AM-40-deferred
   pending conscious enrollment at the Iliad — never absorption by proximity.
6. Older open items (issues #30/#37): composable-workstream-library
   generalization (deferred beyond C.2, unchanged).

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
- **2026-06-29 — Phase A built.** RAG pattern → `converged: true`; all 7 workstreams
  survive adversarial breakout; gate passes; Ed25519 ledger settles. PRs #21–28.
- **2026-06-29 — Phase B built.** Design workstream → `DESIGN.md` verified vs
  plan + ledger + built tree; RAG pattern now has 8 workstreams (7 build + design),
  all converged; PRs #33–35.
- **2026-06-29 — Phase C built.** The TELOS pattern → ai-forge forges a TELOS-like
  trust system; 8 workstreams converge (7 spine-wrapping components: sign · plan ·
  provenance · gate · council · ledger · breakout + the generic design workstream);
  PRs #38–43.
- **2026-06-29 — Phase C.2 built.** Three standalone patterns (multi-agent,
  eval-harness, serving+guardrails), ~24 workstreams converge; eval scorecard makes
  the #30 item-2 stored≈recomputed cross-check first-class; PRs #49–60.
- **2026-07-14/15 — Proposal Lifecycle implemented + Argo completion pass.** The
  frozen `contracts/Proposal Lifecycle.md` shipped as an opt-in layer; the Argo
  pass composed the primitives into the autonomous entry point; adversarial
  review of the shipped code found and fixed a real fail-open (a mandatory
  `required_verification` on a non-blocking concern was silently dropped),
  pinned by a regression test. Details preserved in
  `docs/history/STATUS-2026-06-28.md`.
- **2026-07-16/17 — Clotho Phase 1 plan matured and implemented under authority.**
  Daedalus deltas to v15; signed authorizations authz-001..008 with two refusals
  preserved; slices 0–4a accepted (PR #117), 4b/5/6 accepted (PR #126: first
  real-repository weave 3892 edges; flagship acceptance in `npm test`; the Task 6
  escalation → Eye reviewed-data ruling precedent).
- **2026-07-17 — Institutional memory + role modules + the Iliad lifecycle
  instituted; suite named by The Eye.** Machine-first governance records with
  executable oracles; every subsequent implementation is lifecycle-governed
  (pre-review → entry ritual → implement → enroll → retrospective → next-phase
  Daedalus review).
- **2026-07-17 — Slice 7 (Phase 1 closure) delivery split.** Two disjoint
  writers per the matured approach (`docs/runs/clotho-slice7-daedalus/`):
  agent-D — STATUS/ROADMAP + path-sensitivity-checked history moves (this
  change); agent-R — the self-weave reproduction evidence. Acceptance pending
  the final committed-byte evidence run and The Eye's review.

## Out of scope (YAGNI — revisit only if needed)

- A UI / wizard for choosing patterns (CLI/dossier-driven is enough to prove it).
- Auto-discovering patterns from the wild; the library is hand-curated.
- Changing the trust spine, gate, signing, or merkle-dag substrate.
