# Design: Daedalus Family Multi-Model Seat Lifecycle

**Date:** 2026-07-21

**Status:** Hardened design candidate. The Eye approved the brainstorming
sections in this session: architecture, components, lifecycle, pass-or-return
failure handling, and testing contract. This document is still a written-spec
review artifact. It grants no implementation authority.

**Target:** `multi-model-seats` lifecycle engine and TELOS workflow profile

**Decision prefix:** `DFM`

## Authority boundary

The active repository authorization is `authz-008`, bound to the completed
Clotho v15 plan. It does not authorize this work. This design must enter the
Iliad lifecycle as a pre-review artifact, mature into a file-specific Daedalus
plan, receive TELOS authorization against the exact plan root, and then be
implemented under Argo with the normal comprehension and verification gates.

This design does not amend upstream Superpowers. Superpowers remain the
human-facing workflow skills. The new machinery belongs in `multi-model-seats`:
a generic hashed lifecycle engine plus a TELOS-specific Daedalus family profile.
TELOS consumes the resulting roots, provenance, decision nodes, and evidence.

Model consensus is not authority. Daedalus, Icarus, Grok, and Gemini may author,
criticize, reject, accept, and recommend. The Eye authorizes exact roots.

## Problem

TELOS already has strong governance primitives: content hashes, provenance,
controller-written records, disk truth, and exact-plan authorization. The
missing piece is a reusable multi-model lifecycle that turns those primitives
into a concrete feature/module implementation flow:

- plan authorship and feasibility friction before code exists;
- cold adversarial review before a plan can be authorized;
- code authorship and architecture review after plan authorization;
- cold adversarial review before implementation acceptance;
- a Merkle-DAG node for every state-changing decision; and
- no automatic terminal failure when a model refuses, a provider dies, or a
  loop takes longer than expected.

The workflow exists because friction produces hardened plans and hardened code.
Friction is not a social nicety; it is a governance control.

## Roles

This design uses the user's Daedalus family language without registering new
TELOS mythological terms beyond the repository's existing vocabulary. Registered
TELOS meanings remain authoritative.

| Name | Seat | Responsibility |
|---|---|---|
| Daedalus | Claude / Anthropic seat | Design, plan authorship, architecture review, orchestration, recovery diagnosis |
| Icarus | GPT / Codex / OpenAI seat | Feasibility review, code authorship, tests, remediation |
| Grok | xAI seat | Cold adversarial plan and code review |
| Gemini | Google seat | Cold adversarial plan and code review |
| TELOS | Controller/gate | Hashes artifacts, validates provenance, enforces gate order |
| The Eye | Human authority | Authorizes exact plan and implementation roots |

Provider model IDs are runtime provenance, not authority labels. A configured
seat may use different concrete models over time, but every audited decision
must record the exact provider, model, request provenance, and artifact root it
judged.

## Architecture

Version 1 uses a generic engine plus a workflow profile.

| Component | Owns | Must not own |
|---|---|---|
| Daedalus-cycle skill entrypoint | User-facing invocation and narrative workflow | Hashing, authorization, hidden mutable state |
| Workflow profile | Required stages, required seats, transition rules, gate order | Provider credentials or provider-specific prompts |
| Lifecycle engine | Deterministic state transition validation and Merkle-DAG assembly | Human authority decisions or model judgment |
| Seat adapters | Provider calls, provenance capture, fail-loud results | Gate bypass or seat substitution |
| Artifact store | Canonical bytes, decision nodes, evidence refs, roots | Mutable labels as authority |
| TELOS gate adapter | Exact-root handoff to TELOS proposal/authorization flow | Replacing TELOS authorization |

The first implementation should live in the source copy of `multi-model-seats`,
then be installed through the normal plugin path. It must not patch the installed
cache as the source of truth.

## Superpowers mapping

There are no literal upstream Superpowers named "reviewing plans",
"adversarial reviewing plans", or "writing code plans". The profile maps the
desired product lifecycle onto the actual available skills:

```text
brainstorming
  -> writing-plans
  -> executing-plans / subagent-driven-development
  -> requesting-code-review
  -> receiving-code-review
  -> verification-before-completion
  -> finishing-a-development-branch
```

The lifecycle engine records this mapping as policy data. It does not fork or
modify Superpowers. If an upstream skill changes, the profile must be reviewed
as data instead of silently changing lifecycle behavior.

## Merkle-DAG decision nodes

Every state-changing decision grows the DAG. This includes pass decisions, fail
decisions, refusal, provider outage, invalid provenance, unresolved objection,
failed test evidence, stale descendant rejection, Eye pause, Eye cancel, Eye
amendment, and Eye adjudication.

A decision node has this closed shape:

```json
{
  "node_version": "dfm.decision.v1",
  "node_type": "decision",
  "stage": "plan-pair",
  "artifact_hash": "sha256:...",
  "parent_hashes": ["sha256:..."],
  "input_refs": ["sha256:..."],
  "output_refs": ["sha256:..."],
  "actor": {
    "seat": "daedalus",
    "provider": "anthropic",
    "model": "recorded-per-call"
  },
  "provenance_ref": "sha256:...",
  "decision": {
    "verdict": "pass",
    "findings": [],
    "dispositions": []
  },
  "evidence_refs": ["sha256:..."],
  "policy_ref": "sha256:...",
  "recorded_at": "controller-time",
  "controller_signature": "..."
}
```

Only canonical bytes, hashes, parentage, policy refs, provenance refs, and
controller signatures are authority-bearing. Mutable names, timestamps, chat
summaries, and model self-report are not authority.

