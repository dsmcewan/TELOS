# SECURITY AND TRUST

This document is the security-and-trust artifact for the hosted service. It is intentionally evidence-disciplined: code citations below are limited to the source evidence supplied for this review. Where the self-snapshot names shipped controls but the corresponding source file is not present in the evidence bundle, the control is documented as an operating requirement or honest limit rather than over-cited.

Primary source evidence for this artifact:

- `source/build-gate/seat-registry.mjs` defines the seat-to-backend registry. Its header says it maps each council tool name to the MCP server that owns it and to the tool name on that server.
- `defaultSeatRegistry()` in `source/build-gate/seat-registry.mjs` defines the canonical servers `ai-peer`, `grok`, `gemini`, `codex`, and `agy`, and the canonical tools `claude_ask`, `agy_checkpoint`, `grok_ask`, `gemini_ask`, `codex_ask`, and `agy_ask`.
- `withLoadout()` in `source/build-gate/seat-registry.mjs` merges loadout servers with the registry and the file comment states that council tool routes always win and a loadout server can never shadow a seat. The implementation returns `servers: { ...fileServers, ...servers, ...registry.servers }`, so registry server names win merge conflicts.
- `mapAskArgs()` in `source/build-gate/seat-registry.mjs` maps `response_schema` to plugin-native `schema` and removes undefined argument values.
- The same file documents, as an interface comment, that plugin seat servers return a `{text, provenance:{model, response_id, source}}` envelope under `include_provenance:true`.

## Trust Spine As Shipped

The shipped trust spine is treated as the service boundary that must be present before a customer job is accepted, routed, signed, or recorded. The self-snapshot describes five controls: fail-closed gate, per-seat provenance, HMAC-signed packets under `trust_mode=signed`, Ed25519 ledgers, and fail-closed seat routing. The evidence status is split below so that no unsupported citation is used.

| Control | Service stance | Evidence status |
| --- | --- | --- |
| Canonical seat registry | Shipped. The service has named council seats and named backends rather than convention-only routing. | Source-verified in `source/build-gate/seat-registry.mjs` via `defaultSeatRegistry()`, which maps each exposed council tool to a backend server/tool pair. |
| Loadout non-shadowing | Shipped for registry server-name conflicts. Customer/plugin loadouts must not override canonical council backends. | Source-verified in `withLoadout()` in `source/build-gate/seat-registry.mjs`: registry servers are spread last, and the comment states that council tool routes always win. |
| Per-seat provenance | Required for hosted operation. Every model/tool response used in trust decisions must carry seat provenance: model, response id, and source. | Partly source-documented, not cryptographically proven by the supplied file. `source/build-gate/seat-registry.mjs` documents the plugin seat envelope as `{text, provenance:{model, response_id, source}}` under `include_provenance:true`. The hosted service must still validate that the envelope is present before accepting output. |
| HMAC-signed packets under `trust_mode=signed` | Required for hosted operation. Tenant job packets are accepted only in signed mode, with a tenant-scoped HMAC key and a key id. | Self-snapshot claim; no HMAC signer source file was supplied in this evidence bundle. This document therefore treats it as a required operating control and does not cite unavailable code as proof. |
| Ed25519 ledgers | Required for hosted operation. Append-only trust events should be signed with Ed25519 so customers can verify ledger integrity with a public key. | Self-snapshot claim; no ledger source file was supplied in this evidence bundle. This document therefore treats it as a required operating control and records key-custody limits below. |
| Fail-closed build/release gate | Required for hosted operation. If provenance, signatures, ledger verification, or policy checks fail, the release/job must stop rather than degrade silently. | Self-snapshot claim; no gate source file was supplied in this evidence bundle. This must be verified by release tests and deployment evidence. |
| Fail-closed seat routing | Required for hosted operation: an unknown or unrouted council tool must be denied, not sent to a default model/backend. | Important correction: `source/build-gate/seat-registry.mjs` does not prove that an unrouted tool throws. It only builds the registry and says it is consumed by `breakout/seat_router.mjs`. This artifact does not cite `seat-registry.mjs` as router enforcement. Until router evidence is supplied, the hosted service must enforce a separate allowlist check at the API boundary using the canonical `defaultSeatRegistry().tools` set. |

