# Design: Deterministic Production Profile Compiler

**Date:** 2026-07-20

**Status:** Written design candidate. The Eye approved the architectural direction and research scope in
this session and directed that the change traverse the TELOS process and govern TELOS itself before
enrollment. This revised document still requires written-spec review. It grants no implementation
authority.

**Target:** TELOS `build-gate` proposal lifecycle and `merkle-dag` obligation mechanism

**Decision prefix:** `PPC`

## Authority boundary

The active repository authorization is `authz-008`, bound to the completed Clotho v15 plan. It does not
authorize this work. This document is a quest-entry design artifact created from The Eye's direction.
Before implementation, this design must be reviewed, entered through Iliad pre-review and its entry
ritual, matured into a file-specific plan through Daedalus, authorized by TELOS against the exact matured
plan hash, and passed into Argo through the comprehension gate. The resulting implementation must then
complete the reference-documentation, Clotho, and Iliad-retrospective stages before enrollment.

Two gates are intentionally distinct. The currently enrolled TELOS spine governs creation of the
compiler candidate. Once that candidate exists, the candidate must run a real self-hosting production
profile proposal against TELOS before the quest can complete. The self-hosting run is acceptance and
enrollment evidence; it is not retroactive authority to create the compiler.

The production profile is controller input. Models may advise on it, but models do not author the
effective profile, choose its policy, remove obligations, select substitute checks, or declare that a
required control is not applicable.

## Problem

AI builders are good at visible application code and happy-path behavior. They are not reliable owners of
the production envelope: identity, tenant isolation, payments, recovery, observability, privacy, supply
chain, and the authority and data boundaries of AI itself. A prose checklist does not fix that failure.
A model can omit the checklist, weaken a test, or rationalize a difficult requirement as unnecessary.

TELOS already has the enforcement primitives the solution needs:

- the controller can derive data outside model jurisdiction;
- verification obligations are content-addressed and registered in tests;
- obligations and lifecycle metadata are included in `plan_hash`;
- the proposal gate can reconstruct and re-check plan state; and
- `done()` refuses to settle an undischarged obligation.

What is missing is a deterministic requirements compiler upstream of plan construction.

## Purpose

The Production Profile Compiler is a pure, deterministic controller:

```text
compile(dossier production input, observed repository facts, pinned policy)
  -> compiled production profile
  -> fixed production obligations
  -> controller-minted verification nodes
```

Its output forces the invisible production work into the same Merkle plan as feature work. Changing a
production fact, policy rule, check contract, or obligation changes the authorized plan. Missing evidence
leaves an obligation undischarged and the build blocked.

The feature is not a universal compliance checklist and is not an AI reviewer. It is a jurisdiction
boundary: facts and policy select obligations; models implement the work demanded by those obligations.

## Research basis

The catalog is informed by real incidents, official findings, and published vulnerabilities. These
sources motivate control families; they do not automatically create legal requirements for a host.

| Case | Evidence class | Production failure represented |
|---|---|---|
| Community Bank unauthorized AI application disclosure (2026) | Company SEC filing | Non-public customer data, including names, Social Security numbers, and dates of birth, handled through an unauthorized AI application |
| Samsung generative-AI restriction (2023) | Reported company incident and company statement | Employees sending internal material to an external AI service without an approved data boundary |
| March 20 ChatGPT outage (2023) | Provider incident disclosure | Cross-user cache isolation failure exposing chat and limited payment-related information |
| DeepSeek PIPC examination (2025) | Regulator examination | Undisclosed cross-border transfers, unnecessary user-input transfer, training use, retention, and transparency gaps |
| Microsoft storage SAS exposure (2023) | Vendor security disclosure | Over-permissive artifact-sharing token exposing internal data while publishing AI research assets |
| EchoLeak, CVE-2025-32711 | Confirmed vulnerability; no breach claim | Indirect prompt injection causing limited data exfiltration under specific conditions |
| Everalbum settlement (2021) | FTC allegations and settlement | Retention promises not honored and derived embeddings/models requiring deletion |
| Replit database deletion report (2025) | Reported product incident with company response | Agent write authority, production-data mutation, failed stop controls, and recovery dependence |
| *Mata v. Avianca* (2023) | Court order | Generated legal authorities accepted without source verification |
| NYC MyCity audit (2025) | Government audit | Public chatbot responses that were inaccurate or inconsistent |
| Rite Aid facial-recognition action (2023) | FTC allegations and proposed order | Automated identification deployed without reasonable testing, monitoring, or safeguards |
| iTutorGroup settlement (2023) | EEOC lawsuit and settlement | Automated hiring software rejecting applicants based on age thresholds |
| Hong Kong deepfake fraud cases (2024) | Government and police report | Impersonated executives authorizing high-value payments without out-of-band confirmation |
| Snap My AI investigation (2024) | Regulator investigation conclusion | Data-protection risk assessment completed only after regulator intervention |
| SEC AI-washing cases (2024) | SEC enforcement settlements | Public claims about AI capabilities not supported by the represented reality |

The initial policy also uses the control vocabulary of the NIST Generative AI Profile, the OWASP Top 10
for LLM Applications, and GAO work on generative-AI inventory and management. TELOS does not claim
conformance with any of them.

## Design decisions

| ID | Decision |
|---|---|
| `PPC-D01` | Use a deterministic compiler, not a model-authored checklist. |
| `PPC-D02` | Run the compiler before the Workstream DAG is authorized. Production obligations are fixed inputs to planning, not workshop suggestions. |
| `PPC-D03` | Reuse native Merkle obligations and `done()` discharge, while adding a typed production-policy source. |
| `PPC-D04` | Bind the full compiled profile, policy, evidence configuration, and obligation set into plan lifecycle metadata. |
| `PPC-D05` | Use obligation-local profile and evidence projections so only affected verification nodes change, while any compiled-profile change still changes global `plan_hash`. |
| `PPC-D06` | Repository observations may add risk or require classification; they may never suppress a dossier declaration or remove an obligation. |
| `PPC-D07` | Keep a closed, repository-owned check registry. A model cannot supply commands, interpreters, paths that escape the host, environment variables, or shell fragments. |
| `PPC-D08` | Separate runtime, structural, and process evidence and state the strength of each. Presence of configuration is not proof that a recovery or scaling claim works. |
| `PPC-D09` | Ship one built-in, pinned policy in version 1. Preserve a content-addressed extension seam, but do not load remote or third-party policy packs. |
| `PPC-D10` | Fail closed on unknown schema versions, unknown policy operators, unregistered check kinds, incomplete profile facts, unresolved scanner signals, stale compiled output, or unavailable required evidence adapters. |
| `PPC-D11` | Enforce the profile through the proposal lifecycle. Market-bound builds and explicit production-profile builds must enter that lifecycle; legacy non-market builds remain unchanged. |
| `PPC-D12` | Store and reconstruct the production input from controller-written proposal artifacts. Durable resume may not depend on an in-memory dossier object. |
| `PPC-D13` | Re-run classification after implementation and before final settlement. New repository facts introduced by the build can invalidate the plan. |
| `PPC-D14` | Use synthetic data and loopback-only services in all shipped demonstrations. No real personal data or live AI provider is permitted. |
| `PPC-D15` | Add a versioned policy certificate rather than silently changing the meaning of the existing closed `POLICY_CONTRACT_V1`. |
| `PPC-D16` | Make TELOS the first non-synthetic host governed by the compiler. The candidate may not be enrolled or described as dogfooded until TELOS's controller-authored self-profile passes the same compiler, policy, registry, proposal gate, post-build re-scan, obligation discharge, and settlement path used by host repositories. |

## Rejected alternatives

### A universal prose checklist

Rejected because neither applicability nor completion is mechanically bound to the plan. A model can
omit an item, mark it complete without evidence, or describe a compensating control that does not exist.

### Model-selected applicability

Rejected because the same builder that benefits from a smaller scope would decide which hard work can be
skipped. The dossier supplies controller-trusted facts; deterministic rules derive the obligations.

### Letting each model write its own verification command

Rejected because a no-op, irrelevant, or self-fulfilling command can pass. Production checks come from a
closed registry and are re-resolved by the gate.

### Treating all repository text matches as facts

Rejected because source-code token scans have false positives and cannot safely decide business
semantics. Structured observations may escalate directly. Textual signals require explicit controller
classification and block until resolved.

### Dynamic policy downloads

Rejected for the first version because they add supply-chain, availability, and version-selection risk to
the trust root. The policy is local, content-addressed, and reviewed with TELOS.

### Claiming legal or standards compliance

Rejected. The compiler can prove that specified checks ran against specified artifacts. It cannot decide
which laws apply, provide legal advice, certify an organization, or prove real-world operational
effectiveness from repository evidence alone.

## Scope

Version 1 covers eleven production domains:

1. identity and authentication;
2. authorization and tenant isolation;
3. payments and billing;
4. data integrity and persistence;
5. scalability, performance, and rate limiting;
6. observability and incident response;
7. CI/CD, environments, rollback, and feature flags;
8. availability, backups, and disaster recovery;
9. privacy, retention, deletion, and regulatory evidence;
10. third-party integrations and software supply chain; and
11. AI use, data egress, agent authority, output provenance, and consequential decisions.

