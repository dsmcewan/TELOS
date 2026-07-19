# ai-native-memory — evidence

Pointers to the oracle runs and fixtures that back this record set's claims. Nothing here is a
substitute for running the oracles yourself — this is an index, not a cache of results.

## Where to run the checks

- `cd ai-native-memory && npm run check` — syntax pass (`node --check`) over every script.
- `cd ai-native-memory && npm test` — runs every `tests/test-*.mjs` file via `tests/run.mjs`,
  including `tests/test-dogfood.mjs`, which is the plugin auditing, gating, and verifying itself
  through the public commands against the whole plugin root and its `CURRENT-AUTHORITY.json`.

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
- `tests/test-dogfood.mjs` — the inheritance proof. It invokes the public
  `scripts/audit.mjs` command against the whole plugin root and requires a clean exit; invokes
  `gate.mjs` against `memory/comprehension-queries.json`,
  `memory/answers-example.json`, and `CURRENT-AUTHORITY.json`, then requires the passing answers to
  GRANT and one flipped answer to DENY; invokes `verify.mjs` against `verify-map.json` and requires
  all declared contract oracles to pass; and scans static, side-effect, and string-literal dynamic
  imports in every script under `scripts/`, allowing only `node:*` or relative in-plugin paths.
