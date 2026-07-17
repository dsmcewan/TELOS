---
type: reference
topic/architecture: telos
status: living
note: How the Argo role fails, on purpose. Every mode is a designed, fail-closed outcome; the change path is CHANGE-PROTOCOL.md, never a patch that silences the block.
---

# Argo — failure modes (all fail-closed, all intentional)

| mode | trigger | outcome |
|---|---|---|
| **COMPREHENSION_FAILED / DENIED** | a reader answers from priors instead of the records | exit 3; no implementation authority; the failure artifact lists every wrong answer with its authority anchor |
| **GATE_ERROR: AUTHORITY DRIFT** | active plan bytes no longer hash to `CURRENT-AUTHORITY.json` | exit 1; the gate refuses to certify ANY reader until the authority record matches reality |
| **Slice gate below `meets`** | a claimed artifact/fact fails disk re-verification | slice cannot proceed to acceptance; reviewer approval never substitutes |
| **Review dissent** | a required seat returns `revise` | more rounds, or The Eye bounds it (stopping rule + recorded backlog) — the implementer never overrides a seat |
| **Scope ambiguity discovered mid-slice** | the frozen plan contradicts itself or reality | STOP; escalate to The Eye (change protocol); do not design around it (AM-40/AM-41 are the precedents) |
| **Deferred backlog ignored** | minors from an acceptance never revisited | violation of the stopping rule's second half; the backlog is a commitment, not a graveyard |

**Interpretation rule for a future model:** a DENIED artifact or a blocked slice is
the system working. Re-read the records and answer from them — or escalate — never
weaken the gate.
