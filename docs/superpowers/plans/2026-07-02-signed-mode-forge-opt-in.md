# Signed-mode Forge Opt-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `ai-forge` and `saas-forge` run their gate under `trust_mode: "signed"` so a live run converges *through* the hardened HMAC-signature + provenance enforcement (PR #66), not around it.

**Architecture:** A new opt-in `signed` flag threads `runForgeLive → forge → the gate dossier` (`trust_mode: "signed"`). Approval packets are already HMAC-signed + provenance-stamped by the live council (`council.runSeat` + `liveSeatCaller`). The only new authored evidence is the market packet: a shared `signMarketPacket` helper re-attributes it to the workstream's *signer* (claude/codex), attaches a content-addressed `market-<sha256(record)>` provenance attestation, and HMAC-signs it. Unsigned/keyless behavior is unchanged.

**Tech Stack:** Node ≥ 18, ESM `.mjs`, `node:crypto` (`createHash`, `createHmac`), existing `build-gate/sign.mjs` (`signPacket`, `verifyPacket`, `secretFor`, `canonicalize`). No test framework — tests are plain `node:assert/strict` scripts run via `npm test`.

## Global Constraints

- Zero runtime dependencies; standard library only, `node:` prefix on stdlib imports. No new npm packages, no lockfile.
- ESM only (`.mjs`, `"type":"module"`). Match surrounding style: double-quoted strings, semicolons, 2-space indent, small pure functions.
- Never commit secrets or runtime `.telos/` artifacts. Test HMAC secrets are local `process.env.TELOS_SECRET_*` values set and deleted within the test.
- Do NOT weaken the gate or the unsigned path. Unsigned/keyless runs and their existing tests must stay byte-for-byte equivalent in behavior.
- Run the affected package's `npm test` before each commit and report the result.

---

### Task 1: Shared `signMarketPacket` helper

**Files:**
- Modify: `build-gate/sign.mjs` (add `createHash` to the `node:crypto` import; add exported `signMarketPacket`)
- Test: `build-gate/scripts/test-sign.mjs` (add a block before the final `console.log`)

**Interfaces:**
- Consumes: `canonicalize`, `signPacket`, `secretFor` (already in `sign.mjs`).
- Produces: `signMarketPacket(packet, record, signer) -> packet'` — returns a new packet with `model` set to `signer`, `reviewed_by_lens` set to the original `packet.model`, `provenance = { model: signer, source: "forge/market-attestation", response_id: "market-" + sha256hex(canonicalize(record)) }`, and (when `secretFor(signer)` is truthy) a `signature` field from `signPacket`. When the signer has no secret, the packet is returned attested but **unsigned** (the gate blocks it in signed mode — fail-closed).

- [ ] **Step 1: Write the failing test**

Add to `build-gate/scripts/test-sign.mjs` immediately before `console.log("test-sign.mjs OK");`, and add `signMarketPacket` to the import on line 3 (`import { canonicalize, signPacket, verifyPacket, secretFor, signMarketPacket } from "../sign.mjs";`):

```javascript
// signMarketPacket: content-addressed attestation + re-attribution to the signer +
// HMAC signature under the signer's secret; lens preserved; unsigned without a secret.
process.env.TELOS_SECRET_CODEX = "cx";
{
  const packet = { model: "grok", build_id: "b1", workstreams_reviewed: ["security-trust"] };
  const record = { workstream: "security-trust", converged: true, checks: [{ type: "file_exists", path: "x" }] };
  const out = signMarketPacket(packet, record, "codex");
  assert.equal(out.model, "codex", "market packet re-attributed to the signer");
  assert.equal(out.reviewed_by_lens, "grok", "the reviewing lens is preserved");
  assert.equal(out.provenance.model, "codex", "provenance attributed to the signer");
  assert.match(out.provenance.response_id, /^market-[0-9a-f]{64}$/, "content-addressed market attestation");
  assert.equal(verifyPacket(out, "cx").ok, true, "signed under the signer's secret");
  // deterministic: same record -> same attestation id
  assert.equal(signMarketPacket(packet, record, "codex").provenance.response_id, out.provenance.response_id, "attestation is content-addressed (stable)");
}
{
  const out = signMarketPacket({ model: "grok" }, { workstream: "x" }, "model-without-secret");
  assert.equal(out.signature, undefined, "no secret => unsigned packet (fail-closed at the gate)");
  assert.equal(out.model, "model-without-secret", "still re-attributed");
  assert.match(out.provenance.response_id, /^market-[0-9a-f]{64}$/, "still attested");
}
delete process.env.TELOS_SECRET_CODEX;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd build-gate && node scripts/test-sign.mjs`
Expected: FAIL — `SyntaxError` / `signMarketPacket is not a function` (not yet exported).