The first implementation includes the compiler, policy catalog, check-contract extensions, proposal and
settlement integration, negative fixtures, a synthetic bank-style demonstration, and a TELOS
first-host self-profile run through the actual proposal lifecycle.

## Non-goals

- No autonomous legal classification.
- No certification of GDPR, CCPA, HIPAA, SOC 2, PCI DSS, banking regulation, or any other regime.
- No remote policy marketplace or package loader.
- No live production penetration testing.
- No external AI calls in tests or demonstrations.
- No storage of customer data, API keys, access tokens, or real credentials in profile artifacts.
- No general Terraform, HCL, or YAML parser in version 1. Unsupported infrastructure formats require a
  separately reviewed, registry-owned normalizer; otherwise the obligation remains blocked.
- No claim that replica counts, backup schedules, runbooks, or signed records prove that an operational
  system will meet its objectives.
- No replacement for threat modeling, architecture review, human risk ownership, or incident exercises.
- No change to the byte identity of existing obligation-free or legacy-obligation plans.

## Load-bearing invariants

### `PPC-I01` — deterministic output

The same canonical production input, semantic repository facts, policy bytes, and registry bytes must
produce byte-identical compiled output on Node.js 18 and Node.js 20, independent of filesystem traversal
order, JSON object key order, locale, host path separator, or wall-clock time.

### `PPC-I02` — monotonic applicability

Observed facts can union data classes, raise ordered exposure or capability floors, or block for
classification. No observation or model output can lower a controller declaration.

### `PPC-I03` — complete source reconciliation

Every plan obligation must reconcile to exactly one source:

- a reconstructed review concern for a legacy obligation; or
- an exact production-policy source emitted by the compiler for a version 2 obligation.

An orphan, duplicate, cross-bound source, unknown source kind, or source that matches both sets blocks the
proposal gate. The existing “unmatched obligation is inert” behavior is removed.

### `PPC-I04` — exact obligation set

For a production-enforced plan, the sorted set of production obligation source references in
`plan.obligations` must equal the compiler's sorted expected set. Missing, extra, or semantically mutated
production obligations block.

### `PPC-I05` — executable binding

The gate re-resolves every production check from the current registry and requires:

```text
stored check_contract_ref
  == hash(current kind, canonical params, current registry implementation_ref)

deriveExecutableRef(discharge_node.test)
  == deriveExecutableRef(current registry resolution)
```

A passing no-op, alternate script, changed working directory, or stale registry implementation cannot
discharge the obligation.

### `PPC-I06` — full plan binding

The plan hash covers the compiled-profile reference, policy reference, semantic repository-facts
reference, evidence-configuration reference, production-input reference, obligation-set reference,
production obligations, their discharge tests, and lifecycle metadata.

### `PPC-I07` — post-build invalidation

Immediately before final settlement, the controller re-runs the compiler against final repository state.
If the expected profile or obligations differ from the authorized plan, no node settlement can turn the
build green. The result is `BLOCKED_PROFILE_DRIFT`, followed by a new planning revision.

### `PPC-I08` — no self-exemption

There is no `"n/a"`, `"unknown-but-accepted"`, free-text waiver, or model-authored skip field in the
profile or policy. Closed values such as `"none"` are factual declarations and remain subject to
repository contradiction checks.

### `PPC-I09` — evidence strength is explicit

Every obligation declares exactly one evidence tier: `runtime`, `structural`, or `process`. Reports and
documentation must not describe a weaker tier as proving a stronger claim.

### `PPC-I10` — fail-closed portability

Required host adapters are explicit. A fresh host with no adapter receives a typed blocking finding; the
compiler never silently drops an obligation because TELOS-specific files are absent.

### `PPC-I11` — no privileged self path

TELOS's self-profile is ordinary production input. It uses the same schema, built-in policy bytes, check
registry, source records, proposal reconstruction, post-build scanner, and settlement checks as any
other host. No repository-name condition, TELOS-only waiver, reduced catalog, fixture-only registry,
pre-recorded success, direct ledger insertion, or alternate settlement path may make the self-run pass.
The existing `build-gate/examples/self/` packet-gate fixture is useful prior evidence, but it does not
satisfy this invariant unless it is migrated through the production-profile proposal lifecycle.

## End-to-end architecture

```text
human/controller dossier
  |
  | canonical production input artifact
  v
profile validation ---- repository fact scanner ---- pinned policy + check registry
          \                    |                       /
           \                   |                      /
            +------ deterministic compiler ----------+
                              |
                 compiled profile + fixed obligations
                              |
          +-------------------+-------------------+
          |                                       |
          v                                       v
  workshop receives fixed context       controller mints verify nodes
          |                                       |
          +--------------- final tasks -----------+
                              |
                      Merkle plan compiler
                              |
                   plan_hash + policy certificate
                              |
              proposal gate re-runs and reconciles
                              |
                         authorized build
                              |
                final repository fact re-scan
                              |
              profile drift? -- yes --> BLOCKED
                    |
                    no
                    v
               ledger gate + done()
                    |
        any obligation undischarged? --> BLOCKED
```

## Activation rule

The compiler is mandatory when any of these are true:

- `dossier.proposal_lifecycle === true`;
- `dossier.market_bound === true`; or
- either `dossier.production_profile` or `dossier.production_evidence` is present.

If activation is required and `proposal_lifecycle !== true`, the gate returns
`PROPOSAL_LIFECYCLE_REQUIRED`; production enforcement has no weaker legacy path. If activation is
required and the profile is absent, the gate also returns `PROFILE_REQUIRED`. A legacy non-market build
with all three conditions false retains its existing behavior and reports
`production_profile_evaluated: false`.

This boundary preserves old local workflows without giving a model a skip switch: the dossier and build
mode are controller inputs, not planning-seat output.

## Production input contract

The production input is the canonical projection:

```json
{
  "build_context": {
    "proposal_lifecycle": true,
    "market_bound": true
  },
  "production_profile": {
    "profile_version": 1,
    "exposure": "external",
    "users": "customers",
    "identity": "federated",
    "tenancy": "multi-tenant",
    "authorization": "role-and-resource",
    "payments": "subscription",
    "persistence": "durable",
    "data_classification": [
      "public",
      "personal",
      "highly-sensitive"
    ],
    "data_residency": [
      "us"
    ],
    "retention_and_deletion": {
      "mode": "fixed",
      "days": 365,
      "derived_data": "delete-with-source",
      "legal_hold": false
    },
    "availability_and_recovery": {
      "service_level": "continuous",
      "rpo_minutes": 60,
      "rto_minutes": 240
    },
    "peak_traffic": {
      "requests_per_minute": 1000,
      "burst_multiplier": 3
    },
    "integrations": [
      {
        "id": "payment-processor",
        "purpose": "payment-processing",
        "direction": "bidirectional",
        "data_classification": [
          "personal"
        ],
        "processing_regions": [
          "us"
        ],
        "authentication": "signed-webhook",
        "criticality": "high"
      }
    ],
    "ai": {
      "enabled": true,
      "role": "agentic",
      "providers": [
        {
          "id": "approved-provider",
          "purposes": [
            "inference"
          ],
          "external": true,
          "processing_regions": [
            "us"
          ],
          "input_retention": "bounded",
          "training_use": "disabled"
        }
      ],
      "data_classification": [
        "personal",
        "highly-sensitive"
      ],
      "external_egress": true,
      "rag_sources": "tenant-scoped",
      "can_write": true,
      "can_execute": false,
      "can_transact": false,
      "trains_on_user_data": false,
      "consequential_domains": [
        "none"
      ],
      "user_populations": [
        "adult-general"
      ]
    },
    "signal_resolutions": []
  },
  "production_evidence": {
    "runtime": {
      "kind": "loopback-http-v1",
      "base_url": "http://127.0.0.1:43119",
      "health_path": "/health",
      "manifest_path": "test/production/runtime-adapter.json"
    },
    "structural_artifacts": [
      "deploy/production-controls.json"
    ],
    "process_keyring": ".telos/evidence-keys.json",
    "process_records": [
      "evidence/restore-drill.json",
      "evidence/incident-route.json"
    ]
  }
}
```

### Closed profile values

