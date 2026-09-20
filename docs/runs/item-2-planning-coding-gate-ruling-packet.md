## Item 2 — Planning-gate vs coding-gate: one Eye action or two

> **Evidence provenance (round 2, 2026-09-19).** The design doc this packet cites
> (`daedalus-workflow-v2-design.md`, referred to below also as `design.md`) was never
> committed on any branch — it existed only as untracked/dirty scratch in the working
> tree at ruling time (`c9d543f`). That evidence is now quarantined, immutable, and
> content-addressed at git branch `quarantine/evidence-2026-09-19` (manifest:
> `QUARANTINE-MANIFEST.json` on that branch), and is **not part of the mainline
> tree**. Full path: `quarantine/evidence-2026-09-19:docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md`
> (sha256:`0df4bf6bf84ef27df418dace08dc30fec209d2a870cc9670d00e4b0015b5ae58`). Every
> bare `design.md:NNN` citation below resolves against that path — verify with
> `git show quarantine/evidence-2026-09-19:docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md`.
> All other citations in this packet (`build-gate/proposal-orchestrator.mjs`,
> `merkle-dag/orchestrate.mjs`, `contracts/Proposal Lifecycle.md`, `build-gate/risk-policy.mjs`,
> `CLAUDE.md`) are ordinary mainline files and are unaffected.

### ROUND-1 CORRECTION (do not rule until resolved)

The Option A "case for it" and the "Recommended ruling" both state that
`checkLifecycleAuthorization`'s Decision-6 re-verification "re-runs the **full**
ledger-reconstructed `lifecycleVerify`" before Stage 3 dispatch. This is contradicted
by the cited code's own comment. `merkle-dag/orchestrate.mjs:41-44` (mainline, not
quarantined) reads:

> "Re-run the ledger-reconstructable lifecycle verification (the injected
> `lifecycleVerify` wraps `validateProposalLifecycle` with `requiredModels=[]`/`packets=[]`
> — the full packets are not on the ledger, so a literal 'full' re-run would false-fail
> `proposal_ref_binding`/`cold_review`)."

