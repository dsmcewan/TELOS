---
description: Audit the repo's institutional-memory record sets (three-representation, taxonomy, query-freshness, mirror-sync, staleness). Fail-closed.
---

Run the audit oracle against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/audit.mjs ${1:-.}`

The audit checks `CURRENT-AUTHORITY.json`; recomputed content-addressed IDs; the closed lifecycle and decision-provenance values; kind-specific required fields; byte-derived rendered Markdown; nonempty queries and nonempty, unique, content-addressed required-record arrays that resolve to sibling records of the correct kind; query derivation; mirror equality; portable oracle-file path existence; and staleness. A conventionally named `memory` symlink and a primary record-file symlink escape are FAIL findings, never ignored record sets. Pending `becomes_normative_when` values must name a contained, portable repository-relative `.js`, `.cjs`, or `.mjs` oracle path, although that future path may remain absent while the record is pending. Missing, malformed, unreadable, or unresolved `derived_from` is a FAIL. A resolving `as_of` commit behind HEAD is a WARN; an unresolved commit or a missing, malformed, or hash-drifted snapshot is a FAIL. Audit validates that declared oracle files exist but does not execute them; `memory-verify` executes each contract's declared oracle.

Report the findings verbatim (JSON lines + summary). Exit 2 means FAIL findings exist — list each with its check family and the minimal fix. Exit 1 means the audit could not run. Do NOT soften findings; the audit is fail-closed by design. If the user wants interpretation (root causes, fix ordering), suggest the memory-auditor agent.