| Field | Allowed values or rule |
|---|---|
| `build_context.proposal_lifecycle` | boolean copied from the controller dossier |
| `build_context.market_bound` | boolean copied from the controller dossier |
| `profile_version` | integer `1` |
| `exposure` | `local-only`, `internal`, `external` |
| `users` | `single-operator`, `workforce`, `customers`, `public` |
| `identity` | `none`, `local`, `federated` |
| `tenancy` | `single-tenant`, `multi-tenant` |
| `authorization` | `none`, `role-based`, `role-and-resource`, `policy-based` |
| `payments` | `none`, `one-time`, `subscription`, `money-movement` |
| `persistence` | `none`, `ephemeral`, `durable` |
| `data_classification[]` | set of `public`, `internal`, `confidential`, `personal`, `highly-sensitive`, `regulated` |
| `data_residency[]` | non-empty set of lowercase region identifiers matching `^[a-z0-9][a-z0-9._-]{0,31}$` |
| `retention_and_deletion.mode` | `none`, `fixed` |
| `retention_and_deletion.days` | `null` only for `none`; otherwise integer `1..36500` |
| `retention_and_deletion.derived_data` | `not-created`, `retain-separately`, `delete-with-source` |
| `retention_and_deletion.legal_hold` | boolean declaring whether an authorized hold can suspend normal deletion |
| `availability_and_recovery.service_level` | `best-effort`, `business-hours`, `continuous` |
| `rpo_minutes`, `rto_minutes` | `null` for best-effort; otherwise integers `0..525600` |
| `requests_per_minute` | integer `0..100000000`; `0` is valid only for `local-only` |
| `burst_multiplier` | integer `1..1000` |
| integration `id` and provider `id` | lowercase identifier matching `^[a-z0-9][a-z0-9._-]{0,63}$` |
| integration `purpose` | lowercase identifier using the integration/provider identifier rule |
| provider `purposes[]` | non-empty set of `inference`, `embedding`, `moderation`, `training`, `other` |
| integration/provider `processing_regions[]` | non-empty set using the `data_residency` identifier rule |
| integration `direction` | `inbound`, `outbound`, `bidirectional` |
| integration `authentication` | `none`, `api-key`, `oauth`, `mtls`, `signed-webhook`, `other` |
| integration `criticality` | `low`, `medium`, `high` |
| `ai.role` | `none`, `internal-assistant`, `customer-facing`, `agentic`, `decisioning` |
| provider `input_retention` | `none`, `bounded`, `provider-default` |
| provider `training_use` | `disabled`, `opt-out`, `enabled` |
| `ai.rag_sources` | `none`, `curated-internal`, `tenant-scoped`, `external-untrusted`, `mixed` |
| `ai.consequential_domains[]` | set of `none`, `employment`, `credit`, `housing`, `education`, `health`, `insurance`, `legal`, `public-benefits`, `financial-transaction` |
| `ai.user_populations[]` | set of `adult-general`, `children`, `employees`, `patients`, `applicants`, `customers`, `public` |

All objects use `additionalProperties: false`. Set-like arrays are deduplicated and sorted before hashing.
Empty sets are invalid. `"none"` is exclusive when it is an allowed set member. The compiled profile is
the closed `build_context` plus the effective fields of `production_profile`; policy JSON Pointers are
resolved against that flattened compiled object. Cross-field rules include:

- `ai.enabled: false` requires role `none`, no providers, no egress, no RAG, no authority flags,
  `trains_on_user_data: false`, and consequential domains `["none"]`;
- `ai.enabled: true` requires a non-`none` role and at least one provider;
- `ai.can_transact: true` requires `ai.can_write: true`;
- AI data classes and integration data classes must be subsets of top-level `data_classification`;
- an external AI provider requires `ai.external_egress: true`;
- non-`none` payments require durable persistence;
- non-`none` payments require at least one integration whose purpose is `payment-processing`;
- multi-tenancy requires non-`none` identity and authorization;
- fixed retention requires `days`; and
- evidence paths must be safe repository-relative paths.

The input rejects secret-shaped fields and values. Provider credentials, tokens, account identifiers,
real tenant tokens, and personal-data samples are forbidden.

### Signal-resolution shape

Each `signal_resolutions` entry is exactly:

```json
{
  "signal_ref": "sha256:...",
  "resolution": "confirmed",
  "rationale": "Controller-confirmed use of the provider SDK."
}
```

`resolution` is `confirmed` or `false-positive`; `signal_ref` must match one current scanner signal; and
`rationale` is a non-empty string of at most 500 characters. Duplicate and stale references fail.

### Production-evidence shape

`production_evidence` is also closed:

| Field | Contract |
|---|---|
| `runtime.kind` | `none` or `loopback-http-v1` |
| `runtime.base_url` | `null` for `none`; otherwise literal `http://127.0.0.1:<port>` or `http://[::1]:<port>` |
| `runtime.health_path` | `null` for `none`; otherwise an absolute URL path with no scheme, authority, query, fragment, or dot segment |
| `runtime.manifest_path` | `null` for `none`; otherwise a safe repository-relative JSON path |
| `structural_artifacts[]` | deduplicated safe repository-relative JSON paths; empty is allowed |
| `process_keyring` | `null` when no process evidence is required; otherwise a controller-owned safe path to an Ed25519 public-key ring |
| `process_records[]` | deduplicated safe repository-relative JSON paths; empty is allowed |

The runtime manifest uses `runtime_adapter_version: 1` and maps a closed semantic operation name to an
HTTP method, path, bounded synthetic fixture references, and selected request-field bindings. It cannot
declare expected outcomes. The initial operation set is `authenticate`, `authorize`, `tenant-read`,
`tenant-write`, `payment-apply`, `webhook-receive`, `data-mutate`, `delete-source`, `integration-send`,
`ai-invoke`, `egress-observer`, `audit-read`, `provider-failure`, and `kill-switch`. Unknown operations,
commands, scripts, external URLs, and expected-result fields fail. Policy rules own expected status,
state transition, and denial semantics. Duplicate operation mappings fail.

The process keyring has a closed versioned schema and public JWK values only. Its canonical bytes are
included in `evidence_config_ref`. If a triggered obligation requires a tier for which no suitable
adapter, target path, or keyring is configured, compilation returns `EVIDENCE_ADAPTER_REQUIRED`; the
obligation is never omitted. A configured structural or process target may be absent before the build
because producing it can be plan work. The trust anchor and check configuration must already exist; the
evidence itself must exist and verify before discharge.

## Controller artifact and durable reconstruction

Before any workshop or model call, the controller:

1. projects and validates the production input;
2. canonicalizes it;
3. writes it through the proposal artifact store;
4. records its artifact reference in the proposal ledger; and
5. places `production_input_ref` in plan lifecycle metadata.

The proposal gate and post-build verifier read that artifact from disk. Caller-supplied mutable profile
state is never accepted as a substitute during re-verification.

## Repository fact scanner

The scanner is zero-dependency, read-only, network-free, and deterministic.

### Semantic fact record

```json
{
  "facts_version": 1,
  "facts": [
    {
      "fact_id": "sha256:...",
      "kind": "ai-runtime-dependency",
      "value": "approved-provider-sdk",
      "confidence": "confirmed",
      "evidence": [
        {
          "path": "package.json",
          "locator": "/dependencies/provider-sdk"
        }
      ]
    }
  ],
  "signals": []
}
```

`fact_id` hashes `kind`, canonical `value`, and sorted semantic locators. Diagnostic file hashes may be
reported, but unrelated byte changes do not change a semantic fact reference.

### Confirmed observations

Only bounded, structured observations can directly raise the effective profile:

- exact dependency names in JSON package manifests;
- exact provider, payment, auth, database, or telemetry configuration keys in registered JSON formats;
- exact CI workflow and lockfile presence;
- exact controller-owned production manifest fields; and
- exact files or fields generated by a registry-owned normalizer whose implementation reference is
  pinned.

The policy owns every detector and mapping. Unknown dependency names do not silently acquire semantics.

### Classification signals

Bounded text scans may identify:

- imports of AI, payment, database, identity, or cloud clients;
- provider API hostnames;
- tool/function-calling declarations;
- vector-store or retrieval declarations;
- public chatbot routes;
- training or fine-tuning jobs; and
- likely personal-data, health, employment, credit, payment, or public-benefit surfaces.

These are signals, not facts. An unresolved signal returns `CLASSIFICATION_REQUIRED` and exit `2`.
A controller can add a `signal_resolutions` entry containing the exact signal reference, one of
`confirmed` or `false-positive`, and a non-empty rationale. The resolution is included in
`production_input_ref` and `profile_ref`. Models cannot emit or alter it during planning.

### Traversal and limits

- Traverse normalized relative paths in lexical order.
- Reject symlinks or junctions that leave the repository.
- Skip `.git/`, `node_modules/`, `.telos/`, known dependency caches, and binary files.
- Read only registered file extensions and manifests.
- Cap one file at 10 MiB and total scanned bytes at 256 MiB.
- A required file that changes while being read, exceeds a limit, or cannot be read produces a
  cannot-run result; partial facts are never accepted.
- No ignore file supplied by the host can suppress a policy-registered detector.

## Fact reconciliation

The compiler applies field-specific monotonic joins:

- data classes and capabilities use set union;
- `local-only < internal < external`;
- `single-tenant < multi-tenant`;
- `none < ephemeral < durable`;
- `single-operator < workforce < customers < public`; and
- boolean capabilities can rise from false to true but never fall.

Non-ordered contradictions block. Examples include two incompatible runtime-adapter kinds, a declared
provider inventory that excludes a confirmed provider, or a signal resolution that does not match a
current signal reference.

Every escalation is emitted as a structured finding and included in the compiled profile. The compiler
never edits the dossier.

## Policy contract

