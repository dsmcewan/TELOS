#!/usr/bin/env node
// comprehension-gate.mjs — the reader-validation gate of the AI-native
// institutional-memory layer.
//
// "Reading files is not evidence that the system was understood." Before a reader
// (AI or human) is granted implementation authority, it must return an answer set
// that this gate grades DETERMINISTICALLY against authority-anchored expected
// facts. A wrong answer (e.g. "eight packages", "Clotho proves loader containment")
// is an onboarding failure: no implementation authority. No council spend — the
// answer key terminates in stable identifiers, not model opinion.
//
// Usage:
//   node comprehension-gate.mjs <queries.json> <reader-answers.json> [--out <artifact.json>]
//   exit 0  => reader passed (all checks green); a reader-validation-artifact is printed/written
//   exit 3  => reader failed comprehension (see artifact.failures)
//   exit 1  => the gate itself could not run (missing or drifted authority record, etc.)
//
// Fail-closed: the gate first verifies the ACTIVE plan's content hash against
// CURRENT-AUTHORITY.json (so a drifted authority record cannot certify anyone),
// then grades the reader.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const { canonicalize, sha256hex } = await import(pathToFileURL(path.join(ROOT, "merkle-dag/vendor.mjs")).href);

const planRefOf = (planText) => "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: planText }));
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const asSet = (a) => new Set(Array.isArray(a) ? a : []);
const setEq = (a, b) => { const x = asSet(a), y = asSet(b); return x.size === y.size && [...x].every((v) => y.has(v)); };

function die(msg) { console.error("GATE_ERROR: " + msg); process.exit(1); }

const [, , queriesPath, answersPath, ...rest] = process.argv;
if (!queriesPath || !answersPath) die("usage: comprehension-gate.mjs <queries.json> <reader-answers.json> [--out <file>]");
const outIdx = rest.indexOf("--out");
const outPath = outIdx >= 0 ? rest[outIdx + 1] : null;

let queries, answers, authority;
try { queries = readJson(path.resolve(queriesPath)); } catch (e) { die(`cannot read queries: ${e.message}`); }
try { answers = readJson(path.resolve(answersPath)); } catch (e) { die(`cannot read answers: ${e.message}`); }
try { authority = readJson(path.join(ROOT, "CURRENT-AUTHORITY.json")); } catch (e) { die(`cannot read CURRENT-AUTHORITY.json: ${e.message}`); }

// ---- 0. verify the authority record against system reality (fail-closed) ------
const active = authority.active_plan;
if (!active || !active.path || !active.sha256) die("CURRENT-AUTHORITY.json: active_plan.{path,sha256} required");
let realPlanRef;
try { realPlanRef = planRefOf(readFileSync(path.join(ROOT, active.path), "utf8")); }
catch (e) { die(`cannot read active plan ${active.path}: ${e.message}`); }
if (realPlanRef !== active.sha256) {
  die(`AUTHORITY DRIFT: active plan ${active.path} recomputes to ${realPlanRef}, but CURRENT-AUTHORITY.json says ${active.sha256}. The authority record does not match reality; refusing to certify any reader.`);
}
const supersededAuthz = new Set((authority.superseded || []).map((s) => s.authorization).filter(Boolean));
const activeAuthz = authority.active_authorization && authority.active_authorization.id;

// ---- grade the reader ---------------------------------------------------------
const failures = [];
const checks = [];
const record = (id, ok, detail) => { checks.push({ id, ok, detail }); if (!ok) failures.push(`${id}: ${detail}`); };

// 1. resolved the ACTIVE authority (not a superseded one)
record("resolved_active_plan", answers.resolved_plan_ref === active.sha256,
  `reader.resolved_plan_ref=${answers.resolved_plan_ref} expected active ${active.sha256}`);
record("resolved_active_authorization", answers.resolved_authorization === activeAuthz,
  `reader.resolved_authorization=${answers.resolved_authorization} expected ${activeAuthz}`);

// 2. the queries file itself is bound to the active plan (no stale query set)
const qref = queries.governing_authority && queries.governing_authority.plan_ref;
record("queries_bound_to_active_plan", qref === active.sha256,
  `queries.governing_authority.plan_ref=${qref} expected active ${active.sha256}`);

// 3. reader must explicitly exclude every superseded authorization as non-governing
const excluded = asSet(answers.excluded_superseded);
const missingExcl = [...supersededAuthz].filter((a) => !excluded.has(a));
record("excluded_superseded", missingExcl.length === 0,
  missingExcl.length ? `did not mark superseded authorizations as non-governing: ${missingExcl.join(", ")}` : "all superseded authorizations excluded");

// 4. deterministic comprehension answers
const ans = answers.answers || {};
for (const q of queries.queries || []) {
  const given = ans[q.id];
  let ok, detail;
  if (given === undefined) { ok = false; detail = "no answer provided"; }
  else if (q.answer_kind === "set") { ok = setEq(given, q.expected); detail = ok ? "set match" : `got ${JSON.stringify(given)} expected ${JSON.stringify(q.expected)}`; }
  else if (q.answer_kind === "boolean") { ok = given === q.expected; detail = ok ? "match" : `got ${JSON.stringify(given)} expected ${JSON.stringify(q.expected)}`; }
  else if (q.answer_kind === "enum") { ok = given === q.expected; detail = ok ? "match" : `got ${JSON.stringify(given)} expected ${JSON.stringify(q.expected)}`; }
  else { ok = false; detail = `unknown answer_kind ${q.answer_kind}`; }
  record(`answer:${q.id}`, ok, detail + (q.authority_anchor ? ` [anchor: ${JSON.stringify(q.authority_anchor)}]` : ""));
}

// 5. required invariants + non-claims acknowledged (by id)
for (const reqId of queries.required_invariants || []) record(`invariant_read:${reqId}`, asSet(answers.invariants_read).has(reqId), `reader did not acknowledge invariant ${reqId}`);
for (const reqId of queries.required_non_claims || []) record(`non_claim_read:${reqId}`, asSet(answers.non_claims_read).has(reqId), `reader did not acknowledge non-claim ${reqId}`);

const passed = failures.length === 0;
const artifact = {
  gate: "comprehension-gate",
  component: queries.component || null,
  reader: answers.reader || null,
  active_authority: { plan: active.path, plan_ref: active.sha256, authorization: activeAuthz },
  plan_hash_verified: true,
  authority_resolved: passed ? activeAuthz : null,
  superseded_artifacts_excluded: missingExcl.length === 0,
  comprehension_checks: { passed: checks.filter((c) => c.ok).length, failed: failures.length, checks },
  unresolved_contradictions: failures,
  result: passed ? "COMPREHENSION_PASSED" : "COMPREHENSION_FAILED",
  implementation_authority: passed ? "GRANTED" : "DENIED"
};
const json = JSON.stringify(artifact, null, 2);
if (outPath) writeFileSync(path.resolve(outPath), json);
console.log(json);
process.exit(passed ? 0 : 3);
