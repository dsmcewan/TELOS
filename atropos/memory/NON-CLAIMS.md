# Atropos — NON-CLAIMS (cycle 1)

- **Does NOT retire anything.** Read-only. It verifies recorded retirements are consistent; performing a
  retirement is a human `CHANGE-PROTOCOL` action (SUPERSEDED record + weave edge + CURRENT-AUTHORITY update).
  Atropos never writes.
- **Node-backed retirement is DEFERRED** — `UNREPRESENTABLE_CURRENT_AUTHORITY_REFLECTION`. The current schema
  represents only plan-version retirements; the three-surface node-backed verifier (edge direction, identity
  resolution, `deriveNodeId` boundary) waits for a future schema that lets CURRENT-AUTHORITY reflect non-plan
  retirements.
- **The verdict is ADVISORY where it feeds decisions.** The plan-version consistency check is NORMATIVE
  (tested oracle); Atropos does not enforce or gate merges — its report is input to TELOS/The Eye.
- **The read-only oracle is a fail-closed static scan, NOT a sandbox or proof.** A determined author could
  evade it; the authoritative guarantee is the zero-`dependencies` package + the small reviewed runtime surface.
- **Trust is relative to the supplied CURRENT-AUTHORITY.** No durable authentication of that file; the terminal
  disk-resolve binds the verdict to the active_plan bytes on disk, nothing more.
