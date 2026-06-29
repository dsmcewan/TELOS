# ai-forge — Phase B Design (design-as-verified-artifact)

**Goal:** Make the architecture **design** a first-class, council-approved,
gate-verified artifact: the forge emits a `DESIGN.md` (structured component block +
narrative + diagram) that an executable node test verifies against the
content-addressed plan, the signed ledger, and the built artifacts — fail-closed on
drift. Delivered as a single **generic, pattern-agnostic `design` workstream**,
demonstrated on the RAG pattern.

**Architecture:** No new forge machinery. Phase B adds one workstream
(`makeDesignWorkstream(buildWorkstreams)`) that any pattern includes. Its render
authors `DESIGN.md` (deterministic on the keyless test path; model-authored on the
live path); its node test `docs/design/verify.mjs` checks the design against ground
truth (`.telos/plan.json`, `.telos/ledger.jsonl`, on-disk artifacts). Rides Phase
A's forge driver and the TELOS spine verbatim.

**Status:** design approved 2026-06-29; spec → (this doc) → `writing-plans` → build.
See [`docs/ROADMAP.md`](../ROADMAP.md) Phase B. Builds on
[Phase A](2026-06-29-ai-forge-phase-a-design.md).

---

## Context

Phase A produces a runnable system; its "design" is **implicit** in the
content-addressed plan (`computePlan` → `plan.json`): components = workstreams,
data-flow = the dependency DAG, model choices = each workstream's signer. Phase B
makes that design **explicit, narrated, and independently verified** — without
inventing a design from nothing, and without trusting it.

