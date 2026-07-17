# Slice-7 implementation approach — revised (Daedalus author round)

Scope: implement the frozen Task 6 flagship acceptance and Task 7 reproduction gate without changing their contracts. Node >=18, ESM, zero dependencies, fail-closed behavior, and the advisory/non-sandbox posture remain mandatory.

## Deliverables and writer boundaries

Use two disjoint-writer agents, followed by one integration writer.

- **agent-D — documentation and housekeeping:**
  - Update `docs/STATUS.md` and `docs/ROADMAP.md` to the final Phase 1 state.
  - Inventory completed design and plan artifacts and move every eligible artifact to `docs/history/` according to repository convention.
  - Before each move, check tracked contracts, authority records, scripts, tests, and verifier inputs for path-sensitive references. A path required by a living verifier is not moved unless that verifier is updated within an allowed path and the same bytes remain verifiable. Record the move inventory and disposition of every candidate.
  - Write only `docs/STATUS.md`, `docs/ROADMAP.md`, and convention-conformant moves into `docs/history/`.

- **agent-R — flagship and reproduction implementation:**
  - Implement or tighten `clotho/scripts/test-flagship.mjs` and its tests so the frozen matcher, D25 provenance, review-set, closure, attribution, count, current-document, gap, and D35 requirements below are executable rather than descriptive.
  - Preserve the hand-audited `clotho/scripts/expected-flagship.json` bytes unless a separately authorized correction is required. Acceptance is blocked until The Eye reviews and binds the exact artifact and its content hash.
  - Author `docs/runs/clotho-self-weave/run.mjs`, including a read-only committed-evidence verification mode.
  - Write only under `clotho/` and `docs/runs/clotho-self-weave/`. A `.gitignore` change is permitted only if required by the frozen temporary-output discipline.

The agents may author in parallel, but no final evidence run occurs until agent-D's moves and documentation updates, agent-R's code, and the Eye-bound expected artifact are merged into a committed input HEAD.

## Flagship matcher contract

`test-flagship.mjs` must implement the frozen matcher directly:

1. Parse the expected artifact under a strict schema. Validate the required D25 provenance on every expected entry and validate that all eight frozen groups are present with their prescribed group semantics and cardinalities.
2. Apply each group's frozen neighborhood predicate and fact shape. Match expected facts using **exact JSON equality only**: identical JSON types, object member sets and values, and array contents/order. Do not use coercion, substring matching, normalization, scoring, fuzzy matching, or partial-object matching.
3. Construct the global expectation-to-fact relation and require a bijective assignment for the expected set:
   - every expectation has exactly one eligible exact match;
   - no eligible fact is assigned to more than one expectation;
   - zero-match, multi-match, or fact-reuse cases fail.
4. Preserve each expectation, including its D25 provenance, unchanged in `expected-match-report.json`, alongside its unique matched fact. Report zero unmatched expectations and prove all eight groups matched.
5. Derive the review set as the exact complement of matched facts within the frozen flagship-neighborhood predicate. Verify both inclusions: every unmatched neighborhood fact is present and every published review-set fact is an unmatched neighborhood fact.
6. A nonempty review set is publishable and is not an acceptance failure. Serialize it with the frozen deterministic comparator and a strict fact-only schema that admits no score, rank, confidence, priority, ordinal, or other ranking metadata.
7. Derive the accepted relative module-load closures under D33 and require exact set equality with each manifest `implementation_refs` collection and with `orchestrator_refs`. This is a supported statically declared dependency-model check, not a claim about every module JavaScript could reach.

Tests must include fact-reuse, duplicate-match, missing-match, extra-neighborhood-fact, nonempty-review-set, provenance-loss, forbidden review metadata, all-eight-group, and closure-under/over-reporting cases.

## Final reproduction execution

`run.mjs` is executed only from a clean checkout of the committed integration input. It records the full input Git HEAD object ID and rejects dirty tracked or untracked inputs outside the excluded self-export and designated temporary areas. All inventory bytes must agree with the recorded input commit.

### R1 — repository reference derivation

Use the frozen canonical repository-reference derivation, once, from the recorded full input repository HEAD. Do not derive it from a branch name, worktree path, timestamp, abbreviated object ID, or post-evidence commit. Independently rederive the value during verification and require byte equality among:

- the derived value;
- the temporary ledger header `repository_ref`;
- `summary.json`;
- `verification.json` and its committed-evidence verification result.

Any missing input head, derivation disagreement, or header/evidence disagreement is fatal before publication.

### Pre-publication checks and test ordering

All data later written to `verification.json` is produced during the same final run and before any evidence file is published:

1. Enumerate every Git-tracked `package.json` whose committed JSON contains an existing `test` script. Run `cd clotho && npm test` first, then run `npm test` in every remaining package directory in deterministic repository-relative path order. Record every repository-relative command, exit status, and Node version. Do not record absolute paths or process IDs. Any failure is fatal.
2. Run the advisory scanner after the documentation/history moves. Retain inbound and closed Clotho-side outbound file/package counts and the D30/D32 loader-construction and D33 shared-grammar results. Treat them only as trusted-code review signals, never as isolation or loader-containment proofs.
3. Reject any unexpected tracked mutation caused by tests or scanning.
4. Perform a keyless full weave to a cryptographically unique temporary path below `.telos/clotho/`. Verify that the temporary area and `docs/runs/clotho-self-weave/` are excluded from every weaver's input inventory, not merely from the top-level driver. Repeated runs therefore cannot consume a prior summary, snapshot, report, or partial export.
5. Enforce the frozen 120-second ceiling with a monotonic clock over the timed full-weave acceptance interval. Propagate the remaining deadline to child operations, terminate them on expiry, wait for closure, and fail before publication if the elapsed time exceeds 120 seconds. Record the measured wall time only after the ceiling check succeeds.

### Ledger, inventory, and integration-contract verification

Before publication, verify the temporary ledger and rederive all facts from accepted inputs:

- The header carries the R1-derived `repository_ref`.
- The coverage manifest contains exactly the five required weavers and every one is `executed`.
- Mechanism-bound `implementation_refs` and `orchestrator_refs` are well formed and equal their independently derived accepted relative module-load closures under D33.
- Immediately before publication, perform the D34 derivation again from publication-time bytes. Drift from the earlier derivation is fatal. Record exactly this provenance statement with the refs: `These references exactly cover the supported, statically declared dependency model at publication time`.
- Recompute every `inventories_consumed` content address from the frozen inventory bytes and require equality.
- Validate `inspected_source_counts` against the complete frozen inventory-id table using D24.
- For D31, materialize the document-eligible and `doc-skipped` partitions, validate every skip and its prescribed reason, and apply D31's frozen count treatment exactly rather than silently omitting the branch. Require partition completeness and the D31 count equation. Separately require the ledger weaver's `contract-files` count.
- Preserve `currentDocs` as `Map<docAddressKey, text_sha256|null>`. `null` means deleted or ambiguous and must not be dropped, converted to an empty string, or treated as a valid hash. Exercise and verify both deleted and ambiguous cases in the current-document checks.
- Enforce the exact frozen kind-to-producer mapping:
  - `git` -> `introduced-by`;
  - `code` -> `depends-on`;
  - `test` -> `verified-by`;
  - `doc` -> `documented-in`;
  - `ledger` -> `motivated-by`, `evidenced-by`, or `discharges`.
  Reject missing, additional, or cross-kind producer relations as AM-39 attribution violations.
- Require manifest/record consistency in both directions: every trusted record is justified by the manifest and every manifest claim that requires records is represented. No contradiction, incomplete executed weaver, or untrusted record is accepted.
- Run the exact flagship expected-set and review-set checks against this temporary weave. Require empty query and drift gaps and complete current-document checks.

For D35, independently derive the blast-radius affected-node, evidence, and edge sets. For each collection, verify both directions—every derived item is recorded and every recorded item is derived. Record the six direction results and set `coverage: "verified"` only after all six pass. A marker without these proofs is invalid.

## Evidence construction and publication

No final evidence file is modified until all checks above have succeeded and all JSON payloads have been serialized and schema-validated in temporary staging files.

