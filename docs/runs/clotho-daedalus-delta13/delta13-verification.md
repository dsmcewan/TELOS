# Daedalus delta-13 — verification (candidate v14)

**Outcome:** `converged-for-submission`, 0 unresolved objections, 1 round (after
one corrective iteration — see Process).

## What delta-13 did

Integrated the normative amendment **AM-41** — The Eye's *enforced closed
source-profile* ruling for the D33 lexical scanner — into the converged plan
**v13** (`docs/runs/clotho-daedalus-delta12/matured-plan-v13.md`,
`sha256:f9368b57…`), producing candidate **v14** (`matured-plan-v14.md`).

**Origin.** During Task 4a required-seat review, codex (lone required dissenter
after claude/agy/grok/gemini approval) kept surfacing valid-but-esoteric
JavaScript lexical forms (HTML/legacy comments, hashbang, octal escapes,
U+2028/U+2029, string-named imports, CommonJS) that a hand-written
*dependency-free lexical scanner* does not obviously handle. Escalated to **The
Eye**, who ruled: not a full ES parser, and not an override of codex, but a
**mechanically enforced closed source profile** — total correctness over an
explicit subset that **fails closed on everything outside it**.

## Integration is one block (byte-verified)

v14 differs from v13 at **exactly one** location — a single contiguous insertion
into the Task 4a **D33 shared-grammar clause** (`diff` = `1081a1082,1143`, 62
added lines), nowhere else. Every other frozen decision (AM-40 PACKAGE_ROOTS;
D17/AM-17; D24/D26/D31; D32; the D33 accepted-form set; AM-35..AM-39 advisory /
non-sandbox posture; zero-dependency; spine read-only) is reaffirmed unchanged.

The inserted clause freezes: **(a)** the supported profile (LF/CRLF terminators;
`//` and `/* */` comments; an exact string-escape set; the D33 accepted forms
with keyword-named aliases and dynamic-import options; regex-vs-division by
previous-significant-token; member/private/property/contextual-identifier
lookalikes are not loads; the closure-vs-code-weaver `.mjs` split); **(b)** the
EXACT enumerable out-of-profile set (b1–b6: bare CR/U+2028/U+2029; hashbang;
`<!--`/`-->`; string line-continuations & octal escapes; string-literal specifier
names; unterminated/truncated forms) — each **detected and failed closed** with
the stable diagnostic `unsupported-module-lexical-profile`; **(c)** original,
uncollapsed-component containment in the shared resolver (lstat before any
`..`-collapse) + a fixture; **(d)** the two proved properties (supported forms
correct; each out-of-profile construct fails closed).

## Convergence provenance

Both Daedalus seats VERIFIED the pre-integrated candidate against AM-41 and BOUND
it byte-identically (neither modified it), zero open objections:

- claude `claude-fable-5` (`msg_011Cd6s6wfmZrbjP…`)
- codex `gpt-5.6-sol` (`chatcmpl-E2Sst2Rs51D…`)

`final_candidate_ref` = `sha256:f152f1663234a393aa8a0dd441d2631a9cf4a6d50773d719178f38f483da3426`;
the bound artifact equals `matured-plan-v14.md` byte-for-byte.

## Process

The first live run stalemated with **two genuine objections**: the draft said the
excluded set "MAY include" examples (not an EXACT frozen profile), and the
original-component containment requirement was not bound to the shared resolver
with a fixture. Both were correct per The Eye's ruling ("freeze the exact set");
the amendment and integration were tightened to an **exact enumerable profile**
(b1–b6) and an explicit resolver containment requirement, after which both seats
bound the candidate with zero objections.

## Status

v14 is converged for submission. Next: release, TELOS re-authorization (authz-007)
against v14, The Eye's re-confirmation of the implementation authorization, then
Task 4a implements the corrections (realistic fixes + enforced source profile) and
its required-seat review resumes against v14.
