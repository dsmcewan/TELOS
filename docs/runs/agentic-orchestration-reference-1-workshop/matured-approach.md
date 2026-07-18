# Revised approach — agentic-orchestration reference (institutional-memory addition)

**Cycle:** post-Phase-1, Iliad lifecycle.  
**Normativity:** `ADVISORY`.  
**Entry authority:** `docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-17-agentic-orchestration-reference.json`, pinned by its full git commit and content digest during implementation.  
**Boundary:** a system-level reference, not a component, role module, runtime, or new mythological term.

The implementation must not use the abbreviated `sha256:05a48700…` as an authority anchor. Any governing-plan context copied into a record must use the complete value read from `CURRENT-AUTHORITY.json` and verified against disk. If the pre-review approval cannot be terminated in an accepted stable identifier—full git commit, content digest, `authz-N`, or Eye ruling—the implementation stops for Eye escalation rather than manufacturing an anchor.

## 1. Scope and ownership

Add an advisory reference for:

1. Anthropic's orchestration taxonomy, preserving the source's distinction between **five workflow patterns**—prompt chaining, routing, parallelization, orchestrator-workers, and evaluator-optimizer—and **autonomous agents**.
2. A TELOS-local, advisory selection checklist derived from the cited guidance.
3. Carefully qualified TELOS worked examples showing where existing mechanisms resemble or combine those patterns.

This reference does not own seat trust, authorization, implementation workflow, or lifecycle policy. Those remain with `loadout`, TELOS, Daedalus, Argo, and the Iliad respectively.

The files live under a clearly marked system-reference namespace such as:

`docs/institutional-memory/REFERENCES/agentic-orchestration/`

The repository manifest indexes that path as a **reference only**. It must not be added to `components`, `role_modules`, or `future_modules`. No vocabulary registration is made. Before writing, inspect the manifest's existing schema and use an existing reference/index mechanism if one already exists; do not invent a second indexing convention. If the manifest has no representation for a system reference and adding one would constitute a component-boundary or schema change, stop and route that ambiguity through `CHANGE-PROTOCOL.md`.

Because this is not a component, do not create a partial capability-module facade consisting of `IDENTITY`, `INVARIANTS`, and selected component files. Author closed-kind SCHEMA records plus their rendered projection and evidence instead.

## 2. Machine records

Author the following logical records, using only SCHEMA.md's closed record kinds and taxonomy values:

- **Reference identity/mechanism record** — states that this is an advisory taxonomy and selection aid. It explicitly says the reference is not enforcement, does not grant authority, does not choose a pattern automatically, and is not a substitute for loadout or TELOS rules.
- **Pattern-taxonomy contract** — six entries, but not six equivalent workflows:
  - five entries classified as `workflow`;
  - one entry classified as `agent`;
  - each entry contains its definition, use conditions, cautions, provenance classification, and evidence-record ids.
- **Decision-checklist contract** — a TELOS-local synthesis, not falsely represented as a verbatim Anthropic checklist:
  1. define success and available evaluation evidence;
  2. test the simplest adequate single-call or retrieval-augmented form first;
  3. classify the task structure—sequential, routable, parallelizable, dynamically decomposable, or feedback-driven;
  4. select the least complex pattern that addresses the demonstrated failure mode;
  5. define stopping conditions, evaluation/checkpoint behavior, human escalation, and authorization boundaries proportional to risk.
- **Non-claim records** — state that the reference does not enforce behavior, prove containment or safety, authorize autonomous execution, replace component-specific policy, or establish that a TELOS mechanism is an exact implementation of an Anthropic pattern.
- **Evidence records** — one per external publication and one per TELOS-local worked example.

Every record carries all applicable SCHEMA fields, including `id`, `kind`, `title`, `what`, `why`, `scope`, `authority`, `evidence`, `non_claim`, `change_rule`, `status`, `normativity`, `superseded_by`, `effective_from_commit`, and `must_not_govern_new_work`. Use `status: NORMATIVE-CURRENT` with `normativity: ADVISORY`, matching the approved pre-review's advisory posture. No record is described as `NORMATIVE`, `NORMATIVE-ENFORCED`, or an implementation invariant.

Record ids are content addresses derived with the repository's existing `deriveNodeId`/canonicalization conventions. Do not create a new id or hashing algorithm.

## 3. Provenance and stable authority

A URL is a locator, not an authority anchor.

For each external source:

1. Record the exact canonical URL, publication title, publisher, retrieval date, and the claims or minimal excerpts used by the reference.
2. Preserve the retrieved evidence locally in a reviewable evidence artifact, subject to repository licensing constraints.
3. Compute its digest with the reused canonicalization/`sha256hex` implementation.
4. Point taxonomy claims to the evidence record's content id and to the evidence file pinned by a full git commit or content digest.
5. Keep the URL as provenance metadata only; reject records whose sole authority is an HTTP URL or a verification date.

The source set must be derived from exact evidence artifacts created and reviewed in this cycle. The pre-review's prose list of publication titles must not be treated as an exact URL allowlist.

Pin the pre-review itself using a full git source reference and digest. Its bare id may remain metadata, but is not sufficient as the terminal authority anchor.

