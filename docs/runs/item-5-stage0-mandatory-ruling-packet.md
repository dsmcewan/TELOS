## Item 5 — Whether Stage 0 is mandatory for all plans or skippable for small-delta serial

> **Evidence provenance (round 2, 2026-09-19).** This packet's `design.md`/design-doc
> citations and its `candidate-plan.md` citation were never committed on any branch —
> they existed only as untracked/dirty scratch in the working tree at ruling time
> (`c9d543f`). That evidence is now quarantined, immutable, and content-addressed at
> git branch `quarantine/evidence-2026-09-19` (manifest: `QUARANTINE-MANIFEST.json` on
> that branch), and is **not part of the mainline tree**. Every bare `design.md:NNN`
> citation below resolves against `quarantine/evidence-2026-09-19:docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md`
> (sha256:`0df4bf6bf84ef27df418dace08dc30fec209d2a870cc9670d00e4b0015b5ae58`); the bare
> `candidate-plan.md` citations resolve against
> `quarantine/evidence-2026-09-19:docs/runs/production-profile-compiler-1-workshop/candidate-plan.md`
> (sha256:`a84b65055b0dff79fa62f1e087d90faf5fc052f3439887881c96594b7c5e033f`). Verify with
> `git show quarantine/evidence-2026-09-19:<path>`. The `reader-validation-artifact.json`
> citation below is a **different, mainline (committed) file** —
> `docs/runs/production-profile-compiler-1/reader-validation-artifact.json` (note:
> `production-profile-compiler-1`, not `-workshop`) — and is unaffected.

### ROUND-1 CORRECTION (do not rule until resolved)

This packet states authz-008 is "a separate, not-yet-executed authorization chain."
This is contradicted by two mainline (committed) sources: `repository-manifest.json:362`
records the `telos` role's status as "active (authz-001..008 recorded, all trust_mode
signed; five refusals preserved; **authz-008 active**)", and `clotho/memory/README.md:17`
states "**Phase 1 complete, plan v15 / authz-008**." Both indicate authz-008 is active
and has a completed phase, not "not-yet-executed." This affects the packet's argument
that the profile-hash arm of item 5's stated skip condition is dead solely because it
sits under an unexecuted authorization chain — the chain itself is live; what remains
unconfirmed is only whether the Production Profile Compiler specifically (as opposed
to other authz-008-governed work, e.g. Clotho v15) has produced a compiled profile.
The directory-search finding that `build-gate/production-profile/` does not exist and
that no `.mjs` compiles a profile stands independently of this correction. Whether
this changes the recommended ruling is The Eye's call, not resolved here.

### What is actually at stake

The end-to-end flow diagram draws Stage 0 as the unconditional entry point before Stage 1
Plan PRODUCE — there is no branch in it for a path that skips research pre-flight
(`docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md:132-169`). Item 5 asks
whether to cut that branch in, keyed to "small-delta serial," and whether the
stated condition — "if skipped, Surfaces B+C still need a prior production-profile hash +
workflow residue or an Eye waiver" (`daedalus-workflow-v2-design.md:741-743`) — is enforceable
today. It is not, for two independent reasons found on disk, and both point the same
direction:

1. **"Small delta" has no definition anywhere in this repository — numeric, structural, or
   otherwise.** The phrase "genuinely small deltas" (or "small delta") appears in
   `docs/daedalus-methodology.md:54-55` and `:127-128`,
   `docs/institutional-memory/daedalus/IDENTITY.md:20`,
   `docs/institutional-memory/daedalus/CONTRACTS/workshop-protocol.json:12`,
   `docs/institutional-memory/daedalus/DECISIONS/parallel-authorship.md:18`,
   `build-gate/daedalus.mjs:186-188`, `build-gate/proposal-orchestrator.mjs:151-153`, and
   `repository-manifest.json:315` — eight independent sites, all rhetorical, none with a
   line count, file count, invariant count, or any other checkable criterion. No evidence
   found for a quantified "small delta" anywhere in the tree.
2. **Selection of the serial path is not size-gated in code — it is a boolean, self-declared,
   default.** `runProposalLifecycle` picks serial whenever `dossier.authorship !== "parallel"`
   (`build-gate/proposal-orchestrator.mjs:151-159`); nothing measures the dossier's actual
   diff size, file count, or new-invariant count before allowing it. Serial is simply
   what you get by not opting into parallel. There is no code path anywhere that could
   currently enforce a "skip Stage 0 only if the delta really is small" rule even if The
   Eye wrote one down, because nothing computes "how small is this delta" today.