Raw private reasoning and transient conversation are not authoritative nodes.
They may be cited only when promoted into controller-written evidence.

## Lifecycle

The approved lifecycle is:

1. The Eye freezes the requirement frame.
2. Daedalus drafts the plan.
3. Icarus reviews the plan for feasibility, tests, file footprint, and
   implementation risk.
4. Daedalus and Icarus iterate until pair gate `P1` passes on an exact plan
   root.
5. Grok and Gemini independently perform cold adversarial plan review.
6. Daedalus and Icarus remediate any adversarial objections.
7. Grok and Gemini re-review until adversarial gate `P2` passes on the exact
   descendant plan root.
8. The Eye authorizes that exact plan root.
9. Icarus writes code under the authorized plan.
10. Daedalus reviews code for architectural fidelity and governance fit.
11. Icarus and Daedalus iterate until code pair gate `C1` passes on an exact
    implementation root.
12. Grok and Gemini perform cold adversarial code review.
13. Icarus and Daedalus remediate any adversarial objections.
14. Grok and Gemini re-review until adversarial code gate `C2` passes on the
    exact descendant implementation root.
15. TELOS re-derives disk truth: source tree, tests, evidence, and policy
    obligations.
16. The Eye accepts or returns the implementation by exact root.
17. Iliad retrospective records closure/enrollment evidence.

No code stage may begin before The Eye authorizes the exact plan root. `P2` may
not run before `P1`. `C2` may not run before `C1`. Any mutation after a pass
creates a new descendant root and invalidates downstream decisions that were
made against the old root.

## Pass-or-return failure rule

There are no automatic round caps, retry caps, time caps, or cost caps that can
convert unfinished work into a terminal workflow result.

If a stage does not pass, or if it dies, it goes back to Daedalus.

Examples of "dies" include provider unavailability, malformed response,
truncated evidence, invalid provenance, missing required seat, failed test,
unresolved objection, stale hash, schema rejection, or verifier refusal. The
engine must:

1. write an immutable non-pass decision node;
2. preserve the failed root, evidence, objections, and incomplete obligations;
3. route the packet to Daedalus for diagnosis and redesign;
4. create a descendant root for the next attempt; and
5. rerun every applicable gate against that descendant root.

The Eye may explicitly pause, cancel, amend policy, or adjudicate an impossible
requirement through separately signed decision nodes. These actions are human
authority records, not automatic caps and not model consensus.

Required seat substitution is forbidden. If Grok is required and unavailable,
Gemini cannot impersonate Grok. If Gemini is required and unavailable, Grok
cannot manufacture Gemini's pass. Missing required seats produce non-pass nodes
and return to Daedalus.

## Testing and acceptance

The implementation is acceptable only when deterministic tests prove the
lifecycle, not merely the happy path.

| Test family | Required assertions |
|---|---|
| Canonical hashing | Golden vectors reproduce exact roots from canonical JSON and stored bytes |
| DAG integrity | Missing parents, cycles, stale descendants, and root mismatches fail closed |
| Gate order | `P2` cannot run before `P1`; code cannot start before Eye plan authorization; `C2` cannot run before `C1` |
| Decision completeness | Every pass, non-pass, death, Eye action, mutation, and retry records a decision node |
| Mutation handling | Any artifact mutation creates a new root and invalidates old downstream decisions |
| Seat provenance | Required actors cannot be skipped, spoofed, substituted, or self-approved |
| Failure routing | Every non-pass from every stage returns to Daedalus with a failure packet |
| Provider adapters | Unit tests mock providers; live provider calls are not required for deterministic tests |
| Disk truth | Rule-3 style tree hash, tests, and evidence are independently rerun from checkout |
| Secret handling | Prompts, evidence, and provenance redact credentials and never persist tokens |
| End-to-end proof | One synthetic idea reaches Iliad closure with inspectable roots at every transition |

Negative controls must include out-of-order execution, reviewer self-approval,
provider outage, malformed provenance, truncated evidence, failed tests,
unresolved findings, stale Eye authorization, and attempted seat substitution.

## Non-goals

- No change to upstream Superpowers.
- No claim that model agreement is authorization.
- No autonomous release, merge, or enrollment.
- No hidden mutable lifecycle state.
- No live provider dependency in deterministic tests.
- No storage of provider API keys, OAuth tokens, or secrets in lifecycle records.
- No automatic terminal failure due to cap exhaustion.
- No new registered TELOS mythological component names in this design.

## Implementation sketch

The future implementation plan should decompose this into file-specific steps:

1. Add profile data under `multi-model-seats` describing stages, seats, gate
   order, required decisions, and return transitions.
2. Add a canonical decision-node schema and hashing helper.
3. Add a lifecycle engine that validates transitions and appends nodes through
   a controller-only writer.
4. Add provider adapter wrappers that convert provider failures into non-pass
   decision packets.
5. Add TELOS export records that hand exact roots and provenance to the
   proposal lifecycle.
6. Add deterministic tests and golden fixtures before any live-provider
   demonstration.

The implementation plan must identify the exact plugin source checkout,
installation/update path, and verification commands before editing plugin code.

## Open written-spec review questions

1. Should Seat 5 / `agy` remain outside this v1 profile, or should it record
   neutral process checks for lifecycle completeness?
2. Should the lifecycle store use TELOS `.telos/` proposal records, a
   plugin-local records directory, or both with one declared source of truth?
3. What is the first synthetic module used for the end-to-end proof run?

