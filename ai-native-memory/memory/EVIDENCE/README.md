# ai-native-memory — evidence

Pointers to the oracle runs and fixtures that back this record set's claims. Nothing here is a
substitute for running the oracles yourself — this is an index, not a cache of results.

## Where to run the checks

- `cd ai-native-memory && npm run check` — syntax pass (`node --check`) over every script.
- `cd ai-native-memory && npm test` — runs every `tests/test-*.mjs` file via `tests/run.mjs`,
  including `tests/test-dogfood.mjs`, which is the plugin auditing, gating, and verifying itself
  against this exact `memory/` directory and this repository's `AUTHORITY.json`.

## What each test file proves

- `tests/oracle-plugin-contract.mjs` — the terminating oracle named by both
  `memory/CONTRACTS/plugin.json` and `verify-map.json`; it runs the five non-dogfood tests and
  avoids recursive self-verification without substituting an unrelated oracle.
- `tests/test-lib.mjs` — the vendored primitives (`canonicalize`, `sha256hex`, `contentAddress`,
  `finding`, `printFindings`) behave as specified.
- `tests/test-audit.mjs` — one passing fixture tree and one violating fixture tree per audit
  family (three-representation, taxonomy, query-freshness, mirror-sync, staleness) under
  `tests/fixtures/audit/`; every check is proven capable of both passing and failing.
- `tests/test-gate.mjs` — a passing answer set GRANTs, a wrong answer DENIES, a missing
  superseded-exclusion DENIES, and a drifted authority document makes the gate refuse to run.
- `tests/test-verify.mjs` — an all-green verify-map exits `0`; a failing oracle and a missing
  contract each exit `2`.
- `tests/test-init.mjs` — scaffolding is idempotent (a second run never overwrites) and starts
  every generated contract honestly at `SPECIFIED-PENDING-IMPLEMENTATION`, never `NORMATIVE-CURRENT`.
- `tests/test-dogfood.mjs` — the inheritance proof. It runs `auditAuthorityRoot` plus
  `auditMemoryDir` against this plugin's own `AUTHORITY.json` and `memory/` (not the deliberate
  violation fixtures under `tests/fixtures/`, which live outside this scope on purpose) and asserts
  zero `FAIL` findings; runs `gate.mjs` against `memory/comprehension-queries.json` and
  `memory/answers-example.json` and asserts `GRANTED`, then flips one answer and asserts `DENIED`;
  runs `verify.mjs` against `verify-map.json` and asserts all-green; and scans every script under
  `scripts/` to assert every import is `node:*` or a relative in-plugin path.
