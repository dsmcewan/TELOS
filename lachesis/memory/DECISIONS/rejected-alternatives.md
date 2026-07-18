# Lachesis — rejected alternatives (cycle 1)

Load-bearing rejections, surfaced across the Daedalus workshop (10 rounds) + the adversarial code-review
pipeline (5 rounds). Each rejection is why the current design is shaped as it is.

- **Import `clotho/query.mjs` / `clotho/registry.mjs`** — REJECTED: the frozen spine boundary (nothing outside
  `clotho/` imports it). Lachesis reads the serialized snapshot as data.
- **Re-implement `deriveNodeId` / Clotho's `blastRadius`** — REJECTED: drift from the spine. Lachesis defines
  its own metrics and does NOT re-derive content-addresses (bijection instead of re-derivation — Ruling A).
- **The authorized plan's INPUT SCHEMA** (sha256:-prefixed ids, `kind` field, standalone node records) —
  REJECTED at Argo reconnaissance: it did not match reality. The real snapshot is a signed edge-stream with
  bare-hex ids, `edge_kind`, and no standalone node records. The plan passed 10 workshop rounds + a 5-seat
  council and was STILL wrong about its input — corrected under The Eye's "code it to reality" mandate.
- **relevance = normalized `depends-on` in-degree only** (my interim) — REJECTED by the GPT-seat ruling:
  restore the 3:2:1 salience but CORRECT the orientation (verified-by/introduced-by credit the FROM subject,
  not the TO test/commit).
- **relevance feeding riskClass** — REJECTED: relevance measures salience, not impact; snapshot-relative
  normalization is no absolute risk threshold. riskClass is blast-driven.
- **Presence-based / "one edge per kind" completeness** — REJECTED as false completeness: coverage is
  attestation-gated; risk floored at medium unless attested-complete.
- **Caller-supplied snapshot path/digest, unpinned working-tree manifest** — REJECTED: the path is bound to
  the manifest and realpath-contained; the digest syntax is checked. (Durable manifest anchoring in
  CURRENT-AUTHORITY is HELD, not claimed.)
- **`JSON.stringify` for locator equality** — REJECTED (object member order): structural equality via
  `isDeepStrictEqual` + a canonical bucket key; plus canonical-JSON enforcement upstream.
- **A complete import lexer for the boundary oracle** — REJECTED as out of reach without importing Clotho's
  source-profile scanner; a fail-closed static heuristic + NON-CLAIM instead.
