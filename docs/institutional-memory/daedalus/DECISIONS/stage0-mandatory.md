---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Stage 0 research pre-flight is mandatory by default for every plan; a skip requires an explicit per-plan Eye waiver, never the serial-authorship path alone. Machine anchor — docs/runs/item-5-stage0-mandatory-ruling-packet.md.
---

# Decision: Stage 0 mandatory by default

**What.** Stage 0 is mandatory by default for every plan entering the Daedalus
workflow. A skip is available only through an explicit, per-plan Eye waiver —
never through the mere fact that a plan takes the serial authorship path.

**Why.** Item 5's own stated skip condition is a disjunction — prior
production-profile hash **or** Eye waiver — and on today's disk state one arm
is empty: no compiled production profile or self-profile hash exists for
TELOS, since the Production Profile Compiler is an unimplemented, separately
authorized plan under `authz-008`. The other candidate gate, "small-delta
serial," has no definition anywhere in the repository that a controller could
check — eight sites use the phrase, all rhetorical prose, none quantified —
and selection of the serial path is a self-declared boolean
(`dossier.authorship !== "parallel"`), not a size-gated computation. Ruling a
skip open on that undefined, unenforced, self-selected label is exactly the
mutable-label-keys-an-enforcement-decision pattern the project's
content-address rule forbids one layer up. Keeping Stage 0 unconditional costs
four bounded seat calls per plan — cheap next to the loops it sits in front
of — and costs nothing new to implement, since the flow diagram already draws
it that way. This recommendation flips toward a defined skip if either the
Production Profile Compiler ships a real, controller-computed self-profile
hash, or The Eye pre-authorizes the zero-net-behavioral-surface-change test
(`docs/daedalus-methodology.md:57-63`) as a controller-computed Stage-0-skip
predicate rather than an author-declared one.

**Authority chain:** docs/runs/item-5-stage0-mandatory-ruling-packet.md
(adversarially reviewed, revised, and passed bounded review 2026-07-22) ->
Eye ruling: adopt, 2026-07-22.
