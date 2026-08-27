# Contributing

TELOS is a fail-closed multi-model build-gate; its conventions exist to keep the
trust model auditable. `CLAUDE.md` is the full working guide — this file is the
short version for a first PR.

## Ground rules

- **Zero dependencies** in every core/plugin package: Node standard library
  (`node:` prefix) plus the package's existing reviewed relative imports only;
  no lockfiles. The one exception is `narcissus/flagship`
  (React/TypeScript/Vite, tracked `package-lock.json`, `npm ci`). Do not add a
  dependency — including "just a linter" — to a zero-dependency package.
- **Fail closed.** If evidence is absent or ambiguous, block rather than
  approve. A change that converts a distinct failure into a silent fallback
  will be rejected.
- **No mutable label may key an enforcement decision** — enforcement identities
  are content addresses. Hash-pinned or signed artifacts (committed evidence,
  ledger snapshots, run records) are never rewritten; corrections get new
  records citing the old ones.
- **Mythological names are a reserved namespace.** Read
  `docs/mythological-vocabulary.md` before naming anything after a mythological
  figure; unregistered names are not available for casual use.
- **Secrets never enter the repo** — no `.env*`, `*.pem`, or runtime `.telos/`
  artifacts in commits.

## Before opening a PR

1. Run the affected package's own suite (`npm test` in that package; there is
   no shared root script — the full list is in `CLAUDE.md`).
2. If you touched governance records, contracts, or anything under
   `docs/institutional-memory/`, run
   `node docs/institutional-memory/verify-contracts.mjs` (all checks must pass)
   and `node docs/runs/clotho-self-weave/run.mjs --verify-committed`.
3. Keep the change scoped; one concern per PR, and say in the body which
   suites you ran.

CI runs every package suite on Node 22 and 24 plus the institutional-memory
oracles; the single required status check is the aggregate "required CI" job.
