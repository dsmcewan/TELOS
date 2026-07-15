---
title: "Mythological Namespace Policy"
type: reference
tags:
  - topic/architecture
  - workflow/naming
---

# Mythological Namespace Policy

Within this project, mythological names, figures, places, objects, and concepts are reserved architectural identifiers.

Do not use mythology as casual metaphor, humor, shorthand, incident naming, or descriptive language unless the term has been explicitly registered with a canonical system meaning.

- Registered mythological terms retain exactly their defined meaning.
- Unregistered mythological terms must not be introduced without human approval.
- When no registered term applies, use plain descriptive language.
- Do not infer ownership from mythological resemblance.

This restriction does not prevent discussion of mythology as a subject. It governs mythology used as project vocabulary.

## Registered terms

These names are reserved architectural terms, not decorative metaphors.
Use them only with their defined meanings.

- **Daedalus** — collaboratively matures implementation plans.
- **TELOS** — governs review, evidence, authorization, and execution boundaries.
- **Argo** — carries an authorized plan through implementation, verification, and documentation.
- **Hermes** — API management and inter-system communication: routing, contracts, translation, and delivery.
- **Medusa** — defensive edge enforcement; blocks or quarantines hostile and nonconforming traffic.
- **Narcissus** — iterative UI rendering and visual review through repeated reflection.
- **Clotho** — creates and maintains knowledge-graph threads across artifacts and repositories.
- **Lachesis** — measures dependencies, relevance, risk, and blast radius.
- **Atropos** — retires obsolete relationships, artifacts, tools, and processes.
- **The Iliad** — the umbrella system: the coordinated whole under which the registered components operate; organizes module plans and their cross-plan dependencies (using Clotho's weave).
- **The Eye** — human-held authority required for the system to act on self-improvement proposals.

Anything not on this list is unregistered. Unregistered ≠ available.

## Why a namespace, not a list of forbidden misuses

This is the project's own discipline applied to vocabulary: **closed sets over open assertions** (see
`docs/design-by-adversarial-review.md`), the same shape as the `NA_ALLOWED` allowlist, `EVIDENCE_KINDS`,
and `build-gate/check-registry.mjs`. A list of banned misuses is an open assertion — it constrains only
the cases someone thought to enumerate, and it silently leaves every unclaimed name free to be grabbed
ad hoc. Reserving the namespace inverts the default: registered terms mean exactly what they mean,
everything else is denied until a human registers it. That also **preserves the unused names** for
components that do not exist yet.

The failure this prevents is **fake ownership**: a name attached to something it does not own makes
blame or credit land on a component that did nothing (chat-rendering corruption is not a Hermes failure
unless Hermes handled that transport path). That is the content-address rule one layer up — a mutable
label standing where an identity belongs. A name drifting from its referent is the same defect whether
it keys an enforcement decision or an attribution.
