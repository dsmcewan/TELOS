---
type: reference
topic/architecture: telos
status: living
note: Rendered human projection of the Daedalus role-module machine records. The JSON records are the source of truth; if this file disagrees with them, the records win.
---

# Daedalus — role module (institutional memory)

**Registered meaning:** *collaboratively matures implementation plans*
(`docs/mythological-vocabulary.md`). This directory is the Daedalus succession
interface: what a memoryless future model must load before touching plan-maturation
code or workflow.

## Load order (agentic reader)

1. `IDENTITY.md` — what Daedalus owns / does not own + the artifact map.
2. `CONTRACTS/workshop-protocol.json` — the protocol constants and state machine,
   machine-verified against `build-gate/daedalus.mjs`.
3. `CONTRACTS/plan-version-chain.json` — the hash-anchored maturation lineage
   (v11→v15), machine-verified against disk + `CURRENT-AUTHORITY.json`.
4. `INVARIANTS.json` / `NON-CLAIMS.json` — load-bearing properties and the
   capabilities Daedalus does NOT have.
5. `DECISIONS/` — `parallel-authorship.md` (the forward methodology and its
   evidentiary basis) and `rejected-alternatives.md` (found-and-fixed defects; do
   not rediscover them as improvements).
6. `FAILURE-MODES.md` — every failure is designed and fail-closed.
7. `EVIDENCE/delta-chain.json` — navigation index of all 15 run directories.

## Prove comprehension

```
node docs/institutional-memory/comprehension-gate.mjs \
  docs/institutional-memory/daedalus/comprehension-queries.json <your-answers.json>
```

Example runs: `docs/institutional-memory/examples/reader-daedalus-correct.json`
passes; `reader-daedalus-hallucinating.json` — which answers "convergence
authorizes" and "claude owns constraints" — is **denied**.

## Verify records == reality

```
node docs/institutional-memory/verify-contracts.mjs   # deep-equals contracts vs code; re-hashes the plan chain
cd build-gate && npm test                              # test-daedalus.mjs + test-proposal-orchestrator.mjs
```

## The one-sentence version

Daedalus produces candidates; TELOS authorizes them; The Eye rules; Argo implements
— and a converged workshop has been **refused** authorization twice (v11, v14),
which is why you must never read convergence as authority.
