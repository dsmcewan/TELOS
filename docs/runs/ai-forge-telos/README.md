# ai-forge — TELOS pattern run evidence

**What this run proves:** ai-forge (itself built on the TELOS trust spine) forges a
working TELOS-like trust system — the self-similar capstone of the ai-forge catalog.

## What converged

8 workstreams, all `converged: true`, `finalStatus: meets`:

| Workstream | What the forge generates | Selftest asserts |
| --- | --- | --- |
| `sign` | `telos/sign.mjs` wrapping `build-gate/sign.mjs` | HMAC roundtrip verifies; tamper fails |
| `plan` | `telos/plan.mjs` wrapping `merkle-dag/merkle.mjs` | plan_hash deterministic; downstream effective_hash cascades |
| `provenance` | `telos/provenance.mjs` wrapping `connectors/ai-peer-mcp/lib.mjs` | content-addressed attestation id; missing id → null (fail-closed) |
| `gate` | `telos/gate.mjs` wrapping `build-gate/gate.mjs` | unanimous council → pass; a reject → blocked |
| `council` | `telos/council.mjs` wrapping `build-gate/council.mjs` | fan-out produces ordered, signed, verifiable packets |
| `ledger` | `telos/ledger.mjs` wrapping `merkle-dag/{crypto,merkle,artifact,ledger-gate}.mjs` | settled ledger verifies done(); tampered artifact blocked |
| `breakout` | `telos/verify.mjs` wrapping `breakout/verifier.mjs` | present evidence → meets; absent evidence → blocked |
| `design` | `DESIGN.md` (generic design workstream) | design doc verified against plan + ledger + built tree |

## How to reproduce

```bash
node docs/runs/ai-forge-telos/run.mjs
# → converged=true merge_status=ready gate_status=pass
```

No network, no secrets, no timestamps. Keyless and deterministic — the same result
every run.

## Why this is the self-similar capstone

- ai-forge is itself built on the TELOS trust spine (plan → council gate → build →
  verify → signed Ed25519 ledger → done()).
- The TELOS pattern it forges wraps that same spine's real modules — `build-gate/`,
  `merkle-dag/`, `breakout/`, `connectors/ai-peer-mcp/` — via a ctx-injected
  `spineRoot`. Each component has a genuine executable selftest that runs the real
  spine code, not a stub.
- The forge then puts all 8 workstreams through the full gate pipeline: merkle-dag
  plan → adversarial breakout-on-facts → market gate. The self-similar loop closes:
  ai-forge forges a trust system that is structurally identical to the forge that
  forged it.

## Key properties

- **Fail-closed gates are real:** each selftest has a fail sub-case (tamper / reject /
  absent evidence) that confirms the gate blocks, not just passes.
- **Fixture isolation:** the ledger selftest always writes to `os.tmpdir()`, never
  the forge's in-progress `.telos/` directory, avoiding cross-contamination.
- **Sanitized evidence:** `run-summary.json` contains no `file://` URLs, no absolute
  paths (especially not `spineRoot`), no secrets, no timestamps — deterministic and
  safe to commit.
- **Zero new dependencies:** pure Node ≥ 18 ESM; all spine modules are already in
  the repo.

## Run summary

See [`run-summary.json`](run-summary.json) for the committed, sanitized output
(`converged: true`, `gate_status: "pass"`, 8 workstreams).
