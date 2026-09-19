#!/usr/bin/env node
// Daedalus v2 workshop suite — Stages 0/2, role R referee, Seat 5 checkpoints.
// Governing document (HELD, The Eye 2026-07-20, does not move):
//   docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md
// Stage 1 remains workshop-lib.mjs runWorkshop (untouched); this suite proves
// the v2 layer composed around it. Smoke evidence only — no provider calls.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";
import {
  canonicalizeV2,
  hashRefV2,
  agyCheckpoint,
  verifyAgyCheckpoint,
  objectionHash,
  runResearchBreakout,
  validateResearchDispositions,
  runDaedalusV2
} from "./daedalus-v2.mjs";
import { createArtifactStore, runWorkshop, verifyWorkshop } from "./workshop-lib.mjs";

const FRAME_REF = hashRefV2({ kind: "requirement-frame", text: "demo frame" });

function researchBody(seat) {
  return {
    research_version: 1,
    seat,
    requirement_frame_ref: FRAME_REF,
    inclusions: [{ topic: `${seat}-topic`, claim: `${seat} claim`, evidence_refs: [] }],
    use_cases: [{ name: `${seat}-case`, why_planning_must_consider: "boundary behavior" }],
    failure_cases: [],
    adversarial_cases: [],
    open_questions: [],
    citations: []
  };
}

function smokeResearchSeat(overrides = {}) {
  return async ({ seat }) => ({
    response: researchBody(seat),
    provenance: {
      provider: `${seat}-provider`,
      model: `${seat}-smoke`,
      response_id: `smoke-research-${seat}`,
      source: "workshop-smoke",
      ...(overrides[seat] || {})
    }
  });
}

function makeStore(root) {
  return createArtifactStore(path.join(root, "artifacts"));
}

