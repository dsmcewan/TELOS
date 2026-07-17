# Slice-5 implementation approach — candidate (for Daedalus review)

Scope: implement Clotho Task 5 EXACTLY per the frozen plan v15 Task 5 clause
(sha256:05a48700…, authz-008; full normative text: docs/runs/clotho-daedalus-delta14/
matured-plan-v15.md §"Task 5"). This document is the implementation APPROACH only —
sequencing, concurrency, oracles, risks. It amends nothing.

## Deliverables

1. `clotho/query.mjs` — pure, no-I/O query surface: `threadsOf`, `blastRadius`, `why`,
   `reportGaps` over verifyLedger-returned records; closed coverage schema
   (D35/AM-37): `coverage: "verified"|"unverified"` never optional/defaulted;
   `coverageUnknown: []` legal ONLY under verified with every consulted producer
   `executed`; conservative full-list under unverified; fail-closed rejection of
   malformed records/manifests/kinds/statuses/ids/args.
2. `clotho/weave.mjs` — complete-weave driver (Node shebang legal per the AM-41
   carve-out): counted-iterator completeness before append/close (D26/D29);
   producer==attribution append gate — every edge `asserted_by` == invoked weaver id,
   `assertion_status` == `deterministic-extraction`, every `warning.weaver` matches,
   else ABORT (D10/AM-39); publication-time re-derivation — re-derive the weave,
   re-read + re-hash sources, exact-compare, ABORT on drift (D34/AM-38);
   committed-inventory equality at close (D19/AM-20); atomic no-replace publish via
   exclusive `linkSync` with `published-cleanup-incomplete` residue handling (D28/D20).
3. Oracles: `clotho/scripts/test-query.mjs` + `clotho/scripts/test-weave.mjs` — exact
   names match the frozen `becomes_normative_when` strings, wired into test-all.
4. Record flips at green: `coverage-schema` contract + `d35-closed-coverage-schema`,
   `d34-publication-time-drift-abort`, `d10-am39-producer-attribution` →
   NORMATIVE-CURRENT. (`d8-self-weave-exclusion` stays pending — slice 7.)

## Build order & concurrency (merkle-dag discipline applied to our own workflow)

- Entry ritual first: pass `clotho/memory/comprehension-queries.5.json` (GRANTED).
- TWO PARALLEL BUILD AGENTS in isolated worktrees, one writer per file:
  agent-Q writes `query.mjs` + `test-query.mjs`; agent-W writes `weave.mjs` +
  `test-weave.mjs`. Disjoint file sets ⇒ conflict-free merge; each agent's oracle
  must pass in its own worktree BEFORE merge; after merge, the full suite re-runs
  (Rule-3 spirit: the merged tree is re-verified, no agent self-report).
- Integration step (single-writer): test-all wiring, record flips, verify-contracts.

## Runtime concurrency (inside the driver)

Per-package weaver DERIVATION may run concurrently (five spine packages, disjoint
trees, deterministic extraction) — but ALL ordering-sensitive stages remain strictly
sequential and single-writer: assemble → re-derive + exact-compare (D34) → append
with the attribution gate (D10) → close with equality proof (D19) → atomic publish
(D28). Concurrency never crosses the counted-iterator accounting: each package's
iterator is consumed to exhaustion and its counts recorded before assembly.

## Risks / open points for review

- R1: does concurrent per-package derivation threaten D26/D29 counted accounting or
  determinism anywhere the frozen clause assumes sequential derivation?
- R2: `published-cleanup-incomplete` residue semantics — confirm the approach covers
  the failure-window cases the clause enumerates.
- R3: manifest validation split between query.mjs and weave.mjs — single shared
  validator in util.mjs vs per-module: which does the clause require?

## Non-goals

No plan amendment; no Lachesis/risk claims; no loader/sandbox claims; advisory
posture unchanged; spine read-only; zero dependencies.