Practical hosted-service rule: only tools present in the canonical registry may be invoked as council seats. Namespaced loadout tools are disabled for untrusted customer manifests unless explicitly enabled by an administrator for that tenant. There is no permitted fallback from an unknown tool name to `ai-peer`, a general chat model, or any pooled backend.

## Key Custody

### Customer provider API keys: BYO versus pooled

The hosted service should default to BYO customer keys for production tenants.

BYO keys give the customer quota, billing, revocation, and provider-account control. They also reduce pooled-key blast radius: a leak or abuse event affects one tenant credential rather than every tenant using the platform key. BYO improves customer auditability because model-provider usage appears in the customer account, not only in SaaS logs.

The trade-off is operational friction. BYO onboarding is harder, provider permissions vary, support may be unable to reproduce provider failures, and customer-side quota exhaustion can look like a SaaS outage. BYO keys are also not zero-knowledge: the hosted runtime must still use the credential unless the customer routes requests through its own gateway or broker.

Pooled keys are acceptable only for low-risk trial, demo, or free-tier usage. They reduce setup friction and make billing simpler, but they centralize credential risk, make quota contention a cross-tenant availability issue, and complicate attribution. If pooled keys are offered, they must be low-quota, segregated by environment, rate-limited per tenant, excluded from regulated-data workloads, and labeled in provenance as pooled credential usage.

Production stance:

- Enterprise/default production: BYO provider keys.
- Trial/sandbox: pooled keys may be used with strict quotas and no regulated data.
- Secrets never appear in customer manifests, workdirs, model prompts, logs, provenance envelopes, or ledger payloads.
- Stored credentials are encrypted under a secret manager or KMS, scoped by tenant, and injected only into the worker process that needs them.

### `TELOS_SECRET_*` HMAC key management per tenant

HMAC packet signing is symmetric, so custody is critical. A tenant HMAC key proves that a packet came from an entity holding the tenant secret; it does not provide customer-independent non-repudiation if the SaaS operator also holds that secret.

Hosted-service requirements:

- Use one HMAC secret per tenant, represented operationally as `TELOS_SECRET_<TENANT>` or, preferably, a secret-manager/KMS alias that resolves to that tenant secret at runtime.
- Do not use a single global `TELOS_SECRET` for all production tenants.
- Generate tenant HMAC keys with a CSPRNG at 256-bit strength or stronger.
- Store only in the secret manager/KMS; never in manifests, workdirs, source-controlled config, support bundles, or logs.
- Attach a `kid` to every signed packet. Rotate by sign-new/verify-old until the old key expires, then revoke.
- Include tenant id, job id, packet type, canonicalized payload hash, timestamp, nonce, and `trust_mode=signed` in the HMAC-covered material.
- Maintain a replay cache keyed by tenant, `kid`, nonce, and packet hash.
- On verification failure, fail closed: reject the packet and do not route the job.

Ed25519 ledger signing should be separated from HMAC packet signing. HMAC keys protect tenant packet authenticity inside the service; Ed25519 ledger keys support public verification of append-only trust records. They should have separate key ids, rotation plans, access policies, and audit logs.

## Tenant Isolation

Tenant isolation has to cover credentials, workdirs, manifests, routes, plugins, logs, and trust artifacts.

Workdir isolation requirements:

- Each tenant/job gets a unique workdir root. Workers must resolve real paths and reject absolute paths, `..` traversal, symlink escapes, hardlink tricks, device files, and paths outside the assigned root.
- Workdirs are not reused across tenants. Cleanup must run after job completion and after failed jobs.
- Run customer jobs in a sandboxed process/container with tenant/job identity, resource limits, filesystem restrictions, and least-privilege network access.
- Secrets are injected out-of-band, preferably as short-lived environment or memory-only mounts, and are never written into the workdir.
- Logs and artifacts include tenant/job ids but redact secrets and provider keys.

