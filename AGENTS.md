# TELOS Operating Instructions

This file is a tool-facing adapter, not a governing record. Canonical
authority remains `CURRENT-AUTHORITY.json`, `repository-manifest.json`, the
active plan, and the institutional-memory records; where this file and they
disagree, they win.

Start every task by reading `AI-START-HERE.md` and following its onboarding
order. TELOS is a governed multi-model build gate; accumulated disk evidence,
content hashes, recorded authority, and deterministic gate results outrank
filenames, dates, model consensus, and self-reported completion.

## Before making changes

1. Read `CURRENT-AUTHORITY.json` and use only the active plan and authorization
   it identifies. Never treat a superseded plan or authorization as normative.
2. Read `repository-manifest.json`, then the applicable memory records:
   system records live under `docs/institutional-memory/<system>/` (e.g.
   `docs/institutional-memory/telos/INVARIANTS.md`); component records live
   under `<component>/memory/`. In each, read `INVARIANTS.md`,
   `NON-CLAIMS.md`, and relevant `DECISIONS/`, including
   `rejected-alternatives.md`.
3. Read `docs/institutional-memory/CHANGE-PROTOCOL.md`; escalate scope or
   specification ambiguity to The Eye instead of silently reinterpreting it.
4. For implementation work, answer the applicable component
   `memory/comprehension-queries.json`. For TELOS role/component records, obtain
   an exit-0 result from:

   ```bash
   node docs/institutional-memory/comprehension-gate.mjs \
     <path-to-memory-dir>/comprehension-queries.json <your-answers.json>
   ```

   `ai-native-memory` uses its plugin-native query schema and authority record:

   ```bash
   node ai-native-memory/scripts/gate.mjs \
     ai-native-memory/memory/comprehension-queries.json <your-answers.json> \
     --authority ai-native-memory/CURRENT-AUTHORITY.json
   ```

   Exit 0 is a required entry precondition, not the implementation-authority
   decision itself; The Eye remains the authority holder.

5. Confirm the record set still matches disk before relying on it:

   ```bash
   node docs/institutional-memory/verify-contracts.mjs
   ```

6. State the bounded scope, identify the controlling plan hash,
   authorization/decision identifiers, and list the validation commands and
   evidence required before editing.

## Evidence and completion

- Preserve provenance, content-addressed identity, fail-closed behavior,
  required-seat semantics, and existing gate boundaries.
- Do not describe work as complete, verified, accepted, merged, authorized, or
  release-ready unless the required deterministic checks actually ran
  successfully and their evidence exists on disk.
- Run the affected package's tests; each package's own `package.json` scripts
  and component documentation are the test source of truth. There is no shared
  root test command.
- Never commit secrets, `.env*`, `*.pem`, or ephemeral `.telos/` artifacts.
- Treat the mythological namespace as closed. Use only registered meanings from
  `docs/mythological-vocabulary.md`; otherwise use plain descriptive language.
- Every load-bearing claim must terminate in a stable identifier such as a plan
  SHA-256, `authz-N`, `AM-N`, or Git commit.
