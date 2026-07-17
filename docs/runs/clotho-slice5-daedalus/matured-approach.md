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
   malformed records/manifests/kinds/statuses/ids/args, conflicting node
   descriptors, invalid semantic endpoints, invalid status transitions, and any
   edge asserted by a weaver whose supplied manifest state is not `executed`
   (the full frozen rejection list, not a summary of it). `why`/`reportGaps`
   express coverage exclusively through
   `{gap: "coverage-unknown", weaver, expected_kind}` records — they do NOT carry
   the `coverage`/`coverageUnknown` fields (those belong to `threadsOf`/
   `blastRadius` per the frozen interface signatures).
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
   Each oracle must prove the specific facts named in its
   `becomes_normative_when` clause, at minimum:
   - test-query.mjs: the closed coverage schema; `coverageUnknown: []` legality
     ONLY under `coverage: "verified"` with a verified manifest proving every
     consulted producer `executed`; and rejection — a missing/unknown/
     contradictory coverage value is a test FAILURE, never a warning.
   - test-weave.mjs: re-derivation + hash recheck + abort-on-drift + atomic
     publish (D34/D28); rejection of mismatched edge/warning attribution
     (D10/AM-39); the counted-iterator accounting gate, close equality, and
     `published-cleanup-incomplete` residue handling (D26/D29, D19/AM-20, D28).
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
- Shared-validator caveat (see R3 resolution below): if any shared helper in
  `util.mjs` is touched, that file has exactly ONE writer (agent-Q), and agent-W
  consumes it read-only; any needed helper change routes through agent-Q before
  merge. This preserves the disjoint-writer invariant.
- Integration step (single-writer): test-all wiring, record flips, verify-contracts.

## Runtime concurrency (inside the driver)

Per-package weaver DERIVATION may run concurrently (five spine packages, disjoint
trees, deterministic extraction) — but ALL ordering-sensitive stages remain strictly
sequential and single-writer: assemble → re-derive + exact-compare (D34) → append
with the attribution gate (D10) → close with equality proof (D19) → atomic publish
(D28). Concurrency never crosses the counted-iterator accounting: each package's
iterator is consumed to exhaustion and its counts recorded before assembly.
Additionally, per D34 the publication-time RE-derivation runs sequentially and
single-threaded: the drift check's value is an exact byte-level comparison against
the assembled result, so the recheck path takes the simplest deterministic form
even if first-pass derivation was concurrent. Assembly order is fixed and
input-determined (stable package order, stable per-package extraction order) so
that concurrent first-pass derivation and sequential re-derivation are
byte-comparable.

## Risk resolutions (answers to R1–R3, settled from the frozen material)

- **R1 — concurrent derivation vs D26/D29 accounting: RESOLVED, safe with the
  stated fences.** The frozen D26/D29 clause requires counted-iterator
  completeness BEFORE append/close; it constrains the accounting gate, not the
  derivation schedule. Because (a) each package's iterator is consumed to
  exhaustion with its count recorded before assembly, (b) extraction is
  `deterministic-extraction` over disjoint read-only trees, and (c) every
  ordering-sensitive stage (assemble → D34 recheck → append → close → publish)
  is strictly sequential single-writer, concurrency cannot perturb the counts or
  the published bytes. The D34 sequential re-derivation is the independent
  witness: if concurrent first-pass derivation ever produced a different result
  than sequential re-derivation, the exact-compare ABORTS the publish. Drift
  abort thereby converts any residual concurrency hazard into a fail-closed
  outcome, which is the posture the frozen decisions require.
- **R2 — `published-cleanup-incomplete` residue: RESOLVED as an oracle
  obligation.** The frozen clause names `published-cleanup-incomplete` residue
  handling as part of the D28 `becomes_normative_when` for test-weave.mjs. The
  approach therefore commits test-weave.mjs to exercise the D28 failure windows
  the full v15 clause enumerates, and at minimum the two structural windows of
  exclusive no-replace `linkSync`: (i) publish target already exists →
  `linkSync` fails EEXIST → abort with staging residue accounted for, no
  replacement of published bytes ever; (ii) link succeeded but post-publish
  cleanup of the staging file failed → the `published-cleanup-incomplete`
  residue state is reported as exactly that (publication is complete and valid;
  residue is a cleanup fact, not a publication failure), and re-runs neither
  re-publish nor destroy the published artifact. The enumeration in the 36KB
  clause is normative; the oracle asserts each enumerated window by fault
  injection, and implementation follows the clause text verbatim where it is
  more specific than this summary.
- **R3 — manifest-validation placement: RESOLVED — the clause constrains
  behavior, not placement; choose one shared validator.** The frozen interfaces
  require both surfaces to reject malformed manifests and edges from
  non-`executed` producers identically; nothing in the frozen decisions mandates
  a module layout. Duplicated validators risk divergence, which would let the
  same manifest pass one surface and fail the other — a coverage-honesty (D11)
  hazard. Therefore: ONE shared manifest/record validator in `util.mjs`,
  imported by both `query.mjs` and `weave.mjs`; it is pure and does no I/O
  (query.mjs's no-I/O guarantee is preserved); single-writer ownership per the
  build-order caveat above. This is an implementation choice within the frozen
  envelope, not an amendment.

## Non-goals

No plan amendment; no Lachesis/risk claims; no loader/sandbox claims; advisory
posture unchanged; spine read-only; zero dependencies.
