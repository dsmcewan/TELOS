---
type: reference
topic/architecture: telos
status: living
note: Human view of INVARIANTS.json — the loadout's load-bearing properties. Machine records are the source of truth; this file is rendered from them.
---

# Loadout — invariants

| id | invariant | oracle |
|---|---|---|
| `loadout-cannot-shadow-seats` | Council tool routes always win; a loadout server can never shadow a seat. | `test-seat-router.mjs`; verify-contracts shadow probe |
| `loadout-trust-routes-local` | `claude_ask` + `agy_checkpoint` stay on in-repo ai-peer-mcp; agy approval is local governance, never a model call. | `test-seat-registry.mjs`; verify-contracts route deep-check |
| `loadout-router-fail-closed` | An unrouted tool throws before any spawn; unregistered namespaced servers fail closed. | `test-seat-router.mjs` |
| `loadout-capability-gate-fail-closed` | Missing capabilities must be surfaced; the gate blocks a build that quietly lacks its tools. | `test-gate.mjs`/`test-trust.mjs` + `examples/capability-blocked/` |
| `loadout-per-task-review` | Every pending slice has a `TASK-LOADOUTS` review record, read at slice start. | verify-contracts file-exists per pending slice |

All are `NORMATIVE-CURRENT`. Machine contracts:
`CONTRACTS/seat-backends.json` and `CONTRACTS/capability-packet.json`.
