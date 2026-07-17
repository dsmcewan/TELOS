---
type: reference
topic/architecture: telos
status: living
note: Human view of INVARIANTS.json — the TELOS role's load-bearing properties. Machine records are the source of truth; this file is rendered from them.
---

# TELOS (role) — invariants

| id | invariant | oracle |
|---|---|---|
| `telos-fail-closed-authorization` | Absent/ambiguous evidence blocks; five of eight recorded runs refused, and every refusal is preserved. | `test-gate.mjs`, `test-trust.mjs`; verify-contracts chain re-check |
| `telos-signed-mode-dual-enforcement` | Signed mode enforces **both** HMAC signature and real provenance as blockers; cross-seat id reuse blocks. All eight runs ran signed. | `test-trust.mjs`; verify-contracts evidence probe (authz-008) |
| `telos-required-trio` | claude/agy/codex packets are gate-required; a missing one blocks. | `test-gate.mjs`; verify-contracts `planSeats` probe |
| `telos-advisory-never-blocks` | grok/gemini are advisory; a missing external key never blocks. | `test-council-orchestrator.mjs`; verify-contracts `planSeats` probe |
| `telos-dissent-blocks` | One required seat's `revise`/`required_edits` blocks regardless of other approvals (authz-007 precedent). | `test-gate.mjs`; verify-contracts evidence probe (authz-007) |
| `telos-refusals-preserved` | NOT_AUTHORIZED records are retained + superseded, never rewritten. | verify-contracts chain re-check |

All are `NORMATIVE-CURRENT`. Machine contracts:
`CONTRACTS/authorization-chain.json` and `CONTRACTS/authorization-protocol.json`.
