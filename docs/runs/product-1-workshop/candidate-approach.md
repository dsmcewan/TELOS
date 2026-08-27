# Candidate Approach — product-1 quest (TELOS v0.3.0 / PYLAE Gate v1)

Branched from `main @ fc0fa05`. Governing pre-review:
`docs/institutional-memory/iliad/PRE-REVIEWS/2026-08-27-product-1.json`. This
approach is the Daedalus workshop input; convergence is submission, not
authorization. Frozen `--spec` material: the Production-Readiness Master
Checklist and the v0.2.0 full-repository review findings (both committed to this
workshop dir). Every finding below was independently re-verified against
fc0fa05.

## 1. Objective and boundary

Close all 10 v0.2.0 release blockers and 7 governance corrections; freeze the
Phase-0 product contract; ship Phase-1a distribution; repair the normative
authority chain; and release **PYLAE Gate v1** (the productized local
single-user CLI SKU over the TELOS trust spine) as v0.3.0 from the exact
qualified, accepted commit.

Boundary (Eye rulings, S0 gate): primary user = individual developer; v1 =
local single-user CLI; identity, multi-tenancy, and clustered runtime are OUT
OF SCOPE by signed ADR (PD-001), with the checklist's carve-out made testable
(a static no-network-listener oracle over `cli/`). The flagship is the future
production operator console (labeled demonstration/evidence-viewer this round).
Phase 1b (durable crash-consistent state, authenticated-principal authority
binding, key rotation, sandbox platform doc) is register-tracked with target
rounds, not dropped.

## 2. Enforcement-changing specifications (require signed required-seat review)

Each carries a fail-closed regression test that reproduces the defect. Full
per-file designs are in the approved plan; acceptance criteria here.

- **E1 Hestia merge attestation** (`workflows/hestia.js`). Bind `pr_url` →
  `{owner,repo,number}` (regex, unparseable ⇒ excluded+reported); capture
  `head_sha` (40-hex) at push; merge via `gh api -X PUT .../merge -f sha={head}`
  (expected-head guard; 409 ⇒ `head-moved`, never retry-fresh); an independent
  read-only `verify:merge` agent re-derives `gh api pulls/{n}` and the gate
  compares field-by-field (ordered fail-closed checks: merge-verify-missing,
  ship-blocked, merge-not-confirmed, merged-despite-blocked, foreign-repo,
  head-sha-mismatch, merge-sha-mismatch). **Accept**: 8 adversarial fixtures pass
  (claims-merged/API-open; sha mismatch; foreign repo; lookalike URLs; garbled
  verify; missing head_sha; head-drift; merged-despite-blocked); `merged` =
  confirmed-only; workflows CI job green.
- **E2 ai-native-memory gate freshness + confinement** (`ai-native-memory/scripts/gate.mjs`).
  Extract `scripts/lib/freshness.mjs` (byte-stable audit findings); gate
  re-derives every query `expected` from `derived_from` at gate time (REQUIRED;
  DENIED on missing/dangling/stale with distinct reason codes); authority read
  confined to the plugin boundary (couples to E4). **Accept**: source-mutated-while-
  queries-and-answers-in-lockstep ⇒ DENIED; escape/symlink authority path ⇒
  DENIED; dogfood self-gate stays GRANTED.
- **E3 auditor full-taxonomy + no-clean-on-zero, EXCEPTIONLESS** (`ai-native-memory/scripts/audit.mjs`).
  Root-as-memory-dir (marker predicate, root arg only); zero discovered sets ⇒
  exit 2 unless `--allow-empty`; validate all 8 record kinds via `RECORD_SET_LAYOUT`;
  md decisions = front-matter enum only (AM-40/41/42 pass unchanged — pinned
  bytes never touched). Legacy nonconforming records (atropos/lachesis cycle-1
  decision.json) SUPERSEDED with new content-addressed records — no allowlist
  (Eye: exceptionless). **Accept**: dogfood green after in-plugin content fix;
  enumerated newly-failing inventory in the PR body; supersessor records validate.
- **E4 gate production profile — DEFAULT FLIP** (`build-gate/gate.mjs`). After the
  `signed` flag: `profile==="production" && !signed` ⇒ blocker; `production &&
  allow_unsigned` ⇒ blocker; `!signed && !allow_unsigned` ⇒ blocker (unsigned/
  legacy blocks unless explicit opt-in — release-noted); `signed && allow_unsigned`
  ⇒ contradiction blocker; `headline_checks` += profile + unsigned_opt_in.
  **Accept**: the 9 unset-trust_mode + 2 advisory example dossiers opt in and stay
  green; production+unsigned blocks; production+signed passes; test-gate + stress
  suites green.
