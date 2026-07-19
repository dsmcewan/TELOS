---
description: Scaffold a machine-first institutional-memory record set
---

Run the init scaffolder against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/init.mjs ${1:-.} ${2:-}`

It is idempotent — it never overwrites an existing file; it prints `skip:` for anything already present and `write:` for what it creates.

State the honest-scaffold rule to the author plainly: contracts and invariants start life as `SPECIFIED-PENDING-IMPLEMENTATION` with placeholder oracle refs (`"NAME-THE-ORACLE-TEST-FILE"`) — nothing is NORMATIVE until an oracle proves it. The scaffolded example non-claim starts `NORMATIVE-CURRENT`, since a non-claim states what is NOT done and needs no oracle to be true. Every `REPLACE:` marker must be replaced with the real statement before the record can be trusted. `AUTHORITY.json`'s `active` field starts `null`; a human must bind it to the governing document (`{ ref, path, sha256 }`) before any record in this repo can claim NORMATIVE status.