- [ ] **Step 3: Implement `signMarketPacket`**

In `build-gate/sign.mjs`, change the crypto import (line 8) from:

```javascript
import { createHmac, timingSafeEqual } from "node:crypto";
```

to:

```javascript
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
```

Then append at the end of the file:

```javascript
// A market-readiness packet is authored by the trusted harness from an on-disk-
// verified breakout record, so it has no live server response id. In signed mode it
// is re-attributed to the workstream's SIGNER (a required seat with a secret — never
// an advisory lens), carries a reproducible content-addressed attestation over the
// record, and is HMAC-signed. The reviewing `lens` is preserved as `reviewed_by_lens`.
// Without a secret the packet is returned attested-but-unsigned so the gate blocks it.
export function signMarketPacket(packet, record, signer) {
  const digest = createHash("sha256").update(canonicalize(record ?? null)).digest("hex");
  const stamped = {
    ...packet,
    model: signer,
    reviewed_by_lens: packet.model,
    provenance: { model: signer, source: "forge/market-attestation", response_id: `market-${digest}` }
  };
  const secret = secretFor(signer);
  return secret ? signPacket(stamped, secret) : stamped;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd build-gate && node scripts/test-sign.mjs`
Expected: `test-sign.mjs OK`

- [ ] **Step 5: Run the full package suite**

Run: `cd build-gate && npm test`
Expected: all suites pass (ends with `test-...` OK lines; exit 0).

- [ ] **Step 6: Commit**

```bash
git add build-gate/sign.mjs build-gate/scripts/test-sign.mjs
git commit -m "feat(sign): add signMarketPacket (attest + HMAC-sign a market packet)"
```

---

### Task 2: ai-forge signed-mode opt-in

**Files:**
- Modify: `ai-forge/breakouts.mjs:60` (carry `signer` on records)
- Modify: `ai-forge/forge.mjs` (import `signMarketPacket`; `signed` param on `forge`; `marketPacketFromRecord` signed branch; dossier `trust_mode`; market map)
- Modify: `ai-forge/live.mjs` (thread `signed` through `runForgeLive`)
- Test: `ai-forge/scripts/test-live.mjs` (append a signed positive + negative block)

**Interfaces:**
- Consumes: `signMarketPacket(packet, record, signer)` from Task 1.
- Produces: `forge({ ..., signed })` and `runForgeLive({ ..., signed })` — when `signed: true`, the gate dossier carries `trust_mode: "signed"` and every market packet is signed via `signMarketPacket(packet, record, record.signer)`.

- [ ] **Step 1: Write the failing test**

Append to `ai-forge/scripts/test-live.mjs` immediately before its final `console.log(...)` call. (`runForgeLive`, `mkdtempSync`, `os`, `path`, `stubEmbed`, `stubVectorStore`, `callTool`, `dossierMeta`, `ctx` are already in scope in that file.)

```javascript
// --- signed mode: converge THROUGH the hardened signature+provenance gate ---
process.env.TELOS_SECRET_CLAUDE = "test-claude";
process.env.TELOS_SECRET_AGY = "test-agy";
process.env.TELOS_SECRET_CODEX = "test-codex";
{
  const signedRoot = mkdtempSync(path.join(os.tmpdir(), "ai-forge-signed-"));
  const signedResult = await runForgeLive({
    projectRoot: signedRoot, telos: ctx.telos, dossierMeta,
    embed: stubEmbed, vectorStore: stubVectorStore, callTool, signed: true
  });
  assert.equal(signedResult.converged, true,
    `signed-mode live run must converge through the hardened gate; cycles=${JSON.stringify(signedResult.cycles)}`);
  assert.equal(signedResult.verdict.gate_status, "pass", "signed-mode gate passes");
  assert.equal(signedResult.verdict.headline_checks.signing_enforced, true, "signing enforced in the verdict");
  assert.equal(signedResult.verdict.headline_checks.provenance_enforced, true, "provenance enforced in the verdict");
}
// negative: a missing required secret must fail closed in signed mode.
{
  delete process.env.TELOS_SECRET_CODEX;
  const failRoot = mkdtempSync(path.join(os.tmpdir(), "ai-forge-signed-fail-"));
  const failResult = await runForgeLive({
    projectRoot: failRoot, telos: ctx.telos, dossierMeta,
    embed: stubEmbed, vectorStore: stubVectorStore, callTool, signed: true
  });
  assert.equal(failResult.converged, false, "signed mode without a required secret must not converge");
  const blockers = (failResult.verdict && failResult.verdict.blockers) || [];
  assert.ok(blockers.some((b) => /no secret to verify codex|signature invalid/i.test(b)),
    `expected a fail-closed signature blocker; got ${JSON.stringify(blockers)}`);
  process.env.TELOS_SECRET_CODEX = "test-codex";
}
delete process.env.TELOS_SECRET_CLAUDE;
delete process.env.TELOS_SECRET_AGY;
delete process.env.TELOS_SECRET_CODEX;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ai-forge && node scripts/test-live.mjs`
Expected: FAIL — the signed run does not converge yet (`gate_status` blocked or `signing_enforced` false), because `forge`/`runForgeLive` do not yet accept or thread `signed`.