- **E5 authority-chain repair + verifier strengthening** (Eye ruling — replaces the
  earlier draft-status gate). (a) Reconcile-and-supersede: author NEW
  content-addressed NORMATIVE-CURRENT successors to "Multi-Model Agentic Build
  Gate" (reconciled against current build-gate impl, current paths, signed-by-
  default, provider provenance, the Iliad lifecycle, and the PYLAE Gate v1
  boundary) and "Claude-Led Multi-Model Prototype Workflow" (scoped: prototype
  planning / capability acquisition / dynamic council / market-readiness;
  code-enforced vs advisory separated; grants no implementation/production
  authority); preserve both drafts UNCHANGED as historical provenance. (b) Mark
  "Claude-Grok-Agy Hierarchical Agentic Workflow" historical/superseded (V4
  vault-mapping; not executed by Hestia); preserve unchanged; REDIRECT every
  normative citation off it. (c) NEW normative invariant: every current normative
  citation terminates in a reviewed content-addressed NORMATIVE-CURRENT record;
  historical docs are citable only as explicitly-typed non-governing provenance.
  (d) Verifier: FAIL when a current normative record cites a draft/historical
  artifact as governing authority; accept historical refs only when typed
  non-governing. **Accept**: all root INVARIANTS.json / loadout-contract /
  capability-packet / comprehension-query / gate-required_docs citations of the
  three docs terminate in the new successors or a typed-provenance ref; verify-
  contracts green with the new citation-status checks.
- **E6 §5c dedupe + §3c root-invariant sweep + zero-dep oracle + oracle.executable**
  (`docs/institutional-memory/verify-contracts.mjs`). Uniqueness on enrollments
  roots/authorizations and enrollment_run ids (bijective cardinality replacing
  `some()`); explicit root INVARIANTS.json sweep; zero-dep invariant reworded
  with machine `exceptions[]` (flagship) + executable oracle over all tracked
  package.jsons; structured `oracle.executable` required on every NORMATIVE
  record + existence checks + one-PR backfill (run report-only first to
  enumerate). **Accept**: synthetic dupe/deps self-checks fire; backfill complete;
  count grows, all green.

## 3. Governance ceremony (ONE combined live council — Eye ruling: Option A)

A single live TELOS re-authorization run (`docs/runs/product-authorization-1/`,
`build_id: iliad-product-1-authz`, seats claude/agy/codex signed +
grok/gemini advisory) authorizes BOTH:
- the enrollment-flip regularization discharging AM-42's process debt, AND
- AM-43: classify the two new package dirs (`cli/`, `connectors/meta-ads-mcp/`)
  into `PACKAGE_ROOTS_EXCLUDE`.

AM-43 is a new decision doc with its own single fenced JSON block (roots
unchanged; exclude += the two dirs), sha-pinned in `package-roots.json.authority.
enrollment_ruling` and `CURRENT-AUTHORITY.amendments_in_force`; AM-42 bytes never
touched (gains `amended_by`). The 8 coordinated pinned-surface updates
(inventory.mjs [woven ⇒ re-weave], test-inventory frozen array, comprehension-
queries expected, iliad deferred list, repository-manifest products + count
strings, §5c ruling-id generalization) land together. Two-step write-then-hash-
then-pin dance for every new pinned doc. **Accept**: authorization-summary.json
AUTHORIZED; verify-contracts enrollment + deferred-equality checks green.

## 4. PYLAE Gate naming + Phase-1a distribution

