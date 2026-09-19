---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Ratifies the Daedalus v2 challenge-round cap at 4 and defers the Stage-3 produce-round cap to mechanics-only. Machine anchor — docs/runs/item-1-caps-ruling-packet.md (adversarially reviewed, 2026-07-22).
---

# Decision: challenge-round cap ratified at 4; produce-round cap deferred to mechanics only

**What.** `maxChallengeRounds` is ratified as a fixed protocol constant with default `4`,
matching what is already shipped and tested in `daedalus-v2.mjs:344` (enforced at the
Stage 2 loop, `daedalus-v2.mjs:482`). No specific default value is ratified for the
Stage-3 produce-side cap (`CODE_MAX_ROUNDS` or equivalent). Instead, only the mechanics
are ruled: whatever bounds Stage-3 produce work must ship as an explicit,
caller-overridable parameter in the same idiom as `maxChallengeRounds` and
`maxRepairRounds` — a named field with a coded default, never a hardcoded inline
literal. As a mandatory rider on ratifying 4, `daedalus-v2.mjs:34`'s
`REFEREE_MIN_CHALLENGE_ROUND = 2` literal must be replaced with a derived
`Math.ceil(maxChallengeRounds / 2)` at the Stage 2 call site, so a future change to the
challenge cap cannot silently desync item 7's referee-cadence ruling.

**Why.** The two numbers in the design doc's "Call accounting" table are not
evidentiary peers. The challenge cap of 4 has real running code behind it — Case 14
(`test-daedalus-v2.mjs:407-420`) and Case 29 (`test-daedalus-v2.mjs:765-778`) both
exercise it directly, including proof that re-entry does not reset the counter — so
there is nothing left to prove. The produce cap of 8 has zero lines of the mechanism
it would bound anywhere on disk: there is no Stage 3 function, loop, or call site in
`daedalus-v2.mjs`, and item 7's own brief independently found the same hole from the
referee side ("no referee call site at all" for the 8-round produce loop). Ratifying
both under one motion would launder an untested number under the credibility of a
tested one. Separately, this codebase's institutional habit for single-loop
challenge/produce cycles is tight caps (3-6); an 8-round default sits outside that
range with no reconciling argument supplied, and the nearest same-repo "8"
(`maxRepairRounds` in `proposal-orchestrator.mjs:148`) bounds a structurally different
unit (DAG-wave count, not produce/challenge friction rounds). Finally, item 4's sibling
packet leaves open whether Stage 3 even has one mechanism to cap — under its Option B/C,
most nodes are already bounded by the shipped `maxRepairRounds`/`adaptAttempts`, and
only a narrow discharge-node friction path would need a genuinely new cap. Picking a
single produce-cap number now would risk ratifying a value for a mechanism that may not
exist in the shape assumed. The `REFEREE_MIN_CHALLENGE_ROUND` rider is not precautionary:
the literal `2` at `daedalus-v2.mjs:34` is already hardcoded independently of
`maxChallengeRounds` rather than derived from it, so any future change to the challenge
cap silently breaks item 7's `⌈cap/2⌉` ruling unless this rider is carried out in the
same change.

**Authority chain:** docs/runs/item-1-caps-ruling-packet.md (adversarially reviewed,
revised, and passed bounded review 2026-07-22) -> Eye ruling: adopt, 2026-07-22.
