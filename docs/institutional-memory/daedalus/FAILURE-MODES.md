---
type: reference
topic/architecture: telos
status: living
note: How Daedalus fails, on purpose. Every failure mode is a designed, fail-closed outcome with a stable identifier — none is an error to be "fixed" by weakening the check.
---

# Daedalus — failure modes (all fail-closed, all intentional)

| mode | trigger | outcome |
|---|---|---|
| **stalemate: repeated-candidate-hash** | unresolved objections + the candidate hash repeats a prior round's | terminal `needs-work`; the workshop does not loop on an unchanged plan |
| **stalemate: round-cap** | `DAEDALUS_MAX_ROUNDS` (6) reached without convergence | terminal `needs-work` |
| **invalid-provenance-round-discarded** | author/reviewer key missing, placeholder, or shared | the round is burned (state `continue`); it can never converge |
| **conflict → needs-eye** | a parallel verifier attests `violated` or lists conflicts | routed to The Eye; never blended into the candidate |
| **continue (parallel shortfalls)** | missing source/verification node, non-exact descent, incomplete matrix, coverage mismatch, reused provenance, unrecognized verdict | non-terminal; the orchestrator normalizes to human-review stalemate |
| **PARALLEL_AUTHORSHIP_UNAVAILABLE** | `authorship: "parallel"` requested, no `callParallelSeat` adapter injected | blocked at selection; no silent serial downgrade |
| **authorization refusal downstream** | TELOS blocks a converged candidate (authz-004 v11, authz-007 v14) | the plan version is recorded, superseded later, `must_not_govern_new_work` — the refusal is preserved, not erased |

**Interpretation rule for a future model:** if you meet one of these, the system is
working. The change path is `docs/institutional-memory/CHANGE-PROTOCOL.md` (escalate
to The Eye), not a patch that makes the failure stop happening.
