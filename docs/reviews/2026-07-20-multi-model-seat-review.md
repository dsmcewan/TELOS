# Multi-Model Seat Review — 2026-07-20

Scope: every model seat in the TELOS build-gate — code, documentation, and each provider's
ecosystem practices for skills, plugins, and agents. Method: 53 review/verification agents across
two adversarial workflows (every code finding survived independent refutation; every ecosystem
claim was fact-checked against official provider docs). No live provider calls were made.

Transports reviewed: `connectors/ai-peer-mcp/server.mjs` + `lib.mjs` (raw HTTP seats),
`docs/runs/production-profile-compiler-1-workshop/claude-code-seat.mjs` and `codex-cli-seat.mjs`
(subscription-auth CLI seats), seat data in `build-gate/seats.json`, orchestration in
`build-gate/council.mjs`, and all README/MODEL-REVIEWS doc surfaces.

## Verdict summary

| Seat | Provider | Works? | Best practice | Headline |
|---|---|---|---|---|
| claude | Anthropic | Yes | B | Contract-correct; council_review inoperable at its own defaults; non-Fable models silently run thinking-off |
| codex | OpenAI | Yes | B | Correct for gpt-5.x; `startsWith("gpt-5")` heuristic 400s o-series; Chat Completions is supported-but-not-recommended |
| grok | xAI | Yes | B | Contract-correct but on a **legacy endpoint**; "live web/X search" strength claim is false at the transport level |
| gemini | Google | Partial | B | Request shape current; MAX_TOKENS/safety responses return raw API JSON as the "answer" |
| agy | local | Yes | B | Attestation honest but truncation undocumented; "protects folders" claim overstates a caller-supplied regex check |

Cross-cutting (all remote seats): no retry/backoff on 429/5xx (`retry-after` never read), no SSE
streaming for long reasoning generations, and README examples recommending `temperature: 0`
against models that reject or discourage it.

## Per-seat findings (all adversarially confirmed)

### claude (Anthropic)

Correct: endpoint/headers/auth pairing (x-api-key XOR Bearer+`anthropic-beta: oauth-2025-04-20`),
current model aliases, effort clamping per tier, sampling-param avoidance, refusal fail-loud,
honest-null provenance. The MODEL-REVIEWS record is machine-probed against `mapModelName`, so the
documented mapping cannot drift — unusually good doc enforcement.

- **[important]** `council_review` is effectively inoperable on its default model: hard-coded
  `max_tokens` 2000 (schema cap 8192) while the Fable seat defaults to effort `max` and thinking
  bills against `max_tokens` — the budget-exhaustion guard will almost always fire.
  (`server.mjs:701-713`, `404-408`, `522-524`)
- **[important]** `stop_reason: "max_tokens"` guard fires only on empty text — truncated-but-non-
  empty answers pass as complete; `model_context_window_exceeded` unhandled. (`server.mjs:522-524`)
- **[important]** No `thinking: {type:"adaptive"}` is ever sent, so every **non-Fable** Claude
  model (incl. breakout reviewer `claude-opus-4-8`, builder `claude-sonnet-4-6`) runs thinking-off.
- **[important]** README `claude_ask` example passes `temperature: 0` → 400 on the default model.
- **[minor]** OAuth (`ANTHROPIC_AUTH_TOKEN`) path implemented but undocumented; structured output
  uses forced-single-tool instead of GA `output_config.format`; no retry/backoff; no streaming.

### codex (OpenAI)

