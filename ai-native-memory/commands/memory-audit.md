---
description: Audit the repo's institutional-memory record sets (three-representation, taxonomy, query-freshness, mirror-sync, staleness). Fail-closed.
---

Run the audit oracle against the host repository:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/audit.mjs ${1:-.}`

Report the findings verbatim (JSON lines + summary). Exit 2 means FAIL findings exist — list each with its check family and the minimal fix. Do NOT soften findings; the audit is fail-closed by design. If the user wants interpretation (root causes, fix ordering), suggest the memory-auditor agent.