So the binding checks (`proposal_ref_binding`, `cold_review`) are deliberately
no-op'd via empty `requiredModels`/`packets` arrays — this is a narrower,
ledger-reconstructable-state-only re-verification, not the full lifecycle check the
packet's central argument relies on. Separately, the packet's Option A case for it
cites an unbuilt Stage-4 "code challenge" as part of what bounds the harm of
collapsing to one Eye action ("the harm is bounded by Stage 4 ... and the Eye release
gate downstream") — no Stage-4 implementation exists anywhere on disk (confirmed
independently by items 3, 4, and 6's findings that `daedalus-v2.mjs` implements only
Stages 0 and 2); the real bounding mechanism on the shipped path is team-dispatch
plus the deterministic per-node test gate (`orchestrate.mjs`'s `defaultVerifyNode`),
not a code-challenge stage. Both points weaken the "case for it" as written; whether
they change the recommended ruling is The Eye's call, not resolved here.

### What is actually at stake

The design doc's own end-to-end flow diagram draws exactly one Eye box between
Stage 2 (plan challenge, both accept) and Stage 3 (code produce): `Eye —
planning gate (authorize this plan_hash)` feeds straight into `Stage 3 Code
PRODUCE` with no second Eye node drawn in between
(`quarantine/evidence-2026-09-19:docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md:152-156`
sha256:0df4bf6bf84ef27df418dace08dc30fec209d2a870cc9670d00e4b0015b5ae58).
The four-point list is where the split is reserved as an option, not asserted:
point 3, "Approve coding," is explicitly "optional separate go-ahead; default
may collapse into (2) if The Eye so rules" (same file, lines 121-122). So the
question is not whether to demolish a two-gate design in favor of one — the
diagram's baseline is already one gate — it is whether The Eye should spend a
second mandatory action to *split* that baseline apart.

On disk, there is no working two-gate structure to preserve, and in fact there
is currently no routine human gate of any kind in the automated path. In
`runProposalLifecycle`, the single `decision === "authorized"` branch
(`build-gate/proposal-orchestrator.mjs:309-318`) both certifies the plan (the
controller-computed `authorized` decision per
`contracts/Proposal Lifecycle.md:1104-1136`, "Only `authorized` permits
`runBuild()` to begin") and, in the same synchronous call, immediately invokes
`runBuild` — which is where task-by-task code production and per-node test
verification actually happen
(`merkle-dag/orchestrate.mjs:190-260`, dispatch + verifyNode per ready node).
There is no persisted pause, no second ledger event type, and no resumption
entry point between "plan authorized" and "code produce starts." The Eye is
invoked in this codebase today only reactively, on failure paths — `needs-eye`
for a parallel-authorship conflict and `human-review-required` for a workshop
stalemate or budget exhaustion (`proposal-orchestrator.mjs:216-220, 326-327`)
— never as a routine two-click approval on the happy path. CLAUDE.md's own
honest-limits note confirms this: "human-adjudication UX ... [is] out of scope"
for the current autonomous entry point. So "collapse into one Eye action" is
not a proposal to throw away built structure; it is closer to formalizing what
already exists, and a genuine second gate would be new engineering: a new
ledger event distinguishing "plan-authorized" from "coding-authorized," a stop
point in the loop where `runBuild` is not called until that second event
lands, and a re-verification of that second event's content-address before
Stage 3 dispatches teams.

### Option A — Collapse: one Eye action authorizes both planning and Stage 3 entry

**The case for it.** It matches the diagram's own drawn baseline
(`design.md:152-156`) and requires no new plumbing — `decision === "authorized"`
already gates `runBuild` directly (`proposal-orchestrator.mjs:309-315`). It
also does not weaken the anti-staleness protection the second gate is meant to
provide, because that protection already exists mechanically and fires
regardless of how many Eye clicks preceded it: `runBuild`'s
`requireAuthorizedDecision` path calls `checkLifecycleAuthorization`
(`merkle-dag/orchestrate.mjs:199-201`, defined at
`merkle-dag/orchestrate.mjs:19-45`), which re-recomputes the plan hash from
disk (`PLAN_TAMPERED` if it drifted), re-derives the latest decision **for
that exact plan_hash** from the ledger (`DECISION_NOT_AUTHORIZED` if it is not
`authorized`), and — per the code's own "Decision 6" comment
(`orchestrate.mjs:41-44`) — re-runs the ~~**full**~~ **[ROUND-2 STRIKE: NOT full — the injected `lifecycleVerify` wraps `validateProposalLifecycle` with `requiredModels=[]`/`packets=[]`, so proposal_ref_binding/cold_review are deliberately NOT re-checked; the same cited comment says so. It re-derives ledger-reconstructable holds/concerns, not the full packet-binding verification.]** ledger-reconstructed
`lifecycleVerify` (`validateProposalLifecycle`) immediately before dispatch,
specifically because the static authorization certificate "does NOT catch a
hold appended AFTER that decision." A new concern, a new hold, a chain
tamper, or a stale/superseded plan_hash occurring between plan-approval and
code-produce is already fail-closed at Stage-3 entry, whether or not a human
took one action or two in between. One Eye action spends the scarcest
rationed resource in this design (per the item-7 packet's own framing) once
per run instead of twice.

**The case against.** Machine re-verification only catches facts that are
already ledger-representable — a new hold, a hash mismatch, a stale decision.
It cannot catch a fact that changed in the world but never touched the TELOS
ledger: a disclosed vulnerability in a dependency the plan relies on, a
business-priority shift, a regulatory change, a production incident elsewhere
that makes "start writing this code now" a bad idea even though the plan
itself is byte-identical to what was approved. If the Eye's planning approval
and the actual start of Stage 3 are separated by real wall-clock time (a
queued run, a long review cycle, staged rollout), a single collapsed action
means nobody re-looks at "is this still the world we approved for" before code
starts writing files and team dispatch spends real budget.

**What it costs.** Nothing new to build. The existing execution-time
re-verification must be kept load-bearing (not weakened) as the compensating
control.

**What breaks if it is wrong.** Code production begins under a plan that is
technically unchanged (same plan_hash, no new ledger holds) but whose
real-world premises have shifted. Nothing in the current architecture would
stop or flag this — Rule 3 and the lifecycle re-verify only prove the plan and
ledger are internally consistent, never that the world outside the ledger
still matches. ~~The harm is bounded by Stage 4 (code challenge, Seats 3+4)~~ **[ROUND-2 STRIKE: Stage 4 code-challenge is UNBUILT — no implementation exists; the real downstream path is team-dispatch + a deterministic per-node test gate, not a Seats 3+4 adversarial challenge. Do not credit an unbuilt safety net.]** and
the Eye release gate downstream, so it is not un-recoverable, but it can burn
a full produce+challenge cycle (up to `CODE_MAX_ROUNDS`, default 8,
`design.md:712`) on a plan nobody would have greenlit today.

### Option B — Split: a second, distinct Eye action is required before Stage 3 begins

**The case for it.** It puts a human re-look at exactly the point where
irreversible cost (team dispatch, code files written, budget spent) starts to
accrue, closing the one gap machine re-verification structurally cannot close
— facts true of the world but never entered as ledger events. It also gives
The Eye a natural checkpoint to reconsider risk-tiering: `risk-policy.mjs`
already computes a `risk_class` per touched path/workstream
(`build-gate/risk-policy.mjs:117-145`) that could gate whether a distinct
coding go-ahead is required at all, without inventing new machinery.

**The case against.** It reintroduces exactly the two-authorization-point
structure the diagram's baseline does not depict, on every run, for a risk
that in most runs is negligible: Stage 0's mandatory research pre-flight
(Surfaces A/B/C) and Stage 2's dual-challenger acceptance already run
immediately upstream of the same approval, so the "world" the plan describes
is fresh at the moment of planning-gate approval in the overwhelming majority
of runs where Stage 3 starts promptly after. Requiring a second mandatory
click pays that cost on every run to guard against a risk (elapsed-time world
drift) that is conditional on an elapsed gap actually existing — a gap that,
per the honest-limits note, doesn't yet exist anywhere in the built autonomous
path.

**What it costs.** New ledger event type distinguishing "plan-authorized" from
"coding-authorized" (each independently content-addressed to the plan_hash,
per the content-address rule — no mutable flag may substitute for a second
hashed decision record); a stop point inserted into
`runProposalLifecycle` between `recordDecision` and `runBuild` so the loop
does not auto-advance; a resumption call site that re-verifies the second
decision's content-address before invoking `runBuild`; and one additional
required human action on every compliant run, forever.

**What breaks if it is wrong.** Nothing safety-relevant breaks; the failure
mode is pure cost — a mandatory action on every run, including the ones where
Stage 3 starts within seconds of planning approval and the second click adds
no information the Eye did not just consider.

### Cadence / staleness analysis

The substantive question under either option is not "one action or two" in
the abstract — it is "how much elapsed time or intervening ledger activity
between plan-authorization and Stage 3 dispatch should force a fresh Eye
look." Two facts bound this:

1. **Ledger-representable drift is already caught, structurally, regardless of
   option.** `checkLifecycleAuthorization`'s re-run of the ~~full~~ **[ROUND-2 STRIKE: "full" is inaccurate — see the strike at the Decision-6 citation above; binding/cold-review checks are deliberately excluded. This premise holds only for *ledger-reconstructable* drift, which is what the sentence actually describes; the "full" qualifier overstates it.]**
   `lifecycleVerify` (`orchestrate.mjs:41-44`) means any hold, concern, or
   chain event appended after the authorization decision blocks Stage 3
   outright (`DECISION_NOT_AUTHORIZED` / a fresh lifecycle-gate failure) with
   zero additional Eye action required. This is not evidence for Option A over
   B; it is evidence that the two options are not actually competing on this
   risk — both get it for free.
2. **World drift that never touches the ledger is caught by neither option's
   machinery — only by a human choosing to look again.** Whether that human
   look happens automatically (Option B, every run) or only when something
   external prompts the Eye to reopen the stage (Option A, on suspicion) is
   the entire remaining disagreement. No file on disk today measures how often
   real elapsed time separates planning approval from Stage 3 start in
   practice, because no run has yet exercised a human-gated planning approval
   at all — the autonomous entry point has no human-adjudication UX
   (CLAUDE.md, "honest limits"). This is an unmeasured-claim situation
   structurally identical to item 7's: both sides are arguing from a
   plausibility story about a gap whose actual size is currently zero
   because the UX that would create the gap has not been built.

### Recommended ruling

**Collapse into one Eye action by default (Option A / the diagram's own
baseline), on the condition that the execution-time lifecycle re-verification
already implemented in `checkLifecycleAuthorization`
(`merkle-dag/orchestrate.mjs:19-45`, decision 6) remains load-bearing and is
never weakened or bypassed for a "fast path," plus one mechanical staleness
guard: if wall-clock time between the planning-gate decision and Stage 3
dispatch exceeds a bound The Eye sets (or if Stage 0's cited production-profile
/ workflow-residue hash changes in that window), `runBuild` fails closed into
`needs-work` rather than silently proceeding, forcing the Eye to look again
without requiring a second click on every ordinary run.** The single strongest
reason: the risk a second mandatory gate is meant to catch — a plan approved
before some intervening fact changed — is already caught mechanically by
ledger re-verification for every fact the system can represent, and for the
one class of fact it cannot represent (elapsed-time world drift with no
ledger footprint), a bounded staleness check that reopens the stage on demand
is cheaper than a second required human action on every compliant run while
closing the same gap. **This flips toward Option B (mandatory second gate)**
if either becomes true: (a) The Eye's human-adjudication UX is built such that
real wall-clock gaps of hours or days routinely separate planning approval
from Stage 3 dispatch (the zero-gap assumption above stops holding), or (b)
The Eye wants the split to be risk-tiered rather than uniform — e.g., requiring
the distinct coding go-ahead only for proposals whose `risk_policy.mjs`-derived
`risk_class` crosses a threshold — in which case the existing risk-class
machinery (`build-gate/risk-policy.mjs:117-145`) is already available to key
that split without inventing a new signal.