The built-in policy is canonical JSON:

```json
{
  "policy_version": 1,
  "policy_id": "telos-production-baseline",
  "detectors": [],
  "obligations": [
    {
      "obligation_id": "AI-EGRESS-001",
      "domain": "ai-use-and-data-egress",
      "when": {
        "all": [
          {
            "eq": [
              "/ai/enabled",
              true
            ]
          },
          {
            "eq": [
              "/ai/external_egress",
              true
            ]
          }
        ]
      },
      "profile_projection": [
        "/ai/enabled",
        "/ai/external_egress",
        "/ai/data_classification",
        "/ai/providers"
      ],
      "evidence_projection": [
        "/runtime"
      ],
      "evidence_tier": "runtime",
      "check": {
        "kind": "production-ai-egress-v1",
        "params_template": {
          "profile_projection": "$profile",
          "runtime": "$evidence"
        }
      },
      "required_result": "pass"
    }
  ]
}
```

The condition language is data, not executable code. Its closed operators are `all`, `any`, `not`, `eq`,
`contains`, `intersects`, `gte`, and `lte`. Paths are JSON Pointers into the compiled profile. Unknown
operators, fields, templates, versions, duplicate IDs, or invalid projections fail policy loading.

Parameter templates allow only whole-value sentinels `$profile`, `$evidence`, and `$obligation_id`.
The compiler recursively replaces those values with the rule's canonical projections or stable ID and
then canonicalizes the result into `params_json`. Partial string interpolation, environment expansion,
and host-supplied expected results are forbidden.

Each obligation rule has:

- one globally unique stable ID matching `^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-[0-9]{3}$`;
- one of the eleven closed domains;
- a deterministic trigger;
- an explicit profile projection;
- an explicit evidence projection;
- one evidence tier;
- one registered check kind; and
- required result exactly `"pass"`.

The full `policy_ref` is the SHA-256 content address of canonical policy JSON. Each rule also has a
`rule_ref` over its own canonical body. A policy-catalog change always changes global `plan_hash`; an
unrelated rule change does not rewrite every verification node.

## Reference derivation

In this document, `H(value)` means `"sha256:" + sha256hex(canonicalize(value))`. References are:

```text
production_input_ref = H(canonical production-input projection)
profile_ref = H({ compiler_contract, compiled_profile })
repo_facts_ref = H({ facts_version, sorted semantic facts, sorted resolved signals })
policy_ref = H(canonical policy JSON)
registry_ref = H(sorted [{ kind, contract_version, parameter_schema_ref, implementation_ref }])
process_keyring_ref = H(canonical public-key ring), or null
evidence_config_ref = H({ canonical production_evidence, process_keyring_ref })
obligation_set_ref = H(sorted production source_ref values)
```

`parameter_schema_ref` hashes the closed parameter schema and value-guard contract for that kind, not
only an implementation template. Any change to accepted parameters, path rules, limits, or result
semantics changes the registry reference.

## Production obligation source

The compiler emits one source record for every triggered rule:

```json
{
  "record_type": "production-policy-obligation",
  "source_version": 1,
  "obligation_id": "AI-EGRESS-001",
  "domain": "ai-use-and-data-egress",
  "rule_ref": "sha256:...",
  "profile_projection_ref": "sha256:...",
  "evidence_projection_ref": "sha256:...",
  "check_contract_ref": "sha256:...",
  "required_result": "pass",
  "source_ref": "sha256:..."
}
```

`source_ref` is:

```text
H({
  record_type: "production-policy-obligation",
  source_version: 1,
  obligation_id,
  domain,
  rule_ref,
  profile_projection_ref,
  evidence_projection_ref,
  check_contract_ref,
  required_result
})
```

The sorted set of complete source records is written into the compiled-profile artifact.
`obligation_set_ref` hashes the sorted array of `source_ref` values.

## Native obligation version 2

Current native obligations assume every source is a review `concern_ref`. Production policy is not a
model concern and must not be disguised as one.

Version 2 adds an explicit source:

```json
{
  "obligation_version": 2,
  "obligation_id": "AI-EGRESS-001",
  "obligation_ref": "sha256:...",
  "source_kind": "production-policy",
  "source_ref": "sha256:...",
  "discharge_node_id": "verify-production-ai-egress-001",
  "discharge_test_ref": "sha256:...",
  "check_contract_ref": "sha256:...",
  "required_result": "pass"
}
```

Its semantic identity is:

```text
H({
  obligation_version: 2,
  obligation_id,
  source_kind,
  source_ref,
  required_result,
  check_contract_ref
})
```

Initial version 2 accepts only `source_kind: "production-policy"`. An unknown version or source kind
fails compilation and recomputation.

Legacy obligations omit `obligation_version`, retain `concern_ref`, and use the exact existing four-field
hash preimage. Existing plan bytes therefore recompute identically. The proposal gate becomes stricter:
an unmatched legacy concern obligation now blocks instead of remaining inert.

## Verification node construction

For each production obligation, the controller creates:

```text
node id: verify-production-<lowercase obligation_id>
writes: []
reads: policy-derived evidence paths
requirements: exact obligation id, domain, source_ref, and evidence tier
test: current registry resolution
dependencies: every non-verification task in the candidate, plus any explicit evidence producers
```

Stable obligation IDs give stable node IDs across profile revisions. Changing relevant profile facts,
evidence configuration, rule semantics, or registry implementation changes the test, `verifies` list,
node `spec_hash`, effective hash, obligation reference, and plan hash.

Production nodes are controller-minted after the workshop. A workshop candidate containing a
`verify-production-*` node is rejected as a reserved identifier collision.

## Compiled profile artifact

Successful compilation emits canonical JSON:

```json
{
  "compiler_contract": "telos-production-profile-v1",
  "production_input_ref": "sha256:...",
  "profile_ref": "sha256:...",
  "repo_facts_ref": "sha256:...",
  "policy_ref": "sha256:...",
  "registry_ref": "sha256:...",
  "evidence_config_ref": "sha256:...",
  "obligation_set_ref": "sha256:...",
  "compiled_profile": {},
  "repo_facts": {},
  "production_sources": [],
  "findings": []
}
```

There are no timestamps, absolute paths, hostnames other than the declared loopback adapter, random
identifiers, environment-derived defaults, or secret values in the semantic artifact.

The artifact is stored both at a content-addressed proposal-artifact path and as the current controller
view under `.telos/production-profile.json`. `.telos/` remains runtime state and is not committed.

## Plan lifecycle binding

Production-enforced plans extend lifecycle metadata with:

```json
{
  "production_profile": {
    "compiler_contract": "telos-production-profile-v1",
    "production_input_ref": "sha256:...",
    "profile_ref": "sha256:...",
    "repo_facts_ref": "sha256:...",
    "policy_ref": "sha256:...",
    "registry_ref": "sha256:...",
    "evidence_config_ref": "sha256:...",
    "obligation_set_ref": "sha256:...",
    "compiled_artifact_ref": "sha256:..."
  }
}
```

`normalizeLifecycle()` must retain, validate, canonicalize, and hash this closed object. A lifecycle
object containing only some production fields is invalid. A plan with production version 2 obligations
and no production lifecycle object is invalid; a production lifecycle object with no production
obligations is valid only when the compiler's exact expected set is empty.

## Proposal lifecycle integration

The proposal controller performs this sequence:

1. Evaluate the activation rule.
2. Store the canonical production input artifact.
3. Scan the pre-build repository.
4. Compile the profile and fixed production sources.
5. Stop before model calls on any blocking or cannot-run result.
6. Give the workshop a read-only summary of obligations and evidence contracts.
7. Reject workshop output that edits, shadows, or reserves production verification identities.
8. Reconstruct review verification requests from the proposal ledger.
9. Mint review verification nodes and production verification nodes independently.
10. Compile the combined task graph, both obligation classes, and production lifecycle metadata.
11. Record the candidate.
12. Re-run the compiler in the proposal gate from disk artifacts.
13. Require exact lifecycle references, source sets, obligation sets, check contracts, and executables.
14. Issue a version 2 policy certificate only when all closed checks pass.
15. Re-run the compiler after implementation and immediately before final settlement.

Review concerns may add obligations but cannot remove or replace production obligations. If a review
concern asks for a stronger production check, both obligations remain unless the controller-owned policy
is changed and the plan is re-authorized.

## Policy certificate version 2

`POLICY_CONTRACT_V1` remains valid for legacy plans. A production-enforced plan requires
`POLICY_CONTRACT_V2`, whose closed check keys add:

```text
production_profile
```

Its reference is:

```text
H({
  version: 2,
  checks: sort(POLICY_CHECK_KEYS_V1 + ["production_profile"]),
  finding_classes: sort(FINDING_CLASSES_V1)
})
```

The allowed `n/a` set remains exactly the version 1 set. `production_profile` is never `n/a` in a
version 2 certificate.

The value is `pass` or `fail`, never `n/a`, for an activated build. A version 1 certificate cannot
authorize a plan containing a production lifecycle object or version 2 obligation.

The `production_profile` check covers:

