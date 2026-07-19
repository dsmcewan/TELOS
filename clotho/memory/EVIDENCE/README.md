---
type: reference
topic: clotho
status: living
note: Evidence anchors for Clotho's claims. Every NORMATIVE invariant/contract points here or to a named test. Reproduce with the command below.
---

# Clotho — evidence anchors

**Reproduction:** `cd clotho && npm test` (runs `npm run check` then
`scripts/test-all.mjs`; 14 ordered test programs).

## Tests (executable oracles)
- `clotho/scripts/test-inventory.mjs` — frozen inventory-id table equality; D32 map
  deep-equal/deep-freeze/mutation; PACKAGE_ROOTS completeness/disjointness over tracked
  `package.json` dirs; every committed inventory path exists.
- `clotho/scripts/test-closure.mjs` — committed weaver inventories **proven equal** to
  derived D33 closures and the orchestrator inventory proven equal to its union
  closure; every accepted form + all fail-closed modes (b1–b6).
- `clotho/scripts/test-util.mjs` — the D33 lexer/classifier/resolver: deny-based
  regex/division; profile b1–b6; counted iterator; original-order containment; git
  allowlist + controlled-env two-repo GIT_DIR faithfulness.
- `clotho/scripts/test-git.mjs`, `test-code.mjs`, `test-registry.mjs`,
  `test-ledger.mjs` — the Task 2–4a registry, signed-ledger, git, and code substrate.
- `clotho/scripts/test-weaver-test.mjs`, `test-weaver-doc.mjs`,
  `test-weaver-ledger.mjs` — all Task 4b weavers, including typed fatal warnings
  for duplicate headings and malformed ledger JSON/schema/hash/chain failures.
- `clotho/scripts/test-query.mjs`, `test-advisory.mjs`, `test-weave.mjs` — the
  closed coverage schema, advisory boundary, complete-weave accounting/provenance,
  real-weaver fatal-warning aborts, and atomic publication discipline.
- `clotho/scripts/test-flagship.mjs` — the Eye-reviewed eight-group flagship,
  review set, closure equality, doc-skipped coverage failure, and D31 independence.

## Gate + review evidence
- `docs/runs/clotho-impl-slice-4a/gate.mjs` + `gate-result.json` — deterministic gate
  (`finalStatus: meets`).
- `docs/runs/clotho-impl-slice-4a/run-slice-4a-review.mjs` + `review-summary.json` +
  `round1..13-*.json` — the signed required-seat review history.
- `docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md` — the accepted deferred backlog.
- Task 4b merge `git:af64b88`; Task 5 delivery `git:321473a`; Task 6 delivery
  `git:ea6a15d`; Task 7 / Phase 1 closure `git:983aad5`.
- `docs/runs/clotho-self-weave/` — verified snapshot, summary, match report,
  review set, and reproduction evidence from the completed Task 7 run.

## Authority
- Active plan v15 `sha256:05a48700…` (`docs/runs/clotho-daedalus-delta14/matured-plan-v15.md`);
  authorization `authz-008` (`docs/runs/clotho-authorization-8/authorization-summary.json`);
  accepted slice anchors `git:f12e5d2`, `git:af64b88`, `git:321473a`,
  `git:ea6a15d`, and `git:395c971`. See root `CURRENT-AUTHORITY.json`.

## Contract == code
- `node docs/institutional-memory/verify-contracts.mjs` — proves each machine-readable
  contract in `clotho/memory/CONTRACTS/` equals what the code enforces, and each plan
  hash in `CURRENT-AUTHORITY.json` matches disk.
