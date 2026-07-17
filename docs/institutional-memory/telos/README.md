---
type: reference
topic/architecture: telos
status: living
note: Rendered human projection of the TELOS role-module machine records. The JSON records are the source of truth; if this file disagrees with them, the records win.
---

# TELOS (role) — role module (institutional memory)

**Registered meaning:** *governs review, evidence, authorization, and execution
boundaries* (`docs/mythological-vocabulary.md`). This directory is the TELOS role's
succession interface — and note immediately: **the role is not the repo** (see
`IDENTITY.md`).

## Load order (agentic reader)

1. `IDENTITY.md` — role vs repo disambiguation; owns / does-not-own; artifact map.
2. `CONTRACTS/authorization-protocol.json` — required trio, advisory rule,
   signed-mode dual enforcement, dissent rule, the human boundary.
3. `CONTRACTS/authorization-chain.json` — authz-001…008 with outcomes; five
   refusals preserved.
4. `INVARIANTS.json` / `NON-CLAIMS.json`.
5. `DECISIONS/convergence-is-not-authorization.md` — the boundary decision and the
   authz-007 precedent; `DECISIONS/rejected-alternatives.md`.
6. `FAILURE-MODES.md` — a block is the system working.
7. `EVIDENCE/authz-runs.json` — run-directory navigation index.

## Prove comprehension

```
node docs/institutional-memory/comprehension-gate.mjs \
  docs/institutional-memory/telos/comprehension-queries.json <your-answers.json>
```

Example runs: `docs/institutional-memory/examples/reader-telos-correct.json`
passes; `reader-telos-hallucinating.json` — which answers "consensus authorizes"
and "grok is required" — is **denied**.

## Verify records == reality

```
node docs/institutional-memory/verify-contracts.mjs   # chain records re-checked; planSeats probed; refusal evidence asserted
cd build-gate && npm test                              # gate, trust, council oracles
```

## The one-sentence version

TELOS certifies from disk + signatures + provenance — never a self-report — and it
has refused five of eight authorization attempts, including one converged plan on a
single required seat's dissent; those refusals are the trust model, demonstrated.
