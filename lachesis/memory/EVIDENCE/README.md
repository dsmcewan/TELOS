# Lachesis — evidence

- **Oracle:** `lachesis/scripts/test-metrics.mjs` + `test-boundary.mjs` — `npm test` → 100 assertions over the
  real committed snapshot (`docs/runs/clotho-self-weave/thread-ledger.snapshot.jsonl`,
  raw-byte `sha256:ea3ca462790c09ed3fe17463feb27b6983a24174e2632f9d72eb82298c2f769f`).
- **Daedalus workshop (plan):** `docs/runs/lachesis-1-workshop/` — 10 adversarial rounds → converged rev10.
- **TELOS authorization:** `docs/runs/lachesis-authorization-1/` — live 5-seat council, `authz-lachesis-1`,
  all seats approve, gate pass (ephemeral signers; real provenance).
- **Argo adversarial code review:** `docs/runs/lachesis-argo-1/` — 5 rounds vs. the REAL implementation;
  `decision-round-3-result.json` (GPT-seat rulings, delegated by The Eye); `ARGO-BLOCKED-schema-mismatch.md`
  (the plan-vs-reality block that redirected to reality-first coding).
