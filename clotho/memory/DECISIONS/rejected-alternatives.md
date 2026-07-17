---
type: contract
topic: clotho
status: living
kind: rejected-alternative
status_taxonomy: REJECTED-ALTERNATIVE
note: These were CONSIDERED AND REJECTED. A future model must not rediscover them as novel improvements. "Not considered" and "considered and rejected" are different states; this file records the latter.
---

# Clotho — rejected alternatives

## REJECTED: full spec-exact ECMAScript + Annex-B lexer

- **status** — `REJECTED-ALTERNATIVE`.
- **proposal** — implement a complete ECMAScript (+ Annex-B) lexer/parser so the D33
  scanner is exactly correct on every valid JavaScript input (HTML comments, hashbang,
  octal escapes, U+2028/U+2029, string-literal import names, CommonJS, …).
- **why rejected** — it exceeds the authorized **dependency-free lexical scanner** role;
  it is an unbounded implementation cost (a maximally-thorough seat can mine adversarial
  inputs indefinitely); and it provides no proportional benefit within the trust domain,
  because those inputs **cannot occur in committed, human-reviewed Clotho ESM source**,
  and any real divergence is caught by the closure-equality gate.
- **what replaced it** — AM-41: total correctness over a **closed, enforced source
  profile** that fails closed on everything outside it. *(Authority: The Eye, AM-41,
  authz-008.)*

## REJECTED: override the codex required seat by majority approval

- **status** — `REJECTED-ALTERNATIVE`.
- **proposal** — when four of five council seats approve and only the required codex seat
  dissents, accept by majority and proceed.
- **why rejected** — a **required-seat dissent that identifies a genuine contradiction is
  not erased by majority agreement**. The council is not majority voting; a valid
  contradiction blocks authorization rather than being averaged away. (See
  `docs/convergence-is-not-authorization.md`.) This principle is why `authz-007` failed
  closed and caught the weave.mjs shebang contradiction.
- **what was done instead** — genuine defects were fixed at the source; the residual
  adversarial tail (correctness on inputs outside the trust domain) was accepted under
  **The Eye's materiality-gated stopping rule** and deferred to
  `docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md`. *(Authority: The Eye.)*
