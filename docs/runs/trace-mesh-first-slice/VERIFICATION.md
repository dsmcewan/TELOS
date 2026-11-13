# TELOS trace mesh: first-slice verification (2026-11-13)

## Decision and scope

**Status: draft / unmerged.** This verifies a bounded three-peer trace mesh and an external TELOS trace-admission adapter. It does not claim a production distributed runtime, live multi-model correctness improvement, or reduction in inference cost.

PR: https://github.com/dsmcewan/TELOS/pull/205

## Test coverage (GitHub Actions)

CI: https://github.com/dsmcewan/TELOS/actions/runs/43482766498

- Node 22 build-gate: **pass**; 23/23 trace-mesh regression tests, 13/13 TELOS adapter tests.
- Node 24 build-gate: **pass**; 23/23 trace-mesh regression tests, 13/13 TELOS adapter tests.
- Institutional-memory closed-context checks: **pass**.
- Remaining repository-wide failure, when present, is outside this slice: Narcissus flagship dependency security audit.

Newly exercised safety boundaries: parent read embargo until completion or accepted escalation; spoofed danger traces cannot open it or inflate gate counts; audit is written before a gate escalation; malformed and stale context fail closed; node-delta proposals require matching node scope, file declaration, plan hash, invariant pointer, and real TELOS lifecycle authorization; accepted proposal trace has no ability to execute a write.

### Signed authorization check

A test creates a real Ed25519 signer, compiles a content-addressed TELOS plan, writes a signed proposal decision and its policy-result artifact, and asks `checkLifecycleAuthorization` to re-derive the authorization. The adapter admits a declared `node:N1` proposal *as a trace only*. The same proposal fails with a simulated post-decision hold. No build file or world state is mutated.

## Three prescribed metrics — deterministic task

Task: reconcile the actual `teamForNode` fallback behavior in `build-gate/teams.mjs` with its unit tests in `build-gate/scripts/test-teams.mjs`. The agents in this **deterministic callback experiment** emit a claim, contradiction, evidence, and local correction. This is source-grounded, but the correction was scripted, not discovered by an LLM.

| Metric | Node 22 | Node 24 |
| --- | ---: | ---: |
| Contradiction-to-first-peer response | 2.044 ms | 2.405 ms |
| Corrections kept inside local mesh | 1/1 (100%) | 1/1 (100%) |
| Confirmed external gate deliveries | 0 | 0 |

The times above are event-loop callback timings, **not** inference times or baseline reviewer timings. The third metric counts host-observed gate replies, not agent-authored danger messages; a transport exception has no verified delivery receipt.

## Genuine provider-backed comparison

Workflow run: https://github.com/dsmcewan/TELOS/actions/runs/43482195755

**Result: BLOCKED_NO_LIVE_SEATS.** The secure branch-only probe found **0 of 4** configured provider key+model pairs in GitHub Actions; it skipped model inference and produced no synthetic model-backed results. The workflow was subsequently changed to **manual-only** to prevent unplanned billable runs. No model-cost or accuracy advantage is established.

The opt-in runner is `cd build-gate && npm run test:trace-mesh:live` with at least three configured provider seats. It compares a source-backed three-agent mesh against a serial worker/reviewer on the existing `build-orchestrator.mjs` verification-stage contract, with provider response provenance required. The task is read-only and does not use a fabricated external TELOS approval.

## Trust boundary and next execution condition

The trace-store authorization is **an API/role boundary in a single trusted process**, not an OS sandbox or a cross-process transactional database. Agents receive scoped closures; a trusted controller with filesystem access could still inspect the JSONL file. World-specific invariants for ARGO are separate from the TELOS build-plan adapter.

To obtain actual effectiveness evidence, run the opt-in comparison in an environment with **three real provider key+model pairs**. Report its three metrics as model-backed results, distinguish accuracy from agreement, and do not treat successful structural tests as proof of savings. Keep the feature branch unmerged until the comparison is reviewed.
