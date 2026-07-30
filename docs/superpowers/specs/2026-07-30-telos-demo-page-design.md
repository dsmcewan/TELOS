# Design: TELOS demo page — in-browser verification of committed evidence

**Date:** 2026-07-30
**Status:** Design direction selected in this session; implementation planning
and implementation authority remain separate later steps.
**Repository baseline:** `git:06d370fa853381df99fc33a1cfa4c2cadea7d511`
**Scope label:** "demo page" means a static GitHub Pages site under `demo/`.
It is not a release, package, or publication decision beyond enabling Pages
for this public repository.

## Problem

TELOS is the only featured project on the owner's profile with no live page:
Convergence and CrossroadThreads both serve working GitHub Pages demos, while
`dsmcewan.github.io/TELOS` returns 404 and the repository has no Pages
configuration. A portfolio visitor arriving from the profile README gets a
(good) wall of prose and a proof command they would have to clone and run.

The audience for the page is portfolio visitors — recruiters and peers who
should understand what TELOS is and why it matters in under two minutes.

## Design constraint: the demo must pass TELOS's own standard

A demo that *claims* fail-closed behavior while showing a canned animation
would be exactly the rubber-stamping TELOS exists to reject. The page must
verify real committed evidence in the visitor's browser, and must be honest
about what a browser cannot verify.

The cryptographic reality (from `build-gate/sign.mjs` and
`forge/operator.mjs`):

- **Seat packets are HMAC-SHA256** (symmetric). Browser verification would
  require shipping the secret, and any secret-holder can re-sign a tampered
  packet. A browser HMAC tamper demo is therefore theater and is excluded.
- **The decision ledger is Ed25519** (asymmetric). The public JWK can be
  shipped safely; the browser can genuinely verify signatures, and a visitor
  who tampers with a signed field cannot repair the signature.
- **Content-address digests are SHA-256** over canonicalized records. Anyone
  can recompute them with no key at all.

So the in-browser demo verifies the Ed25519 ledger and SHA-256 content
bindings for real, and states plainly — mirroring the `HONEST RESIDUAL`
comment in `sign.mjs` — that HMAC packet verification belongs to the
secret-holder and is demonstrated by the local fail-closed proof instead.

## Page content (single page, five sections)

1. **Hero.** The thesis ("An AI agent that grades its own work can
   rubber-stamp its own mistakes."), one line on what TELOS is, CI badge,
   repository link. Visual identity: austere/deterministic — dark, monospace
   evidence panels, ledger-like layout, restrained palette. The repo's own
   status vocabulary (`VERIFIED` / `BLOCKED` / `HALTED`) is the visual
   language. No mythological theming.
2. **Tamper demo (centerpiece).** A ledger panel renders a real committed
   Ed25519-signed decision entry and a content-addressed record. Visitor
   actions:
   - **Verify** — WebCrypto checks the Ed25519 signature against the
     committed public JWK and recomputes the SHA-256 content digest →
     `VERIFIED`.
   - **Tamper** — click any field to edit it, re-verify → `BLOCKED
     invalid-signature` or `BLOCKED digest-mismatch`, naming the exact
     failing check.
   - **Reset** — restore the committed artifacts.
3. **Governed build path.** The README's flowchart (idea → plan DAG → seats →
   gate → The Eye) as a committed static SVG (rendered once from the Mermaid
   source, not rendered client-side) with one short paragraph.
4. **Run the real proof.** The `node docs/runs/fail-closed-demo/run.mjs`
   command with expected output, framed as: the browser verified what it
   honestly can; your machine can verify the rest.
5. **Footer.** Node ≥18 · zero runtime dependencies · MIT · links.

Hero plus centerpiece fit above the fold; a visitor who never scrolls still
gets the whole thesis.

## Mechanics

### Artifact generation — `demo/generate-artifacts.mjs`

Node script importing `createOperator` from `forge/operator.mjs` exactly as
`docs/runs/fail-closed-demo/run.mjs` does. Runs the operator segment of the
fail-closed proof's scenario (an out-of-bounds action is proposed, never
executed, and its needs-human decision is recorded to the ledger) and writes:

- `demo/artifacts/ledger.json` — real Ed25519-signed decision entries;
- `demo/artifacts/public-key.jwk.json` — the public JWK only, no private
  material;
- `demo/artifacts/record.json` — a content-addressed record with its pinned
  SHA-256 digest.

Artifacts are **committed**, not CI-generated: stable, reviewable, and the
page fetches only what is on disk. Regeneration is a manual run-and-commit.

### Browser verification — `demo/verify.js`

Zero-dependency ES module. The canonicalization function is a line-for-line
port of `forge/operator.mjs`'s `canonical`/`entryBytes` (sorted keys, `sig`
stripped) — the routine the ledger signer actually uses. Parity is proven
end-to-end rather than by string comparison: a Node test creates a fresh
operator, signs real decisions, and requires the ported verifier to accept
them — byte-level drift in the port makes signature verification fail. Ed25519 via
`crypto.subtle.importKey`/`crypto.subtle.verify`; digests via
`crypto.subtle.digest`. If the browser lacks Ed25519 WebCrypto support, the
page says so explicitly and shows the local one-liner — fail-closed
messaging, never silent degradation.

### UI — `demo/index.html`, `demo/style.css`, `demo/app.js`

No framework, no build step. Fields render from the artifact JSON and are
click-to-edit; Verify re-runs the real checks; the status panel names the
exact failing check. Artifact fetch failure renders an explicit error state,
never a blank demo.

## Repository layout

Everything under `demo/` at the repository root:

```
demo/
  index.html
  style.css
  app.js
  verify.js
  generate-artifacts.mjs
  artifacts/
    ledger.json
    public-key.jwk.json
    record.json
  test/
    verify.test.mjs
```

## Deployment

`.github/workflows/pages.yml`: `actions/configure-pages` with
`enablement: true` (the pattern Convergence proves works on public repos),
`upload-pages-artifact` on `demo/`, `deploy-pages`. Triggered on pushes to
`main` touching `demo/**`, plus `workflow_dispatch`.

## Testing

`demo/test/verify.test.mjs`, run under Node and added to the CI package
matrix like every other TELOS package suite:

1. **Canonicalize parity** — the browser-port `canonicalize` output equals
   `build-gate/sign.mjs`'s for a set of fixture objects (nested, arrays,
   key-order permutations).
2. **Committed artifacts verify** — signature and digest checks pass against
   the committed files using Node crypto.
3. **Tampered copies fail** — single-field mutations of each artifact fail
   verification with the expected reason.

Manual browser screenshot check before shipping.

## Out of scope

- Any change to gate, operator, ledger, or signing code. The generator only
  imports existing modules.
- HMAC seat-packet verification in the browser (excluded by design, above).
- Regenerating artifacts in CI.
- Mythological theming.
