# Atropos — rejected alternatives (cycle 1)
- **Mutating actor** (writes CURRENT-AUTHORITY / performs retirement) — REJECTED (The Eye ruled read-only): a
  module mutating the authority root is high-risk; retirement stays a human CHANGE-PROTOCOL step.
- **Import `clotho/` / reuse its query surface** — REJECTED: frozen spine boundary. Atropos reads the
  supersession surface as data.
- **Full node-backed three-surface verifier now** — REJECTED as UNREPRESENTABLE under the current schema
  (0 node-backed retirements exist; representing them needs a future schema + the deriveNodeId boundary resolution).
- **Treating surface-scope as a CHANGE-PROTOCOL governance amendment** — REJECTED: it's a design determination
  (peer-model collaboration with codex, adopted as The Eye's ruling). Reviewer drift on this point cost ~6 rounds.
- **String-kind matching for record↔node identity** — REJECTED: identity is by content, not kind string.
