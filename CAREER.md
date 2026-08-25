# TELOS — Engineering Portfolio Brief

> **Hiring-manager path:** TELOS is the governance/agent-systems project in this portfolio. The main README is the technical reference; this page explains the engineering signal quickly.

## What it solves

TELOS is a verification-first governance system for AI-mediated engineering work. It keeps five events separate: **proposal, review, authorization, implementation, and acceptance**.

The governing rule is:

> **An assertion cannot supply the evidence required to promote itself.**

An agent can propose work. A model can review it. Neither action, by itself, creates authority.

## Why I built it

Agentic development makes it easy for the same probabilistic system to propose a change, critique it, revise it, and then declare itself ready. That can look like independent review while remaining one correlated reasoning path.

TELOS turns promotion into a verifiable state transition. Required review evidence is attributable, bound to exact artifacts, checked deterministically, and preserved in an authority history that distinguishes **what was once valid** from **what governs new work now**.

## Core architecture

```text
proposal / plan
      ↓
independent review seats
      ↓
authenticated + provenance-bound evidence
      ↓
deterministic gate
      ↓
AUTHORIZED | NOT_AUTHORIZED
      ↓
separate human implementation authority
      ↓
implementation + independent verification
      ↓
acceptance / merge remain separate decisions
```

## Concrete engineering mechanisms

- **Content-addressed plans and artifacts** — decisions bind to hashes, not mutable labels.
- **Required independent seats** — missing or dissenting required review blocks progression.
- **Authenticated review packets** — signatures/HMAC and provenance are verified before evidence is trusted.
- **Deterministic gates** — disk state, signatures, hashes, tests, and lifecycle records decide readiness.
- **Fail-closed behavior** — missing, malformed, stale, or contradictory evidence blocks instead of being inferred around.
- **Merkle-DAG / dependency lineage** — downstream state can be tied to the exact upstream artifacts it depends on.
- **Ed25519 decision ledger** — settlement records are tamper-evident and independently verifiable.
- **Supersession** — an older authorization can remain historically authentic while being prohibited from governing new work.
- **Separation of duties** — review, authorization, implementation authority, acceptance, and merge are not collapsed into one actor.
- **Institutional memory** — `CURRENT-AUTHORITY.json` provides a machine-readable answer to “what governs new work now?”

## Proof points in the repository

- `node docs/runs/fail-closed-demo/run.mjs` demonstrates signature-tamper rejection and a halted out-of-bounds action without API keys or network access.
- The core packages run on **Node 18+ with zero runtime dependencies**.
- `build-gate/gate.mjs` enforces required seats, signatures, provenance, reviewed evidence, and lifecycle constraints.
- `CURRENT-AUTHORITY.json` records active authority, accepted slices, amendments, and superseded authorities.
- `merkle-dag/` provides the content-addressed execution substrate.
- `contracts/` and `AI-START-HERE.md` document the governed operating model and load order.

## Best code-review entry points

| Area | Start here |
| --- | --- |
| Deterministic approval gate | `build-gate/gate.mjs` |
| Proposal lifecycle | `build-gate/proposal-gate.mjs` |
| Council / review routing | `build-gate/council.mjs` |
| Evidence handling | `build-gate/evidence.mjs` |
| Typed concerns / blockers | `build-gate/concerns.mjs` |
| Governed build orchestration | `build-gate/build-orchestrator.mjs` |
| Current institutional authority | `CURRENT-AUTHORITY.json` |
| Architecture map | `repository-manifest.json` |

## Boundary discipline

TELOS is strongest when it stays focused on **earning engineering authority**. It is not trying to become a secrets manager, IAM product, or per-tool runtime sandbox.

A downstream runtime can consume the authority TELOS establishes:

```text
evidence → TELOS authority → scoped delegation → runtime guard → executor
```

That keeps governance of *why work may proceed* separate from runtime enforcement of *whether this exact action may happen now*.

## What this demonstrates to an employer

TELOS is evidence of work in:

- AI systems and agent architecture
- deterministic controls around probabilistic systems
- multi-model / multi-seat orchestration
- provenance and cryptographic verification
- content-addressed data structures
- fail-closed workflow design
- policy and lifecycle modeling
- separation of duties
- testing and adversarial verification
- turning governance requirements into executable software rather than documentation alone

## Relevant roles

AI Systems Engineer · Forward-Deployed Engineer · Agentic AI Engineer · AI Assurance / Evaluation Engineer · AI Governance Engineer · Developer Platform Engineer · AI Security / Trust Engineering

## Portfolio connection

**Convergence asks when evidence has earned a finding. TELOS asks when evidence has earned authority.** Both use the same underlying rule: generation may propose; promotion requires independent proof.
