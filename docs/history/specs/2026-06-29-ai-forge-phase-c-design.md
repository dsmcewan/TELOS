# ai-forge — Phase C Design (the TELOS pattern: self-similar capstone)

**Goal:** Add the **TELOS pattern** to the library — ai-forge forges a working
TELOS-like trust system: ~7 trust-spine components (sign · plan · provenance · gate
· council · ledger/done · breakout-verify) each emitted as a small artifact that
**wraps the real spine** and ships an executable selftest the gate runs, plus the
generic Phase B `design` workstream verifying the whole. The self-similar proof:
ai-forge — itself a TELOS-based forge — forges a TELOS-based system.

**Architecture:** A new pure-data pattern `ai-forge/patterns/telos.mjs` on the
unchanged forge. Each workstream's render writes a `telos/<component>.mjs` that
imports the real spine via a ctx-injected `spineRoot` (a `file://` URL) and runs a
keyless, deterministic selftest as its node test (a genuine executable gate, like
Phase A's eval and Phase B's verify). Spine, `saas-forge`, the RAG pattern, and the
Phase A/B ai-forge modules are unchanged.

**Status:** design approved 2026-06-29; spec → (this doc) → `writing-plans` → build.
See [`docs/ROADMAP.md`](../ROADMAP.md) Phase C. Builds on
[Phase A](2026-06-29-ai-forge-phase-a-design.md) +
[Phase B](2026-06-29-ai-forge-phase-b-design.md).

---

## Context

Phases A+B made adding a pattern mostly **data** (a `patterns/<name>.mjs` of
workstreams) and made the `design` workstream generic. Phase C grows the catalog
with its most distinctive entry — the **self-similar / meta** pattern (the original
"TELOS-style systems" ask): ai-forge forging a TELOS-like trust system. This is one
pattern (the others — multi-agent, eval-harness, serving+guardrails — and the
composable-workstream-library generalization stay deferred).

**Core principle:** the forged components **wrap the real spine** rather than
re-implement it (a "TELOS-like system" is built *on* the spine, as `saas-forge`
and `ai-forge` themselves are). To keep the established discipline — genuine
**executable** checks, keyless, deterministic, sanitized evidence — the spine is
reached through a ctx-injected `spineRoot`, so each forged artifact's node test
actually executes it. The forged system is therefore not standalone (it needs the
spine on a known path); that is the accepted cost of "wrap."

## `spineRoot` injection (the wrap mechanism)

`telosContext()` computes `spineRoot` as a **`file://` URL** to the repo root,
resolved from the pattern's own location:
`pathToFileURL(fileURLToPath(new URL("../../", import.meta.url)))` → e.g.
`file:///C:/Users/dsmce/telos/` (trailing slash). Each render bakes it into the
forged artifact's static imports, e.g.:
```js
import { signPacket, verifyPacket } from "${spineRoot}build-gate/sign.mjs";
```
Because the URL is absolute, the import resolves to the real spine regardless of
where the forged artifact sits (a throwaway project root under `os.tmpdir()`). The
node test (cwd = project root) runs the artifact and the spine executes. The
absolute path lives only in throwaway tmpdir artifacts — it is **never written to
the committed `run-summary.json`** (sanitization unchanged from A/B).

## The 8 workstreams

Each render emits `telos/<file>` importing the listed spine export(s) + an inline,
keyless, deterministic selftest run as the node test. `signer`/`lens` = the
strength-matched lead model.

| id | signer | forged artifact | wraps (real spine export) | executable selftest (node test) asserts |
|---|---|---|---|---|
| `sign` | codex | `telos/sign.mjs` | `build-gate/sign.mjs` → `signPacket`,`verifyPacket` | `signPacket(p,"k")`→`verifyPacket`=ok; a tampered packet → verify **false** |
| `plan` | codex | `telos/plan.mjs` | `merkle-dag/merkle.mjs` → `computePlan`,`mutateNode` | `computePlan(defs)` plan_hash deterministic across two runs; `mutateNode` cascades a downstream `effective_hash` change |
| `provenance` | codex | `telos/provenance.mjs` | `connectors/ai-peer-mcp/lib.mjs` → `agyAttestation`,`extractOpenAIResult` | `agyAttestation(cp)`→ non-placeholder `agy-…` id; an extract with no id → `null` (**fail-closed**) |
| `gate` | agy | `telos/gate.mjs` | `build-gate/gate.mjs` → `validateRecords` | required approval packets present + `decision:"approve"` → `gate_status:"pass"`; a missing/`reject` packet → `"blocked"` |
| `council` | claude | `telos/council.mjs` | `build-gate/council.mjs` → `runCouncil` | a keyless stub `callSeat` fan-out (ephemeral local `TELOS_SECRET_*`, not API keys) → N results, order preserved, each signed packet verifies |
| `ledger` | agy | `telos/ledger.mjs` | `merkle-dag/crypto.mjs` (`generateKeypair`,`makeRecord`,`appendLedger`,`readLedger`) + `merkle-dag/ledger-gate.mjs` (`verify`) | build a mini `.telos` (plan + settled signed record + artifact) → `verify()` `merge_status:"ready"`; tamper the record/artifact → blocked |
| `breakout` | grok | `telos/verify.mjs` | `breakout/verifier.mjs` → `reverifyRecord` | a `file_exists` check over a present artifact → re-verifiable; absent → not (verdict on facts) |
| `design` | claude | `docs/DESIGN.md` + `docs/design/verify.mjs` | (Phase B `makeDesignWorkstream`, generic) | DESIGN.md consistent with plan + ledger + the 7 built components (coverage, data-flow==DAG, realized, model==signer, sections) |

