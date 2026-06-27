---
title: Multi-Model Agentic Build Gate
author: codex
last-edited-by: claude-code
last-edited-at: 2026-06-27
workflow-status: active-draft
source-workflow: multi-model-build-gate
tags:
  - type/workflow
  - domain/vault-operations
  - domain/prototyping
  - workflow/build-gate
  - model/claude
  - model/agy
  - model/codex
  - model/grok
---

# Multi-Model Agentic Build Gate

This note defines the approval gate that must pass before a multi-model prototype build, vault mapping pass, or broad tagging workflow begins.

Claude is the primary builder. Agy and Codex review and require edits. Grok is an advisory challenger. The build starts only when Claude, Agy, and Codex all approve through structured packets.

For future-idea prototyping, use this gate with `shared/Coordination/Claude-Led Multi-Model Prototype Workflow.md`. That workflow makes each model discover the documentation, skills, connectors, and planning helpers it needs, then present them to Claude before build approval.

For market-bound projects, the gate also expects TELOS market-readiness review: business thesis, product architecture, backend/schema, security, accuracy/evals, scalability/operations, and frontend/design quality must be discussed before build approval.

## Operating Rule

No build begins until the gate report says `pass`.

The gate is intentionally separate from the build itself. It validates agreement, documentation coverage, path safety, and unresolved blockers before any implementation or vault-wide mutation starts.

## Source Routing

Use these local sources before asking models to decide:

- `shared/Documentation/AI Model Documentation Index.md`
- `shared/Documentation/Grok Documentation Map.md`
- `shared/Documentation/Agy Documentation Map.md`
- `shared/Documentation/Codex Documentation Map.md`
- `shared/Coordination/Claude-Grok Hierarchical Agentic Workflow.md`
- `shared/Coordination/Multi-Model Vault Mapping Workflow.md`

Use Context7 only for current implementation-library, SDK, API, or CLI documentation. Resolve the library ID first, then query the exact use-case. Do not use Context7 as a vault-fact source.

## Model Roles

| Model | Required | Role | Gate authority |
|---|---:|---|---|
| Claude | yes | Builder | Produces the proposal, implementation plan, and post-gate build changes. |
| Agy | yes | Checkpoint controller | Verifies phase readiness, docs coverage, handoff completeness, blockers, and agreement state. |
| Codex | yes | Implementation reviewer | Checks local feasibility, tests, protected paths, and repository/vault constraints. |
| Grok | no | Advisory challenger | Challenges assumptions, overreach, privacy risk, archive contamination, and unsupported claims. |

Grok objections must be explicitly resolved. A dismissed Grok objection must say why Claude, Agy, and Codex do not treat it as a blocker. An accepted Grok objection blocks the gate until fixed.

## Build Dossier

Each use-case gets one dossier. The dossier is the gate's source of truth for objective, target paths, required documentation, and Grok objection resolution.

Required dossier fields:

```json
{
  "build_id": "string",
  "idea_id": "string",
  "use_case": "string",
  "telos": "string",
  "objective": "string",
  "affected_directories": ["shared/"],
  "write_targets": ["shared/Coordination/example.md"],
  "protected_paths": ["CHATGPT/", "me/claude-code/", "me/claude-desktop/", "me/gemini/"],
  "required_docs": ["shared/Documentation/AI Model Documentation Index.md"],
  "required_capability_models": ["claude", "codex", "agy", "grok"],
  "lexi_required": false,
  "lexi_reference_read": false,
  "grok_objections": [
    {
      "text": "string",
      "status": "dismissed|accepted-blocker|resolved",
      "resolution": "string"
    }
  ]
}
```

`idea_id`, `telos`, and `required_capability_models` are required for future-idea prototypes. Older non-prototype gate runs may omit them, but prototype builds should not.

## Approval Packet

Each model emits one packet per review cycle.

```json
{
  "build_id": "string",
  "use_case": "string",
  "model": "claude|agy|codex|grok",
  "role": "builder|checkpoint|implementation-review|adversarial-review",
  "docs_reviewed": ["string"],
  "proposal_ref": "string",
  "decision": "approve|revise|reject|advisory-note",
  "required_edits": ["string"],
  "hard_stops": ["string"],
  "confidence": "low|medium|high",
  "timestamp": "ISO-8601"
}
```

Claude, Agy, and Codex must use `decision: approve`, have no `required_edits`, and have no `hard_stops`. Grok may use `advisory-note`, but every Grok hard stop must appear in the dossier's `grok_objections` list with a resolved status.

## Capability Acquisition Packet

For prototype builds, each model also emits a capability acquisition packet before Claude finalizes the architecture.

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

The gate blocks if a required model has no capability packet, if missing capabilities were not presented to Claude, or if user/plugin/API setup is still required.

## Market Readiness Packet

For projects intended to become professional demos, alpha products, beta products, or production systems, Claude may require market readiness packets.

```json
{
  "build_id": "string",
  "idea_id": "string",
  "model": "claude|codex|agy|grok",
  "project_state": "concept|prototype|demo|alpha|beta|production",
  "workstreams_reviewed": [
    "business-positioning",
    "product-architecture",
    "backend-schema",
    "security-trust",
    "accuracy-evals",
    "scale-operations",
    "frontend-brand-experience"
  ],
  "business_thesis": "string",
  "target_users": ["string"],
  "architecture_findings": ["string"],
  "backend_schema_findings": ["string"],
  "security_findings": ["string"],
  "accuracy_eval_findings": ["string"],
  "scalability_findings": ["string"],
  "frontend_design_findings": ["string"],
  "lexi_class_ui_status": "meets|needs-work|not-applicable",
  "go_to_market_blockers": ["string"],
  "recommendation_to_claude": "string",
  "timestamp": "ISO-8601"
}
```

