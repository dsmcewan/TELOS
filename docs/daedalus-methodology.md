# Daedalus Methodology — Parallel Constraint/Implementation Authorship

**Status: HELD** (The Eye, 2026-07-15). Adopted as the forward methodology for
Daedalus; **not yet implemented** in `build-gate/daedalus.mjs` (which today runs
a serial claude/codex author–reviewer loop — `DAEDALUS_SEATS = ["claude",
"codex"]`, alternating roles per round). This note is the design contract for
the delta that will change it.

**Evidentiary basis:** the Clotho Phase 1 planning lineage —
`docs/clotho-phase-1-remediation.md`,
`docs/runs/clotho-harvest-1/root-cause-study.md`, and
`docs/runs/clotho-harvest-1/surface-expansion-study.md`. Ten deltas of serial
surgical amendment produced monotonic behavioral widening: 10 of 11 confirmed
defects attacked repair-introduced behavior at ~1-delta lag, and one subsystem
(loader) was patched three times and dissented on three times. The serial
author–reviewer loop optimizes the wrong objective.

Registered meaning is unchanged: **Daedalus collaboratively matures
implementation plans** (`docs/mythological-vocabulary.md`). This note refines
the collaboration structure, not the definition.

## The optimization target

Not the smallest textual patch. The **smallest complete behavioral model that
satisfies the invariant.** A repair may delete, combine, or redesign existing
mechanisms rather than layering another rule on top.

## Parallel authorship (replaces the serial loop for real plan design)

Two seats work **in parallel** from the same frozen design frame, not in an
author→reviewer sequence:

- **GPT owns the constraint design:** invariants, trust boundaries, failure
  semantics, normative schemas, proof obligations, adversarial acceptance
  tests.
- **Claude owns the implementation design:** architecture, interfaces, data
  flow, task decomposition, sequencing, integration, delivery strategy.

Each output is a **separate content-addressed Merkle-DAG node.** The integrated
candidate **must descend from both nodes** and map every obligation through:

```
invariant → enforcement mechanism → task → negative test → exit criterion
```

A row missing any field is unfinished (this is the proof-obligation matrix the
surface-expansion study prescribed, now made structural).

## Cross-verification and conflict routing

- **GPT verifies** its constraint contract survived integration.
- **Claude verifies** its implementation design was preserved.
- Conflicts remain **explicit and route to The Eye** — never silently blended.
- The serial author–reviewer loop is retained **only for genuinely small
  deltas.**

## Behavioral delta accounting (every amendment carries this)

```
behavior added / removed · new states · new transitions · new input forms
new trust boundaries · new runtime obligations · new negative tests
net behavioral-surface change
```

With three rules:

1. **No new state without its complete state machine** in the same delta —
   every caller, exit code, evidence path, cleanup path, and test derived at
   once.
2. **Repairs are surface-neutral by default** — a fix adding N concepts must
   justify why the original mechanism cannot instead be simplified.
3. **Two repair-induced findings in one subsystem trigger redesign**, not a
   third surgical patch — reopen from invariants and produce a smaller
   replacement model.

## Corpus-level review (available once Clotho exists)

Once Clotho can weave the planning lineage, Daedalus should run **corpus-level
review over its complete lineage** — plans, findings, amendments, dispositions,
tests, and authorization results — to detect:

- repeated claim-to-proof gaps;
- repair-induced defects;
- behavioral widening;
- recurring subsystem failures;
- cases where another surgical amendment should be replaced by redesign.

This is a Clotho consumer (a Phase-2-class capability): the weave makes the
lineage queryable so the methodology rules above can be enforced against
evidence, not memory. It is out of scope for Clotho Phase 1 and does not gate
it.

## Implementation gap (for the delta that lifts this hold)

`build-gate/daedalus.mjs` currently encodes only the serial loop. Realizing this
note requires: parallel two-seat authorship with role specialization (GPT
constraints / Claude implementation), two content-addressed source nodes plus an
integration node that descends from both, the obligation-mapping requirement as
a convergence gate, per-seat post-integration verification, explicit
conflict-to-Eye routing, and a size threshold below which the serial loop still
applies. That delta is itself subject to the proposal lifecycle; it is not an
ad hoc edit.
