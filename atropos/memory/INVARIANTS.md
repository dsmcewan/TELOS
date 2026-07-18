# Atropos — invariants
1. **Read-only.** No fs write/mutation APIs in the runtime; enforced by `scripts/test-readonly.mjs`.
2. **Spine boundary.** Never imports `clotho/`; only sanctioned non-node import is `merkle-dag/vendor.mjs`.
3. **Zero runtime dependencies.**
4. **Fail-closed.** File-level anomalies throw; malformed individual entries → `inconsistent` verdict, never silent-skip.
5. **Reality-anchored.** The verdict is oracled against the real 4 `#superseded` entries (v11–v14 → v15) + per-defect negatives.
6. **Honest limits.** Node-backed retirement deferred as `UNREPRESENTABLE`; every gap is a NON-CLAIM, not a silent pass.
