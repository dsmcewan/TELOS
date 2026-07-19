---
description: Scaffold a machine-first institutional-memory record set
---

Run the init scaffolder against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs ${1:-.} ${2:-}`

It is idempotent. Authored scaffold files are created exclusively and never overwritten: it prints `skip:` only for an acceptable existing regular file and `write:` for what it creates; non-regular collisions fail closed. The generated `MEMORY-MANIFEST.json` is the one explicit reconciliation surface: under an exclusive lock, the command validates the current manifest, completes the component scaffold, then publishes sorted unique membership last through an atomic replacement. Adding a canonical component path prints `update:`.

State the honest-scaffold rule to the author plainly: every scaffold record begins `SPECIFIED-PENDING-IMPLEMENTATION`, `lifecycle: "docs-first"`, `evidence: []`, and an empty `becomes_normative_when`; the contract also carries `decided_by: "human"`. Invariant and non-claim `oracle` values are exactly `""`, and the contract's `oracle.test` is exactly `""`. These empty fields deliberately leave the records uncertified: audit rejects the empty pending transition and the comprehension gate rejects the empty query/required-record sets even after authority is bound. Replace every `REPLACE:` marker, author a portable repository-relative JavaScript oracle path in `becomes_normative_when`, populate both required-record arrays with the content-addressed IDs of sibling records, and author at least one derived query before seeking certification. `CURRENT-AUTHORITY.json` begins unbound with `active: null`; a human must bind it to the governing document (`{ ref, path, sha256 }`) before any record in this repo can claim NORMATIVE status. After replacing any statement, lifecycle, provenance, or evidence field, recompute the record's content-addressed `id` and regenerate its rendered Markdown projection.