- input artifact reconstruction;
- profile, policy, registry, evidence, and semantic fact references;
- exact production source and obligation sets;
- source-to-obligation reconciliation;
- check-contract and executable re-resolution.

The authorization certificate attests to pre-build state. It is necessary but not sufficient for final
settlement. The settlement verifier re-runs the same production-profile contract against final disk
state and records a separate pass/fail result; it never edits or backdates the authorization certificate.

## Check-contract version 2

Legacy review checks retain the current hash:

```text
H({ kind, params_json })
```

Production checks use:

```text
H({
  check_contract_version: 2,
  kind,
  params_json,
  implementation_ref
})
```

`implementation_ref` is derived by the registry from the exact registered implementation and contract
version; callers cannot supply it. Version 1 uses self-contained registry templates. A later
registry-owned module must include its exact source bytes in `implementation_ref`.

The gate recomputes this reference from the current registry. A registry implementation change therefore
invalidates stale plans even if `kind` and parameters did not change.

### Closed production check kinds

| Kind | Tier | Contract |
|---|---|---|
| `production-loopback-http-v1` | runtime | Run a bounded request/response scenario against literal loopback; assert status, selected headers, and bounded JSON fields |
| `production-auth-boundary-v1` | runtime | Prove missing, malformed, expired, and wrong-scope credentials are denied |
| `production-tenant-isolation-v1` | runtime | Seed synthetic tenants and prove each cannot read or mutate the other's object |
| `production-rate-limit-v1` | runtime | Send a policy-derived bounded sequence and require the first over-limit request to receive the configured denial status |
| `production-webhook-v1` | runtime | Prove bad signature, stale timestamp, and replay are denied while one valid synthetic event is accepted exactly once |
| `production-ai-egress-v1` | runtime | Send a synthetic sensitive marker through the host and prove disallowed provider egress is blocked before network transmission |
| `production-json-assertions-v1` | structural | Parse bounded JSON and evaluate a closed list of JSON-Pointer assertions |
| `production-record-v1` | process | Verify closed schema, source hashes, signer, freshness window, and required outcome for an evidence record |

No kind accepts `cmd`, `command`, `script`, `exec`, `eval`, `args`, `argv`, `cwd`, `env`, `shell`,
interpreter selection, or an external URL. Repository target paths must remain physically under the host
root. Runtime URLs must use literal `127.0.0.1` or `[::1]`; redirects, proxies, DNS names, and Unix socket
escapes are denied.

Each check has fixed limits on requests, body bytes, file bytes, redirects, and elapsed time. An exceeded
limit is cannot-run, not pass.

### Check process exit codes

- `0`: required result proved by the registered check;
- `1`: assertion ran and failed;
- `2`: check could not run safely or its input was invalid.

The ledger gate treats every non-zero status as failed. Structured detail preserves the distinction.

## Evidence tiers

### Runtime

Runtime checks exercise application behavior through a controller-owned protocol. Examples include
tenant isolation, access denial, rate limiting, webhook replay defense, and AI data-egress blocking.

The host must expose a deterministic loopback test adapter and synthetic fixture setup. The adapter is
declared in controller input and hash-bound. Its manifest maps TELOS's closed semantic operations to host
routes but cannot choose expected results. If an operation required by a triggered obligation is absent,
the adapter is unavailable, or the route does not exercise the application, the obligation remains
undischarged. TELOS does not fall back to source inspection.

### Structural

Structural checks inspect actual machine-readable artifacts such as JSON deployment exports, schemas,
CI contracts, policy manifests, and lockfiles. They can prove that specific fields and relationships
exist in the artifact. They do not prove that an external platform applied the configuration or that the
configuration meets an operational objective.

Version 1 reads JSON directly. Terraform, HCL, YAML, provider APIs, and proprietary formats require a
registry-owned normalizer producing canonical JSON with source hashes. No normalizer means blocked.
Normalized production-control artifacts use `production_controls_version: 1`; each control is keyed by
the obligation ID and carries exact source paths and source content hashes. The policy owns assertions;
the artifact cannot declare what outcome should count as pass. Exactly one matching control entry may
exist across the configured artifacts for each triggered structural obligation; zero or duplicates fail.

### Process

Process checks validate signed, content-addressed evidence records for activities that should not run in
every CI loop, such as restore drills, incident routes, privacy deletion exercises, and load tests. A
record must identify source artifacts, result, executing identity, exact check contract, and freshness
window. The signer must resolve to a public key in the controller-owned process keyring.

A process record uses `production_evidence_record_version: 1`, names one obligation ID, and binds its
result to exact plan, source, check-contract, and executing-build references. A prose runbook, unsigned
declaration, record for another plan, or record outside the policy freshness window cannot discharge a
process obligation. Multiple records may preserve history, but two current records for the same plan,
obligation, and check contract with conflicting results fail rather than selecting the favorable one.

## Version 1 obligation catalog

The policy uses the following stable baseline IDs. Trigger expressions refer to the effective compiled
profile after monotonic repository reconciliation.

| ID | Trigger | Tier | Check kind | Required evidence |
|---|---|---|---|---|
| `AUTHN-001` | `identity != none` | runtime | `production-auth-boundary-v1` | Missing, malformed, and expired credentials are denied |
| `AUTHN-002` | `exposure == external && identity != none` | runtime | `production-auth-boundary-v1` | Session or token scope cannot cross the declared privilege boundary |
| `AUTHZ-001` | authorization is non-`none` or users are not `single-operator` | runtime | `production-auth-boundary-v1` | An authenticated but unauthorized actor is denied by default |
| `AUTHZ-002` | `tenancy == multi-tenant` | runtime | `production-tenant-isolation-v1` | Synthetic cross-tenant reads and writes are denied |
| `PAY-001` | `payments != none` | runtime | `production-loopback-http-v1` | Repeated synthetic operations are idempotent and do not double-settle |
| `PAY-002` | any integration uses `signed-webhook` | runtime | `production-webhook-v1` | Invalid signature, stale timestamp, and replay are denied; one valid event applies once |
| `DATA-001` | `persistence == durable` | runtime | `production-loopback-http-v1` | Required constraints and atomic mutation survive the policy scenario |
| `DATA-002` | `persistence == durable` | structural | `production-json-assertions-v1` | Forward migration and rollback declarations bind to exact schema artifacts |
| `SCALE-001` | `exposure == external` | runtime | `production-rate-limit-v1` | The first request beyond the policy threshold is denied |
| `SCALE-002` | requests per minute `>= 1000` or service level `continuous` | process | `production-record-v1` | A fresh signed load result is bound to the authorized build and latency/error budget |
| `OBS-001` | exposure is not local-only or AI is enabled | runtime | `production-loopback-http-v1` | Required audit events are emitted with sensitive fields redacted |
| `OBS-002` | service level is not best-effort | process | `production-record-v1` | A fresh signed alert-route record names the incident owner and exercised route |
| `DELIVERY-001` | exposure is not local-only | structural | `production-json-assertions-v1` | CI covers test, build, environment separation, and immutable artifact identity |
| `DELIVERY-002` | exposure is external or service level is continuous | structural | `production-json-assertions-v1` | Rollback and feature-disable controls bind to the deployed artifact |
| `RECOVERY-001` | `persistence == durable` | structural | `production-json-assertions-v1` | Backup schedule and protected-copy declarations exist in exact machine artifacts |
| `RECOVERY-002` | durable persistence and a non-best-effort service level | process | `production-record-v1` | A fresh signed restore drill meets the declared RPO/RTO |
| `PRIV-001` | data includes personal, highly-sensitive, or regulated | runtime | `production-loopback-http-v1` | Retention expiry deletes source data; an authorized active hold suspends deletion without becoming permanent retention |
| `PRIV-002` | derived data is created from personal, highly-sensitive, or regulated data | process | `production-record-v1` | A signed deletion exercise covers required embeddings, indexes, caches, training sets, and derived models |
| `PRIV-003` | an integration/provider processes relevant data outside `data_residency`, or outbound transfer carries personal data | structural | `production-json-assertions-v1` | Provider/subprocessor inventory binds regions, data classes, purpose, and transfer mechanism |
| `SUPPLY-001` | one or more third-party integrations or confirmed dependencies | structural | `production-json-assertions-v1` | Lock, integrity, secret-scan, and approved-source fields resolve to exact artifacts |
| `SUPPLY-002` | outbound or bidirectional integration | runtime | `production-loopback-http-v1` | The integration authenticates and transmits no data class beyond its declaration |
| `AI-PROVIDER-001` | `ai.enabled == true` | structural | `production-json-assertions-v1` | Approved-provider inventory covers purpose, regions, retention, training use, and external status |
| `AI-EGRESS-001` | `ai.external_egress == true` | runtime | `production-ai-egress-v1` | Synthetic sensitive data is denied unless the class and provider are both allowed |
| `AI-TENANT-001` | AI enabled and tenancy is multi-tenant | runtime | `production-tenant-isolation-v1` | Prompts, retrieval, caches, and outputs remain tenant-scoped |
| `AI-RAG-001` | RAG source is external-untrusted or mixed | runtime | `production-loopback-http-v1` | Indirect instructions cannot override authority, data, or tool boundaries; source provenance remains |
| `AI-TOOL-001` | AI can write, execute, or transact | runtime | `production-loopback-http-v1` | Tool allowlist, least privilege, dry-run, and required confirmation/transaction boundaries pass |
| `AI-LINEAGE-001` | AI is customer-facing, agentic, decisioning, or uses user data | runtime | `production-loopback-http-v1` | A redacted event binds input class, context sources, provider/model, tools, output, and disposition |
| `AI-OUTPUT-001` | AI is customer-facing or decisioning | process | `production-record-v1` | A fresh eval covers groundedness/accuracy, unsafe fallback, and disclosed limitations |
| `AI-DECISION-001` | consequential domains is not `["none"]` | process | `production-record-v1` | Human review, reason, appeal, and protected-class fixture results are signed and current |
| `AI-OPS-001` | AI is customer-facing, agentic, or decisioning | runtime | `production-loopback-http-v1` | Provider failure, monitoring signal, kill switch, and safe fallback pass |
| `AI-CLAIM-001` | `build_context.market_bound == true && ai.enabled == true` | structural | `production-json-assertions-v1` | Every public AI capability claim resolves to an executable evidence reference |