async function withTemp(fn) {
  const root = mkdtempSync(path.join(tmpdir(), "daedalus-v2-"));
  try {
    return await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// A deterministic Stage 1 join stub: returns an integrated candidate whose
// bytes derive from the modify counter so modify rounds change the hash.
function makeJoinStub({ planTexts }) {
  let joins = 0;
  return async () => {
    const plan = planTexts[Math.min(joins, planTexts.length - 1)];
    joins += 1;
    return {
      state: "converged-parallel",
      terminal: "submit",
      plan,
      plan_ref: hashRefV2({ kind: "plan", plan }),
      integration_ref: hashRefV2({ kind: "integration", plan })
    };
  };
}

function dispositionsFor(research, { why = "covered by frame scope" } = {}) {
  return research.artifacts.map((artifact) => ({
    artifact_ref: artifact.ref,
    status: "used",
    why
  }));
}

// Challenger scripting: rounds[i][seat] -> {verdict, objections}
function scriptedChallenger(rounds) {
  return async ({ seat, phase, round }) => {
    if (phase === "challenge") {
      const script = rounds[round - 1]?.[seat];
      if (!script) throw new Error(`no script for ${seat} round ${round}`);
      if (script.throw) throw new Error("scripted challenger transport failure");
      return {
        response: {
          verdict: script.verdict,
          objections: script.objections ?? [],
          empty_list_attestation: script.verdict === "accepted" && (script.objections ?? []).length === 0
            ? (script.attestation === undefined ? "genuinely-found-nothing" : script.attestation)
            : null
        },
        provenance: {
          provider: `${seat}-provider`,
          model: `${seat}-smoke`,
          response_id: script.responseId ?? `smoke-challenge-${seat}-r${round}${script.idSuffix ?? ""}`,
          source: "workshop-smoke"
        }
      };
    }
    if (phase === "defend") {
      return {
        response: { rationale: `defense of ${round}`, concur: true },
        provenance: {
          provider: `${seat}-provider`,
          model: `${seat}-smoke`,
          response_id: `smoke-defend-${seat}-r${round}`,
          source: "workshop-smoke"
        }
      };
    }
    throw new Error(`unexpected phase ${phase}`);
  };
}

function refereeScript(verdicts) {
  const calls = [];
  const fn = async ({ ledger_view, round, stage }) => {
    calls.push({ round, stage, ledger_view });
    const script = verdicts.shift() ?? { verdict: "continue" };
    const evidence = (script.loop_evidence ?? []).map((item) => ({
      ...item,
      refs: item.refs.map((ref) => ref === "__ROUND1__" ? ledger_view.rounds[0].entry_id : ref)
    }));
    return {
      response: {
        verdict: script.verdict,
        loop_evidence: evidence
      },
      provenance: {
        provider: "gemini-provider",
        model: "gemini-smoke",
        response_id: `smoke-referee-r${round}-${calls.length}`,
        source: "workshop-smoke"
      }
    };
  };
  fn.calls = calls;
  return fn;
}

async function runV2(root, {
  research = smokeResearchSeat(),
  planTexts = ["plan-v1"],
  challengerRounds,
  referee = refereeScript([]),
  dispositionWhy,
  maxChallengeRounds = 4,
  minResearchSurvivors = 4,
  disposeOverride,
  defendOverride,
  joinOverride
} = {}) {
  const store = makeStore(root);
  const routes = challengerRounds.map((round) =>
    Object.values(round).some((script) => script.modify) ? "modify" : "defend");
  return runDaedalusV2({
    frameRef: FRAME_REF,
    store,
    researchSeats: ["claude", "codex", "grok", "gemini"],
    callResearchSeat: research,
    runJoin: joinOverride ?? makeJoinStub({ planTexts }),
    decideRoute: async ({ round }) => ({ route: routes[round - 1] ?? "defend" }),
    callChallengerSeat: scriptedChallenger(challengerRounds),
    ...(defendOverride ? { callDefendSeat: defendOverride } : {}),
    callRefereeSeat: referee,
    callDispose: disposeOverride ?? (() => {
      let disposeCalls = 0;
      return async ({ surviving }) => {
        disposeCalls += 1;
        return {
          response: { dispositions: dispositionsFor({ artifacts: surviving }, { why: dispositionWhy ?? "covered by frame scope" }) },
          provenance: {
            provider: "claude-provider", model: "claude-smoke",
            response_id: `smoke-dispose-${disposeCalls}`, source: "workshop-smoke"
          }
        };
      };
    })(),
    maxChallengeRounds,
    minResearchSurvivors
  });
}

const accepted = { verdict: "accepted" };

// Case 1: canonical hashing + agy checkpoint determinism and tamper detection
{
  const a = agyCheckpoint({ action: { kind: "stage-transition", from: "research", to: "plan-produce" }, why: { survivors: 4 } });
  const b = agyCheckpoint({ action: { kind: "stage-transition", from: "research", to: "plan-produce" }, why: { survivors: 4 } });
  assert.equal(a.attestation, b.attestation);
  assert.match(a.attestation, /^agy-[0-9a-f]{40}$/);
  assert.equal(verifyAgyCheckpoint(a), true);
  const tampered = { ...a, checkpoint: { ...a.checkpoint, why: { survivors: 3 } } };
  assert.equal(verifyAgyCheckpoint(tampered), false);
  assert.throws(() => agyCheckpoint({ action: { kind: "x" }, why: {} }), /why/);
  console.log("Case 1 OK: agy checkpoints are deterministic, action+why bound, tamper-evident");
}

// Case 2: objection hashes are controller-computed and order-insensitive on evidence
{
  const h1 = objectionHash({ scope: "s", claim: "c", evidence_refs: ["b", "a"] });
  const h2 = objectionHash({ scope: "s", claim: "c", evidence_refs: ["a", "b"] });
  assert.equal(h1, h2);
  assert.notEqual(h1, objectionHash({ scope: "s", claim: "c2", evidence_refs: ["a", "b"] }));
  console.log("Case 2 OK: objection identity is controller-recomputed and canonical");
}

// Case 3: research breakout — isolation, action+why artifacts, four survivors
await withTemp(async (root) => {
  const seen = [];
  const store = makeStore(root);
  const research = await runResearchBreakout({
    frameRef: FRAME_REF,
    store,
    seats: ["claude", "codex", "grok", "gemini"],
    callSeat: async (call) => {
      seen.push(call);
      return smokeResearchSeat()(call);
    }
  });
  assert.equal(research.artifacts.length, 4);
  assert.equal(research.burned.length, 0);
  for (const call of seen) {
    assert.deepEqual(Object.keys(call).sort(), ["frame_ref", "phase", "role", "seat"]);
    assert.equal(call.phase, "research");
  }
  for (const artifact of research.artifacts) {
    const stored = store.read(artifact.ref);
    assert.equal(stored.action.kind, "research");
    assert.ok(stored.why.requirement_frame_ref === FRAME_REF);
  }
  console.log("Case 3 OK: research breakout is isolated, content-addressed, action+why bound");
});

// Case 4: provenance-or-burn — placeholder and shared ids burn; fail-closed at min survivors
await withTemp(async (root) => {
  const store = makeStore(root);
  const research = await runResearchBreakout({
    frameRef: FRAME_REF,
    store,
    seats: ["claude", "codex", "grok", "gemini"],
    callSeat: smokeResearchSeat({
      grok: { response_id: "" },
      gemini: { response_id: "smoke-research-claude" } // collides with claude
    })
  });
  const burnedSeats = research.burned.map((entry) => entry.seat).sort();
  assert.deepEqual(burnedSeats, ["claude", "gemini", "grok"]);
  assert.equal(research.artifacts.length, 1);
  console.log("Case 4 OK: placeholder and shared provenance burn research artifacts");
});
await withTemp(async (root) => {
  const result = await runV2(root, {
    research: smokeResearchSeat({ grok: { response_id: "" } }),
    challengerRounds: [{ grok: accepted, gemini: accepted }]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "research-survivors-below-minimum");
  console.log("Case 5 OK: research burn below minimum fails closed before any join");
});

// Case 6: malformed research shape burns
await withTemp(async (root) => {
  const store = makeStore(root);
  const research = await runResearchBreakout({
    frameRef: FRAME_REF,
    store,
    seats: ["claude"],
    callSeat: async ({ seat }) => ({
      response: { ...researchBody(seat), extra_field: true },
      provenance: { provider: "p", model: "m", response_id: "r1", source: "workshop-smoke" }
    })
  });
  assert.equal(research.artifacts.length, 0);
  assert.equal(research.burned[0].reason, "malformed-research-shape");
  console.log("Case 6 OK: non-closed research shapes burn");
});

// Case 7: research dispositions — missing or why-less records block the join
{
  const artifacts = [{ ref: "sha256:a".padEnd(71, "0"), seat: "claude" }, { ref: "sha256:b".padEnd(71, "1"), seat: "codex" }];
  const good = artifacts.map((artifact) => ({ artifact_ref: artifact.ref, status: "set-aside", why: "out of scope" }));
  assert.equal(validateResearchDispositions({ surviving: artifacts, dispositions: good }).complete, true);
  const missing = validateResearchDispositions({ surviving: artifacts, dispositions: good.slice(0, 1) });
  assert.equal(missing.complete, false);
  const whyless = validateResearchDispositions({
    surviving: artifacts,
    dispositions: artifacts.map((artifact) => ({ artifact_ref: artifact.ref, status: "used", why: " " }))
  });
  assert.equal(whyless.complete, false);
  assert.throws(() => validateResearchDispositions({
    surviving: artifacts,
    dispositions: [...good, { artifact_ref: "sha256:zz", status: "used", why: "x" }]
  }), /unknown artifact/);
  console.log("Case 7 OK: every surviving research artifact needs a disposition with a why");
}

// Case 8: accept path end-to-end — submission-only terminal with checkpoints
await withTemp(async (root) => {
  const referee = refereeScript([]);
  const result = await runV2(root, {
    challengerRounds: [{ grok: accepted, gemini: accepted }],
    referee
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.terminal, "submit");
  assert.equal(result.authorization_granted, false);
  assert.equal(result.plan_ref, hashRefV2({ kind: "plan", plan: "plan-v1" }));
  assert.ok(result.checkpoints.length >= 3);
  for (const checkpoint of result.checkpoints) {
    assert.equal(verifyAgyCheckpoint(checkpoint), true);
  }
  assert.equal(referee.calls.length, 0, "referee cadence starts at challenge round 2");
  console.log("Case 8 OK: both-accept converges for submission only, checkpoints verify");
});

// Case 9: accepted-empty without attestation burns the verdict (round still counts)
await withTemp(async (root) => {
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "accepted", attestation: null }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].burned_verdicts.length, 1);
  console.log("Case 9 OK: empty-list acceptance without attestation burns; counters advance");
});

// Case 10: deny → defend (dual-provenance record) → same challenger re-judges → converge
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "missing negative test", evidence_refs: ["frame"] };
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission");
  const defense = result.rounds[0].defenses[0];
  assert.equal(defense.objection_hash, objectionHash(objection));
  assert.equal(defense.provenance.length, 2);
  assert.ok(defense.record.why.rationale.length > 0);
  console.log("Case 10 OK: defense records bind both produce provenances and a why");
});