- [ ] **Step 3: Carry `signer` on breakout records**

In `ai-forge/breakouts.mjs` line 60, change:

```javascript
    records.push({ ...record, checks, lens: ws.lens, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
```

to:

```javascript
    records.push({ ...record, checks, lens: ws.lens, signer: ws.signer, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
```

- [ ] **Step 4: Thread `signed` through `ai-forge/forge.mjs`**

(a) Add the import after the existing `validateRecords` import (near line 29):

```javascript
import { signMarketPacket } from "../build-gate/sign.mjs";
```

(b) Change `marketPacketFromRecord`'s signature and its `return` (the function that starts `function marketPacketFromRecord(record, dossierMeta) {`):

```javascript
function marketPacketFromRecord(record, dossierMeta, { signed = false } = {}) {
```

and change the final two lines of that function from:

```javascript
  packet[record.findingsKey] = [record.finding];
  return packet;
}
```

to:

```javascript
  packet[record.findingsKey] = [record.finding];
  return signed ? signMarketPacket(packet, record, record.signer) : packet;
}
```

(c) Add `signed = false,` to the `forge({ ... })` destructured parameters (after `makeApprovals = syntheticApprovals,`):

```javascript
  makeApprovals = syntheticApprovals,
  signed = false,
  maxCycles = 3
```

(d) In the `if (allConverged) {` block, add `trust_mode` to the dossier literal (immediately after `objective: dossierMeta.objective,`):

```javascript
        objective: dossierMeta.objective,
        trust_mode: signed ? "signed" : undefined,
```

(e) In the same block, change the market map from:

```javascript
      const marketPackets = records.map((r) => marketPacketFromRecord(r, dossierMeta));
```

to:

```javascript
      const marketPackets = records.map((r) => marketPacketFromRecord(r, dossierMeta, { signed }));
```

- [ ] **Step 5: Thread `signed` through `ai-forge/live.mjs` `runForgeLive`**

Add `signed = false` to the `runForgeLive({ ... })` destructured parameters (alongside `serverPath, maxCycles = 3`):

```javascript
  serverPath, maxCycles = 3, signed = false
```

and add `signed` to the `forge({ ... })` call inside `runForgeLive`:

```javascript
      makeApprovals,
      maxCycles,
      signed
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd ai-forge && node scripts/test-live.mjs`
Expected: prints the existing `test-live.mjs OK` line with no assertion failures.

If it FAILS on a blocker containing `"existence-only"`: a RAG-pattern workstream's `checks()` is existence-only, which the signed-mode sufficiency floor rejects. Fix by adding one `file_contains` check with a real needle to that workstream's `checks()` in `ai-forge/patterns/rag.mjs` — e.g. `{ type: "file_contains", path: "<that workstream's file>", needle: "<a stable literal already written into that file>" }` — then re-run. (This does not affect unsigned runs.)

- [ ] **Step 7: Run the full package suite**

Run: `cd ai-forge && npm test`
Expected: all suites pass, exit 0.

- [ ] **Step 8: Commit**

```bash
git add ai-forge/breakouts.mjs ai-forge/forge.mjs ai-forge/live.mjs ai-forge/scripts/test-live.mjs
git commit -m "feat(ai-forge): signed-mode gate opt-in (signed flag + signed market packets)"
```

---

### Task 3: saas-forge signed-mode opt-in

