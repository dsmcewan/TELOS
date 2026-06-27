---
title: "Applying ENGINE.patch — TELOS Upgrade (for Codex)"
author: claude-code
last-edited-by: claude-code
last-edited-at: 2026-06-27
type: handoff
tags:
  - type/handoff
  - model/codex
  - workflow/build-gate
---

# Applying ENGINE.patch (Codex)

These engine changes were authored by **claude-code** in a staging copy
(`me/claude-code/telos-upgrade/engine/working/`) and must be merged into
`me/codex/` by **Codex**, per the vault ownership boundary (`CLAUDE.md`:
claude-code reads `me/codex/` but does not edit it). Each change was implemented
TDD-style and passed an independent task review; see `.sdd-progress.md` for the
per-task ledger and the Minor-findings list for final triage.

## What changed (16 files)

**`me/codex/build-gate/`**
- `gate.mjs` — MODIFIED: signed-mode (`trust_mode: "signed"`) signature verification, provenance promoted from warn → blocker, and `meets` sufficiency checks. All new behavior is gated behind `signed`; legacy dossiers are byte-identical.
- `sign.mjs` — NEW: per-model HMAC-SHA256 packet signing (`canonicalize`/`signPacket`/`verifyPacket`/`secretFor`).
- `council.mjs` — NEW: dynamic-workflow council orchestrator (`planSeats` per-job sizing, `maxConcurrency` CPU-bounded pool, `runCouncil`, `liveSeatCaller`).
- `package.json` — MODIFIED: `test` now also runs `test-sign`, `test-trust`, `test-council-orchestrator`, `stress-tests.mjs`, and the breakout suite (`npm --prefix ../breakout test`). Fixes bug #5b.
- `scripts/test-sign.mjs`, `scripts/test-trust.mjs`, `scripts/test-council-orchestrator.mjs` — NEW tests.
- `scripts/test-gate.mjs` — MODIFIED: script-relative fixture paths (`ex()` helper) so it runs from any ancestor CWD. Fixes bug #5a.

**`me/codex/breakout/`**
- `verifier.mjs` — MODIFIED: `reverifyRecord` now also returns `hasFileContains` + `emptyEvidenceFiles` (additive; existing fields unchanged) — consumed by the gate's sufficiency checks.
- `scripts/test-verifier.mjs` — MODIFIED: appended sufficiency-signal tests.

**`me/codex/connectors/ai-peer-mcp/`** — codex/agy provenance backends (so the council's `codex` and `agy` seats carry their OWN real provenance instead of borrowing claude's `response_id`):
- `lib.mjs` — MODIFIED (additive): `extractOpenAIResult` (codex; OpenAI-compatible) sharing `extractChatCompletionResult` with Grok; `agyAttestation` + `stableStringify` + `AGY_ENGINE_VERSION` — a content-addressed, local-deterministic attestation for the keyless agy seat.
- `server.mjs` — MODIFIED: new `codex_ask` tool backed by `askCodex` (OpenAI Chat Completions; `OPENAI_API_KEY` / `OPENAI_MODEL` / `OPENAI_BASE_URL`; fail-closed without the key); the `*_ask` tools take an opt-in `include_provenance` flag that returns a `{text, provenance}` envelope (default stays raw prose — `breakout/live.mjs`'s contract is untouched); `agy_checkpoint` now embeds its attestation as `provenance`; `mapModelName` resolves bare `codex`/`gpt` → `gpt-4o`.
- `scripts/test-provenance.mjs` — MODIFIED: `extractOpenAIResult` + `agyAttestation` cases (deterministic, content-addressed, non-placeholder, key-order independent).
- `scripts/smoke-test.mjs` — MODIFIED: asserts `codex_ask` is listed and that `agy_checkpoint` carries a local-deterministic attestation.
- `package.json` — MODIFIED: description adds Codex; adds a `test` script (`npm run check && smoke-test`).
- `README.md` — MODIFIED: documents the fifth tool (`codex_ask`), the `include_provenance` envelope, the agy attestation, and the `OPENAI_API_KEY` / `OPENAI_MODEL` requirements.

The matching consumer wiring is in `build-gate/council.mjs` (`liveSeatCaller`, above): codex → `codex_ask` (real OpenAI id), agy → `agy_checkpoint` (local attestation), with provenance precedence `structured → prose-scan → null` (null ⇒ the gate blocks; no fabricated ids).

## Option A — apply the patch (recommended)

From `me/claude-code/telos-upgrade/engine/`:

```bash
# the patch paths are pristine/... -> working/...; strip 2 leading components
# so they land on me/codex/{build-gate,breakout}/...
patch -p1 -d "../../../codex" < ../ENGINE.patch
```

If `patch`'s `pristine/`/`working/` prefixes don't strip cleanly, use Option B.

## Option B — copy the modified files

Copy each file above from `me/claude-code/telos-upgrade/engine/working/<path>`
over its `me/codex/<path>` counterpart (10 files).

## Verify after merge (must be green)

```bash
cd me/codex/build-gate          && npm test   # exit 0: gate, sign, trust, council, stress x2, + breakout
cd ../breakout                  && npm test   # exit 0: breakout suites incl. verifier sufficiency
cd ../connectors/ai-peer-mcp    && npm test   # exit 0: check (win32/stress/provenance) + keyless smoke
```

> Run these from inside the V4 vault. `build-gate/scripts/stress-tests.mjs`
> contains a protected-path test that hard-codes the vault's absolute
> `…/V4/CHATGPT/…` path; it only resolves as "blocked" when the suite runs
> within V4 (pre-existing; not part of this change).

The new behavior is **opt-in** via `trust_mode: "signed"`. Any existing dossier
without that flag behaves exactly as before (verified: the `examples/self`
dogfood and `examples/market-pass` still pass with zero new blockers/warnings).

## Note on `signed_fields` / secrets

Signed mode requires per-model HMAC secrets in the environment:
`TELOS_SECRET_CLAUDE`, `TELOS_SECRET_AGY`, `TELOS_SECRET_CODEX`. These are the
local integrity floor (keyless — not API keys). Provenance binding additionally
requires a real `response_id` from a live model call (see the live capture in
`me/claude-code/telos-upgrade/runs/live-capture/`).

**Per-seat provenance backends (this delivery).** Each council seat now binds to
its own real provenance:
- `claude` / `grok` — Anthropic / xAI APIs (`ANTHROPIC_API_KEY` / `XAI_API_KEY`).
- `codex` — OpenAI Chat Completions (`OPENAI_API_KEY`, optional `OPENAI_MODEL` /
  `OPENAI_BASE_URL`). Without the key, `codex_ask` throws → the seat produces no
  signed packet → the gate honest-blocks codex (it never borrows another model's
  id).
- `agy` — keyless. `agy_checkpoint` is a local deterministic tool; its provenance
  is a content-addressed attestation (`response_id = "agy-" + sha256(checkpoint)`),
  reproducible by anyone, so it needs no API key.
