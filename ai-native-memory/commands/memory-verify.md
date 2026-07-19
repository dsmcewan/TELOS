---
description: Prove NORMATIVE contracts equal reality via the host's verify-map
---

Run the verify oracle against the host repository's verify-map:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs ${1:-verify-map.json}`

For each entry (`{contract, oracle, cwd}`) the script runs the named oracle and confirms it exits 0. Report the findings verbatim (JSON lines + summary). Exit 0 means every NORMATIVE contract is proven by its oracle; exit 2 means at least one contract's oracle failed or is missing — list each with the contract it backs; exit 1 means the verify-map itself, or a contract file it points at, could not be read. Do NOT soften findings; a contract with a failing oracle is not NORMATIVE regardless of how the record is labeled.