**Files:**
- Modify: `saas-forge/breakouts.mjs:52` (carry `signer` on records)
- Modify: `saas-forge/forge.mjs` (import `signMarketPacket`; `signed` param on `forge` and `runMarketGate`; `marketPacketFromRecord` signed branch; dossier `trust_mode`)
- Modify: `saas-forge/live.mjs` (thread `signed` through `runForgeLive`)
- Test: `saas-forge/scripts/test-live.mjs` (append a signed positive + negative block)

**Interfaces:**
- Consumes: `signMarketPacket(packet, record, signer)` from Task 1.
- Produces: `forge({ ..., signed })` and `runForgeLive({ ..., signed })` with the same semantics as Task 2.

- [ ] **Step 1: Write the failing test**

Append to `saas-forge/scripts/test-live.mjs` immediately before its final `console.log(...)`. (`forge`, `liveGenerators`, `makeCouncilFactFns`, `councilApprovals`, `mkdtempSync`, `os`, `path`, `dossierMeta`, `telos`, `callTool` are already in scope.)

```javascript
// --- signed mode: converge THROUGH the hardened signature+provenance gate ---
process.env.TELOS_SECRET_CLAUDE = "test-claude";
process.env.TELOS_SECRET_AGY = "test-agy";
process.env.TELOS_SECRET_CODEX = "test-codex";
{
  const signedRoot = mkdtempSync(path.join(os.tmpdir(), "saas-forge-signed-"));
  const signedResult = await forge({
    projectRoot: signedRoot, telos, dossierMeta,
    makeGenerators: liveGenerators({ callTool }),
    makeBreakoutFns: makeCouncilFactFns({ callTool }),
    makeApprovals: councilApprovals({ callTool }),
    signed: true
  });
  assert.equal(signedResult.converged, true,
    `signed-mode forge must converge through the hardened gate; cycles=${JSON.stringify(signedResult.cycles)}`);
  assert.equal(signedResult.verdict.gate_status, "pass", "signed-mode gate passes");
  assert.equal(signedResult.verdict.headline_checks.signing_enforced, true, "signing enforced in the verdict");
  assert.equal(signedResult.verdict.headline_checks.provenance_enforced, true, "provenance enforced in the verdict");
}
// negative: a missing required secret must fail closed in signed mode.
{
  delete process.env.TELOS_SECRET_CODEX;
  const failRoot = mkdtempSync(path.join(os.tmpdir(), "saas-forge-signed-fail-"));
  const failResult = await forge({
    projectRoot: failRoot, telos, dossierMeta,
    makeGenerators: liveGenerators({ callTool }),
    makeBreakoutFns: makeCouncilFactFns({ callTool }),
    makeApprovals: councilApprovals({ callTool }),
    signed: true
  });
  assert.equal(failResult.converged, false, "signed mode without a required secret must not converge");
  const blockers = (failResult.verdict && failResult.verdict.blockers) || [];
  assert.ok(blockers.some((b) => /no secret to verify codex|signature invalid/i.test(b)),
    `expected a fail-closed signature blocker; got ${JSON.stringify(blockers)}`);
  process.env.TELOS_SECRET_CODEX = "test-codex";
}
delete process.env.TELOS_SECRET_CLAUDE;
delete process.env.TELOS_SECRET_AGY;
delete process.env.TELOS_SECRET_CODEX;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd saas-forge && node scripts/test-live.mjs`
Expected: FAIL — the signed run does not converge yet (`forge`/`runMarketGate` ignore `signed`).

- [ ] **Step 3: Carry `signer` on breakout records**

In `saas-forge/breakouts.mjs` line 52, change:

```javascript
    records.push({ ...record, checks, lens: ws.lens, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
```

to:

```javascript
    records.push({ ...record, checks, lens: ws.lens, signer: ws.signer, isUi: !!ws.isUi, finding: ws.finding, findingsKey: ws.findingsKey });
```

- [ ] **Step 4: Thread `signed` through `saas-forge/forge.mjs`**

(a) Add the import after the existing `validateRecords` import (near line 17):

```javascript
import { signMarketPacket } from "../build-gate/sign.mjs";
```

(b) Change `marketPacketFromRecord`'s signature (from `function marketPacketFromRecord(record, dossierMeta) {`):

```javascript
function marketPacketFromRecord(record, dossierMeta, { signed = false } = {}) {
```

and change its final two lines from:

```javascript
  packet[record.findingsKey] = [record.finding];
  return packet;
}
```

to:

```javascript
  packet[record.findingsKey] = [record.finding];
  return signed ? signMarketPacket(packet, record, record.signer) : packet;
}
```

