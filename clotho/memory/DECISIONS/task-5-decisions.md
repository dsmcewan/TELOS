---
type: contract
topic: clotho
status: living
kind: decision
task: "5"
status_taxonomy: SPECIFIED-PENDING-IMPLEMENTATION
authority: v15 sha256:05a48700… · authz-008
note: Frozen Task 5 decisions (queries, complete-weave driver, advisory invariant). Design substrate — code not yet written.
---

# Task 5 — decision records (design substrate)

## D35 / AM-37 — closed normative coverage schema

- **what** — `blastRadius` results carry a closed `coverage: "verified" | "unverified"` field;
  it is never optional and never defaults to `verified`. `coverageUnknown: []` is legal ONLY
  under `coverage: "verified"` with a verified manifest proving every consulted producer
  `executed`. A missing/unknown/contradictory value is a test failure; `why`/`reportGaps`
  express coverage through `{gap: "coverage-unknown", weaver, expected_kind}` records.
- **why** — coverage honesty (D11): a graph query must never silently imply completeness it
  cannot prove; conservative unknown, never false confidence.
- **scope** — `query.mjs`, Task 5. **authority** — D35/AM-37/D11 + Eye directive, authz-008.
- **non_claim** — `coverage: "verified"` asserts producers executed at publication time, NOT
  that Clotho covers every module JS could reach.
- **status** — `SPECIFIED-PENDING-IMPLEMENTATION`; **becomes_normative_when**
  `clotho/scripts/test-query.mjs` proves the closed schema + coverageUnknown legality + rejection.
- **contract** — `clotho/memory/CONTRACTS/coverage-schema.json`.

## D34 / AM-38 — publication-time re-derivation + drift abort

- **what** — before atomic no-replace publication (D28), the complete-weave driver re-derives
  the weave, re-reads + re-hashes the sources, exact-compares against the assembled result, and
  ABORTS on any drift. The published claim is "the supported statically-declared dependency
  model at publication time".
- **why** — closes the window between derivation and publication; a source that changed under
  the weave must not be published as covered.
- **scope** — `weave.mjs`, Task 5. **authority** — D34/AM-38/D28, authz-008.
- **status** — `SPECIFIED-PENDING-IMPLEMENTATION`; **becomes_normative_when**
  `clotho/scripts/test-weave.mjs` proves re-derivation + hash recheck + abort-on-drift + atomic publish.

## D10 / AM-39 — producer == attribution (append-time)

- **what** — before appending any weaver result the driver requires every edge's `asserted_by`
  == the invoked weaver id and `assertion_status` == `deterministic-extraction`, and every
  `warning.weaver` == that same id; a cross-weaver / human / model attribution is rejected and
  the weave aborts.
- **why** — provenance integrity: a weaver may not attribute output to another producer.
- **scope** — `weave.mjs`, Task 5. **authority** — D10/AM-39, authz-008.
- **status** — `SPECIFIED-PENDING-IMPLEMENTATION`; **becomes_normative_when**
  `clotho/scripts/test-weave.mjs` proves rejection of mismatched edges/warnings.

## D26/D29 completeness gate · D19/AM-20 inventory-equality-at-close · D28 atomic no-replace publish

- **what** — the driver enforces counted-iterator completeness before append/close (D26/D29),
  proves committed-inventory equality at close (D19/AM-20), and publishes via exclusive
  no-replace `linkSync` (D28/D20). **status** — `SPECIFIED-PENDING-IMPLEMENTATION`;
  **becomes_normative_when** `clotho/scripts/test-weave.mjs` proves the accounting gate, close
  equality, and atomic publish (+ `published-cleanup-incomplete` residue handling).
