---
title: Claude-Led Multi-Model Prototype Workflow
author: codex
last-edited-by: claude-code
last-edited-at: 2026-06-27
workflow-status: active-draft
source-workflow: prototype-build
tags:
  - type/workflow
  - domain/prototyping
  - workflow/build-gate
  - model/claude
  - model/agy
  - model/codex
  - model/grok
---

# Claude-Led Multi-Model Prototype Workflow

This workflow turns future ideas into prototypes. It is not a vault-mapping workflow. The vault is only the coordination surface where model documentation, capability packets, gate reports, and prototype plans are stored.

## Telos

The telos is to turn an idea into the strongest feasible prototype by making every model discover the documentation, skills, connectors, and helper tools it needs before implementation begins.

For market-bound projects, TELOS goes further: it must move the current project state toward a professional, market-ready product. That means business thesis, architecture, backend, schema, security, accuracy, scalability, frontend implementation, and design quality are discussed as one system before build approval.

Each model must either:

- identify the capability it needs and present it to Claude;
- build a planning-stage helper when it is safe and local;
- request user setup when external credentials, plugins, or connector installs are required;
- or mark the prototype blocked.

No model silently proceeds with a weaker setup.

## Model Roles

| Model | Prototype role | Capability duty |
|---|---|---|
| Claude | Lead architect and prototype planner | Assimilates every model's documentation and capability packet, then designs the prototype architecture. |
| Codex | Implementation feasibility reviewer | Finds or builds local scripts, skills, validators, tests, connectors, and repo/tooling mechanics. |
| Agy | Process and checkpoint reviewer | Finds or builds readiness gates, phase ledgers, blockers, handoff checks, and agreement rules. |
| Grok | Advisory challenger | Finds challenge needs, external-research gaps, adversarial tests, weak assumptions, and overreach risks. |
| Context7 | Live documentation adapter | Supplies current library, SDK, API, CLI, and framework documentation for a specific implementation use-case. |

## Dynamic-Workflow Council (2026-06-27 upgrade)

The council step is now a dynamic workflow rather than hand-authored packets. `build-gate/council.mjs` **sizes the council to the job**: `planSeats(dossier)` returns the required approval seats (claude/agy/codex) plus `grok` advisory, and — when the dossier is `market_bound` — one `market-lens` seat per required market workstream. A small prototype convenes a small council; a market-bound build convenes a larger one. The agent count is derived from the dossier, not fixed.

`runCouncil` executes those seats through a CPU-bounded pool (`min(requested, cores − 2)` concurrent) so a wide fan-out cannot thrash the host, and signs + provenance-stamps each seat's packet from the response that produced it. The adversarial breakout convergence remains the existing `breakout/` engine.

See `Multi-Model Agentic Build Gate.md` → "Trust Mode: signed" for the signing, provenance-as-blocker, and `meets` sufficiency rules these generated packets must satisfy.

## TELOS Market Readiness

When a project is being taken toward market, Claude convenes a model council around these workstreams:

| Workstream | Lead | Review focus |
|---|---|---|
| Business and positioning | Claude + Grok | Target user, category, differentiation, pricing logic, adoption risk, and why the product should exist now. |
| Product architecture | Claude + Codex | User journey, feature boundaries, system shape, state model, API surface, and extension points. |
| Backend and schema | Codex | Data model, service boundaries, persistence, migrations, validation, observability, and failure modes. |
| Security and trust | Grok + Codex | Auth, secrets, privacy, abuse cases, threat model, sensitive data handling, and dependency risk. |
| Accuracy and evals | Claude + Codex | Acceptance tests, eval datasets, deterministic checks, model-grounding rules, and regression gates. |
| Scale and operations | Agy + Codex | Deployment path, environment setup, cost shape, queues/jobs, caching, rollback, and support readiness. |
| Frontend and brand experience | Claude + Codex | Interaction model, visual identity, design system, responsiveness, accessibility, and production polish. |

Each workstream can split into a temporary design team. Teams produce options, critique one another, and send a recommendation back to Claude. Claude synthesizes; Agy gates; Codex verifies feasibility; Grok challenges the weak points.

## LEXI-Class Frontend Standard

LEXI-class UI means the frontend looks and works as well as the backend. It is unique, functional, sharp, and product-specific. It should feel capable of winning attention on design quality without sacrificing usability.

Required standard:

