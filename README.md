# TELOS

A multi-model build-gate. Independent AI model **seats** (claude / grok / codex / agy)
each produce an approval packet; a deterministic **gate** certifies merge-readiness
from disk + signatures + provenance — never from a model's self-report.

## Components

- **`build-gate/`** — the gate (`gate.mjs`), per-model HMAC signing (`sign.mjs`), and
  the dynamic-workflow council orchestrator (`council.mjs`: per-job seat sizing +
  CPU-bounded fan-out + `liveSeatCaller`).
- **`breakout/`** — self-challenge with verdict-on-facts (`verifier.mjs`, `live.mjs`)
  and a minimal MCP stdio client (`mcp_client.mjs`).
- **`connectors/ai-peer-mcp/`** — MCP server exposing the model backends
  (`claude_ask` / `grok_ask` / `codex_ask` / `agy_checkpoint`) with **real per-seat
  provenance**.
- **`merkle-dag/`** — content-addressed planning + verified delegation + a pure
  `done()` evaluator (`ledger-gate.mjs`): immutable `plan.json`, append-only signed
  `ledger.jsonl`, Ed25519 settlement, forward-invalidation by hash.

## Trust model (fail-closed)

- Each required seat's packet is **HMAC-signed** and carries **real provenance**:
  the server-issued response id for remote models (claude/grok/codex), or a
  content-addressed **local attestation** (`agy-<sha256>`) for the deterministic
  agy seat. No structured provenance ⇒ `response_id: null` ⇒ the gate blocks. No
  seat borrows or fabricates another's id.
- Under `trust_mode: "signed"` the gate enforces **both** the signature and the
  provenance as blockers. The gate always re-reads disk ground truth.
- **Secrets live outside the repo** (env / OS registry): `ANTHROPIC_API_KEY`,
  `XAI_API_KEY`, `OPENAI_API_KEY`, and the `TELOS_SECRET_*` HMAC secrets. Runtime
  `.telos/` artifacts (plan/ledger) are created ephemerally in the build tree.

## Test

Node ≥ 18, zero runtime dependencies.

```bash
cd build-gate           && npm test    # gate, sign, trust, council, stress + breakout
cd breakout             && npm test
cd connectors/ai-peer-mcp && npm test
cd merkle-dag           && npm test
```

## Docs & evidence

- `docs/STATUS.md` — current status.
- `docs/specs/`, `docs/plans/` — design spec + implementation plan.
- `docs/runs/live-council/` — a real council run: distinct per-seat provenance,
  fail-closed without a key, and a signed-mode pass (signature + provenance both
  enforced).
- `contracts/` — the human-readable protocol the gate enforces.
- `docs/delivery/ENGINE.patch` — how the provenance-backend upgrade was delivered
  into the live deployment.

## Provenance / layout note

Extracted from a larger multi-model vault, where the live deployment runs under a
`me/codex/` tree wired into an MCP client. `validateProtectedPaths` derives its
root from the deployment layout; in this standalone repo the engine is primarily a
reference + evidence artifact. Authored by `claude-code`.
