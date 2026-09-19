## Item 2 — Planning-gate vs coding-gate: one Eye action or two

### What is actually at stake

The design doc's own end-to-end flow diagram draws exactly one Eye box between
Stage 2 (plan challenge, both accept) and Stage 3 (code produce): `Eye —
planning gate (authorize this plan_hash)` feeds straight into `Stage 3 Code
PRODUCE` with no second Eye node drawn in between
(`docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md:152-156`).
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
(`orchestrate.mjs:41-44`) — re-runs the **full** ledger-reconstructed
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
still matches. The harm is bounded by Stage 4 (code challenge, Seats 3+4) and
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
   option.** `checkLifecycleAuthorization`'s re-run of the full
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
never weakened or bypassed for a "fast path."** The single strongest reason:
the risk a second mandatory gate is meant to catch — a plan approved before
some intervening fact changed — is already caught mechanically by ledger
re-verification for every fact the system can represent, at zero marginal Eye
cost, and bare Option A itself requires no new plumbing
(`decision === "authorized"` already gates `runBuild` directly,
`proposal-orchestrator.mjs:309-315`).

For the one class of fact ledger re-verification cannot represent —
elapsed-time world drift with no ledger footprint — a mechanical staleness
guard (a wall-clock bound and/or a production-profile-hash check, failing
`runBuild` closed into a recorded `needs-work` decision instead of proceeding)
is the right *shape* of compensating control. An earlier draft of this ruling
bundled that guard into the recommendation as if it were free. It is not, and
a fix-round review of this packet found three concrete gaps between that
claim and what is on disk today:

1. **The production-profile / workflow-residue trigger arm has nothing to
   point at.** `docs/runs/item-5-stage0-mandatory-ruling-packet.md`
   (lines ~153-156), reviewed in this same batch and not revised on its own
   review round, establishes: "TELOS has no compiled production profile
   today... the compiler is an unimplemented, separately-authorized plan
   under authz-008." A guard trigger keyed to that hash cannot be built until
   that compiler ships. This arm is out of scope for today's ruling, not a
   currently-available cheap check.
2. **The wall-clock trigger arm is inert under the current architecture, and
   making it live costs roughly what Option B's plumbing costs, not
   "nothing."** Today `decision === "authorized"` and `runBuild` fire in the
   same synchronous call (`proposal-orchestrator.mjs:309-315`) with no
   persisted pause or resumption entry point, so any elapsed-time comparison
   would always measure zero. Making it meaningful needs the same category of
   new machinery Option B was costed with — a stop point in the loop and a
   real resumption path — even though, unlike Option B, it would not force a
   mandatory Eye click on every ordinary run. Separately, every
   `recordDecision` call in `proposal-orchestrator.mjs` (lines ~219, 232, 246,
   277, 303-308, 326 — including the authorized-decision call this guard
   depends on) omits `recordedAt`, while every other recorder call in the same
   function threads `recordedAt: nowMs`
   (e.g. `recordDraft`/`recordCandidate`/`recordDisposition`/`recordCreationCall`
   at lines 191, 215, 251, 258). `recorded_at` is therefore `null` on every
   decision event today; there is no wall-clock data to diff without first
   fixing that omission.
3. **There is no ledger-recorded fail-closed pathway for the guard to
   invoke.** `runBuild`'s authorization check
   (`checkLifecycleAuthorization` via `merkle-dag/orchestrate.mjs:199-201`)
   fails today by returning a raw `{ error, detail }` object
   (`orchestrate.mjs:201`), never a proposal-ledger event. "Fails closed into
   `needs-work`," as the guard requires, needs a new ledger-event pathway for
   auth failures that does not exist yet.

None of this reopens the choice between Option A and Option B on the ground
originally argued in the two options above — both still get
ledger-representable drift for free, and Option B still pays a
mandatory-human-click cost on every run that Option A does not. What it
changes is that the staleness guard cannot be waved in as a zero-cost rider on
Option A today, and the packet should not have claimed it was.

**Revised ruling: adopt Option A now, unconditioned on the guard.** Authorize
the guard as a distinct, separately-scoped follow-on item, costed honestly
as: (a) threading `recordedAt` through every `recordDecision` call site the
way sibling recorder calls already do — small and mechanical; (b) a persisted
pause/resumption entry point in `runProposalLifecycle` sufficient to make an
elapsed-time read meaningful — the nontrivial piece, comparable to part of
Option B's cost; (c) a new ledger-event pathway for
`checkLifecycleAuthorization`/`runBuild` auth failures to record as a
`needs-work` decision instead of returning a raw error; and (d) the wall-clock
trigger arm only — the production-profile arm stays out of scope until the
authz-008 compiler ships, at which point item-5's own flip condition already
covers wiring a profile-hash check in. Built this way, the guard still leaves
the Eye with a materially cheaper steady state than Option B — no mandatory
click on the ordinary run — but it is a real, scoped implementation item, not
"nothing new," and should be tracked and authorized as such rather than
folded silently into today's ruling.

**This flips toward Option B (mandatory second gate)** if either becomes
true: (a) The Eye's human-adjudication UX is built such that real wall-clock
gaps of hours or days routinely separate planning approval from Stage 3
dispatch (the zero-gap assumption above stops holding) — note the same UX
work that would create this gap is also the natural place to build the
pause/resumption entry point item (b) above depends on, so the two are likely
to land together; or (b) The Eye wants the split to be risk-tiered rather than
uniform — e.g., requiring the distinct coding go-ahead only for proposals
whose `risk_policy.mjs`-derived `risk_class` crosses a threshold — in which
case the existing risk-class machinery (`build-gate/risk-policy.mjs:117-145`)
is already available to key that split without inventing a new signal.
