# CLAUDE.md

Guidance for Claude Code (and the `@claude` GitHub Action) when working in this repo.

## What TELOS is

A **multi-model build-gate**. Independent AI model *seats* (claude / grok / codex / agy / gemini)
each produce a signed approval packet; a deterministic *gate* certifies merge-readiness
from disk + signatures + provenance — **never** from a model's self-report. The system is
**fail-closed**: missing or unverifiable evidence blocks the merge.

Read `README.md` for the full trust model before changing gate logic.

## Mythological namespace — RESERVED (read before naming anything)

**Greek mythology is a reserved namespace in this project. No ad hoc imports.** Mythological names,
figures, places, objects, and concepts are reserved architectural identifiers — never casual metaphor,
humor, shorthand, incident naming, or descriptive language. `docs/mythological-vocabulary.md` holds the
policy and the registry of canonically-defined terms; read it before using any such name.

- Registered terms retain EXACTLY their defined meaning — do not paraphrase, narrow, or extend them.
- Unregistered terms must not be introduced without human approval. Unregistered ≠ available.
- When no registered term applies, use plain descriptive language.
- Do not infer ownership from mythological resemblance.

This is a closed set, not a list of forbidden misuses — the same discipline as `NA_ALLOWED`,
`EVIDENCE_KINDS`, and `check-registry.mjs`. Improvising a referent manufactures fake ownership (blame
landing on a component that did nothing), which is the content-address rule one layer up: a mutable
label must not stand where an identity belongs. (Discussing mythology as a subject is unaffected; this
governs mythology used as project vocabulary.)

## Layout

Executable areas are package-scoped; documentation and contracts are not packages.
The current machine map is `repository-manifest.json` and wins over this summary:

- `build-gate/` — the gate (`gate.mjs`), per-seat HMAC signing (`sign.mjs`), and the
  council orchestrator (`council.mjs`).
- `breakout/` — adversarial self-challenge + verdict-on-facts (`verifier.mjs`, `live.mjs`)
  and a minimal MCP stdio client (`mcp_client.mjs`).
- `connectors/ai-peer-mcp/` — MCP server exposing the model backends with real per-seat
  provenance (`server.mjs`, `lib.mjs`).
- `merkle-dag/` — content-addressed planning, Ed25519 verified delegation, append-only
  signed ledger, a pure `done()` merge gate (`ledger-gate.mjs`), verification obligations
  (`obligation.mjs`), and the signed proposal-lifecycle ledger + primitives
  (`proposal-ledger.mjs`).
- `saas-forge/`, `ai-forge/`, and `forge/` — composed product generators over the
  trust spine.
- `clotho/` — provenance-aware knowledge-graph weaver. `lachesis/` and `atropos/`
  are its consciously enrolled measurement and supersession-verification spine
  packages; preserve each package's explicit non-claims.
- `ai-native-memory/` — portable zero-dependency institutional-memory plugin/product;
  it is not a mythological role and its Iliad enrollment remains deferred.
- `narcissus/flagship/` — implemented React/TypeScript/Vite product. It is distinct
  from the registered, still-unimplemented Narcissus role module.
- `contracts/` — the human-readable protocol the gate enforces (incl.
  `Proposal Lifecycle.md`: audited judgment, cold review, verification obligations).
- `docs/` — status, specs, plans, and run evidence.

The **proposal-lifecycle** layer (opt-in via `dossier.proposal_lifecycle === true`;
legacy advisory mode is byte-identical) lives in `build-gate/`. `buildProject`
delegates to `proposal-orchestrator.mjs` (`runProposalLifecycle`), which composes the
recorder + Daedalus workshop + the outer revision loop + gate-reconstructed
authorization + execution. Its primitives: `daedalus.mjs` (the claude/codex planning
workshop), `concerns.mjs` (typed concerns/holds/dispositions + `processReviewPackets`,
the sole controller-side concern minter), `check-registry.mjs` (the closed
verification check-contract registry that mints dedicated discharge nodes),
`risk-policy.mjs`, `evidence.mjs` (closed-whitelist sandboxed verifier),
`proposal-gate.mjs` (reconstructs proposal state from the ledger + binds each
obligation's executable to its concern's check-contract), `proposal-recorder.mjs`
(sole-writer), and `standing.mjs`. Its rule: **no mutable label keys an enforcement
decision; every enforcement identity is a controller-derived content address; the
gate reconstructs state from the ledger, never trusting caller-supplied state.**
End-to-end evidence (keyless): `docs/runs/proposal-lifecycle/` — `run-lifecycle-e2e.mjs`
drives the full flow through `buildProject`, `run-proposal-lifecycle.mjs` is a
primitive-composition demo. Maintainer's map of the composed flow + modules +
enforcement mechanisms: `docs/proposal-lifecycle-implementation.md`. **Honest limits:** the proposal-controller and
build-controller are ONE trust principal (no multi-party separation); execution-time
re-verification covers only ledger-reconstructable state; protected-path enforcement
trusts `dossier.write_targets`; live-key runs, human-adjudication UX, fork recovery,
key rotation, and cross-process durable resume of the autonomous entry point are out
of scope. Failure modes surface as `blocked` / `human-review-required` (stalemate,
budget exhaustion, unresolvable verification) / `DECISION_NOT_AUTHORIZED`.