Manifest isolation requirements:

- A manifest is data, not authority. It may request a job, but it may not choose host paths, set process environment, override `TELOS_PLUGINS_DIR`, set `TELOS_LOADOUT`, define arbitrary server commands, or select another tenant's credentials.
- Manifests are stored under tenant-scoped storage prefixes or database rows with tenant authorization checks. A customer-supplied manifest id is never sufficient to load another tenant's manifest.
- Manifest validation must be strict and canonical: reject unknown fields, duplicate keys, overlarge payloads, overdeep structures, invalid enum values, and non-canonical encodings.
- Manifest-derived paths are interpreted relative to the tenant/job workdir only after canonicalization.

Seat and plugin isolation:

- `source/build-gate/seat-registry.mjs` shows that plugin location can be environment-overridden through `TELOS_PLUGINS_DIR` and that loadouts can be loaded from `TELOS_LOADOUT` or `~/.telos/loadout.json`. In the hosted service, those are operator-controlled deployment settings, not customer-controlled manifest fields.
- `withLoadout()` accepts server definitions with commands and args. That is powerful and must be treated as administrator-only. A customer manifest must not be allowed to introduce arbitrary MCP server commands.
- Canonical council tools come from `defaultSeatRegistry().tools`; untrusted customers cannot shadow or replace them.

## Malicious Manifests

Rejecting unknown fields is necessary but not sufficient. A malicious customer manifest could attempt to:

- Escape the assigned workdir using absolute paths, `..`, symlinks, hardlinks, or encoded path variants.
- Read another tenant's manifests, artifacts, cached prompts, provider keys, or provenance records by guessing ids or paths.
- Route to an unregistered tool, use namespaced loadout syntax, shadow a council seat, or request an arbitrary MCP server command.
- Override deployment environment such as `TELOS_PLUGINS_DIR`, `TELOS_LOADOUT`, `TELOS_SECRET_*`, provider API keys, or model profile settings.
- Forge provenance by supplying fake `model`, `response_id`, `source`, or signed-packet fields in the manifest.
- Replay an old signed packet or reuse a valid packet under another tenant, job, or `trust_mode`.
- Trigger resource exhaustion with huge prompts, schemas, file lists, recursion, retry counts, output limits, or deeply nested JSON.
- Abuse parser edge cases such as duplicate JSON keys, `__proto__`, `constructor`, Unicode confusables, oversized numbers, invalid UTF-8, or regex/path glob denial of service.
- Cause SSRF or unexpected egress by embedding URLs to cloud metadata services, internal admin planes, or tenant-private endpoints.
- Use prompt injection to make a model/tool reveal secrets, ignore provenance requirements, or summarize hidden system material.
- Smuggle malicious output into logs, markdown, HTML, CSV, terminal escape sequences, or downloadable archives.

Required mitigations:

- Strict JSON schema with `additionalProperties:false`, duplicate-key rejection, size/depth limits, and enum allowlists.
- Server-side recomputation of provenance and signatures. Never trust provenance or signature claims supplied by a manifest.
- Deny-by-default routing against the canonical seat allowlist.
- Path canonicalization and filesystem sandboxing before any file access.
- Per-tenant quotas for prompt size, file count, runtime, memory, retries, and outbound calls.
- Egress allowlists and metadata-service blocking.
- Redaction and output encoding for logs and rendered artifacts.

## Threats

Primary threat sketch for the hosted service:

