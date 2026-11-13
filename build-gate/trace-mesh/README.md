# Scoped stigmergic three-agent mesh — first slice

Status: **reference integration on a feature branch**, not production deployment. Node 22+, no runtime dependencies.

This module implements a scoped shared trace store with three mutually observing subagents. A parent worker defines the bounded scope and deterministic success criterion but remains **outside** the mesh. Every agent must read current peer traces before another write; no ordinary direct-message API exists. The parent receives a trace reference, not a review report. The store **blocks parent reads during active work**; a parent can read only after the scope closes or an external gate has accepted escalation. An agent-authored danger trace cannot fake this release.

**Trace fields:** id, scope, author, type (claim / contradiction / evidence / result / danger / info), payload, intensity, version, created_at, optional expires_at, supersedes, invariant_link, response_to. Accepted traces are append-only JSONL. Superseded traces remain in the audit record.

**Bounds:** exactly three distinct peers, parent read-only, time limit, max writes, small payloads, scoped read authorization, required peer-read watermark. If the parent belongs to an outer mesh, its decision to spawn a team appears as an info trace in that outer scope. The parent's own peers may scrutinize that deployment.

**TELOS boundary:** a structured `payload.state_change` calls a mandatory injected `validateProposedStateChange` gate adapter before admission; an invalid claim is refused. The trace store **does not** commit authoritative world state and peer consensus cannot bypass the independent TELOS build and ledger gates. The deterministic sample runner injects a *test gate*. The live review runner uses the TELOS adapter in fail-closed read-only mode and cannot fabricate an accepted external escalation.

## Run

From `build-gate/`:

```sh
npm run test:trace-mesh
node scripts/trace-mesh-real-task.mjs ./run-data
```

The experiment compares `teams.mjs` to `scripts/test-teams.mjs` for whether unknown-workstream fallback is intentional. S1 raises a provisional concern, S2 challenges it with existing tests, S3 confirms the source, and S1 corrects locally.

## Model-backed comparison (opt-in)

Run `cd build-gate && npm run test:trace-mesh:live` only in an environment with **three** configured provider model seats (API key **and** model identifier), from `ANTHROPIC_*`, `OPENAI_*`, `GEMINI_*`, and/or `XAI_*`. It uses TELOS's existing `ai-peer-mcp` transport with `include_provenance:true` and rejects any model reply missing its provider response ID. No API keys are ever recorded in trace files.

The task is the existing larger-context verification-stage contract in `build-gate/build-orchestrator.mjs` and `build-gate/scripts/test-verify-stage.mjs`: missing/malformed verification is advisory by default but blocks when `requireVerify:true`. Three distinct model calls with complementary slices and reciprocal shared traces are compared to a serial worker followed by an independent full-source reviewer. The deterministic acceptance oracle is tied to the checked-in code and test assertions.

**If three seats are unavailable, the runner exits with `BLOCKED_NO_LIVE_SEATS` (code 2) and produces no fake model measurements.** CI tests that fail-closed path without running billable inference. A one-shot GitHub Actions probe on November 13 found **0/4** configured key+model seat pairs; the branch workflow is now manual-only. Live results, when available, are kept outside the repository unless explicitly reviewed. This experiment does not measure token costs or establish a speed/cost advantage by itself.

The review experiment is read-only: its TELOS adapter has no authorized plan or escalation receiver, so state-change proposals and attempted escalations fail closed. The production TELOS authorization path is unchanged and has not been substituted with peer consensus.

## TELOS adapter contract

`trace-mesh/telos-gate.mjs` delegates authorization to the existing `merkle-dag/orchestrate.mjs#checkLifecycleAuthorization` and `merkle-dag/merkle.mjs#readPlan`. It will only admit a `state_change.action: "propose_node_delta"` whose exact `node:<node_id>` scope, declared node, file, plan hash, and `invariant_link` match the authorized current plan, after the **real** signed proposal decision and lifecycle state are reverified.

An admitted proposal is **not** an executed mutation. The trace store never writes source artifacts, modifies world state, or settles ledger entries; TELOS's existing Rule-3 verifier and controller remain the only authorized execution path. No external escalation acknowledgment is fabricated: `onEscalation` must be explicitly provided by a legitimate external receiver.

The adapter tests include a negative unsigned plan, an accepted test authorization injected for isolated unit tests, and a genuinely signed TELOS proposal-ledger fixture (Ed25519) with a clean lifecycle vs a simulated post-decision hold. These test *trace admission* rather than live worker behavior.

## Three metrics only

1. `contradiction_first_peer_reaction_ms` — monotonic delay from committed contradiction trace to first different peer replying to that trace.
2. `corrections_remaining_in_team` — locally resolved corrections / total recorded corrections.
3. `escalations_to_external_invariant_gate` — number of **host-observed external gate replies**, whether accepted or rejected. Agent-authored danger traces do not count; a thrown transport call cannot prove delivery. Normal gate validation of a state-change proposal is not an escalation.

**Evaluation boundary:** This is a deterministic agent-callback harness on a real repository review question, not a live LLM swarm. The local standalone run used source-verified excerpts; running inside this GitHub branch reads the full repository files. It does not establish improvement versus a large-context reviewer, nor does the JSONL implementation claim cross-process transactional safety.

Not yet proven or deployed: a genuine model-backed A/B benchmark (requires provider credentials), an operational external escalation receiver, integration into the production builder's task dispatch, cross-process transactional concurrency/recovery, and a distributed context mesh.

Verification evidence (signed TELOS decision, Node 22/24 test results, and live-seat blocker): [docs/runs/trace-mesh-first-slice/VERIFICATION.md](../../docs/runs/trace-mesh-first-slice/VERIFICATION.md).