Layered on top of that, the item's own stated escape hatch — cite a prior
production-profile hash — does not exist for TELOS. `build-gate/production-profile/` is
absent from the tree (confirmed by directory search); the only artifacts under
`docs/runs/production-profile-compiler-1-workshop/` are a matured **plan**
(`candidate-plan.md`) and its workshop scaffolding, not a compiled profile. The plan's own
global constraints state the compiler has not run against TELOS yet: "A root README dogfood
claim, production-profile release tag, or institutional enrollment is prohibited until the
reproducible TELOS self-hosting run and its negative controls are green"
(`candidate-plan.md:96`; see also `:82`, "TELOS is the first non-synthetic host... enters a
separately authorized production proposal," and `:7`, "Deterministic bank-style and TELOS
self-hosting runs prove the negative path" — future tense, Task 12 of the plan, not yet
executed). `docs/runs/production-profile-compiler-1/reader-validation-artifact.json` shows
this whole line of work sits under `authz-008` (governing Clotho v15), a separate,
not-yet-executed authorization chain. So the design doc's own Relation-to-Compiler clause —
"If a deterministic production profile is compiled for the host, Stage 0 treats its
obligation set and profile hash as prior residue... TELOS dogfood: self-profile hash cited
in Stage 0 when the host is TELOS" (`daedalus-workflow-v2-design.md:595-602`) — has nothing
to cite yet. Today, the disjunction "prior production-profile hash **or** an Eye waiver"
collapses to just the Eye waiver, because the other branch is empty.

Put together: ruling "skippable for small-delta serial" today would mean granting a skip
keyed to a self-selected, undefined, code-unenforced label (`dossier.authorship !== "parallel"`)
that cannot even point to the profile-hash residue the item's own text names as the
alternative to a waiver. That is a mutable label keying an enforcement decision — the exact
pattern `CLAUDE.md`'s content-address rule forbids one layer up (no mutable label may key an
enforcement decision; enforcement identity must be controller-derived, not caller-declared).

### Option A — Stage 0 unconditionally mandatory for every plan

**The case for it.** It matches what the flow diagram already draws — Stage 0 sits before
Stage 1 with no branch (`daedalus-workflow-v2-design.md:132-141`) — so ruling this way
requires no new mechanism, only declining to add one. It closes the gaming vector described
above outright: since "small delta" cannot be checked by anything on disk today, making
Stage 0 unconditional means there is no self-service way to avoid Surfaces B and C research
by simply not opting into parallel authorship. It is also cheap in absolute terms: Stage 0's
dispatch is four isolated seats, **one call each**, plus a Seat-5 process check
(`daedalus-workflow-v2-design.md:463-469`) — bounded and small next to the full Stage 1–4
friction loops it sits in front of.

