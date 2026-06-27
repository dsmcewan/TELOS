---
title: Claude-Grok-Agy Hierarchical Agentic Workflow
author: codex
last-edited-by: codex
last-edited-at: 2026-06-26
workflow-status: draft-for-review
source-workflow: vault-mapping
source-inputs:
  - shared/Coordination/Multi-Model Vault Mapping Workflow.md
  - shared/Coordination/Multi-Model Agentic Build Gate.md
  - shared/Coordination/Tagging Ontology Draft.md
  - C:/Users/dsmce/Downloads/project_knowledge.zip
tags:
  - type/workflow
  - domain/vault-operations
  - workflow/tag-proposal
  - source/model-generated
  - model/claude-code
  - model/grok
  - model/agy
---

# Claude-Grok-Agy Hierarchical Agentic Workflow

This note defines the Claude-led, Grok-checked, Agy-controlled workflow for mapping and tagging the V4 vault. It uses the existing V4 coordination plans and the Claude project-knowledge bundle as process references. It does not copy archive evidence, notebook bodies, or zip contents into the vault.

The workflow is for metadata, navigation, and review. It is not an evidence-normalization workflow.

Build or broad mapping work must first pass `shared/Coordination/Multi-Model Agentic Build Gate.md`: Claude, Agy, and Codex are the required approval models, while Grok provides advisory challenge review unless explicitly promoted for a specific use-case.

## Operating Principle

Claude leads the hierarchy. Grok checks every risky classification before it becomes canonical. Agy controls phase movement, queue state, and handoffs. Codex builds inventories, queues, and patch-ready artifacts.

`CHATGPT/` remains immutable. Archive material may be indexed by path, linked, or transcluded through thin shared wrappers, but it must not be copied, rewritten, renamed, deduplicated, or OCR-normalized into `shared/`.

## Source Inputs

Use these sources as the planning basis:

- `shared/Coordination/Multi-Model Vault Mapping Workflow.md`
- `shared/Coordination/Tagging Ontology Draft.md`
- `C:/Users/dsmce/Downloads/project_knowledge.zip`
- `shared/Documentation/AI Model Documentation Index.md`

Use the zip only for Claude workflow patterns:

- plan before editing;
- delegate bounded research to subagents;
- keep roles explicit;
- separate data from instructions;
- gather evidence before answering;
- give the model permission to say unknown;
- use prompt chaining for maker-checker review;
- require structured outputs for downstream agents.

Do not treat the zip as a vault fact source.

Use `shared/Documentation/AI Model Documentation Index.md` for current Grok/xAI, Agy, and Codex source maps. It links official docs where they exist and local operational specs where the behavior is workspace-specific.

## Hierarchy

### 1. Claude: lead architect

Claude owns the information architecture and decision gates.

Claude decides:

- taxonomy structure;
- metadata field definitions;
- phase entry and exit criteria;
- sample calibration set;
- final approval criteria for tag families;
- when an ambiguity must be escalated to the user.

Claude does not directly mass-tag the vault. Claude approves or rejects the logic that controls tagging.

### 2. Grok: adversarial checker

Grok owns challenge review.

Grok checks for:

- unsupported tags;
- overbroad taxonomy;
- legal conclusions disguised as metadata;
- privacy leakage;
- archive contamination;
- copied evidentiary text;
- broken source-zone boundaries;
- hallucinated or inferred classifications.

Grok can reject a proposal, require evidence, or send it back to Claude for taxonomy revision. Grok does not patch files.

### 3. Agy: checkpoint controller

Agy owns phase control, queue state, and workflow memory. Agy is the operational governor between Claude's design decisions, Grok's review decisions, and Codex's execution work.

Agy tracks:

- current phase;
- scope;
- queue counts;
- approved, rejected, and blocked items;
- model ownership;
- user decisions;
- handoff status.

Agy decides:

- whether the next phase is allowed to begin;
- which agent owns the next action;
- whether a queue item is blocked, stale, or ready for review;
- whether a user decision is required before proceeding;
- whether a handoff packet is complete enough for the next model.

