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
rounds, not dropped. **Forward identity decision**: when authentication enters
scope (Phase 1b operator-console / service modes — NOT the v1 local CLI), the
identity provider is **Auth0 over OIDC**, per the RECORDED Eye ruling
`product-1-ruling-identity-provider` (2026-08-27) in the pre-review's
`eye_rulings_at_s0_gate.addenda` — the stable governing identifier this
approach cites. Recorded in PD-001/PD-005 and the readiness register's Phase-1b
identity item; no v1 code depends on it (the CLI stays a local single-user tool
with no network listener, per the no-listener oracle). Seat-transport ruling
`product-1-ruling-oauth-seat-transport` likewise governs this quest's own model
calls (OAuth subscription CLIs).

## 2. Enforcement-changing specifications (require signed required-seat review)

Each carries a fail-closed regression test that reproduces the defect. Full
per-file designs are in the approved plan; acceptance criteria here.

- **E1 Hestia merge attestation** (`workflows/hestia.js` + a NEW deterministic
  attestor). Two layers, with the deterministic layer authoritative:
  (i) IN-WORKFLOW (advisory hardening): bind `pr_url` → `{owner,repo,number}`
  (regex, unparseable ⇒ excluded+reported); capture `head_sha` (40-hex) at push;
  merge via `gh api -X PUT .../merge -f sha={head}` (server-enforced
  expected-head guard; 409 ⇒ `head-moved`, never retry-fresh); an independent
  read-only `verify:merge` agent + field-by-field gate (ordered fail-closed
  checks: merge-verify-missing, ship-blocked, merge-not-confirmed,
  merged-despite-blocked, foreign-repo, head-sha-mismatch, merge-sha-mismatch).
  (ii) DETERMINISTIC ATTESTOR (the merge truth — no model in the loop): new
  `workflows/tools/attest-merges.mjs`, plain zero-dep node, takes the workflow's
  structured output and re-queries `gh api` DIRECTLY over the FULL attempt
  surface, not just `shipped[]`: every entry in `fix_gate.shipped`,
  `fix_gate.excluded`, `residue_gate.blocked`, AND — to catch attempts the
  workflow under-reported entirely — every branch the run's fix agents pushed
  (enumerated from each repo via `gh api repos/{o}/{r}/pulls?state=all&head=…`
  for the run's recorded branch names, plus PRs updated in the run's time
  window). For each: `{pr, merged, merge_commit_sha, head_sha, verified_by:
  "gh-api-direct"}`. ANY merged PR that the workflow did not certify as
  confirmed (including excluded/blocked/omitted ones) ⇒ exit 2
  `unattested-merge`; any divergence from `merge_gate` ⇒ exit 2 with the diff.
  The workflow's return documents that `merged[]` is advisory and the attestor
  is authoritative.
  **Accept**: 8 adversarial in-workflow fixtures pass; attestor test suite:
  colluding-agents fixture (ship+verify both fabricate the same merged/sha —
  in-workflow gate passes, ATTESTOR catches it against a stub gh returning open),
  API-truth mismatch ⇒ exit 2, clean run ⇒ attestation emitted; `merged` =
  confirmed-only; workflows CI job runs both suites green.