**The case against.** It piles a four-seat research dispatch onto every plan, including
genuinely trivial ones (a one-line config change, a doc typo fix) where Surfaces B and C
have nothing to say. The methodology explicitly retained the serial carve-out to avoid
exactly this kind of fixed overhead on small work
(`docs/daedalus-methodology.md:53-55`: "The serial author–reviewer loop is retained only for
genuinely small deltas") — an unconditional Stage 0 does not touch authorship mode, but it
does erase the parallel intent that *some* plans should cost less to mature, if the pre-flight
research is priced the same regardless of delta size.

**What it costs.** Four extra seat calls (Surfaces A/B/C dispatch) on every plan, including
ones where nothing in Surface B or C is applicable — each such plan still needs the
`not-applicable` **why** hashed per surface (`daedalus-workflow-v2-design.md:474-475`), so the
overhead is a real, non-zero tax even at floor.

**What breaks if it is wrong.** Nothing safety-relevant breaks; the failure mode is pure
waste — seat budget spent on research that returns "not-applicable" for a change that really
was small, with no compensating governance benefit. That is a cost the caps-and-budget
invariant already treats as tolerable (Stage 0 is capped at one call per seat, not an open
loop), but repeated over many small changes it is the kind of overhead that erodes appetite
for the whole workflow.

### Option B — skippable for small-delta serial, under a defined threshold plus the
profile-hash-or-waiver condition

**The case for it.** It is the shape item 5 itself proposes, and it would restore the
intended asymmetry: small work stays cheap, real plan design still gets full research
pre-flight. If a concrete, checkable threshold existed, this would let the serial carve-out
mean something on the Stage-0 axis, not just the authorship axis.

**The case against.** No concrete threshold exists to hang this on. The instruction
constraining this ruling is explicit: propose a number "grounded in what 'small delta'
already means elsewhere in this repo, not an arbitrary new number" — and the search above
found no elsewhere. Every one of the eight sites using "genuinely small deltas" is
non-quantified prose. The nearest thing to a structural (not numeric) definition is the
**behavioral-delta accounting** block that already rides with every Daedalus amendment:
"no new state without its complete state machine in the same delta," "repairs are
surface-neutral by default," "two repair-induced findings in one subsystem trigger redesign"
(`docs/daedalus-methodology.md:57-74`). That is a real, existing, enforceable-in-principle
test — a plan whose net behavioral-surface change is zero across new states, transitions,
input forms, trust boundaries, and runtime obligations — but it is not currently *checked* by
any code path either (`validateObligationMatrix` / `deriveParallelState` in
`build-gate/daedalus.mjs` and `build-gate/proposal-orchestrator.mjs` enforce the parallel
convergence structure, not a delta-size classifier). Adopting it as the Stage-0-skip gate
would be grounding a threshold in something that already exists in this repo, per the
instruction — but it would still need a controller-computed check before it could key an
enforcement decision, and none exists yet. Separately, even a perfectly defined threshold
does not fix the profile-hash half of the item's own condition: TELOS has no compiled
production profile today, so "small-delta serial" plans could only ever satisfy the skip
condition via Eye waiver, never via hash citation, until the compiler ships.

**What it costs.** Design and implementation work to (a) define and wire a delta-size or
zero-net-behavioral-surface classifier the controller computes rather than the dossier
author declares, and (b) decide what a "workflow residue" citation means for Surface C when
no compiled profile exists.

**What breaks if it is wrong.** If the threshold is set loosely, or if it stays a
self-declared `dossier.authorship` flag dressed up as a size check, the skip becomes the
gaming vector described in "What is actually at stake" — any plan can avoid Surfaces B and C
by not opting into parallel authorship, with Stage 0 never firing on production-applicable
work that happens to route through the serial default. Because Surface B is where
production-envelope research (identity, authorization, data integrity, AI-egress,
governance-runtime production) lives, a gamed skip is not merely wasted opportunity — it is
exactly the "feature-only theater" Stage 0 exists to prevent
(`daedalus-workflow-v2-design.md:485-489`).

### What "small delta" currently means, on the evidence

Nothing quantified. It means, in every site that uses the phrase, "not real plan design" —
a purely negative, judgment-call definition, never operationalized as a number or a
controller-computed predicate. The one place a structural (not numeric) test already exists
under the same methodology note — the behavioral-delta accounting rules — is not wired to
authorship-mode selection or to anything Stage-0-shaped; it is prose guidance for how
amendments should be evaluated, not a gate `deriveWorkshopState` or `deriveParallelState`
consult. Any ruling that lets "small-delta serial" skip Stage 0 today is therefore ruling on
a category that exists only as an assertion in markdown, keyed off a boolean flag the plan's
own author sets.

### Recommended ruling

**Rule Stage 0 mandatory by default for every plan entering this workflow. A skip is
available only through an explicit, per-plan Eye waiver — never through the mere fact that a
plan takes the serial authorship path.** The single strongest reason: the item's own
stated condition for a skip is a disjunction — prior production-profile hash **or** Eye
waiver — and on today's disk state one arm of that disjunction is empty (no compiled
production profile or self-profile hash exists for TELOS; the compiler is an unimplemented,
separately-authorized plan under `authz-008`), while the other candidate gate
("small-delta serial") has no definition anywhere in the repository that a controller could
check. Ruling a skip open on an undefined, unenforced, self-selected label is exactly the
mutable-label-keys-an-enforcement-decision pattern this project's content-address rule
forbids one layer up. Keeping Stage 0 unconditional costs four bounded seat calls per plan
— cheap next to the loops it sits in front of — and it costs nothing new to implement, since
the flow diagram already draws it that way.

**This recommendation flips toward Option B** if either of two things happens: (1) the
Production Profile Compiler ships and TELOS gets a real, controller-computed self-profile
hash Stage 0 can cite as prior residue — at that point "prior production-profile hash" stops
being a dead branch and a hash-gated skip becomes meaningful for at least Surface B; or (2)
The Eye pre-authorizes the one structural (not numeric) test that already exists in this
methodology — zero net behavioral-surface change per the behavioral-delta-accounting block
(`docs/daedalus-methodology.md:57-63`) — as the Stage-0-skip predicate, **and** requires it to
be computed by the controller from the plan's actual content (new states / trust boundaries
/ runtime obligations / invariants), not declared by the dossier author via
`dossier.authorship`. Absent both, ruling any skip open today would be inventing a threshold
this brief was instructed not to invent.
