# Candidate approach (rev 1) — Atropos (enrollment quest, cycle 1)

**Cycle:** post-Phase-1, Iliad lifecycle. **Pre-review:**
`file:docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-atropos-1.json`.
**Registered meaning (fixed):** Atropos *retires obsolete relationships, artifacts, tools, and processes* —
"handles supersession". Cycle-1 realizes the **VERIFICATION** of that meaning (READ-ONLY), NOT the mutation.
Authoritative scoping: `daedalus/IDENTITY.md` (expressed via `CURRENT-AUTHORITY.json#superseded` +
`must_not_govern_new_work`). No extension. Machine-first.

Rev 1 implements the GPT-seat rulings (delegated by The Eye 2026-07-18;
`docs/runs/atropos-1-workshop/decision-round-1-result.json`) verbatim: **Ruling B** (per-entity-kind surface
scope) + **anchoring REQUIRED** (a committed CHANGE-PROTOCOL clarification). Resolves the round-1 objections.

## 0. Reality (verified, not presumed)
`CHANGE-PROTOCOL.md` (`status: living`) names three supersession surfaces (record `SUPERSEDED`; weave
`supersedes` edge; `CURRENT-AUTHORITY.json` update). LIVE data: `CURRENT-AUTHORITY.json#superseded` has 4
entries — all **plan-versions** (v11..v14), all `superseded_by:"v15"` = `active_plan.version`, all
`must_not_govern_new_work:true`. Weave `supersedes` edges = 0; live `status:"SUPERSEDED"` records = 0. A
plan-version is NOT a weave node kind, so it structurally cannot carry a weave `supersedes` edge.

## 1. Boundary + trust + NON-CLAIM
Zero-dependency Node ESM `atropos/`; NEVER imports `clotho/`; reads `CURRENT-AUTHORITY.json` (+ committed
records + the weave snapshot) as DATA. Sole sanctioned cross-package import: `merkle-dag/vendor.mjs`
(`canonicalize`/`sha256hex`), enforced by a source-profile `scripts/test-boundary.mjs` (reuse Lachesis).
**READ-ONLY (NON-CLAIM, The Eye):** Atropos realizes the VERIFICATION of "retires", NOT the mutation — it
never mutates `CURRENT-AUTHORITY`, authors a `SUPERSEDED` record/edge, or deletes anything (supersession,
never deletion). Authoring a retirement stays a human/controller CHANGE-PROTOCOL step.

## 2. Kind detection (codex ruling) — `atropos/detect.mjs`
Build the retirement CANDIDATE set from the UNION of: `CURRENT-AUTHORITY.json#superseded` entries; committed
records with `status` exactly `SUPERSEDED`; committed weave edges with `edge_kind` exactly `supersedes`.
Classify each candidate into exactly ONE kind:
- **plan-version** — ONLY when its authoritative identity is the `plan_version` field of a valid closed-shape
  `#superseded` entry (a `vN`-looking string is NOT sufficient); successor lookup uses the
  `active_plan.version`/`plan_version` namespace.
- **weave-node-backed artifact/record** — ONLY when the retired identity resolves to a committed record AND a
  matching weave node whose kind ∈ {code-symbol, repository-file, test, commit, concern, obligation,
  contract-clause, doc-section, run-evidence}. A relationship qualifies only with such a first-class identity.
- **unrepresented/unknown** — anything else (namespace collision, record-kind vs weave-kind disagreement, an
  identity appearing as BOTH a plan-version and a weave node, a bare relationship edge without first-class
  identity). NEVER silently assigned the smaller plan surface set.

## 3. NORMATIVE per-kind verifier — `atropos/verify.mjs`
Surfaces are CUMULATIVE, applied by kind:
- **plan-version** — normative surfaces = `{#superseded entry, entry.superseded_by,
  entry.must_not_govern_new_work===true}`. Checks: `#superseded` is an array; each entry has EXACTLY the closed
  keys `{plan_version, sha256(sha256:<64hex>), authorization(authz-N), authz_status∈{AUTHORIZED,NOT_AUTHORIZED},
  superseded_by, must_not_govern_new_work(bool), note}`; **unique `plan_version`**; `active_plan.version` MUST
  NOT also appear as a superseded `plan_version`; `must_not_govern_new_work===true`; `superseded_by` resolves
  only to `active_plan.version` or another unique superseded `plan_version` — reject self/dangling/cycles
  (visited-set); every chain TERMINATES at `active_plan.version`. Do NOT require/synthesize a `SUPERSEDED`
  record or weave edge (inapplicable).