Agy does not decide taxonomy meaning or forensic truth. Agy enforces the process and can veto execution when the handoff, queue state, or phase gate is incomplete.

### 4. Codex: execution mechanic

Codex owns repeatable mechanical work.

Codex generates:

- file inventories;
- metadata extracts;
- link graphs;
- wrapper reports;
- tag proposals;
- validation reports;
- patch queues.

Codex may write drafts and generated artifacts to `me/codex/`. Codex may write canonical notes to `shared/` with provenance. Codex must not write to `CHATGPT/` or peer scratch folders.

## Workflow A: Taxonomy Calibration

Purpose: produce a controlled vocabulary before any broad tagging.

Sequence:

1. Codex inventories the pilot scope and extracts existing tags/frontmatter.
2. Claude reviews the inventory and proposes taxonomy refinements.
3. Grok challenges the proposed taxonomy for overreach and unsafe tags.
4. Claude revises the taxonomy.
5. Agy records the approved taxonomy version and open questions.

Inputs:

- existing tag list;
- `Tagging Ontology Draft.md`;
- sample file paths;
- observed frontmatter fields.

Outputs:

- approved taxonomy version;
- rejected tag list;
- ambiguous-category queue;
- sample classification set.

Exit gate:

- every approved tag has a definition;
- every approved tag has an example or exclusion rule;
- legal conclusion tags are excluded unless they are forensic-review labels;
- unknowns route to `workflow/checker-review` or `workflow/needs-user`.

## Workflow B: Read-Only Vault Mapping

Purpose: map the vault structure without mutation.

Sequence:

1. Codex scans files, sizes, mtimes, extensions, and folder zones.
2. Codex parses markdown frontmatter, headings, tags, and links.
3. Codex classifies each item by write policy.
4. Claude reviews the structural map for missing domains.
5. Grok checks whether any generated summary leaks sensitive evidence content.
6. Agy marks the inventory phase complete or blocked.

Allowed scan outputs:

- `me/codex/vault-mapping/inventory.raw.csv`
- `me/codex/vault-mapping/metadata.raw.csv`
- `me/codex/vault-mapping/link-graph.raw.csv`
- `me/codex/vault-mapping/archive-boundary-report.md`
- `me/codex/vault-mapping/pilot-results.md`

Exit gate:

- no generated output lands in protected folders;
- archive items are indexed by metadata only;
- peer scratch folders are read-only;
- no broad metadata edits occurred.

## Workflow C: Tag Proposal And Review

Purpose: turn inventory facts into patch-ready metadata proposals.

Sequence:

1. Codex creates `tag_proposals` records from observed path, title, frontmatter, or explicit content.
2. Claude reviews the proposal set for taxonomy fit.
3. Grok reviews the proposal set for unsupported inference.
4. Agy sets proposal state.
5. Codex prepares patch instructions only for `checker-approved` items.

Proposal states:

- `tag-proposed`
- `needs-checker`
- `checker-approved`
- `checker-rejected`
- `needs-user`
- `ready-to-patch`

Required proposal fields:

```yaml
path:
source-zone:
current-tags:
proposed-tags:
rationale:
evidence-basis:
maker-model:
checker-model:
risk-level:
review-status:
```

Exit gate:

- every approved tag exists in the approved ontology;
- every rationale is grounded in observable file facts;
- Grok has no unresolved hard-stop objection;
- no patch targets `CHATGPT/` or peer scratch folders.

## Workflow D: Archive Reference Mapping

Purpose: expose archive structure without creating copy drift.

Sequence:

1. Codex identifies archive paths and existing shared wrappers.
2. Claude decides whether a shared-owned navigation surface is needed.
3. Grok checks that proposed wrappers do not duplicate archive bodies.
4. Agy records wrapper status.
5. Codex prepares wrapper proposals only when needed.

Allowed archive actions:

