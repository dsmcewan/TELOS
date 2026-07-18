# lachesis/memory

Institutional-memory record set for **Lachesis** — measures dependencies, relevance, risk, and blast radius
over a committed Clotho weave snapshot (read as data; never imports `clotho/`). Machine-first; human-rendered.

- `IDENTITY.md` — what Lachesis is + what it computes.
- `INVARIANTS.md` — the load-bearing invariants.
- `CONTRACTS/metrics.json` — NORMATIVE frozen metric + ingestion semantics; oracle = `scripts/test-metrics.mjs`.
- `NON-CLAIMS.md` — honest limits (identity, trust, boundary), several irreducible without crossing the spine.
- `DECISIONS/` — the affirmative cycle-1 decision (with authority triple) + rejected alternatives.
- `FAILURE-MODES.md` — how it fails, and that it fails closed.
- `EVIDENCE/` — pointers to the golden run + the code-review pipeline.
- `comprehension-queries.json` — reader-validation gate.

Run `npm test` in `lachesis/`: 100 assertions over the real snapshot (metrics discrimination + golden values +
source-profile boundary). Provenance of the build: `docs/runs/lachesis-1-workshop` (Daedalus, 10 rounds),
`docs/runs/lachesis-authorization-1` (TELOS council, authz-lachesis-1), `docs/runs/lachesis-argo-1`
(adversarial code review, 5 rounds → cycle-1 complete).
