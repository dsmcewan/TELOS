---
type: reference
topic/architecture: telos
status: living
note: Rendered human projection of the Argo role-module machine records. The JSON records are the source of truth; if this file disagrees with them, the records win.
---

# Argo — role module (institutional memory)

**Registered meaning:** *carries an authorized plan through implementation,
verification, and documentation* (`docs/mythological-vocabulary.md`). This
directory is the Argo succession interface — the workflow every future
implementer inherits, starting with the entry ritual.

## Load order (agentic reader)

1. `IDENTITY.md` — what Argo owns / does not own; **no autonomous runner**.
2. `CONTRACTS/implementation-protocol.json` — entry ritual, slice path, and the
   **dissent asymmetry** (the most misread precedent pair in the repo).
3. `CONTRACTS/accepted-slices.json` — the honest ledger of what has landed.
4. `INVARIANTS.json` / `NON-CLAIMS.json` — including the open-book caveat on the
   comprehension gate itself.
5. `DECISIONS/slice-4a-acceptance.md` — The Eye's stopping rule; do not "fix" the
   asymmetry. `DECISIONS/rejected-alternatives.md`.
6. `FAILURE-MODES.md` — DENIED is the system working.
7. `EVIDENCE/impl-runs.json` — slice evidence navigation.

## Prove comprehension

```
node docs/institutional-memory/comprehension-gate.mjs \
  docs/institutional-memory/argo/comprehension-queries.json <your-answers.json>
```

Example runs: `docs/institutional-memory/examples/reader-argo-correct.json`
passes; `reader-argo-hallucinating.json` — which believes an Argo service exists
and that a GRANTED artifact is authority — is **denied**.

## Verify records == reality

```
node docs/institutional-memory/verify-contracts.mjs   # executes the entry ritual both ways; re-checks the slice ledger
```

## The one-sentence version

Argo is the disciplined walk from an authorized plan to accepted code — gated at
entry by proven comprehension, at every slice by a deterministic gate and a signed
council, and at the end by The Eye alone.
