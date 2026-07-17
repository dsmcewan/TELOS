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
- **`not-committed-inventory-equality`** — Task 4a validates generic scanner/ledger
  integrity against **injected fixtures only**; equality with committed inventories is
  the **Task 5 driver's** job. *(Authority: D19.)*
- **`no-orchestrator-yet`** — Task 4a commits only the **git and code** weaver
  inventories/closures (D17/AM-17). The test/doc/ledger weavers, the orchestrator
  inventory, atomic publication (D20/D28), and D34 re-derivation are **later tasks
  (4b/5)** — absent and unclaimed here.

A model approval is **not** human authority; a passing deterministic gate is **not** a
claim beyond what the gate checks; a successful scaffold does **not** prove Clotho
graph correctness.
