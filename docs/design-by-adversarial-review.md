---
title: "Designing a trust system by adversarial review"
type: essay
tags:
  - topic/proposal-lifecycle
  - workflow/design-process
---

# Designing a trust system by adversarial review

The Proposal Lifecycle subsystem (`contracts/Proposal Lifecycle.md` +
`build-gate/daedalus.mjs` and friends) is the part of TELOS that decides whether
an implementation plan is mature enough to authorize *before* anything
irreversible runs. It is also the part whose **design** was itself put through
the process it implements: adversarial review, round after round, until a
proposal survived and produced a verified contract. This is the story of how it
was built, because the process is more transferable than the code.

## The premise

Most multi-agent systems make a category error: they generate a few candidate
answers, ask "does everyone agree?", and build the winner. That is a popularity
contest. Agreement between models is not evidence of correctness — it is
correlated error.

The alternative is an engineering review board. Separate three things that
casual designs conflate:

- **Creation** — a workshop proposes an implementation plan.
- **Critique** — independent reviewers, who did *not* help create it, try to
  break it.
- **Authorization** — a deterministic gate decides whether the plan may run,
  from evidence, not from vote-counting.

The council never votes on truth. It votes on: *is this plan mature enough to
spend engineering effort on?* And one valid, evidence-backed objection outbeats
three enthusiastic approvals — exactly like a real design review.

## Verify before you agree

The first discipline was refusing to accept a claim about the code without
checking it. When the design proposed that reviews should bind to the exact
compiled plan, the honest question was: *do they today?* They did not — the
council ran **before** `compileAndHashPlan()`, so it was approving "a build," not
"this plan." Other claims checked the same way and held: `proposal_ref` defaulted
to the human-readable `build_id`; decomposition threw away its provenance;
`hard_stops` were bare strings that blocked unconditionally; the settlement
ledger's signed schema could not carry proposal events. Every load-bearing
assertion was confirmed against `file:line` before it entered the design. A
design built on unverified claims about the code is fiction.

## Freeze the contract, then attack the plan

The contract — the human-readable protocol the gate enforces — was frozen over
three review rounds. Only then did the *implementation plan* open for attack.
That plan was rejected and revised **seven times**. Each rejection was a
numbered findings list; each revision answered every finding before resubmitting.
Not one line of code was written until the plan stopped producing findings.

That sounds slow. It was the opposite. Every finding was a bug that would
otherwise have been found in code review, in testing, or — worst — in
production, each an order of magnitude more expensive than a paragraph in a plan.

## The bug that kept coming back

The single most valuable outcome of the review was naming a *class* of bug that
surfaced in six different disguises across the rounds:

> **A mutable label was standing where a content address belonged.**

- `proposal_ref` defaulting to `build_id` — a name, not the plan's hash.
- Objection identity by array position — reorder the list, retarget the request.
- `obligation_id` keying discharge reuse — rename the label, silently reuse a
  stale settlement.
- `concern_index` linking a verification request to a concern — filter the
  concerns, retarget the request.
- `proposal_id` selecting which authorization governs execution — a caller-
  supplied label choosing its own verdict.
- A `target_ref` keyed on `effective_hash` — which changes on *any* edit, so a
  trivial change would read as "the target is gone" and silently dispose of the
  concern.

Each one let enforcement state drift while a signed artifact still looked valid.
The fix was always the same shape, and it became the project's governing rule:

> **No mutable label keys an enforcement decision. Every enforcement identity is
> a controller-derived content address** — or, when the thing legitimately
> changes across revisions, a content-addressed *lineage* identity that is
> assigned once and carried, never recomputed.

Seeing the same defect six times in six costumes is worth more than fixing any
one of them. It turned into a checklist item that now catches the next instance
on sight.

## The other findings

The rest of the review clustered into a few equally transferable categories:

- **Trust reconstruction, not trust delegation.** An early design passed the
  concern/hold state *into* the gate as arrays. A miswired caller could omit a
  blocker and still present a valid chain. The fix: the gate reads and reduces
  that state from the ledger itself. It never trusts a caller for anything
  load-bearing.
- **Sequencing against reality.** One revision derived a concern's disposition
  against "the revised plan" — which did not exist yet. Dispositions had to move
  *after* the new candidate was compiled, so they reason about the real plan, not
  a hypothetical one.
- **Preventive, not detective.** Executable evidence first ran in a scratch
  directory with a changed working directory — which a child process can escape
  by absolute path. It became a real filesystem + network namespace that is
  *unable* to touch the control plane, and is rejected without execution when
  that boundary cannot be established.
- **Closed sets over open assertions.** "All mandatory checks passed" is only
  enforceable against a *known* mandatory set. A `{blockers:[], checks:{plan_hash:
  "pass"}}` that omits every other check must not authorize. The authorization
  certificate became a frozen, versioned, closed contract the executor validates.

## The payoff: the code caught me back

When implementation finally started, the same discipline paid off in reverse.
Several of my own test assumptions were wrong, and the code — built to the
frozen contract — rejected them: the atomic ledger append refused to extend a
corrupt chain; the gate blocked when a recorder's `proposal_id` disagreed with
the plan's; the active-concern reducer rejected a disposition from another
proposal. Every one of those was the system enforcing an invariant against its
own author. That is exactly what it is supposed to do.

## Why this matters

The artifact isn't "the models agreed." It is: *a proposal survived adversarial
review and produced a verified implementation contract.* The same sentence
describes both what TELOS does to software and how TELOS's own governance was
designed. The value of a multi-model system is not five AIs talking — it is a
process where disagreement improves the result before anything irreversible
happens.

**Model judgment is an interrupt, not a certificate.**