Policy rules may trigger more than one obligation from the same fact. That is intentional: preventing
external egress, deleting derived data, and proving a public claim are separate duties.

## AI-specific control semantics

### Provider and egress

The approved provider inventory is explicit. An observed provider absent from that inventory requires
classification. Provider-default retention, opt-out or enabled training use, or highly-sensitive
external egress raises the strictest applicable obligations. `AI-EGRESS-001` proves the block before any
real network boundary; it does not send the marker to an external service.

`ai.trains_on_user_data` describes training, fine-tuning, or adaptation controlled by the host.
`provider.training_use` separately describes the external provider's treatment of submitted inputs.
Neither field substitutes for the other.

### Retrieval and prompt injection

Untrusted retrieved content remains data, never authority. The runtime fixture includes benign content,
direct malicious instructions, indirect instructions embedded in a document, and cross-tenant canaries.
Passing requires source provenance and no protected action or disclosure.

### Agent authority

`can_write`, `can_execute`, and `can_transact` are separate capability facts. Write authority requires
scoped targets and rollback. Execution requires a closed tool allowlist and bounded environment.
Transactions require an out-of-band human confirmation or an independently authorized deterministic
policy. Model confidence is never authorization.

### Outputs and consequential use

Customer-facing and consequential outputs require reproducible eval evidence, limitation disclosure,
safe fallback, and provenance. Consequential domains additionally require a human review and appeal path.
These checks verify the declared mechanism and fixtures; they do not prove absence of bias or universal
accuracy.

### AI claims

Public claims such as “AI-powered fraud detection,” “fully autonomous,” or “compliant AI” must resolve to
specific evidence references. A marketing string alone cannot pass. This is an engineering truthfulness
control, not SEC compliance certification.

## Dynamic invalidation

Consider an initial profile:

```text
local-only + single-operator + single-tenant + unpaid
public/internal data + no durable persistence + AI disabled
```

It compiles a small or empty production obligation set.

If The Eye later changes it to:

```text
external + customers + multi-tenant + subscription
personal/highly-sensitive data + durable persistence
AI agent with external provider egress and write authority
```

the compiler adds authentication, authorization, tenant, payment, persistence, scaling, observability,
delivery, recovery, privacy, supply-chain, and AI obligations. The following all change:

- `production_input_ref`;
- `profile_ref`;
- `evidence_config_ref` when adapters are added;
- `obligation_set_ref`;
- affected obligation and verification-node hashes; and
- global `plan_hash`.

The old policy certificate and authorization are stale. Missing verification nodes or evidence block
before merge.

An unrelated profile field does not change an obligation's local projection or node hash. The full
profile reference still changes global `plan_hash`, making authorization honest while preserving
localized node lineage.

## Post-build fact drift

Repository observations before planning describe the existing host. A greenfield build may introduce a
new provider, database, public route, payment client, or agent capability. Therefore:

1. the pre-plan compiler establishes baseline obligations;
2. the final scanner runs against built artifacts;
3. newly confirmed facts are joined into the effective profile;
4. a changed profile or expected obligation set returns `BLOCKED_PROFILE_DRIFT`; and
5. the next revision recompiles the plan with the new obligations before further settlement.

The system never lets “the code was not present when we planned” become an exemption.

## CLI and machine contract

The implementation exposes one zero-dependency CLI:

```text
node build-gate/production-profile/cli.mjs compile \
  --dossier <repo-relative-json> \
  --repo <repository-root> \
  --out <repo-relative-json>

node build-gate/production-profile/cli.mjs verify \
  --input-artifact <repo-relative-json> \
  --compiled-artifact <repo-relative-json> \
  --repo <repository-root>
```

There are no positional aliases and no implicit current-directory dossier. `--repo` may be absolute at
the process boundary, but all semantic output paths are normalized relative to it.

### Compiler exit codes

- `0`: compilation or verification succeeded;
- `2`: deterministic blocking findings, including invalid/incomplete profile, unresolved signals,
  contradictions, unsupported evidence, or drift;
- `1`: cannot run safely, including I/O failure, traversal escape, changed-during-read input, malformed
  built-in policy, registry failure, or internal error.

On failure, no output file is replaced. The CLI writes a canonical JSON report to stdout and one concise
human line to stderr.

Each finding carries `severity: "advisory" | "blocker" | "cannot-run"`. `PROFILE_ESCALATED` is advisory
and may accompany exit `0`; any blocker yields exit `2`; any cannot-run finding yields exit `1` and takes
precedence over blockers.

### Finding codes

The closed initial set is:

```text
PROFILE_REQUIRED
PROPOSAL_LIFECYCLE_REQUIRED
PROFILE_SCHEMA
PROFILE_CONTRADICTION
PROFILE_ESCALATED
CLASSIFICATION_REQUIRED
STALE_SIGNAL_RESOLUTION
REPO_SCAN_LIMIT
REPO_SCAN_UNSAFE_PATH
POLICY_INVALID
POLICY_VERSION
CHECK_KIND_UNREGISTERED
CHECK_CONTRACT_STALE
EVIDENCE_ADAPTER_REQUIRED
EVIDENCE_FORMAT_UNSUPPORTED
PRODUCTION_SOURCE_MISMATCH
PRODUCTION_OBLIGATION_MISMATCH
PRODUCTION_LIFECYCLE_MISMATCH
BLOCKED_PROFILE_DRIFT
CANNOT_RUN
```

New codes require a compiler-contract version decision and tests; adding a code does not silently widen
the existing closed report contract.

### Proposal finding routing

Compiler findings map to the existing policy finding classes deterministically:

| Compiler result | Policy class | `reparable` | `requires_human` |
|---|---|---:|---:|
| `PROFILE_REQUIRED`, `PROPOSAL_LIFECYCLE_REQUIRED`, `PROFILE_SCHEMA`, `PROFILE_CONTRADICTION`, `CLASSIFICATION_REQUIRED`, `STALE_SIGNAL_RESOLUTION` | `hold` | false | true |
| `EVIDENCE_ADAPTER_REQUIRED`, `EVIDENCE_FORMAT_UNSUPPORTED` | `hold` | false | true |
| `BLOCKED_PROFILE_DRIFT` | `verification` | true | false |
| policy, source, obligation, lifecycle, or check-contract mismatch | `protocol` | false | false |
| scanner safety/limit failure or `CANNOT_RUN` | `unrecoverable` | false | false |

`PROFILE_ESCALATED` remains an advisory and does not enter the certificate's findings array. A protocol
or unrecoverable result can never route to `revise` or `authorized`.

## Synthetic bank-style demonstration

The portfolio demonstration models the Community Bank failure mode without using a bank, customer, live
provider, or real personal data.

### Fixture

- Synthetic marker: `000-00-0000`, explicitly labeled invalid test data.
- A local application receives a document-classification request.
- A loopback fake provider records attempted outbound payloads.
- The unsafe fixture attempts to send the marker to a provider absent from the approved inventory.
- The corrected fixture blocks before transport and emits a redacted audit event.

### Demonstration sequence

1. Compile an AI-enabled profile with highly-sensitive data and external egress.
2. Show `AI-PROVIDER-001`, `AI-EGRESS-001`, `AI-LINEAGE-001`, and `OBS-001` in the Merkle plan.
3. Run the unsafe fixture: `production-ai-egress-v1` exits non-zero and `done()` reports the exact
   undischarged obligation.
4. Run the corrected fixture: no outbound payload reaches the fake provider, the redacted audit event is
   present, and the obligation discharges.
5. Change the profile to multi-tenant and subscription payments without changing code.
6. Show a new `plan_hash`, newly required tenant/payment obligations, stale authorization, and a blocked
   result until those controls exist.

The demo is deterministic, self-cleaning, loopback-only, and runs with Node.js 18. Its summary includes
the before/after plan hashes, obligation IDs, check outcomes, and explicit non-claims.

