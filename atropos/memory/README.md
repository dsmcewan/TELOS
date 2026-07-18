# atropos/memory
Institutional-memory record set for **Atropos** — read-only supersession consistency verifier. Machine-first.
- `IDENTITY.md` · `INVARIANTS.md` · `CONTRACTS/supersession.json` (NORMATIVE, oracle = `scripts/test-verify.mjs`)
- `NON-CLAIMS.md` (read-only; node-backed deferred; not a sandbox) · `DECISIONS/` · `FAILURE-MODES.md`
- `EVIDENCE/` · `comprehension-queries.json`
`npm test` in `atropos/`: 31 assertions over the real CURRENT-AUTHORITY (verify + read-only oracle).
Provenance: `docs/runs/atropos-1-workshop/` (Daedalus, 13 rounds; drift analysis: the CHANGE-PROTOCOL-applicability
objection was reviewer drift on a ruled point).