// Case 11: denied-twice on the same controller hash → needs-work (defend did not stick)
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "unbounded loop", evidence_refs: [] };
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [objection] }, gemini: accepted }
    ]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "objection-denied-twice");
  assert.equal(result.ledger.denied_twice[0], objectionHash(objection));
  console.log("Case 11 OK: second denial of the same objection hash terminates to The Eye");
});

// Case 12: modify path — new join, both challengers re-judge; oscillation terminates
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "needs rework", evidence_refs: [] };
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v2"],
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection], modify: true }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.plan_ref, hashRefV2({ kind: "plan", plan: "plan-v2" }));
  assert.equal(result.rounds.length, 2);
  console.log("Case 12 OK: modify re-joins and both challengers re-judge the new hash");
});
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "still wrong", evidence_refs: [] };
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v1"], // modify returns an already-seen hash
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection], modify: true }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "lineage-oscillation");
  console.log("Case 13 OK: modify that repeats a seen hash with open objections terminates");
});

// Case 14: global round cap
await withTemp(async (root) => {
  const rounds = [];
  for (let i = 0; i < 5; i += 1) {
    rounds.push({
      grok: { verdict: "denied", objections: [{ scope: "plan", claim: `distinct ${i}`, evidence_refs: [] }] },
      gemini: accepted
    });
  }
  const result = await runV2(root, { challengerRounds: rounds, maxChallengeRounds: 4 });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "challenge-round-cap");
  assert.equal(result.rounds.length, 4);
  console.log("Case 14 OK: the challenge cap is a hard global ceiling");
});

