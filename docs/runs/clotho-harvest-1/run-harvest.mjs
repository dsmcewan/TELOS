#!/usr/bin/env node
// TELOS review HARVEST over Clotho Phase 1 plan v11 + spec v2.8.
//
// NOT an authorization. Finding is separated from judging (The Eye,
// 2026-07-15): all four generative seats run in COVERAGE mode — report every
// defect at every layer, do not filter, do not stop at blockers — in repeated
// rounds until two consecutive rounds surface nothing new. Each new finding
// then faces an adversarial refute-mode verification by a different seat.
// The verified register goes to The Eye for one-sitting triage; the
// authorization gate itself stays binary and untouched.
//
// Seeds: the four authz-004 codex hard stops (already Eye-visible/accepted)
// ride as do-not-re-report register entries so nothing is double-paid.
//
// Run: "/mnt/c/Program Files/nodejs/node.exe" docs/runs/clotho-harvest-1/run-harvest.mjs
// Outputs: harvest-register.json, events.jsonl (in this directory).

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

process.env.AI_PEER_LONG_TIMEOUT = "1";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const seat = await imp("connectors/ai-peer-mcp/server.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const H = (v) => "sha256:" + sha256hex(canonicalize(v));

// ---------- bind the exact artifacts under review ----------
const PLAN_PATH = "docs/runs/clotho-daedalus-delta10/matured-plan-v11.md";
const EXPECTED_PLAN_REF = "sha256:f5d9cd52f12ec9abb4c613c469437d0079af7fdf249c5a842f94c451d55fc30c";
const plan = readFileSync(path.join(ROOT, PLAN_PATH), "utf8");
if (H({ kind: "candidate", plan }) !== EXPECTED_PLAN_REF) {
  console.error("PLAN DRIFT — refusing to harvest against unexpected bytes.");
  process.exit(1);
}
const spec = readFileSync(path.join(ROOT, "docs/clotho-phase-1-design.md"), "utf8");

// ---------- seed register: the four accepted authz-004 hard stops ----------
const cx4 = JSON.parse(readFileSync(path.join(ROOT, "docs/runs/clotho-authorization-4/codex.json"), "utf8"));
const seeds = cx4.hard_stops.map((h, i) => ({
  id: `seed-${i + 1}`, source: "authz-004 codex hard stop (accepted by The Eye)",
  scope: h.split(":")[0].slice(0, 120), claim: h
}));

const EVENTS = path.join(HERE, "events.jsonl");
mkdirSync(HERE, { recursive: true });
const ev = (o) => appendFileSync(EVENTS, JSON.stringify({ ...o, at: new Date().toISOString() }) + "\n");

const FINDINGS_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    findings: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: {
        layer: { type: "string", description: "normative-text | intersection | runtime-enforcement | test-sufficiency | security | interface | sequencing | other" },
        scope: { type: "string", description: "The plan/spec section, decision, or mechanism the defect lives in." },
        claim: { type: "string", description: "The specific defect and why it matters — concrete failure, not preference." },
        severity: { type: "string", enum: ["high", "medium", "low"] },
        suggested_fix: { type: "string" }
      },
      required: ["layer", "scope", "claim", "severity", "suggested_fix"]
    }}
  },
  required: ["findings"]
};

const VERDICT_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    refuted: { type: "boolean" },
    duplicate_of: { type: "string", description: "Register id if this duplicates an existing entry, else empty string." },
    reason: { type: "string" }
  },
  required: ["refuted", "duplicate_of", "reason"]
};

const ASK = { claude: seat.askClaude, codex: seat.askCodex, grok: seat.askGrok, gemini: seat.askGemini };
const FINDERS = ["claude", "codex", "grok", "gemini"];
// Cross-seat verification: never let a seat judge its own finding.
const VERIFIER_FOR = { claude: "codex", codex: "claude", grok: "claude", gemini: "codex" };

const renderRegister = (entries) => entries.length
  ? entries.map((e) => `- [${e.id}] (${e.scope}) ${e.claim}`).join("\n")
  : "(empty)";

async function call(seatName, args) {
  const r = await ASK[seatName]({ ...args, model: seatName, effort: "high", max_tokens: 60000, include_provenance: false });
  return { parsed: JSON.parse(r.text), provenance: { model: r.model, response_id: r.id } };
}

const dedupeKey = (f) => H({ scope: String(f.scope).toLowerCase().trim(), claim: String(f.claim).toLowerCase().trim() });

// ---------- Phase A: harvest rounds, loop until dry ----------
const register = [...seeds];
const harvested = [];
const seenKeys = new Set(seeds.map(dedupeKey));
const MAX_ROUNDS = 4, DRY_NEEDED = 2;
let dry = 0, round = 0;

