---
type: decision
topic/architecture: telos
status: NORMATIVE-CURRENT
note: The load-bearing boundary decision of the TELOS role, with its live precedent. Full treatment - docs/convergence-is-not-authorization.md (normative doc); this record anchors it into the role module.
---

# Decision: convergence is not authorization

**What.** Three distinct events that a model will conflate unless told not to:

1. **Convergence** — Daedalus seats stop objecting (terminal `submit`);
2. **Authorization** — the signed TELOS council + gate certify the frozen plan
   (`authz-N`, status `AUTHORIZED`);
3. **Implementation authority** — The Eye permits work to begin against it.

Each is necessary for the next; none implies the next.

**Live precedent (authz-007).** Plan v14 emerged from a converged Daedalus delta
(delta-13) integrating The Eye's own AM-41 ruling — and the authorization council
still refused it: codex returned `revise` because AM-41's blanket hashbang
exclusion contradicted Task 5's `weave.mjs` shebang requirement. One required
seat's dissent blocked, the contradiction was escalated, The Eye ruled the shebang
carve-out (delta-14), and only the corrected v15 was authorized (authz-008).
The refusal record is preserved at
`docs/runs/clotho-authorization-7/authorization-summary.json`.

**Why it matters for a future model.** The chain contains five refusals
(authz-001…004, 007). If you read only successes you will infer the gate is
ceremonial. It is not: the refusals are the trust model working, and the correct
response to a block is the change protocol (escalate to The Eye), never a patch
that makes the block stop happening.

**Anchors:** `docs/convergence-is-not-authorization.md` ·
`CONTRACTS/authorization-chain.json` · verify-contracts evidence probes
(authz-007 carries the codex-revise blocker; authz-008 carries dual enforcement).
