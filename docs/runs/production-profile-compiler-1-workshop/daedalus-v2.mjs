#!/usr/bin/env node
// Daedalus v2 workshop layer — Stages 0 and 2, role R referee, Seat 5 checkpoints.
// Governing document (HELD, The Eye 2026-07-20; canonical location, does not move):
//   docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md
//
// Stage 1 (plan produce, Seats 1 ∥ 2) is the existing runWorkshop parallel join in
// workshop-lib.mjs and is deliberately NOT modified here; runDaedalusV2 composes
// around it through an injected runJoin. All identities are controller-computed
// content addresses; every load-bearing record binds an action AND a why.
//
// Provenance discipline (design invariant 8) is run-wide across the v2 layer:
// every counted call must carry real provenance with a provider:response_id pair
// never seen before in this run — invalid, placeholder, shared, or reused ids
// BURN the output rather than count it. Model-supplied garbage terminates as a
// governed needs-work (with the ledger), never as an orchestrator crash — except
// the referee, whose failures only burn (a broken referee can never block).
// Nothing here authorizes: every terminal is submission-only or needs-work.
import { createHash } from "node:crypto";

const RESEARCH_KEYS = [
  "adversarial_cases",
  "citations",
  "failure_cases",
  "inclusions",
  "open_questions",
  "research_version",
  "requirement_frame_ref",
  "seat",
  "use_cases"
];
const DISPOSITION_STATUSES = ["used", "partially-used", "set-aside"];
const CHALLENGE_SEATS = ["grok", "gemini"];
const PRODUCE_SEATS = ["claude", "codex"];

