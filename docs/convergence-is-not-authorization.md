# Convergence Is Not Authorization: Required-Seat Dissent After Plan Release

**Canonical TELOS use case** (The Eye, 2026-07-15). Primary evidence:
`docs/runs/clotho-authorization/` — the signed `NOT_AUTHORIZED` packets and
`authorization-summary.json` are not failed-run debris; they are the artifact
that proves TELOS did exactly what it claims to do.

## The sequence

1. **Daedalus converged the plan** — Clotho Phase 1 plan v6, matured through
   five live adversarial workshops (fifteen objections raised and resolved
   under the originating-seat rule) and four Eye hold-reviews
   (`docs/clotho-phase-1-remediation.md`).
2. **The Eye released it** — PR #90 merged with a regular merge commit
   (`698e3d85`), candidate byte-bound to `sha256:1a9f2208…`.
3. **TELOS gathered five valid, signed council packets** — claude, agy, codex
   (required approvers), grok, gemini (advisory); every packet HMAC-signed and
   bound to real per-seat provenance (`msg_…`, `chatcmpl-…`, xAI id, Gemini
   response, agy content-addressed attestation).
4. **Four seats approved at high confidence. One required seat — codex —
   returned high-confidence substantive dissent**: six hard stops (TOCTOU in
   ledger publication; symlink escape from lexical containment; incomplete
   fatal-warning/descriptor-lifecycle semantics; nonliteral-`require` and
   symlink evasion of the advisory-boundary proof; a normatively undefined
   trailer field; command-inferred `verified-by` edges not bound to their real
   evidence bytes) with matching concrete required edits.
5. **The gate failed closed.** `gate_status: blocked` — "codex decision is
   'revise', not 'approve'" — despite unanimous approval from every other
   constituency.
6. **The dissent returned to The Eye as concrete amendments** (AM-21..AM-26,
   delta-6), rather than being averaged away, outvoted, or silently
   overridden.

## The distinction this preserves

> **Daedalus can establish that objections have been accounted for within a
> planning workshop. It cannot establish that every authorization
> constituency has accepted the resulting risk.**

Workshop convergence is a statement about a bounded dialogue: every objection
raised inside it was explicitly resolved, superseded, or withdrawn. It says
nothing about objections that were never raised there. Authorization is a
separate act by a separate constituency, each member staking its own signature
under a gate that treats one required dissent as a full stop.

The two must never be collapsed. A pipeline that treats "the plan converged"
as "the plan is authorized" has deleted the only stage that can catch what the
workshop's participants — however adversarial — did not think to ask.

## Why this case is strong

The system stopped **after everyone had become emotionally ready to proceed**:
five workshops converged, four Eye holds were cleared, the PR was merged, four
of five seats approved. That is precisely where governance usually turns
decorative — where "one more signature" is treated as ceremony. Here the
signature was real: a required seat read the released plan cold, found six
defects that five rounds of prior review had not surfaced, and the gate gave
its dissent full blocking force. No averaging, no override, no deference to
sunk cost.

Two auxiliary properties the run also demonstrated:

- **Fail-loudly guards protected the council itself.** In an earlier attempt
  the codex seat exhausted its completion budget mid-reasoning; the seat layer
  raised a loud error instead of emitting an empty packet with real
  provenance, and the gate honest-blocked the missing packet. Harness defects
  were distinguishable from merits dissent at every step.
- **Dissent must be well-formed to block — and blocks even inside an
  approval.** The gate treats a non-empty `hard_stops` list as blocking
  regardless of the packet's `decision` field, so a seat cannot approve while
  smuggling unresolved conditions, and a controller cannot count the word
  "approve" while ignoring its content.

## Disposition

The Eye accepted all six findings into delta-6 (AM-21..AM-26): items 1–5 as
mandatory plan corrections; item 6 as a **spec challenge** (evidence
provenance for command-inferred `verified-by` edges is normative), with the
trailer/count schema moved into spec v2.4 wherever the specification left it
ambiguous. Re-authorization runs only after the corrected plan re-converges
and The Eye releases it again — the loop, not the shortcut.
