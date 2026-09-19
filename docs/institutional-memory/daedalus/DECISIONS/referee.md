---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Ships role R (the referee) on the already-built double-rolled gemini configuration and defers the distinct-model question until real-run counters produce data. Machine anchor — docs/runs/item-7-referee-ruling-packet.md (adversarially reviewed, revised, and passed bounded review 2026-07-22).
---

# Decision: referee ships double-rolled (Option A); distinct model deferred (item 7)

**What.** Role R (the referee) ships on the current double-rolled configuration —
gemini occupies both Seat 4 (challenger) and role R — exactly as already built and
tested, with `stalemate` as a terminal that exits the stage via the existing
`needsWork` return. The distinct-model question (Option B: role R on a separate
model/seat) is deferred until the counters produce data, not ruled out. The
proposed self-citation bar ("a `stalemate` is invalid if any cited entry is one the
referee itself authored") does **not** rescue Option A's conflict of interest and is
**not** adopted as a mitigation — as specified it fails against the code as built and
is left as an open item for The Eye (fund the schema/controller change to target the
raising seat specifically, or accept the conflict is closed only by the
acceleration-is-bounded-and-recoverable argument). A non-terminal ("advisory")
stalemate configuration was raised but is explicitly out of scope for this decision
and requires its own follow-up proposal. Flip condition, unchanged: this
recommendation flips if The Eye funds the fixture afternoon — pre-registered pass
criterion (≥2/3 recall on planted-looping ledgers with refs naming the planted
equivalence, zero false stalemates on ≥20 non-looping ledgers) run across
gemini-double-rolled × gemini-distinct-call × one non-gemini model × medium/high
effort — in which case item 7 is ruled on the fixture result instead.

**Why.** Every argument on both sides currently reduces to an unmeasured claim about
whether any model detects a planted semantic loop over a ≤4-round log — the model
choice is being argued, not measured. Shipping the already-built double-rolled
configuration is the only path that generates that measurement with no new code,
schema, or seat: `makeGeminiReferee`, `readRefereeVerdict`'s evidence-or-burn and
provenance checks, the per-seat `gemini:referee` counters, and cadence/stalemate
test coverage (cases 15/16/21) already exist and pass. The reachable failure mode —
gemini unilaterally accelerating on its own objection via `stalemate` — cannot
override a unanimous accept (that branch returns before the referee block runs) and
costs only one Eye action plus up to `cap − round` friction rounds per occurrence:
bounded and recoverable, not a veto. Real runs will produce the missing evidence —
K, the evidence refs, and The Eye's agreed/premature labels on stalemates that
actually fire — which no amount of further argument can substitute for.

**Authority chain:** docs/runs/item-7-referee-ruling-packet.md (adversarially
reviewed, revised, and passed bounded review 2026-07-22) -> Eye ruling: adopt,
2026-07-22.
