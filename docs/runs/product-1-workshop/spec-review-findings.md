# FROZEN SPEC — v0.2.0 productization review findings (verified at fc0fa05)

This is un-reviewable frozen material the candidate approach must satisfy. A
genuine defect here escalates to the Eye (plan-escalation), not resolved in the
workshop. Every item was independently re-verified against release commit
fc0fa05 by three exploration passes.

## Release blockers (10)
1. Hestia ship gate binds nothing cryptographically — any http URL accepted;
   ship-agent free text trusted as merge evidence. (hestia.js:120,191-199)
2. ai-native-memory gate grants authority from stale/nonexistent derivations —
   compares stored `expected`, never re-derives from `derived_from`; authority
   path unconfined. (gate.mjs:68-73,280-288)
3. `--verify-committed` validates at the recorded input head (ebc2cd0), not the
   checked-out release (fc0fa05); stale test-metrics blob stays green.
   (run.mjs:563; summary.json:3)
4. Meta Ads MCP ungoverned — no manifest/CI; `META_MAX_DAILY_CENTS=Infinity`
   defeats the cap; ids/kinds interpolated into API paths unvalidated.
   (server.mjs:21,83,103,118)
5. Memory auditor reports clean on zero discovered record sets; direct
   memory-root invocation finds nothing; 5 of 8 record kinds uninspected.
   (audit.mjs:210-233)
6. No reproducible release contract — 13 private manifests (12× 0.1.0, clotho
   0.0.0; v4-* names); no workspace/release-workflow/SBOM/attestation/checksums/
   publish-allowlist; lightweight tag, no assets.
7. Flagship failure/mobile not ship-ready — 375×667 overflow w/ scroll
   forbidden; lazy-WebGL failure blanks the DOM app (no error boundary); demo
   malformed base64 stuck on "verification pending"; desktop-Chromium-only e2e,
   no a11y audit.
8. Pages deploys from a main push, not a required-CI exact-SHA artifact; flagship
   never deployed.
9. Review action SHA-pinned but downloads mutable marketplace plugin code with
   PR-write + OIDC + OAuth token.
10. 13 Inter/JetBrains Mono WOFF2 ship without OFL-1.1 texts/notices.

## Governance corrections (7)
a. AM-42 changed the five-root plan without the successor-plan/re-authorization
   sequence.
b. Root zero-dependency invariant contradicts the flagship exception yet is never
   swept.
c. Enrollment one-to-one check permits duplicates (315/315 with a dupe fixture).
d. Normative oracles checked for presence, not existence/runnability.
e. Build Gate lets unsigned legacy dossiers reach gate_status:pass.
f. Three DRAFT workflow docs ingested as normative.
g. ai-native plugin not self-contained (authority points outside the plugin dir).

The candidate must close every blocker and correction, fail-closed, with a
regression test per enforcement change; distribution/product-contract items per
the Master Checklist frozen spec; and honor the Eye's S0-gate rulings recorded in
the pre-review.
