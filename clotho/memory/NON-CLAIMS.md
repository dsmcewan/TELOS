---
type: reference
topic: clotho
status: living
note: Human view of clotho/memory/NON-CLAIMS.json. Anti-claims prevent a confident model from promoting an adjacent concept into a capability that "sounds architecturally plausible."
---

# Clotho — non-claims (what it explicitly does NOT prove or provide)

- **`no-loader-containment`** — Clotho Phase 1 is **advisory / non-sandboxed**. It does
  **not** prove complete JavaScript loader analysis, loader isolation, or loader
  containment. The deterministic scanner (D27/D32) is a trusted-code **review signal**,
  not a capability boundary or sandbox. *(Authority: AM-35, AM-41; authz-008.)*
- **`not-a-js-parser`** — the shared D33 scanner is a **dependency-free lexical scanner**
  correct over a **closed source profile**, **not** a complete ECMAScript parser.
  Out-of-profile inputs are **refused** (fail closed), not parsed. *(Authority: AM-41;
  authz-008.)*
- **`not-committed-inventory-equality`** — Task 4a's generic scanner/ledger fixtures did not by
  themselves prove equality with committed inventories. Task 5 subsequently added
  that driver-level proof; the historical Task 4a result must not be retroactively
  overstated. *(Authority: D19; Task 5 delivered at `git:321473a`.)*
- **`test-weaver-executes-no-command`** — the test-weaver parses package `check`/`test`
  command strings only as text. It executes no command. *(Authority: D25.)*
- **`coverage-never-defaults-verified`** — query coverage is never optional and never
  defaults to `verified`; only a successfully verified manifest can establish that
  state. *(Authority: D35/AM-37.)*
- **`flagship-not-total-coverage`** — the flagship proves the Eye-reviewed eight-group
  expected set and closure equality. It does not prove that Clotho covers every module
  JavaScript could reach; unmatched neighborhood facts remain an unscored review set.
  *(Authority: D3/D33/AM-34.)*

A model approval is **not** human authority; a passing deterministic gate is **not** a
claim beyond what the gate checks; a successful scaffold does **not** prove Clotho
graph correctness.
