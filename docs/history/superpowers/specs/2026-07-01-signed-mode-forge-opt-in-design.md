# Signed-mode forge opt-in — design

**Date:** 2026-07-01
**Status:** approved (brainstorm), pending implementation plan
**Depends on:** PR #66 (signed-mode packet authentication), merged to `main` as `7814378`

## Motivation

`ai-forge` and `saas-forge` drive a project to a gate-certified state, but they build the
gate dossier with **no `trust_mode`**, so the gate runs unsigned: HMAC signatures and
provenance are never enforced on any packet the forge produces. PR #66 hardened signed
mode so it now enforces signature + provenance on **all** evidence packets (approval,
market, capability) and blocks cross-seat id reuse. This opt-in lets the forges run their
gate under `trust_mode: "signed"` so their live runs actually exercise that hardened
enforcement — closing the gap where a "live" forge pass never proved anything was signed.

## Goals

- A caller can run either forge in signed mode and have it converge **through** the real
  signature + provenance gate (not around it).
- Fail-closed: if signed mode is requested but the required secrets or real council packets
  are absent, the gate blocks — a demo can never be mistaken for a signed pass.
- Zero behavior change for existing unsigned runs (keyless demos, current tests).

## Non-goals

- No change to the merkle-dag Ed25519 ledger/build signing (separate mechanism, already
  always signed).
- No capability packets — the forges don't produce them, so signed-mode capability
  enforcement is out of scope here.
- No new API calls per workstream (market provenance is content-addressed, not live).

## Design

### 1. Toggle — explicit `signed` flag

A new `signed: boolean` option (default `false`) threads:

```
runForgeLive({ ..., signed })  ->  forge({ ..., signed })  ->  dossier.trust_mode = signed ? "signed" : undefined
```

Signed mode is a **live-only** path. The keyless `syntheticApprovals` fallback carries no
signature or provenance, so it cannot satisfy signed mode; that is intentional and
fail-closed. If `signed: true` but a required `TELOS_SECRET_*` is unset, `council.runSeat`
emits an unsigned packet and the gate blocks with `"... signature invalid in signed mode"`
— the failure is a gate blocker, surfaced in the forge result, not a silent downgrade.

### 2. Approval packets — no new code

