# Proposal-lifecycle run evidence

Keyless, deterministic end-to-end evidence for the Proposal Lifecycle contract
(`contracts/Proposal Lifecycle.md`). No API keys, no network — an ephemeral
proposal-controller Ed25519 key signs a real `.telos/proposal.jsonl` chain, and
the real merkle-dag substrate settles the build.

"Keyless" does not mean unsigned. The gate is signed-by-default, so the flagship
script mints throwaway per-run `TELOS_SECRET_<SEAT>` values for the required
seats (operator-set ones are left untouched, nothing touches disk) and runs on
the certified `trust_mode: "signed"` path. Its third variant withholds one seat
secret and requires the gate to block, so the signed path is verified by the
run rather than asserted by it. Both scripts run in CI (`fail-closed-proof` job).

## Flagship: driven through the autonomous entry point

```bash
node docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs
```

Drives the whole flow through `buildProject({ dossier: { proposal_lifecycle: true } })`, so it
exercises the recorder + Daedalus workshop + cold review + `processReviewPackets` + the outer
revision loop + the dedicated verification node, not just the primitives. Two variants:

| Variant | What it proves | Outcome |
|---|---|---|
| `discharged` | a review requires a verification → the revised candidate mints a dedicated `verify-<concern_ref>` node → execution discharges it | decision `authorized`, `merge_status: "ready"` |
| `control` | same flow, but the remediation omits the marker so the verify check FAILS | decision still `authorized` (concern cleared by `verification-required`), `merge_status` NOT `"ready"` (`UNDISCHARGED_OBLIGATION`) — the obligation is load-bearing at Rule 3 |
| `unsigned` | same flow with `TELOS_SECRET_CODEX` withheld | decision `blocked` at the approval phase (`trust_mode 'signed' but no secret to verify codex packet`), no verify node minted, no build — the first two variants really passed through the signed gate |

Writes `run-lifecycle-e2e-summary.json` (including which seat secrets were ephemeral vs
operator-provided); exits non-zero if any acceptance assertion fails.

## Primitive-composition demo

```bash
node docs/runs/proposal-lifecycle/run-proposal-lifecycle.mjs
```

Composes the merkle-dag substrate + recorder/gate directly (no workshop / outer loop) to isolate
the primitives. Three variants, each an acceptance assertion:

| Variant | What it proves | Outcome |
|---|---|---|
| `authorized` | candidate compiled with lifecycle metadata → recorder writes draft/creation/candidate → `validateProposalLifecycle` reconstructs state from the ledger → authorized decision writes the closed `POLICY_CONTRACT_V1` certificate → `runBuild({requireAuthorizedDecision})` reads the authorization from disk | `merge_status: "ready"` |
| `obligation` | a verification obligation whose discharge node is never settled | `merge_status: "blocked"`, `reason: "undischarged verification obligation"` |
| `blocked` | a verified-blocker finding routes the decision to `blocked` | `runBuild` refuses with `DECISION_NOT_AUTHORIZED` (no dispatch) |

`run-summary.json` is regenerated on each run. The script exits non-zero if any
acceptance assertion fails, so it doubles as executable evidence in CI (the
`fail-closed-proof` job runs both scripts on every push and pull request).
