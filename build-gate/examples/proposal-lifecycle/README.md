# Example — opt-in proposal lifecycle

`dossier.json` here shows the **opt-in flag** that switches `buildProject` from the legacy advisory
path to the audited-judgment proposal lifecycle:

```json
{ "proposal_lifecycle": true, "max_revisions": 3, ... }
```

When `dossier.proposal_lifecycle === true`, `build-gate/build-orchestrator.mjs` delegates to
`build-gate/proposal-orchestrator.mjs` (`runProposalLifecycle`), which:

1. single-sources the proposal-controller key (`TELOS_PROPOSAL_CONTROLLER_SK` if set, else an
   ephemeral per-run key) and pins its public key into the plan's `authorized_signers`;
2. runs the **Daedalus** claude/codex workshop over the decomposed task list;
3. compiles the candidate (minting a dedicated verification node for any reviewer-required
   `required_verification`), writes it, and records it to `.telos/proposal.jsonl`;
4. runs the **review council** bound to the exact plan hash, mints concerns via
   `processReviewPackets` (the sole controller-side minter), and derives an authorization decision
   the gate reconstructs from the ledger;
5. on `authorized`, runs the build with execution-time lifecycle re-verification and Rule-3
   obligation discharge.

This example is a **shape reference** — the fields a caller supplies. For a runnable, keyless,
end-to-end demonstration (with mock seats and asserted outcomes), run the evidence script:

```bash
node docs/runs/proposal-lifecycle/run-lifecycle-e2e.mjs
```

**Trust boundaries / limits** (documented in `CLAUDE.md`): the proposal-controller and
build-controller are one trust principal; protected-path enforcement is at decision time against
`dossier.write_targets`; live-key runs and cross-process durable resume of the autonomous entry point
are out of scope. Non-authorizing outcomes surface as `blocked` / `human-review-required`
(workshop stalemate, revision-budget exhaustion, unresolvable verification) / `DECISION_NOT_AUTHORIZED`.
