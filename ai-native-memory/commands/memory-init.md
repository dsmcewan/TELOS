---
description: Scaffold a machine-first institutional-memory record set
---

Run the init scaffolder against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs ${1:-.} ${2:-}`

It is idempotent. Authored scaffold files are created exclusively and never overwritten: it prints `skip:` for anything already present and `write:` for what it creates. The generated `MEMORY-MANIFEST.json` is the one explicit reconciliation surface: adding a canonical component path prints `update:` and atomically replaces that generated manifest under an exclusive lock, preserving sorted unique membership.

State the honest-scaffold rule to the author plainly: every scaffold record begins `SPECIFIED-PENDING-IMPLEMENTATION`, and its empty oracle and `becomes_normative_when` evidence deliberately leave it uncertified. Every `REPLACE:` marker must be replaced with the real statement before the record can be trusted. `CURRENT-AUTHORITY.json` begins unbound with `active: null`; a human must bind it to the governing document (`{ ref, path, sha256 }`) before any record in this repo can claim NORMATIVE status. After replacing any statement or evidence field, recompute the record's content-addressed `id` and regenerate its rendered Markdown projection.
