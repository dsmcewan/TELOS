---
type: contract
topic: clotho
status: living
kind: decision
task: "6,7"
status_taxonomy: NORMATIVE-CURRENT
authority: v15 sha256:05a48700… · authz-008
note: Task 6 and Task 7 decisions implemented and oracle-backed; Phase 1 closed at git:983aad5.
---

# Tasks 6 & 7 — normative decision records

## Task 6 · D3 — review set + hand-audited flagship

- **what** — `expected-flagship.json` is hand-audited and **reviewed by The Eye** (the exact
  artifact). After one-to-one matching of a full real-repo weave against the expected 8-group
  fact set, every unexpected fact in the flagship neighborhood (matching no expectation) is
  emitted into a deterministically-sorted **review set** — exposed, but NOT scored as a failure.
  The reproduction additionally proves closure equality (D33/AM-34 test 23): the manifest's
  `implementation_refs` equal the derived closure.
- **why** — a flagship must be a curated, human-reviewed acceptance target, and unexpected facts
  are noise to surface (Lachesis/analysis) not automatic failures.
- **scope** — `scripts/expected-flagship.json`, `scripts/test-flagship.mjs`, Task 6.
  **authority** — D3, D33/AM-34, authz-008.
- **non_claim** — the flagship proves the expected 8-group set + closure equality, NOT that
  Clotho covers every module JS could reach.
- **status** — `NORMATIVE-CURRENT`; **oracle**
  `clotho/scripts/test-flagship.mjs` proves the eight groups, review set, coverage, and closure.

## Task 7 · D8 — self-weave exclusion + reproduction from committed bytes

- **what** — `docs/runs/clotho-self-weave/run.mjs` performs a keyless full self-weave to a unique
  temp path, verifies it, and publishes snapshot/summary/match-report/review-set/verification;
  the self-weave OUTPUT directory (`docs/runs/clotho-self-weave/`) is excluded from EVERY weaver's
  inventory (D8) so the weave never ingests its own prior output. Evidence must verify from
  committed bytes; publication uses the same D34 re-derivation + D28 atomic discipline as the
  Task 5 driver.
- **why** — a self-weave that ingested its own output would fabricate coverage; D8 breaks that loop.
- **scope** — `docs/runs/clotho-self-weave/`, `docs/STATUS.md`, `docs/ROADMAP.md`, Task 7.
  **authority** — D8, D34, authz-008.
- **non_claim** — Clotho Phase 1 is advisory / non-sandbox; the self-weave proves reproduction and
  the coverage manifest, NOT loader containment (reaffirms `no-loader-containment`).
- **status** — `NORMATIVE-CURRENT`; **oracle**
  `docs/runs/clotho-self-weave/run.mjs` + `clotho/scripts/test-flagship.mjs` prove reproduction
  from committed bytes and the D8 exclusion.