- `summary.json` records the input repository head, R1-derived `repository_ref`, weave timestamp, public key, snapshot SHA-256, checked wall time, edge count, ledger byte count, all per-weaver manifest entries with `implementation_refs` and `inspected_source_counts`, `orchestrator_refs`, `inventories_consumed`, the exact D34 provenance statement, D28 publication state, all warnings, complete why chain, D35-verified blast-radius affected nodes/evidence/edges, empty gaps, and all eight matched groups.
- `expected-match-report.json` contains every expectation with unchanged D25 provenance, its globally unique exact match, and zero unmatched expectations.
- `review-set.json` contains exactly the deterministic unmatched flagship-neighborhood complement. It may be nonempty and carries no score or rank field of any kind.
- `verification.json` contains snapshot status, trusted-record count, all five manifest states, implementation and orchestrator refs, manifest/record consistency, D33 closure equality, D34 publication-time rederivation, R1 equality results, D24/D31 count results including `doc-skipped`, currentDocs checks, exact attribution-map status, D35 direction results, advisory scanner counts and review checks in both directions, every executed package-test command and exit status, Node version, and the final publication state. It contains no absolute path or nondeterministic process ID.

Publish `thread-ledger.snapshot.jsonl` as follows:

1. Copy the verified temporary ledger bytes into a unique temporary export without modifying or appending to the source ledger.
2. Compute SHA-256 over the temporary export and require its bytes and digest to equal the values already staged for the evidence payloads.
3. Recheck physical containment immediately before publication.
4. Explicitly remove a stale prior snapshot. Never use rename-over for the snapshot.
5. Create the snapshot with an exclusive hard link from the temporary export. A successful link is the D28 commit point.
6. Unlink the temporary export. If unlink fails, retain the published snapshot, report `published-cleanup-incomplete`, surface the leftover path in repository-relative form for manual cleanup, publish no clean evidence claim, and exit nonzero. Never roll back the committed snapshot.
7. After clean unlink, publish the already validated JSON payloads and record the clean D28 `published` state. Any subsequent evidence-file failure is fatal and does not roll back a snapshot whose link already committed.

Close descriptors before cleanup. Remove uncommitted partial exports in `finally`. Never remove or replace the committed snapshot merely to recover from a later failure.

After publication, reopen the complete evidence set and verify hashes, schemas, cross-file equality, snapshot contents, match/review-set completeness, and clean `published` state from disk. Any fatal warning, ledger failure, incomplete or contradictory manifest, D34 drift, AM-39 violation, expected mismatch, incomplete review set, query/drift gap, containment failure, atomic-publication failure, timeout, or cleanup-incomplete result exits nonzero.

## R2 — review-set publication

The review set is the complete deterministic complement of matched facts in the frozen flagship neighborhood. Exact set equality in both directions is mandatory. A nonempty complement is exposed and published without becoming a failure. Its schema contains facts only and cannot carry scoring or ranking data. This is separate from the package-test enumeration rule.

## R3 — history-move scope

Move only completed or closed design/plan artifacts identified by repository status and history convention, but account for every candidate explicitly. Before moving, inspect living authorities and path-sensitive verifiers. A candidate still required at its recorded path is not silently moved: either update the allowed verifier to the history path while preserving verifiable bytes, or document why the artifact remains living and therefore is not a completed move candidate. Documentation moves land before the final scanner, tests, weave, and evidence publication.

## Integration and committed-byte gate

1. Merge and commit agent-D's final documentation/history work and agent-R's implementation. Confirm The Eye's binding of the exact expected artifact.
2. Execute the single final `run.mjs` publication run. Tests and the post-move scanner occur inside this run before publication; do not mutate `verification.json` afterward.
3. Review and commit the generated evidence.
4. From a clean checkout of that exact evidence commit, run `run.mjs --verify-committed` in read-only mode. It verifies the committed evidence files against the recorded input HEAD and snapshot without regenerating or rewriting timestamped evidence.
5. Flip `d8-self-weave-exclusion` to normative only after the run, flagship suite, all-inventory exclusion proof, and committed-byte verification succeed.
6. Review the final Task 7 diff against its frozen base. Only `clotho/`, `.gitignore`, `docs/STATUS.md`, `docs/ROADMAP.md`, convention-conformant history moves, and `docs/runs/clotho-self-weave/` may differ. There is no whole-branch carve-out. Any spine source change blocks merge even if it falls under an otherwise allowed directory.

## Non-goals

No renderer work, no new dependency, no spine source change, no loader-containment or sandbox claim, and no claim that the supported static closure covers every module the process could possibly reach.