- the first screen communicates the product's actual value, not generic SaaS decoration;
- the visual system is distinctive and tied to the product's subject matter;
- the interaction model is efficient, legible, responsive, and accessible;
- the frontend has real states: loading, empty, error, disabled, selected, hover, focus, and mobile;
- data, schema, backend capabilities, and trust boundaries are visible through the UI where useful;
- typography, spacing, controls, and motion are deliberate enough to feel designed, not generated;
- the design avoids template palettes and one-note gradients unless they are justified by the product;
- award-winning ambition is the target, but usefulness is the floor.

For LEXI-inspired projects, "LEXI-class" specifically means dark precision, high-contrast typography, restrained accent color, mono/data labeling, cinematic atmosphere, and dense-but-readable operational surfaces. Future projects may use a different visual language, but must meet the same bar of uniqueness plus function.

## Prototype Lifecycle

1. Capture the idea and write a telos statement.
2. Claude frames the prototype intent, constraints, audience, and success criteria.
3. Claude splits the planning work into model teams when the scope is market-bound.
4. Each model creates a capability acquisition packet.
5. Market-bound teams create market readiness recommendations for their workstreams.
6. Codex may build safe local planning helpers, validators, scripts, or packet templates.
7. Agy checks whether missing capabilities are resolved, presented to Claude, or blocked on user setup.
8. Claude receives all capability and market readiness packets and creates the prototype architecture.
9. Codex reviews build feasibility and test strategy.
10. Grok challenges assumptions and risky leaps.
11. Agy confirms the gate state.
12. The build begins only after the multi-model build gate passes.

## Capability Acquisition Packet

Each model emits this packet before Claude finalizes the prototype architecture.

```json
{
  "build_id": "string",
  "idea_id": "string",
  "model": "claude|codex|agy|grok",
  "telos": "string",
  "docs_needed": ["string"],
  "skills_needed": ["string"],
  "connectors_needed": ["string"],
  "available_now": ["string"],
  "missing_capabilities": ["string"],
  "can_build_during_planning": ["string"],
  "built_during_planning": ["string"],
  "must_request_user_or_install": ["string"],
  "presented_to_claude": true,
  "recommendation_to_claude": "string",
  "timestamp": "ISO-8601"
}
```

If `missing_capabilities` is not empty, `presented_to_claude` must be true. If `must_request_user_or_install` is not empty, the prototype remains blocked until the user completes setup or Claude changes the architecture to avoid that dependency.

## Claude Assimilation Packet

Claude's builder packet must include:

- the telos;
- the docs each model used;
- how each model's strengths will be used;
- which connectors and skills are available now;
- what was built during planning;
- what remains unavailable;
- how unavailable capabilities changed the prototype plan;
- how market-readiness workstreams were resolved when the project is market-bound;
- how the frontend will meet the LEXI-class standard or an equally strong project-specific standard;
- which review packets are required before build.

Claude does not need every possible tool. Claude needs an honest map of what the system can do now and what would need setup later.

## Capability Routing Rules

- Use local docs and existing maps before relying on model memory.
- Use Context7 for current implementation docs when a prototype depends on a library, SDK, API, CLI, or cloud service.
- Build local planning helpers only under `me/codex/` unless the user explicitly approves another write target.
- Do not store secrets in the vault.
- Do not require a connector if the prototype can be planned honestly without it.
- If a connector is required for the prototype itself, it must be listed in `must_request_user_or_install`.

## Gate Integration

The local gate validator supports capability packets:

```powershell
node .\me\codex\build-gate\gate.mjs validate <dossier.json> <approval-packet-dir> --capabilities <capability-packet-dir>
```

The gate blocks when:

- a required capability packet is missing;
- a model has missing capabilities that were not presented to Claude;
- a required user/plugin/API setup item remains open;
- Claude, Agy, or Codex has not approved;
- required documentation coverage is missing;
- protected-path or LEXI rules fail.

For market-bound projects, the gate should also treat unresolved market-readiness blockers as build blockers, even when the prototype is technically feasible. A technically working system with weak positioning, unsafe security, untested accuracy, or a second-rate frontend is not market ready.

## Success State

A prototype is ready to build when:

- the telos is explicit;
- Claude has received every required capability packet;
- local helpers needed for planning have been built or intentionally skipped;
- unavailable connectors are either removed from scope or user-approved;
- Codex approves implementation feasibility;
- Agy approves readiness;
- Claude approves the architecture;
- the frontend plan meets the LEXI-class or project-specific design standard;
- market-readiness workstreams have no unresolved blockers;
- the build gate returns `gate_status: pass`.