- discover path;
- record metadata;
- link to archive path;
- transclude through thin wrapper;
- mark `archived-no-action`.

Forbidden archive actions:

- edit;
- move;
- rename;
- summarize as court fact;
- copy body text into `shared/`;
- OCR-rewrite;
- deduplicate.

Wrapper pattern:

```markdown
---
author: codex
last-edited-by: codex
note-type: wrapper
source-zone: chatgpt-archive
archive-policy: transclusion-only
tags:
  - type/wrapper
  - evidence/transclusion-wrapper
  - source/chatgpt-archive
---

![[CHATGPT/Vault4/Archive Note Name]]
```

Exit gate:

- shared wrapper contains frontmatter plus transclusion only;
- archive body text is not pasted into shared notes;
- Grok signs off on no-copy status.

## Workflow E: Case-Sensitive Routing

Purpose: prevent ordinary vault hygiene from becoming unsupported forensic work.

Trigger this workflow when a proposed map, tag, or link touches:

- LEXI;
- OFW messages;
- deposition citations;
- court exhibits;
- motions;
- legal findings;
- case-sensitive medical, financial, or child-related evidence.

Sequence:

1. Agy marks the item `needs-lexi-reference`.
2. The active forensic agent reads `shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md`.
3. Codex or the forensic agent queries LEXI only when needed.
4. Claude separates taxonomy labels from court-facing claims.
5. Grok checks source support and citation discipline.
6. Agy records whether the item is map-only, evidence-linked, or claim-bearing.

Hard rules:

- Scheme B only for court-citable deposition references.
- Documentary anchors outrank model summaries and labels.
- Absence from OFW does not prove absence of offline coordination.
- No bulk LEXI writes without explicit atomic user authorization.
- AI-generated summaries are not court evidence.

Exit gate:

- map-only items are clearly marked as map-only;
- claim-bearing items have source IDs or are rejected;
- court-facing deposition material has Scheme B citation status;
- unresolved claims remain `needs-checker` or `needs-user`.

## Workflow F: Agy Governance Loop

Purpose: keep the multi-model system coherent across long-running mapping work.

Sequence:

1. Agy opens or resumes the phase ledger.
2. Agy confirms the current phase, scope, and allowed write zones.
3. Agy assigns the next owner: Claude, Grok, Codex, or user.
4. Agy records queue state changes after every model handoff.
5. Agy blocks phase movement if any required packet is missing.
6. Agy closes the phase only when all gate criteria are met.

Agy ledger fields:

```yaml
phase:
phase-status:
scope:
allowed-write-zones:
forbidden-zones:
current-owner:
next-owner:
queue-counts:
approved-items:
rejected-items:
blocked-items:
needs-user:
lexi-required:
lexi-reference-read:
protected-path-check:
phase-gate-status:
handoff-summary:
```

Agy handoff rules:

- no item moves to `ready-to-patch` without Grok review;
- no taxonomy version becomes active without Claude approval;
- no case-sensitive item proceeds without LEXI routing status;
- no archive wrapper proceeds without no-copy confirmation;
- no broad patch pass proceeds without explicit user approval.

Exit gate:

- all open items have an owner and state;
- phase status is `complete`, `blocked`, or `needs-user`;
- next actions are assigned;
- protected folder status is recorded;
- incomplete evidence or uncertain tags remain out of the patch queue.

## Packet Templates

### Claude intake packet

```yaml
packet-type: claude-intake
objective:
scope:
source-folders:
allowed-write-zones:
forbidden-zones:
taxonomy-question:
success-criteria:
lexi-consulted: false
lexi-reference-read: false
open-questions:
```

### Grok review packet

```yaml
packet-type: grok-review
review-target:
proposed-tags:
proposed-links:
evidence-basis:
risk-level:
archive-risk:
privacy-risk:
legal-conclusion-risk:
decision: approve | reject | needs-claude-revision | needs-user
reasons:
hard-stops:
```

### Codex execution packet

