---
type: reference
topic/architecture: telos
status: living
note: Human view of INVARIANTS.json — the Argo role's load-bearing properties. Machine records are the source of truth; this file is rendered from them.
---

# Argo — invariants

| id | invariant | oracle |
|---|---|---|
| `argo-comprehension-before-implementation` | No implementation authority until the comprehension gate exits 0; the gate refuses everyone under authority drift. | verify-contracts **executes** the gate (correct → 0, hallucinating → 3) |
| `argo-eye-acceptance-required` | A slice lands only via The Eye's acceptance, recorded with PR + merge anchor + reviewed head. | verify-contracts deep-eq with `CURRENT-AUTHORITY.json` |
| `argo-slice-review-signed` | Slice reviews run the signed council with the required trio (13 recorded rounds for 4a). | verify-contracts evidence probe (round-13 record) |
| `argo-slice-gate-meets-before-review` | The deterministic slice gate must converge at `meets`; approval never substitutes. | verify-contracts evidence probe (`gate-result.json`) |
| `argo-deferred-backlog-recorded` | Deferred minors are committed artifacts, never silent. | verify-contracts file-exists check |
| `argo-pending-slices-specified` | Every pending slice has a frozen substrate + per-task queries before code. | verify-contracts file-exists checks |

All are `NORMATIVE-CURRENT`. Machine contracts:
`CONTRACTS/accepted-slices.json` and `CONTRACTS/implementation-protocol.json`.
