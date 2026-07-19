---
name: memory-lifecycle
description: Use when governing changes to a system with institutional memory — stage order, comprehension-gated authority, deferred ratification, supersession
---

# Governing change in a system with institutional memory

`memory-standard` defines what a record is; `memory-authoring` teaches how to write
one. This skill governs the *process* around those records: the order work moves
through, who is allowed to grant what, and how a superseded record is retired so it can
never again be mistaken for a live one.

## Stage order

Change to a system with institutional memory moves through these stages, in order:

1. **Pre-review** — before any plan is drafted, the proposed change is checked against
   existing records: does it touch a `NORMATIVE-CURRENT` invariant, does it revisit a
   `REJECTED-ALTERNATIVE`, does it require a new record kind. This stage exists to
   catch collisions with existing memory before work starts, not after.
2. **Adversarial plan workshop** — the plan is drafted and reviewed adversarially:
   reviewers attempt to find holes, not to rubber-stamp. This is where the reviewer-drift
   monitor (below) applies.
3. **Authorization council** — a human-gated decision point. The plan, having survived
   adversarial review, is either authorized or sent back. This is where `decided_by`
   provenance gets written.
4. **Comprehension-gated implementation authority** — before anyone writes code against
   the authorized plan, they must submit answers to `comprehension-queries.json` and be
   GRANTED by the deterministic comprehension gate. Reading the plan is not the same as
   having understood it; see `memory-standard`'s fifth discipline. The gate exits `0`
   for GRANTED, `2` for DENIED, and `1` only when it cannot run.
5. **Oracles green** — implementation proceeds until every oracle the plan named as
   `becomes_normative_when` actually exists and passes. Only then do the affected
   records flip from `SPECIFIED-PENDING-IMPLEMENTATION` to `NORMATIVE-CURRENT`. Audit
   proves the declared oracle path exists; verification executes contract oracles and
   requires exit `0`.
6. **Host-index integration** — the change is folded into the host repository's own
   index of itself: at minimum its repository manifest, and its knowledge graph too if
   the host maintains one. A change that is correct but invisible to the host's own
   index of itself is not yet finished.
7. **Retrospective** — after the change lands, a retrospective record captures what
   actually happened, including anything that diverged from the plan. This is where
   failures that motivate future hardenings get captured in the first place.

Skipping a stage is not an optimization; it is exactly the kind of gap a memoryless
successor will later fill with invention.

## Workshop drift-monitor discriminators (hardening 6)

Adversarial review loops do not run on faith that they are converging — they self-score
every round against three proven discriminators:

- **Objection count trending down = converging.** If each round produces fewer live
  objections than the last, the workshop is doing its job and should continue toward a
  decision.
- **A re-raised, already-verified-false finding = malfunction.** If a reviewer raises an
  objection that a prior round already checked and disproved, and raises it again
  without new evidence, that is not fresh scrutiny — it is a stuck loop. Flag it and
  stop treating the repetition as new signal.
- **An out-of-lane thread = drift.** If a discussion nominally about implementation
  detail escalates into a governance question (or vice versa), that thread has left its
  lane. Quarantine it — do not let it consume further workshop rounds — and escalate it
  to the human authority gate exactly once. Do not let it re-escalate repeatedly; one
  clean escalation, then it waits for a ruling.

A workshop that cannot honestly self-score as converging, malfunctioning, or drifting
is a workshop that has lost track of its own state. The self-score itself is recorded,
not just the eventual outcome.

## Deferred ratification as a recorded exception

The default order is docs-first: specify, freeze, then implement against the frozen
spec. Sometimes a human authority directs build-first instead — for good reason, under
time pressure, to de-risk an idea before committing to a specification. That is
legitimate, but only when it is **recorded as an exception**, not silently substituted
for the default.

The mechanism: the record's `lifecycle` field is set to `build-first-then-ratified`
(see `memory-authoring`), and its `status` is `RATIFICATION-PENDING` until a human
formally ratifies it. The truth of what actually happened — build-first, under whose
direction, why — lives *inside the hashed record itself*, not in a side note that could
drift away from the content it describes. Once a human ratifies, the record moves to
`NORMATIVE-CURRENT` (assuming its oracle passes) and the default docs-first order
reasserts for whatever comes next. Deferred ratification is a one-time, explicitly
authorized detour, not a new steady state.

## Supersession protocol

When a record is replaced, the old record does not get deleted or quietly left to rot
— it is retired explicitly:

- The registry gets an entry marking the old record `SUPERSEDED`.
- The old record carries `must_not_govern_new_work: true`.
- The old record carries a `superseded_by` link to its successor.

All three together are required. A `SUPERSEDED` record missing either
`must_not_govern_new_work` or a `superseded_by` link is indistinguishable from a live
authority to a model that encounters it without context — and that ambiguity is the
exact failure mode this protocol exists to close. A retired authority must never look
like a second valid authority merely because it still physically exists in the repo.

## The human authority gate

A human role — assigned by the host repository, not by this plugin — holds final
authority over: binding `CURRENT-AUTHORITY.json`'s `active` entry, granting
authorization at the council stage, ratifying `RATIFICATION-PENDING` records, and
adjudicating an escalated drift-monitor thread. Models advise; humans rule; records
attribute which happened via `decided_by`.

This gate is not a formality. A model's confidence, however well-calibrated, is not the
same thing as human authorization, and this standard does not let the two be conflated
— not even when the model's advice was adopted wholesale. `decided_by:
model-advisory-adopted-by-human` records exactly that: the model advised, a human
decided. The record never reads simply `decided_by: model`.
