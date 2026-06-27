---
title: TELOS Breakout (Self-Challenge) Engine
author: codex
last-edited-by: codex
last-edited-at: 2026-06-26
workflow-status: active-draft
source-workflow: multi-model-build-gate
tags:
  - type/runbook
  - model/codex
  - workflow/breakout
---

# TELOS Breakout (Self-Challenge) Engine

The build gate validates that approval and market-readiness packets *claim* the
right statuses. It does not test whether those claims are true. `council_review`
exists in `ai-peer-mcp`, but it is a **single** adversarial pass that is never
looped back into the verdict — so a workstream can self-assert
`lexi_class_ui_status: "meets"` and pass the gate even when the artifact is not
done (the convergence web demo passed with §03/§04 data computed, shipped to the
browser, and never rendered).

The breakout engine is the missing organ: it lets TELOS **challenge its own
claims until they hold up.**

## What it does

`runBreakout(input, fns)` runs rounds of:

1. **challenge** — an adversarial reviewer attacks the claimed status and returns
   concrete blockers (missing states, claims not actually rendered, unverified
   assertions).
2. **revise** — if blockers stand, the builder addresses them; the loop
   re-challenges, because a claimed fix only counts if it survives the next round.

It ends when:

- the challenger returns **no blockers** → `converged: true`, `finalStatus:
  "meets"`, no surviving blockers; or
- **rounds run out** → `converged: false`, `finalStatus: "needs-work"`, and the
  surviving blockers are returned as `go_to_market_blockers`.

**Hard invariant:** it never reports the goal status while a blocker survives.
The status is *derived* from surviving challenge, never self-asserted — which is
the rubber-stamp the gate could not catch on its own.

## Updates are made by teams and reviewed

The fix is **not** a single model call. In `revise`, every team member proposes a
fix independently, then a **reviewer** judges the proposals against the blockers.
Only review-accepted blockers resolve, and resolution is capped to blockers that
were actually raised — the team cannot approve its own work, and a reviewer cannot
smuggle in a fix for a blocker nobody raised.

## Keyless core, live via MCP

The engine is deterministic and key-free; `challenge`/`revise` are injected.

- `makeCouncilBreakout({ callTool, team, reviewer, challengerTool })` builds the
  challenge + team-propose + review steps on top of a single `callTool(name,
  args)` seam.
- `mcp_client.mjs` (`spawnMcpClient`) is a stdio MCP client that spawns
  `ai-peer-mcp/server.mjs` and provides a live `callTool` for `grok_ask` /
  `claude_ask`. Its JSON-RPC framing is unit-tested with a fake transport; the
  real spawn needs the server's keys.
- `live.mjs` (`runLiveBreakout` / `npm run breakout`) **decides the verdict with
  the verifier, not the prose council.** It runs `runVerifiedBreakout` over the
  caller's `checks` (facts) to determine `converged`/`finalStatus`, and runs the
  Grok-challenge / Claude+Grok-team / Claude-review council **for discovery only**
  — its surfaced blockers are attached under `discovery` as advisory context and
  never move the verdict. The council does not reliably converge (a goalpost-
  moving reviewer can refuse forever), so it surfaces *what to check*; the
  verifier *decides*.

The verdict path is key-free; only the discovery council requires the ai-peer-mcp
environment. (Pass `discover` to `runLiveBreakout` to inject/skip the council —
the verdict tests run keyless this way.)

```powershell
# verdict from facts in checks.json; discovery council runs if evidence is given
# (needs ANTHROPIC_API_KEY / XAI_API_KEY in the ai-peer-mcp env)
node .\me\codex\breakout\live.mjs "frontend-brand-experience" "evidence for discovery" checks.json 3
```

## Deterministic verifier (grounding)

The council breakout is a prose debate: the challenger and reviewer see only the
*text* of a claim, so a maximally-skeptical reviewer can always demand proof that
doesn't fit in a sentence (a commit hash, the actual PNG bytes, a CI log) and the
loop never converges — even when the work is real and checkable. Run it live and
you watch it move the goalposts.

`verifier.mjs` fixes that by deciding `meets` on **facts, not rhetoric**:

- `verifyChecks(checks)` runs real checks and returns `{ facts, allPass, failing }`.
- `runVerifiedBreakout(input, checks)` returns a gate-compatible record whose
  `converged` / `finalStatus` are decided purely by whether the checks pass, plus
  `verified_facts` — the actual check results, which ARE the produced evidence the
  prose reviewer kept demanding.
- Check builders: `fileExistsCheck`, `fileContainsCheck`, `commandCheck` (runs a
  real subprocess and reads its exit code, e.g. `pytest`).

No rhetoric can move a passing check, and nothing reaches `meets` while a check
fails. Example — the convergence frontend earns `meets` on facts:

```
[PASS] s03-screenshot: found .../docs/verification/s03-dynamics-discriminator.png
[PASS] s04-screenshot: found .../docs/verification/s04-scorecard.png
[PASS] verification-doc: found .../web/VERIFICATION.md
[PASS] cyan-token: found "#69e7ff"
[PASS] ui-tests-pass: exit=0 19 passed in 0.02s
-> finalStatus: meets, converged: true
```

Use the council breakout to *discover* what to check; use the verifier to *decide*.

## Wiring into the gate

The breakout result feeds a market-readiness packet honestly: `finalStatus`
becomes `lexi_class_ui_status`, and `go_to_market_blockers` carries the surviving
blockers — so a workstream only reaches `meets` after surviving challenge, and an
unfinished one blocks the gate with its real reasons.

The record also carries a declarative `checks` array (`reverifyRecord` /
`safeCheckFromSpec` in `verifier.mjs`; `runVerifiedBreakout` emits it from each
check's `.spec`). The gate does **not** trust the record's `converged` boolean —
it imports `reverifyRecord` and **re-runs the read-only `file_exists` /
`file_contains` checks itself**, confined to the dossier's base dir, and blocks
`meets` if any fail or none are gate-verifiable. `command` specs are recorded for
provenance but never executed by the gate.

## Commands

```powershell
npm --prefix .\me\codex\breakout test
```
