# Live MCP run — autonomous builder

`run-teams-live.mjs` drives the agentic-teams autonomous builder over the **live**
`ai-peer-mcp` backends: the approval council seats call their real `*_ask` tools,
`agy` runs its local `agy_checkpoint`, and each build team calls its lead seat to
generate the node's files. The gate, content-addressed plan, and Ed25519 ledger
are the same real substrate as the keyless demos.

## Run it

```bash
# from the repo root
ANTHROPIC_API_KEY=…  XAI_API_KEY=…  OPENAI_API_KEY=… \
  node docs/runs/agentic-teams-live/run-teams-live.mjs
```

Optional environment:

- `TELOS_CLAUDE_MODEL`, `TELOS_GROK_MODEL`, `OPENAI_MODEL` — per-seat model id overrides (else the server defaults apply).
- `TELOS_LIVE_DECOMPOSE=1` — let the Planning team author the task list live (default: the `examples/agentic-teams` fixture tasks, for a deterministic run).

The run writes a sanitized, secret-free `run-summary.json` next to the script.

## Fail-closed without keys (the correct outcome)

A seat with no API key fail-closes: the server returns no usable answer, the seat
yields a non-approving packet, and the gate **honest-blocks at the approval
phase** — no plan, no ledger. The committed `run-summary.json` captures exactly
this: `agy` (keyless, local) produced a real packet, while `claude`/`codex`
fail-closed for missing keys, so the council blocked with:

```
"Missing required claude approval packet."
"Missing required codex approval packet."
```

With all three keys present, the council passes and the build proceeds through the
teams to `merge_status: "ready"` — the same terminal state the keyless mock demos
reach, but with real model approvals and real per-seat provenance.

## What is wired

- **Approval + decompose council** — `makeLiveCallSeat` (`build-gate/teamPrompts.mjs`)
  over `liveSeatCaller` (`build-gate/council.mjs`): `approvalPromptFor` +
  `parseApprovalPacket` for approvals (identity from the dossier, judgment from the
  model), `decomposePrompt` + `parseDecomposeTasks` for live decomposition.
- **Build teams** — `makeLiveCallTeam`: each team's buildable lead emits the node's
  files as JSON, clamped to the node's declared files.
- **Signing** — `makeTeamKeyring` mints per-team Ed25519 keypairs locally (no API).
