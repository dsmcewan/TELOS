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
  credential, and it NEVER SHARES AN EXECUTION SUBSTRATE WITH AGENT
  CODE (an env-absence check proves nothing if agent code ran on the
  same runner first — a lingering background process, a poisoned PATH
  shim, or any shared writable state could capture the credential the
  moment the publisher receives it): agents and the publisher run in
  SEPARATE JOBS ON FRESH RUNNERS, connected only by a SCHEMA- AND
  DIGEST-BOUND ARTIFACT HANDOFF (the agents' job uploads the patch
  dossier as an artifact with its recorded sha256; the publisher's
  fresh-runner job downloads it, re-verifies the digest, and
  schema-validates before any credential is loaded) — no shared
  processes, no shared toolchain, no shared credential store, and the
  credential exists only in the publisher job's environment on a
  runner where no agent byte has ever executed: it schema-validates the patch data, applies it in a clean
  sandbox checkout, pushes the branch, opens the PR, and returns
  `{pr_url, head_sha}`; its API surface contains NO merge operation and
  the credential never enters any agent's environment. THE PUBLISHER'S
  PUSH TARGET IS CONTROLLER-OWNED, NEVER AGENT-CHOSEN (an agent-supplied
  branch name aimed at main would mutate the protected base with no
  merge at all): the publisher MINTS the branch name itself in a
  reserved namespace (`hestia/fix-<run_id>-<n>`), REJECTS any push whose
  ref resolves to the default branch or any protected/ruleset-covered
  ref (protected-ref set fetched server-side, not assumed), pushes
  CREATE-ONLY (the ref must not exist; force-with-lease against an
  expected-empty old SHA — an existing ref ⇒ refuse `ref-exists`), and
  its credential is verified NON-BYPASS at startup via a
  PUBLISHER-BOUND PRE-PUBLICATION ATTESTATION (the publisher's
  least-privilege App cannot read branch protection or bypass_actors
  itself — Administration:read and ruleset-write visibility are outside
  its scopes — and the merge ceremony's attestation is minted LATER and
  bound to a different dossier): the Eye's DISPATCH WRAPPER for a
  Hestia run executes the same privileged attestor FIRST, emitting a
  one-time Ed25519-signed attestation {publisher installation
  permission set, ruleset states, bypass resolutions, hestia run
  binding, issued_at, nonce, short TTL}; the publisher job verifies it
  against EYE_AUTHORITY_PUBKEY (+ TTL + run binding + unused nonce)
  before any push — missing/stale/foreign attestation ⇒ refuse
  publisher-attestation-missing/-stale; PERMISSION-LIMITED regression:
  the publisher's own credential receives the real 403/omitted-bypass
  responses and still operates from a valid attestation, refusing only
  when it is absent or stale (so even a publisher bug cannot
  direct-push a protected ref, and the proof is operable under the
  real API permission model). AGENT-AUTHORED
  EXECUTION-SURFACE CHANGES ARE REJECTED BEFORE PUBLICATION (pushing a
  branch whose patch adds or edits a push-triggered workflow would hand
  the agent's code a GitHub Actions token — and reachable secrets —
  the moment the branch lands, BEFORE any controller evaluation;
  post-hoc detection cannot restore fail-closed): the publisher
  HARD-REFUSES (`execution-surface-rejected`) any patch touching
  `.github/**` (workflows, composite actions, Actions config) or other
  execution-trigger surfaces — no exception path exists through Hestia;
  CI-config changes are outside its remit entirely and flow only through
  the human/Eye path with its transition-record discipline. Rejecting
  workflow files alone is NOT the whole surface (PR CI checks out
  proposed code and runs its `npm test` — an agent payload in
  package.json scripts, a test runner, or an imported helper executes
  under that job's GITHUB_TOKEN the moment the PR opens): the rule is
  therefore about the JOBS, not just the files — EVERY automatically
  triggered job that executes proposed-tree bytes MUST run
  CREDENTIALLESS: `permissions: {}` (a token with zero scopes), no
  secrets referenced, no OIDC; only jobs executing exclusively
  base-sourced/trusted bytes (the verdict producers, the post job) may
  hold scoped permissions. The workflow-lint oracle enforces this
  partition (a proposed-bytes job with any permission scope or secret
  reference ⇒ FAIL) — so an agent payload can run its code in PR CI but
  holds NOTHING: no writable token, no secrets, no identity. Agents can
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
  agent environment fixture asserts NO credential variable is present
  AND the job-separation fixtures prove substrate isolation: a
  LINGERING-PROCESS attempt (agent leaves a background credential
  sniffer) never observes the token — the publisher job runs on a
  fresh runner where the process does not exist; a TOOLCHAIN-POISON
  attempt (agent installs a PATH shim over git/gh) never executes —
  the publisher's runner never ran agent bytes and its handoff is
  digest-verified data, not tools; a tampered handoff artifact ⇒
  digest mismatch ⇒ refused before credential load;
  a patch attempting to smuggle a merge is inert data — the publisher
  only pushes and opens PRs, and merge remains exclusively the
  controller's; MALICIOUS-WORKFLOW regression: a patch adding a
  push-triggered workflow (or editing any `.github/**` file) ⇒ the
  publisher refuses execution-surface-rejected and NOTHING is pushed —
  the agent-authored workflow never executes, obtains no token and no
  secrets; PROTECTED-REF regressions: an agent patch naming main (or any
  protected ref) as target ⇒ refused, no push occurs; a minted-namespace
  collision (ref exists) ⇒ refused ref-exists; NON-WORKFLOW PAYLOAD
  regression: a patch planting a payload in package.json test scripts ⇒
  publishable, but the PR CI job that executes it is asserted
  credentialless (permissions {}, no secrets) so the payload runs with
  nothing; publisher closure covered by TRUSTED_CONTROLLER_DIGEST.
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
  base (mergeable_state not behind/dirty), required checks green FOR THE
  MERGE CANDIDATE — where the EVALUATED COMMIT is resolved correctly
  (GitHub `pull_request` runs evaluate the SYNTHETIC TEST-MERGE commit
  of refs/pull/N/merge, not the branch head; binding evidence to the
  head SHA alone would either find no runs or trust a run that never
  tested the merge result): the controller MIRRORS GITHUB'S PRECEDENCE
  PER REQUIRED CONTEXT — for each required check it first resolves the
  CURRENT synthetic merge commit (parents exactly {current base SHA,
  dossier head SHA}, verified via the commit object; an older-base merge
  commit ⇒ `stale-merge-evidence`); if ANY status/run exists on that
  merge commit for the context, THAT run is the one evaluated — it must
  be green AND producer-authenticated, and a head-SHA run can NEVER
  substitute for it (an OR rule would let a trusted green head run mask
  an untrusted same-name status on the merge commit GitHub actually
  selects); only when the merge commit carries NO status for the
  context may a producer-authenticated green head-SHA run satisfy it;
  and "green" is NEVER keyed by check NAME alone (mutable names
  cannot carry authority — the content-address rule; GitHub permits
  same-name runs from any app at the same SHA): the controller resolves
  each required check run to its PRODUCER and accepts it only if (a) the
  producing app is the authenticated GitHub Actions app, (b) the run's
  workflow file blob at the evaluated head matches the trusted workflow
  digest set, and (c) the exact run id + head SHA are recorded in the
  attestation; a green same-name run from any other producer is ignored
  (fixture: an untrusted app posts a green same-name check at the exact
  SHA ⇒ the controller does NOT count it and refuses eligibility) — AND
  requires AUTHENTICATED EYE ACCEPTANCE FOR EVERY MERGE, ordinary PRs
  included (green checks + protected-surface rules alone would let
  automation merge a model-produced change no human accepted —
  violating the non-delegable human-authority invariant; the §6
  `review → Eye acceptance → merge` ordering is enforced by the
  controller, not left as prose): a PR is merge-eligible only with an
  EYE-SIGNED PRE-MERGE ACCEPTANCE whose canonical payload binds
  (owner/repo ‖ pr_number ‖ exact head SHA ‖ current base SHA and ref ‖
  active plan_ref), verified against EYE_AUTHORITY_PUBKEY IMMEDIATELY
  BEFORE the PUT — a head or base moved after signing invalidates the
  acceptance (refuse `acceptance-stale`), a different repo/PR cannot
  reuse it, and replay is inert (the bound head SHA can only be merged
  once). Missing/invalid acceptance ⇒ refuse `acceptance-missing`, no
  mutation — then, only on pass, performs the SOLE merge via `gh api -X PUT
  .../merge -f sha={head}` (server-enforced expected-head guard; 409 ⇒
  `head-moved`, never retry-fresh) with `merge_method: "merge"` PINNED
  EXPLICITLY — never squash or rebase (both rewrite the PR's commit
  identities, so the input-history digest recorded at the PR head would
  fail input-history-stale on main immediately after merge; a true
  merge commit preserves the original commits' reachability and every
  path-limited history fact the snapshot recorded); the controller
  asserts at startup that merge commits are allowed (else
  `unsafe-merge-method`) and its post-merge attestation re-derives the
  merged main's input-history digest and asserts it still matches
  (topology regressions: squash-configured stub ⇒ refused at startup;
  post-merge digest mismatch ⇒ attestation exit 2). The check-then-PUT window is closed
  SERVER-SIDE, not by client timing (a base update between the
  controller's query and its PUT would otherwise merge on stale checks):
  the target branch protection MUST set `required_status_checks.strict:
  true` (branch must be up to date with base at merge time) and the
  controller runs under a NON-BYPASS credential (not admin, not on any
  bypass list), so a base moved after the eligibility query makes the
  server itself refuse the PUT (405/409 ⇒ reported `base-moved`); the
  controller VERIFIES both preconditions at startup — and "cannot
  bypass" is proven from PROTECTION DATA, not identity (`gh api user`
  names the principal but says nothing about effective permission or
  bypass membership, and classic `enforce_admins` does not cover ruleset
  `bypass_actors`). THE PROTECTION DATA IS SUPPLIED BY A SIGNED
  CONFIGURATION ATTESTATION, NOT READ BY THE MERGE CREDENTIAL (reading
  branch protection requires Administration:read and full bypass_actors
  visibility requires ruleset write — both excluded from the
  controller's least-privilege manifest scopes, so a controller that
  had to read them itself would always fail
  bypass-visibility-unavailable): the EYE-LOCAL ceremony, under the
  Eye's admin credential, runs a CONFIG ATTESTOR that enumerates EVERY
  effective ruleset on the target branch (repository AND inherited
  organization rulesets) plus classic branch protection, resolves all
  bypass actors to effective membership, performs the custody-manifest
  enumeration, and emits an Ed25519-SIGNED CONFIGURATION ATTESTATION
  that is ONE-TIME AND RUN-BOUND (ruleset updated_at alone is a false
  epoch — App-permission escalations, collaborator/deploy-key
  additions, team/role changes, and environment-policy edits all drift
  WITHOUT touching any ruleset timestamp): the attestation binds
  {safety/actor-restriction ruleset states, bypass resolutions, full
  custody enumeration (collaborators, App installations + permission
  sets, deploy keys), environment protection state, THE DOSSIER DIGEST
  OF THIS SPECIFIC MERGE RUN, issued_at, and a single-use nonce}, with
  a SHORT TTL; the attestor executes at ceremony start immediately
  before the controller, so every conclusion is at most minutes old
  and each attestation authorizes exactly one run (reuse ⇒
  `config-attestation-consumed`). The controller VERIFIES it against
  EYE_AUTHORITY_PUBKEY, requires dossier-digest match + TTL + unused
  nonce, and additionally re-reads what its own scopes CAN see — the
  public active-rules endpoint, ruleset ids/updated_at, and the
  telos-authority-roots VALUES (comparing read values to attested
  values catches root replacement) — refusing
  `config-attestation-stale` on any drift, expiry, or mismatch;
  missing/invalid attestation ⇒ refuse `config-attestation-missing`.
  SAME-RUN DRIFT IS CLOSED PRE-MERGE BY SERIALIZED
  REVALIDATE-THEN-MERGE (detection-plus-revert would be recovery, not
  fail-closed — the unauthorized merge must never happen): the attestor
  and controller execute as ONE SERIALIZED Eye-local ceremony holding a
  ceremony lock — (1) attestor issues the run-bound attestation, (2)
  controller derives eligibility and STOPS before mutating, (3) the
  PRIVILEGED attestor performs a FINAL FULL RE-ENUMERATION of every
  attested surface and only on zero-drift issues a single-use GO
  SIGNAL, (4) the controller PUTs immediately upon the signal. Nothing
  can interleave between (3) and (4): the drift surfaces are admin-only
  and the sole admin IS the serialized process's owner (custody-proven)
  — any drift observable at (3) ⇒ the merge is REFUSED
  (`config-drift-pre-merge`), never performed; the post-run
  re-enumeration remains as defense-in-depth only. SAME-RUN drift
  fixtures: each surface mutated between attestation issuance and the
  PUT (stub) ⇒ step (3) catches it and the ORIGINAL MERGE IS PREVENTED
  (asserted: no mutation occurred), not merely detected afterward.
  The attestation requires strict up-to-dateness in effect, and
  requires the authenticated
  principal (user or app installation) to be ABSENT from the
  `bypass_actors` list of every ruleset CONTAINING SAFETY RULES
  (required status checks, up-to-date enforcement, or any
  check-bypassing capability) and from any admin-exemption path —
  membership in the bypass list of a validated PURE ACTOR-RESTRICTION
  ruleset (update/push restriction rules ONLY, classified by rule
  content per §5(b2)) is REQUIRED for operability and is not a safety
  bypass; a ruleset mixing safety rules with a controller bypass entry
  ⇒ refuse. Absence
  is proven by EFFECTIVE-MEMBERSHIP RESOLUTION, not literal-identity
  comparison (a bypass_actors entry can be a TEAM, organization role, or
  repository role; a principal not named directly could inherit bypass
  through any of them): every GROUP-TYPE actor entry is resolved to its
  membership/role holders via the teams/collaborators/role APIs and the
  principal must be absent from EVERY resolution; the principal's own
  repository role is also checked against role-type entries. If the API
  omits or refuses bypass-actor data OR any group actor cannot be fully
  resolved (visibility limits, ambiguous role mapping), that is NOT
  treated as absence — the controller refuses
  `bypass-visibility-unavailable` / `bypass-resolution-incomplete`. Any failed condition ⇒ exit 2
  `unsafe-merge-environment` before any mutation. A request invalidated by a PRIOR merge in the same run ⇒
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
  ineligible-PR fixture ⇒ refused pre-merge; MERGE-COMMIT-BINDING
  regressions: a valid PR whose checks ran on the synthetic merge commit
  (parents = {base, head}) ⇒ ACCEPTED (not wrongly refused for missing
  head-SHA runs); a check run on a merge commit built against an older
  base ⇒ stale-merge-evidence, refused; PRECEDENCE regression — a
  trusted green head-SHA run PLUS an untrusted same-name status on the
  synthetic merge commit ⇒ the merge-commit status takes precedence,
  fails producer authentication, and the PR is REFUSED (the head run
  cannot mask it); EYE-ACCEPTANCE regressions:
  green-checked PR with NO acceptance ⇒ acceptance-missing, no
  mutation; acceptance bound to another head/base/repository ⇒ refused;
  replayed acceptance after a new push (head moved) ⇒ acceptance-stale;
  TWO-PR regression: the first
  merge makes the second stale/conflicting (stub gh flips its
  mergeable_state after merge #1) ⇒ the second is refused base-moved, NOT
  merged on its stale preflight; TOCTOU regression: stub server moves the
  base BETWEEN the eligibility query and the PUT and (modeling strict
  protection) rejects the PUT ⇒ controller reports base-moved, no merge
  recorded; unsafe-environment fixtures: strict=false, a bypass-capable
  credential, the principal listed as a bypass_actor of a
  CHECK-ENFORCING ruleset (repository or inherited org — stub rulesets
  API; its presence in a validated PURE actor-restriction ruleset's
  bypass list ⇒ COMPLIANT, startup proceeds — the aligned-scope
  fixture), the principal INHERITING a safety-ruleset bypass through a
  listed TEAM or repository/organization ROLE (stub
  team-membership/role APIs — literal-name absence must NOT pass), an
  unresolvable group actor (⇒ bypass-resolution-incomplete),
  or bypass-actor data omitted/refused to the EYE'S ATTESTOR
  (⇒ bypass-visibility-unavailable, never treated as absence) ⇒
  attestation refused, controller refuses at startup;
  PERMISSION-LIMITED regression — the controller's own credential
  receives real 403/404 responses for branch protection and bypass
  data (as GitHub returns to non-admin callers, stubbed) and still
  OPERATES from a valid fresh attestation, refusing only on
  config-attestation-missing/-stale; PER-SURFACE DRIFT regressions —
  each of {App-permission escalation, collaborator addition, deploy-key
  addition, team/role membership change, environment-policy removal}
  mutated AFTER attestation issuance with ruleset metadata unchanged ⇒
  the consumed/expired attestation cannot cover a second run and a
  fresh attestor run reports the drift ⇒ config-attestation-stale /
  custody-drift, merge refused; out-of-band-merge fixture ⇒
  unattested-merge; clean run ⇒ merged + attestation; workflow agents' token
  fixture proves no merge scope; workflows CI job runs both suites green.
- **E2 ai-native-memory gate freshness + AUTHORITY-CHAINED sources** (`ai-native-memory/scripts/gate.mjs`).
  Extract `scripts/lib/freshness.mjs` (byte-stable audit findings); gate
  re-derives every query `expected` from `derived_from` at gate time (REQUIRED;
  DENIED on missing/dangling/stale with distinct reason codes); authority read
  confined to the plugin boundary (couples to E4). SELF-CONTAINMENT IS A
  CONCRETE TRANSITION, not confinement alone (confining reads against the
  current out-of-plugin CURRENT-AUTHORITY would merely make the plugin
  fail closed, not self-contained — governance correction g): (i) the
  governing spec is copied BYTE-IDENTICAL into the plugin
  (`ai-native-memory/authority/2026-07-18-….md`; its sha256 recomputed
  and asserted UNCHANGED — the content address is the identity, the
  location is not); (ii) `CURRENT-AUTHORITY.json.active.path` is
  REPOINTED to the in-plugin copy via the standard authority-transition
  discipline (registry row change, old path retained as provenance);
  (iii) the original under docs/superpowers/specs/ stays untouched
  (blob-pinned by the snapshot). **Accept (self-containment)**:
  CLEAN-ROOM test, TWO TIERS (self-containment and external anchoring
  are separate properties and must not contradict — a subtree with no
  object database cannot satisfy the git-anchor requirement, and
  minting an anchor from the copied subtree would let the tree writer
  choose the trust root):
  TIER 1 (subtree-only, no repository parent, no anchor supplied):
  audit + all self-contained checks run GREEN from inside the copy (any
  read escaping the subtree fails loudly by nonexistence), and the
  authority gate DENIES `anchor-unavailable` — the DENIAL IS THE PASS
  CRITERION for that check (fail-closed proven, no fabricated root);
  TIER 2 (subtree + independently authenticated object store — the
  release's attested history bundle, digest-verified before use): the
  gate resolves its anchor against the bundle store and runs GREEN.
  Sha-equality assertion on the copied spec; the repointed active.path
  resolves in-plugin via the confined resolver.
  Re-derivation alone cannot
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
  main, and this is stated, not assumed; at release, the DRAFT'S
  EYE-ACCEPTED TARGET — the release-acceptance block's release_commit,
  its Ed25519 signature verified against EYE_AUTHORITY_PUBKEY (this IS
  the release anchor; the superseded signed-annotated-tag mechanism is
  not part of E2 — consistent with §5's tag-born-at-publish design);
  locally, an operator-supplied commit (typically a published release's
  verified acceptance target, resolved against the local clone or the
  release's authenticated history bundle). The gate resolves CURRENT-AUTHORITY and every
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
  Eye's public key held in a PROTECTED VARIABLE (`EYE_AUTHORITY_PUBKEY`,
  the release-authority custody class).
  CUSTODY DEFINITION — binding for EVERY "protected variable" in this
  plan (repository-level Actions variables are writable by ANY
  write-access collaborator, so they cannot carry Eye-only custody by
  themselves; claiming admin-only there would be false): all protected
  variables live in dedicated GitHub ENVIRONMENTS, SPLIT BY SENSITIVITY
  (one environment cannot serve both: a main-only deployment policy is
  matched against GITHUB_REF, and a pull_request run's
  `refs/pull/<n>/merge` would be refused — making required PR
  verification unsatisfiable — while opening that environment to PR
  refs would expose release-capable secrets to proposed workflow
  bytes):
  - `telos-authority-roots` holds ONLY PUBLIC verification values —
    chain-root digests, EYE_AUTHORITY_PUBKEY, closure/workflow/
    controller digests. These are public-key material and hashes: their
    security property is WRITE custody (admin-only environment
    management, custody-drift-checked), not read secrecy. Its
    deployment policy admits ALL refs, so PR gate jobs read the roots
    by targeting it; a malicious PR workflow that reads them gains
    nothing (they are verification anchors, not capabilities).
  - `telos-authority-release` holds release-capable SECRETS and admits
    ONLY protected main — proposed PR bytes can never reach it.
  Environment configuration for both is manageable ONLY by repository
  ADMINS. Custody is then made
  DETERMINISTICALLY VERIFIABLE: (a) on this personal repository the
  ADMIN set is exactly the Eye (the owner) while the full writer set is
  the Eye-signed custody MANIFEST (Eye + the capability-bounded
  controller and publisher principals — see §5(e)), and a CUSTODY-DRIFT oracle
  in the authority workflows queries the collaborator/permission list
  and FAILS `custody-drift` if ANY repository-writing credential of ANY
  CLASS exists beyond the recorded custody set — the enumeration covers
  collaborators/permissions AND GitHub App INSTALLATIONS (whose
  actions/contents/administration write permissions live on a separate
  authorization surface and never appear as collaborators; each
  installation's effective permissions are listed via the installations
  API and any write-capable installation not in the recorded set ⇒
  FAIL) AND write-enabled DEPLOY KEYS (listed and required empty or
  recorded) — write of any class reaches repository variables, workflow
  dispatch, or the releases API, so the invariant is a closed set over
  EVERY writer class, not user-collaborators only; enumeration
  unavailable for any class ⇒ FAIL custody-visibility-unavailable; or
  if the environment protection is removed; the Eye-local release ceremony runs the same
  check first and REFUSES to proceed while custody drift exists.
  **Accept (custody split)**: a transition PR's required gate job
  (running on refs/pull/N/merge) reads the roots from
  telos-authority-roots and COMPLETES its check; a malicious PR
  workflow targeting telos-authority-release ⇒ refused by the
  deployment policy before the job starts (no release secret ever
  reaches proposed bytes); WRITER-CLASS regressions — a stub
  write-capable App installation not in the recorded set ⇒
  custody-drift; a write deploy key ⇒ custody-drift; enumeration
  refused ⇒ custody-visibility-unavailable — in every case the release
  ceremony refuses to run, so no such principal is left free to mutate
  releases or dispatch privileged workflows while the pipeline
  proceeds; (b) the recorded custody set lives in the governance
  appendix and changes only by an Eye-signed transition; (c) a
  same-custody-class store outside GitHub (the Eye's local ceremony
  records signed under the Eye key) provides the recovery root if the
  platform store is ever suspect. `council_review[]` (the seats' HMAC
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
  self-validate because the variable only moves by admin action under the
  telos-authority-roots environment custody (the Eye, per the
  custody-drift oracle).
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
  — where "closure" means EVERY EXECUTABLE EDGE, not just the import
  graph: static imports AND child-process invocations (spawn/spawnSync/
  exec targets, npm-script bodies) are enumerated by the bootstrap
  tool's static analysis into the manifest (verify-contracts.mjs
  spawnSync-ing test-comprehension-gate.mjs is the live example — an
  unimported child a PR could swap for constant-success while the
  trusted parent's import closure is unchanged); every enumerated child
  is base-sourced/digest-checked exactly like its parent, and an edge
  the analyzer cannot resolve to a concrete tracked file (dynamic
  command construction) ⇒ FAIL `closure-unresolvable` at manifest build
  — fail closed, never a warning. Not a hand list. PR CI BASE-SOURCES these scripts exactly like
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
  CHILD-SCRIPT swap fixture — a PR replaces an unimported spawnSync
  child (test-comprehension-gate.mjs) with constant-success code, parent
  untouched ⇒ the child is base-sourced/digest-checked and the swap is
  caught; an npm-script-body swap is caught the same way; a dynamic
  spawn the analyzer cannot resolve ⇒ closure-unresolvable at manifest
  build; a main-context swap with an unmoved digest ⇒
  verdict-producer-untrusted. (3) RELEASE: the authoritative release verification is
  executed by the Eye LOCALLY per RELEASING.md from a tree verified
  against the protected chain root BEFORE signing the tag; CI re-runs it
  as defense-in-depth, not as the sole authority.
  (4) THE INVOKING WORKFLOW IS PROTECTED THE SAME WAY (a PR that edits
  the workflow to skip materialization and emit green defeats layers 1–3,
  and GitHub runs PR-modified workflows; org-level required workflows are
  unavailable to a personal repo, so enforcement sits in the merge path
  we control): the protected variable set gains `TRUSTED_WORKFLOW_DIGEST`
  — a CLOSED MANIFEST DIGEST over the ENTIRE execution surface, not a
  hand-picked file list (a digest over selected files stays unchanged
  when a PR ADDS a new push-triggered workflow or composite action —
  the addition must move the digest): the canonical sorted
  (path ‖ blob-digest) list of EVERY file under `.github/` (workflows,
  composite actions, Actions config), where the PATH SET itself is part
  of the digested serialization — adding, removing, or renaming any
  file changes the digest even if all covered files are untouched; the E1 MERGE CONTROLLER — the sole merger —
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
  digest ≠ TRUSTED_WORKFLOW_DIGEST, no transition record); ADDED-WORKFLOW
  fixture — a PR that only ADDS a new push-triggered workflow (or a new
  composite action) without touching any existing covered file ⇒ the
  manifest's path set moved ⇒ the controller refuses workflow-modified
  BEFORE merge, so the new privileged code never lands to execute;
  REMOTE EXECUTABLE BYTES ARE CONTENT-PINNED TOO (the manifest digest
  authenticates only repository-local .github bytes, but jobs execute
  remote action and tool code — actions/attest-build-provenance, syft —
  which could change while every local digest stands): the workflow-lint
  oracle REQUIRES every `uses:` reference to be a FULL 40-hex commit SHA
  (tag/branch refs ⇒ FAIL mutable-action-ref; a full-SHA pin is
  content-addressed by git semantics), and every DOWNLOADED tool (syft
  et al.) is fetched at a pinned version and its binary sha256 VERIFIED
  against a digest recorded in the workflow before execution
  (mismatch ⇒ abort tool-digest-mismatch); SUBSTITUTION regressions — a
  `uses:` edited to a tag ref ⇒ lint FAIL; a tool download whose digest
  differs from the recorded value ⇒ the job aborts before the tool
  runs; genesis
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
  malformed input). EXECUTION IS BASELINE-CONTROLLED IN ONE ENVIRONMENT
  (an oracle could otherwise ignore its governed inputs and key on the
  relocation itself — exit 0 in the repository, nonzero whenever cwd or
  repo metadata reveals a temp copy — passing an identical-argv test
  without detecting anything): run-oracles builds an IMMUTABLE TEMPLATE
  copy of the governed input set and executes BOTH cases AT THE SAME
  CANONICAL ABSOLUTE PATH with a controlled environment (two
  differently-named sandboxes would hand a pair-selective oracle a
  distinguishing signal in cwd/path alone): the baseline materializes a
  pristine clone at path P, runs the identical production invocation
  there, REQUIRES EXIT 0 (nonzero ⇒ FAIL
  `oracle-environment-sensitive`), then path P is DELETED ENTIRELY and
  recreated FRESH from the template (never reusing the baseline's
  files) with the validated mutation applied BEFORE any execution; the
  negative run executes the IDENTICAL invocation at the SAME path P —
  REQUIRED TO EXIT NONZERO, else FAIL `oracle-nondiscriminating`.
  ALL EXTERNAL MUTABLE STATE IS ISOLATED PER EXECUTION (path P alone is
  not enough — an oracle could key a marker under /tmp or a cache dir
  that survives between sequential runs): each execution receives
  FRESH, PRIVATE writable surfaces — per-run TMPDIR/HOME/
  XDG_CACHE_HOME pointed at scratch dirs created before and destroyed
  after that single execution — and MANDATORY bwrap confinement (the
  repo's existing evidence.mjs closed-whitelist verifier discipline;
  bwrap is already a doctor prerequisite): each execution gets an
  isolated mount namespace with private /tmp, /var/tmp, /dev/shm, a
  read-only view outside its sandbox, AND `--unshare-net`/
  `--unshare-pid` — no network (a remote counter or any external
  signal is unreachable) and no cross-run process signal; bwrap
  unavailable ⇒ FAIL `oracle-unrunnable` — confinement is never
  best-effort. The remaining nondeterministic channel (the clock) is
  causally controlled by an A-B-A' PROTOCOL: after the negative run,
  the BASELINE IS RE-RUN in a third pristine same-path sandbox and
  must exit 0 AGAIN — an oracle keying on any time-varying signal to
  produce the 0/nonzero pair will drift on the second baseline
  (nonzero ⇒ FAIL oracle-environment-sensitive), while a genuinely
  input-reading oracle passes all three trivially. Same argv, same entrypoint, same
  absolute path, same environment VARIABLES (equal names and shapes,
  pointing at per-run instances), no special mode; the only state
  observable in both executions is the governed input — the mutation is
  the only discriminable difference, by construction.
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
  argv, no flag exists to special-case); a RELOCATION-SENSITIVE,
  input-ignoring oracle (exit 0 in-repo, nonzero in any temp copy via
  cwd/.git detection) ⇒ FAILS oracle-environment-sensitive at the
  unmutated-sandbox baseline; a STATEFUL-MARKER oracle (exit 0 while
  planting a marker, nonzero when the marker exists) ⇒ FAILS — the
  negative runs in a fresh recreation that never saw the baseline, so
  the marker is absent and the run exits 0 ⇒ oracle-nondiscriminating;
  a PATH-SELECTIVE input-ignoring oracle (keying on cwd/sandbox path to
  behave differently between runs) ⇒ FAILS — both runs execute at the
  identical canonical path, so no path signal distinguishes them ⇒
  oracle-nondiscriminating; an EXTERNAL-MARKER oracle (planting a
  uniquely keyed marker under /tmp or a cache during baseline, keying
  on its presence in the negative) ⇒ FAILS — the negative run's
  TMPDIR/HOME/caches are fresh private instances, the marker is
  absent, the run exits 0 ⇒ oracle-nondiscriminating; a REMOTE-SIGNAL
  oracle (keying on an external incrementing counter) ⇒ the network is
  unshared, the signal is unreachable, behavior collapses to constant
  or error ⇒ caught by baseline or A-B-A'; a SYSV-IPC-MARKER oracle
  (shmget/semget marker planted in A, consumed in B, absent in A') ⇒
  each run has a private IPC namespace under --unshare-all, no segment
  crosses runs, the pair collapses ⇒ oracle-nondiscriminating; a CLOCK-THRESHOLD oracle
  (0 before time T, nonzero after) ⇒ the second baseline runs after T
  and exits nonzero ⇒ oracle-environment-sensitive; a
  present-but-timeout oracle ⇒
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
unchanged; exclude += the two dirs). Its lifecycle is TWO-PHASE —
AUTHORIZED AT BOOTSTRAP, ACTIVATED ATOMICALLY WITH THE DIRECTORIES IT
GOVERNS (pinning AM-43 into package-roots.json at the bootstrap head,
while cli/ and connectors/meta-ads-mcp/ do not yet exist and
inventory.mjs/test-inventory are deferred, would break the repository's
own exact-bijection inventory gates at that head): the BOOTSTRAP lands
the AM-43 doc + the council authorization + a
`CURRENT-AUTHORITY.amendments_in_force` entry marked `activation:
"deferred-to-implementation-slice"` — `package-roots.json` REMAINS on
its AM-42 pin, byte-unchanged, so every pre-existing verify-contracts
and test-inventory gate passes at the bootstrap head unchanged
(acceptance check: the bootstrap head itself runs those gates GREEN);
the later EXCLUDED-DIRS IMPLEMENTATION SLICE then atomically flips
`package-roots.json.authority.enrollment_ruling` → AM-43's sha, adds
both directories, and updates inventory.mjs + test-inventory + the
other coordinated surfaces + the same-PR re-weave in ONE PR, flipping
the registry entry to `activation: "active"`. AM-42's FILE is
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
  ruling — are scanned with a deliberately OVER-BROAD, CASE-INSENSITIVE
  matcher: any occurrence of `node(\.js|js)?` in ANY casing (Node, NODE,
  NodeJS, node.JS…), including identifier/config forms
  (`NODE_VERSION=18`, `node-version: 18`, `nodeVersion: 18`), within a
  short window of a version-looking token (`v?\d+(\.\d+)*`,
  `\^|~|>=|≥|\+|=|:|or later|and up`) is a HIT. Every hit must either normalize
  to a version >= 22.12 (a small tested normalizer handles the common
  grammars: "Node 18+", "NODE 18+", "Node.js 21+", "NODE_VERSION=18",
  "requires Node v20.11 or later", "Node ≥18") or appear in a reviewed inventory
  `docs/institutional-memory/product/node-version-claims.json` recording
  {file, line, matched_text, disposition} — dispositions form a CLOSED
  set with machine-checked preconditions: `third-party-dependency-
  metadata` (the hit is STRUCTURALLY a dependency entry's compatibility
  claim in PARSED lockfile/metadata — a `packages["node_modules/…"].
  engines` field in package-lock.json or a path under node_modules —
  which is a fact ABOUT a third-party package, not the product's
  runtime floor; rewriting it would falsify upstream metadata. The
  precondition is structural, not textual: the ROOT package's own
  engines entry in the same lockfile does NOT qualify and must comply,
  and prose can never use this disposition), `false-positive` (the text is
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
  `requires Node v20.11 or later`, a manifest `"node": "^20.0.0"`, AND
  the escape-form fixtures `NODE 18+`, `NODE_VERSION=18`,
  `node-version: 18`, `nodejs 20 and up` ALL fail (casing/separator
  variants are not escapes); a sub-22.12 claim added without an
  inventory entry fails; a stale inventory entry fails; a dependency's
  `engines.node: ">=18"` inside package-lock.json passes ONLY via the
  structural third-party-dependency-metadata disposition; the ROOT
  package's own lockfile engines below 22.12 CANNOT use it and fails; a
  prose claim attempting that disposition fails; the sweep is clean at
  slice end.
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
  the extracted root ⇒ fail. FULL VERIFICATION IN CLEAN ROOM (the
  offline subset alone would leave the Phase-1a verify claim
  undemonstrated — E2's git-object anchoring and the history-sensitive
  freshness digest need a git object database the tarball lacks):
  `pylae verify --full --bundle <path>` consumes the release's HISTORY
  BUNDLE asset — first verifying the bundle's digest against SHA256SUMS
  + its attestation (identity-pinned), then unbundling into a private
  temp object store, asserting its head equals
  RELEASE-IDENTITY.commit_sha, and running the COMPLETE battery. THE
  TRUST ROOTS ARE AN EXPLICIT OPERATOR INPUT, NEVER TREE-SUPPLIED (the
  Ed25519 acceptance is unverifiable without EYE_AUTHORITY_PUBKEY, and
  a pubkey read from the tarball or bundle would let the tree writer
  self-authorize): `--trust-root <manifest>` takes a TRUST-ROOT
  MANIFEST `{eye_authority_pubkey, authority_chain_root, custody
  statement, manifest_version}` obtained OUT-OF-BAND — canonically the
  repository's published trust page (served from the owner's GitHub
  origin, independent of any release artifact) or directly from the
  Eye — with the trust model stated honestly: first-fetch trust rests
  on the publishing origin's integrity (documented TOFU), and the CLI
  PINS the accepted manifest locally so every later verification
  compares against the stored root rather than re-trusting the
  network. Absent `--trust-root` (and no pinned manifest), `--full`
  FAILS `trust-root-missing` — it never falls back to values found in
  the tree, the bundle, or the release itself.
  (authority-chain anchoring via git cat-file against the bundle store,
  input-closure + input-history freshness digests, verify-contracts)
  from the extracted tree + bundle alone. **Accept**: clean-room job
  green from tarball + bundle + operator trust-root manifest running
  the FULL battery (not just --offline-checks); NO manifest and no pin
  ⇒ trust-root-missing (never green); a SUBSTITUTED pubkey planted
  inside the tarball or bundle ⇒ IGNORED (tree values are never
  consulted) and verification fails against the operator manifest; a
  manifest whose root disagrees with the pinned one ⇒ pin-mismatch
  surfaced, not silently replaced; a tampered bundle ⇒
  digest/attestation mismatch ⇒ refuse before any object is read; a
  bundle whose head ≠ the embedded commit_sha ⇒ fail identity-drift; clean-room job green from tarball
  alone in archive mode for the offline subset; tampered tracked payload ⇒ doctor fails
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
  additional_scanned_dirs mechanism + 5 META_* names. PERMANENT REQUIRED
  CI (blocker 4 names its absence; per-slice test execution protects
  nothing after the slice): the hermetic meta-ads suite joins the ci.yml
  package matrix as a NAMED job included in the branch-protection
  required-check set — every later change runs it. **Accept**: a fixture
  making one meta-ads test fail ⇒ the named required check goes red and
  (per the controller's producer-bound eligibility) blocks merge.

## 5. Freshness, release, deployment, flagship

- **Freshness (E-adjacent)**: freshness binding is INTRINSIC to
  authoritative verification, not an opt-in flag, and it is
  CONTENT-ADDRESSED, NOT COMMIT-ADDRESSED (council-ratified hard stop,
  authorization run 2: a HEAD-equality rule is self-referentially
  unsatisfiable for the atomic weave rule — the re-weave records input
  HEAD A, committing that evidence creates HEAD B, and no evidence can
  contain the SHA of the commit that contains it). The weave records a
  CANONICAL WOVEN-INPUT CLOSURE DIGEST: sha256 over the sorted
  (path ‖ blob-digest) list of EVERY woven input at weave time,
  EXCLUDING all generated weave-evidence paths — stable across the
  evidence commit by construction. HISTORY-SENSITIVE INPUTS ARE
  DIGESTED TOO (the git weaver emits history-derived facts —
  introduced-by/modified-in commit identities — so identical blobs over
  a rewritten/cherry-picked history are DIFFERENT weave inputs): the
  snapshot also records an `input_history_digest` — sha256 over the
  canonical serialization of exactly the history-derived facts the
  weaver consumes, per input path (path-limited history queries,
  identical to the weaver's own) — which is likewise stable across the
  evidence commit (an evidence-only commit touches no input path, so no
  input's path-limited history moves). Authoritative verification
  re-derives BOTH digests from the current checkout (tree + git
  history) and fails `input-closure-stale` / `input-history-stale`
  distinctly. `--verify-committed` BY DEFAULT
  requires (a) the same canonical digest RECOMPUTED over the CURRENT
  checkout's tree (same exclusions) == the snapshot's recorded
  input_closure_digest, (b) clean worktree, (c) full source_ref sweep
  (distinct fatal codes: input-closure-stale / worktree-dirty /
  source-ref-stale); a woven-input change without a re-weave ⇒
  input-closure-stale; a same-PR re-weave ⇒ digests match and PASS
  (evidence excluded, so committing it does not move the digest); a
  stale checkout ⇒ input-closure-stale — blocker 3 closed without the
  self-reference. The recorded input_repo_head remains as PROVENANCE
  metadata only, never a pass/fail criterion. The binding to the LIVE
  commit is EXTERNAL, per the check-evidence discipline: the
  authenticated required check-run (producer-bound, exact run id)
  attests which PR head / tag SHA the verification executed against —
  the commit identity lives in the attestation, not inside the
  committed evidence. Historical inspection is the explicit exception:
  `--verify-committed --historical` checks snapshot INTACTNESS only and is
  structurally non-authoritative — its JSON carries `verify_mode:
  "historical-nonauthoritative"` and `snapshot_intact: true/false`, and it
  NEVER emits the authoritative `verified_current: true` claim that
  default mode emits (consumers keying on the authoritative field cannot
  be satisfied by a historical run). Always-emitted freshness/input_closure_digest (heads recorded as provenance).
  CI IS MODE-SPLIT BY WHAT THE PR TOUCHES (a blanket historical PR check
  would let a woven-input PR merge with a stale-but-intact snapshot,
  gutting the atomic weave rule): the required institutional-memory PR job
  first diffs the PR against its base for WOVEN-INPUT paths, classified
  by UNION INPUT DISCOVERY over BOTH trees: each changed, added, or
  DELETED file is tested against the weaver's own input RULES
  (package-roots membership, memory-dir patterns, manifest globs — the
  same predicates weave.mjs uses to enumerate inputs) evaluated over the
  PR head AND over the base tree, and the union decides — proposed-tree
  discovery alone cannot see a DELETED woven file (it no longer exists
  there), just as the prior snapshot's closure cannot contain a NEWLY
  ADDED one; either blind spot would select historical mode and merge a
  stale snapshot; if ANY woven input changed, WAS ADDED, or WAS DELETED,
  the job runs the AUTHORITATIVE default
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
  have wrongly picked historical; DELETED-WOVEN-FILE regression: a PR
  that only deletes a previously woven input without a re-weave ⇒ the
  base-tree side of the union catches it, authoritative mode selected
  and red; a docs-only PR ⇒ historical mode selected.
  **Accept**: stale checkout (a woven input differs from the snapshot's
  closure) + default `--verify-committed` ⇒ fatal input-closure-stale; a
  fixture PR changing a woven input WITHOUT a re-weave ⇒
  input-closure-stale; the SAME PR carrying its re-weave ⇒ default mode
  PASSES at the PR head (the evidence commit does not move the closure
  digest — the run-2 paradox fixture, proven satisfiable);
  IDENTICAL-TREE/DIFFERENT-HISTORY regression: a rebuilt branch with
  byte-identical woven inputs but rewritten history (cherry-picked/
  squashed input commits) ⇒ input-history-stale — blob equality alone
  never passes; same checkout
  with `--historical` ⇒ exit 0 with verify_mode
  historical-nonauthoritative and NO verified_current field; release
  head ⇒ default mode green with the commit identity carried by the
  producer-bound check-run attestation.
- **Signed release pipeline** `release.yml`, fail-closed end to end.
  THE WORKFLOW DEFINITION ITSELF IS PLATFORM-SELECTED FROM PROTECTED
  MAIN (GitHub loads a push-triggered workflow from the triggering
  event's own commit — so a tag pushed at an off-main commit would
  execute a SUBSTITUTED release.yml with publication permissions,
  OIDC, and secrets before any in-workflow check could refuse): there
  is NO tag-push trigger at all; release.yml runs ONLY on
  `workflow_dispatch` from `main` per RELEASING.md, the tag NAME a
  dispatch INPUT — pure data, validated by the gate job before anything
  privileged; every privileged job declares `needs: gate`. An
  in-workflow ref check is NOT the defense (an off-main dispatch
  executes the OFF-MAIN definition, which simply omits the check and
  self-grants permissions) — the defense is that NOTHING a substituted
  definition can reach is privileged, enforced by the PLATFORM, not by
  the workflow's own text:
  (a) CREDENTIALS ARE ENVIRONMENT-GATED: all release-capable secrets
  live in the telos-authority-release ENVIRONMENT (public roots in
  telos-authority-roots per the custody definition) whose
  deployment branch policy admits ONLY protected main — a job from any
  other ref requesting that environment is refused by GitHub before it
  starts; the repository DEFAULT GITHUB_TOKEN permission is read-only.
  (b) TAGS ARE RULESET-PROTECTED OVER EVERY NAMESPACE: a tag ruleset
  restricts creation/update/deletion of ALL tags (`**`, not just `v*` —
  a `v*`-only rule would leave any other name free to back a rogue
  release, since creating a release with a nonexistent tag_name creates
  that tag) to the Eye alone (no bot, no Actions principal, and NOT the
  controller/publisher installations — their contents:write serves
  branch pushes; tag creation is never in their capability set) — so no
  machine or workflow credential can mint or move ANY tag, which means
  none can create a publishable release under any name; releases are
  immutable once published. NON-V* regression: a listed
  controller/publisher credential attempts `gh release create
  x-malicious` ⇒ the all-tags ruleset refuses the tag ref creation and
  the release cannot be published — refused server-side, not swept
  after exposure.
  (b2) MAIN HAS PUSH RESTRICTIONS EXCLUDING ACTIONS PRINCIPALS,
  IMPLEMENTED AS SPLIT RULESETS (one ruleset cannot both restrict
  actors and enforce checks without contradiction — ruleset update
  restrictions admit only bypass actors, so a single combined ruleset
  would force the controller to be a bypass actor of its own safety
  checks): (α) the SAFETY ruleset carries strict required status checks
  + up-to-date enforcement with an EMPTY bypass_actors list — it binds
  EVERYONE, the Eye and controller included, and E1's non-bypass
  precondition is scoped to exactly this class: the controller must be
  absent from the bypass list of every ruleset that enforces checks;
  (β) the ACTOR-RESTRICTION ruleset restricts update/push on main with
  bypass_actors = {Eye, merge-controller} — membership here grants
  OPERABILITY (permission to be the one who merges) and no check
  bypass whatsoever, because (α) still applies to them; the
  github-actions principal appears in neither list, so a rogue
  workflow's write-scoped token is refused by the server on ANY push
  or merge to main — the merge endpoint cannot be reached around the
  controller regardless of what permissions the workflow file
  requests. The custody oracle distinguishes ruleset classes by RULE
  CONTENT (a ruleset containing required-check rules with any bypass
  actor ⇒ unsafe-merge-environment; the controller present only in
  pure actor-restriction bypass lists ⇒ compliant). SPLIT-RULESET
  regressions: the controller merges an eligible PR (β operability)
  while a stale-base PR is still refused BY THE SERVER for the
  controller itself (α binds it); a config where the controller
  appears in a check-enforcing ruleset's bypass list ⇒ startup
  refusal. Draft mutation by such a token is covered by
  (iv): the pre-flip re-verification catches ANY asset/body change and
  aborts+deletes rather than publishing — fail-closed, nothing
  unverified goes public. Regressions: a workflow token with
  self-granted contents:write attempting the merge PUT ⇒ server
  refusal (push restriction); the same token swapping a draft asset ⇒
  the pre-flip re-check aborts the ceremony.
  (c) ARTIFACT TRUST IS IDENTITY-PINNED: provenance attestations are
  verified — in CI and in the documented consumer instructions — with
  the certificate identity pinned to `release.yml@refs/heads/main`; an
  artifact attested by a substituted off-main definition carries an
  off-main identity and FAILS verification everywhere it is checked.
  (d) DRIFT IS SWEPT AND THE TAG-RELEASE BINDING IS EXACT: a
  release-integrity oracle on main enumerates all releases AND all
  tags and fails unless they are in exact bijection — every existing
  tag bound to an accepted immutable release carrying a valid
  acceptance ASSET (publishing against an already-existing tag needs
  no ref creation, so the ruleset alone cannot stop it; the invariant
  that no unbound tag ever exists — tags are born at publish with
  their slot occupied — removes that surface, and this oracle proves
  it continuously).
  (e) RELEASE MUTATION IS EYE-LOCAL, THE TAG IS BORN AT PUBLISH, AND
  THE WRITER SET IS CLOSED — no workflow publishes, and no v* tag ever
  exists unpublished (the previous atomic-create design was
  unimplementable: `gh release create` cannot mint a signed annotated
  tag, and tag-first ordering reopens the pre-draft window; the
  mechanism is therefore restructured): (i) the Eye's LOCAL ceremony
  creates the DRAFT naming tag vX + target <accepted-commit> while NO
  tag ref exists — a draft stores the name+target without creating the
  ref, and a rogue cannot PUBLISH any v* release because publication
  must create the tag ref, which the all-tags ruleset denies to every
  non-Eye principal; (ii) the Eye's identity binding is the Ed25519
  RELEASE-ACCEPTANCE (over release_commit ‖ plan_ref, verified against
  EYE_AUTHORITY_PUBKEY), carried in the release BODY — this SUPERSEDES
  the annotated-signed-tag requirement (recorded explicitly: git
  tag-signing cannot compose with draft-first atomicity on this
  platform; Ed25519-against-protected-key is the stronger and
  verifiable-everywhere binding); the tag ref is created BY the publish
  flip at the accepted target and immediately frozen by the ruleset
  (no update/delete) + release immutability; (iii) the WRITER SET IS
  CLOSED BY THE CUSTODY INVARIANT: the custody-drift oracle fails on
  ANY writer of any class beyond the recorded CUSTODY MANIFEST, and the
  local ceremony REFUSES TO RUN (`custody-drift`) while any
  non-custodial writer exists, so the rogue-write-collaborator premise
  is excluded, not raced. THE CUSTODY SET IS A MANIFEST, NOT "THE EYE
  ALONE" (E1's controller and publisher are required to be non-Eye,
  non-admin writing principals — a bare Eye-only set would make every
  ceremony fail the moment E1 becomes operable): an Eye-signed CUSTODY
  MANIFEST enumerates exactly (a) the Eye (owner/admin), (b) the
  merge-controller principal, and (c) the branch-publisher principal —
  each machine principal a GITHUB APP INSTALLATION (chosen over PATs
  so the release ceremony can platform-suspend them — see (iv)) with an
  EXACT LEAST-PRIVILEGE permission set recorded per principal — the publisher:
  contents:write + pull_requests:write (opening a PR requires PR write;
  contents alone cannot), the controller: contents:write +
  pull_requests:write (the merge endpoint) + checks:read — and nothing
  else (no administration, no environments, excluded from every ruleset
  bypass list, no v* tag capability), each scope set RECORDED in the
  manifest and VERIFIED live by the custody oracle (a
  listed principal whose live scopes exceed the recorded bounds ⇒
  custody-drift exactly like an unlisted writer); the manifest changes
  only via Eye-signed transition. Custody regressions: manifest-listed
  controller/publisher ⇒ NO drift (E1 operable); unlisted writer ⇒
  drift; listed principal with escalated live scopes ⇒ drift; (iv) the
  publish flip runs inside a PLATFORM-ENFORCED EXCLUSIVE INTERVAL — a
  re-check "immediately before" the flip is two API calls with a
  mutable gap, so the gap itself is removed: the ceremony (1) DISABLES
  GitHub Actions repo-wide (admin API, `enabled: false`) and confirms
  no workflow run is in flight, and SUSPENDS the controller/publisher
  machine principals — which are GITHUB APP INSTALLATIONS precisely so
  suspension is a PLATFORM control (a PAT cannot be suspended via API;
  "offline custody" is not machine-verifiable): the ceremony suspends
  each installation (PUT .../suspended), VERIFIES `suspended_at` is
  set, and PROVES denial by attempting a release-read/mutation with
  each suspended credential and requiring the platform's 403 BEFORE
  the final check; (2) runs the final asset-set + digest + body
  verification against the bound release ID; (3) flips `draft: false`
  — during (1)-(3) NO Actions token exists and every non-Eye
  release-capable credential is PLATFORM-SUSPENDED with denial proven,
  so nothing can mutate the draft between verification and flip;
  (4) POST-PUBLISH re-verification asserts
  allowlist+digests+attestations against the now-immutable release;
  (5) only after (4) passes are the installations UNSUSPENDED and
  Actions re-enabled (rotation instead of unsuspension if any anomaly
  was observed). FROZEN-INTERVAL regression: a
  mutation attempted on the bound release ID after the last pre-flip
  check (stub: workflow dispatch and API mutation during the interval)
  ⇒ platform-refused (Actions disabled, no live credential) and any
  simulated drift observed at step (2) or (4) ⇒ publication
  refused/aborted — never published around.
  NO Actions workflow performs any release mutation, and default
  GITHUB_TOKEN permissions are read-only (a default, not a ceiling —
  the plan does not claim otherwise).
  **Accept (workflow trust)**: off-main-tag regression — a tag whose
  target commit carries a modified release.yml is pushed ⇒ NOTHING
  triggers (no push trigger exists); SUBSTITUTED-DEFINITION regression —
  a dispatch of a modified definition from a non-main ref that
  self-grants `contents: write` + `id-token: write` ⇒ the
  telos-authority-release environment refuses the ref (no release
  secrets; the readable public roots grant no capability), the all-tags ruleset refuses tag creation, and any
  artifact it attests fails pinned-identity verification — no trusted
  release mutation is possible; RELEASE-ID BINDING regression (drafts do NOT reserve a tag name —
  GitHub permits multiple same-tag drafts, so tag-addressed operations
  are ambiguous): the ceremony captures the NUMERIC RELEASE ID returned
  at draft creation, binds it to the accepted target + signed body, and
  performs EVERY subsequent operation (view/upload/verify/flip/delete)
  BY ID, never by tag name; fixture: a competing same-tag draft is
  planted and the ceremony's operations verifiably touch only the bound
  ID (the competitor cannot publish — tag-ref creation is Eye-only under the all-tags ruleset — and
  is reported by the release-integrity sweep); NO-WORKFLOW-PUBLISH
  assertion — the workflow-lint oracle fails any Actions job containing
  a release create/publish/edit operation; dispatching main's
  definition with a hostile tag name as input ⇒ the gate evaluates it
  as data and aborts.
  (1) GATE — identity by Ed25519 ACCEPTANCE, tag frozen by ruleset (the
  earlier annotated-signed-tag mechanism is SUPERSEDED, recorded
  explicitly: git tag-signing cannot compose with draft-first atomicity
  on this platform — see (e); RELEASE_SIGNER_FINGERPRINT and the GPG
  keyring drop out of the design, their custody class inherited by
  EYE_AUTHORITY_PUBKEY): THE RELEASE TARGET MUST BE THE EXACT ACCEPTED
  COMMIT, and the acceptance is NON-SELF-REFERENTIAL and externally
  anchored — the RELEASE-ACCEPTANCE record `{release_commit, plan_ref,
  eye_acceptance: Ed25519 over (release_commit ‖ plan_ref)}` is an
  IMMUTABLE ALLOWLISTED ASSET (`RELEASE-ACCEPTANCE.json`, digested in
  SHA256SUMS and attested like every artifact; release immutability
  freezes ASSETS, while the release BODY remains PATCHable even on
  published immutable releases — so the body is only a
  NON-AUTHORITATIVE POINTER and no verifier ever reads authority from
  it). SEQUENCING (the asset cannot exist before the build that the
  gate precedes): the canonical record travels as an AUTHENTICATED
  DISPATCH INPUT — the Eye passes the canonicalized acceptance JSON as
  a workflow_dispatch input, the GATE verifies its Ed25519 signature
  directly from that input (never from the body; a body-only
  acceptance ⇒ refuse `acceptance-not-authenticated`), and the
  ceremony later uploads the byte-identical record as the immutable
  asset with the post-publish check asserting asset ==
  dispatched-input digest. Verified against the protected
  EYE_AUTHORITY_PUBKEY (telos-authority-roots custody; not in the
  tree — an in-tree record cannot name the very commit its own addition
  creates, and mutable main cannot key authority). The gate requires
  (a) the block's release_commit == the draft's target (and, once
  published, the tag ref's actual target) EXACTLY, (b) plan_ref == the
  pivoted active_plan under the trusted authority chain, (c) the target
  is an ancestor of protected main AND `github.sha == release_commit`
  EXACTLY (attest-build-provenance derives its SLSA source digest from
  the WORKFLOW-RUN context — building an older accepted SHA from a
  newer main would attest the wrong source; the ceremony dispatches
  while main's head IS the accepted commit, else abort
  `workflow-source-mismatch` and re-accept after the head settles), and
  (d) the all-tags ruleset is in force (creation Eye-only, no
  update/delete) with release immutability enabled — any mismatch ⇒
  abort `tag-not-accepted-commit`; pubkey unset ⇒ abort fail-closed.
  MAIN-AHEAD regression: main advanced past release_commit at dispatch
  ⇒ gate aborts workflow-source-mismatch before build; provenance
  verification asserts the attested source digest EQUALS
  release_commit. SUBSTITUTION tests: a release body reused
  for a different target ⇒ release_commit ≠ target ⇒ abort; a forged
  block without the Eye's key ⇒ eye_acceptance invalid ⇒ abort.
  Required-CI check-run asserted at the tag SHA with
  the SAME producer binding (authenticated Actions app + trusted workflow
  digest + exact run id — never name-only; untrusted same-name collision
  fixture must fail the gate); local
  verify battery incl. authoritative `--verify-committed`
  (content-addressed input-closure binding by default).
  (2) BUILD, reproducibility covering THE ARTIFACT OPERATORS INSTALL (the
  final source tarball is `git archive` + injected generated files, so
  "deterministic by construction" no longer holds and must be re-established
  over the assembled result), and the build NEVER references the tag (no
  v* ref exists until the publish flip — the build's identity source is
  the DRAFT'S FROZEN Eye-accepted target commit SHA, read from the
  acceptance block): the assembly is fully specified — `git archive`
  <accepted-target-SHA>; inject RELEASE-IDENTITY.json + generated
  files; repack with pinned metadata (`tar --sort=name --owner=0
  --group=0 --numeric-owner --mtime=@<accepted-target-commit-timestamp>
  --mode=go=rX,u=rwX` piped through `gzip -n`) so every nondeterministic
  tar/gzip field — INCLUDING MEMBER PERMISSIONS, which otherwise vary
  with the build umask (extraction + injected-file modes are
  umask-dependent and recorded by tar) — is fixed by the accepted
  commit, while git's executable-bit and symlink semantics are
  preserved (the mode normalization keeps u+x where git records it via
  rwX); every artifact identity, check-run
  assertion, and attestation binds to that frozen SHA; tag-ref
  verification is deferred to POST-PUBLICATION (the flip creates the
  ref at that same target, then post-publish verification asserts ref
  target == accepted SHA). The ENTIRE assembly
  (and `npm pack` of the cli) runs TWICE from scratch and the final
  artifact digests are byte-compared — any mismatch aborts, and any
  irreducible nondeterminism must be recorded in RELEASING.md before
  release. SHA256SUMS; syft SBOM; `actions/attest-build-provenance` per
  artifact; PLUS a HISTORY BUNDLE asset (`<version>-history.bundle`, a
  `git bundle` of the qualified history up to the accepted target —
  digested in SHA256SUMS and attested like every other asset) so
  archive-mode installs can verify the full authority chain (below).
  **Accept**: double-build digests equal for BOTH the cli tgz and
  the assembled source tarball; a fixture varying mtime/owner in the
  repack ⇒ digest mismatch ⇒ abort; UMASK regression — the same source
  built under two distinct umasks (e.g. 022 and 077) ⇒ IDENTICAL final
  tarball bytes (mode normalization proven, not assumed); NO-TAG
  regression — the entire
  gate/build/upload sequence runs with `git rev-parse v<version>`
  failing throughout (ref absent until flip), every artifact bound to
  the frozen accepted SHA.
  (3) PUBLISH fail-closed, DRAFT-FIRST, EYE-LOCAL (checking after public
  upload is not fail-closed — an extra or unattested asset must never be
  downloadable — and per (e) no Actions job performs any release
  mutation): the draft already exists from the Eye-local ID-bound
  create (no tag ref yet); the trusted workflow verifies the build and uploads
  NOTHING to the release — it emits artifacts + attestations as
  workflow outputs; the Eye's LOCAL ceremony uploads assets to the
  DRAFT BY ITS BOUND RELEASE ID, then runs the CLOSED ALLOWLIST check (`gh release view --json
  assets` must equal the literal expected filename set EXACTLY —
  missing or EXTRA assets ⇒ fail) and `gh attestation verify` per asset
  (unattested ⇒ fail, identity pinned to release.yml@refs/heads/main);
  ONLY after both pass does the Eye perform the single final operation —
  flipping the draft to published; any failure deletes the draft, so
  nothing unverified is ever public. **Accept**: planted extra asset ⇒
  draft deleted, release never published; all-green ⇒ publish flip is
  the last logged step of the local ceremony.
  RELEASING.md ceremony (Eye-local: custody check → draft with
  Ed25519-signed acceptance body → dispatch trusted verification →
  asset upload → allowlist+attestation checks → publish flip; tag
  ruleset + release-immutability Setting prerequisites; correction
  process — first application: v0.2.0 4,558→4,559). **Accept**: a
  release with no valid Eye acceptance block ⇒ gate aborts;
  NONACCEPTED-SHA fixture — a draft targeting a commit with green CI
  but NO Eye-signed release-acceptance ⇒ gate aborts
  tag-not-accepted-commit (CI validity is not acceptance);
  POST-PUBLISH BODY-MUTATION fixture — an unsuspended machine App
  PATCHes the published release body ⇒ the acceptance ASSET is
  untouched (immutable), verification unaffected, sweep flags the body
  drift; EXISTING-TAG fixture — a machine credential attempts release
  create against an existing bound tag ⇒ refused (slot occupied), and
  the bijection oracle catches any unbound-tag state; planted
  extra asset ⇒ publish check fails; every published artifact passes
  `gh attestation verify` (identity pinned).
- **Pages provenance**, tightly bound: ci.yml uploads artifact
  `demo-${{ github.sha }}` only on main pushes after required-ci; pages.yml
  converts to `workflow_run` and the deploy job REQUIRES ALL OF:
  `workflow_run.conclusion == 'success'`, `workflow_run.event == 'push'`,
  `workflow_run.head_branch == 'main'`; downloads by that exact
  `workflow_run.id` and asserts the artifact name embeds
  `workflow_run.head_sha` before deploying. The deployed payload REMAINS
  `demo/` AND the FLAGSHIP BUILD, deployed as an EXPLICITLY LABELED
  DEMONSTRATION/EVIDENCE-VIEWER (frozen blocker 8 includes "flagship
  never deployed" — deferral would leave the blocker open; PD-003's
  Chromium boundary bounds the QUALIFICATION claim, not deployment):
  both ride the same required-CI exact-SHA artifact path, the flagship
  page carries the PD-003 demonstration label + qualified-browser
  notice, and the provenance regressions cover both artifacts. **Accept**: a PR-triggered or
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
