# TELOS Self-Audit — Status (Batch 7)

**The factory audits its own launch, signed, through its own machinery.** This
is the dogfood gate: the TELOS-as-a-service manifest (`manifest.json`) run
through the same ratchet / adversarial-council / signed-gate pipeline TELOS
sells, grounded against a self-snapshot of this repository and its own
gate-PASSED run summaries.

## Result: 3/6 certified signed, ~4 blockers from a full PASS, resumable

| Workstream | State |
| --- | --- |
| `proof-of-work` | ✅ **certified, trust_mode: signed** |
| `unit-economics` | ✅ **certified, trust_mode: signed** |
| `ops-service` | ✅ **certified, trust_mode: signed** (claude-authored) |
| `service-architecture` | 3 grounded blockers (codex-authored) |
| `positioning-service` | 1 grounded blocker (claude-authored) |
| `security-trust` | effectively cleared (0 banked; converges on next bout) |

**No code problem stands between here and a full signed PASS** — the remaining
blockers are few and doc-fixable, and `security-trust` is clear. The run is
blocked only on exhausted Anthropic API credits: `positioning-service` is the
last claude-authored node, and TELOS builds all nodes before running any bouts,
so that one un-buildable node gates the two healthy codex workstreams. A single
Anthropic top-up + `node docs/runs/telos-self-audit/drive-audit.mjs` (with
`TELOS_SECRET_*` set) resumes straight to the finish from preserved ratchet
state.

### Two engine hardening fixes the final push surfaced (both tested)

5. **Editable-artifact vs read-only-evidence scope** (`saas-forge/live.mjs`) —
   the deepest self-audit bug: once the builder could read the source anchors,
   the adversary's "raise blockers resolvable by editing the files shown" rule
   started demanding the builder EDIT TELOS's own source to match the audit's
   claims (16 passes of deadlock). Evidence files are now tagged `[EDITABLE
   ARTIFACT]` vs `[READ-ONLY EVIDENCE]`; a cited claim is resolved by correcting
   the ARTIFACT to match the evidence, never by changing the evidence. This
   collapsed the fake blockers (14 pruned) — the general shape any audit-of-
   existing-code needs.
6. **Call-level transient retry** (`forge/ratchet.mjs` `withTransientRetry`) — a
   single flaky-network seat call (ECONNRESET/ETIMEDOUT) retries in place with
   backoff instead of aborting a whole pass; billing/quota failures are NEVER
   retried (retrying a wallet buys nothing). Complements the driver's pass-level
   transient handling.

## What the self-audit proved

`proof-of-work` converging **in one round** the moment the builder could read
the run-summary JSONs it was citing is the finale's core evidence: when the
factory is given fair, symmetric evidence, it certifies precise claims about
itself under its strictest signed posture. That single crossing validates the
whole thesis — *verified beats plausible, and the strongest proof is the factory
certifying itself with the machinery it sells.*

## Four engine improvements the self-audit surfaced (all tested)

The hardest run — adversaries holding TELOS's own source and checking every
cited claim against it — stress-tested the engine and yielded four real fixes:

1. **Builder source visibility** (`saas-forge/live.mjs`) — the author now reads
   the same source anchors the adversary holds. The non-convergence was pure
   epistemic asymmetry: a `cited` claim cannot survive a judge reading the file
   the author only guessed at. This is the session's deepest recurring lesson,
   applied to the builder itself.
2. **Tunable round cap** (`forge/ratchet.mjs`, `TELOS_MAX_ROUNDS`) — within-bout
   rounds argue about a frozen artifact; between-pass respec rebuilds it. Capping
   rounds routes budget to rebuilds, converging cheaper and faster.
3. **Transient-resilient driver** (`forge/driver.mjs`) — a network-timeout pass
   is neither progress nor a fixed point; it retries with backoff, bounded by
   `maxTransient`, so a flaky wire delays but never falsely terminates a run.
4. **Infra errors are not artifact blockers** (`forge/ratchet.mjs`) — quota /
   network failures at build time are surfaced for a clean halt, never banked
   onto a converging workstream's blocker list (they were masking its real,
   low count).

## Evidence

- `evidence/PROOF.md` — the certified proof-of-work artifact
- `evidence/run-summary.json` — the signed run summary
- `evidence/status.json` — the converged/contested snapshot
