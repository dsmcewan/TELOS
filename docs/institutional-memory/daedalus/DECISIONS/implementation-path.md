---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: Rules item 6 (v2 Stage 0/2/4 delta) proceeds workshop-first, then a scoped ordinary-review extension. Machine anchor — docs/runs/item-6-implementation-path-ruling-packet.md (adversarially reviewed, revised, passed bounded review 2026-07-22).
---

# Decision: workshop-first proof, then scoped extension, for the v2 Stage 0/2/4 delta

**What.** For item 6 — building the v2 Stage 0/2/4 delta (research pre-flight, full
challenge-as-gate-plus-deny-back, referee) into `build-gate/daedalus.mjs` +
`proposal-orchestrator.mjs` — the path is workshop-first proof (Option B), not a
fully-specified, committee-authorized mega-plan against the shipped files before any
of it runs (Option A). Follow the pattern
`docs/runs/production-profile-compiler-1-workshop/daedalus-v2.mjs` already
demonstrates: compose around the existing `runParallelDaedalus`/`runWorkshop` join via
an injected join function, and never modify the shipped join. Once a stage's mechanics
have a real passing test suite in a disposable location, promote it via a scoped,
single-stage extension against `build-gate/daedalus.mjs` +
`proposal-orchestrator.mjs`, reviewed at the ordinary PR-and-cold-review weight that
`2e530b2`/`df65e8e` already established on these exact files — not a 5-model
authorization council.

**Why.** The workshop prototype (`daedalus-v2.mjs`, 731 lines + 903 lines of tests)
already implements Stage 0/2 mechanics and passes 35/35 tests, cost zero council
rounds, and left the shipped orchestrator untouched. The contrasting mega-plan-first
mode was run for real on a comparable-rigor governance design (the
daedalus-family-lifecycle plan) and was refused four straight times
(`authz-009`–`authz-012`), producing zero implementation code after ~18 hours of
council effort — but that failure is confounded by scope: the family-lifecycle plan
also built an entirely new trust-primitive stack from scratch rather than reusing
TELOS's already-reviewed `merkle-dag`/`build-gate` infrastructure. A direct
counter-precedent on these exact files — `2e530b2`/`df65e8e`, which landed and
hardened comparable dual-seat friction machinery in `daedalus.mjs`/
`proposal-orchestrator.mjs` via an ordinary PR and normal cold review, not a council —
shows extend-in-place is not itself the failure mode; reinventing trust primitives
inside a fully-specified pre-run mega-spec is. Workshop-first sidesteps that
confound entirely by proving mechanics cheaply before any promotion into
trust-critical files, and the eventual promotion step reuses existing, already-
reviewed hashing/signing/DAG machinery rather than a from-scratch stack.

**Authority chain:** docs/runs/item-6-implementation-path-ruling-packet.md
(adversarially reviewed, revised, and passed bounded review 2026-07-22) -> Eye
ruling: adopt, 2026-07-22.