**Core principle (Phase A's trust model, one level up):** the design is an
authored **claim**; the gate verifies it against ground truth it cannot fake (the
plan, the ledger, the built artifacts). A drifted design — one that claims a
component the plan doesn't build, omits one it does, declares a wrong data-flow
edge, names the wrong model, or points at an absent artifact — **fails closed**.
This mirrors Phase A exactly: in the keyless test the render produces a consistent
design (so the suite converges); on the live path a model authors the design (which
*can* drift) and `verify.mjs` is the load-bearing gate. A fail-closed test proves
the gate is not a tautology.

## The design artifact — `docs/DESIGN.md`

Two parts, so it is both human-readable and machine-checkable:

1. **Structured component block** — a single fenced ```json array, the design's
   verifiable claim about system structure. Each entry:
   ```json
   { "workstream": "<plan node id>", "model": "<authoring model>",
     "artifact": "<relative path>", "depends_on": ["<plan node id>", ...] }
   ```
2. **Narrative + diagram** — the five required prose sections, each with a fixed
   header and a non-empty body: **Component boundaries · Data flow · Model/infra
   choices · Eval plan · Risks** — plus a **mermaid** data-flow diagram whose edges
   are rendered from the structured block (so diagram and checks agree by
   construction).

## The `design` workstream

Provided by a generic factory `makeDesignWorkstream(buildWorkstreams)` (in
`ai-forge/workstreams/design.mjs`); a pattern appends it after its build
workstreams. Standard Phase A workstream shape:

- `id: "design"`, `signer`/`lens`: **`claude`** (architecture/synthesis strength —
  it authors the architecture narrative).
- `files: ["docs/DESIGN.md", "docs/design/verify.mjs"]` — the render writes the doc
  **and** its verifier script (exactly as Phase A renders write their executable
  node tests `retrieve.mjs` / `evals/run.mjs`).
- `dependencies`: **every build workstream's id** — so the design topo-sorts LAST;
  by the time its node test runs, all build nodes have settled (their artifacts on
  disk and their ledger entries written).
- `render(ctx)`: deterministically synthesizes the component block (derived from
  `buildWorkstreams`: `workstream`=id, `model`=signer, `artifact`=files[0],
  `depends_on`=dependencies), the narrative, and the mermaid diagram. Keyless. On
  the live path, a model authors `DESIGN.md` from the plan/pattern context; the
  render still emits the fixed `verify.mjs`.
- `checks(ctx)`: the **breakout-layer** checks (run adversarially by
  `runPatternBreakouts` and used to generate the market packet, exactly as for
  every Phase A workstream): `file_exists docs/DESIGN.md`, `file_exists
  docs/design/verify.mjs`, and a `file_contains` for each of the five section
  headers. These are the lightweight surface checks; the deep design↔plan↔build
  consistency lives in the `nodeTest` below.
- `nodeTest: { cmd: "node", args: ["docs/design/verify.mjs"] }` (cwd = project
  root). Because `nodeTest` is present, the build's Rule-3 verify runs `verify.mjs`
  (not the `checks`-derived test) as the design node's gate — so a drifted design
  fails the build even though its surface `checks` pass.
- `findingsKey: "design_findings"`, `finding`: a one-line design-coherence statement
  (Phase A contract — every workstream defines `findingsKey` + `finding`).

## `docs/design/verify.mjs` — the gate's teeth (full check set)

Run as the design node's test (cwd = project root). Ground-truth sources:
`.telos/plan.json` (node ids, dependencies, files), `.telos/ledger.jsonl`
(per-workstream `signer`), the on-disk tree, and `docs/DESIGN.md` (the claim).
Parse the fenced ```json component block from `DESIGN.md`; let `EXPECTED` = plan
node ids **minus `"design"`**. Assert, exiting non-zero (with a clear message) on
the first failure:

- **(a) Coverage exact:** `{c.workstream}` == `EXPECTED` — no missing, no phantom.
- **(b) Data-flow == DAG:** for each component, `sorted(c.depends_on)` ==
  `sorted(plan.node[c.workstream].dependencies)`, edge-for-edge.
- **(c) Realized:** each `c.artifact` is in `plan.node[c.workstream].files` AND
  exists on disk (resolved under cwd; no path escape).
- **(d) Model traceability:** each `c.model` == the `signer` of that workstream's
  entry in `.telos/ledger.jsonl` (the model that actually signed the artifact —
  cryptographic ground truth, not the design's self-claim).
- **(e) Sections:** the five narrative headers are present, each with a non-empty
  body.

On any failure the design node does not settle → the forge does not converge
(fail-closed). The verifier is a zero-dependency Node script (`node:fs` only), no
shell, paths confined under cwd.

## Pattern integration

- `patterns/rag.mjs`: append `makeDesignWorkstream([the 7 build workstreams])` →
  the RAG pattern now has **8** workstreams and every RAG run also produces and
  verifies a design.
- The `design` node depends on all 7, so it is the plan sink; the market gate's
  `required_market_workstreams` now includes `"design"` (it gets a market packet
  from its breakout record like any workstream).
- Coverage check excludes the `design` node itself (it is the meta-view, not a
  component of the system it describes).
- Because `verify.mjs` reads `plan.json` / `ledger.jsonl` (not RAG specifics), the
  workstream is **pattern-agnostic** — Phase C patterns get a verified design for
  free by including `makeDesignWorkstream(theirWorkstreams)`.

## Trust preserved

- The design is dispatched like any workstream (Rule 1: the render sees only its
  node's spec); the gate independently re-runs `verify.mjs` (Rule 3) against the
  plan/ledger/disk — the design cannot self-certify.
- Model traceability binds the design's model claims to the **signed ledger**, so a
  design cannot misattribute authorship without detection.
- Fail-closed: any drift (missing/phantom component, wrong edge, wrong model,
  unrealized artifact, empty section) blocks. No spine, `gate.mjs`, `sign.mjs`,
  `merkle-dag`, or `saas-forge` change.

## Testing (keyless, deterministic, zero-dep)

- **e2e:** the RAG run (now 8 workstreams) converges; `DESIGN.md` is produced and
  `verify.mjs` passes; `result.records.length === 8`.
- **Fail-closed (proves the gate is not a tautology)** — four sub-cases, each
  perturbing the design render so exactly one invariant breaks, asserting the run
  does NOT converge: (i) omit a component, (ii) invent a phantom component,
  (iii) declare a wrong `depends_on` edge, (iv) point a component at an unrealized
  artifact. (A fifth, wrong-model, is covered by the unit test below.)
- **`verify.mjs` unit test:** drive `verify.mjs` directly over a synthetic
  `plan.json` + `ledger.jsonl` + `DESIGN.md` fixture in a temp dir — a consistent
  set exits 0; each of the five drift kinds (a–e, incl. wrong-model) exits non-zero.
- Added to the existing `ai-forge` CI matrix entry (ubuntu, Node 18 & 20).

## Exit criteria

- `ai-forge` `npm test` exit 0, including the RAG e2e (8 workstreams converge) +
  the four fail-closed design sub-cases + the `verify.mjs` unit test.
- `docs/runs/ai-forge-rag/` evidence regenerated to show the design artifact +
  `verify.mjs` passing (8 workstreams `meets`).
- All existing packages remain green; spine and saas-forge untouched.

## Decisions log (brainstorming, 2026-06-29)

- **Verify-design model:** authored claim, checked vs plan + ledger + build,
  fail-closed (not a derived/trivially-consistent view, not LLM-judged quality).
- **Lifecycle placement:** a `design` **workstream** (pure Phase A reuse), not a
  new forge stage. Concession: "verified within the build, last" rather than
  strictly before it — accepted because the build is fast/deterministic, so
  early-fail has low value here.
- **Check set:** FULL — coverage (exact) + data-flow == DAG + realized-on-disk +
  model-traceability-vs-ledger + sections present/non-empty.
- **Author seat:** `claude` (architecture/synthesis).
- **Generic factory:** `makeDesignWorkstream(buildWorkstreams)` — pattern-agnostic,
  reusable across Phase C patterns.

## Non-goals (Phase B — YAGNI)

- No council-judged design **quality** (adequacy of the eval plan, realism of
  risks) — that is LLM judgment, non-deterministic, key-requiring; out of scope for
  the committed gate (could later live behind a `live.mjs` boundary).
- No new forge lifecycle stage; no second gate pass; no spine/saas-forge edits.
- No refactor of the Phase A workstreams; the 7 build workstreams are unchanged
  except that the pattern now also includes the design workstream.
- Phase C (additional patterns) and the deferred `forge-kit` helper hoist
  (issue #30) remain out of scope.