1. Tenant-to-tenant data access: Tenant A tries to read Tenant B's workdir, manifest, keys, logs, or ledger entries. Controls: tenant-scoped authorization, unique workdirs, storage prefixes, path canonicalization, sandboxing, and audit logs.
2. Customer-to-host escape: A customer uses a manifest or loadout to run arbitrary commands. Controls: manifests cannot set loadouts or commands; loadout/plugin configuration is admin-only; workers run sandboxed with least privilege.
3. Credential theft: An attacker steals provider API keys or `TELOS_SECRET_*`. Controls: KMS/secret-manager storage, per-tenant keys, narrow IAM, no secret logging, rotation, replay protection, and incident revocation.
4. Packet tampering or replay: An attacker modifies a job packet, changes `trust_mode`, or replays a previous packet. Controls: canonical HMAC-covered fields, nonce/timestamp, tenant binding, `kid`, and fail-closed verification.
5. Provenance forgery: A customer or compromised tool fabricates model/source metadata. Controls: service-side provenance enforcement, signed ledgers, and rejection of missing or malformed provenance.
6. Prompt injection and malicious model output: A document or model response attempts to override system rules, exfiltrate secrets, or poison downstream artifacts. Controls: treat model output as untrusted, isolate secrets from prompts, require structured validation, and preserve provenance.
7. Insider/single-operator compromise: An operator with signing-key access could forge HMAC packets or ledger entries. Controls today are procedural and audit-based; Phase 2 must add split custody or HSM-backed signing.
8. Dependency/plugin compromise: A plugin server or package is malicious. Controls: pin versions, hash/sign plugins, restrict egress, use admin-approved registries, and monitor runtime behavior.
9. Availability attack: A tenant submits jobs that exhaust model quota, CPU, memory, disk, or queue capacity. Controls: per-tenant quotas, cgroups/container limits, queue isolation, backpressure, and abuse detection.

## Honest Limits

- Single-operator key custody exists today for signing authority. The prior assertion that a `sign.mjs` header proves this cannot be source-verified in this evidence bundle because that file was not supplied. This document therefore records single-operator custody as an operational limit, not as a verified code citation.
- `source/build-gate/seat-registry.mjs` does not prove fail-closed runtime routing. It defines the registry and documents that it is consumed by `breakout/seat_router.mjs`, but it contains no throw, fallback, or deny-by-default router enforcement. This artifact intentionally does not cite it for that behavior.
- The provenance envelope in `source/build-gate/seat-registry.mjs` is documented in comments as an interface contract. The supplied file does not by itself prove that every backend always returns provenance or that the service rejects missing provenance.
- HMAC is symmetric. If the hosted service holds a tenant HMAC key, the service can generate packets for that tenant. Customer-independent non-repudiation requires separate public-key signing or customer-held signing/verifying infrastructure.
- BYO provider keys reduce pooled-key blast radius but do not make the SaaS zero-knowledge. The worker using the key can access it unless the customer uses an external broker/gateway.
- No SOC 2, ISO 27001, HIPAA, or penetration-test certification is claimed by this artifact.

## Phase 2 Work Items

1. Add router evidence and tests proving unknown tools fail closed, no default backend fallback exists, and loadout tools cannot shadow council seats.
2. Add signer and ledger evidence to the review bundle, including `trust_mode=signed` HMAC coverage, `kid` rotation, replay protection, and Ed25519 verification.
3. Move signing keys to KMS/HSM-backed custody with two-person approval for export/destructive operations and auditable signing events.
4. Implement customer-visible verification: publish Ed25519 public keys, ledger checkpoints, key ids, and verification instructions.
5. Automate per-tenant `TELOS_SECRET_*` lifecycle: generation, storage, access policy, rotation, revocation, and incident response.
6. Harden tenant sandboxing with container or microVM isolation, per-tenant UID/GID, egress broker, object-store IAM boundaries, and resource quotas.
7. Build a malicious-manifest test corpus covering traversal, duplicate keys, parser abuse, loadout injection, SSRF, provenance forgery, replay, and resource exhaustion.
8. Require provenance validation at the service boundary: reject missing `model`, `response_id`, or `source`; bind provenance to tenant/job/seat; and record it in the signed ledger.
9. Create an admin-approved plugin/loadout marketplace with signed plugin manifests, pinned hashes, review workflow, and no customer-supplied arbitrary command execution.
10. Formalize security operations: access reviews, incident runbooks, backup/restore tests, retention/deletion policy, vulnerability management, and third-party assessment.