## TELOS self-profile and first-host dogfood

The synthetic bank demonstration proves one incident-shaped control path. It does not prove
self-application. Before the compiler is enrolled, TELOS must be the first non-synthetic repository whose
real profile compiles into obligations and whose obligations settle through the production gate.

### Bootstrap and quest boundary

There is no circular grant of authority:

1. The currently enrolled Iliad, Daedalus, TELOS, Argo, reference-documentation, and Clotho mechanisms
   govern design, planning, authorization, implementation, verification, documentation, and weave of the
   compiler candidate.
2. The candidate remains unenrolled after its package tests pass.
3. A dedicated self-hosting proposal then uses the candidate compiler to profile the TELOS repository,
   place the resulting obligations in a real Merkle plan, and settle them through the real gate.
4. A self-hosting failure returns the change to the authorized revision protocol. It cannot be waived by
   calling the candidate experimental, by substituting the synthetic demo, or by editing enrollment
   records.
5. Reference-documentation, Clotho weave, Iliad post-review, and enrollment complete only after the
   self-hosting evidence is green.

The dedicated proposal is acceptance evidence inside this quest. It does not rewrite the implementation
plan or claim that the candidate authorized its own creation.

### Controller-authored TELOS profile

The dedicated self-hosting proposal must name a tracked, exact TELOS production dossier authored under
controller jurisdiction. Before TELOS authorization freezes the self-hosting plan, The Eye must approve
the dossier values and evidence bindings. The builder may implement controls demanded by the dossier but
may not author or weaken the effective profile.

The dossier must not declare less than facts already inherent in the repository:

- `proposal_lifecycle` and `market_bound` are true;
- content-addressed governance records and ledgers make persistence durable;
- AI is enabled with an agentic role;
- the current external provider/connector inventory is explicit and external egress is true wherever a
  connector crosses the local trust boundary;
- model seats can write and execute, so `can_write` and `can_execute` are true; and
- data classification covers all repository and operator material eligible to enter model context, not
  merely the synthetic demonstration marker.

The remaining closed facts, including exposure, identity, tenancy, retention, residency, availability,
provider handling, and transaction authority, are explicit controller declarations. The scanner may
escalate those declarations or require classification; it may not fill an unknown with a convenient
minimum. Any unresolved current provider, data, or authority signal blocks the self-hosting proposal.

### Required self-hosting run

The committed run must:

1. reconstruct the controller-authored dossier from disk and compile it against a clean TELOS checkout;
2. invoke the production proposal orchestrator, workshop boundary, Merkle planner, proposal gate, and
   TELOS authorization with the versioned policy certificate rather than calling compiler helpers as a
   substitute;
3. restart from disk before authorization verification to prove durable reconstruction;
4. run every applicable registry check against the candidate implementation, using loopback fake
   providers and synthetic inputs for runtime boundaries;
5. re-scan final repository state and settle every obligation through the normal verification-node and
   `done()` path;
6. prove that deleting an obligation, substituting a no-op check, lowering a confirmed AI egress, write,
   or execute fact, or adding a new confirmed provider fact produces the expected blocking result;
7. re-derive and compare a committed `verified-summary.json` containing plan and profile references,
   obligation IDs, check outcomes, negative-control finding codes, and explicit non-claims; and
8. remove temporary `.telos/` state and leave the tracked checkout clean.

The run may not call a live model provider, contain real personal data, or trust the committed summary as
an input to the pass decision. Any model-review packets are fresh quest records bound to the exact
self-hosting dossier and plan; the reproducible run verifies their hashes and provenance offline. The
older packet-only self fixture cannot substitute for those records. A root README dogfood claim,
production-profile release tag, or institutional enrollment is prohibited until this run is green.

## Scalability

The compiler's work is bounded by registered files, semantic facts, policy rules, and obligations:

```text
scan: O(bytes in registered files)
fact normalization: O(F log F)
policy evaluation: O(R * bounded-expression-size)
obligation sorting: O(O log O)
```

`F`, `R`, and `O` are small relative to source code. No model calls are added. Detector results can be
cached by file content hash, but the uncached implementation is the correctness baseline.

Stable IDs and local projections support hundreds of obligations without rewriting unrelated node
lineage. Production verification nodes depend on all non-verification tasks in version 1, which is
deliberately conservative. If graph size later becomes material, a separately reviewed controller-owned
barrier-node design may optimize edges without changing obligation semantics.

Policy domains are data partitions, not independent executable plugins. A future policy-pack mechanism
can reuse `policy_ref`, `rule_ref`, source records, and exact-set reconciliation, but it must preserve the
single deterministic merge order and closed check registry.

## Portability

The compiler uses only `node:` and repository-relative imports and has no runtime dependencies. It does
not import institutional-memory records, active TELOS plans, or host-specific model configuration.

A fresh host needs:

- a dossier with the closed production profile when activation applies;
- the TELOS build-gate and built-in policy;
- machine-readable evidence artifacts for triggered structural checks;
- a loopback adapter for triggered runtime checks; and
- pinned evidence signers for triggered process checks.

Missing host evidence produces obligations and a clear block. Initialization does not copy TELOS's own
authority files into the host. `.telos/` runtime artifacts are created locally and remain untracked.

## Security requirements

- Zero runtime dependencies.
- Node.js `>=18`, ESM, explicit `node:` imports.
- No external network in compiler, scanner, tests, or demo.
- Runtime check clients deny redirects and proxy environment variables.
- Child processes, where unavoidable, receive a scrubbed allowlist environment and no credentials.
- Physical path containment is checked after symlink resolution.
- Files are opened and hashed defensively; changed-during-read inputs fail.
- No shell invocation or string command assembly.
- All JSON parsing is size-bounded and prototype-safe.
- All registry parameter objects use closed keys and value guards.
- Synthetic tenant IDs, payment events, credentials, and data markers only.
- Structured reports redact payloads and never echo sensitive test bodies.
- Production input, compiled-profile, policy, registry, and evidence-keyring artifacts are
  controller-owned and may not be listed in model write targets. Structural artifacts and process
  records named as obligation outputs may be produced by plan work but cannot certify themselves without
  the registry check and, for process records, an authorized external signature.

## Test strategy

No compiler branch or check kind ships without one passing fixture and at least one violating fixture.

### Pure compiler tests

- identical output across reordered object keys, set arrays, and filesystem traversal;
- identical semantic facts after unrelated source-byte changes;
- one-bit profile changes produce expected local and global invalidation;
- unknown/missing/additional fields fail;
- `"none"` cross-field contradictions fail;
- structured observations escalate but never lower;
- text signals block until exact resolution;
- stale and fabricated signal resolutions fail;
- malformed policy, unknown operator, duplicate ID, and unknown version fail;
- unregistered check and unsupported evidence format fail;
- no partial output replacement on exit `1` or `2`.

### Merkle obligation tests

- legacy obligation hashes remain byte-identical;
- version 2 source changes alter `obligation_ref`;
- unknown obligation version/source kind fails;
- production obligations register in `test.verifies`;
- lifecycle production metadata changes `plan_hash`;
- relevant projection changes mutate only the expected verification nodes;
- orphan legacy obligations now fail reconciliation;
- missing, extra, duplicate, and cross-bound production sources fail;
- a production obligation without lifecycle metadata fails;
- obligation-free legacy plans remain byte-identical.

### Registry tests

- every production kind has a passing fixture;
- each kind has assertion-failure and cannot-run fixtures;
- no-op executable substitution fails;
- registry implementation drift fails;
- forbidden command/environment/path keys fail;
- path escape, symlink escape, external URL, redirect, proxy, excessive body, request count, and timeout
  fail;
- runtime checks prove the expected negative behavior, not merely a happy path.

### Lifecycle tests

- activated dossier without profile blocks before any model caller is invoked;
- workshop cannot remove obligations or reserve production node IDs;
- proposal gate reconstructs from disk after process restart;
- version 1 certificate cannot authorize a production plan;
- changed profile, policy, registry, evidence config, or final repo facts blocks;
- a new AI dependency introduced during build triggers post-build profile drift;
- every expected production source maps to exactly one live obligation and vetted node;
- all obligations must discharge before success.

### TELOS self-hosting tests

- the self-profile enters through the production proposal lifecycle and survives a process restart;
- the compiled profile cannot be lowered below confirmed TELOS repository facts;
- all applicable production obligations discharge through registered checks and `done()`;
- deleting an obligation, substituting a no-op, or bypassing the post-build scan blocks;
- the existing packet-only self fixture cannot satisfy the production self-hosting assertion by itself;
- the committed summary is re-derived from candidate code and exact artifacts; and
- the self-hosting run uses no external network and leaves the tracked checkout clean.

### Domain fixtures

Every catalog rule has:

- a minimal profile where it does not trigger;
- a one-fact transition where it triggers;
- the expected stable obligation ID;
- a passing evidence fixture;
- a failing evidence fixture; and
- a mutation proving stale evidence or plan identity cannot pass.

### Repository checks