Correct: Chat Completions body for gpt-5.x, `max_completion_tokens` switch, `reasoning_effort`
gating, strict `response_format`, provenance envelope. The CLI seat (`codex-cli-seat.mjs`) is
exemplary — every flag matches OpenAI's documented CI pattern (`codex exec --json
--output-schema --output-last-message`, read-only sandbox, fail-closed JSONL parsing).

- **[important]** `model.startsWith("gpt-5")` sends deprecated `max_tokens` to every other model —
  o-series (still current) gets a guaranteed 400. (`server.mjs:629-631`)
- **[important]** README trust-boundary section *undersells* shipped enforcement ("provenance is
  advisory… future work") — the gate actually blocks on provenance + per-seat HMAC under
  `trust_mode: "signed"`.
- **[minor]** No refusal/`content_filter` handling (asymmetric with claude seat); null content
  degrades to dumping the raw response JSON as text; default 16000-token budget is below OpenAI's
  ≥25k reasoning recommendation; `temperature: 0` doc example 400s on reasoning models; Chat
  Completions is supported-but-not-recommended — OpenAI's guidance is Responses API for reasoning
  models.
- **CLI-seat hermeticity gap:** `codex exec` runs with cwd inside the repo, so the repo `AGENTS.md`
  joins the instruction chain of every "sealed" review packet — a mutable unhashed input beside
  the frozen frame. Fix: run from the ephemeral temp dir, or pin `-c project_doc_max_bytes=0`
  (verify), or hash AGENTS.md into packet provenance.

### grok (xAI)

Correct: `api.x.ai/v1/chat/completions`, Bearer auth, `grok-4.5` current, effort clamping matches
xAI's reasoning guide.

- **[important]** **Chat Completions is now an explicitly "legacy endpoint"** at xAI; the old Live
  Search (`search_parameters`) is retired (410s since ~Jan 2026). The current surface is the
  Responses API (`/v1/responses`) with server-side agentic tools.
- **[important]** seats.json's strength claim "real-time web / X search" is **false at the
  transport level** — search is opt-in (`tools: [{type:"web_search"},{type:"x_search"}]`) and the
  seat never sends it; the model has zero live access. The fix is exactly xAI's recommendation:
  Responses API + first-party search tools, capturing `response.citations` +
  `server_side_tool_usage` into the review packet (citations are evidence-shaped output — a
  natural fit for the fail-closed gate). Keep it opt-in: search bills separately and adds
  nondeterminism.
- **[important]** `max_tokens` is deprecated at xAI in favor of `max_completion_tokens`; the 8192
  schema cap is artificial for a 500K-context model and the default already sits at the cap.
- **[important]** No empty-answer guard — `finish_reason: "length"` with empty content returns
  `""`; null content dumps raw JSON (siblings fail loudly).
- **[minor]** README omits four accepted arguments; temperature cap 1 vs xAI's documented 0-2.

### gemini (Google) — "partial"

Correct: `v1beta …:generateContent` + `x-goog-api-key`, current `thinkingLevel` contract gated to
gemini-3*, native `responseSchema`, honest-null provenance.

- **[important]** `extractGeminiResult` handles neither `finishReason: MAX_TOKENS` nor safety
  blocks — an exhausted/blocked response returns `JSON.stringify` of the **entire raw API
  response** as the seat's answer. (`lib.mjs:82-91`)
- **[important]** Default `maxOutputTokens` 2000 with default `thinkingLevel: "high"` — thinking
  bills against the combined budget on Gemini 3, so default calls likely produce empty/garbage.
- **[minor]** `thinkingLevel` gated on prefix only — some gemini-3 variants accept only subsets
  (400 risk on `medium`); `temperature: 0` doc example contradicts Google's keep-at-1.0 guidance
  for Gemini 3; stale vault-era Windows paths in READMEs; build-gate README omits the gemini seat.

### agy (local deterministic checkpoint)

- **[minor]** `response_id` is `"agy-" + sha256` **truncated to 40 hex chars** — intentional
  (test-pinned) but documented as full sha256 in two READMEs.
- **[minor]** Attestation binds checkpoint bytes at generation (canonical, key-order independent)
  but **nothing downstream re-verifies it** — the gate checks presence/format/uniqueness only.
- **[minor]** README claim "use agy_checkpoint to enforce that scratch folders remain protected"
  overstates: the tool regex-tests a caller-supplied `protected_path_check` string ("pass") and
  never inspects any path.

## Ecosystem review: skills / plugins / agents per provider

The four ecosystems converged in 2026 on two shared standards: **SKILL.md** (the agentskills.io
open format — now consumed by Claude Code, Codex CLI, Grok Build, Gemini CLI, and Antigravity,
with `.agents/skills/` as the cross-vendor path) and **MCP** (all four are MCP clients; none
supports another cross-agent protocol except Google's A2A, which only Google backs).

| | Anthropic (claude) | OpenAI (codex) | xAI (grok) | Google (gemini/agy) |
|---|---|---|---|---|
| **Skills** | Agent Skills: Messages API container + Skills API `/v1/skills` + Managed Agents field + Claude Code filesystem/plugins. Slash commands merged into skills (commands/ = legacy) | First-class Skills on agentskills.io standard: `.agents/skills`, `~/.agents/skills`, `$skill` invocation, skill-creator tooling. Prompt objects (`v1/prompts`) deprecated, gone 2026-11-30 | Skills in Grok Build CLI (~May 2026), reads Claude Code assets zero-config (CLAUDE.md, plugins, skills, hooks). No API-level skills | Gemini CLI Agent Skills (same SKILL.md, `activate_skill` + consent); Google publishes first-party skills (gemini-skills repo); Gems = consumer-only, no API |
| **Plugins/MCP** | Claude Code plugins (skills+agents+hooks+MCP+LSP+monitors+bin), two official marketplaces; MCP everywhere (SSE transport deprecated; connector beta `mcp-client-2025-11-20`) | "Plugins" = NEW 2026 concept (skills+connectors+MCP+hooks bundles, marketplaces); ChatGPT apps = MCP-backed (Apps SDK); Responses API `mcp` tool; Codex is MCP client AND server (`codex mcp-server`) | Responses API native `mcp` tool (server-side exec); Grok Build plugins mirror Claude Code's layout; xAI hosts a docs MCP server | Interactions API `mcp_server` tool (HTTP only); Gemini CLI full MCP client; **Gemini CLI dropped individual users June 2026 → Antigravity CLI (closed-source, binary literally named `agy`)** |
| **Agents** | Four sanctioned tiers: manual loop / Tool Runner / Managed Agents (hosted, beta) / Claude Agent SDK (headless CLI for other languages). No A2A | Responses API is "the future direction"; Agents SDK; **Assistants API removed 2026-08-26**; Agent Builder dies 2026-11-30; all `*-codex` model snapshots retire 2026-07-23; `codex exec` GA CI surface | Responses API + server-side Agent Tools (web_search, x_search, code interpreter, collections); Grok Build CLI (headless, ACP, 8 parallel subagents); no hosted persistent agents | Interactions API GA (stateful, background, **Managed Agents incl. hosted Antigravity**); ADK 2.0 (5 languages); A2A 1.0 under Linux Foundation; generateContent supported but legacy-positioned |

### Recommendations (fact-checked, prioritized)

1. **Grok: migrate to `/v1/responses`** — the seat sits on a legacy endpoint; the migration is
   contained to `askGrok` + a Responses-shaped extractor, provenance survives (server-issued
   model + id). Add opt-in `web_search`/`x_search` with citations captured into packets to make
   the seats.json strength claim true.
2. **Codex: fix the model heuristic** (send `max_completion_tokens` universally or detect
   o-series), and plan a Responses API migration — same containment. Close the CLI seat's
   AGENTS.md hermeticity gap.
3. **Claude: send `thinking: {type:"adaptive"}` for non-Fable models**; fix `council_review`
   budgets (effort-aware `max_tokens` or explicit lower effort); adopt GA
   `output_config.format` for structured output; document the OAuth path; fix the
   `temperature: 0` examples (all four READMEs).
4. **Gemini: make `extractGeminiResult` fail loudly** on MAX_TOKENS/safety; raise the default
   budget when `thinkingLevel` is high; watch the Interactions API (first-class interaction IDs
   would fix the seat's documented "response id not always provided" weakness).
5. **Agy: document the 40-hex truncation; have the gate re-verify the attestation hash**
   (recompute over canonical checkpoint bytes); reword the folder-protection claim.
   An Antigravity-CLI workshop seat (`agy -p … --output-format json`) is feasible and parallels
   claude-code-seat.mjs, but the binary is closed-source — the adapter must fail closed when the
   envelope lacks real provenance.
6. **All seats:** add bounded retry/backoff honoring `retry-after` for 429/5xx (fail-closed after
   N attempts preserves the gate philosophy); package the review methodology as cross-vendor
   SKILL.md skills under `.agents/skills/` (serves Claude Code, Codex CLI, Grok Build, Gemini
   CLI/Antigravity simultaneously). **Avoid**: Managed/hosted agent surfaces for gate-relevant
   seats (server-side state conflicts with local provenance re-verification), and xAI's remote-MCP
   tool for TELOS tooling (executes outside the evidence perimeter).

### Fact-check corrections applied

Two research claims were caught wrong by the fact-checkers and are corrected above: A2A 1.0
shipped 2026-03-12 (the April date was the Linux Foundation adoption press release), and one
OpenAI deprecation sub-claim was miscombined (the four load-bearing dates — Assistants removal
2026-08-26, Agent Builder 2026-11-30, prompts 2026-11-30, codex snapshots 2026-07-23 — are
confirmed against developers.openai.com/api/docs/deprecations).
