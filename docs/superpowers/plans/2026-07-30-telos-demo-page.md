# TELOS Demo Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages site under `demo/` whose centerpiece verifies a real committed Ed25519 decision ledger and SHA-256 content bindings in the visitor's browser, where tampering genuinely breaks verification.

**Architecture:** A Node generator script imports `createOperator` from `forge/operator.mjs` (exactly as the fail-closed proof does), runs the proof's operator scenario once, and commits the resulting signed artifacts. A zero-dependency browser module ports the operator's canonicalization and verifies the committed artifacts with WebCrypto. Plain HTML/CSS/JS renders the five-section page. Deployment is GitHub Pages via workflow.

**Tech Stack:** Node ≥18 (generator + tests), Web Crypto API (Ed25519 verify, SHA-256 digest), plain ES modules, GitHub Actions Pages deployment. No frameworks, no build step, no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-07-30-telos-demo-page-design.md`

## Global Constraints

- Node ≥18; every test must pass on the CI matrix's Node 18 **and** 20.
- Zero runtime dependencies; no framework; no build step; no client-side Mermaid.
- No changes to existing gate, operator, ledger, or signing code — the generator only imports existing modules.
- No private key material is ever written under `demo/` — only `publicJwk` is exported.
- Artifacts are committed, not CI-generated; regeneration is a manual run-and-commit.
- Status vocabulary on the page is exactly `VERIFIED` / `BLOCKED` / `HALTED`.
- Visual identity: austere/deterministic — dark, monospace evidence panels, restrained palette, no mythological theming.
- WebCrypto absence or Ed25519 unsupport must produce an explicit message pointing to the local proof (`node docs/runs/fail-closed-demo/run.mjs`) — never silent degradation.
- Test style follows house convention (`forge/package.json`): plain assert scripts + `node --check` syntax gates, run via `npm test`.
- On Node 18, `globalThis.crypto` is not guaranteed — tests must inject `webcrypto.subtle` from `node:crypto`; browser code defaults to `globalThis.crypto.subtle`.
- Do not push to origin without the owner's explicit go.

## Key upstream facts (verified against the repo at `06d370f`)

`forge/operator.mjs` — the module the generator imports:

- `createOperator({ workdir, rulebook, bounds, actions, signerName })` returns `{ ledgerPath, inboxPath, publicJwk, runPass, verifyLedger, ... }`.
- Ledger records are JSONL, one per line: `{ kind: "ops-decision", at, signer, rule, outcome, reason?, ..., sig: { alg: "Ed25519", value: <base64>, signed_fields: "all-minus-sig" } }`.
- Signed bytes are `canonical(record-minus-sig)` encoded as UTF-8, where `canonical` is operator.mjs's module-private recursive sorted-key serializer (lines 32–42). It is **not** exported — which is why parity is proven end-to-end (Task 2), not by importing it.
- The out-of-bounds scenario (copied from `docs/runs/fail-closed-demo/run.mjs` lines 80–102) yields one decision with `outcome: "needs-human"` and one open inbox record in `needs-human.jsonl`.
- The operator writes `operator-keys.json` (contains **private** PEM) into `workdir` — the generator must use a temp workdir outside the repo and export only `publicJwk`.

## File Structure

```
demo/
  package.json              — house-style test scripts, engines node>=18   (Task 1)
  verify.js                 — canonical/entryBytes port + verifyDecision/verifyDigest  (Task 1)
  generate-artifacts.mjs    — runs operator scenario, writes artifacts/    (Task 2)
  artifacts/
    ledger.json             — array of real Ed25519-signed decision records (Task 2)
    public-key.jwk.json     — Ed25519 public JWK only                       (Task 2)
    record.json             — needs-human record + pinned SHA-256 digest    (Task 2)
  test/
    verify.test.mjs         — parity, artifact, and tamper tests            (Tasks 1–2)
  index.html                — five-section page                            (Tasks 3–4)
  style.css                 — austere identity                             (Tasks 3–4)
  app.js                    — DOM glue: render artifacts, verify/tamper/reset (Task 3)
  build-path.svg            — committed static diagram                     (Task 4)
