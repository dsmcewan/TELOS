#!/usr/bin/env node
// Root-cause study — Phase 1: verify a DETERMINISTIC stratified sample of the
// unverified harvest pool (The Eye, 2026-07-15). Not a full re-verification:
// ~40 findings sampled across rounds via content-addressed ordering (sha256 of
// finding id — reproducible, no RNG), each adversarially refute-verified by a
// cross-seat verifier, so the sample's disposition base rate is measured the
// same way the 47 refuted / 3 confirmed were.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
process.env.AI_PEER_LONG_TIMEOUT = "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const seat = await imp("connectors/ai-peer-mcp/server.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const H = (v) => sha256hex(canonicalize(v));

const o = JSON.parse(readFileSync(path.join(HERE, "harvest-register.json"), "utf8"));
const plan = readFileSync(path.join(ROOT, o.plan_path), "utf8");
const spec = readFileSync(path.join(ROOT, "docs/clotho-phase-1-design.md"), "utf8");
const register = o.harvested.map((e) => ({ id: e.id, scope: e.scope, claim: e.claim }));

// unverified pool = harvested with no real verdict
const unverified = o.harvested.filter((f) => !f.verdict || f.verdict.refuted === null || f.verdict.refuted === undefined);
// deterministic stratified sample: within each round, order by sha256(id), take proportional share of ~40
const TARGET = 40;
const byRound = {};
for (const f of unverified) (byRound[f.round] ||= []).push(f);
const sample = [];
for (const r of Object.keys(byRound).sort()) {
  const grp = byRound[r].sort((a, b) => H(a.id).localeCompare(H(b.id)));
  const take = Math.max(1, Math.round(TARGET * grp.length / unverified.length));
  sample.push(...grp.slice(0, take));
}
console.log(`unverified=${unverified.length} sample=${sample.length} across rounds ${Object.keys(byRound).sort().join(",")}`);

const VERIFIER_FOR = { claude: "codex", codex: "claude", grok: "claude", gemini: "codex" };
const ASK = { claude: seat.askClaude, codex: seat.askCodex, grok: seat.askGrok, gemini: seat.askGemini };
const VERDICT = { type: "object", additionalProperties: false, properties: {
  refuted: { type: "boolean" },
  disposition: { type: "string", enum: ["real", "duplicate", "already-covered", "impossible-premise", "non-goal", "stylistic"] },
  reason: { type: "string" }
}, required: ["refuted", "disposition", "reason"] };
const EVENTS = path.join(HERE, "rootcause-events.jsonl");
const ev = (x) => appendFileSync(EVENTS, JSON.stringify({ ...x, at: new Date().toISOString() }) + "\n");

const renderReg = (excl) => register.filter((e) => e.id !== excl).map((e) => `- [${e.id}] (${e.scope}) ${e.claim.slice(0,140)}`).join("\n");

for (const f of sample) {
  const verifier = VERIFIER_FOR[f.finder];
  try {
    const r = await ASK[verifier]({
      model: verifier, effort: "high", max_tokens: 40000, include_provenance: false,
      response_schema: VERDICT, schema_name: "rootcause_verdict",
      system: `You are the ${verifier} seat, an adversarial VERIFIER. Default to refutation. Assign ONE disposition: real (genuine unaddressed defect), duplicate (of a register entry), already-covered (an existing requirement/decision/test handles it — cite it), impossible-premise (the failure cannot occur), non-goal (out of Phase 1 scope), stylistic (no functional consequence).`,
      prompt: [
        `Adversarially verify and DISPOSITION this candidate finding against plan v11 and spec v2.8.`,
        `FINDING [${f.id}] by ${f.finder} (declared layer ${f.layer}, severity ${f.severity}):`,
        `scope: ${f.scope}`, `claim: ${f.claim}`, `suggested_fix: ${f.suggested_fix}`,
        "", "REGISTER (for duplicate checks):", renderReg(f.id),
        "", "=== SPEC v2.8 ===", spec, "", "=== PLAN v11 ===", plan
      ].join("\n")
    });
    const v = JSON.parse(r.text);
    f.sample_verdict = { ...v, verifier };
  } catch (e) { f.sample_verdict = { refuted: null, disposition: "error", reason: String(e).slice(0,160), verifier }; }
  ev({ id: f.id, refuted: f.sample_verdict.refuted, disposition: f.sample_verdict.disposition });
}

writeFileSync(path.join(HERE, "rootcause-sample.json"), JSON.stringify({
  unverified_total: unverified.length, sample_size: sample.length,
  sample: sample.map((f) => ({ id: f.id, round: f.round, finder: f.finder, layer: f.layer, severity: f.severity, scope: f.scope, claim: f.claim, verdict: f.sample_verdict }))
}, null, 2));
const real = sample.filter((f) => f.sample_verdict.disposition === "real").length;
console.log(JSON.stringify({ sample: sample.length, real, refuted: sample.filter(f=>f.sample_verdict.refuted===true).length }, null, 2));
