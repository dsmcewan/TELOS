#!/usr/bin/env node
// check.mjs — fail-closed structural + provenance checker for the agentic-orchestration
// advisory reference. Pure Node >=18 ESM, zero runtime deps, read-only, no network.
// Proves structural integrity + provenance linkage + content-addressing + projection
// equality (via render --check). It does NOT claim a pattern choice is optimal or a
// worked-example interpretation is semantically complete.
//
//   node check.mjs        # exit 0 iff all checks pass, else nonzero + reasons
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const REL = (p) => path.relative(ROOT, p).split(path.sep).join("/");

const KINDS = new Set(["mechanism", "decision", "rejected-alternative", "non-claim", "invariant", "open-question", "contract", "evidence"]);
const STATUS = new Set(["NORMATIVE-CURRENT", "SUPERSEDED", "SPECIFIED-PENDING-IMPLEMENTATION", "MODEL-PROPOSAL", "REJECTED-ALTERNATIVE", "OPEN-QUESTION", "HUMAN-AUTHORIZED-EXCEPTION", "ADVISORY"]);
const HEX40 = /^[0-9a-f]{40}$/;

const fail = [];
const F = (m) => fail.push(m);

// ---- load every record (comprehension-queries.json is a gate INPUT, not a record) ----
const NOT_A_RECORD = new Set(["comprehension-queries.json"]);
const recordFiles = [];
for (const f of readdirSync(HERE)) if (f.endsWith(".json") && !NOT_A_RECORD.has(f)) recordFiles.push(path.join(HERE, f));
for (const sub of ["CONTRACTS", "EVIDENCE"]) for (const f of readdirSync(path.join(HERE, sub))) if (f.endsWith(".json")) recordFiles.push(path.join(HERE, sub, f));

const records = [];
for (const abs of recordFiles) {
  let r;
  try { r = JSON.parse(readFileSync(abs, "utf8")); } catch (e) { F(`${REL(abs)}: unparseable JSON (${e.message})`); continue; }
  records.push({ abs, rel: REL(abs), r });
  if (!KINDS.has(r.kind)) F(`${REL(abs)}: kind '${r.kind}' not in the closed set`);
  if (!STATUS.has(r.status)) F(`${REL(abs)}: status '${r.status}' not in the closed set`);
  if (r.normativity !== "ADVISORY") F(`${REL(abs)}: normativity must be ADVISORY (got '${r.normativity}')`);
}

// ---- authority / provenance discipline: a terminal authority must be a pinned scheme,
// never a bare http URL, bare date, mutable path, or abbreviated hash ----
function isPinnedRef(s) {
  if (typeof s !== "string") return false;
  if (s.startsWith("git:")) return HEX40.test(s.slice(4));
  if (s.startsWith("file:")) { const at = s.lastIndexOf("@"); return at > 5 && HEX40.test(s.slice(at + 1)); }
  return false;
}
function gitBlobSha(relPath) {
  try { return execFileSync("git", ["hash-object", relPath], { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; }
}
function resolvePinned(s) {
  if (s.startsWith("git:")) { try { execFileSync("git", ["cat-file", "-e", s.slice(4)], { cwd: ROOT }); return true; } catch { return false; } }
  const at = s.lastIndexOf("@"); const p = s.slice(5, at), sha = s.slice(at + 1);
  return gitBlobSha(p) === sha; // content-address integrity: current file hashes to the pinned sha
}
const abbrevSha = /sha256:[0-9a-f]{6,12}(…|\.\.\.|$)/; // an abbreviated/elided sha256 is not a terminal anchor

for (const { rel, r } of records) {
  // authority must contain at least one pinned ref and must not rely solely on a URL/abbrev
  const auth = String(r.authority || "");
  if (r.authority !== undefined) {
    if (!/(^|\s)git:[0-9a-f]{40}|file:[^\s]+@[0-9a-f]{40}/.test(auth)) F(`${rel}: authority has no pinned git:/file:@ anchor`);
    if (abbrevSha.test(auth)) F(`${rel}: authority uses an abbreviated sha256 (not a terminal anchor)`);
  }
  // evidence entries must each be pinned + resolve
  for (const e of Array.isArray(r.evidence) ? r.evidence : []) {
    if (!isPinnedRef(e)) { F(`${rel}: evidence ref not a pinned scheme: ${e}`); continue; }
    if (!resolvePinned(e)) F(`${rel}: evidence pinned ref does not resolve (content-address mismatch): ${e}`);
  }
}

// ---- collect + resolve every file:@sha across the whole reference (incl. worked examples) ----
const allText = records.map((x) => JSON.stringify(x.r)).join("\n");
const pinRe = /file:[^"\s]+@[0-9a-f]{40}|git:[0-9a-f]{40}/g;
for (const m of allText.match(pinRe) || []) if (!resolvePinned(m)) F(`unresolved pinned ref (content-address mismatch): ${m}`);

// ---- taxonomy: exactly 5 workflow + 1 agent, unique keys ----
const tax = records.find((x) => x.r.id === "agentic-orchestration-pattern-taxonomy");
if (!tax) F("pattern-taxonomy contract missing");
else {
  const p = tax.r.patterns || [];
  const wf = p.filter((x) => x.classification === "workflow").length;
  const ag = p.filter((x) => x.classification === "agent").length;
  if (wf !== 5) F(`taxonomy must have exactly 5 workflow entries (got ${wf})`);
  if (ag !== 1) F(`taxonomy must have exactly 1 agent entry (got ${ag})`);
  const keys = p.map((x) => x.key);
  if (new Set(keys).size !== keys.length) F("taxonomy keys not unique");
}

// ---- checklist: local synthesis + evidence ----
const cl = records.find((x) => x.r.id === "agentic-orchestration-decision-checklist");
if (!cl) F("decision-checklist contract missing");
else {
  if (cl.r.synthesis !== true) F("checklist not explicitly marked local synthesis (synthesis:true)");
  if (!(Array.isArray(cl.r.evidence) && cl.r.evidence.length)) F("checklist carries no evidence reference");
}

// ---- manifest negative check: the reference must NOT be registered as a component/role/future module ----
try {
  const man = JSON.parse(readFileSync(path.join(ROOT, "repository-manifest.json"), "utf8"));
  const buckets = ["components", "role_modules", "future_modules"];
  const hay = JSON.stringify(buckets.map((b) => man[b] || null));
  if (/agentic-orchestration/.test(hay)) F("reference is registered in components/role_modules/future_modules (must be reference-only)");
} catch (e) { F(`could not read repository-manifest.json: ${e.message}`); }

// ---- projection equality: renderer --check ----
try { execFileSync("node", [path.join(HERE, "render.mjs"), "--check"], { cwd: ROOT, stdio: "pipe" }); }
catch (e) { F(`renderer --check failed (README not byte-identical to records): ${(e.stderr || e.stdout || e.message).toString().slice(0, 200)}`); }

if (fail.length) { console.error("CHECK FAILED:\n- " + fail.join("\n- ")); process.exit(1); }
console.log(`check.mjs OK — ${records.length} records, taxonomy 5+1, all pinned refs resolve, all ADVISORY, manifest reference-only, README projection equal`);