// Case 15: referee — cadence, no candidate text in input, stalemate ends the run
await withTemp(async (root) => {
  const referee = refereeScript([
    { verdict: "continue" },
    { verdict: "stalemate", loop_evidence: [{ kind: "ping-pong", refs: ["__ROUND1__"], why: "same rationale re-stated" }] }
  ]);
  const objectionA = { scope: "plan", claim: "a", evidence_refs: [] };
  const objectionB = { scope: "plan", claim: "b", evidence_refs: [] };
  const objectionC = { scope: "plan", claim: "c", evidence_refs: [] };
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objectionA] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [objectionB] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [objectionC] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ],
    referee
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "referee-stalemate");
  assert.ok(result.referee_evidence.length > 0);
  assert.ok(referee.calls.length >= 2, "referee watches from round 2");
  for (const call of referee.calls) {
    const flat = JSON.stringify(call.ledger_view);
    assert.ok(!flat.includes("plan-v1"), "referee must never see candidate text");
  }
  console.log("Case 15 OK: referee watches from round 2, sees only the ledger, stalemate → Eye");
});

// Case 16: referee evidence-or-burn — unresolvable refs / malformed verdicts cannot block
await withTemp(async (root) => {
  const referee = refereeScript([
    { verdict: "stalemate", loop_evidence: [{ kind: "ping-pong", refs: ["sha256:not-a-ledger-entry"], why: "x" }] },
    { verdict: "stalemate", loop_evidence: [] }
  ]);
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "a", evidence_refs: [] }] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "b", evidence_refs: [] }] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "c", evidence_refs: [] }] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ],
    referee
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.ledger.burned_referee_verdicts.length, 2);
  console.log("Case 16 OK: bad referee verdicts burn and can never block a run");
});

