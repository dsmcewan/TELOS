# Lachesis — failure modes

All ingestion failures are **fail-closed** (throw; nothing partial reaches measurement):
- snapshot digest mismatch / malformed digest syntax / path escaping rootDir / not-a-regular-file
- non-UTF-8 bytes / non-canonical line / blank line / unparseable JSON / non-object record
- misplaced/duplicate header, non-array-object or missing trailer, missing signed-ledger fields
- unknown edge_kind / non-64-hex node id / unknown or empty-payload locator kind / disallowed source_ref
- self-edge / duplicate (edge_kind,from,to) edge
- locator↔id bijection violation (same id → different locator, or same locator → different ids)

Measurement failures:
- `measure` on a node id absent from the weave → throws (never a plausible default).
- `blastRadius` with a depth that is not a non-negative integer or `Infinity` → throws.

Known non-fatal residuals (NON-CLAIMS.md): no crypto chain/signature verification, no content-address
re-derivation, no durable trust-root, boundary oracle is a heuristic not a lexer, TOCTOU window narrowed not
eliminated. These surface as documented limits, not as silent acceptance of bad data beyond the checks above.
