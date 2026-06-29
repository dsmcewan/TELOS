# ai-forge RAG pattern — evidence run

## What this proves

Running `node docs/runs/ai-forge-rag/run.mjs` drives the **RAG pattern** through
the full ai-forge lifecycle — pattern validation → plan → generate → per-workstream
breakout (verdict-on-facts) → market gate — and produces `run-summary.json` with
`converged: true`.

Concretely it demonstrates:

- **Pattern-library-driven forge works end-to-end.** The RAG pattern (7 workstreams:
  `ingestion`, `embed-index`, `retrieval`, `generation`, `eval-harness`, `guardrails`,
  `ops`) is expressed as data; `ai-forge/forge.mjs` drives it to `merge_status: ready`
  over the unchanged TELOS trust spine.
- **Real gate + real Ed25519 ledger + real merkle-dag.** No mocks in the critical
  path — `validateRecords`, `computePlan`, `runBuild`, and the content-addressed
  ledger all run against the actual implementations.
- **Every workstream survives adversarial breakout on facts.** Each workstream's
  breakout checks against its artifact on disk (`finalStatus: "meets"` for all 7).
- **Keyless and deterministic.** No API keys, no network, no timestamps. The run
  produces identical output on every machine and in CI.
- **Live boundary available.** Network-dependent operations (real embeddings, vector
  store, LLM calls) are gated behind `ai-forge/live.mjs`; the evidence run uses the
  deterministic keyless path.

## How to re-run

```bash
node docs/runs/ai-forge-rag/run.mjs
# prints converged=true merge_status=ready gate_status=pass
```

The committed `run-summary.json` is the output of this command.

## Files

| File | Purpose |
| --- | --- |
| `run.mjs` | Imports `forge` + `ragPattern` + `ragContext`; runs into `os.tmpdir()` |
| `run-summary.json` | Sanitized output — no absolute paths, secrets, or timestamps |
| `README.md` | This file |
