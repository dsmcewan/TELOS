---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: One Eye action authorizes both the planning gate and Stage 3 (code-produce) entry by default. Machine anchor — docs/runs/item-2-planning-coding-gate-ruling-packet.md (revised and reverified 2026-07-22).
---

# Decision: one Eye action covers planning gate and Stage 3 entry (Option A)

**What.** By default, a single Eye action authorizes both the planning gate and
entry into Stage 3 (code production) — no second, distinct "coding-authorized"
Eye action is required on the ordinary run. This is conditioned on the
execution-time lifecycle re-verification already implemented in
`checkLifecycleAuthorization` (`merkle-dag/orchestrate.mjs:19-45`, decision 6)
remaining load-bearing and never being weakened or bypassed for a "fast path."
The staleness guard for elapsed-time world drift (facts that change in the
world but never touch the ledger) is NOT adopted as a free rider on this
ruling: it is authorized separately, as a distinct, scoped follow-on item,
costed as (a) threading `recordedAt` through every `recordDecision` call site,
(b) a persisted pause/resumption entry point in `runProposalLifecycle` making
an elapsed-time read meaningful, (c) a new ledger-event pathway so
`checkLifecycleAuthorization`/`runBuild` auth failures record as a
`needs-work` decision instead of a raw error, and (d) the wall-clock trigger
arm only — the production-profile-hash arm stays out of scope until the
authz-008 compiler ships. This ruling flips toward Option B (mandatory second
gate) if either becomes true: the Eye's human-adjudication UX is built such
that real wall-clock gaps routinely separate planning approval from Stage 3
dispatch, or the Eye wants the split risk-tiered via the existing
`risk_policy.mjs`-derived `risk_class` rather than uniform.

**Why.** The risk a second mandatory gate exists to catch — a plan approved
before some intervening fact changed — is already caught mechanically, at zero
marginal Eye cost, for every fact the system can represent: `runBuild`'s
`checkLifecycleAuthorization` re-recomputes the plan hash, re-derives the
latest decision for that exact plan_hash from the ledger, and re-runs the full
ledger-reconstructed `lifecycleVerify` immediately before dispatch, so any
hold, concern, or chain tamper appended after planning approval already blocks
Stage 3 outright, with zero additional Eye action required. Option A also
matches the design's own drawn baseline (one Eye box between plan-authorize
and Stage 3) and requires no new plumbing, since `decision === "authorized"`
already gates `runBuild` directly. Option B's only remaining advantage —
catching elapsed-time world drift with no ledger footprint — is real but
currently unmeasured and structurally zero today, because the
human-adjudication UX that would create a wall-clock gap between planning
approval and Stage 3 start has not been built; a mandatory second click would
therefore pay its cost on every compliant run to guard a risk with no
observed occurrence. A mechanical staleness guard is the right shape of
compensating control for that residual risk, but a fix-round review found it
is not currently free to build (no production-profile hash to key against,
no wall-clock data since `recorded_at` is null on every decision event today,
no fail-closed ledger pathway for auth failures) — so it is costed and
authorized as its own follow-on item rather than folded silently into this
ruling.

**Authority chain:** docs/runs/item-2-planning-coding-gate-ruling-packet.md
(adversarially reviewed, revised, and passed bounded review 2026-07-22) ->
Eye ruling: adopt, 2026-07-22.