- `npm --prefix merkle-dag test`;
- `npm --prefix build-gate test`;
- `node docs/runs/production-profile-demo/run.mjs`;
- `node docs/runs/production-profile-self/run.mjs`;
- `node docs/institutional-memory/verify-contracts.mjs`;
- import audit proving no non-`node:`/non-relative imports in new scripts;
- tracked checkout clean after all verification.

## Planned file layout

```text
build-gate/
├── examples/
│   └── self/
│       ├── dossier.json
│       ├── production-controls.json
│       └── packets/
├── production-profile/
│   ├── cli.mjs
│   ├── compiler.mjs
│   ├── profile-schema.mjs
│   ├── repo-facts.mjs
│   ├── policy-loader.mjs
│   ├── policy.v1.json
│   ├── source-record.mjs
│   └── README.md
├── check-registry.mjs
├── proposal-gate.mjs
├── proposal-orchestrator.mjs
├── proposal-recorder.mjs
├── schemas.mjs
├── package.json
└── scripts/
    ├── test-production-profile.mjs
    ├── test-production-policy.mjs
    └── test-production-checks.mjs

merkle-dag/
├── obligation.mjs
├── merkle.mjs
├── planner.mjs
├── package.json
└── scripts/
    └── test-obligation.mjs

docs/runs/production-profile-demo/
├── run.mjs
├── fixtures/
└── README.md

docs/runs/production-profile-self/
├── run.mjs
├── verified-summary.json
├── fixtures/
└── README.md

docs/production-profile.md
README.md
```

The implementation plan must also enumerate exact institutional-memory and contract updates. New code
uses plain descriptive names. Existing TELOS role names appear only where the repository lifecycle
requires them.

## Governance and rollout

1. The Eye reviews this written design.
2. Iliad pre-review records seats, capabilities, prior retrospectives, intended scope, and the entry
   comprehension result before code.
3. Daedalus matures a file-specific candidate plan through adversarial review.
4. TELOS authorization binds the exact matured implementation-plan hash.
5. Argo admits the implementer through its comprehension gate and executes test-first authorized slices.
6. After package, negative, bank-demo, and portability checks pass, the controller starts the dedicated
   self-hosting proposal. The candidate fixes its production obligations before workshop, and TELOS
   separately authorizes the exact self-hosting plan and controller dossier before verification and
   settlement.
7. The reference-documentation stage records the implemented contract and bounded claims.
8. Clotho weaves the implementation and its verified evidence.
9. Iliad post-review records actual provenance, deviations, and feed-forward optimizations.
10. Institutional enrollment occurs only when every preceding stage is complete and contract
    verification is green.

The rollout migrates in-tree proposal-lifecycle and market-bound fixtures to explicit minimal profiles in
the same authorized change. There is no period where activated builds silently bypass the compiler.
The production-profile self-hosting gate supplements every quest stage above; it replaces none of them.

## Acceptance criteria

- `PPC-A01`: Activated builds cannot reach a model call without a valid production profile.
- `PPC-A02`: The compiler is byte-deterministic on Node.js 18 and 20.
- `PPC-A03`: All eleven domains and every listed stable obligation ID have trigger and negative fixtures.
- `PPC-A04`: Production obligations are typed version 2 sources, not fabricated review concerns.
- `PPC-A05`: Existing legacy obligation and obligation-free plan hashes remain byte-identical.
- `PPC-A06`: Every obligation reconciles to exactly one source; no inert orphan remains.
- `PPC-A07`: Full profile and policy identity are included in `plan_hash`.
- `PPC-A08`: Relevant profile changes alter the expected verification-node hashes; all profile changes
  invalidate global authorization.
- `PPC-A09`: Models cannot remove, replace, weaken, or discharge a production obligation with a no-op.
- `PPC-A10`: Post-build facts can add obligations and block stale plans.
- `PPC-A11`: Runtime, structural, and process evidence are labeled and reported without overclaiming.
- `PPC-A12`: Missing adapters and unsupported formats block with deterministic findings.
- `PPC-A13`: The synthetic SSN demo proves unsafe egress blocks, corrected behavior passes, and no
  external network or real personal data is used.
- `PPC-A14`: New scripts have zero runtime dependencies and pass the import audit.
- `PPC-A15`: `merkle-dag`, `build-gate`, the demo, and institutional contract verification all pass and
  leave the tracked checkout clean.
- `PPC-A16`: A fresh host repository can compile a minimal profile without any TELOS institutional files;
  triggered but unsupported host evidence fails explicitly.
- `PPC-A17`: The root README explains the production-profile problem, links the deterministic demo, and
  distinguishes enforced evidence from legal or operational certification.
- `PPC-A18`: The compiler change has commit-anchored evidence for the canonical Iliad pre-review,
  Daedalus, TELOS, Argo, reference-documentation, Clotho, and Iliad-retrospective stages before
  enrollment.
- `PPC-A19`: A controller-approved TELOS self-profile enters the actual production proposal lifecycle,
  is authorized against its exact dossier and plan, survives disk reconstruction, compiles all
  applicable obligations, and settles only after their registered checks pass.
- `PPC-A20`: No TELOS-specific bypass exists, and self-hosting negative controls prove that a removed
  obligation, no-op check, lowered confirmed fact, or new post-build provider fact blocks.
- `PPC-A21`: The self-hosting evidence is deterministically re-derived, uses no live provider or real
  personal data, leaves the tracked checkout clean, and precedes any dogfood claim or enrollment.

## Explicit non-claims

- A green profile is not proof that a system is secure, scalable, available, fair, accurate, or legally
  compliant.
- A structural check proves only the inspected artifact and relationship.
- A process record proves only that an authorized signer attested to the recorded run and that its hashes
  and freshness verify.
- A runtime fixture proves only the bounded scenario against the tested build.
- A green TELOS self-hosting run proves only that TELOS satisfied its declared profile and bounded
  executable evidence contracts at the verified commit; it is not universal certification of TELOS or
  proof that every future host will pass.
- Repository scanning is not data discovery, a privacy inventory, or a complete software bill of
  materials.
- An unresolved production risk cannot be converted into acceptance by adding prose.
- Version 1 content-addresses the controller-supplied dossier but does not cryptographically prove that a
  human authored it; human jurisdiction is a governance trust boundary at the caller.
- The controller and build controller remain one trust principal unless a later authorized design
  separates them.

## Sources

- [Community Bank Form 8-K, Item 1.05](https://www.sec.gov/Archives/edgar/data/1605301/000160530126000021/cbfv-20260507.htm)
- [Samsung generative-AI restriction report](https://techcrunch.com/2023/05/02/samsung-bans-use-of-generative-ai-tools-like-chatgpt-after-april-internal-data-leak/)
- [OpenAI March 20 ChatGPT outage report](https://openai.com/index/march-20-chatgpt-outage/)
- [Korea PIPC DeepSeek examination](https://www.pipc.go.kr/eng/user/ltn/new/noticeDetail.do?bbsId=BBSMSTR_000000000001&nttId=2819)
- [Microsoft SAS token exposure disclosure](https://www.microsoft.com/en-us/msrc/blog/2023/09/microsoft-mitigated-exposure-of-internal-information-in-a-storage-account-due-to-overly-permissive-sas-token)
- [Microsoft AI application security and EchoLeak discussion](https://www.microsoft.com/en-us/security/security-insider/emerging-trends/ai-application-security-considerations-for-organizations)
- [FTC Everalbum settlement](https://www.ftc.gov/news-events/news/press-releases/2021/01/california-company-settles-ftc-allegations-it-deceived-consumers-about-use-facial-recognition-photo)
- [Replit database-deletion report](https://www.fastcompany.com/91372483/replit-ceo-what-really-happened-when-ai-agent-wiped-jason-lemkins-database-exclusive)
- [Mata v. Avianca order](https://app.midpage.ai/document/mata-v-avianca-inc-10352027)
- [NYC Comptroller MyCity audit](https://comptroller.nyc.gov/reports/audit-report-on-the-new-york-city-office-of-technology-and-innovations-mycity-system/)
- [FTC Rite Aid facial-recognition action](https://search.ftc.gov/news-events/news/press-releases/2023/12/rite-aid-banned-using-ai-facial-recognition-after-ftc-says-retailer-deployed-technology-without)
- [EEOC iTutorGroup settlement](https://www.eeoc.gov/newsroom/itutorgroup-pay-365000-settle-eeoc-discriminatory-hiring-suit)
- [Hong Kong Government deepfake fraud report](https://www.info.gov.hk/gia/general/202406/26/P2024062600192.htm)
- [UK ICO Snap My AI investigation](https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2024/05/ico-warns-organisations-must-not-ignore-data-protection-risks-as-it-concludes-snap-my-ai-chatbot-investigation/)
- [SEC AI-washing enforcement cases](https://www.sec.gov/newsroom/videos/sec-enforcement-director-gurbir-grewal-discusses-ai-washing-enforcement-cases)
- [NIST AI 600-1, Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [GAO-25-107653, Generative AI Use and Management at Federal Agencies](https://files.gao.gov/reports/GAO-25-107653/index.html)
