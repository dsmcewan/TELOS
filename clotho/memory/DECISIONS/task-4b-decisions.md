---
type: contract
topic: clotho
status: living
kind: decision
task: "4b"
status_taxonomy: SPECIFIED-PENDING-IMPLEMENTATION
authority: v15 sha256:05a48700… · authz-008
note: Frozen Task 4b decisions (test/doc/ledger weavers). Design substrate — code not yet written; each record flips to NORMATIVE-CURRENT when its named oracle passes.
---

# Task 4b — decision records (design substrate)

## D25 — command-inferred verified-by provenance

- **what** — a `verified-by` edge inferred from a package `check`/`test` command carries
  `source_ref = file:<package.json path>@<package.json blob_sha>`; an edge inferred from a
  test-file import (or test-file classification) keeps the **test file's** own blob source
  ref. The same target verified once via import and once via command yields two distinct
  records with distinct source refs, both retained by the payload identity key.
- **why** — the source ref must name the bytes that actually evidence the relationship; for
  command execution that is the manifest, not the test file. Conflating them loses provenance.
- **scope** — the test-weaver (`test.mjs`), Task 4b. **authority** — D25 (spec v2.4), authz-008.
- **non_claim** — no command is executed; command strings are parsed only as text.
- **change_rule** — plan amendment → re-authorization → implementation review.
- **status** — `SPECIFIED-PENDING-IMPLEMENTATION`; **becomes_normative_when**
  `clotho/scripts/test-test.mjs` proves both provenance cases by exact-output tests.
- **contract** — `clotho/memory/CONTRACTS/verified-by-provenance.json`.

## D31 — independent contract-files consumption

- **what** — the ledger weaver builds its current-contract clause-resolution index SOLELY from
  its own counted `contract-files` source (open, read, canonical Markdown split, normalized
  heading paths, exact section hashes, collision-checked index). It receives NO map from the
  doc-weaver and performs no uncounted fallback read. The iterator is consumed and exhausted
  whenever the ledger weaver executes — even when the doc-weaver is skipped, when no obligation
  produces a clause edge, and when every reference is stale. `obligation -> contract-clause`
  `discharges` is emitted ONLY on an exact `{path, heading_path, text_sha256}` reference that
  resolves uniquely in that own index; stale/partial/missing/nonunique warns, no edge, but full
  consumption is still recorded.
- **why** — the ledger clause resolution must be independently evidenced and counted (D26/D29),
  not borrowed from another weaver's mutable product; shared state would break producer==attribution
  and counted-source accounting.
- **scope** — the ledger weaver (`ledger.mjs`), Task 4b. **authority** — D31 (spec v2.7), authz-008.
- **non_claim** — no generic JSON fallback; identifier matching only over adapter-declared fields.
- **change_rule** — plan amendment → re-authorization → implementation review.
- **status** — `SPECIFIED-PENDING-IMPLEMENTATION`; **becomes_normative_when**
  `clotho/scripts/test-ledger-weaver.mjs` proves independence + full counted consumption + the
  discharges matrix.
- **contract** — `clotho/memory/CONTRACTS/discharges-matrix.json`.

## Markdown splitting + duplicate-heading (doc + ledger weavers)

- **what** — ATX/Setext headings outside fenced code; a section is the exact byte slice from its
  heading to the byte before the next heading of any level; section hashes are SHA-256 of those
  exact bytes; duplicate `{path, heading_path}` in one file is fatal `duplicate-heading-path`
  (address marked absent, no edge to either ambiguous section).
- **authority** — Task 4b, authz-008. **status** — `SPECIFIED-PENDING-IMPLEMENTATION`;
  **becomes_normative_when** `clotho/scripts/test-doc.mjs` proves the split + duplicate-heading
  fatal behavior. **non_claim** — `alphabet` does not match `alpha` (token match, not substring).
