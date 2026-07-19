---
description: Prove NORMATIVE contracts equal reality via the host's verify-map
---

Run the verify oracle against the host repository's verify-map:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/verify.mjs ${1:-verify-map.json}`

For each entry (`{contract, oracle, cwd}`) the script requires the map oracle to equal the NORMATIVE-CURRENT contract's declared `oracle.test`, runs that oracle, and confirms it exits 0. It also requires the map to cover every discovered NORMATIVE-CURRENT contract exactly once. A conventionally named symlinked `memory` directory and a discovered contract-record symlink that escapes the repository are verify findings; neither can hide an uncovered contract. Report the findings verbatim (JSON lines + summary). Exit 0 means every NORMATIVE contract is proven by its declared oracle; exit 2 means a contract file could not be read or parsed, a map entry is invalid, coverage is incomplete, discovery found an unsafe record path, or an oracle failed or is missing — list each finding with the contract it backs. Only an unreadable or malformed verify-map document itself exits 1. Do NOT soften findings; a contract with a failing oracle is not NORMATIVE regardless of how the record is labeled.