- **PYLAE registration**: PYLAE is a new mythological-namespace term; register it
  in `docs/mythological-vocabulary.md` (product-brand entry: "PYLAE Gate — the
  productized single-node gate SKU over the TELOS spine") through the lifecycle,
  or an explicit product-brand carve-out. No improvised referent.
- **Phase-0 product memory dir** `docs/institutional-memory/product/`: ADRs
  PD-001..PD-007 (product form/user + no-listener oracle; boundary; flagship
  role; state model; topology; naming/versioning/publish; role glossary in
  product/GLOSSARY.md, never editing mythological-vocabulary.md's registry); a
  machine-readable `production-readiness.json` register (items with priority/
  phase/status/owner/adr+sha/evidence/target_round; go-live P0 gate REPORTING-
  ONLY until an enforce flag) + `render-readiness.mjs --check` + `docs/PRODUCTION-
  READINESS.md`; `product-version.json` (lockstep 0.3.0 + schema versions);
  repository-manifest memory_dirs registration; verify-contracts §-product checks.
- **Naming/versioning**: rename v4-build-gate/v4-forge/v4-breakout → telos-*;
  all package versions → 0.3.0 (clotho 0.0.0 too) + full metadata; plugin.json
  version alignment; narcissus-flagship name NOT renamed (verifier pin). NO root
  package.json (test-inventory forbids it — rejected-alternative recorded).
- **`cli/` package** (`pylae` bin, private): init (reads env-surface.json as
  data) / doctor (node>=22.12, git full-history, bwrap, env presence, Ed25519) /
  version (product-version.json + head) / verify (spawns verify-contracts +
  self-weave --verify-committed + fail-closed demo, fail-closed aggregate);
  static no-network-listener oracle; child-process tests; classified EXCLUDE via
  the §3 ceremony.
- **Meta-ads governance**: parseCap `^[0-9]{1,6}$` + isSafeInteger + >0 +
  HARD_CEILING_CENTS frozen (fail-closed startup); budget args validated; closed
  grammars validated BEFORE env/token access; META_ADS_ENABLED kill-switch;
  package.json + hermetic tests + HUMAN-SETUP.md; env-surface.json
  additional_scanned_dirs mechanism + 5 META_* names.

## 5. Freshness, release, deployment, flagship

- **Freshness (E-adjacent)**: run.mjs `--exact-head` (live HEAD == recorded head
  + clean worktree + full source_ref sweep; distinct fatal codes); always-emitted
  freshness/heads_equal; CI job wording stops claiming "records == reality";
  release runs exact-head. run.mjs is NOT woven (safe).
- **Signed release pipeline** `release.yml`: gate (annotated-tag check +
  required-CI check-run at tag SHA + local verify battery) → build (pack cli +
  source tarball + SHA256SUMS + syft SBOM + attest-build-provenance + a release
  attestation asset {tag, release_head, snapshot_sha256, input_repo_head,
  freshness}) → publish (gh release create --verify-tag with assets); RELEASING.md
  ceremony (local signed annotated tag; immutability Setting; correction process
  — first application: v0.2.0 4,558→4,559).
- **Pages provenance**: CI uploads an exact-SHA demo artifact; pages.yml →
  workflow_run(CI success) + download-artifact.
- **Review-plugin pin**: point plugin_marketplaces at an owner-controlled pinned
  fork of anthropics/claude-code (test `#<sha>` first).
- **Flagship resilience** (exclude-listed — no weave impact): ErrorBoundary
  around the paint Suspense w/ honest DOM-still-works fallback; responsive CSS
  (flex-wrap + max-480px, stage scroll container); tabs done right (aria-selected/
  controls/tabpanel/roving tabindex + arrow keys); @axe-core/playwright a11y gate;
  demo malformed-base64 ⇒ fail-closed BLOCKED; OFL font licenses + THIRD-PARTY-
  NOTICES. CODEOWNERS register-deferred (single maintainer).

## 6. Slice/PR decomposition (one re-weave at train end)

Bounded PR slices, each: implement → deterministic verification → implementation
review (4a signed council review for E1–E6 + the ceremony; 4b entry-ritual +
adversarial subagent review for mechanical slices) → Eye acceptance → step-ledger
entry. Order: freshness → (plugin self-containment → E2 → E3) ∥ E1 → E6 → E4 →
product memory dir + ADRs → naming/versions → AM-42 deviation (subsumed by the
Option-A council) → **ceremony slice** (AM-43 + cli + meta-ads + 8 pinned
updates) → release pipeline/pages/plugin-pin → flagship/demo/fonts →
**authority-chain-repair slice** (E5 successor docs + citation redirect + new
invariant + verifier) → **train-end re-weave** (full self-weave republication at
the final head + lachesis pins + flagship live-graph + expected-flagship regen +
Eye re-audit + all woven-doc edits). Release from the qualified accepted commit.

## 7. Acceptance criteria (quest-level)

Comprehension-gate GRANTED artifact before implementation; every slice in the
Argo step-ledger with merge anchors + review evidence; per-slice package suites +
verify-contracts + self-weave posture green; `--verify-committed --exact-head`
green at the release head; release.yml gate job green; every current normative
citation terminates in a NORMATIVE-CURRENT record; enrollment.json#enrolled entry
for the product-governance subsystem; RETROSPECTIVES/product-1.json with
`optimizations[]` (feed-forward with landing sites) written before delivery is
declared. v0.3.0 cut only from the exact qualified, accepted commit with required
CI passing.

## 8. Honest limits / non-claims

Live workshop + council prove provenance, not correctness (lachesis-1 lesson);
the running artifact is reviewed against real data. Phase 1b items are scheduled,
not delivered. PYLAE Gate v1 is a local single-user tool; it is not a network
service and asserts no identity/tenancy — enforced by the no-listener oracle and
stated as a non-claim. The self-weave verifier is itself un-pinned (governed by
CI/review). No production authority is granted to any model council; the Eye's
human authority and the deterministic gate remain the trust roots.
