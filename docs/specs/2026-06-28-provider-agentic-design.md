---
title: "Provider-Native Agentic Seats — Structured Outputs + Strengths + Gemini (design)"
author: claude-code
date: 2026-06-28
type: spec
tags:
  - topic/agentic-teams
  - workflow/build-gate
---

# Provider-Native Agentic Seats (design)

## Problem

TELOS called every model the same way and scraped JSON out of prose with a regex —
using none of each provider's agentic features, and brittle. The functional point
of a multi-model council is to **place each model where it is strongest and prompt
it in the mode it does best**; that wasn't encoded anywhere.

## Three changes

### 1. Structured JSON output (per provider's native mechanism)
TELOS's three contracts are authored once as strict-mode JSON Schemas
(`build-gate/schemas.mjs`: `APPROVAL_PACKET_SCHEMA` — judgment only, identity
omitted; `DECOMPOSE_TASKS_SCHEMA` — `{tasks:[…]}`; `BUILD_FILESET_SCHEMA`) and
**passed as data** into the `*_ask` call (so `ai-peer-mcp` never imports
build-gate). The server translates a provided schema into each provider's native
form: OpenAI/xAI `response_format:{type:"json_schema",json_schema:{name,strict:true,
schema}}`; Anthropic a forced single tool call (`tools`+`tool_choice`, JSON =
`tool_use.input`, extracted by `extractAnthropicStructuredResult` and
`JSON.stringify`-ed to keep the `{text,provenance}` envelope stable); Gemini
`generationConfig.responseMimeType+responseSchema`. No schema ⇒ today's plain-text
behavior (backward compatible). Parsers (`parseApprovalPacket`,
`parseDecomposeTasks`, `parseTeamFiles`) now parse clean JSON with the regex
`extractJson` retained as a fail-closed fallback.

### 2. Play to each model's strengths (the organizing principle)
`build-gate/model-profiles.mjs` (`MODEL_PROFILES`) records each model's
strengths/weaknesses/preferred_roles, grounded in each provider's agentic guidance.
It drives:
- **Placement** — `teams.mjs` leads are strength-matched (a `test-teams` assertion
  checks every lead's role is in its `preferred_roles`): claude → planning /
  architecture / frontend; codex → backend, **evals** (lead changed claude→codex:
  acceptance tests are a code-gen + strict-output task); grok → security, breakout,
  **business** (lead changed claude→grok: live market/competitive intel); agy → ops;
  gemini → integrity. Each multi-seat team pairs a strength-matched lead with a
  complementary member.
- **Prompts** — `PROVIDER_PROFILES`/`profileFor` frames each seat's system prompt to
  invoke its strength (grok = "be the adversary", gemini = "re-derive, don't trust",
  claude = "architect rigorously", codex = "implement precisely") rather than just
  repeating a format instruction.

### 3. New Gemini seat (the callable side of Antigravity)
A `gemini_ask` backend (`askGemini` + `extractGeminiResult`, `GEMINI_API_KEY`,
`x-goog-api-key`, `:generateContent`) added additively. Gemini **leads a new
`integrity` verification team** (independent re-derivation; always convened, like
breakout) and rides as **council advisory** in `planSeats` — never gate-required
(`REQUIRED_SEATS`/`REQUIRED_MODELS` unchanged), so a missing GEMINI key never blocks.

## Trust invariants (unchanged)
Structured output is **reliability, not trust**: the gate still re-validates packet
shape and injects identity from the dossier (the approval schema omits identity so a
model can't self-assert it); **provenance still comes from the real API response**
(`json.model/json.id`; Gemini `modelVersion/responseId`), never the schema'd
content; the `{text,provenance}` envelope is byte-stable so `liveSeatCaller` is
untouched; no-key seats fail-closed. No change to `sign.mjs`, gate decision logic, or
`merkle-dag`. The only `gate.mjs`-adjacent risk (advisory Gemini's honest-null id)
is safe precisely because Gemini is never required.

## Files
- **New:** `build-gate/model-profiles.mjs`, `build-gate/schemas.mjs`,
  `build-gate/scripts/test-schemas.mjs`, `connectors/ai-peer-mcp/scripts/test-structured-requests.mjs`.
- **Edit:** `connectors/ai-peer-mcp/server.mjs` (+`lib.mjs`) — schema args, 3 backend
  translations, `askGemini`, extractors, `mapModelName`, main-guard + exported ask
  fns for unit testing; `build-gate/teamPrompts.mjs` (profiles + schema passthrough +
  `ASK_MODELS`+gemini), `council.mjs` (`liveSeatCaller` forward + gemini advisory),
  `teams.mjs` (strength-driven roster + `integrity` + `ALWAYS_ON`); both `package.json`.

## Verification
- `cd connectors/ai-peer-mcp && npm test` (exit 0; `test-structured-requests.mjs`
  asserts each backend's native body via a mocked `fetch`; `test-provenance.mjs`
  covers the claude tool_use + gemini extractors).
- `cd build-gate && npm test` (exit 0, incl. breakout; `test-schemas.mjs` strict-mode
  validity; `test-teams` lead↔strength + integrity; `test-council-orchestrator`
  gemini advisory; `test-team-prompts` schema emission + profile framing).
- `cd merkle-dag && npm test` (exit 0, substrate unchanged).
- Optional live smoke (needs keys; skips otherwise) — a real structured approval
  packet + a Gemini advisory seat.
