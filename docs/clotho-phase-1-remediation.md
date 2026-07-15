# Clotho Phase 1 — Remediation Plan (response to the cold review of `2d93816`)

**What the review hit:** the registry entry, spec, and *pre-workshop* plan skeleton
as committed at `2d93816`. The live Daedalus workshop (`docs/runs/clotho-daedalus/`)
subsequently matured the skeleton and independently resolved several of the same
defects. This plan reconciles the three layers — registry, spec, matured plan — and
sequences the fixes needed before authorization.

**Process lesson (root cause):** the workshop prompt froze the spec ("governing
spec, do not rewrite"), so seats could fix plan-level defects but not spec-level
ones. Findings 1, 3, and the spec/plan divergences below are the direct result.
Corrective rule going forward: **the spec is cold-reviewed before or inside the
workshop, never handed in as unchallengeable context.**

---

## Finding-by-finding disposition

| # | Review finding | Layer | Status vs matured plan | Action |
|---|---|---|---|---|
| 1 | Iliad defined too narrowly; Eye too narrow | registry | Not addressed (out of workshop scope) | **A1** |
| 2 | Ledger cannot reconstruct node references | spec + skeleton | **Already fixed**: every edge payload embeds `from_locator`/`to_locator` `{kind, locator}` (the review's "full canonical node descriptors" option); ids recomputable | **A2** (spec catches up) |
| 3 | Model suggestions admitted as facts | spec + plan | **Partially**: `asserted_by` distinguishes `human`/`model:<seat>`/weaver ids, but no proposal quarantine or default-query exclusion | **A3** |
| 4 | Determinism contradicts timestamps/signatures | skeleton | **Largely fixed**: D5 splits weaver edge payload (no time/signature) from the ledger envelope; determinism tested on `{edges, warnings}`, dedupe key `(edge_kind, from_node, to_node, source_ref, asserted_by)`; D7 makes each weave a separate immutable artifact (idempotence answer) | **A2** (spec documents the split) |
| 5 | proposal-ledger verifier cannot be reused | spec | **Already fixed**: thread ledger owns its verifier under `clotho/` using `node:crypto`; only the *pattern* is cited | **A2** (spec wording corrected) |
| G-A | Missing evidence cannot report itself | spec + plan | **Partially**: warnings contract, closed input inventories (D8), skipped-source failure test — but no signed per-weave coverage manifest | **A4** |
| G-B | Edge directions / query grammar underdefined | skeleton | **Already fixed**: endpoint-compatibility matrix freezes every direction; `blastRadius` traverses both directions of `depends-on`/`verified-by`; `why()` reaches contract-clause via `discharges` | **A2** |
| G-C | Registry omits files | skeleton | **Decided differently**: matured plan explicitly has *no* file/module node — an unrepresentable consumer yields a stable warning and no edge | **A5** (Eye decision) |
| G-D | node_id is version identity, not lineage | spec wording | **Acknowledged** (D1/D2, risk 1) but spec wording still implies durable identity | **A2** |
| G-E | Flagship `⊇` tolerates buried false positives | skeleton | **Largely fixed**: D3 — every expected fact must match distinctly, extra facts reported separately | **A6** (make the review-set an explicit exit criterion) |
| G-F | CI workflow edit inside feature work | plan | Not addressed | **A7** |

## Actions

### A1 — Registry corrections (needs The Eye's exact words)
Replace the Iliad entry with the reviewer's canonical definition:
> **The Iliad** — the system-of-systems lifecycle umbrella under which registered
> components coordinate the creation, governance, maintenance, recovery, evolution,
> and retirement of enrolled systems; it uses Clotho's weave to preserve cross-plan
> and cross-system coherence.

Broaden The Eye (proposed wording, pending approval):
> **The Eye** — human-held authority required for consequential action; the system
> acts on self-improvement proposals only under its strictest form.

Update the spec's Iliad mention to "later consumer of the weave", never "the Phase 2
planning consumer *is* the Iliad".

### A2 — Spec v2: reconcile with the matured plan
The spec is the governing document and currently *loses* to the plan it governs.
Fold in, as normative: embedded `{kind, locator}` node descriptors in every edge
record; the payload/envelope split (weavers emit facts, the ledger owns time, chain,
and signature; determinism is compared on the payload key, never full records; each
weave is a separate immutable artifact); a **thread-specific verifier owned by
`clotho/`** (reuse canonicalization/hash conventions and Ed25519 primitives only —
the proposal-ledger *verifier* is proposal-specific and is not touched); the frozen
edge-direction matrix and query semantics; and "node_id is an immutable
**symbol-version reference**, lineage is carried by evidenced `supersedes`" wording.

### A3 — Model-proposal quarantine (new, both spec and plan)
Closed assertion-status set: `deterministic-extraction | human-authorized |
model-proposal | rejected | superseded`. Weaver records are
`deterministic-extraction` by construction; `model:<seat>` records enter as
`model-proposal`. **Default queries exclude unresolved model proposals**; acceptance
into the canonical weave is an explicit `human-authorized` record (or a future
TELOS-authorized path). A `source_ref` proves evidence exists, never that the
relationship follows from it.

### A4 — Signed weave coverage manifest (new)
Extend the weave header/trailer with a manifest: per-weaver `{id, version,
state: executed|skipped|failed, error_code?, inspected_source_counts}` plus the
closed input inventories actually consumed. General queries answer
**coverage-unknown** when the relevant weaver did not execute; only the flagship
expected set may name a *specific* missing relationship.

### A5 — File-node decision (Eye decides; default = keep matured plan)
Options: (a) keep the matured plan's explicit no-file-node position with the
`unrepresentable-consumer` warning as the documented Phase 1 limitation, or
(b) add `source-file` to `NODE_KINDS` with its own locator (never overloading
`code-symbol`). Default recommendation: **(a)** — narrower closed set now, and (b)
is a pure addition later if the warning volume proves the need.

### A6 — Flagship acceptance tightening (plan delta)
Exit criteria: every expected edge matches distinctly; every unexpected edge in the
flagship neighborhood is emitted as an explicit **review set** artifact; no
unexpected edge is treated as validated; no relevance scoring (Lachesis's domain).

### A7 — CI isolation (plan delta)
Split the `.github/workflows/ci.yml` matrix edit out of Task 1 into its own
minimal, explicitly-flagged PR (workflow-only, reviewed as such), per the
self-skipping-reviewer failure already documented in this repo. Clotho's first
delivery must not repeat it.

## Sequence

1. **A1** registry + spec mentions (small doc PR; Eye confirms both wordings).
2. **A2–A6** spec v2 + plan-delta amendments in one document PR.
3. **Daedalus delta round** over (spec v2 + matured plan + amendments) — spec
   explicitly challengeable this time. Expected to be short: the deltas are scoped.
4. The Eye reviews the re-converged candidate → TELOS lifecycle authorization →
   Argo, with **A7's workflow PR landing first and alone**.

## Decisions (The Eye, 2026-07-15)

- **A1 executed** with The Eye's exact wordings: the Iliad entry uses the
  reviewer's text verbatim; The Eye entry reads "human-held authority required to
  approve consequential action, including destructive, irreversible,
  self-improving, or authority-expanding changes; it cannot be delegated to a
  model or inferred from silence." Deterministic policy may authorize bounded
  ordinary actions; the Eye is the external authority at consequential boundaries.
- **A5 decided the other way: add the file node now**, named `repository-file`
  (covers modules, workflows, manifests, scripts, configuration), locator
  `{repository_ref, path, blob_sha}`. Rationale: files are genuine architectural
  objects; an `unrepresentable-consumer` warning is evidence of a schema gap, not
  a satisfactory graph result; adding it after freezing the ontology would force
  reweaving old snapshots.
- **Process rule preserved verbatim:** *a governing specification is normative,
  not immune from challenge.* Workshops permit findings against plan AND spec;
  spec defects produce explicit proposed amendments, never design-arounds.
- Execution: spec v2 (`docs/clotho-phase-1-design.md`), amendments AM-1..AM-6
  (`docs/clotho-phase-1-plan-amendments.md`), delta workshop under
  `docs/runs/clotho-daedalus-delta/`.

## Second review — The Eye holds #90 at head `2623758` (2026-07-15)

Four blocking defects + one contract ambiguity found in the delta candidate
(`matured-plan-v2.md`); resolved via spec v2.1 + amendments AM-7..AM-11
(`docs/clotho-phase-1-plan-amendments-2.md`) and a second narrow delta workshop
(`docs/runs/clotho-daedalus-delta2/`):

| # | Finding | Resolution |
|---|---|---|
| 1 | `code-symbol`/`test`/`run-evidence` locators not version identities | AM-7: content-bound locators (`blob_sha`/`summary_sha256`) + `repository_ref` on every repository-scoped locator |
| 2 | plan `blastRadius` (both-direction BFS incl. through tests) contradicts spec | AM-8: inverse `depends-on` closure only; `verified-by` as attached evidence; traversal stops at tests; `truncated` from dependency traversal |
| 3 | Task 0 (CI matrix) would land red before the package exists | AM-9: Task 1 scaffold first under existing CI, then the isolated workflow-only Task 0 |
| 4 | coverage manifest binds names/manual versions, not extractor bytes | AM-10: `implementation_refs` / inventory `source_ref` as `file:<path>@<blob_sha>` content addresses |
| 5 | `failed` state both query-visible and never-published | AM-11: **abort on weaver failure**; published manifests carry only `executed`/`skipped`; `skipped` is the deliberate coverage-unknown path; partial-advisory alternative recorded as rejected |

`matured-plan-v2.md` becomes superseded evidence once delta-2 converges.

## Third review — The Eye holds #90 at head `21ed226` (2026-07-15)

Four of five second-hold findings resolved; two fixes incomplete plus one
provenance gap and two governance wordings. Resolved via spec v2.2 + amendments
AM-12..AM-15 (`docs/clotho-phase-1-plan-amendments-3.md`) and a third narrow
delta workshop (`docs/runs/clotho-daedalus-delta3/`):

| # | Finding | Resolution |
|---|---|---|
| 1 | Six locator kinds omit `repository_ref`/content binding; `check-contract` bytes mutable under a stable id | AM-12: completed locator table (heading_path+text_sha256 forms; ledger_path+entry_hash forms; check-contract gains blob_sha); `commit = {sha}` stated as the single named globally-addressed exception |
| 2 | `REPOSITORY_REF` load-bearing but undefined | AM-13: `"git-root:" + <root-commit sha>` via `git rev-list --max-parents=0 HEAD` (multiple roots fatal); rename-immune, clone-stable, fork-shared to the shared root; derived and validated, never invented by Argo |
| 3 | `implementation_refs` manually curated; orchestration unbound | AM-14: refs = exact transitive static relative-import closure (incl. merkle-dag primitives in identity/canonicalization/hashing); new `orchestrator_refs` for weave.mjs/thread-ledger.mjs/registry machinery; closure-equality test that fails on omission or addition |
| G1 | Banners called round artifacts "signed" | AM-15: corrected to "content-addressed, provenance-bearing round artifacts" (banners already fixed in-tree) |
| G2 | Spec's `supersedes` sentence garbled | AM-15 + spec v2.2: `old_version --supersedes--> new_version`; the edge points forward through version lineage |

Resolved-and-verified from the second hold: blastRadius semantics, task order,
abort-on-failure, manifest content-reference structure. The Eye triangulated the
v3 candidate binding but noted the hash recomputation was not independently
performed (connector truncation); the binding recipe remains in the PR body.

`matured-plan-v3.md` becomes superseded evidence once delta-3 converges.

## Fourth review — The Eye holds #90 at head `b68210b` (2026-07-15)

All five third-review corrections verified present; three execution-level
blockers found. Resolved via spec v2.3 + amendments AM-16..AM-18
(`docs/clotho-phase-1-plan-amendments-4.md`) and a fourth surgical delta
workshop (`docs/runs/clotho-daedalus-delta4/`):

| # | Finding | Resolution |
|---|---|---|
| 1 | `repository_ref` derivation returns the shallow boundary in shallow clones (CI's `actions/checkout@v4` default), minting different identities in CI vs full clones | AM-16 + spec v2.3: `git rev-parse --is-shallow-repository` must equal "false" (else stable fatal error) before root derivation; Task 0 sets `fetch-depth: 0`; test proves shallow rejection + full-clone resolution |
| 2 | Task 4a requires a committed orchestrator inventory naming `weave.mjs`, which Task 5 creates — closure-equality test unexecutable as sequenced | AM-17: Task 4a = closure scanner + per-weaver inventories only; Task 5 creates `weave.mjs`, commits the complete orchestrator inventory, and enforces orchestrator closure equality in the same PR; no inventory names a future file |
| 3 | Spec's canonical-semantics sentence (`obligation --discharges--> concern or contract-clause`) contradicted the plan's enforced matrix | Spec v2.3 states the exact matrix (`code-symbol --motivated-by--> concern`; `code-symbol --discharges--> obligation`; `obligation --discharges--> contract-clause`); AM-18 obliges the plan to verify consistency (plan side was already correct) |

Verified-passed from the third review: complete locator invariant with the
named `commit` exception; mechanism-provenance architecture (defect was
sequencing only); both governance wordings; supersession chain. The Eye again
triangulated the candidate binding while noting the hash recomputation was not
independently materializable in the review environment.

`matured-plan-v4.md` becomes superseded evidence once delta-4 converges.

## Not accepted / needs no change

- "Ledger cannot answer from itself" — true of the reviewed skeleton, already false
  of the matured plan (embedded locators).
- Reuse-the-proposal-ledger-verifier — the matured plan never does this; only the
  spec's loose wording suggested it (fixed by A2).
- Determinism vs signatures — the payload/envelope split in the matured plan is the
  same resolution the review proposes; no further mechanism needed beyond spec
  documentation (A2).