- **weave-node-backed artifact/record** — normative surfaces = ALL THREE: `{record SUPERSEDED + superseded_by +
  must_not_govern_new_work:true}` + `{weave supersedes edge from successor→retired}` + `{CURRENT-AUTHORITY
  reflection}`. Checks: `R.status===SUPERSEDED`, single stable `superseded_by S`, `must_not_govern_new_work===true`;
  R resolves to a committed weave node of the same kind; a `supersedes` edge from S→R (reject missing,
  reverse-only, duplicate-contradictory, or wrong-successor edges); a `CURRENT-AUTHORITY` reflection agreeing on
  R+S and excluding R from current — **BUT because the CURRENT committed closed schema represents only
  plan-versions, any node-backed retirement returns `inconsistent` reason
  `UNREPRESENTABLE_CURRENT_AUTHORITY_REFLECTION`** (never downgraded to advisory, never invented fields). If S
  is itself superseded, require the same complete three-surface tuple for S; acyclic; terminal successor =
  applicable current authority.
- **unrepresented/unknown** — `inconsistent` reason `UNSUPPORTED_RETIREMENT_KIND` until CHANGE-PROTOCOL defines
  the kind's identity + surface matrix + `CURRENT-AUTHORITY` representation.

**`consistent` iff:** ingestion succeeds; every detected retirement has exactly one unambiguous kind; every
applicable normative surface is present, well-formed, and agrees on retired identity, successor, and
`must_not_govern_new_work:true`; chains are non-self-referential, acyclic, non-dangling, terminate at the
applicable current authority; no retired identity is simultaneously current/governing. Any missing/conflicting/
duplicate/ambiguous/unsupported/unrepresentable data → `inconsistent` with `{identity, surface, reason_code}`.
Absence of a record/edge for a plan-version is NOT an error.

## 4. Ingestion (fail-closed) — `atropos/ingest.mjs`
Reads `CURRENT-AUTHORITY.json` (closed-shape `#superseded` + `active_plan.version` + `active_authorization`),
the committed record set, and (reusing Lachesis's snapshot loader design) the weave `supersedes` edges. Every
anomaly throws; no partial result reaches the verifier. Trust posture: integrity RELATIVE TO the supplied
inputs (NON-CLAIM — no durable authenticated root; HELD for The Eye).

## 5. Oracle + golden
- `scripts/test-verify.mjs`: discriminating fixtures — each FAILS a wrong impl: dangling/self/cyclic
  `superseded_by`; `active_plan.version` also superseded; `must_not_govern_new_work:false`; duplicate
  `plan_version`; mistyped/extra key; a node-backed retirement (→ `UNREPRESENTABLE_CURRENT_AUTHORITY_REFLECTION`);
  an unknown kind (→ `UNSUPPORTED_RETIREMENT_KIND`); an identity as both plan-version and weave node. **GOLDEN
  over the real `CURRENT-AUTHORITY.json`:** 4 plan-versions, all `superseded_by=v15=active_plan.version`, all
  `must_not_govern_new_work:true` → verdict `consistent`.
- `scripts/test-boundary.mjs`: source-profile boundary oracle (reused from Lachesis, incl. its later hardening).

## 6. Anchoring (codex ruling — REQUIRED) + memory layout
`atropos/memory/CONTRACTS/supersession.json` starts **`SPECIFIED-PENDING-IMPLEMENTATION`** and becomes
`NORMATIVE-CURRENT` ONLY WHEN (a) `scripts/test-verify.mjs` passes AND (b) the anchored section
`CHANGE-PROTOCOL.md#supersession-surface-applicability` (drafted, HELD:
`proposed-change-protocol-clarification.md`) is committed. The contract MUST reference that CHANGE-PROTOCOL
anchor + the Atropos decision record; the decision record MUST reference the anchor + the pre-review; the
eventual TELOS authz MUST identify the authorized contract digest + the committed CHANGE-PROTOCOL revision.
Atropos MUST NOT invent any non-plan `CURRENT-AUTHORITY` reflection schema. **HELD for The Eye:** committing the
CHANGE-PROTOCOL clarification (a governance edit) + the enrollment-flip + durable trust-root anchoring.

`atropos/memory/`: `IDENTITY.md`; `INVARIANTS.json`/`.md`; `CONTRACTS/supersession.json` (SPECIFIED-PENDING →
NORMATIVE); `DECISIONS/{decision-atropos-cycle-1.json (authority triple + CHANGE-PROTOCOL anchor),
rejected-alternatives.md}`; `NON-CLAIMS.json`/`.md`; `FAILURE-MODES.md`; `EVIDENCE/`; `comprehension-queries.json`;
`README.md`. **Machine-first + human-rendered with a renderer + drift oracle:** a `scripts/render.mjs` +
`scripts/test-render.mjs` (`--check`) so `README.md`/`.md` projections cannot drift from the machine records
(the discipline the round-1 objection flagged). `package.json`: `"type":"module"`, `dependencies` empty.

## 7. Non-goals (cycle 1)
No mutation of `CURRENT-AUTHORITY`/records (read-only); no deletion; no enforcement gate; no `import` of
`clotho/`; no npm dependency; no Narcissus work; no unilateral CHANGE-PROTOCOL edit (drafted + held); no
extension of the registered meaning; no invented non-plan reflection schema.
