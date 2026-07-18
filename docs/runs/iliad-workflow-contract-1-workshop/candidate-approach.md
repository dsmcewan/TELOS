# Candidate approach (rev 2) — Iliad-quest workflow contract (institutional-memory record)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-iliad-workflow-contract.json@6e9436a2fc6a8ac9cdc892b1a3020159dbc81b6e`
(approved; The Eye ruled **option (b)**). **Authority basis (Eye directive 2026-07-18):**
`git:6d16c8ff7cb120910ed0c2968d321269dd1f57cb` +
`file:docs/institutional-memory/iliad/RETROSPECTIVES/agentic-orchestration-reference-1.json@cc24535a45fb4f496ec8962d8b44696cec008785`.

Rev 2 resolves all four round-1 reviewer objections (authority abbreviation; hand-maintained projection;
absent oracle; schema-invalid per-stage normativity). This is the APPROACH; the record is authored in
implementation after the workshop reaches `submit`.

## 1. What is being recorded

The canonical workflow, framed as The Iliad quest — *the journey a new system undertakes to become an
enrolled part of The Iliad*:

```
Iliad(pre-review + entry-ritual gate) -> Daedalus -> TELOS -> Argo
   -> [reference/documentation module] -> Clotho -> Iliad(retrospective -> enrolled)
```

A questing system ENTERS via the Iliad pre-review + comprehension gate, undergoes the trials (Daedalus
matures → TELOS authorizes → Argo implements → the documentation/reference module → Clotho weaves), and
COMPLETES via the retrospective to become enrolled. The Iliad is the encompassing quest, not a bookend.

## 2. Normativity — a WHOLLY ADVISORY record that authority-links the existing NORMATIVE invariants (fixes obj. 4)

A single SCHEMA record carries ONE record-level `status`/`normativity`; per-stage normativity is not
representable and is abandoned. Therefore the workflow contract record is **`status: NORMATIVE-CURRENT,
normativity: ADVISORY`** in full. It does NOT create enforcement. Instead:

- For the stages whose rules are ALREADY enforced, the record **authority-links** to the existing
  NORMATIVE-CURRENT iliad invariants by content-addressed reference — it points, it does not restate or
  re-enforce:
  - `file:docs/institutional-memory/iliad/INVARIANTS.json@ff6af93f32fdd8a2a67b5a56a5d805b395204690#iliad-pre-review-before-implementation`
  - `file:docs/institutional-memory/iliad/INVARIANTS.json@ff6af93f32fdd8a2a67b5a56a5d805b395204690#iliad-post-review-required`
- The NEW stage ("a documentation/reference module precedes the Clotho weave") is ADVISORY per The Eye's
  option (b), and carries a `becomes_normative_candidate_when` note: it is eligible for a
  SPECIFIED-PENDING/NORMATIVE promotion ONLY after a future Eye decision commissions its oracle. No shared
  enforcement infra changes this cycle.

## 3. Deliverable shape

- `docs/institutional-memory/iliad/CONTRACTS/workflow.json` (kind `contract`, ADVISORY): the ordered stages;
  each stage's `owning_module` as a content-addressed `file:<path>@<blob_sha>` reference to that module's
  record; per-stage `authority_link` (to the NORMATIVE invariant records above) or `advisory: true` for the
  new stage. Full SCHEMA fields; all authority/evidence refs are full 40-hex pinned schemes — **no
  abbreviated hash, no bare URL, no mutable path** (fixes obj. 1).
- A deterministic renderer `docs/institutional-memory/iliad/CONTRACTS/render-workflow.mjs` producing the
  human projection with `--write`/`--check` (byte-identical, fail-closed). **No hand-maintained README
  fallback** (fixes obj. 2). Pure Node >=18 ESM, zero deps, no network, writes only its own projection.
- A concrete local oracle `docs/institutional-memory/iliad/CONTRACTS/check-workflow.mjs` (fixes obj. 3):
  fail-closed, verifies — every `owning_module` and `authority_link` ref resolves (git blob present) and is
  content-address-integral (`git hash-object <path>` == pinned `<sha>`); the two linked invariants exist in
  the pinned INVARIANTS blob; the record is ADVISORY with a closed `kind`/`status`; the stage order is the
  canonical sequence; and `render-workflow.mjs --check` passes. It is LOCAL and does **not** modify or add to
  `verify-contracts.mjs` or `comprehension-gate.mjs`.
- Comprehension fixtures (via the existing gate, unmodified): a passing fixture + failing fixtures for the
  hallucinations "The Iliad is a bookend, not the quest", "the new stage is enforced", and "proximity in the
  repo means enrollment" (it does not — cf. AM-40-deferred ai-forge/forge/saas-forge, present but NOT
  enrolled).

## 4. Verification (acceptance sequence)

1. Resolve full stable anchors. 2. Author `workflow.json` + evidence. 3. `render-workflow.mjs --write`.
4. `check-workflow.mjs` exit 0 (incl. `render --check`). 5. Comprehension fixtures: positive->0, negatives->nonzero.
6. `verify-contracts.mjs` run **UNCHANGED** -> proves no disturbance (option b). 7. Record commands/exits/digests.
Terminal is **submit, not authorization** — The Eye's acceptance (merge) follows.

## 5. Non-goals (this cycle)

- No change to `verify-contracts.mjs` / `comprehension-gate.mjs` (option b).
- No record flipped NORMATIVE without an existing passing oracle; the record is ADVISORY and links to the
  already-NORMATIVE invariants rather than duplicating them.
- No new mythological term or component boundary (all five roles are registered; the record only orders them).
- No change to a frozen Clotho plan or any authz; no enrollment of any deferred product.
