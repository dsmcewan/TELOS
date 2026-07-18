# Lachesis — invariants

1. **Measures only.** No authorization, enforcement, retirement, weaving, or rendering. Risk class is ADVISORY.
2. **Spine boundary.** Never imports `clotho/`. The only sanctioned cross-package import is
   `merkle-dag/vendor.mjs` (`canonicalize`/`sha256hex`), enforced by `scripts/test-boundary.mjs`.
3. **Zero runtime dependencies.** `package.json` `dependencies` is empty; Node stdlib (`node:`) + the one
   sanctioned vendor only.
4. **Fail-closed ingestion.** Any anomaly throws the whole load; no partial weave reaches measurement. Digest
   pin + canonical-JSON + closed sets + structure + locator↔id bijection.
5. **Reality-anchored.** Metric semantics are pinned to golden values from the committed snapshot; a `from`/`to`
   orientation swap breaks the oracle.
6. **Honest limits.** Every trust/identity property Lachesis does NOT establish is an explicit NON-CLAIM, not a
   silent gap (see `NON-CLAIMS.md`).