// Case 17: composition proof — the REAL Stage 1 (runWorkshop, smoke mode) as the
// injected join, end-to-end to converged-for-submission, with the Stage 1 run
// independently verifiable afterward.
await withTemp(async (root) => {
  const runDir = path.join(root, "docs/runs/workshop");
  mkdirSync(runDir, { recursive: true });
  const candidateText = "# Candidate\n\nAlpha.\n\nBeta.\n";
  const stagePaths = {
    candidate: "candidate.md",
    design: "design.md",
    preReview: "pre-review.json",
    methodology: "methodology.md",
    comprehension: "reader-validation.json"
  };
  writeFileSync(path.join(root, stagePaths.candidate), candidateText);
  writeFileSync(path.join(root, stagePaths.design), "# Design\n");
  writeFileSync(path.join(root, stagePaths.preReview), "{\"kind\":\"evidence\"}\n");
  writeFileSync(path.join(root, stagePaths.methodology), "# Methodology\n");
  writeFileSync(path.join(root, stagePaths.comprehension), JSON.stringify({
    result: "COMPREHENSION_PASSED",
    comprehension_checks: { passed: 19, failed: 0 }
  }));
  const matrix = [{
    obligation_id: "PPC-W01",
    invariant: "candidate remains bound",
    mechanism: "exact replacement controller",
    task: "materialize the integrated candidate",
    negative_test: "ambiguous replacement is rejected",
    exit_criterion: "materialized bytes are uniquely derived"
  }];
  let stageCall = 0;
  const stageOneSeat = async ({ seat, role, phase }) => {
    stageCall += 1;
    const provenance = {
      provider: seat === "claude" ? "anthropic" : "openai",
      model: `${seat}-fixture`,
      response_id: `fixture-${stageCall}`,
      source: "workshop-smoke"
    };
    if (phase === "author" && role === "constraints") {
      const response = { plan: "# Constraint source\n", obligations: ["PPC-W01"] };
      return { ...response, provenance, response };
    }
    if (phase === "author") {
      const response = { plan: "# Implementation source\n" };
      return { ...response, provenance, response };
    }
    if (phase === "integrate") {
      return {
        provenance,
        response: {
          decision: "preserve",
          maturation_summary: "No material revision is required.",
          replacements: [],
          obligation_matrix: matrix
        }
      };
    }
    const response = { verdict: "preserved", conflicts: [] };
    return { ...response, provenance, response };
  };
  let joinIndex = 0;
  const realJoin = async () => {
    joinIndex += 1;
    const summary = await runWorkshop({
      repoRoot: root,
      runDir,
      attemptId: `attempt-${String(joinIndex).padStart(3, "0")}`,
      mode: "smoke",
      paths: stagePaths,
      callSeat: stageOneSeat
    });
    if (summary.state !== "converged-parallel") return { terminal: "needs-work" };
    return {
      state: summary.state,
      terminal: "submit",
      plan_ref: summary.matured_plan.raw_sha256,
      integration_ref: summary.integration.candidate_ref
    };
  };
  const store = makeStore(root);
  const result = await runDaedalusV2({
    frameRef: FRAME_REF,
    store,
    researchSeats: ["claude", "codex", "grok", "gemini"],
    callResearchSeat: smokeResearchSeat(),
    runJoin: realJoin,
    callChallengerSeat: scriptedChallenger([{ grok: accepted, gemini: accepted }]),
    callRefereeSeat: refereeScript([]),
    callDispose: async ({ surviving }) => ({
      response: { dispositions: dispositionsFor({ artifacts: surviving }) },
      provenance: {
        provider: "claude-provider", model: "claude-smoke",
        response_id: "smoke-dispose-e2e", source: "workshop-smoke"
      }
    })
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.terminal, "submit");
  assert.equal(result.authorization_granted, false);
  assert.match(result.plan_ref, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.ledger.plan_lineage.length, 1);
  // The composed Stage 1 evidence remains independently verifiable.
  const verification = verifyWorkshop({ repoRoot: root, runDir, allowSmoke: true });
  assert.equal(verification.ok, true, JSON.stringify(verification.errors ?? []));
  console.log("Case 17 OK: real Stage 1 smoke join composes end-to-end and stays verifiable");
});

// Case 18: shared challenger ids in ONE round burn BOTH verdicts — a single
// response can never impersonate the dual gate.
await withTemp(async (root) => {
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "accepted", responseId: "ONE-SHARED-ID" }, gemini: { verdict: "accepted", responseId: "ONE-SHARED-ID" } },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.rounds.length, 2);
  assert.equal(result.rounds[0].burned_verdicts.length, 2, "both shared-id verdicts must burn");
  console.log("Case 18 OK: a shared response id cannot impersonate both challengers");
});

// Case 19: a challenger reusing a PRIOR round's id burns that verdict only.
await withTemp(async (root) => {
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "x", evidence_refs: [] }], responseId: "GROK-R1" }, gemini: accepted },
      { grok: { verdict: "accepted", responseId: "GROK-R1" }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.rounds[1].burned_verdicts.length, 1);
  assert.equal(result.rounds[1].burned_verdicts[0].reason, "reused-provenance");
  console.log("Case 19 OK: cross-round provenance reuse burns the reusing verdict");
});

// Case 20: defense pair sharing one response id → needs-work (no single-seat papering).
await withTemp(async (root) => {
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "d", evidence_refs: [] }] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ],
    defendOverride: async ({ seat, round }) => ({
      response: { rationale: "shared defense", concur: true },
      provenance: {
        provider: "produce-provider", model: `${seat}-smoke`,
        response_id: "SAME-DEFENSE-ID", source: "workshop-smoke"
      }
    })
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "defense-shared-provenance");
  console.log("Case 20 OK: one shared id cannot satisfy the dual-provenance defense");
});