.github/workflows/pages.yml — Pages deployment                             (Task 5)
.github/workflows/ci.yml    — add `demo` to package matrix (modify)        (Task 5)
```

---

### Task 1: Verification core (`demo/verify.js`) with end-to-end parity tests

**Files:**
- Create: `demo/package.json`
- Create: `demo/verify.js`
- Create: `demo/test/verify.test.mjs`

**Interfaces:**
- Consumes: `createOperator` from `forge/operator.mjs` (test only, for parity).
- Produces (used by Tasks 2–3):
  - `canonical(value) -> string`
  - `entryBytes(entry) -> Uint8Array` (UTF-8 of `canonical` with `sig` stripped)
  - `base64ToBytes(b64) -> Uint8Array`
  - `sha256Hex(bytes, subtle?) -> Promise<string>`
  - `verifyDecision(record, publicJwk, subtle?) -> Promise<{ok: boolean, reason: string}>` — reasons: `"ok" | "webcrypto-unavailable" | "ed25519-unsupported" | "unsupported-alg" | "missing-signature" | "invalid-signature"`
  - `verifyDigest(record, digest, subtle?) -> Promise<{ok: boolean, reason: string}>` — reasons: `"ok" | "webcrypto-unavailable" | "unsupported-alg" | "digest-mismatch"`

- [ ] **Step 1: Create `demo/package.json`**

```json
{
  "name": "telos-demo",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "TELOS demo page: in-browser verification of committed evidence.",
  "scripts": {
    "check": "node --check verify.js && node --check test/verify.test.mjs",
    "test": "npm run check && node test/verify.test.mjs"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `demo/test/verify.test.mjs`:

```js
#!/usr/bin/env node
// End-to-end parity: forge/operator.mjs signs; demo/verify.js must accept.
// Byte-level drift in the canonicalization port makes these tests fail.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { webcrypto } from "node:crypto";

import { createOperator } from "../../forge/operator.mjs";
import {
  canonical,
  entryBytes,
  base64ToBytes,
  sha256Hex,
  verifyDecision,
  verifyDigest
} from "../verify.js";

const subtle = webcrypto.subtle; // Node 18 has no global crypto — inject.

// ── canonical unit behavior ─────────────────────────────────────────────────
assert.equal(canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
assert.equal(canonical(null), "null");
assert.equal(canonical("x"), '"x"');

// entryBytes strips exactly `sig`
{
  const bytes = entryBytes({ z: 1, sig: { alg: "Ed25519", value: "AAA" } });
  assert.equal(new TextDecoder().decode(bytes), '{"z":1}');
}

// base64 round-trip
assert.deepEqual([...base64ToBytes("AQID")], [1, 2, 3]);

// ── end-to-end parity with the real signer ──────────────────────────────────
const workdir = mkdtempSync(path.join(os.tmpdir(), "telos-demo-test-"));
try {
  const op = createOperator({
    workdir,
    signerName: "demo-parity-test",
    rulebook: [{
      id: "overspend",
      when: () => true,
      act: () => ({
        action: "update_budget",
        args: { campaign_id: "fixture-campaign", daily_budget_cents: 2501 }
      })
    }],
    bounds: {
      update_budget: (args) => args.daily_budget_cents <= 2000
        ? true
        : `daily_budget_cents ${args.daily_budget_cents} over cap 2000`
    },
    actions: { update_budget: async () => ({ ok: true }) }
  });

  const result = await op.runPass({ source: "fixture" });
  assert.equal(result.decisions.length, 1);
  const record = result.decisions[0];
  assert.equal(record.sig?.alg, "Ed25519");

  // The ported verifier must accept what the real signer produced.
  const good = await verifyDecision(record, op.publicJwk, subtle);
  assert.deepEqual(good, { ok: true, reason: "ok" }, "port must verify real signature");

  // Tampering any top-level signed field must fail with invalid-signature.
  for (const field of Object.keys(record).filter((k) => k !== "sig")) {
    const tampered = { ...record, [field]: `${JSON.stringify(record[field])}-tampered` };
    const bad = await verifyDecision(tampered, op.publicJwk, subtle);
    assert.equal(bad.ok, false, `tampered '${field}' must fail`);
    assert.equal(bad.reason, "invalid-signature");
  }

  // Digest binding: pin, verify, tamper, fail.
  const inboxRecord = JSON.parse(readFileSync(op.inboxPath, "utf8").trim());
  const digest = {
    alg: "SHA-256",
    value: await sha256Hex(new TextEncoder().encode(canonical(inboxRecord)), subtle)
  };
  assert.deepEqual(await verifyDigest(inboxRecord, digest, subtle), { ok: true, reason: "ok" });
  const mutated = { ...inboxRecord, question: inboxRecord.question + " [tampered]" };
  assert.deepEqual(
    await verifyDigest(mutated, digest, subtle),
    { ok: false, reason: "digest-mismatch" }
  );

  // Failure-shape contract for the page's fail-closed messaging.
  // NOTE: pass null, not undefined — undefined would trigger the default
  // parameter (globalThis.crypto?.subtle), which exists on Node 20.
  assert.deepEqual(
    await verifyDecision(record, op.publicJwk, null),
    { ok: false, reason: "webcrypto-unavailable" }
  );
  assert.deepEqual(
    await verifyDecision({ ...record, sig: { ...record.sig, alg: "RSA" } }, op.publicJwk, subtle),
    { ok: false, reason: "unsupported-alg" }
  );
  assert.deepEqual(
    await verifyDecision({ ...record, sig: undefined }, op.publicJwk, subtle),
    { ok: false, reason: "missing-signature" }
  );
} finally {
  rmSync(workdir, { recursive: true, force: true });
}

process.stdout.write("verify.test.mjs: all assertions passed\n");
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd demo && npm test`
Expected: FAIL — `Cannot find module '../verify.js'`

- [ ] **Step 4: Write `demo/verify.js`**

```js
// verify.js — browser/Node verification of TELOS committed evidence.
//
// `canonical` and `entryBytes` are a line-for-line port of the module-private
// routines in forge/operator.mjs (the ledger's actual signer). Parity is
// enforced end-to-end by test/verify.test.mjs: the real operator signs, this
// module must verify. Any byte-level drift fails that test.

export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function entryBytes(entry) {
  const { sig, ...rest } = entry;
  return new TextEncoder().encode(canonical(rest));
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sha256Hex(bytes, subtle = globalThis.crypto?.subtle) {
  const buf = await subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyDecision(record, publicJwk, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return { ok: false, reason: "webcrypto-unavailable" };
  const sig = record?.sig;
  if (!sig || typeof sig.value !== "string") return { ok: false, reason: "missing-signature" };
  if (sig.alg !== "Ed25519") return { ok: false, reason: "unsupported-alg" };
  let key;
  try {
    key = await subtle.importKey("jwk", publicJwk, { name: "Ed25519" }, false, ["verify"]);
  } catch {
    return { ok: false, reason: "ed25519-unsupported" };
  }
  const ok = await subtle.verify("Ed25519", key, base64ToBytes(sig.value), entryBytes(record));
  return ok ? { ok: true, reason: "ok" } : { ok: false, reason: "invalid-signature" };
}

export async function verifyDigest(record, digest, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return { ok: false, reason: "webcrypto-unavailable" };
  if (digest?.alg !== "SHA-256") return { ok: false, reason: "unsupported-alg" };
  const hex = await sha256Hex(new TextEncoder().encode(canonical(record)), subtle);
  return hex === digest.value
    ? { ok: true, reason: "ok" }
    : { ok: false, reason: "digest-mismatch" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd demo && npm test`
Expected: PASS — `verify.test.mjs: all assertions passed`

- [ ] **Step 6: Also run on the other matrix Node if available; commit**

If `nvm` or a second Node is available, repeat under Node 18 and 20; otherwise note the CI matrix will cover it.

```bash
git add demo/package.json demo/verify.js demo/test/verify.test.mjs
git commit -m "feat(demo): verification core with end-to-end signer parity tests"
```

---

### Task 2: Artifact generator and committed artifacts

**Files:**
- Create: `demo/generate-artifacts.mjs`
- Create: `demo/artifacts/ledger.json` (generated, committed)
- Create: `demo/artifacts/public-key.jwk.json` (generated, committed)
- Create: `demo/artifacts/record.json` (generated, committed)
- Modify: `demo/test/verify.test.mjs` (append committed-artifact assertions)
- Modify: `demo/package.json` (add generator to `check`)

**Interfaces:**
- Consumes: `canonical`, `sha256Hex`, `verifyDecision`, `verifyDigest` from `demo/verify.js`; `createOperator` from `forge/operator.mjs`.
- Produces (fetched by Task 3's `app.js`):
  - `demo/artifacts/ledger.json` — JSON **array** of ledger records (parsed from the operator's JSONL).
  - `demo/artifacts/public-key.jwk.json` — the Ed25519 public JWK object.
  - `demo/artifacts/record.json` — `{ "record": <needs-human inbox record>, "digest": { "alg": "SHA-256", "value": "<hex>" } }`.

- [ ] **Step 1: Extend the test with committed-artifact assertions (failing first)**

Append to `demo/test/verify.test.mjs` (before the final `process.stdout.write`):

```js
// ── committed artifacts must verify (guards artifact drift/corruption) ──────
const artifactsDir = new URL("../artifacts/", import.meta.url);
const readArtifact = (name) =>
  JSON.parse(readFileSync(new URL(name, artifactsDir), "utf8"));

{
  const ledger = readArtifact("ledger.json");
  const publicJwk = readArtifact("public-key.jwk.json");
  const bound = readArtifact("record.json");

  assert.ok(Array.isArray(ledger) && ledger.length >= 1, "ledger.json must be a non-empty array");
  for (const rec of ledger) {
    assert.deepEqual(
      await verifyDecision(rec, publicJwk, subtle),
      { ok: true, reason: "ok" },
      "every committed ledger record must verify"
    );
    assert.equal(rec.outcome, "needs-human", "scenario decision must be needs-human");
  }
  assert.deepEqual(
    await verifyDigest(bound.record, bound.digest, subtle),
    { ok: true, reason: "ok" },
    "committed record digest must verify"
  );
  // Single-field tamper on committed artifacts must fail.
  const t1 = { ...ledger[0], signer: ledger[0].signer + "-tampered" };
  assert.equal((await verifyDecision(t1, publicJwk, subtle)).reason, "invalid-signature");
  const t2 = { ...bound.record, resolution: "self-approved" };
  assert.equal((await verifyDigest(t2, bound.digest, subtle)).reason, "digest-mismatch");
  // No private material anywhere in artifacts.
  for (const name of ["ledger.json", "public-key.jwk.json", "record.json"]) {
    const text = readFileSync(new URL(name, artifactsDir), "utf8");
    assert.ok(!/PRIVATE KEY|"d"\s*:/.test(text), `${name} must contain no private material`);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd demo && npm test`
Expected: FAIL — `ENOENT ... artifacts/ledger.json`

- [ ] **Step 3: Write `demo/generate-artifacts.mjs`**

```js
#!/usr/bin/env node
// generate-artifacts.mjs — produce the committed demo evidence.
//
// Runs the operator segment of docs/runs/fail-closed-demo/run.mjs once in a
// throwaway tmpdir (the operator writes PRIVATE keys into its workdir — that
// dir must never be inside the repo) and exports only public, verifiable
// artifacts. Manual run-and-commit; never executed in CI.

import { mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";

import { createOperator } from "../forge/operator.mjs";
import { canonical, sha256Hex, verifyDecision, verifyDigest } from "./verify.js";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts");
const workdir = mkdtempSync(path.join(os.tmpdir(), "telos-demo-artifacts-"));

try {
  const op = createOperator({
    workdir,
    signerName: "telos-demo",
    rulebook: [{
      id: "overspend",
      when: () => true,
      act: () => ({
        action: "update_budget",
        args: { campaign_id: "fixture-campaign", daily_budget_cents: 2501 }
      })
    }],
    bounds: {
      update_budget: (args) => args.daily_budget_cents <= 2000
        ? true
        : `daily_budget_cents ${args.daily_budget_cents} over cap 2000`
    },
    actions: { update_budget: async () => ({ ok: true }) }
  });

  const result = await op.runPass({ source: "demo-artifact-generation" });
  if (result.decisions.length !== 1 || result.decisions[0].outcome !== "needs-human") {
    throw new Error("scenario drifted: expected exactly one needs-human decision");
  }

  const ledger = readFileSync(op.ledgerPath, "utf8")
    .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const inboxRecord = JSON.parse(readFileSync(op.inboxPath, "utf8").trim());
  const digest = {
    alg: "SHA-256",
    value: await sha256Hex(new TextEncoder().encode(canonical(inboxRecord)), webcrypto.subtle)
  };

  // Self-check before writing anything: exported evidence must verify.
  for (const rec of ledger) {
    const v = await verifyDecision(rec, op.publicJwk, webcrypto.subtle);
    if (!v.ok) throw new Error(`generated ledger record failed verification: ${v.reason}`);
  }
  const d = await verifyDigest(inboxRecord, digest, webcrypto.subtle);
  if (!d.ok) throw new Error(`generated digest failed verification: ${d.reason}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const save = (name, value) =>
    writeFileSync(path.join(OUT_DIR, name), JSON.stringify(value, null, 2) + "\n");
  save("ledger.json", ledger);
  save("public-key.jwk.json", op.publicJwk);
  save("record.json", { record: inboxRecord, digest });
  process.stdout.write(`artifacts written to ${OUT_DIR}\n`);
} finally {
  rmSync(workdir, { recursive: true, force: true }); // private keys die here
}
```

- [ ] **Step 4: Add the generator to the syntax check**

In `demo/package.json`, replace the `check` script line with:

```json
    "check": "node --check verify.js && node --check generate-artifacts.mjs && node --check test/verify.test.mjs",
```

- [ ] **Step 5: Generate the artifacts**

Run: `node demo/generate-artifacts.mjs`
Expected: `artifacts written to .../demo/artifacts`

- [ ] **Step 6: Run test to verify it passes**

Run: `cd demo && npm test`
Expected: PASS — `verify.test.mjs: all assertions passed`

- [ ] **Step 7: Inspect artifacts, then commit**

Run: `cat demo/artifacts/public-key.jwk.json` — confirm it has `"kty": "OKP"`, `"crv": "Ed25519"`, `"x"`, and **no `"d"` field**.

```bash
git add demo/generate-artifacts.mjs demo/artifacts demo/package.json demo/test/verify.test.mjs
git commit -m "feat(demo): committed evidence artifacts + generator with self-check"
```

---

### Task 3: Centerpiece demo panel (`app.js` + minimal page harness)

**Files:**
- Create: `demo/index.html` (harness version — completed in Task 4)
- Create: `demo/style.css` (panel styles — completed in Task 4)
- Create: `demo/app.js`
- Modify: `demo/test/verify.test.mjs` (structure smoke test)
- Modify: `demo/package.json` (add app.js to `check`)

**Interfaces:**
- Consumes: `verifyDecision`, `verifyDigest` from `demo/verify.js`; the three artifact files via `fetch`.
- Produces: DOM contract used by Task 4 — element ids `#evidence-panel`, `#status-panel`, `#btn-verify`, `#btn-reset`; status classes `.status-verified`, `.status-blocked`, `.status-halted`, `.status-error`.

- [ ] **Step 1: Extend the test with a page-structure smoke test (failing first)**

Append to `demo/test/verify.test.mjs` (before the final `process.stdout.write`):

```js
// ── page structure smoke test (drift guard for the DOM contract) ────────────
{
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const needle of [
    'id="evidence-panel"',
    'id="status-panel"',
    'id="btn-verify"',
    'id="btn-reset"',
    'src="app.js"',
    'href="style.css"',
    "docs/runs/fail-closed-demo/run.mjs"
  ]) {
    assert.ok(html.includes(needle), `index.html must contain ${needle}`);
  }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd demo && npm test`
Expected: FAIL — `ENOENT ... index.html`

- [ ] **Step 3: Write the harness `demo/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TELOS — evidence over confidence</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <!-- Task 4 adds hero/build-path/proof/footer around this section. -->
    <section id="tamper-demo" aria-labelledby="demo-heading">
      <h2 id="demo-heading">Verify the committed evidence</h2>
      <p class="demo-lede">
        This ledger entry was signed with Ed25519 by the real TELOS operator and
        committed to the repository. Your browser verifies it — click any value
        to tamper with it, then verify again.
      </p>
      <div id="evidence-panel" aria-live="polite"></div>
      <div class="demo-controls">
        <button id="btn-verify" type="button">Verify</button>
        <button id="btn-reset" type="button">Reset</button>
      </div>
      <div id="status-panel" role="status"></div>
      <p class="demo-footnote">
        Seat packets are HMAC-signed — symmetric, so a browser demo of them
        would be theater. That half of the proof runs on your machine:
        <code>node docs/runs/fail-closed-demo/run.mjs</code>
      </p>
    </section>
  </main>
  <script type="module" src="app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `demo/app.js`**

```js
// app.js — DOM glue for the tamper demo. All verification logic lives in
// verify.js; this file only renders artifacts, collects edits, and reports
// the named result of each real check.

import { verifyDecision, verifyDigest } from "./verify.js";

const state = { committed: null, working: null };
const $ = (id) => document.getElementById(id);

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function renderStatus(kind, title, detail) {
  const panel = $("status-panel");
  panel.className = `status-${kind}`;
  panel.innerHTML = "";
  const h = document.createElement("strong");
  h.textContent = title;
  const p = document.createElement("span");
  p.textContent = detail;
  panel.append(h, p);
}

// Render one JSON object as a definition list of click-to-edit leaf fields.
// `path` addresses the field inside the working copy for edit-writeback.
function renderObject(container, obj, path) {
  const dl = document.createElement("dl");
  for (const [key, value] of Object.entries(obj)) {
    const dt = document.createElement("dt");
    dt.textContent = key;
    const dd = document.createElement("dd");
    if (value && typeof value === "object") {
      renderObject(dd, value, [...path, key]);
    } else {
      dd.textContent = JSON.stringify(value);
      dd.tabIndex = 0;
      dd.className = "editable";
      dd.title = "Click to tamper with this field";
      dd.addEventListener("click", () => beginEdit(dd, [...path, key]));
    }
    dl.append(dt, dd);
  }
  container.append(dl);
}

function beginEdit(dd, path) {
  const input = document.createElement("input");
  input.value = dd.textContent;
  dd.replaceChildren(input);
  input.focus();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
  input.addEventListener("blur", () => {
    let parsed;
    try { parsed = JSON.parse(input.value); } catch { parsed = input.value; }
    let target = state.working;
    for (const k of path.slice(0, -1)) target = target[k];
    target[path.at(-1)] = parsed;
    dd.textContent = JSON.stringify(parsed);
    dd.classList.add("tampered");
    renderStatus("halted", "HALTED", "Evidence edited — verification pending. Click Verify.");
  });
}

function renderEvidence() {
  const panel = $("evidence-panel");
  panel.innerHTML = "";
  const ledgerBox = document.createElement("div");
  ledgerBox.className = "evidence-box";
  ledgerBox.innerHTML = "<h3>Ed25519 decision ledger entry</h3>";
  renderObject(ledgerBox, state.working.ledger[0], ["ledger", 0]);
  const recordBox = document.createElement("div");
  recordBox.className = "evidence-box";
  recordBox.innerHTML = "<h3>Content-addressed needs-human record</h3>";
  renderObject(recordBox, state.working.bound.record, ["bound", "record"]);
  panel.append(ledgerBox, recordBox);
}

async function runVerification() {
  const { ledger, publicJwk, bound } = state.working;
  const sig = await verifyDecision(ledger[0], publicJwk);
  if (!sig.ok) {
    if (sig.reason === "webcrypto-unavailable" || sig.reason === "ed25519-unsupported") {
      renderStatus("error", "CANNOT VERIFY HERE",
        `This browser lacks ${sig.reason === "ed25519-unsupported" ? "Ed25519 WebCrypto" : "WebCrypto"}. ` +
        "Run the proof locally: node docs/runs/fail-closed-demo/run.mjs");
    } else {
      renderStatus("blocked", "BLOCKED", `Ed25519 check failed: ${sig.reason}`);
    }
    return;
  }
  const dig = await verifyDigest(bound.record, bound.digest);
  if (!dig.ok) {
    renderStatus("blocked", "BLOCKED", `content-address check failed: ${dig.reason}`);
    return;
  }
  renderStatus("verified", "VERIFIED",
    "Ed25519 signature valid against the committed public key; SHA-256 content address matches.");
}

async function loadArtifacts() {
  const get = async (name) => {
    const res = await fetch(`artifacts/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    return res.json();
  };
  return {
    ledger: await get("ledger.json"),
    publicJwk: await get("public-key.jwk.json"),
    bound: await get("record.json")
  };
}

async function main() {
  try {
    state.committed = await loadArtifacts();
  } catch (err) {
    renderStatus("error", "EVIDENCE UNAVAILABLE",
      `Could not load committed artifacts (${err.message}). The demo fails closed rather than showing fake data.`);
    return;
  }
  state.working = deepClone(state.committed);
  renderEvidence();
  $("btn-verify").addEventListener("click", runVerification);
  $("btn-reset").addEventListener("click", () => {
    state.working = deepClone(state.committed);
    renderEvidence();
    renderStatus("halted", "RESET", "Committed evidence restored. Click Verify.");
  });
  await runVerification();
}

main();
```

- [ ] **Step 5: Write minimal `demo/style.css` (panel + status only; Task 4 completes it)**

```css
:root {
  --bg: #0b0e11;
  --panel: #12161b;
  --edge: #232a32;
  --fg: #d7dde3;
  --muted: #8b949e;
  --verified: #3fb950;
  --blocked: #f85149;
  --halted: #d29922;
  --mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--mono); line-height: 1.5; }
main { max-width: 60rem; margin: 0 auto; padding: 2rem 1rem; }
.evidence-box { background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
.evidence-box h3 { margin: 0 0 .5rem; font-size: .85rem; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: .15rem .75rem; }
dt { color: var(--muted); }
dd { margin: 0; word-break: break-all; }
dd.editable { cursor: pointer; border-bottom: 1px dashed var(--edge); }
dd.editable:hover { color: #fff; border-bottom-color: var(--halted); }
dd.tampered { color: var(--halted); }
dd input { width: 100%; background: var(--bg); color: var(--fg); border: 1px solid var(--halted); font: inherit; padding: .1rem .3rem; }
.demo-controls { display: flex; gap: .75rem; margin: 1rem 0; }
button { background: var(--panel); color: var(--fg); border: 1px solid var(--edge); border-radius: 6px; padding: .5rem 1.25rem; font: inherit; cursor: pointer; }
button:hover { border-color: var(--muted); }
#status-panel { border-radius: 6px; padding: .75rem 1rem; display: flex; gap: .75rem; align-items: baseline; }
#status-panel strong { letter-spacing: .1em; }
.status-verified { border: 1px solid var(--verified); color: var(--verified); }
.status-blocked { border: 1px solid var(--blocked); color: var(--blocked); }
.status-halted { border: 1px solid var(--halted); color: var(--halted); }
.status-error { border: 1px solid var(--blocked); color: var(--fg); }
.demo-footnote, .demo-lede { color: var(--muted); font-size: .9rem; }
code { color: var(--fg); }
```

- [ ] **Step 6: Add app.js to the syntax check**

In `demo/package.json`, replace the `check` script line with:

```json
    "check": "node --check verify.js && node --check generate-artifacts.mjs && node --check app.js && node --check test/verify.test.mjs",
```

- [ ] **Step 7: Run tests**

Run: `cd demo && npm test`
Expected: PASS — `verify.test.mjs: all assertions passed`

- [ ] **Step 8: Manual browser verification**

Run: `cd demo && python3 -m http.server 8912` (any static server; `fetch` requires http, not file://).
Open `http://localhost:8912`. Confirm: initial state shows `VERIFIED`; clicking a ledger field (e.g. `signer`), editing it, and pressing Verify shows `BLOCKED — Ed25519 check failed: invalid-signature`; editing a record field shows `BLOCKED — content-address check failed: digest-mismatch`; Reset then Verify returns to `VERIFIED`. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add demo/index.html demo/style.css demo/app.js demo/package.json demo/test/verify.test.mjs
git commit -m "feat(demo): interactive tamper demo panel with fail-closed messaging"
```

---

### Task 4: Complete page — hero, build path, proof, footer

**Files:**
- Modify: `demo/index.html` (wrap the centerpiece with the remaining four sections)
- Modify: `demo/style.css` (append section styles)
- Create: `demo/build-path.svg`
- Modify: `demo/test/verify.test.mjs` (extend structure smoke test)

**Interfaces:**
- Consumes: Task 3's DOM contract (must not rename any Task 3 element id).
- Produces: the final page; no code interfaces.

- [ ] **Step 1: Extend the structure smoke test (failing first)**

In the page-structure block of `demo/test/verify.test.mjs`, extend the needle array to:

```js
  for (const needle of [
    'id="evidence-panel"',
    'id="status-panel"',
    'id="btn-verify"',
    'id="btn-reset"',
    'src="app.js"',
    'href="style.css"',
    "docs/runs/fail-closed-demo/run.mjs",
    'id="hero"',
    'id="build-path"',
    'id="run-the-proof"',
    'src="build-path.svg"',
    "https://github.com/dsmcewan/TELOS",
    "rubber-stamp its own mistakes"
  ]) {
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd demo && npm test`
Expected: FAIL — `index.html must contain id="hero"`

- [ ] **Step 3: Write `demo/build-path.svg`**

A hand-authored static equivalent of the README's Mermaid flowchart (no client-side rendering). Committed once:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 170" role="img"
     aria-label="TELOS governed build path: idea to plan DAG, to model seats, to deterministic gate, to The Eye">
  <style>
    .box { fill: #12161b; stroke: #232a32; rx: 6; }
    .label { fill: #d7dde3; font: 13px ui-monospace, Menlo, Consolas, monospace; text-anchor: middle; }
    .sub { fill: #8b949e; font: 11px ui-monospace, Menlo, Consolas, monospace; text-anchor: middle; }
    .arrow { stroke: #8b949e; stroke-width: 1.5; marker-end: url(#head); }
  </style>
  <defs>
    <marker id="head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8" fill="none" stroke="#8b949e"/>
    </marker>
  </defs>
  <rect class="box" x="10"  y="55" width="150" height="60"/>
  <text class="label" x="85"  y="80">idea + telos</text>
  <text class="sub"   x="85"  y="98">goal / contract</text>
  <rect class="box" x="200" y="55" width="150" height="60"/>
  <text class="label" x="275" y="80">plan DAG</text>
  <text class="sub"   x="275" y="98">hashed, immutable</text>
  <rect class="box" x="390" y="55" width="160" height="60"/>
  <text class="label" x="470" y="80">model seats</text>
  <text class="sub"   x="470" y="98">claude · agy · codex</text>
  <rect class="box" x="590" y="55" width="160" height="60"/>
  <text class="label" x="670" y="80">deterministic gate</text>
  <text class="sub"   x="670" y="98">disk + signatures</text>
  <rect class="box" x="790" y="55" width="120" height="60"/>
  <text class="label" x="850" y="80">The Eye</text>
  <text class="sub"   x="850" y="98">human authority</text>
  <line class="arrow" x1="160" y1="85" x2="196" y2="85"/>
  <line class="arrow" x1="350" y1="85" x2="386" y2="85"/>
  <line class="arrow" x1="550" y1="85" x2="586" y2="85"/>
  <line class="arrow" x1="750" y1="85" x2="786" y2="85"/>
</svg>
```

- [ ] **Step 4: Complete `demo/index.html`**

Replace the `<main>` contents so the five sections wrap the untouched Task 3 centerpiece:

```html
  <main>
    <header id="hero">
      <p class="hero-kicker">TELOS</p>
      <h1>An AI agent that grades its own work can rubber-stamp its own mistakes.</h1>
      <p class="hero-sub">
        TELOS separates generation from certification: models may propose,
        implement, and review, but merge-readiness comes from disk evidence,
        content hashes, signatures, and provenance — not a model's self-report.
      </p>
      <p class="hero-links">
        <a href="https://github.com/dsmcewan/TELOS">Repository</a>
        <a href="https://github.com/dsmcewan/TELOS/actions/workflows/ci.yml">
          <img src="https://github.com/dsmcewan/TELOS/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
      </p>
    </header>

    <!-- Task 3's #tamper-demo section goes here, unchanged. -->

    <section id="build-path" aria-labelledby="build-path-heading">
      <h2 id="build-path-heading">The governed build path</h2>
      <img src="build-path.svg" alt="TELOS governed build path: idea to plan DAG, to model seats, to deterministic gate, to The Eye" width="920" height="170">
      <p>
        Plans are compiled and content-hashed before any seat sees them. The
        required council (claude, agy, codex) signs approval packets bound to
        those hashes. A deterministic gate — not a model — certifies
        <code>merge_status: "ready"</code> from disk. Acceptance and merge stay
        with The Eye, a human.
      </p>
    </section>

    <section id="run-the-proof" aria-labelledby="proof-heading">
      <h2 id="proof-heading">Run the real proof</h2>
      <p>
        Your browser just verified what it honestly can. Your machine can verify
        the rest — from a fresh clone, no install, no API key, no network:
      </p>
      <pre><code>node docs/runs/fail-closed-demo/run.mjs</code></pre>
      <pre class="proof-output"><code>BLOCKED  tampered required-seat packet: signature invalid
HALTED   out-of-bounds action: not executed; needs-human recorded
VERIFIED HMAC gate + Ed25519 decision ledger; tamper rejected</code></pre>
    </section>

    <footer>
      <p>Node ≥18 · zero runtime dependencies · MIT ·
        <a href="https://github.com/dsmcewan/TELOS">github.com/dsmcewan/TELOS</a></p>
    </footer>
  </main>
```

- [ ] **Step 5: Append section styles to `demo/style.css`**

```css
#hero { margin: 1rem 0 3rem; }
.hero-kicker { color: var(--muted); letter-spacing: .35em; text-transform: uppercase; margin: 0 0 .5rem; }
#hero h1 { font-size: 1.6rem; line-height: 1.35; margin: 0 0 1rem; font-weight: 600; }
.hero-sub { color: var(--muted); max-width: 46rem; }
.hero-links { display: flex; gap: 1rem; align-items: center; }
a { color: #58a6ff; text-decoration: none; }
a:hover { text-decoration: underline; }
section { margin: 3rem 0; }
h2 { font-size: 1.1rem; letter-spacing: .05em; }
#build-path img { max-width: 100%; height: auto; }
pre { background: var(--panel); border: 1px solid var(--edge); border-radius: 6px; padding: .75rem 1rem; overflow-x: auto; }
.proof-output code { color: var(--muted); }
footer { border-top: 1px solid var(--edge); margin-top: 3rem; padding-top: 1rem; color: var(--muted); font-size: .85rem; }
```

- [ ] **Step 6: Run tests**

Run: `cd demo && npm test`
Expected: PASS — `verify.test.mjs: all assertions passed`

- [ ] **Step 7: Manual browser verification**

Serve again (`cd demo && python3 -m http.server 8912`), open `http://localhost:8912`. Confirm: hero + demo fit above the fold at 1366×768; tamper flow still works end-to-end; the SVG renders; no horizontal page scroll at 375px width (evidence boxes scroll internally). Take a screenshot for the record. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add demo/index.html demo/style.css demo/build-path.svg demo/test/verify.test.mjs
git commit -m "feat(demo): complete five-section page around the tamper demo"
```

---

### Task 5: CI matrix entry and Pages deployment workflow

**Files:**
- Modify: `.github/workflows/ci.yml` (add `demo` to the package matrix)
- Create: `.github/workflows/pages.yml`

**Interfaces:**
- Consumes: `demo/package.json`'s `npm test` (Tasks 1–4); the static files under `demo/`.
- Produces: CI coverage for the demo suite; the deployed site at `https://dsmcewan.github.io/TELOS/`.

- [ ] **Step 1: Add `demo` to the CI package matrix**

In `.github/workflows/ci.yml`, the matrix currently ends:

```yaml
          - lachesis
          - atropos
```

Append one entry:

```yaml
          - lachesis
          - atropos
          - demo
```

- [ ] **Step 2: Run the demo suite exactly as CI will**

Run: `cd demo && npm test`
Expected: PASS (CI runs `npm test` with `working-directory: demo`; same command).

- [ ] **Step 3: Create `.github/workflows/pages.yml`**

```yaml
# Deploys demo/ to GitHub Pages. `enablement: true` creates the Pages site on
# first run (works on public repos — same pattern as the Convergence demo).
name: Deploy demo to Pages

on:
  push:
    branches: [main]
    paths: ['demo/**', '.github/workflows/pages.yml']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Setup Pages
        uses: actions/configure-pages@v6
        with:
          enablement: true
      - name: Upload demo directory
        uses: actions/upload-pages-artifact@v4
        with:
          path: demo
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Validate workflow syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/pages.yml')); yaml.safe_load(open('.github/workflows/ci.yml')); print('valid yaml')"`
Expected: `valid yaml`

Contingency: if the demo CI job later fails on Node 18 with an Ed25519
WebCrypto unsupported error (older 18.x lines), exclude that one combination
in `ci.yml` rather than dropping the suite:

```yaml
        exclude:
          - node-version: '18'
            package: demo
```

- [ ] **Step 5: Confirm the untouched fail-closed proof still passes**

Run: `node docs/runs/fail-closed-demo/run.mjs`
Expected output ends with: `{"ok":true,...}` — proves no existing behavior changed.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/pages.yml
git commit -m "ci(demo): add demo to test matrix; deploy demo/ to GitHub Pages"
```

- [ ] **Step 7: Hold for the owner's explicit push authorization**

Do NOT push. Report the branch state and wait for the owner's go. After push + merge to main, the Pages workflow deploys; verify `https://dsmcewan.github.io/TELOS/` returns 200 and re-run the Task 4 manual checks against the live URL.
