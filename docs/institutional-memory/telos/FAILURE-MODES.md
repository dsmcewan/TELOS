---
type: reference
topic/architecture: telos
status: living
note: How the TELOS role fails, on purpose. Every mode is a designed, fail-closed outcome; the change path is CHANGE-PROTOCOL.md, never a patch that silences the block.
---

# TELOS (role) — failure modes (all fail-closed, all intentional)

| mode | trigger | outcome |
|---|---|---|
| **Missing required packet** | claude/agy/codex packet absent | blocker `Missing required <model> approval packet.` — gate blocked |
| **Required-seat dissent** | decision !== `approve`, or non-empty `required_edits` | blocked; one dissent outweighs any convergence (authz-007) |
| **Signature invalid (signed mode)** | packet fails HMAC verification under its seat's secret | blocked — an unsigned or tampered packet never authorizes |
| **Provenance missing/placeholder (signed mode)** | no structured `response_id`, or a placeholder | blocked — a seat that cannot bind to a real response fail-closes |
| **Cross-seat id reuse (signed mode)** | two seats carry the same `response_id` | blocked — no seat borrows another's identity |
| **NOT_AUTHORIZED** | any of the above at authorization scope | run recorded and preserved (`authorization.status: NOT_AUTHORIZED`); superseded later, never erased |
| **Authority drift** | active plan bytes no longer hash to `CURRENT-AUTHORITY.json` | the comprehension gate refuses to certify ANY reader (`GATE_ERROR: AUTHORITY DRIFT`) |
| **Missing advisory key** | XAI/GEMINI key absent | **not a failure** — grok/gemini are advisory; the run proceeds and the gate is unaffected |

**Interpretation rule for a future model:** a block is the system working. Escalate
via `docs/institutional-memory/CHANGE-PROTOCOL.md` (The Eye) — do not weaken the
check that produced it.