```yaml
packet-type: codex-execution
task:
scope:
inputs:
outputs:
write-targets:
protected-path-check:
validation-commands:
lexi-consulted: false
patch-status: not-started
```

### Agy checkpoint packet

```yaml
packet-type: agy-checkpoint
phase:
queue-counts:
approved:
rejected:
blocked:
needs-user:
next-owner:
phase-gate-status:
handoff-needed:
```

### Agy governance packet

```yaml
packet-type: agy-governance
ledger-id:
phase:
scope:
active-taxonomy-version:
current-owner:
next-owner:
phase-gate-status:
required-reviews:
missing-packets:
blocked-reasons:
user-decisions-needed:
safe-next-action:
do-not-proceed-if:
```

## Prompt Pattern For Claude

Use this style when handing a mapping problem to Claude:

```text
You are the lead information architect for the V4 vault.

Use the current taxonomy and the supplied inventory facts only.
Do not infer legal conclusions.
Do not propose edits to CHATGPT/ or peer scratch folders.
If evidence is insufficient, mark the item needs-checker or needs-user.

Return:
<classification>
path:
recommended-note-type:
recommended-tags:
rationale:
evidence-basis:
risks:
questions:
</classification>
```

## Prompt Pattern For Grok

Use this style when handing a proposal to Grok:

```text
You are the adversarial checker for the V4 vault workflow.

Attack this proposal for unsupported inference, archive contamination,
copy drift, privacy leakage, over-tagging, and legal conclusion risk.

Approve only if the proposal is grounded in observable facts and the
target path is in an allowed write zone.

Return:
<grok_review>
decision:
must-fix:
risk-level:
unsupported-tags:
archive-issues:
privacy-issues:
legal-citation-issues:
safe-next-action:
</grok_review>
```

## Prompt Pattern For Agy

Use this style when handing workflow state to Agy:

```text
You are Agy, the checkpoint controller for the V4 vault workflow.

Do not decide taxonomy meaning. Do not decide forensic truth.
Your job is to control phase movement, queue state, ownership,
handoffs, and user-decision gates.

Given the current packets, decide whether the workflow can advance,
who owns the next action, and what must be blocked.

Return:
<agy_checkpoint>
phase:
phase_gate_status:
current_owner:
next_owner:
approved_count:
rejected_count:
blocked_count:
needs_user:
missing_packets:
safe_next_action:
do_not_proceed_if:
</agy_checkpoint>
```

## Dry-Run Scenarios

### Scenario 1: normal shared note

Input: a note under `shared/` with clear frontmatter and explicit content.

Expected path:

`Codex inventory -> Claude classification -> Grok review -> Agy approval -> Codex patch queue`

Expected result:

- proposed tags are grounded in title, path, frontmatter, or explicit note body;
- status becomes `ready-to-patch` only after Grok approval;
- patch target remains under `shared/`.

### Scenario 2: archive item

Input: a note under `CHATGPT/Vault4/`.

Expected path:

`Codex metadata index -> Claude wrapper decision -> Grok no-copy check -> Agy archived-no-action`

Expected result:

- archive file is not edited;
- archive body is not copied;
- if a shared surface is needed, only a thin transclusion wrapper is proposed.

### Scenario 3: legal or case-sensitive item

Input: a proposed tag or index entry involving deposition, OFW, exhibit, motion, or LEXI-backed fact.

Expected path:

`Agy needs-lexi-reference -> LEXI reference read -> source lookup -> Claude claim separation -> Grok citation check`

Expected result:

- ordinary metadata stays separate from forensic claims;
- court-facing citations use Scheme B only;
- unsupported claims remain unapproved.

## Completion Criteria

This workflow is ready to execute when:

- Claude accepts the taxonomy and phase gates;
- Grok accepts the hard-stop list;
- Agy has a queue-state template, governance packet, and phase ledger;
- Codex has scratch output paths and validation commands;
- the user has approved moving from proposal generation to any broad patch pass.

Until then, the safe default is read-only inventory and proposal generation only.