- **E2 ai-native-memory gate freshness + AUTHORITY-CHAINED sources** (`ai-native-memory/scripts/gate.mjs`).
  Extract `scripts/lib/freshness.mjs` (byte-stable audit findings); gate
  re-derives every query `expected` from `derived_from` at gate time (REQUIRED;
  DENIED on missing/dangling/stale with distinct reason codes); authority read
  confined to the plugin boundary (couples to E4). Re-derivation alone cannot
  defeat a FULL-LOCKSTEP mutation (source+expected+answer edited consistently),
  so sources are CHAINED TO PINNED AUTHORITY: a `derived_from.file` is
  admissible only if it is (a) a content-addressed record whose recomputed
  address equals its `id` (the record-discipline rule the auditor enforces),
  AND (b) reachable from the plugin's hash-pinned trust root — the
  CURRENT-AUTHORITY active doc (sha-pinned) or a record enumerated by
  `verify-map.json` / the contracts set the authority doc governs. A source
  outside the pinned reachability set ⇒ DENIED `source-unanchored`. A
  full-lockstep mutation then necessarily breaks either the source record's
  content address or a pinned hash upstream — there is no consistent rewrite
  that survives. **Accept**: lockstep mutation of source+expected+answer ⇒
  DENIED (address/anchor break named in the reason); mutation of only the
  source ⇒ DENIED stale; unanchored source file ⇒ DENIED source-unanchored;
  escape/symlink authority path ⇒ DENIED; dogfood self-gate stays GRANTED.
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
- **E6 §5c dedupe + §3c root-invariant sweep + zero-dep oracle + oracle.executable
  WITH EXECUTION** (`docs/institutional-memory/verify-contracts.mjs` + a NEW
  oracle runner). Uniqueness on enrollments roots/authorizations and
  enrollment_run ids (bijective cardinality replacing `some()`); explicit root
  INVARIANTS.json sweep; zero-dep invariant reworded with machine `exceptions[]`
  (flagship) + executable oracle over all tracked package.jsons; structured
  `oracle.executable` required on every NORMATIVE record + one-PR backfill.
  Oracles must DISCRIMINATE, not merely exist or merely run: new
  `docs/institutional-memory/run-oracles.mjs` executes every declared
  `oracle.executable` — `file` entries run under `node` with a per-entry
  timeout, nonzero/timeout/unrunnable ⇒ FAIL (distinct codes: oracle-missing /
  oracle-unrunnable / oracle-failed / oracle-timeout). Because a
  constant-success program passes any run-only check, every `file` oracle
  MUST also declare a NEGATIVE CASE — `oracle.executable.negative`: an
  invocation (same file, a documented violating fixture/flag, e.g.
  `--self-check-negative` handing the oracle a planted violation) that is
  REQUIRED TO EXIT NONZERO; run-oracles executes both, and a negative case
  that exits 0 ⇒ FAIL `oracle-nondiscriminating` (this generalizes the
  repo's existing mutate-then-expect-failure pattern from the clotho
  flagship-expectation tests). `npm-script` entries are machine-checked to be
  covered by the CI package matrix (parsed from ci.yml — execution delegated
  to the matrix, delegation itself verified; the matrix suites already embed
  their own failing-fixture assertions); `evidence-dir` entries require the
  dir non-empty with at least one content-addressed record. Wired as a step
  in the institutional-memory CI job. **Accept**: a synthetic NORMATIVE
  record whose oracle file exits 1 ⇒ run-oracles FAIL; a constant-success
  oracle (exit 0 on both positive and negative invocation) ⇒ FAIL
  oracle-nondiscriminating; a present-but-timeout oracle ⇒ FAIL; an
  npm-script oracle absent from the ci.yml matrix ⇒ FAIL; backfill complete
  (every backfilled file oracle carries a working negative case);
  verify-contracts + run-oracles green in CI.

## 3. Governance ceremony (ONE combined live council — Eye ruling: Option A)

A single live TELOS re-authorization run (`docs/runs/product-authorization-1/`,
`build_id: iliad-product-1-authz`, seats claude/agy/codex signed +
grok/gemini advisory) authorizes BOTH:
- the enrollment-flip regularization discharging AM-42's process debt, AND
- AM-43: classify the two new package dirs (`cli/`, `connectors/meta-ads-mcp/`)
  into `PACKAGE_ROOTS_EXCLUDE`.

AM-43 is a new decision doc with its own single fenced JSON block (roots
unchanged; exclude += the two dirs), sha-pinned in `package-roots.json.authority.
enrollment_ruling` and `CURRENT-AUTHORITY.amendments_in_force`. AM-42's FILE is
NEVER touched — its bytes stay identical and its content address stays valid.
All amendment/regularization linkage lives ONLY in mutable registry surfaces and
new records: the `CURRENT-AUTHORITY.amendments_in_force` ENTRY for AM-42 (a
registry row, not the doc) gains `amended_by: "AM-43"` + `ratification:
"retroactive"`, AM-43's own body cites AM-42 by sha, and the deviation record
pins `am42_sha256`. Nothing writes into any content-addressed artifact. The 8 coordinated pinned-surface updates
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
- **Node-version reconciliation oracle** (frozen mandate: every doc claim must
  match the required >=22.12.0): a new check in the product verify-contracts
  section scans TRACKED docs and manifests (excluding frozen historical evidence
  under docs/runs/) for Node-version claims (patterns: "Node >= 18", "Node 18+",
  "node\": \">=18", "Node ≥18", "Node 20") and FAILS on any claim below
  22.12; the enumerated current offenders (including the employment-brief doc
  the checklist names) are corrected in the same slice. **Accept**: a planted
  "Node 18+" doc line fails the oracle; the sweep is clean at slice end.
- **`cli/` package** (`pylae` bin, private): init (reads env-surface.json as
  data) / doctor (node>=22.12, git full-history, bwrap, env presence, Ed25519) /
  version (product-version.json + head) / verify (spawns verify-contracts +
  self-weave --verify-committed + fail-closed demo, fail-closed aggregate);
  static no-network-listener oracle; child-process tests; classified EXCLUDE via
  the §3 ceremony.