Note: `build-gate/` imports from `breakout/` (`reverifyRecord` from `../breakout/verifier.mjs`),
so the packages are not fully isolated — preserve those cross-package relative imports.

## Conventions

- **Core and plugin packages:** Node ≥ 18, ESM only (`"type": "module"`, `.mjs`
  files), zero dependencies, and no package lockfiles. Use only Node standard-library
  imports with the `node:` prefix plus the package's existing reviewed relative imports.
- **Flagship product exception:** `narcissus/flagship/` requires Node
  `^20.19.0 || >=22.12.0`, uses React/TypeScript/Vite, and must keep its tracked
  `package-lock.json`. Install it with `npm ci`; do not hand-edit the lockfile or add
  dependencies without a reviewed product change.
- **Style:** match the surrounding package. The zero-dependency `.mjs` packages use
  double-quoted strings, semicolons, 2-space indent, named top-level `const` config
  sets, and small pure functions. The flagship follows its existing TypeScript/React
  toolchain.
- Keep modules executable as scripts where they already are (`#!/usr/bin/env node` shebang).

## Testing — always run before proposing changes

Use each package's own scripts; most zero-dependency packages make `npm test` run a
`node --check` syntax pass first. `ai-native-memory` exposes that pass separately, and
the flagship has its own locked frontend pipeline. There is no shared root script —
run the exact commands below for the package(s) you touched:

```bash
cd build-gate            && npm test   # gate, sign, trust, council, stress (+ runs breakout)
cd breakout              && npm test
cd connectors/ai-peer-mcp && npm test
cd merkle-dag            && npm test
cd saas-forge            && npm test
cd ai-forge              && npm test
cd forge                 && npm test
cd clotho                && npm test
cd ai-native-memory      && npm run check && npm test
cd lachesis              && npm test
cd atropos               && npm test
cd narcissus/flagship    && npm ci && npm test && npm run verify:evidence \
                           && npm run verify:coverage && npm run build && npm run test:e2e
```

`build-gate`'s test suite also runs `breakout`'s, so changes touching either should be
validated via `build-gate`. Tests are plain Node scripts under each package's `scripts/`.

## Security & trust — do not weaken

This is the core invariant of the project. When changing gate, signing, or provenance code:

- The gate must **re-read disk ground truth** and verify both **HMAC signature** and **real
  provenance** under `trust_mode: "signed"`. Never let a seat's self-reported status, or one
  seat's response id, satisfy the gate.
- **Secrets never enter the repo.** API keys (`ANTHROPIC_API_KEY`, `XAI_API_KEY`,
  `OPENAI_API_KEY`, `GEMINI_API_KEY`) and `TELOS_SECRET_*` HMAC secrets live in env / OS registry
  only. The proposal-controller signing key (`TELOS_PROPOSAL_CONTROLLER_SK`, a pkcs8 PEM) is also
  env-only; when unset, the autonomous proposal-lifecycle entry point uses an ephemeral per-run key.
  Runtime `.telos/` artifacts are ephemeral and git-ignored — never commit them, `*.pem`, or
  `.env*` files.
- **CI credentials are a SEPARATE thing from the env vars above.** The API keys listed above are
  LOCAL-dev env vars. The repository's only GitHub Actions secret is `CLAUDE_CODE_OAUTH_TOKEN` (a
  Claude subscription token, minted with `claude setup-token`), which funds the automated review
  workflows; `ANTHROPIC_API_KEY` was removed as a repo secret once subscription auth was proven, so
  CI has no metered fallback. Do not read a local env var's name as evidence of a CI credential — in
  a job log, `ANTHROPIC_API_KEY:` may appear DECLARED AND EMPTY beside the token that actually
  authenticated.
- Prefer failing closed: if evidence is absent or ambiguous, block rather than approve.

## Pull requests

- Keep changes scoped; run the affected package's `npm test` and report the result.
- Do not add dependencies or build tooling to zero-dependency packages. In the
  flagship, keep dependency changes reviewed and lockfile-backed. Never commit
  runtime or secret artifacts.