The gate should not allow a market-bound build to start while `go_to_market_blockers` remain unresolved. `lexi_class_ui_status: needs-work` is a blocker when the product has a user-facing frontend.

## Trust Mode: signed (2026-06-27 upgrade — staged in ENGINE.patch)

Standard gate runs validate *structure and agreement*. A dossier may additionally set `"trust_mode": "signed"` to make approvals **load-bearing**: an approval cannot be produced by a single careless actor and must be bound to a real model response. Legacy dossiers (no `trust_mode`) behave exactly as before. Implementation is staged in `me/claude-code/telos-upgrade/ENGINE.patch`, pending Codex merge into `me/codex/`.

In signed mode, for each required model (claude/agy/codex):

- **Per-model HMAC signature.** Each approval packet carries `signature: { alg: "HMAC-SHA256", value, signed_fields }` computed over the packet's canonical JSON (keys sorted, `signature` excluded) with a per-model secret read from the environment as `TELOS_SECRET_<MODEL>`. The gate **blocks** on a missing secret, a missing signature, or a mismatch. This defeats accidental rubber-stamping and one model signing as another.
- **Provenance is a blocker, not a warning.** Each approval packet must carry a `provenance` block whose `response_id` is bound to a real model response (e.g. from `ai-peer-mcp` `council_review`, which returns `provenance.{claude,grok}.response_id`). Missing or placeholder (`*_self`, empty) `response_id` **blocks** the gate. In legacy mode this only warns.
- **`meets` sufficiency floor.** A market packet claiming `lexi_class_ui_status: "meets"` must back it with checks that are *sufficient*, not merely present: existence-only evidence and zero-byte files are blocked, and at least one `file_contains` check is required. The gate still re-runs every declarative check against the real filesystem and never executes `command` checks.

### Dynamic-workflow council

Packets need not be hand-authored: `me/codex/build-gate/council.mjs` (staged in ENGINE.patch) runs the council as a **dynamic workflow** — `planSeats(dossier)` sizes the roster *from the job* (required approval seats always; `grok` advisory; one `market-lens` seat per required market workstream when `market_bound`), and `runCouncil` executes the seats through a **CPU-bounded pool** (`min(requested, cores − 2)`) so a large fan-out cannot thrash the host. Each seat's packet is signed and provenance-stamped from the response that produced it. The breakout self-challenge convergence remains the existing `breakout/` engine.

### Honest residual

A determined single owner holding every `TELOS_SECRET_*` can still forge all approvals — signing is an *integrity floor* (defeats carelessness), not non-repudiation. Provenance *binds* a packet to a model response; it does not independently prove that response's content offline. The `meets` re-verify root is dossier-chosen, so sufficiency raises the bar without fully closing the circularity. These limits are documented, not hidden.

### First real run

The first signed-mode run is TELOS gating its own upgrade (`me/claude-code/telos-upgrade/runs/upgrade-001/`): signatures valid, `meets` re-verified against real on-disk artifacts, blocked **only** on provenance until real model `response_id`s are captured — the gate refusing to rubber-stamp its own upgrade.

## Gate Sequence

1. Create a dossier for the use-case or prototype idea.
2. Build the documentation matrix from the dossier's `required_docs`.
3. Each required model submits a capability acquisition packet.
4. Market-bound workstreams submit market readiness packets.
5. Claude assimilates the capability and market readiness packets and drafts the prototype architecture or build plan.
6. Claude submits a builder approval packet.
7. Codex submits an implementation-review packet.
8. Agy submits a checkpoint packet.
9. Grok submits an advisory packet when the task is risky, ambiguous, or user-requested.
10. Claude revises until Agy and Codex have no required edits.
11. Run the Codex-local gate validator.
12. Begin the build only when the validator reports `gate_status: pass`.

## Local Validator

Codex maintains the runnable gate in:

`me/codex/build-gate/`

Primary command:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\pass\dossier.json .\me\codex\build-gate\examples\pass\packets
```

Prototype command with capability packets:

```powershell
node .\me\codex\build-gate\gate.mjs validate .\me\codex\build-gate\examples\prototype-pass\dossier.json .\me\codex\build-gate\examples\prototype-pass\packets --capabilities .\me\codex\build-gate\examples\prototype-pass\capabilities
```

The validator checks:

- required model packets exist;
- Claude, Agy, and Codex approve;
- required edits and hard stops are empty;
- required documentation is covered across packets;
- required capability packets are present for prototype builds;
- missing skills, connectors, and docs were presented to Claude;
- market-readiness blockers are resolved for market-bound builds;
- user-facing frontends meet the LEXI-class or project-specific design standard;
- write targets do not touch protected paths;
- LEXI reference status is recorded when needed;
- Grok objections are resolved before the gate passes.

## Protected Boundaries

The validator always rejects write targets under:

- `CHATGPT/`
- `me/claude-code/`
- `me/claude-desktop/`
- `me/gemini/`

Forensic or case-sensitive work must also follow `shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md` before producing findings, citations, or draft edits.

## Passing State

The gate passes only when:

- Claude packet is present and approved;
- Agy packet is present and approved;
- Codex packet is present and approved;
- all required docs are reviewed by at least one packet;
- prototype capability packets are complete when `required_capability_models` is set;
- no required packet contains required edits or hard stops;
- protected path checks pass;
- any Grok hard stop is resolved or dismissed with a reason;
- LEXI reference rules are satisfied when `lexi_required` is true.
- market-readiness workstreams have no unresolved blockers when the project is market-bound.

If any condition fails, the gate status is `blocked`, and the build does not begin.
