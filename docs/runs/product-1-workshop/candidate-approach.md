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

- **E1 Hestia merge authorization + attestation** (`workflows/hestia.js` + a
  NEW deterministic pre-merge controller). THE MODEL NEVER MERGES — fail-closed
  means the protected branch is not mutated until a deterministic check passes,
  so authorization is pre-merge and machine-executed, attestation post-merge:
  (i) IN-WORKFLOW (evidence production only — agents hold NO repository
  credential at all; a push-capable token would also reach the merge
  endpoint, so fix agents cannot be given write): fix agents produce
  VALIDATED PATCH/COMMIT DATA (diff + commit message + target branch
  name), not pushes. A deterministic BRANCH PUBLISHER —
  `workflows/tools/branch-publisher.mjs`, controller-class code inside
  the protected controller closure — is the sole holder of the write
  credential: it schema-validates the patch data, applies it in a clean
  sandbox checkout, pushes the branch, opens the PR, and returns
  `{pr_url, head_sha}`; its API surface contains NO merge operation and
  the credential never enters any agent's environment. Agents can
  therefore CAUSE branch publication (mediated, validated) but cannot
  invoke or indirectly select a merge. Bind `pr_url` → `{owner,repo,
  number}` (regex, unparseable ⇒ excluded+reported); head_sha (40-hex)
  is captured by the PUBLISHER at push, not model-reported; an
  independent read-only `verify:merge` agent + field-by-field gate
  produce the candidate evidence set (ordered fail-closed checks:
  merge-verify-missing, ship-blocked, merge-not-confirmed, foreign-repo,
  head-sha-mismatch). The workflow's output is a MERGE REQUEST dossier,
  not a merge. **Accept (credential separation)**: publisher fixture —
  agent-produced patch data results in a pushed branch + open PR; the
  agent environment fixture asserts NO credential variable is present;
  a patch attempting to smuggle a merge (e.g. workflow edits invoking
  the merge API, or gh merge commands in committed hooks) is inert data
  — the publisher only pushes and opens PRs, and merge remains
  exclusively the controller's; publisher closure covered by
  TRUSTED_CONTROLLER_DIGEST.
  (ii) DETERMINISTIC PRE-MERGE CONTROLLER (the sole holder of merge
  credentials): new `workflows/tools/merge-controller.mjs`, plain zero-dep
  node, run AFTER the workflow. THE CONTROLLER'S OWN CLOSURE IS A
  PROTECTED SURFACE (otherwise a controller-only PR passes the sitting
  controller's checks and replaces the sole merger with safeguard-free
  code): the protected variable set includes `TRUSTED_CONTROLLER_DIGEST`
  over `workflows/tools/merge-controller.mjs` + its complete module
  closure; the RUNNING controller is always executed from a TRUSTED BASE
  checkout (never the PR head), verifies its own closure digest against
  the protected variable at startup (mismatch ⇒ exit 2
  `controller-untrusted`), and refuses to merge any PR that modifies a
  controller-closure file (`controller-modified`) unless the PR carries a
  valid Eye-signed transition record whose signed payload binds the
  proposed controller bytes (same covered_files discipline as
  verifier/workflow changes — the transition tuple includes
  `new_controller_closure_digest`). Merges are SEQUENTIAL and eligibility is
  re-derived IMMEDIATELY BEFORE EACH MERGE, never batched (a preflight
  over all requests goes stale the moment the first merge moves the base):
  for each requested PR, AT ITS OWN MUTATION POINT, the controller
  re-queries `gh api` ground truth — PR still open, base repo/branch
  expected, head_sha equals the dossier's, `mergeable` against the CURRENT
  base (mergeable_state not behind/dirty), required checks green at that
  head — where "green" is NEVER keyed by check NAME alone (mutable names
  cannot carry authority — the content-address rule; GitHub permits
  same-name runs from any app at the same SHA): the controller resolves
  each required check run to its PRODUCER and accepts it only if (a) the
  producing app is the authenticated GitHub Actions app, (b) the run's
  workflow file blob at the evaluated head matches the trusted workflow
  digest set, and (c) the exact run id + head SHA are recorded in the
  attestation; a green same-name run from any other producer is ignored
  (fixture: an untrusted app posts a green same-name check at the exact
  SHA ⇒ the controller does NOT count it and refuses eligibility) — then, only on pass, performs the SOLE merge via `gh api -X PUT
  .../merge -f sha={head}` (server-enforced expected-head guard; 409 ⇒
  `head-moved`, never retry-fresh). The check-then-PUT window is closed
  SERVER-SIDE, not by client timing (a base update between the
  controller's query and its PUT would otherwise merge on stale checks):
  the target branch protection MUST set `required_status_checks.strict:
  true` (branch must be up to date with base at merge time) and the
  controller runs under a NON-BYPASS credential (not admin, not on any
  bypass list), so a base moved after the eligibility query makes the
  server itself refuse the PUT (405/409 ⇒ reported `base-moved`); the
  controller VERIFIES both preconditions at startup via the branch
  protection API + `gh api user` and refuses to run (exit 2
  `unsafe-merge-environment`) if strict up-to-dateness is off or the
  credential can bypass. A request invalidated by a PRIOR merge in the same run ⇒
  reported `base-moved`/`stale-checks` and SKIPPED (exit 2 at run end
  listing it) — the controller never auto-updates a branch or re-runs
  checks to force eligibility. Any ineligible request ⇒ refused BEFORE any
  mutation. It then POST-ATTESTS over the FULL attempt
  surface: every dossier entry (shipped/excluded/blocked) AND every branch
  the run's fix agents pushed (`gh api repos/{o}/{r}/pulls?state=all&head=…`
  for recorded branch names, plus PRs updated in the run's window); any
  merged PR the controller did not itself merge ⇒ exit 2 `unattested-merge`
  (detects credential leakage/out-of-band merges). Attestation
  `{pr, merged, merge_commit_sha, head_sha, verified_by: "gh-api-direct",
  merged_by: "merge-controller"}`.
  **Accept**: adversarial fixtures pass; controller suite: colluding-agents
  fixture (ship+verify fabricate the same merged/sha — controller re-derives
  from a stub gh returning open and refuses to merge, exit 2, NO mutation);
  ineligible-PR fixture ⇒ refused pre-merge; TWO-PR regression: the first
  merge makes the second stale/conflicting (stub gh flips its
  mergeable_state after merge #1) ⇒ the second is refused base-moved, NOT
  merged on its stale preflight; TOCTOU regression: stub server moves the
  base BETWEEN the eligibility query and the PUT and (modeling strict
  protection) rejects the PUT ⇒ controller reports base-moved, no merge
  recorded; unsafe-environment fixtures: strict=false or a bypass-capable
  credential ⇒ controller refuses at startup; out-of-band-merge fixture ⇒
  unattested-merge; clean run ⇒ merged + attestation; workflow agents' token
  fixture proves no merge scope; workflows CI job runs both suites green.
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
  outside the pinned reachability set ⇒ DENIED `source-unanchored`.
  THE ROOT ITSELF IS ANCHORED OUTSIDE THE TREE (an in-tree chain can be
  rewritten consistently end to end, so the chain's head digest must come
  from somewhere the tree-writer cannot reach): the gate takes a REQUIRED
  external anchor input `--trust-anchor <git-commit-sha>` (or
  `PYLAE_TRUST_ANCHOR`), supplied by the INVOKING CONTEXT and never read
  from the authenticated tree. The anchor must be a PROTECTED ref the
  change-author cannot write: in PR CI it is the PROTECTED BASE BRANCH head
  (`github.event.pull_request.base.sha`) — NEVER `github.sha`, which in PR
  context is the attacker's own commit and would make the gate
  self-authorizing; on main-push CI, the pushed commit is acceptable only
  because the branch protection + required checks already gate what reaches
  main, and this is stated, not assumed; at release, the signed annotated
  tag's target commit (whose signature the release gate verifies against
  the out-of-tree fingerprint below); locally, an operator-supplied commit
  (typically a verified tag). The gate resolves CURRENT-AUTHORITY and every
  admissible source AT THE ANCHOR via git object lookup (`git cat-file` on
  `<anchor>:<path>`; blob equality against the working file) — a working
  file differing from the anchored blob ⇒ DENIED `anchor-mismatch`. When
  the CHANGE UNDER REVIEW itself modifies authority-chain files, the gate
  does not self-authorize the new chain AND the transition has a
  DETERMINISTIC path whose AUTHORIZATION OBJECT IS THE EYE, not model
  consensus (the human-authority invariant is non-delegable): an
  AUTHORITY-TRANSITION RECORD — `{old_chain_root: <digest at the trusted
  prior root>, new_chain_root: <digest of the proposed chain>,
  new_verifier_closure_digest, new_trusted_workflow_digest,
  new_controller_closure_digest, new_trusted_verdict_closure_digest,
  covered_files: [<canonical sorted list of every authority-chain,
  verifier-closure, workflow, controller-closure, and
  verdict-producer-closure file the transition touches, each with its
  proposed blob digest>], transition_id,
  eye_authorization, council_review[]}` — where `eye_authorization` is an Ed25519 SIGNATURE
  BY THE EYE over the CANONICALIZED TUPLE (old_chain_root ‖
  new_chain_root ‖ new_verifier_closure_digest ‖
  new_trusted_workflow_digest ‖ new_controller_closure_digest ‖
  new_trusted_verdict_closure_digest ‖
  sha256(canonicalize(covered_files)) ‖ transition_id) — the signature binds EVERY protected surface the
  transition proposes, not just the chain roots, so a valid record CANNOT
  be reused with substituted verifier or workflow bytes (council-ratified
  hard stop, authorization run 1: a signature covering only the chain
  roots would let a legitimate transition smuggle unauthenticated
  verifier/workflow changes through the merge controller). BOTH enforcers
  RECOMPUTE from ground truth and reject mismatch: the gate (from the
  protected base) and the merge controller (from the actual PR head)
  each independently recompute the proposed chain root, verifier-closure
  digest, workflow digest, controller-closure digest, verdict-producer
  closure digest, and per-file blob digests and REFUSE
  (`transition-payload-mismatch`) if any recomputed value differs from
  the signed record. Verified against the
  Eye's public key held in a PROTECTED repo variable
  (`EYE_AUTHORITY_PUBKEY`, admin-writable only, same custody class as
  RELEASE_SIGNER_FINGERPRINT); `council_review[]` (the seats' HMAC
  packets) is REVIEW EVIDENCE the gate records but which can never grant.
  THE TRUSTED ROOT IS ITSELF OUT-OF-TREE at every context, including
  main-push and release: a protected variable
  (`CURRENT_AUTHORITY_CHAIN_ROOT`) holds the digest of the currently
  authorized chain; the transition ceremony is (1) the Eye signs the
  record, (2) the change merges carrying it, (3) the Eye updates the
  protected variable to new_chain_root — so a direct push or
  required-check override yields a tree whose chain root DIFFERS from the
  protected variable and every subsequent gate run (main-push, release,
  local) DENIES `chain-root-untrusted`; the modified commit can never
  self-validate because the variable only moves by admin (Eye) action.
  The gate, still anchored at the protected base,
  verifies: old_chain_root equals the protected variable's current value
  AND matches what the base anchor actually yields, new_chain_root matches
  the proposed files byte-for-byte, and the EYE'S SIGNATURE validates
  against the protected pubkey ⇒ GRANTED `authority-transition` (the
  Eye's signed authorization is the authorized object). Missing/invalid
  record or invalid Eye signature ⇒ DENIED `authority-modified-in-change`
  naming the files. Anchor absent/unresolvable ⇒ DENIED
  `anchor-unavailable` (fail closed, never a warning). **Accept**:
  lockstep mutation of source+expected+answer in a PR (anchor = base head)
  ⇒ DENIED anchor-mismatch or authority-modified-in-change — never
  GRANTED; a legitimate authority change carrying a valid Eye-signed
  transition record (pubkey + prior root both from protected variables) ⇒
  GRANTED authority-transition; the same record with the Eye signature
  invalid, or council packets alone (no Eye signature) ⇒ DENIED — model
  consensus can never grant; RECORD-REUSE fixtures (council-ratified): a
  VALID Eye-signed transition record paired with altered verifier-closure
  bytes ⇒ gate AND controller both refuse transition-payload-mismatch;
  the same record paired with altered workflow bytes ⇒ refused the same
  way; the same record paired with altered controller-closure or
  verdict-producer-closure bytes (e.g. a swapped docs/runs/clotho-self-weave/run.mjs) ⇒ refused the
  same way; a record whose covered_files omits a file the PR actually
  changes in ANY protected surface (verdict producers included) ⇒
  refused; a chain merged by override without
  the variable update ⇒ every later run DENIES chain-root-untrusted;
  mutation of only the source ⇒ DENIED stale; unanchored source file ⇒
  DENIED source-unanchored; missing anchor ⇒ DENIED anchor-unavailable;
  escape/symlink authority path ⇒ DENIED; dogfood self-gate (anchored at
  a clean HEAD) stays GRANTED.
  THE VERIFIER ITSELF EXECUTES FROM THE TRUSTED BASE (anchoring data is
  void if the PR swaps the gate for `process.exit(0)` and CI runs the
  proposed copy): in PR CI, the invoking workflow materializes
  `gate.mjs` AND ITS COMPLETE MODULE CLOSURE (every relative import,
  enumerated by the workflow from the base tree, not from a hand list)
  from the PROTECTED BASE ANCHOR (`git cat-file` each blob at
  `base.sha:<path>` into a temp dir) and executes THAT copy against the
  proposed tree's data. A PR that modifies any file in the verifier
  closure is treated exactly like an authority-chain change: the
  base-sourced verifier still evaluates the PR, and the verifier change
  itself requires the Eye-signed transition path to take effect
  (a proposed verifier NEVER evaluates its own PR).
  MAIN-PUSH AND RELEASE CONTEXTS ARE COVERED TOO (trusted-base execution
  only defends PRs; a direct push or check-override could swap the
  verifier on main), by three layers, each stated with its honest scope:
  (1) STRUCTURAL: the repo ruleset REQUIRES pull requests on main (no
  direct pushes, enforced including admins) — an ops step the quest
  performs and the controller-style startup checks assert (the main-push
  workflow queries the ruleset API and FAILS `unsafe-branch-config` if
  direct pushes are possible), so every verifier change must transit the
  PR path where base-sourced execution + the Eye-signed transition rule
  already hold. (2) DIGEST: the protected variable set gains
  `VERIFIER_CLOSURE_DIGEST` (same Eye-only custody as the chain root);
  main-push/release workflows recompute the checked-out verifier
  closure's digest and refuse to invoke it on mismatch
  (`verifier-untrusted`) — moved only by the same Eye ceremony that moves
  the chain root. THE SAME DISCIPLINE COVERS EVERY MERGE/RELEASE VERDICT
  PRODUCER, not just the memory gate (an authenticated workflow invoking
  an unpinned script is authority from mutable evidence: swapping
  `docs/runs/clotho-self-weave/run.mjs` — deliberately unwoven (GLOBAL_EXCLUDE) — for constant-success code
  would reopen blocker 3 behind a green authenticated check):
  `TRUSTED_VERDICT_CLOSURE_DIGEST` covers the complete transitive
  closures of `docs/runs/clotho-self-weave/run.mjs` (the blocker-3 verifier — verifyCommittedEvidence), `render-readiness.mjs`,
  `run-oracles.mjs`, `verify-contracts.mjs`, and the attestation tooling
  — enumerated by a manifest the bootstrap tool generates from real
  imports, not a hand list. PR CI BASE-SOURCES these scripts exactly like
  the memory-gate closure (a proposed verdict producer never evaluates
  its own PR); main/release workflows digest-check before invoking
  (`verdict-producer-untrusted` on mismatch); changes ride the Eye-signed
  transition mechanism under the covered_files discipline. **Accept
  (verdict producers)**: script-only bypass fixture — a PR replaces
  docs/runs/clotho-self-weave/run.mjs with a constant-success stub and
  changes a woven input without re-weaving, workflow file unchanged ⇒ the
  base-sourced docs/runs/clotho-self-weave/run.mjs
  evaluates, fails, and the required check is red; analogous
  render-readiness.mjs and run-oracles.mjs swaps refused the same way;
  a main-context swap with an unmoved digest ⇒
  verdict-producer-untrusted. (3) RELEASE: the authoritative release verification is
  executed by the Eye LOCALLY per RELEASING.md from a tree verified
  against the protected chain root BEFORE signing the tag; CI re-runs it
  as defense-in-depth, not as the sole authority.
  (4) THE INVOKING WORKFLOW IS PROTECTED THE SAME WAY (a PR that edits
  the workflow to skip materialization and emit green defeats layers 1–3,
  and GitHub runs PR-modified workflows; org-level required workflows are
  unavailable to a personal repo, so enforcement sits in the merge path
  we control): the protected variable set gains `TRUSTED_WORKFLOW_DIGEST`
  covering the verifier-invoking workflow file(s) under
  `.github/workflows/`; the E1 MERGE CONTROLLER — the sole merger —
  computes the digest of those files AT THE PR HEAD immediately before
  each merge and REFUSES (`workflow-modified`) unless it equals the
  protected value or the PR carries a valid Eye-signed transition record
  WHOSE SIGNED PAYLOAD BINDS THESE EXACT BYTES — the controller
  recomputes `new_trusted_workflow_digest` and the per-file blob digests
  in `covered_files` from the PR head and refuses
  `transition-payload-mismatch` on any difference (a transition record
  signed for other bytes cannot authorize this change). CODEOWNERS
  additionally routes
  `.github/workflows/` to the Eye for the human-merge path, and the spec
  records the residual honestly: a human merge overriding both is
  maintainer-level action, backstopped by the digest check failing on
  every subsequent run.
  (5) GENESIS IS AN EXPLICIT EYE-LOCAL PROVISIONING CEREMONY covering
  EVERY protected surface, the controller included (the fc0fa05-era base
  has neither a hardened verifier NOR any merge controller, so no
  first deployment may depend on either recognizing its successor —
  and the first controller cannot base-source itself to merge its own
  introducing PR): an out-of-tree bootstrap tool — run locally by the
  Eye, documented in RELEASING.md's governance appendix, never woven —
  takes the REVIEWED head of each protected-surface-introducing slice
  (E2's verifier, E1's controller), validates the complete closures,
  workflow files, chain roots, and the Eye's own signature end-to-end,
  prints the digests, and the Eye sets ALL protected variables
  (CURRENT_AUTHORITY_CHAIN_ROOT, EYE_AUTHORITY_PUBKEY,
  VERIFIER_CLOSURE_DIGEST, TRUSTED_WORKFLOW_DIGEST,
  TRUSTED_CONTROLLER_DIGEST, TRUSTED_VERDICT_CLOSURE_DIGEST) BEFORE the
  corresponding slice merges. THE CONTROLLER'S INTRODUCING PR lands by a
  RECORDED EXCEPTIONAL BOOTSTRAP MERGE: the Eye merges it by hand after
  running the bootstrap tool's validation, and the exception is recorded
  (step-ledger entry + a bootstrap-merge record naming the PR, head,
  validated digests, and the Eye's signature) — a one-time, documented
  deviation from the sole-merger rule, never a silent bypass; from the
  next merge on, the provisioned controller is the sole merger.
  **Accept (genesis)**: an unprovisioned controller (TRUSTED_CONTROLLER_
  DIGEST unset) refuses to operate (controller-untrusted); a substituted
  initial controller whose closure digest differs from the provisioned
  value refuses at startup; the bootstrap-merge record validates against
  the merged head. **Accept (verifier
  integrity)**: adversarial regression — a fixture PR replaces gate.mjs
  with a constant-success stub; the base-sourced execution ignores the
  stub, evaluates truthfully, and additionally reports
  verifier-modified-in-change; a helper-import swap is caught the same
  way (closure from base, not from the PR); a main-context fixture with a
  swapped verifier and an unmoved VERIFIER_CLOSURE_DIGEST ⇒ the workflow
  refuses to invoke it (verifier-untrusted); WORKFLOW-ONLY BYPASS fixture
  — a PR that edits ONLY the invoking workflow to skip the digest check
  and emit success ⇒ the merge controller refuses it (workflow-modified,
  digest ≠ TRUSTED_WORKFLOW_DIGEST, no transition record); genesis
  fixture — the bootstrap tool validates a staged E2 head and its printed
  digests match what the provisioned variables must hold; ruleset-off fixture ⇒
  unsafe-branch-config.
- **E3 auditor full-taxonomy + no-clean-on-zero, EXCEPTIONLESS** (`ai-native-memory/scripts/audit.mjs`).
  Root-as-memory-dir (marker predicate, root arg only); zero discovered sets ⇒
  exit 2, NO ESCAPE HATCH — there is no `--allow-empty` (or any equivalent
  flag): an audit that discovers nothing can NEVER exit 0 or print a clean
  status, in any invocation. Exploratory listing of an empty root is served
  by a separate `--inventory` mode that only enumerates and ALWAYS exits
  nonzero when zero record sets are found (its output is a report, never a
  pass verdict), keeping the authoritative path structurally incapable of
  the blocker-5 bypass. Validate all 8 record kinds via `RECORD_SET_LAYOUT`;
  md decisions = front-matter enum only (AM-40/41/42 pass unchanged — pinned
  bytes never touched). Legacy nonconforming records (atropos/lachesis cycle-1
  decision.json) SUPERSEDED with new content-addressed records — no allowlist
  (Eye: exceptionless). **Accept**: dogfood green after in-plugin content fix;
  an empty root exits 2 under EVERY flag combination (asserted by iterating
  the full flag matrix in the test); enumerated newly-failing inventory in
  the PR body; supersessor records validate.
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
  MUST also declare a MUTATION-BASED NEGATIVE CASE —
  `oracle.executable.negative: {mutate: {file, kind}, expect: "nonzero"}`.
  A special flag or alternate script is NOT acceptable (an oracle could
  hardcode nonzero for the flag while never inspecting its governed
  inputs), and the mutation is NOT author-freeform (a record could
  nominate a mutation that merely corrupts syntax, letting a parse crash
  impersonate detection): `kind` must name an entry in a CLOSED MUTATION
  REGISTRY inside run-oracles, each entry independently specifying (a) the
  mutation's SEMANTICS against the claimed invariant class (e.g.
  flip-declared-boolean, alter-content-address, drop-required-signature,
  duplicate-enrollment-entry, remove-exception-anchor), (b) APPLICABILITY
  preconditions (which record/target shapes it may be declared for — a
  kind that doesn't match the record's invariant class ⇒ FAIL
  mutation-inapplicable), and (c) POST-MUTATION VALIDATION: after
  mutating, the runner re-parses/schema-validates the mutated artifact
  and REQUIRES IT WELL-FORMED — a mutation that breaks parsing ⇒ FAIL
  mutation-invalid (so a subsequent nonzero exit can only come from the
  oracle detecting the SEMANTIC violation, never from a crash on
  malformed input). Then run-oracles copies the governed input set into a
  temp sandbox, applies the validated mutation, and re-runs the IDENTICAL
  production invocation — same argv, same entrypoint, no special mode —
  REQUIRED TO EXIT NONZERO, else FAIL `oracle-nondiscriminating`.
  Invariants no registry kind fits declare a TRUSTED NEGATIVE FIXTURE
  instead — a reviewed, committed violating artifact whose review rides
  the same PR as the record — subject to the same well-formedness
  validation. This is the clotho flagship-expectation
  mutate-then-expect-failure pattern made mandatory and de-gameable. `npm-script` entries
  are EXECUTED DIRECTLY by run-oracles, exactly like file entries — `npm
  run <script> --prefix <package-dir>` under the same per-entry timeout,
  nonzero ⇒ FAIL — with the same mutation-based negative case (sandbox-copy
  the package's governed inputs, mutate, re-run the identical script);
  mere presence of the package in the CI matrix proves nothing and is NOT
  accepted as coverage. The `evidence-dir` variant is REMOVED as an oracle
  kind (nonempty-dir is not a discriminating check): records whose claim is
  backed by an evidence directory instead declare a `file` oracle pointing
  at a shared deterministic validator
  (`docs/institutional-memory/validate-evidence-dir.mjs <dir>`) that
  recomputes every record's content address, validates schema/kind, and
  exits nonzero on any mismatch or an empty dir — with the SAME
  mutation-based negative case as every other file oracle (sandbox-copy the
  dir, corrupt one record's bytes, identical re-run must exit nonzero). Wired as a step
  in the institutional-memory CI job. **Accept**: a synthetic NORMATIVE
  record whose oracle file exits 1 ⇒ run-oracles FAIL; a constant-success
  oracle (exit 0 unchanged AND exit 0 on the mutated sandbox) ⇒ FAIL
  oracle-nondiscriminating; an oracle that ignores its governed inputs but
  special-cases a flag ⇒ still FAILS (the negative re-runs the identical
  argv, no flag exists to special-case); a present-but-timeout oracle ⇒
  FAIL; an npm-script whose identical re-run exits 0 on the mutated sandbox
  ⇒ FAIL oracle-nondiscriminating; backfill complete (every backfilled
  oracle carries a working mutation-based negative case); verify-contracts +
  run-oracles green in CI.

## 3. Governance ceremony (ONE combined live council — Eye ruling: Option A)

A single live TELOS re-authorization run (`docs/runs/product-authorization-1/`,
`build_id: iliad-product-1-authz`, seats claude/agy/codex signed +
grok/gemini advisory) authorizes BOTH:
- the enrollment-flip regularization discharging AM-42's process debt, AND
- AM-43: classify the two new package dirs (`cli/`, `connectors/meta-ads-mcp/`)
  into `PACKAGE_ROOTS_EXCLUDE`.

THE SUCCESSOR-PLAN TRANSITION IS THE MECHANISM (registry edits alone would
leave the active v15 plan normative while AM-42/AM-43 change its governed
roots — the exact bypass being regularized), executed in this order:
1. PUBLISH: the matured workshop approach (this document at convergence) is
   published as a content-addressed successor plan; its sha256 is the
   `plan_ref` (`sha256hex(canonicalize({kind:"candidate", plan}))`).
2. AUTHORIZE THAT EXACT HASH: the council run's PLAN_PATH/EXPECTED_PLAN_REF
   pin it (any drift ⇒ exit 1); `authorization-summary.json` names the
   plan_ref AND a build_id naming the enrollment flip.
3. PIVOT: `CURRENT-AUTHORITY.active_plan` → the successor plan_ref;
   `active_authorization` → the new authorization record; the v15 plan
   entry gains `superseded_by: <successor plan_ref>` (registry rows only —
   v15's bytes untouched).
4. EYE CONFIRMATION: implementation authority over the successor plan is
   granted by the Eye and recorded (pre-review authority_basis update +
   the quest step-ledger header) BEFORE any slice merges.
Until all four land, v15 remains the active plan and no slice of this quest
is merge-eligible; the verify-contracts §5d check asserts the pivot's
integrity (active_plan == authorized plan_ref; supersession row present;
deviation record pins am42_sha256).
BOOTSTRAP TRANSACTION (breaks the circularity of a ceremony that gates all
merges yet itself needs a merge): the four steps above land as a
GOVERNANCE-ONLY BOOTSTRAP SLICE — strictly DATA: docs/registry surfaces
only (the published successor plan, authorization-summary.json, AM-43
doc, deviation record, CURRENT-AUTHORITY registry rows) with NO code and
NO package dirs. The AM-43 decision record lands in
`clotho/memory/DECISIONS/` — a WOVEN git-weaver input (AM-42 beside it is
in the committed snapshot's closure) — so the bootstrap slice CARRIES ITS
OWN SAME-PR SELF-WEAVE REPUBLICATION per the atomic weave rule (a
re-weave is regenerated snapshot DATA, not code, so the data-only
property holds; "no code" refers to executable logic — the §5d check —
which still ships later in the verifier slice). The EXECUTABLE §5d pivot check is
NOT in the bootstrap (it is code): it ships in the later
verifier-hardening slice (E6/§3c work, already ordered after the
bootstrap) and validates the then-existing pivot state; until it lands,
the pivot's integrity evidence is the council run's authorization-summary
+ the step-ledger entry — recorded, then machine-checked as soon as the
verifier slice merges. The bootstrap slice is merged FIRST, under the CURRENT
(v15) authority, which is lawful because the sitting authorization already
empowers the Eye + council to authorize successors (the change_rule being
regularized is exactly this path, now followed rather than bypassed). The
implementation content previously bundled with the ceremony (cli/ package,
meta-ads hardening, the 8 pinned-surface updates incl. inventory.mjs +
its re-weave) moves to an ORDINARY later slice that cites the
by-then-active successor plan. Only after the bootstrap slice merges does
any implementation slice become merge-eligible.

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
  phase/status/owner/adr+sha/evidence/target_round). THE GO-LIVE GATE IS
  HARD ON THE RELEASE PATH — there is NO enforce flag and NO
  reporting-only mode that a release can invoke (a flag that downgrades a
  blocking verdict to a report is the bypass the frozen requirement
  forbids): `render-readiness.mjs --gate` exits nonzero unless every
  IN-SCOPE P0 item DISCHARGES with TYPED, VALIDATED evidence —
  path-exists is not a verdict. `done` requires an evidence object
  `{kind: oracle|check-run|artifact, ref}` the gate EVALUATES — and the
  evidence is SEMANTICALLY BOUND to its item, not merely valid (any green
  check could otherwise discharge an unrelated item; green CI alone is
  not proof of operability): each P0 item carries a reviewed
  `evidence_contract` — `{claim: <the operational property>, permitted:
  {oracle_ids[] | check_names[] | artifact_schemas[]}}` — and the binding
  is BIDIRECTIONAL: the referenced oracle/check/artifact record itself
  names the `readiness_item` it discharges; the gate fails
  `evidence-unbound` unless ref ∈ the item's permitted set AND the
  evidence's declared readiness_item equals the item's id. Then
  evaluation: `oracle` refs execute through run-oracles (with their
  mutation-negative discipline) and must pass; `check-run` refs are
  queried green AT THE RELEASE SHA via the checks API AND
  producer-authenticated exactly as the merge controller requires (the
  authenticated Actions app + trusted workflow-file digest + exact run
  id — a green same-name run from an untrusted app never discharges an
  item; same collision fixture); `artifact` refs
  must schema-validate and match their recorded content address
  (empty/stale/unrelated files fail typed validation). `na-by-signed-adr` requires the ADR sha to
  resolve AND an EYE AUTHORIZATION — an Ed25519 signature over
  (item_id ‖ adr_sha) verified against the protected
  `EYE_AUTHORITY_PUBKEY`; a content-addressed but unsigned ADR cannot
  excuse an item. Anything else ⇒ automatic no-go; release.yml runs
  `--gate` in the GATE job so a failing register aborts the release.
  Deferred Phase-1b+ items are represented STRUCTURALLY (phase > 1a, or
  na-by-signed-adr against the scope ADR), never by softening the verdict;
  `--check` remains for non-release contexts (registry shape + rendering)
  and CANNOT substitute for `--gate` (release.yml names `--gate`
  literally). **Accept**: a fixture register with one in-scope P0 item
  `open` ⇒ `--gate` exit nonzero and the release gate job red; `done`
  with an empty/mismatched-digest artifact ⇒ nonzero; `done` with a
  failing oracle ⇒ nonzero; SWAP fixture: two items exchange each other's
  individually-valid evidence refs ⇒ both fail evidence-unbound; na-by-signed-adr with a valid sha but NO Eye
  signature ⇒ nonzero; the same item with sha + valid Eye signature ⇒
  green; no argv/env combination makes `--gate` report-only (asserted
  over the flag matrix).
  Plus `docs/PRODUCTION-READINESS.md`; `product-version.json` (lockstep 0.3.0 + schema versions);
  repository-manifest memory_dirs registration; verify-contracts §-product checks.
- **Naming/versioning**: rename v4-build-gate/v4-forge/v4-breakout → telos-*;
  all package versions → 0.3.0 (clotho 0.0.0 too) + full metadata; plugin.json
  version alignment; narcissus-flagship name NOT renamed (verifier pin). NO root
  package.json (test-inventory forbids it — rejected-alternative recorded).
- **Node-version reconciliation oracle** (frozen mandate: every tracked
  Node-version claim reconciles to the required >=22.12.0), two layers with
  no reliance on an enumerated spelling list:
  (a) MANIFESTS (complete by construction): every tracked `package.json`'s
  `engines.node` is PARSED as a semver range and the oracle requires the
  range to admit no version below 22.12.0 (range-minimum check, not string
  match) — `^20.0.0`, `>=18`, `20.x` all fail arithmetically; a tracked
  manifest with NO engines field fails `engines-missing`.
  (b) PROSE (broad-capture + reviewed inventory): ALL tracked text files —
  no directory exclusions; docs/runs/ contains live workshop and authority
  artifacts alongside frozen evidence, so location is never a normativity
  ruling — are scanned with a deliberately OVER-BROAD matcher — any occurrence of `[Nn]ode(\.js)?`
  within a short window of a version-looking token (`v?\d+(\.\d+)*`,
  `\^|~|>=|≥|\+|or later|and up`) is a HIT. Every hit must either normalize
  to a version >= 22.12 (a small tested normalizer handles the common
  grammars: "Node 18+", "Node.js 21+", "requires Node v20.11 or later",
  "Node ≥18") or appear in a reviewed inventory
  `docs/institutional-memory/product/node-version-claims.json` recording
  {file, line, matched_text, disposition} — dispositions form a CLOSED
  set with machine-checked preconditions: `false-positive` (the text is
  not actually a version claim), or `historical-non-governing` (the claim
  lives in an IMMUTABLE pinned artifact — the oracle verifies the file is
  content-addressed/pinned by a snapshot or ledger, not merely located
  somewhere, since directory location is never a normativity ruling; an
  entry claiming it for an unpinned file ⇒ FAIL). A sub-22.12 claim in a
  CURRENT/governing doc has NO passing disposition — it must be corrected,
  and a genuine incompatibility inside a frozen artifact (one that would
  require mutating pinned bytes to fix) is routed as PLAN-ESCALATION to
  the Eye, never silently inventoried. The inventory must be EXACTLY
  current (a hit not listed ⇒ FAIL unreconciled-claim; a listed entry no
  longer matching ⇒ FAIL stale-inventory). Current offenders
  (including the employment-brief doc the checklist names) are corrected in
  the same slice. **Accept**: planted `Node 18+`, `Node.js 21+`,
  `requires Node v20.11 or later`, and a manifest `"node": "^20.0.0"` ALL
  fail; a sub-22.12 claim added without an inventory entry fails; a stale
  inventory entry fails; the sweep is clean at slice end.
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
  phase, not silently claimed now).
  TWO EXPLICIT INSTALL MODES (a `git archive` tarball has no `.git`, so
  checkout semantics must not be assumed there): the release build writes
  `RELEASE-IDENTITY.json` — `{tag, commit_sha, tree_sha, product_version,
  source: "release.yml", generated_files: {"RELEASE-IDENTITY.json": null,
  …: "<sha256>"}}`, values fixed by the tag so the double-pack
  reproducibility check still byte-matches — into the tarball root AFTER
  `git archive` (it is NOT part of the git tree, and the design says so).
  - CHECKOUT MODE (`.git` present): doctor runs the full battery incl.
    full-git-history; `pylae version` reports live HEAD (provenance:
    "checkout"). If RELEASE-IDENTITY.json is ALSO present, doctor
    cross-checks it against HEAD (mismatch ⇒ fail identity-drift).
  - ARCHIVE MODE (no `.git`, RELEASE-IDENTITY.json present): doctor performs
    a real GIT-OBJECT reconstruction, keeping the two hash domains separate:
    (a) TRACKED PAYLOAD — every extracted file except those named in
    `generated_files` — is hashed as git BLOB objects
    (`sha1/sha256("blob <len>\0"+content)` per the repo's object format) and
    the TREE OBJECT is rebuilt bottom-up (names, modes, subtrees exactly as
    git encodes them); the reconstructed root tree id must equal `tree_sha`,
    else fail `tree-mismatch`. (b) GENERATED FILES (injected post-archive)
    are verified against the plain sha256 digests recorded for them in
    `generated_files` (the identity file itself is covered by (c), not
    self-hashed). (c) AUTHENTICITY IS NOT CLAIMED OFFLINE: (a)+(b) prove
    SELF-CONSISTENCY only — a forger can regenerate all of it — and doctor's
    output says exactly that, pointing to the authenticity step: verifying
    the whole tarball's digest against the externally published SHA256SUMS +
    `gh attestation verify` provenance for the release (`pylae verify
    --attestation <bundle>` performs it when reachable; the offline result
    is labeled "self-consistent, publisher-unverified"). Git-history checks
    are reported "not-applicable: archive install" — never silently passed;
    `pylae version` reports the EMBEDDED identity, explicitly labeled
    (provenance: "release-archive"). No mode invents provenance.
  - NEITHER (`.git` absent and no identity file) ⇒ doctor FAILS
    `unprovenanced-install`.
  Proven, not asserted: release.yml gains a CLEAN-ROOM INSTALL job — extract
  the built source tarball into an empty temp dir OUTSIDE any git checkout,
  run `pylae doctor` (must pass in ARCHIVE mode) and `pylae version` (must
  report the embedded identity) there, and run `pylae verify
  --offline-checks` (the archive-mode subset); any spawn of a file outside
  the extracted root ⇒ fail. **Accept**: clean-room job green from tarball
  alone in archive mode; tampered tracked payload ⇒ doctor fails
  tree-mismatch (reconstructed git root tree ≠ tree_sha); tampered generated
  file ⇒ generated-digest mismatch; doctor's offline verdict is labeled
  "self-consistent, publisher-unverified" (no authenticity claim); tampered
  identity-file tree_sha ⇒ doctor fails
  tree-mismatch; stripped identity file ⇒ doctor fails unprovenanced-install;
  deleting a spawned helper from the tarball ⇒ clean-room job fails
  (packaging omission is detected, not shipped).
- **Meta-ads governance**: parseCap `^[0-9]{1,6}$` + isSafeInteger + >0 +
  HARD_CEILING_CENTS frozen (fail-closed startup); budget args validated; closed
  grammars validated BEFORE env/token access; META_ADS_ENABLED kill-switch;
  package.json + hermetic tests + HUMAN-SETUP.md; env-surface.json
  additional_scanned_dirs mechanism + 5 META_* names.

## 5. Freshness, release, deployment, flagship

- **Freshness (E-adjacent)**: exact-head binding is INTRINSIC to
  authoritative verification, not an opt-in flag — `--verify-committed`
  BY DEFAULT requires live `git rev-parse HEAD` == recorded input head +
  clean worktree + full source_ref sweep (distinct fatal codes:
  input-head-stale / exact-head-dirty / source-ref-stale); verifying a
  stale snapshot against a different checkout FAILS by default, closing
  blocker 3. Historical inspection is the explicit exception:
  `--verify-committed --historical` checks snapshot INTACTNESS only and is
  structurally non-authoritative — its JSON carries `verify_mode:
  "historical-nonauthoritative"` and `snapshot_intact: true/false`, and it
  NEVER emits the authoritative `verified_current: true` claim that
  default mode emits (consumers keying on the authoritative field cannot
  be satisfied by a historical run). Always-emitted freshness/heads_equal.
  CI IS MODE-SPLIT BY WHAT THE PR TOUCHES (a blanket historical PR check
  would let a woven-input PR merge with a stale-but-intact snapshot,
  gutting the atomic weave rule): the required institutional-memory PR job
  first diffs the PR against its base for WOVEN-INPUT paths, classified
  by PROPOSED-TREE INPUT DISCOVERY: each changed/added file is tested
  against the weaver's own input RULES evaluated over the PR head
  (package-roots membership, memory-dir patterns, manifest globs — the
  same predicates weave.mjs uses to enumerate inputs), NOT merely by
  membership in the prior snapshot's recorded closure — a closure list
  cannot contain a NEWLY ADDED woven file (e.g. a fresh
  clotho/memory/DECISIONS record), so closure-only selection would pick
  historical mode and merge a stale snapshot; if ANY
  woven input changed OR WAS ADDED, the job runs the AUTHORITATIVE default
  `--verify-committed` at the ACTUAL PR HEAD as a REQUIRED pre-merge
  check — which fails unless the PR carries its own re-weave (the atomic
  weave rule, machine-enforced BEFORE merge, not discovered on main); if
  none changed, it runs `--historical` and is named "snapshot intact
  (historical — does not assert this HEAD)". Main-push/release jobs always
  run the authoritative default. docs/runs/clotho-self-weave/run.mjs is NOT woven (editing it never
  forces a re-weave) but it is NOT unpinned: as a merge/release verdict
  producer its closure is protected under TRUSTED_VERDICT_CLOSURE_DIGEST
  and base-sourced in PR CI per E2 — weave membership and
  trust protection are independent properties.
  **Accept (CI split)**: a fixture PR changing a package manifest WITHOUT
  a re-weave ⇒ the required PR job selects authoritative mode and goes
  red; the same PR with its re-weave ⇒ green; ADDED-WOVEN-FILE
  regression: a PR that only ADDS a new file under a woven memory dir
  (absent from the prior snapshot closure) without a re-weave ⇒
  authoritative mode selected and red — closure-only selection would
  have wrongly picked historical; a docs-only PR ⇒ historical
  mode selected.
  **Accept**: stale-head checkout + default `--verify-committed` ⇒ fatal
  input-head-stale; same checkout with `--historical` ⇒ exit 0 with
  verify_mode historical-nonauthoritative and NO verified_current field;
  release head ⇒ default mode green.
- **Signed release pipeline** `release.yml`, fail-closed end to end:
  (1) GATE: tag object must be ANNOTATED and its SIGNATURE VERIFIED in CI
  against an OUT-OF-TREE trust root (an in-tree public key is circular — a
  rewritten commit can carry the attacker's key plus a matching tag): the
  EXPECTED SIGNER FINGERPRINT lives in a protected GitHub Actions
  repository/environment VARIABLE (`RELEASE_SIGNER_FINGERPRINT`, writable
  only by repo admins through Settings — not by any PR or push), documented
  in RELEASING.md with the rotation ceremony (rotation = an admin Settings
  change + a signed changelog entry, never a tree edit). The gate job builds
  an ISOLATED verifier keyring (empty GNUPGHOME) containing only key
  material whose computed fingerprint EQUALS the protected variable — the
  in-tree `docs/institutional-memory/product/KEYS/release-signing.pub` is
  convenience distribution, imported ONLY if its fingerprint matches, else
  abort `key-fingerprint-mismatch`; then runs `git verify-tag` against that
  keyring (unknown/unsigned/unverifiable/wrong-key ⇒ abort); variable unset
  ⇒ abort fail-closed. Required-CI check-run asserted at the tag SHA with
  the SAME producer binding (authenticated Actions app + trusted workflow
  digest + exact run id — never name-only; untrusted same-name collision
  fixture must fail the gate); local
  verify battery incl. authoritative `--verify-committed` (exact-head by default). **Accept**: a tag
  signed by a key whose fingerprint differs from the protected variable ⇒
  gate aborts even when the tree's committed .pub matches the tag's signer.
  (2) BUILD, reproducibility covering THE ARTIFACT OPERATORS INSTALL (the
  final source tarball is `git archive` + injected generated files, so
  "deterministic by construction" no longer holds and must be re-established
  over the assembled result): the assembly is fully specified — `git archive`
  the tag; inject RELEASE-IDENTITY.json + generated files; repack with
  pinned metadata (`tar --sort=name --owner=0 --group=0 --numeric-owner
  --mtime=@<tag-commit-timestamp>` piped through `gzip -n`) so every
  nondeterministic tar/gzip field is fixed by the tag. The ENTIRE assembly
  (and `npm pack` of the cli) runs TWICE from scratch and the final
  artifact digests are byte-compared — any mismatch aborts, and any
  irreducible nondeterminism must be recorded in RELEASING.md before
  release. SHA256SUMS; syft SBOM; `actions/attest-build-provenance` per
  artifact. **Accept**: double-build digests equal for BOTH the cli tgz and
  the assembled source tarball; a fixture varying mtime/owner in the
  repack ⇒ digest mismatch ⇒ abort.
  (3) PUBLISH fail-closed, DRAFT-FIRST (checking after public upload is
  not fail-closed — an extra or unattested asset must never be
  downloadable): the release is created as a DRAFT (`gh release create
  --draft`), assets upload to the draft only; against the DRAFT, the
  CLOSED ALLOWLIST check runs (`gh release view --json assets` must equal
  the literal expected filename set EXACTLY — missing or EXTRA assets ⇒
  fail) and `gh attestation verify` runs per asset (unattested ⇒ fail);
  ONLY after both pass is the single final operation performed — flipping
  the draft to published; any failure deletes the draft, so nothing
  unverified is ever public. **Accept**: planted extra asset ⇒ draft
  deleted, release never published; all-green ⇒ publish flip is the last
  logged step.
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
- **Review-plugin: pin AND de-privilege** (pinning alone leaves downloaded
  review code holding repo-mutating credentials): (1) plugin_marketplaces
  points at an owner-controlled pinned fork of anthropics/claude-code (test
  `#<sha>` first). (2) The workflow is SPLIT into two jobs. The REVIEW job —
  the only place plugin code executes — runs with `permissions: {contents:
  read}` ONLY: no `pull-requests: write`, no `id-token: write`, so the
  GITHUB_TOKEN in its env cannot mutate the repo and no OIDC token is
  mintable. Its sole privileged input is CLAUDE_CODE_OAUTH_TOKEN, which is a
  model-subscription credential, not a repo credential — its blast radius
  (model spend / subscription abuse on exfiltration) is documented in the
  workflow header as the residual accepted risk. The review job writes its
  verdict/comment body to a workflow ARTIFACT and never posts. (3) A separate
  POST job with `permissions: {pull-requests: write}` and NO plugin code —
  a few lines of deterministic `gh api` — downloads the artifact,
  size/shape-validates it, and posts the comment. Untrusted code and
  mutation authority never share a job. **Accept**: review job's permissions
  block is read-only in the workflow file; a grep-style CI assertion (or the
  workflow-lint oracle) fails if the review job ever gains write perms or
  `id-token`; post job contains no marketplace/plugin steps.
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
  BOUNDED SUPPORTED-BROWSER CONTRACT (the engine limitation is closed by an
  explicit boundary this round, per the Eye's recorded deferral of the
  multi-engine matrix): PD-003 states the v1 qualified envelope — flagship
  and demo are QUALIFIED ON CHROMIUM (desktop + the 375×667 mobile-viewport
  gate) ONLY; Firefox/WebKit/mobile-device/screen-reader/constrained-GPU
  qualification is explicitly UNQUALIFIED and recorded as P1 register items
  (`production-readiness.json`, target_round: next) — the product never
  implies broader support than it has qualified (any user-facing
  compatibility statement cites the contract). **Accept**: PD-003 names the
  qualified engine set; the register carries the multi-engine items with
  owners + target round; no doc claims cross-browser support.

## 6. Slice/PR decomposition (atomic weave rule)

Bounded PR slices, each: implement → deterministic verification → implementation
review (4a signed council review for E1–E6 + the ceremony; 4b entry-ritual +
adversarial subagent review for mechanical slices) → Eye acceptance → step-ledger
entry. Order: **governance bootstrap slice FIRST** (the §3 four-step
transaction: successor plan + authorization + pivot + Eye confirmation +
AM-43/deviation records — docs/registry only, merged under the sitting v15
authority; nothing else is merge-eligible before it) → freshness → (plugin
self-containment → E2 → E3) ∥ E1 → E6 → E4 → product memory dir + ADRs →
naming/versions → **implementation slice for the excluded dirs** (cli/
package + meta-ads hardening + the 8 pinned-surface updates incl.
inventory.mjs with its same-PR re-weave, citing the by-then-active
successor plan) → release pipeline/pages/plugin-pin → flagship/demo/fonts →
**authority-chain-repair slice** (E5 successor docs + citation redirect + new
invariant + verifier) → **train-end re-weave**.
ATOMIC WEAVE RULE (a merged head must never fail committed-weave
verification): ANY slice that changes a WOVEN input — package manifests,
`clotho/inventory.mjs`, woven docs, anything the snapshot pins — includes
its own full self-weave republication (+ expected-flagship regen where its
pins are affected) IN THE SAME PR, so every merged head passes
`--verify-committed` (v0.2.0 precedent: the merge train required exactly
such per-change re-weaves). Slices touching only non-woven surfaces
(docs/runs/clotho-self-weave/run.mjs, workflows/, .github/, flagship+demo exclude-listed trees, new
excluded package dirs) ride without one — each slice's PR body states which
case applies and why. The naming/versions slice, the excluded-dirs
implementation slice, and the GOVERNANCE BOOTSTRAP slice (its AM-43
record is a woven memory input) are therefore each ATOMIC — the
touched-woven-input edit plus its re-weave in one PR. The
**train-end re-weave** remains as the FINAL capture at the qualified head
(full self-weave republication + lachesis pins + flagship live-graph +
expected-flagship regen + Eye re-audit + any residual woven-doc edits).
Release from the qualified accepted commit. **Accept**: every merged slice
head passes the committed-weave posture check in CI — none merges red.

## 7. Acceptance criteria (quest-level)

Comprehension-gate GRANTED artifact before implementation; every slice in the
Argo step-ledger with merge anchors + review evidence; per-slice package suites +
verify-contracts + self-weave posture green; authoritative `--verify-committed`
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
stated as a non-claim. The self-weave verifier
(`docs/runs/clotho-self-weave/run.mjs`) is NOT un-pinned: its closure is
protected under TRUSTED_VERDICT_CLOSURE_DIGEST, base-sourced in PR CI, and
changeable only through the Eye-signed transition mechanism (E2). No
production authority is granted to any model council; the Eye's
human authority and the deterministic gate remain the trust roots.
