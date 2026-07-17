---
type: reference
topic: clotho
status: living
note: Known ways models and humans have misunderstood or broken this component — recorded so the next model does not repeat them.
---

# Clotho — failure modes

## Content failure classes (recurred during Task 4a; residuals deferred)

These lexer/resolver classes recurred across 13 review rounds and are catalogued, with
exact breaking inputs, in `docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md`:

1. **Regex-vs-division** — a keyword-driven *allow-list* is incomplete by construction;
   the correct rule is the **deny rule** (division only after a value token). Fixed as a
   class, but adversarial contexts (function/class expression bodies, `await`/`yield`,
   comment-separated members) can still be mined.
2. **Fail-closed profile completeness** — each out-of-profile construct (b1–b6) must be
   *mechanically detected*; enumerating cases one per round is the anti-pattern.
3. **Original-order containment** — inspect every original component before any
   `..`-collapse; the recurring bug was normalizing first or bailing at the first ENOENT.

**Safety net:** none of the deferred residuals affect the committed artifacts — the
`closure-equality-proven` invariant (`test-closure §12`) would fail loudly on any real
divergence. They are correctness on adversarial inputs **outside the committed-source
trust domain**.

## Process failure mode (the generative cause — the reason this memory layer exists)

The 13 rounds were expensive because of a **process** defect, not a coding one:

- **Ephemeral knowledge.** The invariants and the exact rules lived in prompts and review
  packets, not in a durable artifact. Each stateless implementation fork **re-derived**
  the rules and **re-made the same class of mistake**.
- **Discovery in the most expensive loop.** New defects were found by a **signed council**
  (a live spend) and fixed by a full-rebuild fork — discovery should have been a cheap
  local gauntlet, with the council confirming, not searching.
- **Case-fix not class-fix.** Fixes patched the specific example (add `default` to a list)
  instead of making the rule total (the deny-based tokenizer).

**Remedy (best practice, applied going forward):**
1. **Class-fix, never case-fix** — make the rule total; one completeness fix retires the
   whole class.
2. **Shift discovery left** — run a cheap local adversarial/property gauntlet until dry
   *before* spending a signed council round.
3. **Materiality-gated convergence** — accept at required-majority approval with no
   risk-bearing dissent; defer residual trivia to a backlog.
4. **Capture knowledge durably** — this institutional-memory record set + the
   `docs/institutional-memory/comprehension-gate.mjs`, so the next model loads accumulated
   truth instead of a fresh, confident guess.
