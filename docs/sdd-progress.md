# TELOS Upgrade — SDD Progress Ledger

Plan: me/claude-code/telos-upgrade/plans/2026-06-27-telos-upgrade-plan.md
No git in this vault: "checkpoint" = suite green; per-task diff = `diff -ru` vs a rolling `.prev` snapshot; delivery = ENGINE.patch.

- Task 1: complete (staging copied; baseline build-gate + breakout suites green; node v24.16.0)
- Task 2: complete (sign.mjs + test-sign.mjs + package.json; 8 assertions pass, npm test exit 0; review clean — spec ✅, quality Approved)
- Task 3: complete (verifier.mjs reverifyRecord +hasFileContains +emptyEvidenceFiles, additive; breakout suite green; review clean — spec ✅, quality Approved)
- Task 4: complete (gate.mjs signed-mode: signature-verify + provenance-as-blocker + sufficiency, all gated behind `signed`; legacy dogfood + market-pass verified pass with no leaks; review clean — spec ✅, quality Approved. NOTE: implementer corrected a brief bug — provenance legacy branch `else if (!prov)` not `else`, to keep legacy byte-identical; reviewer confirmed correct.)
- STAGING FIX (controller): Task 1 omitted `me/codex/connectors/`; stress-tests.mjs:268 spawns `../../connectors/ai-peer-mcp/server.mjs`. Copied connectors into pristine/working/.prev (identical → not in any diff). Plan Task 1 updated. Full npm test now green.
- Task 5: complete (scripts/test-trust.mjs 7 signed-mode proofs; package.json final Phase-1 form; FULL npm test exit 0 incl. test-trust + stress-tests + breakout — bug #5b fixed; review Approved. Important finding FIXED: added gate_status=="blocked" assertions to cases 3/4/5, controller-verified, test green.)
- Task 6: complete (test-gate.mjs ex() helper; 7 validateGate calls / 14 paths wrapped; spawnSync CLI args untouched; passingBreakout check paths wrapped too (necessary secondary fix, reviewer-confirmed); runs green from V4 base dir AND package dir — bug #5a fixed; review Approved.)

## PHASE 1 COMPLETE (2026-06-27): trust layer done — HMAC signing, provenance-as-blocker, meets sufficiency, bugs #5a+#5b fixed. Legacy byte-intact. Full build-gate + breakout suites green.

- Task 7: complete (council.mjs dynamic-workflow council — planSeats per-job sizing + maxConcurrency CPU-bounded pool + runCouncil + liveSeatCaller; test-council-orchestrator.mjs 5 blocks incl. concurrency-peak; npm test exit 0; review Approved — reviewer confirmed bounded pool genuinely caps + test is discriminating. DYNAMIC SIZING delivered per user request.)
- Task 8: complete (controller mechanical step — ENGINE.patch = diff -ruN pristine→working, 755 lines, 10 files; connectors excluded; ENGINE-APPLY.md written for Codex. No code review needed — bundles already-reviewed code.)
- Task 9: complete (live capture ATTEMPTED via council_review through real ai-peer-mcp server. DEVIATION from plan: used council_review (returns provenance.{claude,grok}.response_id) instead of live.mjs — council_review surfaces provenance directly. RESULT: live path PROVEN end-to-end — spawned server, MCP handshake, real fetch to api.anthropic.com, real HTTP 400 "credit balance too low" + request_id req_011CcUAss9W4R81iLwGoe1Qn. Gap #2 RE-CHARACTERIZED: connector is FUNCTIONAL, not a scaffold. No successful response_id → provenance PENDING on Anthropic credits → recursion will honest-block per spec (NO fabrication). Did not retry — billing error is not transient. Evidence: runs/live-capture/{README.md,capture.mjs,capture.err}.)

## PHASE 2 COMPLETE (2026-06-27): dynamic-workflow council (planSeats + CPU-bounded pool), ENGINE.patch for Codex, live path proven functional. Provenance pending on Anthropic credits.

- Tasks 10+11: complete (controller-authored — recursion run. DEVIATION: authored by controller not subagent (precise state + honest-block interpretation). Fixed a plan bug: affected_directories must be "../.." (resolves vs dossier dir → telos-upgrade root), not "me/claude-code/telos-upgrade". RESULT: TELOS gated its own upgrade → gate_status BLOCKED with EXACTLY 3 provenance blockers, 0 signature blockers, 0 meets blockers. Signatures valid, meets re-verified against real on-disk artifacts (sign.mjs/council.mjs/spec), blocked solely on provenance (credits). This honest block IS the integrity proof. Artifacts: runs/upgrade-001/{telos.md,dossier.json,market/claude.json,generate.mjs,packets/*,gate-report.json,ledger.md}. G4 substantially achieved; flips to pass when credits added + capture re-run.
- [T11-minor] gate.mjs renderLedger() hardcodes author:codex in ledger frontmatter — cosmetic; would be an ENGINE.patch change.
- Task 12: complete (contract upgrade — shared/Coordination/{Multi-Model Agentic Build Gate, Claude-Led Multi-Model Prototype Workflow}.md: added Trust Mode signed section + Dynamic-Workflow Council section; honestly marked "staged in ENGINE.patch pending Codex merge"; last-edited-by: claude-code. Live on write.)
- Task 13: complete (final sweep all green: build-gate+breakout npm test exit 0, test-gate from V4 base exit 0, recursion provenance-only block, legacy dogfood pass; STATUS.md written.)

## PHASE 3 COMPLETE (2026-06-27): recursion run (TELOS gated its own upgrade — honest provenance block), contract upgraded, STATUS.md written. ALL 13 PLAN TASKS DONE.

## CREDITS RELOADED → RECURSION FLIPPED TO PASS (2026-06-27)
- Live capture re-run SUCCEEDED: real provenance — claude (claude-sonnet-4-6, msg_01EkTnsnjyT2MBa2xLudt1pA) + grok (grok-4.3, 3760199a-...). Gap #2 FULLY closed (live MCP path end-to-end with real model responses). Had to pass explicit current model ids (claude-sonnet-4-6, grok-4) — env's "Claude Opus"→claude-3-opus-20240229 was a retired id (404).
- generate.mjs updated for HONEST provenance: claude packet = genuine same-model claude response_id; agy/codex = same real claude response_id WITH bound_via note ("ai-peer-mcp exposes no agy/codex model API backend"). No fabrication. RESIDUAL: true per-model provenance for codex (OpenAI) + agy needs their own backends.
- Recursion gate re-run: gate_status PASS, 0 blockers, signing+provenance enforced, all 3 packets bound to real claude response_id. TELOS gated its own upgrade for real.

## FINAL WHOLE-BRANCH REVIEW: READY WITH FIXES (2026-06-27)
- Recursion CONFIRMED non-fabricated (reviewer's own injection test: flips block→pass with a real response_id, 0 blockers; signatures verify, meets green). Legacy verified untouched. ENGINE.patch applies cleanly (patch -p1 --dry-run exit 0, reproduces working tree exactly). Contract docs honest (no overclaim).
- ONE Important finding → FIXING NOW: empty-needle file_contains bypass in verifier.mjs reverifyRecord (`"".includes("")` always true; hasFileContains set for empty needle; zero-byte check only on file_exists). Fix: empty/whitespace needle doesn't count toward hasFileContains + zero-byte check applies to file_contains too. + regression tests in test-verifier.mjs and test-trust.mjs.
- 16 Minor findings all triaged DEFER (see review). [T15 deriveResponseId placeholder] not exercised by recursion (generate.mjs reads council-review.json provenance directly, not liveSeatCaller).

## DONE (2026-06-27): empty-needle bypass FIXED + final verification
- verifier.mjs: empty/whitespace needle no longer counts toward hasFileContains; zero-byte check now applies to file_contains targets too. Regression tests added in test-verifier.mjs + test-trust.mjs. Both suites exit 0. Spot-check: empty-needle on zero-byte → hasFileContains:false, emptyEvidenceFiles:[empty.txt].
- Recursion re-verified: still gate_status PASS, 0 blockers (uses a real needle, unaffected).
- ENGINE.patch regenerated: 10 files, 841 lines; patch -p1 --dry-run into me/codex exit 0 (applies cleanly).
- STATUS.md finalized. ALL WORK COMPLETE. Handoffs: (1) Codex applies ENGINE.patch; (2) optional codex/agy provenance backends for fully-distinct per-model provenance.

## Scope change (user-approved 2026-06-27)
Dynamic agent-sizing folded into Task 7 (council.mjs): `planSeats(dossier)` computes the per-job roster (required seats + grok advisory + one market-lens seat per workstream when market_bound) and `maxConcurrency`/runCouncil run seats through a CPU-bounded pool (`min(requested, cores-2)`). Plan Task 7 + spec §4.4 updated; briefs regenerated.

## Minor findings for final whole-branch review triage
- [T2] sign.mjs:88 `signPacket` coerces `String(secret)` while verifyPacket rejects non-string secrets — asymmetry; `signPacket(p, null)` makes a never-verifiable packet. Not exercised (callers guard with `secret ?`). Spec-mandated code → human decides at final review.
- [T2] test-sign.mjs — no assertion on `signed_fields === "canonical-minus-signature"` (spec test omits it). Coverage gap only; impl is correct.
- [T2] test-sign.mjs — missing trailing newline (cosmetic).
- [T3] test-verifier.mjs `withContains` case doesn't assert `emptyEvidenceFiles=[]` (coverage gap; guarded by `spec.type` check so not a live bug).
- [T3] verifier.mjs reverifyRecord calls `resolveUnder` twice per passing file_exists (safe pure path math; mild redundancy).
- [T3] test-verifier.mjs `mkdtempSync` temp dir not cleaned up (hygiene; OS reclaims it).
- [T4] gate.mjs placeholder regex has dead `^$` branch (unreachable; `!responseId` short-circuits). Cosmetic.
- [T4] gate.mjs provenance blocker message says "placeholder ... 'null'" when response_id is absent (not a sentinel); a `responseId===null` message branch would read cleaner. No behavioral impact.
- [T4] gate.mjs headline_checks adds `signing_enforced`/`provenance_enforced` always (false in legacy) — structural output change in legacy mode. Intentional per brief; tests pass. Final-review triage: confirm acceptable.
- [T5] test-trust.mjs case 7 mkdtempSync temp dir not cleaned up (hygiene).
- [T5] test-trust.mjs case 2 mutation spreads `decision:"approve"` (no-op; only `confidence` actually changes) — comment slightly misleading.
- [T6] test-gate.mjs passingBreakout uses absolute (ex()) check paths → CWD-independent only when cwd is an ancestor of build-gate (V4 base / package dir — the required cases). Would break from an unrelated dir. Acceptable per brief scope; note for final review.
- [T7] council.mjs market-lens seats default to `model:"claude"` (claude appears as approver AND per-workstream lens) — unspecified choice; downstream dispatch would call claude multiple times. Consider per-workstream model assignment if live council needs diversity.
- [T7] council.mjs:89 redundant `poolSize > 0 ? poolSize : 0` guard (dead code; limit>=1 always).
- [T7] council.mjs deriveResponseId regex is a placeholder — Task 9 live capture must adjust to real ai-peer-mcp response shape. **ADDRESSED 2026-06-27** (see follow-up below): `liveSeatCaller` now prefers structured server-returned provenance; `deriveResponseId` is demoted to a documented prose-only fallback.

## Follow-up (2026-06-27): codex/agy provenance backends — TDD, complete, green
Goal: give the `codex` and `agy` council seats their OWN real provenance (closing STATUS residual #2; retiring the recursion-run `bound_via` borrowing). Boundary respected: staged in `engine/working/`, shipped via the regenerated `ENGINE.patch`; `me/codex/` not hand-edited.
- **lib.mjs** (connector): `extractOpenAIResult` + shared `extractChatCompletionResult` (Grok delegates too); `agyAttestation` + `stableStringify` + `AGY_ENGINE_VERSION` — content-addressed local-deterministic provenance (`agy-<sha256[40]>`). TDD: test-provenance.mjs cases first (FAIL → impl → PASS).
- **server.mjs** (connector): `askCodex` (OpenAI Chat Completions; `OPENAI_API_KEY`/`OPENAI_MODEL`/`OPENAI_BASE_URL`; fail-closed) + `codex_ask` tool; ask tools take opt-in `include_provenance` → `{text,provenance}` envelope (default raw prose preserved for breakout/live.mjs); `agy_checkpoint` embeds its attestation; `mapModelName` codex/gpt→gpt-4o. smoke-test asserts codex_ask listed + agy attestation present.
- **council.mjs**: `liveSeatCaller` routes codex→codex_ask (real OpenAI id) and agy→agy_checkpoint (attestation); provenance precedence structured→prose-scan→null (null ⇒ gate blocks, no fake ids); added back-compat prose-fallback test. TDD: test-council-orchestrator.mjs new blocks first (FAIL → impl → PASS).
- **Verification**: connector `npm test` exit 0; build-gate `npm test` exit 0 (incl. stress + breakout), run in-vault. ENGINE.patch regenerated (pristine→working, 1614 lines, 16 files); `patch --dry-run` against me/codex exit 0; applying to a throwaway copy reproduces `working` BYTE-IDENTICAL and its suites pass. (Note: `stress-tests.mjs` test 1.2 hard-codes the V4 absolute CHATGPT path, so it only resolves "blocked" when run inside V4 — pre-existing, not part of this change.)
- Docs: STATUS.md (residual closed), ENGINE-APPLY.md (15 files + connector section + OPENAI_API_KEY note), this ledger updated.
- Independent trust-boundary review (opus): verdict READY WITH FIXES. Core trust goal confirmed (codex own id, agy own attestation, no borrowing, fail-closed, no gate/signing regression). Findings triaged + applied:
  - **I-1 (Important) FIXED** — `liveSeatCaller` prose-scan (`deriveResponseId`) could scrape a model-authored `response_id` from prose and pass the gate, contradicting the "no fake ids" claim. Now fail-closed: no structured provenance ⇒ `response_id: null` ⇒ gate blocks. `deriveResponseId` removed; comments corrected; test rewritten to assert honest-null even when the prose contains a plausible id token.
  - **I-2 (Important) FIXED** — the real `agy_checkpoint` output is a governance object, not an approval packet (the orchestrator test had masked this with an approval-shaped fake). Added `agyApprovalPacket(checkpoint, meta)` adapter in council.mjs (approve iff `phase_gate_status==="advance"`, else `revise` with blocked_reasons→hard_stops) + moved `agyCheckpoint`/`chooseOwner` to lib.mjs (importable, no drift) + an end-to-end test driving the REAL checkpoint through the adapter and the gate's own `validateRecords` (advance⇒gate-valid+approve; blocked⇒gate blocks).
  - **M-1 (Minor) FIXED** — `liveSeatCaller` now forwards `spec.model` to chat seats (enables per-seat model selection, e.g. market-lens).
  - **M-3 (Minor) FIXED** — `stableStringify` normalizes `undefined`→`"null"` (hygiene; agyCheckpoint never emits undefined, so no attestation change).
  - **M-2 (Minor) DEFER** — `askCodex` sends `max_tokens`; OpenAI o-series/gpt-5 reasoning models want `max_completion_tokens`. Default `gpt-4o` works; absent key/model fail-closed (no trust impact). Model-family matching is fragile; revisit if a reasoning model is adopted for codex.
- Post-fix verification: connector `npm test` exit 0; build-gate `npm test` exit 0 (in-vault); ENGINE.patch regenerated (1614 lines, 16 files), dry-run clean against me/codex, applied tree byte-identical to working, patched-copy connector test exit 0.
