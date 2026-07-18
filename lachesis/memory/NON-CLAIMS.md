# Lachesis — NON-CLAIMS (cycle 1)

What Lachesis does NOT do or establish. These are honest limits, several IRREDUCIBLE without crossing the
frozen `clotho/` boundary. They were surfaced by the adversarial code-review pipeline (docs/runs/lachesis-argo-1)
and recorded rather than papered over. Enrollment/authority decisions must read these.

## Scope (registered meaning)
- Lachesis MEASURES only. It does NOT authorize (TELOS), enforce, retire (Atropos), weave (Clotho), or render
  (Narcissus). The **risk class is ADVISORY**, never an enforced gate. `relevance` is a reported salience
  proxy, not ground truth.

## Identity & trust (GPT-seat Ruling A, delegated by The Eye)
- Does NOT claim `from_node == deriveNodeId(from_locator)` — NO content-address re-derivation (would require
  importing `clotho/registry.mjs`, forbidden, or reimplementing it, which drifts). It establishes only
  intra-snapshot locator↔id **bijective consistency**.
- The digest check is integrity **relative to the supplied manifest only** — NOT a durable trust root. Does
  NOT claim `CURRENT-AUTHORITY` anchoring, authority continuity, publisher identity, or authorization of the
  snapshot. (Durable anchoring is a HELD decision for The Eye.)
- Does NOT verify the Clotho record-hash chain, Ed25519 signatures, header pub_key, or trailer cryptography —
  those fields are checked for PRESENCE only.
- Does NOT enforce a full per-KIND locator field schema (only: payload present + non-empty object).
- Does NOT "brand" the weave object — `measure` operates on the frozen, digest-stamped structure `loadWeave`
  returns; it does not cryptographically prove provenance of a weave-shaped object. Callers must pass a
  `loadWeave` result.
- The realpath→open TOCTOU window is narrowed (fd read) but not eliminated; the digest bounds substitution to
  matching content.

## Measurement
- Measures over the edges PRESENT. `supersedes`/`discharges` are accepted (complete-set discipline) but NOT
  interpreted as retiring other edges (retirement-aware measurement is future; the pinned snapshot has 0 such
  records, so all edges are live here).

## Boundary oracle
- `scripts/test-boundary.mjs` is a FAIL-CLOSED static import-profile heuristic, NOT a complete lexer (a
  complete one would require importing Clotho's source-profile scanner, forbidden). A determined author could
  still evade it; the authoritative boundary guarantees are the zero-`dependencies` package + the small
  reviewed runtime surface (`ingest.mjs`, `measure.mjs`).
