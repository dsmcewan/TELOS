# Scoped stigmergic three-agent mesh — first slice

Status: **reference integration on a feature branch**, not production deployment. Node 22+, no runtime dependencies.

This module implements a scoped shared trace store with three mutually observing subagents. A parent worker defines the bounded scope and deterministic success criterion but remains **outside** the mesh. Every agent must read current peer traces before another write; no ordinary direct-message API exists. The parent receives a trace reference, not a review report.

**Trace fields:** id, scope, author, type (claim / contradiction / evidence / result / danger / info), payload, intensity, version, created_at, optional expires_at, supersedes, invariant_link, response_to. Accepted traces are append-only JSONL. Superseded traces remain in the audit record.

**Bounds:** exactly three distinct peers, parent read-only, time limit, max writes, small payloads, scoped read authorization, required peer-read watermark. If the parent belongs to an outer mesh, its decision to spawn a team appears as an info trace in that outer scope. The parent's own peers may scrutinize that deployment.

**TELOS boundary:** a structured `payload.state_change` calls a mandatory injected `validateProposedStateChange` gate adapter before admission; an invalid claim is refused. The trace store **does not** commit authoritative world state and peer consensus cannot bypass the independent TELOS build and ledger gates. The sample runner injects a deterministic *test gate*, not the production TELOS gate.

## Run

From `build-gate/`:

```sh
npm run test:trace-mesh
node scripts/trace-mesh-real-task.mjs ./run-data
```

The experiment compares `teams.mjs` to `scripts/test-teams.mjs` for whether unknown-workstream fallback is intentional. S1 raises a provisional concern, S2 challenges it with existing tests, S3 confirms the source, and S1 corrects locally.

## Three metrics only

1. `contradiction_first_peer_reaction_ms` — monotonic delay from committed contradiction trace to first different peer replying to that trace.
2. `corrections_remaining_in_team` — locally resolved corrections / total recorded corrections.
3. `escalations_to_external_invariant_gate` — number of explicit exception escalations; normal gate validation of a state-change proposal is not counted as an escalation.

**Evaluation boundary:** This is a deterministic agent-callback harness on a real repository review question, not a live LLM swarm. The local standalone run used source-verified excerpts; running inside this GitHub branch reads the full repository files. It does not establish improvement versus a large-context reviewer, nor does the JSONL implementation claim cross-process transactional safety.

Later work (deliberately excluded): live model adapters, production TELOS gate binding, cross-process concurrency/recovery, A/B long-context review benchmark, tracing extra dimensions, distributed context mesh.