while (round < MAX_ROUNDS && dry < DRY_NEEDED) {
  round++;
  const prompt = (finder) => [
    `You are the ${finder} FINDER in a TELOS review harvest over the Clotho Phase 1 implementation plan v11 and its governing spec v2.8. This is NOT an authorization council.`,
    "",
    "MISSION — coverage over filtering: report EVERY genuine defect you can find, at EVERY layer:",
    "normative-text contradictions; cross-mechanism intersection gaps; runtime-enforcement gaps (the text promises X but nothing specified makes X true at execution time); test insufficiency; security/evasion routes; interface contradictions; sequencing impossibilities.",
    "Include findings you are uncertain about — a separate adversarial verification pass judges them; your job is recall.",
    "Do NOT report pure style/wording preferences with no functional consequence.",
    `Do NOT re-report anything on the KNOWN REGISTER below (${register.length} entries) — find what is NOT there.`,
    "",
    "KNOWN REGISTER (do not re-report):",
    renderRegister(register),
    "",
    "=== GOVERNING SPEC v2.8 ===", spec,
    "", "=== PLAN v11 (candidate " + EXPECTED_PLAN_REF + ") ===", plan
  ].join("\n");

  const results = await Promise.allSettled(FINDERS.map(async (f) => {
    const { parsed, provenance } = await call(f, {
      prompt: prompt(f),
      system: `You are the ${f} seat acting as a defect FINDER. Recall over precision; concreteness over rhetoric. Every claim must name a specific mechanism and a specific way it fails.`,
      response_schema: FINDINGS_SCHEMA, schema_name: "harvest_findings"
    });
    return { finder: f, findings: parsed.findings || [], provenance };
  }));

  let fresh = 0, succeeded = 0;
  for (const res of results) {
    if (res.status !== "fulfilled") { ev({ round, error: String(res.reason).slice(0, 300) }); continue; }
    succeeded++;
    const { finder, findings, provenance } = res.value;
    for (const f of findings) {
      const key = dedupeKey(f);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const id = `h-${harvested.length + 1}`;
      const entry = { id, round, finder, provenance, ...f };
      harvested.push(entry);
      register.push({ id, scope: f.scope, claim: f.claim });
      fresh++;
    }
    ev({ round, finder, reported: findings.length, provenance });
  }
  // Silence is not success: a round counts toward "dry" ONLY when every finder
  // actually answered. A round with any failed finder is VOID for dryness (its
  // fresh findings still count); two consecutive fully-failed rounds abort.
  if (succeeded === FINDERS.length) {
    dry = fresh === 0 ? dry + 1 : 0;
  } else if (succeeded === 0) {
    ev({ round, fatal: "all finders failed" });
    if (round >= 2) { console.error("HARVEST_ABORT: all finders failed in consecutive rounds."); process.exit(1); }
  }
  ev({ round, fresh, succeeded, dry });
  console.log(`round ${round}: ${fresh} fresh findings (${succeeded}/${FINDERS.length} finders ok, dry=${dry})`);
}

// ---------- Phase B: adversarial cross-seat verification ----------
for (const f of harvested) {
  const verifier = VERIFIER_FOR[f.finder];
  try {
    const { parsed, provenance } = await call(verifier, {
      prompt: [
        `Adversarially VERIFY this candidate finding against the actual plan v11 and spec v2.8 below. REFUTE it if: it is not a real defect; an existing requirement already covers it (cite the exact decision/section); it duplicates a register entry (give its id); or its concrete failure scenario cannot occur. Default refuted=true when you cannot confirm concretely.`,
        "", `FINDING [${f.id}] by ${f.finder} (layer ${f.layer}, severity ${f.severity}):`,
        `scope: ${f.scope}`, `claim: ${f.claim}`, `suggested_fix: ${f.suggested_fix}`,
        "", "REGISTER (for duplicate checks):", renderRegister(register.filter((e) => e.id !== f.id)),
        "", "=== GOVERNING SPEC v2.8 ===", spec,
        "", "=== PLAN v11 ===", plan
      ].join("\n"),
      system: `You are the ${verifier} seat acting as an adversarial VERIFIER. Your default is refutation; only concretely confirmed defects survive.`,
      response_schema: VERDICT_SCHEMA, schema_name: "harvest_verdict"
    });
    f.verdict = { ...parsed, verifier, provenance };
  } catch (e) {
    f.verdict = { refuted: null, duplicate_of: "", reason: "verification failed: " + String(e).slice(0, 200), verifier };
  }
  ev({ verify: f.id, refuted: f.verdict.refuted, verifier });
}

const confirmed = harvested.filter((f) => f.verdict && f.verdict.refuted === false);
const outcome = {
  mode: "harvest", plan_ref: EXPECTED_PLAN_REF, plan_path: PLAN_PATH,
  rounds_run: round, dry_rounds: dry, reached_dry: dry >= DRY_NEEDED,
  seeds, harvested_total: harvested.length, confirmed_total: confirmed.length,
  harvested,
  note: "Review evidence, not authorization. Response ids are provenance, not signatures. Confirmed findings await The Eye's triage."
};
writeFileSync(path.join(HERE, "harvest-register.json"), JSON.stringify(outcome, null, 2));
console.log(JSON.stringify({ rounds: round, reached_dry: dry >= DRY_NEEDED, harvested: harvested.length, confirmed: confirmed.length }, null, 2));