// Case 21: referee reusing a Seat 4 challenge id burns the referee verdict; run continues.
await withTemp(async (root) => {
  const referee = (() => {
    const fn = async ({ round }) => ({
      response: { verdict: "stalemate", loop_evidence: [{ kind: "ping-pong", refs: ["round-1"], why: "restated" }] },
      provenance: {
        provider: "gemini-provider", model: "gemini-smoke",
        response_id: `smoke-challenge-gemini-r${round}`, // byte-identical to Seat 4's verdict id
        source: "workshop-smoke"
      }
    });
    return fn;
  })();
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "e", evidence_refs: [] }] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "f", evidence_refs: [] }] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ],
    referee
  });
  assert.equal(result.state, "converged-for-submission");
  assert.ok(result.ledger.burned_referee_verdicts.every((entry) => entry.reason === "reused-provenance"));
  assert.ok(result.ledger.burned_referee_verdicts.length >= 1);
  console.log("Case 21 OK: a referee reusing a Seat 4 response id burns, never blocks");
});

// Case 22: transport throws are governed — challenger throw burns the verdict,
// referee throw burns the referee, neither crashes the orchestrator.
await withTemp(async (root) => {
  const referee = async () => { throw new Error("referee transport down"); };
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { throw: true }, gemini: accepted },
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "g", evidence_refs: [] }] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ],
    referee
  });
  assert.equal(result.state, "converged-for-submission");
  assert.equal(result.rounds[0].burned_verdicts[0].reason, "challenger-transport-error");
  assert.ok(result.ledger.burned_referee_verdicts.some((entry) => entry.reason === "referee-transport-error"));
  console.log("Case 22 OK: transport failures burn instead of crashing the run");
});

// Case 23: model-supplied garbage dispositions terminate governed, never throw.
await withTemp(async (root) => {
  const result = await runV2(root, {
    challengerRounds: [{ grok: accepted, gemini: accepted }],
    disposeOverride: async () => ({
      response: { dispositions: [{ artifact_ref: "sha256:unknown", status: "used", why: "x" }] },
      provenance: { provider: "claude-provider", model: "claude-smoke", response_id: "dispose-bad-1", source: "workshop-smoke" }
    })
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "research-dispositions-invalid");
  assert.ok(result.checkpoints.at(-1).checkpoint.action.kind === "stage-terminal");
  console.log("Case 23 OK: garbage dispositions end as a governed needs-work terminal");
});

// Case 24: canonical hashing follows JSON semantics (no join-coercion collisions),
// and objection evidence refs must be strings.
{
  assert.equal(canonicalizeV2([undefined]), canonicalizeV2([null]));
  assert.notEqual(canonicalizeV2([undefined]), canonicalizeV2([]));
  assert.equal(canonicalizeV2({ a: undefined }), canonicalizeV2({}));
  assert.throws(() => objectionHash({ scope: "s", claim: "c", evidence_refs: [undefined] }), /string evidence_refs/);
  assert.throws(() => objectionHash({ scope: "  ", claim: "c", evidence_refs: [] }), /objection requires/);
  console.log("Case 24 OK: hashing matches JSON semantics; malformed objections are rejected");
}

// Case 25: Stage 0 cross-burn — a survivor sharing an id with a shape-burned twin burns too.
await withTemp(async (root) => {
  const store = makeStore(root);
  const research = await runResearchBreakout({
    frameRef: FRAME_REF,
    store,
    seats: ["claude", "codex"],
    callSeat: async ({ seat }) => seat === "claude"
      ? {
        response: { ...researchBody(seat), extra: true }, // malformed shape
        provenance: { provider: "p", model: "m", response_id: "TWIN-ID", source: "s" }
      }
      : {
        response: researchBody(seat),
        provenance: { provider: "p2", model: "m2", response_id: "TWIN-ID", source: "s" }
      }
  });
  assert.equal(research.artifacts.length, 0);
  const reasons = research.burned.map((entry) => entry.reason);
  assert.deepEqual(reasons, ["shared-provenance", "shared-provenance"]);
  console.log("Case 25 OK: sharing an id with a burned twin burns the survivor");
});

// Case 26: one denied verdict repeating the same objection counts it once.
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "repeated", evidence_refs: [] };
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection, { ...objection }] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission", "duplicate listing must not trip denied-twice");
  console.log("Case 26 OK: denial counting is per judgment, not per listed occurrence");
});

// Case 27: denied-twice across a MODIFY boundary still terminates.
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "persistent", evidence_refs: [] };
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v2"],
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection], modify: true }, gemini: accepted },
      { grok: { verdict: "denied", objections: [objection] }, gemini: accepted }
    ]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "objection-denied-twice");
  console.log("Case 27 OK: a modify does not reset the denied-twice counter");
});

