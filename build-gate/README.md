---
title: Codex Build Gate Validator
author: codex
last-edited-by: codex
last-edited-at: 2026-06-26
workflow-status: active-draft
source-workflow: multi-model-build-gate
tags:
  - type/runbook
  - model/codex
  - workflow/build-gate
---

# Codex Build Gate Validator

This directory contains Codex-local mechanics for the multi-model build gate. It validates a use-case dossier and model approval packets before a build or broad vault operation begins.

Canonical workflow note:

`shared/Coordination/Multi-Model Agentic Build Gate.md`

Prototype workflow note:

`shared/Coordination/Claude-Led Multi-Model Prototype Workflow.md`

## Commands

Run the passing example:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\pass\dossier.json .\me\codex\build-gate\examples\pass\packets
```

Run all local checks:

```powershell
npm --prefix .\me\codex\build-gate test
```

Dogfood — the gate validates its **own** construction through itself:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\self\dossier.json .\me\codex\build-gate\examples\self\packets
```

The report's `headline_checks` says plainly which optional gates evaluated
(`capability` / `market` / `lexi` / `breakout`), so a minimal dossier can't
silently run only the base checks. `report.provenance` lists each required
model's provenance status (see Trust boundary below).

Optional Markdown ledger output:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\pass\dossier.json .\me\codex\build-gate\examples\pass\packets --ledger .\me\codex\build-gate\ledger.example.md
```

Run a prototype example with capability acquisition packets:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\prototype-pass\dossier.json .\me\codex\build-gate\examples\prototype-pass\packets --capabilities .\me\codex\build-gate\examples\prototype-pass\capabilities
```

Run a market-bound TELOS readiness example:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\market-pass\dossier.json .\me\codex\build-gate\examples\market-pass\packets --market-readiness .\me\codex\build-gate\examples\market-pass\market
```

## Gate Result

- Exit code `0`: gate passes.
- Exit code `1`: gate is blocked.
- Exit code `2`: usage, read, or JSON parse error.

The command prints a JSON report with:

- `gate_status`
- `safe_next_action`
- `blockers`
- `warnings`
- `required_docs`
- `docs_reviewed`
- `packets_seen`
- `capability_packets_seen`
- `market_packets_seen`

## Required Approval Packets

The validator requires approved packets from:

- `claude`
- `agy`
- `codex`

Grok is advisory. If Grok sends hard stops, the dossier must explicitly mark each one as `resolved`, `dismissed`, or `accepted-blocker`. Accepted blockers keep the gate blocked.

### Trust boundary (honest limitation)

A packet's `model` field is a **self-declared string**, not an authenticated
identity. The gate **does not** cryptographically verify which model authored a
packet — a single actor can write all of `claude` / `agy` / `codex`. The gate
enforces *structure* and *re-verifies facts* (see breakout re-verification
above); it does not establish *who* approved.

To make identity real, a packet may carry a `provenance` block captured from an
actual model call — `ai-peer-mcp`'s `council_review` returns the model the API
*actually answered with* (`provenance.{claude,grok}.model` + `response_id`). The
gate surfaces each required model's provenance in `report.provenance` and
**warns** when an approval packet carries none (identity is then self-declared).
Provenance is advisory: it is surfaced and warned on, never used to block. Real
authentication (signing keyed to a per-model secret) is future work.

## Capability Acquisition Packets

Prototype builds can require capability packets from Claude, Codex, Agy, and Grok. These packets list docs, skills, connectors, available capabilities, missing capabilities, planning helpers, and recommendations to Claude.

The gate blocks when:

- a required model has no capability packet;
- a missing capability was not presented to Claude;
- a capability still requires user, plugin, API, or connector setup.

## Market Readiness Packets

Market-bound builds can require market readiness packets. These packets cover business positioning, product architecture, backend/schema, security/trust, accuracy/evals, scale/operations, and frontend/brand experience.

The gate blocks when:

- a required market workstream was not reviewed;
- a market packet has `go_to_market_blockers`;
- a user-facing market-bound build has `lexi_class_ui_status: needs-work`;
- the frontend workstream has no packet with `lexi_class_ui_status: meets`;
- a packet claims `lexi_class_ui_status: meets` **without a passing breakout
  record** (see below).

### `meets` requires a breakout record the gate re-verifies

A `meets` claim cannot be self-asserted. Any market packet with
`lexi_class_ui_status: "meets"` must carry a `breakout` record (produced by
`me/codex/breakout/`). The gate checks the record's self-reported shape
(`converged: true`, `finalStatus: "meets"`, empty `surviving_blockers`, ≥1
`round`, a `workstream` in `workstreams_reviewed`) — **but the load-bearing step
is re-verification, not the self-report.**

The record must carry a `checks` array of **declarative, read-only** specs, and
the gate **rebuilds and re-runs them itself** against the real filesystem:

```json
"checks": [
  { "type": "file_exists",   "path": "docs/verification/s03-scorecard.png" },
  { "type": "file_contains", "path": "web/site/style.css", "needle": "#69e7ff" }
]
```

Paths resolve under, and are confined to, `dossier.affected_directories[0]` (else
the dossier's directory). The gate blocks the `meets` claim when **any re-run
check fails**, or when the record carries **no gate-verifiable check** (only
`command` specs, which the gate records but **never executes** — running
packet-declared commands would be a worse hole than the one this closes).

So `converged: true` is not enough: a record can claim it, but if the declared
artifacts aren't actually on disk the gate finds out and blocks. This is what
stops a workstream from rubber-stamping its own "done" — the exact gap that let
the convergence web demo pass while §03/§04 were computed but never rendered.

**Residual limit (honest):** the gate proves the declared checks are *true*, not
that they are *sufficient*. A builder can still back `meets` with real-but-weak
checks; choosing meaningful checks is the council's job. The bar is now "real
passing evidence," not "a true boolean."

## Boundary Rules

The validator rejects write targets under:

- `CHATGPT/`
- `me/claude-code/`
- `me/claude-desktop/`
- `me/gemini/`

Keep this validator in `me/codex/`. Promote only the workflow contract and approved ledgers into `shared/`.
