# Candidate approach (rev 1) — Narcissus flagship front-end (enrollment quest, cycle 1)

**Cycle:** Iliad lifecycle. **Pre-review:** `file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-narcissus-1.json`.
**Registered meaning (AMENDED, applied by The Eye):** Narcissus *produces full-rollout, award-standard
front-ends through the reflection loop*. Front-ends are for the enrolled PRODUCTS, NOT the zero-dep core.

Cycle-1 deliverable: the **flagship development-story front-end** — a React + WebGL surface telling TELOS's
own honest self-build story. Direction = the breakout-synthesized **"Loom on Trial / Crucible Weave."** This
is the APPROACH the workshop matures; Argo builds the actual code after TELOS authorization.

## 1. The NORMATIVE architecture invariant — "WebGL is paint, never truth" (the thing that makes the gate passable)
- The Three.js/WebGL canvas is a **pure presentational view-layer**. It renders application state; it NEVER
  owns state, interaction, or progression.
- ALL state + every action lives in ONE deterministic **XState machine** + a **typed command registry**
  (`SELECT_RECORD, OPEN_EVIDENCE, ACK_POSITION, PULL_THREAD, SET_FILTER, SET_TIME, EXPORT, CHANGE_STATION,
  SKIP, RESET`). The machine is the single source of truth.
- **Every interactive 3D element is shadowed by an invisible, semantically-correct HTML control**
  (`<button>`/`<a>`/`<input type=range>`), absolutely positioned over the canvas, that receives all
  pointer/keyboard events and drives the machine. This yields BOTH deterministic E2E testability AND real
  accessibility (focusable, ARIA-labelled, keyboard-operable) for free, plus a reduced-motion fallback.
- A forced **test-mode `?e2e=1`** freezes RNG (seeded PRNG), pins the physics timestep (fixed 1/60), and
  disables springs/settle — so the surface is deterministic under test while alive in production.

## 2. Tech stack
React + Vite + TypeScript; **Tailwind** with the **LEXI token set** (dark near-black `#05070b`/`#0b0f1a`,
signature red `#ef4444`/`#b91c1c` + red bloom-glow, amber `#f59e0b`, **Inter + JetBrains Mono**, full
light/dark theming — `docs/runs/narcissus-1-prequest/lexi-tokens.md`); **react-three-fiber / Three.js** for
the loom + a LEXI-lineage **ferrofluid** shader (simplex noise, mouse-reactive, pulse); **XState** for the
machine; **D3** for the timeline/graph IA. Zero templated defaults; Core-Web-Vitals perf budget (loads +
runs in seconds, per the award standard).

## 3. The surface — "Loom on Trial" (journey + graph treatment)
- The award-facing spectacle: the Clotho weave as a **suspended, tension-loaded loom** — warp = Iliad quests,
  weft = artifacts, tension = councils, **knots/scars = stalemates**, **fused slag = reality-corrections**.
- The visitor moves among **discrete forensic STATIONS** (bounded, testable interactions — NOT free physics):
  AI-START-HERE → Iliad quests → Daedalus workshops → TELOS councils → reality-correction → "can't be lost."
  Each station = an XState state; navigation via DOM-shadowed controls.
- **Signature interaction:** `PULL_THREAD` — selecting a thread runs a GPU deformation of the weave + surfaces
  its Evidence Ledger; the reverse-topological **"unraveling"** is the emotional climax (the weave comes apart
  to show what depends on what — content-addressed, so it literally can't be lost).
- The knowledge graph does double duty: (a) its structure informs the information architecture; (b) it is a
  render-able surface (the loom IS the weave).

## 4. Data source — Evidence Ledger (grounded, reality-first)
The story is sourced from REAL artifacts: the authored institutional-memory records (`docs/institutional-memory/`,
`clotho/memory/`, `lachesis/memory/`) + the committed Clotho weave snapshot (read as DATA, the Lachesis
technique — never importing `clotho/`). Every station claim carries an **Evidence Ledger** entry citing the
exact record/commit. Honest story: stalemates, corrections, and "a plan that passed every gate yet was wrong
about reality" are shown, not hidden.

## 5. The two-blade gate (scope-honest)
- **Functional (NORMATIVE, deterministic oracle):** a browser-driven E2E suite (Playwright / chrome-devtools
  MCP) under `?e2e=1` asserting EVERY interactive element — every station nav, panel, dropdown, the pull-thread,
  timeline scrub, evidence-ledger open, exports — behaves correctly, via the DOM-shadowed controls. Plus a11y
  (axe) + perf budgets (Lighthouse/Core-Web-Vitals).
- **Aesthetic (ADVISORY, Eye-judged — NO oracle, not faked):** the reflection loop produces visual evidence
  (screenshots/renders/live) that must survive The Eye's human aesthetic review. Recorded honestly as human
  judgment for what a machine cannot certify.

## 6. Acceptance sequence
1. Scaffold the React/Vite/TS app under a product target (the flagship dev-story surface first). 2. Author the
XState machine + typed command registry + DOM-shadowed control layer; wire `?e2e=1` determinism. 3. Build the
loom view-layer (r3f + ferrofluid shader, LEXI tokens). 4. Wire the Evidence Ledger to real institutional-memory
records. 5. FUNCTIONAL blade: the deterministic E2E suite over every element passes; a11y + perf budgets pass.
6. AESTHETIC blade: The Eye reviews visual evidence and judges. 7. Enrollment flip (routed to The Eye).

## 7. Non-goals (cycle 1)
Front-ends target PRODUCTS, never the zero-dep core; no product back-end changes; no other future modules; no
new governance enforcement (Narcissus produces surfaces, it does not gate merges); no faked aesthetic oracle.
