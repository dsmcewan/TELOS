---
type: reference
topic/architecture: telos
status: living
note: Considered-and-rejected designs for the Argo role — preserved so a later model does not rediscover them as novel improvements.
---

# Argo — rejected alternatives

- **An autonomous Argo runner.** REJECTED — implementation is human-initiated; a
  service that "carries plans through implementation" on its own would collapse the
  boundary between model work and The Eye's authority (system non-claim).
- **Implementing without the comprehension gate.** REJECTED — reading is not
  understanding; an implementer who has not returned a passing reader-validation
  artifact has no implementation authority (SCHEMA; the reader-hallucinating
  example is DENIED by construction).
- **Unbounded slices.** REJECTED — a slice is scoped by the frozen plan and its
  diff is confined; "while I'm in here" changes are how repair-induced defects
  enter (see the harvest-1 studies that motivated parallel authorship).
- **Forcing convergence on a lone dissent with more rounds.** REJECTED — after 13
  rounds of an asymptotically-shrinking codex tail, The Eye chose a stopping rule
  + recorded backlog over round 14. Endless re-review optimizes reviewer fatigue,
  not correctness.
- **Silently fixing deferred minors during feature work.** REJECTED — the backlog
  is revisited *outside* feature development (the stopping rule's second half);
  folding fixes into unrelated slices hides them from review.
- **Treating the gate's 'GRANTED' artifact as authority itself.** REJECTED — it is
  the precondition; The Eye grants. Formal wiring of the artifact into TELOS
  authority remains a recorded open question.
- **Re-scoping in the implementation when the plan is ambiguous.** REJECTED — the
  precedent path is escalate → Eye ruling → Daedalus delta → re-authorization
  (AM-40, AM-41), never a quiet workaround in code.
