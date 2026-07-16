# Daedalus Delta-11 — Verification Record

Verification of the v12 candidate produced by the live delta-11 workshop against
The Eye's mandated maturation outcomes and hard guards. This record is
materialized alongside the run artifacts; it does **not** authorize anything.

## Run outcome

| Field | Value |
|---|---|
| mode | live |
| state | `converged-for-submission` |
| reason | `all-objections-accounted` |
| terminal | `submit` |
| rounds | 1 |
| unresolved objections | 0 |
| final candidate ref | `sha256:bdc93901952312846d693e14925eac49c332e0364a4a2a158ae21b2d607e79d3` |

**Frozen inputs (release anchor `bd516836…`):** plan v11
(`sha256:f5d9cd52…`), `docs/clotho-phase-1-plan-amendments-11.md` (AM-35…AM-39),
`docs/clotho-phase-1-scope-decision.md`, authz-004 codex dissent (4 hard stops).

### Author/reviewer provenance (real, per-seat)

| seat | role | provider | model | response_id |
|---|---|---|---|---|
| claude | author (r1) | anthropic | claude-fable-5 | `msg_011Cd5srfEmocBXrqCcFfoaW` |
| codex | reviewer (r1) | openai | gpt-5.6-sol | `chatcmpl-E2HIyUk8NSnJDmZbzZIH88nykTRhy` |

## Amendment-coverage table — where AM-35…AM-39 landed in v12

| Amendment | Requirement | Landed in v12 |
|---|---|---|
| **AM-35** | Remove loader-isolation *claims*; keep scanner as advisory | Non-sandbox posture (L25, L102–107); **D23** reworded to "deterministic, best-effort … not a proof of isolation"; **D30** → advisory (L88); **D32** "trusted-code review signals, not a capability boundary" (L88); **D27** "not a containment mechanism" (L83); **accepted-risk-18** → "Non-sandbox boundary" (L2107–2113) |
| **AM-36** | Provenance = supported static dependency model only | **D33** narrowed: "supported, statically declared dependency model … **not** every module the process could possibly reach" (L89); D14 aligned (L70, L593, L619) |
| **AM-37** | Missing manifest → unknown; closed-schema `coverage` field | **D11** extended: "A missing manifest never reads as complete coverage" (L67); **new D35**: closed-schema `coverage:"verified"|"unverified"` with all six specifics (L91); interface/schema tables (L1333–1365) |
| **AM-38** | Publication-time re-derive/compare/hash-recheck/abort | **new D34** (L90); enforcement in `weave.mjs` tasks (L633, L1509, L1746) |
| **AM-39** | Weaver edge `asserted_by` == invoked weaver id | **D10** extended "Producer==attribution" (L66); enforcement (L153, L395) |

Governing-spec update path: **"Proposed spec amendments"** section present (L2141).

## Overclaim-absence searches (the mandated proof the removed claims were not reintroduced)

Command: `grep -ni <phrase> matured-plan-v12.md`

| Phrase (old overclaim) | Result in v12 |
|---|---|
| `proven against evasion` (old D23) | **ABSENT** |
| `structurally prohibited` / `prohibited inside Clotho` | **ABSENT** |
| `may not construct, obtain, alias, or invoke` (old D30) | **ABSENT** |
| `bytes capable of executing` (old D33) | **ABSENT** |
| `sandbox` | present **only as negation** ("not a JavaScript sandbox"; "non-sandbox posture"; "not a sandbox claim"; "Non-sandbox boundary") |
| `capability boundary` / `containment` | present **only as negation** ("not a capability boundary"; "not a containment mechanism/control") — except the pre-existing **D21 write-location containment** (filesystem write-path; unrelated to loader isolation) |
| `every module the process could` | present **only negated** ("**not** every module the process could possibly reach") |

## Hard-guard checklist

| Guard | Result |
|---|---|
| No executable loader-evasion-route coverage added | **CLEAN** — the only `evasion` mention is the explicit guard "No part of this plan adds, specifies, or requires executable loader-evasion route coverage" (L36); risk-18 (L2110) is an honest admission such routes exist *outside* the scanner, "never relied upon to isolate hostile code" |
| No restored "isolation proven" language | **CLEAN** (see overclaim-absence table) |
| Advisory scanner not framed as containment | **CLEAN** — D27/D32 explicitly "review signals … not a containment mechanism/capability boundary" |
| authz-004 not modified | **CLEAN** — `git status` shows only the `delta11/` dir changed |
| Prior Daedalus evidence (deltas 1–10) not rewritten | **CLEAN** — untouched per git |
| Provider provenance not described as signatures | **CLEAN** — no provenance↔signature conflation found |
| No implementation started / no authz-005 / Argo not opened | **CLEAN** — v12 is a plan candidate only; no run/gate/impl was executed |

## Materialized exit artifacts (this run dir)

- `matured-plan-v12.md` — full v12 candidate (2151 lines)
- `artifacts/bdc93901…json` — content-addressed final candidate + round artifacts
- `result.json` — result + event summary + creation lineage (provenance)
- `events.jsonl` — event record
- `run-daedalus-delta11.mjs` — the runner (frozen-input bindings, guards, smoke-verified)
- `delta11-verification.md` — this record

## Independent cold review (fresh-eyes, adversarial)

A second reviewer with no exposure to the authoring/run reasoning read v12
against AM-35…AM-39, the scope decision, and the four authz-004 blockers.
Verdict: **"v12 is a faithful, scope-consistent integration — all five
amendments (AM-35..39) landed with verbatim/normative text, no hard guard is
violated, provenance is not called a signature, and no
implementation/authz-005/Argo language leaked in — safe to place in a HELD
PR."** All AM items confirmed landed; all hard guards confirmed clean.

### Reviewer-discretion items carried to authz-005 (polish, NOT blockers)

These are recorded for the required-seat re-review; they are **not** repaired by
hand-editing v12 (that would break the content address `sha256:bdc93901…` and
the reviewed anchor). They are candidates for a future surgical delta only if a
seat raises them:

1. **D35 zero-producer corner** — under `"unverified"`, `coverageUnknown` must
   list every consulted producer and an empty array is a schema violation "while
   producers were consulted"; a query consulting *zero* producers could
   technically emit `"unverified"` + `[]`. Almost certainly vacuous (queries
   consult ≥1 producer kind), but the corner is not explicitly closed.
2. **"Proposed spec amendments: None"** — v12 defers the governing spec v2.8
   overclaim fix to The Eye's separate round-11 spec-amendment lifecycle rather
   than co-locating replacement text. Consistent with the scope decision's
   step 3; a reviewer wanting the text co-located could flag it.
3. **D33/D34 shared-classifier dependency** — publication-time re-derivation
   reuses the committed-closure classifier/resolver; a blind spot there is
   inherited by both. Acknowledged implicitly via the non-sandbox posture.

## Status

Convergence + self-verification + independent cold review all clean. Held for
The Eye: **no release, no authz-005, no implementation, Argo closed.**