**Dependency DAG** (the forged spine's structure; the `design` data-flow check
asserts it edge-for-edge): roots `sign`, `plan`, `provenance`;
`gate ← {sign, provenance}`; `council ← {sign, provenance}`;
`ledger ← {sign, plan}`; `breakout ← {gate}`; `design ← {all 7}`.

## Keyless / deterministic / sanitized

- **Keyless:** no API keys anywhere. The `council`/`sign`/`ledger` selftests use
  ephemeral local HMAC secrets (`TELOS_SECRET_*`, arbitrary strings) and locally
  generated Ed25519 keypairs — local integrity material, never API keys. The
  council seat caller is a deterministic stub.
- **Deterministic:** selftests carry fixed inline fixtures (sample packet, dossier,
  task-defs); no `Date.now`/`Math.random`/network.
- **Fixture isolation (critical):** a selftest that needs its own `.telos`/ledger
  or writes scratch files (notably `ledger` and `plan`) MUST build that fixture in
  an isolated `os.tmpdir()` directory — **never** in the project root or its
  `.telos/`, which holds the *forge's* live plan + ledger for the in-progress build.
  Writing there would corrupt the forge's own state mid-run. The node test only
  needs to exit 0/non-zero; it must leave the project tree untouched except for the
  workstream's own declared `files`.
- **Sanitized:** the `spineRoot` absolute `file://` URL exists only in throwaway
  tmpdir artifacts; the committed `run-summary.json` contains no absolute paths
  (the same sanitization the run already enforces).

## Trust preserved

- The forged components are dispatched like any workstream (Rule 1); the gate
  independently re-runs each node test (Rule 3) — a forged component that doesn't
  genuinely work cannot settle.
- Genuine **executable** checks (not shape-only) — the TELOS-pattern's gates hold
  the same rigor as RAG's and Phase B's; a broken forged component fails closed.
- The `design` workstream binds the design's model claims to the **signed ledger**
  (Phase B), so even the forged trust system's design can't misattribute authorship.
- No spine / `gate.mjs` / `sign.mjs` / `merkle-dag` / `saas-forge` / RAG-pattern /
  Phase-A-B-module change.

## Testing (keyless, deterministic, zero-dep)

- **e2e:** forge the TELOS pattern → converges (8 workstreams `meets`, `gate_status:
  "pass"`, `records.length === 8`); every forged `telos/*` component genuinely
  executes against the real spine.
- **Fail-closed (proves the gates are not tautologies):** perturb a workstream's
  render so its component misbehaves — e.g. the `sign` selftest asserting a
  *tampered* packet *verifies*, or the `gate` selftest feeding a packet it should
  block but asserting pass — and assert the forge does **not** converge. Plus the
  inherited `design` fail-closed (drifted DESIGN.md blocks).
- Added to the existing `ai-forge` CI matrix entry (ubuntu, Node 18 & 20).

## Exit criteria

- `ai-forge` `npm test` exit 0, including the TELOS-pattern e2e (8 workstreams
  converge) + at least 2 fail-closed sub-cases + the inherited design checks.
- `docs/runs/ai-forge-telos/` evidence: a converged run (8 `meets`, gate pass),
  sanitized (no absolute `spineRoot`).
- All existing packages green; spine and saas-forge untouched; roadmap Phase C → done.

## Decisions log (brainstorming, 2026-06-29)

- **Phase C scope:** ONE pattern — the **TELOS-pattern itself** (self-similar /
  meta), not the broader catalog or the workstream-library generalization.
- **Component set:** the **full spine** — 7 forged components (sign, plan,
  provenance, gate, council, ledger/done, breakout-verify) + the generic design
  workstream (8 total).
- **What the components are:** **wrap the real spine** (import + configure), not
  standalone re-implementation — a TELOS-like system is built *on* the spine.
- **Reconciliation with the discipline:** **inject `spineRoot` via ctx** as a
  `file://` URL so the forged artifacts genuinely **execute** the spine in their
  node tests (keeping executable checks), with evidence sanitized. (Rejected:
  shape-only checks, which would weaken this pattern's gates below RAG's/Phase B's.)

## Non-goals (Phase C — YAGNI)

- The forged system is **not standalone** — it requires the spine on a known path
  (accepted cost of "wrap"). No attempt to make the forged `telos/` runnable
  without the repo.
- **One pattern only.** `multi-agent`, `eval-harness`, `serving+guardrails`
  patterns, and the composable-workstream-library generalization (issues #30/#37),
  remain deferred.
- No spine / saas-forge / RAG-pattern / Phase-A-B-module changes — only a new
  `patterns/telos.mjs` + its tests + CI/docs.
