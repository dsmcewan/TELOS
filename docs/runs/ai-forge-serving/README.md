# ai-forge: serving+guardrails pattern — run evidence

## What this run proves

`run.mjs` exercises the `servingPattern` from `ai-forge/patterns/serving.mjs` through the forge gate and records the sanitized result in `run-summary.json`.

**Result:** `converged=true gate_status=pass workstreams=8` — all 8 workstreams reach `finalStatus: meets`.

## What the pattern builds

The serving+guardrails pattern forges a complete request-serving layer composed of 7 build workstreams plus 1 design verification workstream:

| Workstream | File | What it proves |
|---|---|---|
| schema | `serving/schema.mjs` | Request schema accepts conforming requests and rejects malformed ones (bad path, bad method). |
| handler | `serving/handler.mjs` | Handler validates then echoes the body (200 on valid, 400 on invalid). |
| input-guardrail | `serving/guard-in.mjs` | Input guardrail rejects oversized and denylisted payloads (fail-closed). |
| output-guardrail | `serving/guard-out.mjs` | Output guardrail redacts blocked tokens (`password`, SSN patterns) and passes clean output unchanged. |
| ratelimit | `serving/ratelimit.mjs` | Token-bucket rate limiter allows N requests per window and blocks the next; refills after the window. |
| authz | `serving/authz.mjs` | Capability-based authz allows matched actions and denies others. Keyless: the token→caps map is a fake, not real secrets. |
| audit | `serving/audit.mjs` | Audit appends one structured line per request to an isolated tmpdir log. |
| design | _(forge-generated)_ | Verified design covering the full serving stack; produced by `makeDesignWorkstream`. |

## Keyless guarantee

The `authz` workstream uses a hardcoded fake token map (`tok-reader`, `tok-admin`) with no real credentials, API keys, or secrets. Safe to commit and reproduce anywhere.

## Sanitization

`run-summary.json` contains no `file://` URIs, no absolute paths (`C:`, `/Users/`, `/home/`), no secrets, and no timestamps. The sanitization guard in `run.mjs` throws before writing if any are detected.

## Reproduction

```
node docs/runs/ai-forge-serving/run.mjs
# → serving run: converged=true gate_status=pass workstreams=8
```

Requires Node >= 18, ESM. Deterministic; no network calls.
