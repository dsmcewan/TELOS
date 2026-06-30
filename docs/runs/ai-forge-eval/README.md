# ai-forge eval-harness pattern — run evidence

## What this run proves

`run.mjs` exercises the `evalPattern` from `ai-forge/patterns/eval.mjs` through the forge gate.
It demonstrates that ai-forge can forge a complete, self-testing eval harness in a single converged run.

## What the eval harness contains

The pattern produces seven interdependent build workstreams plus a design workstream (8 total):

| Workstream | What it contributes |
|---|---|
| **dataset** | A fixed, labelled eval set (binary sentiment, ≥4 unique cases). |
| **target** | A deterministic keyword classifier; total over the dataset inputs. |
| **runner** | Runs the target over the dataset; produces one id-aligned prediction per case. |
| **metrics** | Computes accuracy, precision, and recall; proven against a hand-computed fixture. |
| **scorecard** | Writes `scorecard.json`; asserts stored metrics ≈ recomputed on read-back (fail-closed). |
| **threshold** | Gates metrics against minimum thresholds; passes above bounds, blocks below. |
| **regression** | Flags metrics that drop below a stored baseline beyond tolerance. |
| **design** | Verified architectural design synthesised from all seven build findings. |

## The scorecard cross-check and issue #30 item 2

The `scorecard` workstream's `verifyScorecard` function is the first-class form of the deferred
issue #30 item-2 cross-check: it recomputes all metrics from the runner and asserts that the stored
values differ by at most ε (1 × 10⁻⁹). Tampered values are rejected. This is structural verification,
not a post-hoc audit step.

## Run result

All 8 workstreams converge (`finalStatus: meets`). Gate status: `pass`.

```
eval run: converged=true gate_status=pass workstreams=8
```

## Properties

- **Keyless**: no API keys, no network calls, no secrets.
- **Deterministic**: the classifier is a fixed keyword lookup; metrics are exact fractions of 4 cases.
- **Sanitized**: `run-summary.json` contains no absolute paths, no `file://` URIs, no timestamps.
- **Node ≥ 18, ESM**: pure ES modules throughout.
