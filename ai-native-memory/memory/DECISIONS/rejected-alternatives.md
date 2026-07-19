# ai-native-memory — rejected alternatives

Preserved so a successor does not rediscover these as novel ideas and re-litigate them.

## Reserved-namespace naming, exported

**Rejected.** The source standard this plugin generalizes was proven inside a project that uses a
reserved mythological vocabulary (Clotho, Lachesis, Atropos, The Eye, and so on) for its own
architectural identifiers. The plugin could have exported those names as its public vocabulary.
It does not: the plugin speaks in plain, portable language (`AUTHORITY`, `INVARIANTS`,
`CONTRACTS`, `comprehension-queries`) so any host repository can adopt it without inheriting a
naming scheme that means something specific and different at home. A host repository remains free
to layer its own names on top of the plugin's plain-language primitives.

## Trusting a model's self-report of comprehension

**Rejected.** An earlier shape of this idea let a model simply assert "I have read and understood
X" as the gate for implementation authority. That is exactly the failure mode this whole project
exists to close everywhere else (build-gate's core rule: never certify from a model's self-report).
`gate.mjs` instead grades structured answers against `expected` values that are themselves
mechanically derived from the machine contracts (`derived_from`), and DENIES on any mismatch,
missing acknowledgment, or unresolved superseded authority.

## Authenticating authority documents instead of only pinning their hash

**Rejected, for this version.** `AUTHORITY.json` could attempt to verify a signature or a
publisher identity for the active governing document. It does not — it pins by content hash only
(`sha256:` of raw bytes), which detects drift but not forgery of provenance. This is recorded
explicitly as a non-claim (`anm-no-authority-authentication`) rather than silently under-scoped;
adding real authentication is future work, not a hidden gap.

## Letting `/memory-verify`'s oracle for the plugin's own contract point at the full test suite

**Rejected.** The plugin's own `CONTRACTS/plugin.json` is most naturally verified by
`tests/run.mjs`, the full suite. But `run.mjs` spawns every `tests/test-*.mjs` file, including
`test-dogfood.mjs` — and `test-dogfood.mjs` itself calls `verify.mjs` against `verify-map.json`.
Pointing `verify-map.json`'s oracle at `run.mjs` would make that self-verify step recurse into a
process that (transitively) re-invokes itself. Instead `verify-map.json` points at
`tests/test-lib.mjs`, a real, terminating, zero-dependency oracle, and `plugin.json` records in its
body that the full suite remains the CI entry point for the contract as a whole.
