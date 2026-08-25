# TELOS — Engineering Portfolio Brief

## What I built

TELOS is a verification-first governance system for AI-mediated engineering work. It separates proposing work, reviewing it, establishing authority, implementing it, and accepting it so no model or agent can promote its own output simply by asserting confidence.

The core design principle is:

> **An assertion cannot supply the evidence required to promote itself.**

TELOS asks an upstream question that runtime policy systems usually assume has already been answered:

> **What evidence justifies granting this work authority to proceed?**

## The engineering problem

Agentic development systems can generate plans and code rapidly, but speed creates an authority problem. A model can propose a change, critique it, revise it, and then confidently declare it ready. If those stages share the same unverified context, apparent review can collapse into self-confirmation.

TELOS makes promotion an externally verifiable state transition.

Independent review seats produce attributable evidence packets. Deterministic gates validate required approvals, edits, hard stops, provenance, reviewed documentation, proposal lifecycle state, and optional capability/readiness controls. Authorization is bound to an exact plan/artifact hash rather than a filename or narrative description.

## Architecture at a glance

```text
proposal / plan
      ↓
independent review seats
      ↓
provenance-bound evidence packets
      ↓
deterministic verification gate
      ↓
explicit authorization
      ↓
separate implementation authority
      ↓
implementation slices + acceptance
      ↓
institutional authority / lineage record
```

The system preserves prior decisions rather than rewriting history. A previously valid authorization can remain historically authentic while being explicitly superseded and prohibited from governing new work.

## What this demonstrates

- **AI governance architecture** — proposal, review, authorization, implementation, and acceptance are separate responsibilities.
- **Multi-provider orchestration** — independent model seats contribute attributable review rather than a single model grading itself.
- **Deterministic gates** — machine-verifiable artifacts, not conversational confidence, decide whether work may advance.
- **Cryptographic provenance** — signed review material and content hashes bind decisions to specific artifacts and producers.
- **Merkle-DAG / lineage thinking** — governance artifacts preserve dependency relationships so downstream authority can be tied to the exact evidence and prior state from which it derives.
- **Fail-closed behavior** — missing or invalid required evidence becomes a blocker rather than an invitation to infer intent.
- **Supersession** — historical authorization and current governing authority are modeled as different facts.
- **Institutional memory** — the repository maintains a machine-readable answer to what governs new work now.
- **Human authority boundaries** — implementation authority remains distinct from model recommendation and gate verification.
- **Extensible assurance** — capability, market-readiness, protected-path, proposal-lifecycle, and evidence controls can be evaluated without turning model output into authority.

## Code worth reviewing

| Area | File / directory | Why it matters |
|---|---|---|
| Deterministic gate | `build-gate/gate.mjs` | Enforces required seats, approval state, edits/stops, authenticated evidence, provenance, documentation review, and optional assurance controls. |
| Proposal lifecycle | `build-gate/proposal-gate.mjs` | Reconstructs and validates proposal state rather than trusting caller-supplied status. |
| Review council | `build-gate/council.mjs` | Coordinates independent review seats. |
| Evidence | `build-gate/evidence.mjs` | Handles evidence used by the governance path. |
| Concerns | `build-gate/concerns.mjs` | Represents and normalizes concerns instead of burying them in free-form model prose. |
| Orchestration | `build-gate/build-orchestrator.mjs` | Connects the governed build workflow. |
| Current authority | `CURRENT-AUTHORITY.json` | Machine-readable active plan, authorization, implementation authority, amendments, accepted slices, and superseded authorities. |
| Governance contracts | `contracts/` | Defines proposal lifecycle and multi-model build-gate behavior. |

## Why the Merkle-DAG / provenance model matters

A signature answers:

> Who authenticated this artifact?

A content hash answers:

> Is this still the exact artifact that was reviewed?

A governance dependency graph answers:

> **Which exact evidence, reviews, amendments, and prior authority did this decision depend on?**

That distinction matters because engineering governance is not naturally linear. An authorization can depend on several independent reviews and evidence artifacts, later produce multiple implementation slices, and eventually be superseded without erasing the historical record.

## What TELOS is — and is not

TELOS is primarily an **authority-formation and engineering-governance layer**.

It does not need to become every adjacent control system. Runtime credential isolation, per-tool execution policy, portable capability tokens, and infrastructure sandboxing can sit downstream of the authority TELOS establishes.

A clean boundary is:

```text
evidence
   ↓
TELOS: has this work earned authority?
   ↓
scoped delegation / capability
   ↓
runtime guard: may this action occur now?
   ↓
executor
```

## Relevant roles

This project is representative of work in:

- AI Systems Engineering
- Agentic AI Engineering
- AI Governance / Responsible AI Engineering
- AI Assurance and Evaluation
- Forward-Deployed Engineering
- Developer Platform Engineering
- AI Security Architecture
- Technical Product Incubation

## Design philosophy

TELOS and Convergence solve different problems using the same systems principle:

> **Generation may propose. Promotion requires independent evidence.**

Convergence applies that principle to whether a claim becomes a finding. TELOS applies it to whether proposed work earns authority.