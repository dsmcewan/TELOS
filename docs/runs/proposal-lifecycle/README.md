# Proposal-lifecycle run evidence

Keyless, deterministic end-to-end evidence for the Proposal Lifecycle contract
(`contracts/Proposal Lifecycle.md`). No API keys, no network — an ephemeral
proposal-controller Ed25519 key signs a real `.telos/proposal.jsonl` chain, and
the real merkle-dag substrate settles the build.

```bash
node docs/runs/proposal-lifecycle/run-proposal-lifecycle.mjs
```

Three variants, each an acceptance assertion:

| Variant | What it proves | Outcome |
|---|---|---|
| `authorized` | candidate compiled with lifecycle metadata → recorder writes draft/creation/candidate → `validateProposalLifecycle` reconstructs state from the ledger → authorized decision writes the closed `POLICY_CONTRACT_V1` certificate → `runBuild({requireAuthorizedDecision})` reads the authorization from disk | `merge_status: "ready"` |
| `obligation` | a verification obligation whose discharge node is never settled | `merge_status: "blocked"`, `reason: "undischarged verification obligation"` |
| `blocked` | a verified-blocker finding routes the decision to `blocked` | `runBuild` refuses with `DECISION_NOT_AUTHORIZED` (no dispatch) |

`run-summary.json` is regenerated on each run. The script exits non-zero if any
acceptance assertion fails, so it doubles as executable evidence in CI.
