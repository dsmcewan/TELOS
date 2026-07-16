---
title: "Clotho Phase 1 — The Eye's Implementation-Authorization Decision"
type: reference
tags:
  - topic/clotho
  - workflow/authorization
  - decision/the-eye
author: the-eye
---

# Clotho Phase 1 — Implementation-Authorization Decision

**Decision authority:** The Eye (human-held). Per `docs/mythological-vocabulary.md`,
authorization of consequential action cannot be delegated to a model or inferred
from silence. This decision authorizes **implementation** of an already-authorized
plan; it is distinct from, and does not perform, execution.

## Bound to (exact anchors — immutable)

| Binding | Value |
|---|---|
| Authorized plan | Clotho Phase 1 **v12** (`docs/runs/clotho-daedalus-delta11/matured-plan-v12.md`) |
| v12 content address | `sha256:bdc93901952312846d693e14925eac49c332e0364a4a2a158ae21b2d607e79d3` |
| v12 release anchor | `c5b6838b00d4c66a62906c3a20f6a39c99b48f00` (PR #106 merge) |
| v12 reviewed head | `af2b25a1f8b13949f4ebe3c1f714eb9ddd0daa23` |
| Authorization record | **authz-005** (`docs/runs/clotho-authorization-5/`, merged PR #107) — AUTHORIZED, all required seats approve, signed + provenance-enforced, 0 blockers |
| Repository state | `45cf88f6eaf9365e71476782ab5f3b4b31e0d3a2` (main at time of this decision) |

## What is authorized

Implementation of Clotho Phase 1 **strictly as frozen in v12** at content address
`sha256:bdc93901…`. The content address is the specification; the plan text is
the sole normative source for what may be built.

Because the registered role that *carries an authorized plan through
implementation, verification, and documentation* is **Argo**, and **no standalone
Argo runner exists**, "Argo execution" here means **agent- or human-authored
implementation performed under the authorized scope** — not an autonomous
executor. Clotho is the deliverable being built (`clotho/`, absent today), never
the executor.

Implementation proceeds **task by task in v12's own order** (Task 1 scaffold →
Task 0 CI-matrix → Task 2 … Task 7), each as a **bounded, separately reviewed PR**.

## Constraints (fail-closed)

1. **No reinterpretation.** The implementation must match v12's decisions,
   interfaces, and exit criteria as written. Ambiguity is resolved by re-reading
   v12, never by inventing behavior.
2. **No scope expansion.** Nothing outside v12's declared write targets and task
   scope may be built under this authorization.
3. **No modification of the authorized plan.** v12 at `bdc93901…` is immutable.
   Any change to the plan — however small — voids this authorization for the
   changed part and requires a new Daedalus delta + fresh TELOS authorization
   (as rounds 1–11 and authz-001…005 established).
4. **Every implementation PR must re-enter TELOS before acceptance.** No
   implementation artifact is accepted on author self-report. Each PR is gated:
   its produced code and evidence are reviewed under TELOS (seat review + the
   deterministic gate/verifier over real on-disk artifacts) and require human
   approval to merge. This is the "TELOS governs its own implementation" property.
5. **Authorization ≠ execution.** This decision does not merge, run, or accept any
   implementation. It sets the boundary within which implementation PRs may be
   *proposed*; each still passes its own gate and human approval.

## What is NOT authorized

- Reinterpreting, expanding, or editing v12.
- Bulk or unbounded implementation; only bounded per-task PRs.
- Bypassing per-PR TELOS review or human approval.
- Building anything the plan does not name (spine changes, new packages, new
  dependencies — v12 is zero-dependency, spine read-only).

## Evidentiary chain (why this authorization is sound)

Daedalus matured v11→v12 across a four-round required-seat dissent; the claim was
**narrowed to the truth** (advisory / non-sandboxed) and three integrity defects
repaired — not bypassed. authz-005 then achieved **unanimous required-seat
approval** under signed, provenance-enforced, fail-closed review, with codex
(four-round dissenter) independently at approve/high. The content-address guard
demonstrably rejects byte drift. No loader-evasion content was ever produced.

## Disposition

**Implementation of v12 is authorized, task by task, within the frozen scope
above, with every PR re-entering TELOS before acceptance.** Argo (agent/human)
may begin the first bounded slice. Execution authority remains per-PR and
human-gated; this decision does not itself accept any code.

---

*Next artifact:* `docs/clotho-phase-1-slice-1-proposal.md` — the bounded first
implementation slice (v12 Task 1 scaffold) and its acceptance criteria, **for
review; not yet implemented.**
