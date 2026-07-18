#!/usr/bin/env node
// check-workflow.mjs — fail-closed local oracle for the Iliad-quest workflow contract.
// Pure Node >=18 ESM, zero deps, read-only, no network. Does NOT modify or add to any
// shared enforcement infra (verify-contracts.mjs / comprehension-gate.mjs) — option (b).
//
// Verifies (resolving the round-2 objections):
//   1. the record's content-addressed id recomputes (sha256 of the canonical record minus id);
//   2. the stages match an EXPLICIT canonical stage table EXACTLY — stage name, order, owning
//      module PATH, linked-invariant id, and advisory marker per stage (a swapped invariant
//      link or a wrong module record fails);
//   3. every pinned file:@<sha> / git:<sha> reference resolves and is content-address-integral;
//   4. the two linked invariants exist in the pinned INVARIANTS blob;
//   5. the record is ADVISORY with a closed kind/status; and render-workflow.mjs --check passes.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { canonicalize, sha256hex } from "../../../../merkle-dag/vendor.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const HEX40 = /^[0-9a-f]{40}$/;
const fail = []; const F = (m) => fail.push(m);

const rec = JSON.parse(readFileSync(path.join(HERE, "workflow.json"), "utf8"));

// (5) closed kind/status + ADVISORY
if (rec.kind !== "contract") F(`kind must be 'contract' (got '${rec.kind}')`);
if (rec.status !== "NORMATIVE-CURRENT") F(`status must be 'NORMATIVE-CURRENT' (got '${rec.status}')`);
if (rec.normativity !== "ADVISORY") F(`normativity must be 'ADVISORY' (got '${rec.normativity}')`);

// (1) content-addressed id recompute
{ const { id, ...rest } = rec; const derived = "sha256:" + sha256hex(canonicalize(rest));
  if (id !== derived) F(`id mismatch: stored ${id} != recomputed ${derived} (record was mutated without re-deriving the id)`); }

// (2) EXPLICIT canonical stage table — identity = (order, stage, owner PATH, linked invariant, advisory)
const EXPECTED = [
  { order: 1, stage: "iliad-pre-review", owner: "docs/institutional-memory/iliad/IDENTITY.md", link_invariant: "iliad-pre-review-before-implementation", advisory: false },
  { order: 2, stage: "daedalus", owner: "docs/institutional-memory/daedalus/IDENTITY.md", link_invariant: null, advisory: false },
  { order: 3, stage: "telos", owner: "docs/institutional-memory/telos/IDENTITY.md", link_invariant: null, advisory: false },
  { order: 4, stage: "argo", owner: "docs/institutional-memory/argo/IDENTITY.md", link_invariant: null, advisory: false },
  { order: 5, stage: "reference-documentation-module", owner: "docs/institutional-memory/REFERENCES/agentic-orchestration/reference.json", link_invariant: null, advisory: true },
  { order: 6, stage: "clotho", owner: "clotho/memory/IDENTITY.md", link_invariant: null, advisory: false },
  { order: 7, stage: "iliad-retrospective", owner: "docs/institutional-memory/iliad/IDENTITY.md", link_invariant: "iliad-post-review-required", advisory: false }
];
const parseFileRef = (s) => { // "file:<path>@<40hex>[#frag]" -> {p, sha, frag}
  if (typeof s !== "string" || !s.startsWith("file:")) return null;
  const hashIdx = s.indexOf("#"); const frag = hashIdx >= 0 ? s.slice(hashIdx + 1) : null;
  const core = hashIdx >= 0 ? s.slice(0, hashIdx) : s;
  const at = core.lastIndexOf("@"); if (at < 6) return null;
  return { p: core.slice(5, at), sha: core.slice(at + 1), frag };
};
const stages = Array.isArray(rec.stages) ? rec.stages : [];
if (stages.length !== EXPECTED.length) F(`stage count ${stages.length} != canonical ${EXPECTED.length}`);
for (const exp of EXPECTED) {
  const s = stages.find((x) => x && x.order === exp.order);
  if (!s) { F(`stage order ${exp.order} (${exp.stage}) missing`); continue; }
  if (s.stage !== exp.stage) F(`stage ${exp.order}: name '${s.stage}' != canonical '${exp.stage}'`);
  const own = parseFileRef(s.owning_module);
  if (!own || own.p !== exp.owner) F(`stage ${exp.order} (${exp.stage}): owning_module path '${own ? own.p : s.owning_module}' != canonical '${exp.owner}'`);
  if (Boolean(s.advisory) !== exp.advisory) F(`stage ${exp.order} (${exp.stage}): advisory=${s.advisory} != canonical ${exp.advisory}`);
  if (exp.link_invariant === null) { if (s.authority_link !== null) F(`stage ${exp.order} (${exp.stage}): must have no authority_link`); }
  else { const lk = parseFileRef(s.authority_link); if (!lk || lk.frag !== exp.link_invariant) F(`stage ${exp.order} (${exp.stage}): authority_link invariant '${lk ? lk.frag : s.authority_link}' != canonical '${exp.link_invariant}'`); }
}

// (3) every pinned file:@<sha> / git:<sha> across the record resolves + is content-address-integral
const gitBlob = (p) => { try { return execFileSync("git", ["hash-object", p], { cwd: ROOT, encoding: "utf8" }).trim(); } catch { return null; } };
const allText = JSON.stringify(rec);
for (const m of allText.match(/file:[^"\s#]+@[0-9a-f]{40}|git:[0-9a-f]{40}/g) || []) {
  if (m.startsWith("git:")) { try { execFileSync("git", ["cat-file", "-e", m.slice(4)], { cwd: ROOT }); } catch { F(`git ref does not resolve: ${m}`); } }
  else { const at = m.lastIndexOf("@"); const p = m.slice(5, at), sha = m.slice(at + 1); if (gitBlob(p) !== sha) F(`file ref content-address mismatch: ${m}`); }
}

// (4) the two linked invariants actually exist in the pinned INVARIANTS blob
{ const invRef = parseFileRef(rec.evidence && rec.evidence[0]);
  if (!invRef) F("evidence[0] must pin the INVARIANTS.json blob");
  else { let inv; try { inv = readFileSync(path.join(ROOT, invRef.p), "utf8"); } catch { inv = ""; }
    for (const id of ["iliad-pre-review-before-implementation", "iliad-post-review-required"]) if (!inv.includes(id)) F(`linked invariant '${id}' not found in ${invRef.p}`); } }

// (5) render --check (named destination byte-identical)
try { execFileSync("node", [path.join(HERE, "render-workflow.mjs"), "--check"], { cwd: ROOT, stdio: "pipe" }); }
catch (e) { F(`render-workflow.mjs --check failed: ${(e.stderr || e.stdout || e.message).toString().slice(0, 200)}`); }

if (fail.length) { console.error("check-workflow FAILED:\n- " + fail.join("\n- ")); process.exit(1); }
console.log("check-workflow OK — id recomputes, canonical 7-stage table exact, all pins resolve, invariants present, ADVISORY, README projection equal");
