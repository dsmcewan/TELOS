# ai-native-memory — identity

`ai-native-memory` is a Claude Code plugin that packages an institutional-memory standard for
handoff to a successor AI model: machine-first records are the source of truth, human-readable
docs (`.md`) are rendered projections of those records, and every claim that matters has an
executable oracle behind it — no claim is trusted on a model's self-report. It ships the standard
itself (as skills), portable zero-dependency Node oracles that enforce it (`init.mjs`, `audit.mjs`,
`verify.mjs`, `gate.mjs`), slash commands and agents that wrap those oracles, and this directory —
its own `memory/` record set, authored in the format it ships, so the plugin's central claim
("a fresh model can inherit a system from records like these, without inventing gaps") is
demonstrated on itself rather than merely asserted.

It is not a general documentation generator, not a knowledge base, and not a replacement for a
repository's existing docs or CI. It is a thin, fail-closed layer that any repository can adopt by
running `/memory-init`, and that a host's CI can optionally gate on by checking the exit codes of
`audit.mjs`, `verify.mjs`, and `gate.mjs`. Nothing in this plugin executes untrusted host code
beyond spawning the oracle files a host explicitly names in its own `verify-map.json`, and nothing
in this plugin depends on any package outside the Node standard library.
