# Multi-model breakout — flagship front-end direction (synthesis)

Four seats (claude / codex / grok / gemini, all live-funded) independently PROPOSED a front-end direction for
the Narcissus flagship (the honest development-story surface), then adversarially CHALLENGED each other and
delivered verdicts-on-facts. Raw packets: `breakout-round1.json`, `breakout-round2.json`.

## Round 1 — independent proposals (strong convergence)
All four independently reached a **loom / weave** metaphor — the Clotho weave rendered as literal woven
thread. This is myth-faithful (Clotho spins the thread of the story) and was NOT prompted; the convergence is
signal, not coincidence.
- **claude — "The Loom That Weaves Itself":** the weave IS the page; one luminous thread (AI-START-HERE) grows
  into a tapestry; stalemates/corrections are visible in the cloth.
- **codex — "The Loom on Trial":** a forensic, room-scale weaving machine; warp = Iliad quests, tension =
  councils, knots/cuts = decisions; visitor examines it station-by-station.
- **grok — "Narcissus Crucible":** first-person 3D walkthrough inside a living **ferrofluid** weave that
  solidifies into architecture only after you re-enact each stalemate/correction/ground-truth failure.
- **gemini — "The Adversarial Loom":** a tension-loaded 3D cable — smooth threads = consensus, violent
  snaps/glowing knots = stalemates, fused industrial slag = reality-correcting code.

## The shared fatal risk (unanimous)
Every seat named the **SAME** biggest risk: the **functional E2E blade**. Physics-driven, free-form WebGL
interactions (grab-and-collide threads, ferrofluid settles, shader-driven state) are **non-deterministic
across devices** and cannot pass a deterministic E2E test. A beautiful surface that fails the functional blade
fails the gate.

## Round 2 — the resolution (also unanimous, and this is the key output)
All four converged on one architectural principle: **"WebGL is PAINT, never TRUTH."**
- The Three.js/WebGL canvas is a **pure presentational view-layer** — it never owns interaction, state, or
  progression.
- ALL state + every action lives in a **deterministic finite-state machine (XState)** + a **typed command
  registry** (SELECT_RECORD, OPEN_EVIDENCE, ACK_POSITION, PULL_THREAD, SET_FILTER, SET_TIME, EXPORT,
  CHANGE_STATION, SKIP, RESET…) in the React DOM.
- **Every interactive 3D element is shadowed by an invisible, semantically-correct HTML control**
  (button/link/slider) that receives pointer/keyboard events — so Playwright/axe test the DOM, and the WebGL
  merely renders the resulting state. This also delivers **accessibility** (real focusable controls) and a
  **reduced-motion fallback** for free.
- A forced **test-mode (`?e2e=1`)** freezes RNG (seeded PRNG), pins the physics timestep, and disables
  springs/settle — making the surface deterministic under test while staying alive in production.

## Verdict — recommended direction
A **synthesis: "The Loom on Trial / Crucible Weave."** The award-facing spectacle is the complete suspended,
tension-loaded Clotho loom (ferrofluid/glass-fiber shaders, GPU pull-thread deformation, stalemate knots and
fused reality-correction scars). But the visitor **moves among discrete forensic STATIONS** (AI-START-HERE →
Iliad quests → Daedalus workshops → councils → reality-correction → "can't be lost"), each a bounded, testable
interaction rather than free physics — with an **Evidence Ledger** grounding every claim in the actual
institutional-memory record (evidence-vs-uncertainty, LEXI's ethos), and a **reverse-topological "unraveling"**
as the emotional climax. codex's forensic-station chassis + XState command architecture, hardened with
claude's DOM-owned interaction + unraveling climax + luminous correction-scars, and grok's ferrofluid stalemate
crystallization. gemini independently endorsed the codex forensic-station core for the same reason: it trades
chaotic physics for **discrete, testable, accessible** interactions without losing the spectacle.

## What this hands the Iliad quest
- A **direction** (Loom on Trial synthesis) that is award-tier AND provably testable/accessible/performant.
- A **hard architectural constraint** the Daedalus plan must adopt: WebGL-as-view-layer, XState + typed
  command registry, DOM-shadowed controls, `?e2e=1` determinism — this is what makes the two-blade gate
  passable and should be a NORMATIVE plan invariant.