- **HONEST v1 INSTALLATION CONTRACT** (the cli spawns verifiers that live in the
  repo tree, so a bare `cli/` tarball is NOT an installable product and is not
  claimed to be): the v1 installable artifact is the SOURCE RELEASE — the
  `git archive` tarball of the qualified release commit — with `pylae` as its
  entrypoint. PD-006 (naming/versioning/publish) records this explicitly:
  install = extract the source tarball (or clone at the tag) + Node >=22.12;
  `pylae doctor` verifies the environment; every `pylae` command resolves its
  spawned tooling RELATIVE TO ITS OWN INSTALL ROOT (never cwd), so the
  extracted tree is self-sufficient. The `npm pack cli` tgz is published as a
  COMPONENT artifact, its README stating it requires the source tree
  (self-contained npm distribution = a tracked register item for a later
  phase, not silently claimed now). Proven, not asserted: release.yml gains a
  CLEAN-ROOM INSTALL job — extract the built source tarball into an empty temp
  dir OUTSIDE any git checkout, run `pylae doctor` and `pylae version` there,
  and run `pylae verify --offline-checks` (the subset not needing full git
  history); any spawn of a file outside the extracted root ⇒ fail.
  **Accept**: clean-room job green from tarball alone; deleting a spawned
  helper from the tarball ⇒ clean-room job fails (packaging omission is
  detected, not shipped).
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
- **Signed release pipeline** `release.yml`, fail-closed end to end:
  (1) GATE: tag object must be ANNOTATED and its SIGNATURE VERIFIED in CI —
  the release-signing PUBLIC key is committed at
  `docs/institutional-memory/product/KEYS/release-signing.pub` and the gate job
  runs `git verify-tag` against exactly that key (unknown/unsigned/unverifiable
  ⇒ abort); required-CI check-run asserted at the tag SHA; local verify battery
  incl. `--verify-committed --exact-head`.
  (2) BUILD: `npm pack` the cli TWICE and byte-compare the tarball digests
  (reproducibility check — a mismatch aborts and any irreducible
  nondeterminism must be recorded in RELEASING.md before release); source
  tarball via `git archive` (deterministic by construction); SHA256SUMS; syft
  SBOM; `actions/attest-build-provenance` per artifact.
  (3) PUBLISH against a CLOSED ALLOWLIST: the exact expected asset filename set
  is a literal in the workflow; after upload, `gh release view --json assets`
  must equal the allowlist EXACTLY (missing or EXTRA assets ⇒ fail the job and
  flag the release); then `gh attestation verify` runs against every published
  artifact (an unattested payload ⇒ fail).
  RELEASING.md ceremony (local signed annotated tag with the committed public
  key's private counterpart; immutability Setting prerequisite; correction
  process — first application: v0.2.0 4,558→4,559). **Accept**: lightweight tag
  ⇒ gate aborts; tampered tag signature ⇒ aborts; planted extra asset ⇒
  publish check fails; every published artifact passes `gh attestation verify`.
- **Pages provenance**, tightly bound: ci.yml uploads artifact
  `demo-${{ github.sha }}` only on main pushes after required-ci; pages.yml
  converts to `workflow_run` and the deploy job REQUIRES ALL OF:
  `workflow_run.conclusion == 'success'`, `workflow_run.event == 'push'`,
  `workflow_run.head_branch == 'main'`; downloads by that exact
  `workflow_run.id` and asserts the artifact name embeds
  `workflow_run.head_sha` before deploying. The deployed payload REMAINS
  `demo/` (explicit: the flagship is NOT deployed this round per PD-003;
  flagship deployment is a register item). **Accept**: a PR-triggered or
  non-main workflow_run never deploys (guard test via workflow lint/fixture);
  the deployed artifact's embedded SHA equals the triggering run's head.
- **Review-plugin pin**: point plugin_marketplaces at an owner-controlled pinned
  fork of anthropics/claude-code (test `#<sha>` first).
- **Flagship resilience** (exclude-listed — no weave impact), one regression
  test PER enforcement change (frozen requirement): ErrorBoundary around the
  paint Suspense w/ honest DOM-still-works fallback — REGRESSION e2e
  `resilience.spec.ts`: `page.route` ABORTS the lazy Loom/LiveGraph chunk
  request, asserts the `paint-fallback` notice is visible AND the DOM story
  remains operable (`cmd-NEXT_STATION` advances); responsive CSS (flex-wrap +
  max-480px, stage scroll container) — REGRESSION e2e at 375×667 viewport:
  `document.documentElement.scrollWidth <= clientWidth` (no horizontal
  overflow), every topbar control visible+clickable, station text reachable by
  scrolling the stage region; tabs done right (aria-selected/controls/tabpanel/
  roving tabindex + arrow keys) — e2e arrow-key navigation; @axe-core/playwright
  a11y gate (wcag2a+21aa, both views/themes, zero violations); demo
  malformed-base64 ⇒ fail-closed BLOCKED + unit test (`sig.value: "!!!"` ⇒
  `malformed-signature`); OFL font licenses + THIRD-PARTY-NOTICES. CODEOWNERS
  register-deferred (single maintainer).

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