For TELOS worked examples, use full pinned source references to the relevant machine records or code exports. A mutable path alone is rejected. Each example contains:

- `related_pattern`;
- `mapping_basis` describing the observed structural similarity;
- pinned evidence references;
- an explicit non-claim that the advisory correspondence does not transfer Anthropic's claims or create new governing behavior.

Use `related_example`, not `instantiated_by`, unless an existing authority-anchored record explicitly declares the implementation relationship. The initial examples may include loadout harness parallelization, Daedalus's combination of worker orchestration and evaluation feedback, and the held-PR/Eye checkpoint, but each is retained only if the pinned records support the stated mechanics.

Cross-cutting rules such as “convergence is not authorization” are linked to their existing canonical, pinned authority. The reference does not restate them as newly created advisory rules or weaken their existing status.

## 4. Advisory language and autonomous-loop boundaries

Do not use `mandatory`, `must`, or `invariant` for a rule created by this advisory reference.

The autonomous-agent entry instead advises authors to define stopping conditions, evaluation feedback, checkpointing, and human escalation appropriate to uncertainty and risk. Any genuinely mandatory TELOS authorization or held-PR requirement remains mandatory solely because of its existing authority-anchored TELOS/Argo record, not because this reference says so.

“Simplicity first” is expressed as a selection recommendation: add orchestration complexity only when evidence shows that the simpler tested form is inadequate. It is not presented as an executable repository invariant.

## 5. Human projection

`README.md` is generated solely from the machine records and evidence metadata. Add a local ESM renderer under the reference directory with two explicit modes:

- `--write` regenerates the README deterministically;
- `--check` renders in memory and exits nonzero unless the committed README is byte-identical.

The README begins with a generated-file notice naming the renderer and source records. No substantive prose is maintained only in the README.

The renderer uses Node >=18, ESM, and repository-local utilities only. It has zero runtime dependencies, performs no network access, and does not write outside the reference directory. Check mode is read-only and fail-closed.

## 6. Structural and provenance verification

Add a local fail-closed checker, separate from the renderer, that verifies at least:

- every JSON record parses and uses a closed `kind`, status, and normativity value;
- every record id recomputes correctly using the reused content-addressing convention;
- every authority/evidence reference resolves to an accepted stable scheme;
- no bare URL, date, title, mutable path, or abbreviated hash is accepted as terminal authority;
- every external-source digest matches the committed evidence artifact;
- every TELOS example's pinned source reference resolves to the expected file/blob;
- the taxonomy contains exactly five `workflow` entries and one `agent` entry with unique stable keys;
- the checklist is explicitly marked as local synthesis and carries evidence references;
- all records remain `ADVISORY` and make no enforcement claim;
- the manifest classifies the artifact only as a reference and does not register it as a component, role, or future module;
- renderer `--check` passes.

This oracle proves structural integrity, provenance linkage, content addressing, and projection equality. It does **not** claim to prove that an advisory pattern choice is optimal or that a worked-example interpretation is semantically complete.

Do not modify `verify-contracts.mjs`, `comprehension-gate.mjs`, or other shared enforcement infrastructure in this cycle. Run the existing global verifier unchanged to prove that the addition did not disturb current normative contracts and authority hashes. Record the local checker and renderer results as implementation evidence.

## 7. Comprehension gate

Before authoring query fixtures, inspect the existing `comprehension-gate.mjs` input contract. Reuse it without modification only if it supports this system-reference query set.

Queries must deterministically test at least:

- the five-workflows-versus-agent distinction;
- that the reference is advisory and non-authorizing;
- that it does not select a pattern automatically;
- that URLs are provenance locators rather than terminal authority;
- that existing TELOS rules retain their own authority;
- that autonomous operation does not imply unlimited execution.

Commit one passing answer fixture and at least two failing fixtures, including answers that claim “the reference is enforced” and “the reference chooses the pattern.” Acceptance runs the existing gate against all fixtures and requires the positive fixture to exit 0 and every negative fixture to exit nonzero.

If the existing gate cannot grade this reference deterministically without shared-gate changes, do not substitute an ad hoc grader while claiming gate coverage. Record the limitation and route the required scope change through the Iliad/TELOS process.

## 8. Acceptance sequence

1. Read the current authority, manifest, change protocol, Iliad memory, latest retrospective, and relevant module records; produce the required comprehension artifact before implementation.
2. Resolve full stable authority and evidence identifiers.
3. Author evidence artifacts first, then machine records.
4. Compute record ids with reused repository utilities.
5. Render the README from the machine records.
6. Run the local structural/provenance checker and renderer check.
7. Run positive and negative comprehension fixtures through the existing gate.
8. Run `node docs/institutional-memory/verify-contracts.mjs` unchanged.
9. Record commands, exit statuses, and digests in implementation evidence.
10. Submit the implementation for TELOS/Eye acceptance. Workshop convergence and local test success do not authorize or merge it.

## 9. Non-goals

- No new component, capability module, role module, mythological term, or runtime.
- No autonomous executor or pattern-selection engine.
- No normative or enforced orchestration rule.
- No change to shared gate or verification code.
- No change to a frozen Clotho plan or authorization.
- No claim that the local checker proves pattern quality, safety, containment, or authorization.
- No stale-PR housekeeping bundled into this implementation.