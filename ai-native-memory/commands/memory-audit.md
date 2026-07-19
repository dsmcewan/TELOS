---
description: Audit the repo's institutional-memory record sets (three-representation, taxonomy, query-freshness, mirror-sync, staleness). Fail-closed.
---

Run the audit oracle against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/audit.mjs ${1:-.}`

The audit checks `CURRENT-AUTHORITY.json`; recomputed content-addressed IDs; byte-derived rendered Markdown; query derivation; mirror equality; oracle-file path existence; and staleness. Missing, malformed, unreadable, or unresolved `derived_from` is a FAIL. A resolving `as_of` commit behind HEAD is a WARN; an unresolved commit or a missing, malformed, or hash-drifted snapshot is a FAIL. Audit validates that declared oracle files exist but does not execute them; `memory-verify` executes each contract's declared oracle.

Report the findings verbatim (JSON lines + summary). Exit 2 means FAIL findings exist — list each with its check family and the minimal fix. Exit 1 means the audit could not run. Do NOT soften findings; the audit is fail-closed by design. If the user wants interpretation (root causes, fix ordering), suggest the memory-auditor agent.