(c) Change `runMarketGate` to accept and use `signed`. Change its signature from `function runMarketGate({ projectRoot, dossierMeta, teamRecords, approvals }) {` to:

```javascript
function runMarketGate({ projectRoot, dossierMeta, teamRecords, approvals, signed = false }) {
```

Add `trust_mode` to its dossier literal (immediately after `objective: dossierMeta.objective,`):

```javascript
    objective: dossierMeta.objective,
    trust_mode: signed ? "signed" : undefined,
```

and change its market map from:

```javascript
  const marketPackets = teamRecords.map((r) => marketPacketFromRecord(r, dossierMeta));
```

to:

```javascript
  const marketPackets = teamRecords.map((r) => marketPacketFromRecord(r, dossierMeta, { signed }));
```

(d) Add `signed = false,` to the `forge({ ... })` destructured parameters (after `makeApprovals = async ({ dossierMeta: dm }) => syntheticApprovals(dm),`):

```javascript
  makeApprovals = async ({ dossierMeta: dm }) => syntheticApprovals(dm),
  signed = false,
  maxCycles = 3
```

(e) Pass `signed` into the `runMarketGate` call. Change line 161 from:

```javascript
    verdict = teamsConverged ? runMarketGate({ projectRoot, dossierMeta, teamRecords: teams, approvals }) : null;
```

to:

```javascript
    verdict = teamsConverged ? runMarketGate({ projectRoot, dossierMeta, teamRecords: teams, approvals, signed }) : null;
```

- [ ] **Step 5: Thread `signed` through `saas-forge/live.mjs` `runForgeLive`**

Add `signed = false` to the `runForgeLive({ ... })` destructured parameters (alongside `team, reviewer, maxCycles = 3`):

```javascript
  team, reviewer, maxCycles = 3, signed = false
```

and add `signed` to the `forge({ ... })` call inside `runForgeLive`:

```javascript
      makeApprovals: councilApprovals({ callTool }),
      maxCycles,
      signed
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd saas-forge && node scripts/test-live.mjs`
Expected: prints the existing `test-live OK: ...` line with no assertion failures. (All saas-forge workstream `checks()` already include a `file_contains`, so the signed-mode sufficiency floor is satisfied. If a future workstream is existence-only and blocks on `"existence-only"`, add a `file_contains` check to its `checks()` in `saas-forge/workstreams.mjs`.)

- [ ] **Step 7: Run the full package suite**

Run: `cd saas-forge && npm test`
Expected: all suites pass, exit 0.

- [ ] **Step 8: Commit**

```bash
git add saas-forge/breakouts.mjs saas-forge/forge.mjs saas-forge/live.mjs saas-forge/scripts/test-live.mjs
git commit -m "feat(saas-forge): signed-mode gate opt-in (signed flag + signed market packets)"
```

---

## Cross-package verification (after all tasks)

- [ ] Run every affected package suite once more: `cd build-gate && npm test`, `cd ai-forge && npm test`, `cd saas-forge && npm test`. All exit 0.
- [ ] Confirm no `.telos/` artifacts or secrets were staged: `git status --short` shows only the intended source/test files.

## Self-Review (completed while writing this plan)

**Spec coverage:** toggle (explicit `signed` flag) → Tasks 2/3 Steps 4–5; approval packets already signed → no code (verified: `council.runSeat` signs with `secretFor` + `liveSeatCaller` provenance); market packets signed + attested → Task 1 + Tasks 2/3 Step 4b; `signer` on records → Tasks 2/3 Step 3; `reviewed_by_lens` preserved → Task 1; unsigned unchanged → signed branch is gated on `signed`, default `false`; tests incl. negative fail-closed → Tasks 2/3 Step 1; content-addressed `market-<sha256(record)>` → Task 1. All covered.

**Placeholder scan:** none — every step shows the exact edit. The one conditional ("if it blocks on existence-only") is a concrete, code-showing contingency, not a TODO.

**Type/name consistency:** `signMarketPacket(packet, record, signer)` is defined in Task 1 and consumed with that exact signature in Tasks 2/3. `record.signer` is produced in Step 3 of Tasks 2/3 and read in `marketPacketFromRecord`. `signed` flag name is consistent across `forge`, `runForgeLive`, `runMarketGate`, and `marketPacketFromRecord`. Verdict fields (`headline_checks.signing_enforced`, `.provenance_enforced`, `.gate_status`, `.blockers`) match `build-gate/gate.mjs`.
