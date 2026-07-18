// test-verify.mjs — discriminating oracle for Atropos. GOLDEN over the REAL CURRENT-AUTHORITY
// (the 4 plan-version retirements → consistent); per-defect negatives each flip the verdict.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAuthority, verify } from "../verify.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("FAIL:", m); } };
const throws = (fn, m) => { try { fn(); fail++; console.error("FAIL (expected throw):", m); } catch { pass++; } };

const real = loadAuthority(path.join(ROOT, "CURRENT-AUTHORITY.json"));
const clone = () => JSON.parse(JSON.stringify(real));

// ---- GOLDEN: the real authority verifies consistent ----
{
  const r = verify(real, ROOT);
  ok(r.verdict === "consistent", `golden: real authority consistent (got ${r.verdict}: ${r.problems.join("; ")})`);
  ok(r.plan_version_count === 4, `golden: 4 plan-version retirements (${r.plan_version_count})`);
  ok(r.active_plan_version === "v15", `golden: active_plan v15`);
  ok(JSON.stringify(r.advisory.retired_plan_versions) === JSON.stringify(["v11", "v12", "v13", "v14"]), "golden: retired v11-v14");
}

// ---- per-defect negatives (each → inconsistent) ----
const inconsistent = (mutate, label) => {
  const a = clone(); mutate(a);
  const r = verify(a, ROOT);
  ok(r.verdict === "inconsistent", `negative: ${label} -> inconsistent (got ${r.verdict})`);
};
inconsistent((a) => { a.superseded[0].must_not_govern_new_work = false; }, "must_not_govern_new_work !== true");
inconsistent((a) => { a.superseded[0].must_not_govern_new_work = "true"; }, "must_not_govern_new_work wrong type");
inconsistent((a) => { a.superseded[0].bogus = 1; }, "unexpected key");
inconsistent((a) => { delete a.superseded[0].authorization; }, "missing required key");
inconsistent((a) => { a.superseded[0].sha256 = "deadbeef"; }, "malformed sha256");
inconsistent((a) => { a.superseded[0].authz_status = "MAYBE"; }, "bad authz_status");
inconsistent((a) => { a.superseded[0].note = 42; }, "note wrong type (optional member, string when present)");
inconsistent((a) => { a.superseded[1].plan_version = "v11"; }, "duplicate plan_version");
inconsistent((a) => { a.superseded[0].superseded_by = "v11"; }, "self-supersession");
inconsistent((a) => { a.superseded[0].superseded_by = "v99"; }, "dangling superseded_by");
inconsistent((a) => { a.superseded[0].superseded_by = "v12"; a.superseded[1].superseded_by = "v11"; }, "supersession cycle");
inconsistent((a) => { a.superseded.push({ plan_version: "v15", sha256: a.active_plan.sha256, authorization: "authz-008", authz_status: "AUTHORIZED", superseded_by: "v15", must_not_govern_new_work: true }); }, "active_plan.version itself superseded");
inconsistent((a) => { a.active_plan.sha256 = "sha256:" + "0".repeat(64); }, "active_plan sha mismatch (terminal authority)");
inconsistent((a) => { a.superseded.push({ status: "SUPERSEDED", node_id: "a".repeat(64) }); }, "node-backed entry (UNREPRESENTABLE, deferred)");
inconsistent((a) => { a.superseded.push({ garbage: true }); }, "unknown malformed entry (UNSUPPORTED_RETIREMENT_KIND)");

// ---- file-level fail-closed ----
throws(() => verify({ active_plan: real.active_plan }, ROOT), "missing superseded array -> throw");
throws(() => loadAuthority(path.join(ROOT, "does-not-exist.json")), "unreadable authority -> throw");

console.log(`test-verify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
