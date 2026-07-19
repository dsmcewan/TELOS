# ai-native-memory — invariants (rendered)

Rendered projection of `INVARIANTS.json`. Machine records are the source of truth; regenerate this
file when the JSON changes — do not hand-edit facts here.

- **anm-zero-dependencies** — the plugin declares no runtime dependencies and every oracle imports
  only `node:*` stdlib modules or in-plugin relative paths. Oracle: `tests/test-dogfood.mjs`.
- **anm-fail-closed-exits** — every oracle (`audit.mjs`, `gate.mjs`, `verify.mjs`) exits nonzero on
  missing or unverifiable evidence; nothing silently passes. Oracle: `tests/run.mjs` (runs
  `test-gate.mjs` and `test-audit.mjs`, among others).
- **anm-no-host-imports** — no script under `scripts/` imports from a host repository's packages;
  every import is `node:*` or a relative in-plugin path. Oracle: `tests/test-dogfood.mjs`.
- **anm-every-check-can-fail** — no audit check ships without a fixture proving it can fail; every
  audit family has a violation fixture the check actually flags. Oracle: `tests/test-audit.mjs`.
