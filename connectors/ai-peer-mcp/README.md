# AI Peer MCP Connector

Local MCP server for the V4 multi-model workflow.

It exposes five tools:

- `claude_ask`: calls Claude through the Anthropic Messages API.
- `grok_ask`: calls Grok through xAI's OpenAI-compatible chat completions API.
- `codex_ask`: calls Codex through OpenAI's chat completions API.
- `agy_checkpoint`: local phase/queue governance, no external key required.
- `council_review`: asks Claude for a proposal and Grok for adversarial review.

**Provenance.** Each model tool surfaces *real* provenance so a downstream gate
can bind a packet to the response that produced it (never a self-declared id):
- `claude_ask` / `grok_ask` / `codex_ask` return raw prose by default; pass
  `include_provenance: true` to get a `{ text, provenance: { model, response_id,
  source } }` envelope where `model`/`response_id` come from the API response body.
- `agy_checkpoint` is a local deterministic tool with no server-issued id, so it
  embeds a content-addressed **attestation** (`response_id = "agy-" +
  sha256(checkpoint)`) as its `provenance` — reproducible and verifiable by anyone.

This is a scaffold. It does not include API keys.

It is wired into `C:\Users\dsmce\.codex\config.toml` as `mcp_servers.ai_peer`. Restart Codex after changing environment variables so the app can launch the MCP server with the right credentials.

## Requirements

- Node.js 18 or newer.
- `ANTHROPIC_API_KEY` for Claude tools.
- `XAI_API_KEY` for Grok tools.
- `OPENAI_API_KEY` for Codex tools (optional `OPENAI_BASE_URL` to override the endpoint).
- `ANTHROPIC_MODEL`, `XAI_MODEL`, and `OPENAI_MODEL`, or pass `model` in each tool call.
- `agy_checkpoint` requires no key.

## Quick Check

From this directory:

```powershell
npm run check
npm run smoke
```

The smoke test uses only the local `agy_checkpoint` tool, so it does not require API keys.

## Environment

Use the helper script to set Windows User environment variables without echoing API keys:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\dsmce\OneDrive\Attachments\Desktop\V4\me\codex\connectors\ai-peer-mcp\scripts\set-user-env.ps1"
```

Verify set/missing status without printing secret values:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\dsmce\OneDrive\Attachments\Desktop\V4\me\codex\connectors\ai-peer-mcp\scripts\check-user-env.ps1"
```

You can also set these manually as user/session environment variables:

```powershell
$env:ANTHROPIC_API_KEY = "..."
$env:ANTHROPIC_MODEL = "..."
$env:XAI_API_KEY = "..."
$env:XAI_MODEL = "..."
```

Do not paste real keys into vault notes.

## MCP Launch Command

Use this command in an MCP client configuration:

```powershell
node "C:\Users\dsmce\OneDrive\Attachments\Desktop\V4\me\codex\connectors\ai-peer-mcp\server.mjs"
```

The current Codex config entry uses:

```toml
[mcp_servers.ai_peer]
command = 'node.exe'
args = ['C:\Users\dsmce\OneDrive\Attachments\Desktop\V4\me\codex\connectors\ai-peer-mcp\server.mjs']
startup_timeout_sec = 120

[mcp_servers.ai_peer.env]
ANTHROPIC_VERSION = "2023-06-01"
XAI_BASE_URL = "https://api.x.ai/v1"
```

Example shape for a client that accepts command/args:

```json
{
  "mcpServers": {
    "ai-peer": {
      "command": "node",
      "args": [
        "C:\\Users\\dsmce\\OneDrive\\Attachments\\Desktop\\V4\\me\\codex\\connectors\\ai-peer-mcp\\server.mjs"
      ],
      "env": {
        "ANTHROPIC_API_KEY": "set-outside-vault",
        "ANTHROPIC_MODEL": "set-to-available-claude-model",
        "XAI_API_KEY": "set-outside-vault",
        "XAI_MODEL": "set-to-available-grok-model"
      }
    }
  }
}
```

## Tool Notes

### `claude_ask`

Arguments:

```json
{
  "prompt": "Plan the taxonomy review.",
  "system": "You are Claude, lead information architect.",
  "model": "optional override",
  "max_tokens": 2000,
  "temperature": 0
}
```

### `grok_ask`

Arguments:

```json
{
  "prompt": "Review this proposal for archive contamination.",
  "system": "You are Grok, adversarial checker.",
  "model": "optional override",
  "max_tokens": 2000,
  "temperature": 0
}
```

### `codex_ask`

Arguments:

```json
{
  "prompt": "Stress-test this plan for execution risk.",
  "system": "You are Codex, implementation reviewer.",
  "model": "optional override (else OPENAI_MODEL; bare 'codex' -> gpt-4o)",
  "max_tokens": 2000,
  "temperature": 0,
  "include_provenance": false
}
```

### `agy_checkpoint`

Arguments:

```json
{
  "phase": "pilot",
  "scope": "shared/Coordination",
  "required_packets": ["claude-intake", "grok-review"],
  "present_packets": ["claude-intake"],
  "protected_path_check": "pass",
  "lexi_required": false,
  "broad_patch_requested": false
}
```

### `council_review`

Arguments:

```json
{
  "objective": "Review the pilot tagging proposal.",
  "context": "Paste or reference the proposal text here.",
  "claude_system": "You are Claude, lead architect.",
  "grok_system": "You are Grok, adversarial checker.",
  "max_tokens": 2000
}
```

## Safety Boundaries

- This connector does not write vault files.
- Keep real API keys outside the vault.
- Use `agy_checkpoint` to enforce that `CHATGPT/` and peer scratch folders remain protected.
- Treat Claude/Grok output as proposals until checked against vault facts or LEXI where applicable.
