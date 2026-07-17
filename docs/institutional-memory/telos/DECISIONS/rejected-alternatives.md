---
type: reference
topic/architecture: telos
status: living
note: Considered-and-rejected designs for the TELOS role — preserved so a later model does not rediscover them as novel improvements.
---

# TELOS (role) — rejected alternatives

- **Inferring authority from consensus, filenames, or dates.** REJECTED — the single
  machine answer is `CURRENT-AUTHORITY.json`; a superseded plan must not look
  normative merely because its file is recent, and a unanimous council is still a
  model outcome (`docs/convergence-is-not-authorization.md`).
- **Trusting a seat's self-reported status.** REJECTED — the gate re-reads disk
  ground truth and re-verifies evidence; a model saying "approved" is data, not a
  decision (`build-gate/gate.mjs`).
- **Making grok/gemini gate-required.** REJECTED — they ride advisory so a missing
  external key can never block authorization; required seats are exactly the
  claude/agy/codex trio (`build-gate/council.mjs#planSeats`).
- **Letting one seat's response id satisfy another seat.** REJECTED — cross-seat id
  reuse blocks in signed mode; each seat carries its OWN provenance (real API id or
  agy's content-addressed attestation), and a seat that cannot produce one
  fail-closes rather than borrowing (`build-gate/scripts/test-trust.mjs`).
- **Unsigned authorization runs.** REJECTED in practice — all eight recorded runs
  ran `trust_mode: "signed"`; an unsigned run would leave signature and provenance
  unenforced on the packets that grant authorization.
- **Cleaning up refused authorizations.** REJECTED — refusals are preserved and
  superseded (Atropos discipline), never deleted; erasing them would make the gate
  look ceremonial and hide the precedents that teach the boundary.
- **Majority voting over required seats.** REJECTED — one required seat's `revise`
  or non-empty `required_edits` blocks regardless of other approvals (authz-007).
