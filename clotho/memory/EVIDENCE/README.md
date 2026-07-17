---
type: reference
topic: clotho
status: living
note: Evidence anchors for Clotho's claims. Every NORMATIVE invariant/contract points here or to a named test. Reproduce with the command below.
---

# Clotho — evidence anchors

**Reproduction:** `cd clotho && npm test` (runs `npm run check` then `scripts/test-all.mjs`; 7 suites).

## Tests (executable oracles)
- `clotho/scripts/test-inventory.mjs` — frozen inventory-id table equality; D32 map
  deep-equal/deep-freeze/mutation; PACKAGE_ROOTS completeness/disjointness over tracked
  `package.json` dirs; every committed inventory path exists.
- `clotho/scripts/test-closure.mjs` — committed weaver inventories **proven equal** to
  derived D33 closures (§1, §12); every accepted form + all fail-closed modes (b1–b6);
  the enforced-profile fail-closed members.
- `clotho/scripts/test-util.mjs` — the D33 lexer/classifier/resolver: deny-based
  regex/division; profile b1–b6; counted iterator; original-order containment; git
  allowlist + controlled-env two-repo GIT_DIR faithfulness.
- `clotho/scripts/test-git.mjs`, `test-code.mjs`, `test-registry.mjs`, `test-ledger.mjs`.

## Gate + review evidence (Task 4a)
- `docs/runs/clotho-impl-slice-4a/gate.mjs` + `gate-result.json` — deterministic gate
  (`finalStatus: meets`).
- `docs/runs/clotho-impl-slice-4a/run-slice-4a-review.mjs` + `review-summary.json` +
  `round1..13-*.json` — the signed required-seat review history.
- `docs/runs/clotho-impl-slice-4a/DEFERRED-MINOR-FIXES.md` — the accepted deferred backlog.

## Authority
- Active plan v15 `sha256:05a48700…` (`docs/runs/clotho-daedalus-delta14/matured-plan-v15.md`);
  authorization `authz-008` (`docs/runs/clotho-authorization-8/authorization-summary.json`);
  Task 4a merge `git:f12e5d2` (PR #117). See root `CURRENT-AUTHORITY.json`.

## Contract == code
- `node docs/institutional-memory/verify-contracts.mjs` — proves each machine-readable
  contract in `clotho/memory/CONTRACTS/` equals what the code enforces, and each plan
  hash in `CURRENT-AUTHORITY.json` matches disk.
