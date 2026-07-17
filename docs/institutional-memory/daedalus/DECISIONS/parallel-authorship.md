---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: The decision that replaced the serial author-reviewer loop as Daedalus's forward methodology. Machine anchor — docs/daedalus-methodology.md (HELD by The Eye, 2026-07-15); enforcement in build-gate/daedalus.mjs.
---

# Decision: parallel constraint/implementation authorship

**What.** For real plan design, two seats author IN PARALLEL from one frozen frame —
codex owns constraints (invariants, trust boundaries, failure semantics, proof
obligations, adversarial tests), claude owns implementation (architecture,
interfaces, decomposition, sequencing, delivery). The integrated candidate must
descend from BOTH content-addressed source nodes and map every declared obligation
through the five-field matrix (`invariant → mechanism → task → negative_test →
exit_criterion`) in a strict bijection. Each seat then verifies its own contract
survived integration; a violation routes to The Eye, never blended. The serial loop
is retained only for genuinely small deltas.

**Why.** Evidentiary, not aesthetic: the Clotho Phase 1 lineage
(`docs/runs/clotho-harvest-1/root-cause-study.md`, `surface-expansion-study.md`)
showed ten deltas of serial surgical amendment produced monotonic behavioral
widening — 10 of 11 confirmed defects attacked repair-introduced behavior at
~1-delta lag; one subsystem (loader) was patched three times and dissented on three
times. The serial author-reviewer loop optimizes the wrong objective (smallest
textual patch). The target is the **smallest complete behavioral model that
satisfies the invariant**.

**Behavioral-delta accounting rules that ride with it:**
1. no new state without its complete state machine in the same delta;
2. repairs are surface-neutral by default;
3. two repair-induced findings in one subsystem trigger redesign, not a third patch.

**Authority chain:** harvest-1 studies → methodology note HELD by The Eye
(2026-07-15) → implemented via the proposal lifecycle (opt-in
`dossier.authorship === "parallel"`, fail-closed selection) → oracles green
(`test-daedalus.mjs`, `test-proposal-orchestrator.mjs`).
