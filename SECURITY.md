# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/dsmcewan/TELOS/security/advisories/new)
("Report a vulnerability"). Do not open a public issue for anything exploitable.

Reports about the trust model are especially welcome: anything that lets a seat's
self-report satisfy the gate, lets evidence be fabricated or replayed, weakens a
signature/provenance check, or makes a fail-closed path fail open.

## Scope notes

- **Secrets never enter the repository.** API keys and `TELOS_SECRET_*` HMAC
  secrets live in the environment or OS registry only; runtime `.telos/`
  artifacts are ephemeral and git-ignored. If you find a tracked secret or a
  path that would commit one, that is a vulnerability — report it privately and
  do not quote the value.
- The repository's only CI credential is `CLAUDE_CODE_OAUTH_TOKEN` (a Claude
  subscription token funding the automated review workflows). Local-dev env-var
  names appearing in job logs are not CI credentials.
- Documented honest limits (single trust principal for the proposal/build
  controllers, `dossier.write_targets`-trusted protected paths, and the other
  items listed in `CLAUDE.md`) are known boundaries, not undisclosed
  vulnerabilities — but a way to cross one of them from outside is in scope.

## Supported versions

The `main` branch. Tagged releases are snapshots and receive no separate fixes.
