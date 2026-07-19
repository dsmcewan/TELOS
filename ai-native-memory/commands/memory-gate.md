---
description: Grade a reader's answers deterministically; GRANT or DENY implementation authority
---

Run the comprehension gate against the reader's answers:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs ${1:-comprehension-queries.json} ${2:-answers.json} --authority ${3:-AUTHORITY.json} --out ${4:-gate-artifact.json}`

The gate verifies the active authority document's hash against disk FIRST, before grading anything — a drifted authority certifies no one. Report the printed artifact verbatim. Exit 0 means COMPREHENSION_PASSED / implementation authority GRANTED. Exit 3 means COMPREHENSION_FAILED / implementation authority DENIED — list each failed check from `unresolved`. Exit 1 means the gate could not run at all, most often because the authority file itself is drifted (the file on disk no longer hashes to what `AUTHORITY.json` claims) — in that case, fix the authority record before attempting to certify anyone; do not treat exit 1 as a DENY.
