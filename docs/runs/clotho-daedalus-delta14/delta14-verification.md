# Daedalus delta-14 — verification (candidate v15)

**Outcome:** `converged-for-submission`, 0 unresolved objections, 1 round.

## What delta-14 did

Applied **The Eye's AM-41 shebang carve-out** to the authorized plan **v14**
(`sha256:f152f166…`), producing candidate **v15** (`matured-plan-v15.md`).

**Origin.** authz-007 (v14) returned NOT_AUTHORIZED: the codex required seat
correctly caught that AM-41's blanket hashbang rejection contradicted Task 5's
requirement that `clotho/weave.mjs` — an orchestrator closure entry point — carry
a Node shebang, so its own D33 closure derivation would fail closed. The Eye
ruled: admit ONE optional leading shebang line, frozen precisely — `#!` at byte
offset 0, first line, LF/CRLF-terminated, removed before lexical classification;
any `#!` elsewhere (preceding whitespace, not byte-0/not-line-1, a second `#!`, or
inside a string/comment) still fails closed with
`unsupported-module-lexical-profile`.

## Integration is the carve-out only (byte-verified)

v15 differs from v14 at **exactly** the two AM-41-block edits (accepted-grammar
leading-shebang admission + the b2 hashbang carve-out) — 20 changed lines, nowhere
else. The rest of AM-41 and the entire plan are byte-identical to v14. Every other
frozen decision (AM-40; D17/AM-17; D24/D26/D31; D32; the D33 accepted-form set;
AM-35..AM-39 posture; zero-dep; spine read-only) is reaffirmed unchanged.

## Convergence provenance

Both Daedalus seats verified the carve-out against the refined AM-41 and bound the
candidate byte-identically, 0 open objections: claude `claude-fable-5`, codex
`gpt-5.6-sol`. `final_candidate_ref` =
`sha256:05a48700f92938e5fe1cf42199434ec163c86c9bda4f637d669fa89d5867f1c3`; the
bound artifact equals `matured-plan-v15.md` byte-for-byte.

## Status

v15 is converged for submission. Next: release, TELOS re-authorization (authz-008)
against v15 — which should now clear codex's authz-007 contradiction — then The
Eye's implementation authority, then Task 4a implements the corrections (realistic
scanner fixes + enforced source profile incl. the leading-shebang rule) and its
required-seat review resumes against v15.