`council.runSeat` already HMAC-signs each seat's packet with `secretFor(model)` when the
secret is present, and `liveSeatCaller` already stamps real provenance (the server-issued
`response_id`, or agy's `agy-<sha256>` content attestation). So in the live path with
secrets set, the claude/agy/codex approval trio is already signed + provenance-bound. The
only requirement signed mode adds is that the run go through the **live council** (not the
synthetic fallback) with secrets present.

### 3. Market packets — sign + content-addressed attestation

`marketPacketFromRecord(record, dossierMeta, { signed })` gains signed-mode behavior:

- **Provenance:** attach `provenance: { model: <signer>, source: "forge/market-attestation",
  response_id: "market-<sha256(canonical breakout record)>" }`. The breakout record was
  already re-verified on disk by the gate, so a content hash over it is a reproducible,
  non-fabricated binding — mirroring the agy local attestation. Each workstream's record is
  distinct, so the ids are unique.
- **Signature:** `signPacket(packet, secretFor(signer))`.
- **Signing identity — `signer`, not `lens`:** the packet's `model` is set to the
  workstream's `signer`, not its `lens`. A market packet is harness-derived from a
  disk-verified record, so the honest cryptographic identity is the trusted controller
  signing with the workstream's signer secret — *who signs* is not *who reviewed*. The
  reviewing `lens` is preserved as a descriptive `reviewed_by_lens` field on the packet
  (non-load-bearing; the gate keys coverage off `workstreams_reviewed`, not `model`).
- **Secret requirement (decided during implementation):** signed mode requires a
  `TELOS_SECRET_<SIGNER>` for **every** workstream signer, because the gate authenticates
  each market packet by `secretFor(packet.model)`. In `saas-forge` all signers are
  `claude`/`codex`, so the approval-trio secrets suffice. In `ai-forge`, several patterns
  sign guardrail/adversary workstreams with `grok`, so **`ai-forge` signed mode also
  requires `TELOS_SECRET_GROK`**. A missing signer secret leaves that market packet
  unsigned and the gate blocks it (fail-closed). (An earlier "sign by signer avoids
  advisory secrets" rationale was based on a saas-forge-only survey and does not hold for
  ai-forge; requiring the grok secret was the chosen resolution.)

In **unsigned mode nothing changes**: `packet.model = lens`, no provenance, no signature.

The workstream config must expose `signer` to the market-packet builder. In `saas-forge`
`workstreams.mjs` each entry already has `signer`; in `ai-forge` the pattern workstreams
have `signer`. The breakout record carries `lens` today; it must also carry `signer` (add
it alongside `lens` where records are assembled in `breakouts.mjs`).

### 4. Data flow (signed live run)

```
runForgeLive({ signed: true, callTool })
  -> councilApprovals (live): claude/agy/codex packets, HMAC-signed by runSeat + real provenance
  -> forge({ signed: true }): build -> per-workstream breakout (verdict on disk)
  -> marketPacketFromRecord(record, meta, { signed: true }):
       model = record.signer; provenance = market-<sha256(record)>; signPacket(_, secretFor(signer))
  -> dossier.trust_mode = "signed"
  -> validateRecords(dossier, approvals, source, [], marketPackets)
       -> #66 enforces: approval trio signed+provenance; every market packet signed+provenance
  -> gate_status "pass" only if every packet authenticates AND breakout re-verify passes
```

## Error handling / fail-closed

- Missing `TELOS_SECRET_<signer>` in signed mode → market packet unsigned → gate blocker
  `"Market readiness packet for <signer> signature invalid in signed mode"`.
- Missing approval-seat secret → approval packet unsigned → gate blocker.
- Synthetic fallback used in signed mode (e.g. live council threw) → unsigned/no-provenance
  → gate blocks. Signed mode never converges on synthetic approvals.
- All blockers surface in `forge()`'s returned `verdict.blockers` and `converged: false`.

## Testing

Existing unsigned keyless tests are untouched and must stay green.

New per-forge signed-mode integration test (keyless HMAC secrets, stub transport):

1. Set `process.env.TELOS_SECRET_CLAUDE/AGY/CODEX` to test values (as `test-trust.mjs` does).
2. Stub `callTool` returns, for chat seats, a `{text, provenance:{response_id}}` envelope so
   `liveSeatCaller` binds real-ish provenance; for `agy_checkpoint`, an advancing checkpoint.
3. `const r = await runForgeLive({ ..., signed: true, callTool })`.
4. Assert `r.converged === true`, `r.verdict.gate_status === "pass"`,
   `r.verdict.headline_checks.signing_enforced === true` and `provenance_enforced === true`.
5. Negative: with one required secret unset, assert `r.converged === false` and a blocker
   mentioning `"signature invalid in signed mode"` — proving fail-closed.

Unit test for the market-packet builder: in signed mode it produces a packet whose
`signature` verifies under `secretFor(signer)` and whose `provenance.response_id` matches
`/^market-[0-9a-f]+$/`; in unsigned mode it produces neither.

## Files touched (anticipated)

- `ai-forge/forge.mjs` — `signed` option; `marketPacketFromRecord` signed branch; dossier
  `trust_mode`.
- `ai-forge/live.mjs` — thread `signed` through `runForgeLive`.
- `ai-forge/breakouts.mjs` — carry `signer` on records.
- `saas-forge/forge.mjs`, `saas-forge/live.mjs`, `saas-forge/breakouts.mjs` — same.
- Tests: `ai-forge/scripts/test-forge.mjs` (or `test-live.mjs`), `saas-forge` equivalents.

Constraints (CLAUDE.md): zero runtime deps, ESM `.mjs`, `node:` imports; reuse
`signPacket`/`secretFor` from `build-gate/sign.mjs` and the existing canonicalization; no
committed secrets or `.telos/` artifacts.