// Case 28: both challengers denying the same hash in ONE round is denied-twice.
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "both-see-it", evidence_refs: [] };
  const result = await runV2(root, {
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection] }, gemini: { verdict: "denied", objections: [objection] } }
    ]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "objection-denied-twice");
  console.log("Case 28 OK: two independent denials of one hash in one round go to The Eye");
});

// Case 29: a modify round counts against the global cap.
await withTemp(async (root) => {
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v2", "plan-v3"],
    maxChallengeRounds: 2,
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "m1", evidence_refs: [] }], modify: true }, gemini: accepted },
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "m2", evidence_refs: [] }] }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "challenge-round-cap");
  assert.equal(result.rounds.length, 2);
  console.log("Case 29 OK: modify re-entry never resets the global round counter");
});

// Case 30: checkpoint CONTENT is computed and complete — transitions carry the
// predicates, deny→return is recorded, and terminals carry the reason.
await withTemp(async (root) => {
  const objection = { scope: "plan", claim: "route-check", evidence_refs: [] };
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v2"],
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objection], modify: true }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "converged-for-submission");
  const kinds = result.checkpoints.map((entry) => `${entry.checkpoint.action.kind}:${entry.checkpoint.action.from ?? entry.checkpoint.action.stage ?? ""}>${entry.checkpoint.action.to ?? ""}`);
  assert.ok(kinds.includes("stage-transition:research-breakout>plan-produce"));
  const produceToChallenge = result.checkpoints.filter((entry) =>
    entry.checkpoint.action.from === "plan-produce" && entry.checkpoint.action.to === "plan-challenge");
  assert.equal(produceToChallenge.length, 2, "modify must re-attest produce→challenge");
  for (const checkpoint of produceToChallenge) {
    assert.equal(checkpoint.checkpoint.why.dispositions_complete, true);
    assert.match(checkpoint.checkpoint.why.plan_ref, /^sha256:/);
  }
  const denyReturn = result.checkpoints.find((entry) =>
    entry.checkpoint.action.from === "plan-challenge" && entry.checkpoint.action.to === "plan-produce");
  assert.ok(denyReturn, "deny→return transition must be attested");
  assert.equal(denyReturn.checkpoint.why.route, "modify");
  assert.ok(denyReturn.checkpoint.why.open_objection_hashes.length > 0);
  console.log("Case 30 OK: Seat 5 attests every transition with computed predicates");
});
await withTemp(async (root) => {
  const result = await runV2(root, {
    research: smokeResearchSeat({ grok: { response_id: "" } }),
    challengerRounds: [{ grok: accepted, gemini: accepted }]
  });
  assert.equal(result.state, "needs-work");
  const last = result.checkpoints.at(-1).checkpoint;
  assert.equal(last.action.kind, "stage-terminal");
  assert.equal(last.why.reason, "research-survivors-below-minimum");
  console.log("Case 31 OK: needs-work terminals carry a stage-terminal attestation");
});

// Case 32: a modified candidate requires a FRESH disposition record.
await withTemp(async (root) => {
  let disposeCalls = 0;
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v2"],
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "re-dispose", evidence_refs: [] }], modify: true }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ],
    disposeOverride: async ({ surviving }) => {
      disposeCalls += 1;
      if (disposeCalls === 2) {
        return {
          response: { dispositions: [] }, // missing map for the new candidate
          provenance: { provider: "claude-provider", model: "claude-smoke", response_id: `dispose-${disposeCalls}`, source: "workshop-smoke" }
        };
      }
      return {
        response: { dispositions: dispositionsFor({ artifacts: surviving }) },
        provenance: { provider: "claude-provider", model: "claude-smoke", response_id: `dispose-${disposeCalls}`, source: "workshop-smoke" }
      };
    }
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "research-dispositions-incomplete");
  assert.equal(disposeCalls, 2);
  console.log("Case 32 OK: every join, including modify, needs its own disposition map");
});

