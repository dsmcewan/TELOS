---
description: Grade a reader's answers deterministically; GRANT or DENY implementation authority
---

Run the comprehension gate against the reader's answers:

Public parameters are `<queries.json> <answers.json> [CURRENT-AUTHORITY.json] [gate-artifact.json]`. They map to the executable's two positional paths plus its required `--authority` path and optional `--out` path:

`node ${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs ${1:-comprehension-queries.json} ${2:-answers.json} --authority ${3:-CURRENT-AUTHORITY.json} --out ${4:-gate-artifact.json}`

A conceptual component maps to that component's `memory/comprehension-queries.json`; there is no separate component flag. Pass that file as `<queries.json>`.

The gate verifies the active authority document's hash against disk FIRST, before grading anything — a drifted authority certifies no one. It then loads sibling `INVARIANTS.json` and `NON-CLAIMS.json`, requires at least one query and nonempty required arrays, rejects invalid or duplicate required IDs, and resolves every required content address to a sibling record of the correct kind. Every query must have a unique nonempty ID, nonempty query text, a supported `answer_kind`, and an `expected` value of the exact declared type; every submitted answer must have that same type before equality is graded. A missing or malformed sibling record file is cannot-run exit `1`; a structurally valid but empty, duplicate, invalid, dangling, wrong-kind, malformed-query, or mistyped-answer requirement is DENIED exit `2`. This deliberately prevents a freshly scaffolded, still-empty query document from granting authority.

Report the printed artifact verbatim. Exit 0 means COMPREHENSION_PASSED / implementation authority GRANTED. Exit 2 means COMPREHENSION_FAILED / implementation authority DENIED — list each failed check from `unresolved`. Exit 1 means the gate could not run at all, most often because the authority file itself is drifted or a sibling machine record file cannot be read and validated. Fix that evidence before attempting to certify anyone; do not treat exit 1 as a DENY.