// Stable stringify with JSON.stringify value semantics: array holes/undefined/
// functions serialize as null, object entries with such values are omitted —
// so distinct-but-JSON-equal inputs hash equal and nothing collides with [].
export function canonicalizeV2(value) {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return "null";
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) return "null";
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalizeV2(item)).join(",")}]`;
  const keys = Object.keys(value).sort();
  const parts = [];
  for (const key of keys) {
    const item = value[key];
    if (item === undefined || typeof item === "function" || typeof item === "symbol") continue;
    parts.push(`${JSON.stringify(key)}:${canonicalizeV2(item)}`);
  }
  return `{${parts.join(",")}}`;
}

function sha256hex(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function hashRefV2(value) {
  return `sha256:${sha256hex(canonicalizeV2(value))}`;
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function exactKeys(object, keys) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return false;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

// --- Seat 5 (agy) — neutral, computed checkpoints -------------------------------
// action + why are both mandatory in the preimage; the attestation format matches
// the house agy convention: "agy-" + first 40 hex chars of the sha256 digest.
export function agyCheckpoint({ action, why }) {
  if (!action || typeof action !== "object" || !nonempty(action.kind)) {
    throw new Error("agy checkpoint requires action.kind");
  }
  if (!why || typeof why !== "object" || Object.keys(why).length === 0) {
    throw new Error("agy checkpoint requires a non-empty why");
  }
  const checkpoint = { agy_checkpoint_version: 1, action, why };
  return {
    checkpoint,
    attestation: `agy-${sha256hex(canonicalizeV2(checkpoint)).slice(0, 40)}`,
    model: "agy-checkpoint",
    source: "local-deterministic"
  };
}

export function verifyAgyCheckpoint(record) {
  if (!record || typeof record !== "object" || !record.checkpoint) return false;
  try {
    return `agy-${sha256hex(canonicalizeV2(record.checkpoint)).slice(0, 40)}` === record.attestation;
  } catch {
    return false;
  }
}

// --- Objection identity ----------------------------------------------------------
export function objectionHash({ scope, claim, evidence_refs }) {
  if (!nonempty(scope) || !nonempty(claim)
    || !Array.isArray(evidence_refs)
    || !evidence_refs.every((ref) => typeof ref === "string")) {
    throw new Error("objection requires scope, claim, and string evidence_refs");
  }
  return hashRefV2({ claim, evidence_refs: [...evidence_refs].sort(), scope });
}

// --- Provenance discipline -------------------------------------------------------
function validProvenance(provenance) {
  return provenance
    && typeof provenance === "object"
    && nonempty(provenance.provider)
    && nonempty(provenance.model)
    && nonempty(provenance.response_id)
    && provenance.response_id.trim().toLowerCase() !== "placeholder"
    && nonempty(provenance.source);
}

// Keyed on response_id ALONE: the provider string is model-asserted, so letting
// it disambiguate would let an impersonator dodge the shared-id burn by claiming
// a different provider. Matches the Stage 0 and house shared-provenance rules.
function provenanceKey(provenance) {
  return provenance.response_id;
}

// Run-wide registry: claiming an already-seen provider:response_id fails, so a
// single underlying response can never impersonate two independent calls.
function makeProvenanceRegistry() {
  const seen = new Set();
  return {
    claim(provenance) {
      if (!validProvenance(provenance)) return { ok: false, reason: "invalid-provenance" };
      const key = provenanceKey(provenance);
      if (seen.has(key)) return { ok: false, reason: "reused-provenance" };
      seen.add(key);
      return { ok: true, key };
    },
    has(provenance) {
      return validProvenance(provenance) && seen.has(provenanceKey(provenance));
    }
  };
}

// --- Stage 0 — research breakout -------------------------------------------------
function validResearchBody(body, { seat, frameRef }) {
  if (!exactKeys(body, RESEARCH_KEYS)) return false;
  if (body.research_version !== 1 || body.seat !== seat || body.requirement_frame_ref !== frameRef) return false;
  const arrays = ["inclusions", "use_cases", "failure_cases", "adversarial_cases", "open_questions", "citations"];
  if (!arrays.every((key) => Array.isArray(body[key]))) return false;
  if (!body.inclusions.every((item) => item && nonempty(item.topic) && nonempty(item.claim) && Array.isArray(item.evidence_refs))) return false;
  if (!body.use_cases.every((item) => item && nonempty(item.name) && nonempty(item.why_planning_must_consider))) return false;
  return true;
}

export async function runResearchBreakout({ frameRef, store, seats, callSeat, registry = makeProvenanceRegistry() }) {
  const raw = [];
  for (const seat of seats) {
    // Isolation: the call receives only the frame reference and its own identity —
    // never another seat's research.
    let result;
    try {
      result = await callSeat({ seat, role: seat, phase: "research", frame_ref: frameRef });
    } catch {
      raw.push({ seat, result: null, transportError: true });
      continue;
    }
    raw.push({ seat, result });
  }
  const burned = [];
  const candidates = [];
  // Shared ids burn every member of the group — counted across ALL responses,
  // including ones already burned for shape, so a survivor can never share an id
  // with any twin.
  const idCounts = new Map();
  for (const { result } of raw) {
    const id = result?.provenance?.response_id;
    if (nonempty(id)) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  }
  for (const { seat, result, transportError } of raw) {
    if (transportError) {
      burned.push({ seat, reason: "transport-error" });
      continue;
    }
    if (!result || typeof result !== "object" || !result.response || !result.provenance) {
      burned.push({ seat, reason: "missing-response-or-provenance" });
      continue;
    }
    if ((idCounts.get(result.provenance.response_id) ?? 0) > 1) {
      burned.push({ seat, reason: "shared-provenance" });
      continue;
    }
    if (!validProvenance(result.provenance) || registry.has(result.provenance)) {
      burned.push({ seat, reason: "invalid-provenance" });
      continue;
    }
    if (!validResearchBody(result.response, { seat, frameRef })) {
      burned.push({ seat, reason: "malformed-research-shape" });
      continue;
    }
    candidates.push({ seat, result });
  }
  const artifacts = [];
  for (const { seat, result } of candidates) {
    const claimed = registry.claim(result.provenance);
    if (!claimed.ok) {
      burned.push({ seat, reason: claimed.reason });
      continue;
    }
    const { ref } = store.write({
      kind: "research-artifact",
      action: { kind: "research", seat, body: result.response },
      why: { requirement_frame_ref: frameRef, intent: "stage-0 research for planning" },
      provenance: result.provenance
    });
    artifacts.push({ seat, ref });
  }
  return { artifacts, burned };
}

// --- Research dispositions -------------------------------------------------------
export function validateResearchDispositions({ surviving, dispositions }) {
  if (!Array.isArray(dispositions)) throw new Error("dispositions must be an array");
  const survivingRefs = new Set(surviving.map((artifact) => artifact.ref));
  const seen = new Set();
  const defective = [];
  for (const record of dispositions) {
    if (!record || typeof record !== "object") throw new Error("disposition must be an object");
    if (!survivingRefs.has(record.artifact_ref)) {
      throw new Error(`disposition names unknown artifact ${JSON.stringify(record.artifact_ref)}`);
    }
    if (seen.has(record.artifact_ref)) {
      throw new Error(`duplicate disposition for artifact ${record.artifact_ref}`);
    }
    seen.add(record.artifact_ref);
    if (!DISPOSITION_STATUSES.includes(record.status) || !nonempty(record.why)) {
      defective.push(record.artifact_ref);
    }
  }
  const missing = [...survivingRefs].filter((ref) => !seen.has(ref));
  return {
    complete: missing.length === 0 && defective.length === 0,
    missing,
    defective
  };
}

// --- Challenge verdicts ----------------------------------------------------------
function readChallengeVerdict({ seat, result, registry }) {
  if (!result || typeof result !== "object" || !result.response) {
    return { seat, burned: true, reason: "invalid-provenance-or-shape" };
  }
  const claimed = registry.claim(result.provenance);
  if (!claimed.ok) {
    return { seat, burned: true, reason: claimed.reason };
  }
  const response = result.response;
  if (!exactKeys(response, ["verdict", "objections", "empty_list_attestation"])
    || !["accepted", "denied"].includes(response.verdict)
    || !Array.isArray(response.objections)) {
    return { seat, burned: true, reason: "malformed-verdict-shape" };
  }
  if (response.verdict === "accepted") {
    if (response.objections.length !== 0) {
      return { seat, burned: true, reason: "accepted-with-objections" };
    }
    if (response.empty_list_attestation !== "genuinely-found-nothing") {
      // seats.json Grok frame as a gate rule: silence must be attested.
      return { seat, burned: true, reason: "missing-empty-list-attestation" };
    }
    return { seat, verdict: "accepted", objections: [], provenance: result.provenance };
  }
  if (response.objections.length === 0) {
    return { seat, burned: true, reason: "denied-without-objections" };
  }
  let objections;
  try {
    // One denied judgment counts each objection hash at most once, however many
    // times the challenger repeats it.
    const byHash = new Map();
    for (const objection of response.objections) {
      const hash = objectionHash(objection);
      if (!byHash.has(hash)) byHash.set(hash, { ...objection, objection_hash: hash });
    }
    objections = [...byHash.values()];
  } catch {
    return { seat, burned: true, reason: "malformed-objection" };
  }
  return { seat, verdict: "denied", objections, provenance: result.provenance };
}

// --- Referee (role R) ------------------------------------------------------------
function readRefereeVerdict({ result, ledgerEntryIds, registry }) {
  if (!result || typeof result !== "object" || !result.response) {
    return { burned: true, reason: "invalid-provenance-or-shape" };
  }
  // Distinct calls: reusing ANY previously counted response id in this run —
  // including a Seat 4 challenge verdict's — burns the referee verdict.
  const claimed = registry.claim(result.provenance);
  if (!claimed.ok) {
    return { burned: true, reason: claimed.reason };
  }
  const response = result.response;
  if (!exactKeys(response, ["verdict", "loop_evidence"])
    || !["continue", "stalemate"].includes(response.verdict)
    || !Array.isArray(response.loop_evidence)) {
    return { burned: true, reason: "malformed-referee-shape" };
  }
  if (response.verdict === "continue") {
    return { verdict: "continue" };
  }
  // Evidence or burn: stalemate must cite ledger entries the referee was shown.
  if (response.loop_evidence.length === 0) {
    return { burned: true, reason: "stalemate-without-evidence" };
  }
  for (const item of response.loop_evidence) {
    if (!item || !nonempty(item.kind) || !Array.isArray(item.refs) || item.refs.length === 0 || !nonempty(item.why)) {
      return { burned: true, reason: "malformed-loop-evidence" };
    }
    if (!item.refs.every((ref) => ledgerEntryIds.has(ref))) {
      return { burned: true, reason: "unresolvable-loop-evidence-ref" };
    }
  }
  return { verdict: "stalemate", loop_evidence: response.loop_evidence };
}

// --- Orchestrator ---------------------------------------------------------------
export async function runDaedalusV2({
  frameRef,
  store,
  researchSeats,
  callResearchSeat,
  runJoin,
  callDispose,
  decideRoute = async () => ({ route: "defend" }),
  callChallengerSeat,
  callDefendSeat = null,
  callRefereeSeat,
  maxChallengeRounds = 4,
  minResearchSurvivors = null
}) {
  if (typeof runJoin !== "function") throw new Error("runJoin must be a function");
  const defendSeat = callDefendSeat ?? callChallengerSeat;
  const registry = makeProvenanceRegistry();
  // Ruling 1 rider: derived from THIS call's maxChallengeRounds (already
  // resolved to a concrete number via the parameter default above), never
  // a module-level literal — so a future change to the cap cannot silently
  // desync referee cadence.
  const refereeMinChallengeRound = Math.ceil(maxChallengeRounds / 2);
  const checkpoints = [];
  const record = (action, why) => {
    const checkpoint = agyCheckpoint({ action, why });
    checkpoints.push(checkpoint);
    return checkpoint;
  };
  const ledger = {
    denial_counts: new Map(),
    denied_twice: [],
    burned_referee_verdicts: [],
    plan_lineage: []
  };
  const rounds = [];
  const base = () => ({
    authorization_granted: false,
    implementation_started: false,
    research,
    rounds,
    checkpoints,
    ledger: publicLedger(ledger)
  });
  // Every needs-work exit is a governed terminal with a Seat 5 stage-terminal
  // checkpoint — model-supplied garbage must never crash the orchestrator.
  const needsWork = (stage, reason, why = {}) => {
    record({ kind: "stage-terminal", stage, terminal: "needs-work" }, { reason, ...why });
    return { ...base(), state: "needs-work", reason, terminal: "needs-work" };
  };

  // Stage 0 — research breakout.
  const research = await runResearchBreakout({
    frameRef, store, seats: researchSeats, callSeat: callResearchSeat, registry
  });
  const minimum = minResearchSurvivors ?? researchSeats.length;
  if (research.artifacts.length < minimum) {
    return needsWork("research-breakout", "research-survivors-below-minimum", {
      survivors: research.artifacts.map((artifact) => artifact.seat).sort(),
      burned: research.burned.map((entry) => entry.seat).sort(),
      minimum_required: minimum
    });
  }
  record(
    { kind: "stage-transition", from: "research-breakout", to: "plan-produce" },
    {
      survivors: research.artifacts.map((artifact) => artifact.seat).sort(),
      burned: research.burned.map((entry) => entry.seat).sort(),
      minimum_required: minimum
    }
  );

  const seenPlanRefs = new Set();

  // Stage 1 — plan produce (existing parallel join, injected).
  const join = async (joinWhy) => {
    let joined;
    try {
      joined = await runJoin({ frame_ref: frameRef, join_index: ledger.plan_lineage.length, why: joinWhy });
    } catch {
      return { failed: true };
    }
    if (!joined || joined.terminal !== "submit" || !nonempty(joined.plan_ref)) {
      return { failed: true };
    }
    ledger.plan_lineage.push(joined.plan_ref);
    return joined;
  };

  // Research dispositions bound to the join's integration candidate: a controller
  // presence check that every surviving Stage 0 artifact is accounted, re-required
  // for EVERY join (including modify re-joins — a new candidate needs its own map).
  const disposeFor = async (joined) => {
    let disposed;
    try {
      disposed = await callDispose({
        seat: "claude",
        phase: "dispose-research",
        surviving: research.artifacts,
        plan_ref: joined.plan_ref
      });
    } catch {
      return { failed: "research-disposition-transport" };
    }
    if (!disposed || !disposed.response) {
      return { failed: "research-disposition-provenance" };
    }
    const claimed = registry.claim(disposed.provenance);
    if (!claimed.ok) {
      return { failed: "research-disposition-provenance" };
    }
    let check;
    try {
      check = validateResearchDispositions({
        surviving: research.artifacts,
        dispositions: disposed.response.dispositions
      });
    } catch {
      return { failed: "research-dispositions-invalid" };
    }
    if (!check.complete) {
      return { failed: "research-dispositions-incomplete" };
    }
    store.write({
      kind: "research-disposition-record",
      action: {
        kind: "research-dispositions",
        plan_ref: joined.plan_ref,
        integration_ref: joined.integration_ref ?? null,
        dispositions: disposed.response.dispositions
      },
      why: { requirement_frame_ref: frameRef, note: "every surviving stage-0 artifact accounted before challenge" },
      provenance: disposed.provenance
    });
    return { ok: true, count: disposed.response.dispositions.length };
  };

  let current = await join({ reason: "initial-produce" });
  if (current.failed) {
    return needsWork("plan-produce", "join-failed", { join_index: 0 });
  }
  seenPlanRefs.add(current.plan_ref);
  let disposition = await disposeFor(current);
  if (disposition.failed) {
    return needsWork("plan-produce", disposition.failed, { plan_ref: current.plan_ref });
  }
  record(
    { kind: "stage-transition", from: "plan-produce", to: "plan-challenge" },
    { plan_ref: current.plan_ref, dispositions_complete: true, disposition_count: disposition.count }
  );

  // Stage 2 — plan challenge. Round counters are global: defend, modify, and
  // re-entry never reset them.
  let openObjectionHashes = new Set();
  let lastDefenses = [];
  // Growth-without-convergence tracking (bounded-review-loop mechanic,
  // 2026-07-22): a hash-pin/drift-void check was evaluated for this loop
  // and rejected — that mechanism exists to catch a target file mutated
  // between separate, temporally-gapped CLI invocations, and this loop is
  // one continuous, single-process execution where current.plan_ref cannot
  // drift mid-loop the way a disk file can across invocations days apart.
  let prevRoundOpenCount = null;
  let prevRoundDistinctCount = null;
  for (let round = 1; round <= maxChallengeRounds; round += 1) {
    const rawResults = [];
    for (const seat of CHALLENGE_SEATS) {
      let result = null;
      let transportError = false;
      try {
        result = await callChallengerSeat({
          seat,
          phase: "challenge",
          round,
          plan_ref: current.plan_ref,
          frame_ref: frameRef,
          open_objection_hashes: [...openObjectionHashes],
          defended: lastDefenses.map((defense) => ({
            objection_hash: defense.objection_hash,
            record_ref: defense.record_ref,
            rationale: defense.record.why.rationale
          }))
        });
      } catch {
        transportError = true;
      }
      rawResults.push({ seat, result, transportError });
    }
    // Within-round shared response ids burn BOTH verdicts (group burn, as in
    // Stage 0): the controller cannot tell the impersonator from the victim.
    const roundIds = new Map();
    for (const { result } of rawResults) {
      const id = result?.provenance?.response_id;
      if (nonempty(id)) roundIds.set(id, (roundIds.get(id) ?? 0) + 1);
    }
    const verdicts = rawResults.map(({ seat, result, transportError }) => {
      if (transportError) return { seat, burned: true, reason: "challenger-transport-error" };
      if ((roundIds.get(result?.provenance?.response_id) ?? 0) > 1) {
        return { seat, burned: true, reason: "shared-provenance" };
      }
      return readChallengeVerdict({ seat, result, registry });
    });
    lastDefenses = [];
    const burnedVerdicts = verdicts.filter((verdict) => verdict.burned);
    const denials = verdicts.filter((verdict) => verdict.verdict === "denied");
    const roundEntry = {
      round,
      entry_id: `round-${round}`,
      plan_ref: current.plan_ref,
      verdicts: verdicts.map((verdict) => verdict.burned
        ? { seat: verdict.seat, burned: true, reason: verdict.reason }
        : {
          seat: verdict.seat,
          verdict: verdict.verdict,
          objections: (verdict.objections ?? []).map((objection) => ({
            objection_hash: objection.objection_hash,
            scope: objection.scope,
            claim: objection.claim
          }))
        }),
      burned_verdicts: burnedVerdicts.map((verdict) => ({ seat: verdict.seat, reason: verdict.reason })),
      defenses: []
    };
    rounds.push(roundEntry);

    // Controller counting: one denied judgment counts each objection hash once;
    // denials from either challenger, in any round, accumulate stage-globally.
    for (const denial of denials) {
      for (const objection of denial.objections) {
        const count = (ledger.denial_counts.get(objection.objection_hash) ?? 0) + 1;
        ledger.denial_counts.set(objection.objection_hash, count);
        openObjectionHashes.add(objection.objection_hash);
        if (count >= 2 && !ledger.denied_twice.includes(objection.objection_hash)) {
          ledger.denied_twice.push(objection.objection_hash);
        }
      }
    }
    if (ledger.denied_twice.length > 0) {
      return needsWork("plan-challenge", "objection-denied-twice", {
        round,
        objection_hashes: [...ledger.denied_twice]
      });
    }

    const bothAccepted = verdicts.length === CHALLENGE_SEATS.length
      && verdicts.every((verdict) => verdict.verdict === "accepted");
    if (bothAccepted) {
      openObjectionHashes = new Set();
      record(
        { kind: "stage-transition", from: "plan-challenge", to: "eye-planning-gate" },
        { plan_ref: current.plan_ref, round, both_accepted: true, attested_silence: true }
      );
      return {
        ...base(),
        state: "converged-for-submission",
        reason: "both-challengers-accepted",
        terminal: "submit",
        plan_ref: current.plan_ref
      };
    }

    // Referee cadence: challenge rounds ≥ 2, one call per watched round. The
    // ledger view carries round dynamics — objection text and defense rationales
    // for semantic loop detection — but never candidate bytes. Referee failure
    // (transport, shape, provenance reuse, unresolvable evidence) only burns.
    if (round >= refereeMinChallengeRound && typeof callRefereeSeat === "function") {
      const ledgerEntryIds = new Set(rounds.map((entry) => entry.entry_id));
      let refereeResult = null;
      try {
        refereeResult = await callRefereeSeat({
          seat: "gemini",
          role: "referee",
          phase: "referee",
          stage: "plan-challenge",
          round,
          ledger_view: {
            stage: "plan-challenge",
            plan_lineage: [...ledger.plan_lineage],
            rounds: rounds.map((entry) => ({
              entry_id: entry.entry_id,
              plan_ref: entry.plan_ref,
              verdicts: entry.verdicts,
              defenses: entry.defenses.map((defense) => ({
                objection_hash: defense.objection_hash,
                rationale: defense.record.why.rationale
              }))
            }))
          }
        });
      } catch {
        ledger.burned_referee_verdicts.push({ round, reason: "referee-transport-error" });
      }
      if (refereeResult !== null) {
        const refereeVerdict = readRefereeVerdict({ result: refereeResult, ledgerEntryIds, registry });
        if (refereeVerdict.burned) {
          ledger.burned_referee_verdicts.push({ round, reason: refereeVerdict.reason });
        } else if (refereeVerdict.verdict === "stalemate") {
          const result = needsWork("plan-challenge", "referee-stalemate", {
            round,
            evidence_kinds: refereeVerdict.loop_evidence.map((item) => item.kind)
          });
          return { ...result, referee_evidence: refereeVerdict.loop_evidence };
        }
      }
    }

    if (denials.length > 0 && round < maxChallengeRounds) {
      const { route } = await decideRoute({ round, open_objections: [...openObjectionHashes] });
      // Seat 5 records the deny→return transition; it does not dispose objections.
      record(
        { kind: "stage-transition", from: "plan-challenge", to: "plan-produce" },
        { round, route, open_objection_hashes: [...openObjectionHashes].sort() }
      );
      if (route === "modify") {
        const next = await join({ reason: "modify-after-deny", answered_round: round });
        if (next.failed) {
          return needsWork("plan-produce", "join-failed", { join_index: ledger.plan_lineage.length, after_round: round });
        }
        if (seenPlanRefs.has(next.plan_ref) && openObjectionHashes.size > 0) {
          return needsWork("plan-challenge", "lineage-oscillation", { round, plan_ref: next.plan_ref });
        }
        seenPlanRefs.add(next.plan_ref);
        current = next;
        // A modified candidate needs its own research-disposition map.
        disposition = await disposeFor(current);
        if (disposition.failed) {
          return needsWork("plan-produce", disposition.failed, { plan_ref: current.plan_ref });
        }
        record(
          { kind: "stage-transition", from: "plan-produce", to: "plan-challenge" },
          { plan_ref: current.plan_ref, dispositions_complete: true, disposition_count: disposition.count }
        );
      } else {
        // Defend: one produce-pair defense per denied round. The record binds both
        // produce provenances — distinct ids, or one seat is papering the deny.
        const deniedObjections = denials.flatMap((denial) => denial.objections);
        const defenseCalls = [];
        let defenseFailure = null;
        for (const seat of PRODUCE_SEATS) {
          let result;
          try {
            result = await defendSeat({
              seat,
              phase: "defend",
              round,
              plan_ref: current.plan_ref,
              objection_hashes: deniedObjections.map((objection) => objection.objection_hash)
            });
          } catch {
            defenseFailure = "defense-transport-error";
            break;
          }
          if (!result || !result.response) {
            defenseFailure = "defense-provenance";
            break;
          }
          const claimed = registry.claim(result.provenance);
          if (!claimed.ok) {
            defenseFailure = claimed.reason === "reused-provenance" ? "defense-shared-provenance" : "defense-provenance";
            break;
          }
          defenseCalls.push({ seat, result });
        }
        if (defenseFailure) {
          return needsWork("plan-challenge", defenseFailure, { round });
        }
        const [drafted, concurred] = defenseCalls;
        if (concurred.result.response.concur !== true) {
          return needsWork("plan-challenge", "defense-not-concurred", { round });
        }
        if (!nonempty(drafted.result.response.rationale)) {
          return needsWork("plan-challenge", "defense-without-why", { round });
        }
        for (const objection of deniedObjections) {
          const defenseRecord = {
            action: { kind: "disposition", objection_hash: objection.objection_hash, verb: "resolved" },
            why: {
              rationale: drafted.result.response.rationale,
              answered_by_seat: drafted.seat,
              evidence_refs: objection.evidence_refs ?? []
            }
          };
          const { ref } = store.write({
            kind: "defense-record",
            ...defenseRecord,
            provenance: defenseCalls.map((call) => call.result.provenance)
          });
          const defense = {
            objection_hash: objection.objection_hash,
            record: defenseRecord,
            record_ref: ref,
            provenance: defenseCalls.map((call) => call.result.provenance)
          };
          roundEntry.defenses.push(defense);
          lastDefenses.push(defense);
          openObjectionHashes.delete(objection.objection_hash);
        }
      }
    }

    // Growth-without-convergence: the unresolved-objection backlog (this
    // model's stand-in for bounded-review.mjs's growing target byte-size —
    // the controller never sees plan bytes, only content-addressed refs)
    // must not grow while the run still has round headroom. Skipped on the
    // terminal round: challenge-round-cap is the more specific diagnosis
    // when both would fire on the same iteration.
    if (round < maxChallengeRounds) {
      const currentOpenCount = openObjectionHashes.size;
      const currentDistinctCount = ledger.denial_counts.size;
      if (
        prevRoundOpenCount !== null && prevRoundOpenCount > 0
        && currentDistinctCount > prevRoundDistinctCount
        && currentOpenCount >= prevRoundOpenCount
      ) {
        return needsWork("plan-challenge", "growth-without-convergence", {
          round,
          distinct_objection_count: { previous: prevRoundDistinctCount, current: currentDistinctCount },
          open_objection_count: { previous: prevRoundOpenCount, current: currentOpenCount }
        });
      }
      prevRoundOpenCount = currentOpenCount;
      prevRoundDistinctCount = currentDistinctCount;
    }
  }

  return needsWork("plan-challenge", "challenge-round-cap", {
    rounds: rounds.length,
    cap: maxChallengeRounds
  });
}

function publicLedger(ledger) {
  return {
    denied_twice: [...ledger.denied_twice],
    burned_referee_verdicts: [...ledger.burned_referee_verdicts],
    plan_lineage: [...ledger.plan_lineage]
  };
}