// Case 33: defense failure branches are governed terminals.
for (const [override, reason] of [
  [async ({ seat }) => ({
    response: { rationale: "r", concur: seat === "codex" ? false : true },
    provenance: { provider: "produce", model: `${seat}-smoke`, response_id: `def-${seat}-nc`, source: "s" }
  }), "defense-not-concurred"],
  [async ({ seat }) => ({
    response: { rationale: seat === "claude" ? "   " : "r", concur: true },
    provenance: { provider: "produce", model: `${seat}-smoke`, response_id: `def-${seat}-nw`, source: "s" }
  }), "defense-without-why"],
  [async () => { throw new Error("defense transport down"); }, "defense-transport-error"]
]) {
  await withTemp(async (root) => {
    const result = await runV2(root, {
      challengerRounds: [
        { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "def-branch", evidence_refs: [] }] }, gemini: accepted },
        { grok: accepted, gemini: accepted }
      ],
      defendOverride: override
    });
    assert.equal(result.state, "needs-work");
    assert.equal(result.reason, reason);
  });
}
console.log("Case 33 OK: defense failures (concur, why, transport) all terminate governed");

// Case 34: join failures (throw or non-submit) are governed terminals, initial and modify.
await withTemp(async (root) => {
  const result = await runV2(root, {
    challengerRounds: [{ grok: accepted, gemini: accepted }],
    joinOverride: async () => { throw new Error("join exploded"); }
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "join-failed");
  console.log("Case 34 OK: a failed join is a governed terminal, not a crash");
});

// Case 35: the smoke CLI refuses the governed workshop directory.
{
  const here = path.dirname(new URL(import.meta.url).pathname);
  let failed = false;
  try {
    execFileSync("node", [path.join(here, "run-daedalus-v2.mjs"), "--smoke", "--run-dir", here], { stdio: "pipe" });
  } catch (error) {
    failed = true;
    assert.equal(error.status, 2);
    assert.match(String(error.stderr), /governed workshop directory/);
  }
  assert.ok(failed, "CLI must refuse the governed directory");
  console.log("Case 35 OK: smoke evidence cannot target the governed workshop directory");
}

// Case 36: referee cadence derives from maxChallengeRounds (Ruling 1's rider),
// not the old module-level literal — cap 6 must start watching at round 3.
await withTemp(async (root) => {
  const referee = refereeScript([]);
  const rounds = [];
  for (let i = 0; i < 6; i += 1) {
    rounds.push({
      grok: { verdict: "denied", objections: [{ scope: "plan", claim: `distinct ${i}`, evidence_refs: [] }] },
      gemini: accepted
    });
  }
  const result = await runV2(root, { challengerRounds: rounds, maxChallengeRounds: 6, referee });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "challenge-round-cap");
  assert.ok(referee.calls.length > 0, "referee must fire at least once before the cap");
  assert.equal(referee.calls[0].round, 3, "cap 6 => ceil(6/2) = 3, not the old hardcoded 2");
  console.log("Case 36 OK: referee cadence is Math.ceil(maxChallengeRounds/2), derived per call");
});

// Case 37: a small cap still gets full referee coverage under the derived
// formula — the old hardcoded literal 2 would have produced only [round 2].
await withTemp(async (root) => {
  const referee = refereeScript([]);
  const result = await runV2(root, {
    maxChallengeRounds: 2,
    challengerRounds: [
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "a", evidence_refs: [] }] }, gemini: accepted },
      { grok: { verdict: "denied", objections: [{ scope: "plan", claim: "b", evidence_refs: [] }] }, gemini: accepted }
    ],
    referee
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "challenge-round-cap");
  assert.deepEqual(referee.calls.map((c) => c.round), [1, 2], "ceil(2/2)=1: referee watches every round of a 2-round budget");
  console.log("Case 37 OK: a small cap still gets referee coverage under the derived formula");
});

// Case 38: repeated modify rounds that keep finding NEW distinct objections
// while never shrinking the open backlog stop before the round cap.
await withTemp(async (root) => {
  const objA = { scope: "plan", claim: "spiral-a", evidence_refs: [] };
  const objB = { scope: "plan", claim: "spiral-b", evidence_refs: [] };
  const result = await runV2(root, {
    planTexts: ["plan-v1", "plan-v2", "plan-v3"],
    maxChallengeRounds: 4,
    challengerRounds: [
      { grok: { verdict: "denied", objections: [objA], modify: true }, gemini: accepted },
      { grok: { verdict: "denied", objections: [objB], modify: true }, gemini: accepted },
      { grok: accepted, gemini: accepted }
    ]
  });
  assert.equal(result.state, "needs-work");
  assert.equal(result.reason, "growth-without-convergence");
  assert.equal(result.rounds.length, 2);
  console.log("Case 38 OK: an unresolved objection backlog that grows across modify rounds stops before the cap");
});

console.log("test-daedalus-v2.mjs OK");
