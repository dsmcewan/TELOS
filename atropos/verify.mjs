// verify.mjs — Atropos's READ-ONLY supersession verifier. It realizes the VERIFICATION of the
// registered "retires" meaning: it checks that recorded retirements are consistent; it NEVER
// mutates CURRENT-AUTHORITY or authors retirements (that stays a human CHANGE-PROTOCOL step —
// see memory/NON-CLAIMS.md). Never imports clotho/; sole sanctioned cross-package import is
// merkle-dag/vendor.mjs (canonicalize/sha256hex) for the disk-resolved terminal-authority check.
//
// Reality (verified): supersession's only populated surface is CURRENT-AUTHORITY.json#superseded —
// plan-version retirements. Node-backed retirement (SUPERSEDED records / weave `supersedes` edges)
// is UNREPRESENTABLE in the current schema and DEFERRED (NON-CLAIM). The NORMATIVE verdict is over
// plan-version consistency; the report is advisory input to TELOS/The Eye.

import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { canonicalize, sha256hex } from "../merkle-dag/vendor.mjs"; // sanctioned reuse

const DIGEST = /^sha256:[0-9a-f]{64}$/;
const AUTHZ = /^authz-[0-9]+$/;
const AUTHZ_STATUS = new Set(["AUTHORIZED", "NOT_AUTHORIZED"]);
// closed shape of a #superseded plan-version entry (required + the one optional Clotho uses)
const REQUIRED = ["plan_version", "sha256", "authorization", "authz_status", "superseded_by", "must_not_govern_new_work"];
const OPTIONAL = ["note"];

const isStr = (v) => typeof v === "string" && v.length > 0;

// A plan-version entry has the closed #superseded shape; anything else routes to node-backed/unknown.
function classify(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "unknown";
  if ("record_status" in entry || entry.status === "SUPERSEDED" || "edge_kind" in entry) return "node-backed";
  if ("plan_version" in entry || "superseded_by" in entry) return "plan-version";
  return "unknown";
}

function shapeOk(e, problems, i) {
  const keys = Object.keys(e);
  for (const k of REQUIRED) if (!(k in e)) problems.push(`entry ${i}: missing key '${k}'`);
  for (const k of keys) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) problems.push(`entry ${i}: unexpected key '${k}'`);
  if (!isStr(e.plan_version)) problems.push(`entry ${i}: plan_version not a non-empty string`);
  if (!DIGEST.test(e.sha256 || "")) problems.push(`entry ${i}: sha256 not sha256:<64hex>`);
  if (!AUTHZ.test(e.authorization || "")) problems.push(`entry ${i}: authorization not authz-N`);
  if (!AUTHZ_STATUS.has(e.authz_status)) problems.push(`entry ${i}: authz_status not AUTHORIZED|NOT_AUTHORIZED`);
  if (!isStr(e.superseded_by)) problems.push(`entry ${i}: superseded_by not a non-empty string`);
  if (e.must_not_govern_new_work !== true) problems.push(`entry ${i}: must_not_govern_new_work must be === true`);
  if ("note" in e && typeof e.note !== "string") problems.push(`entry ${i}: note must be a string`);
}

// Disk-resolve the active_plan's content-address (terminal authority). Fail-closed on path escape.
function terminalAuthorityOk(authority, rootDir, problems) {
  const ap = authority.active_plan;
  if (!ap || !isStr(ap.version) || !DIGEST.test(ap.sha256 || "") || !isStr(ap.path)) {
    problems.push("active_plan missing version/sha256/path"); return;
  }
  const realRoot = realpathSync(rootDir);
  let planPath;
  try { planPath = realpathSync(path.resolve(realRoot, ap.path)); }
  catch { problems.push(`active_plan.path not found: ${ap.path}`); return; }
  if (planPath !== realRoot && !planPath.startsWith(realRoot + path.sep)) { problems.push("active_plan.path escapes root"); return; }
  const text = readFileSync(planPath, "utf8");
  const got = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: text }));
  if (got !== ap.sha256) problems.push(`active_plan sha mismatch: disk ${got} != pinned ${ap.sha256}`);
}

// Load CURRENT-AUTHORITY as data (fail-closed on file/parse anomalies).
export function loadAuthority(authorityPath) {
  let raw;
  try { raw = readFileSync(authorityPath, "utf8"); } catch { throw new Error(`Atropos: cannot read ${authorityPath}`); }
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new Error("Atropos: CURRENT-AUTHORITY not parseable JSON"); }
  if (!obj || typeof obj !== "object") throw new Error("Atropos: CURRENT-AUTHORITY not an object");
  return obj;
}

// The read-only verifier. rootDir anchors the active_plan disk-resolution. Returns a structured
// verdict; NEVER writes. verdict: "consistent" | "inconsistent" (+ deferred kinds surfaced explicitly).
export function verify(authority, rootDir) {
  const problems = [];
  const superseded = authority.superseded;
  if (!Array.isArray(superseded)) throw new Error("Atropos: CURRENT-AUTHORITY.superseded must be an array");

  const kinds = { "plan-version": 0, "node-backed": 0, unknown: 0 };
  const planEntries = [];
  superseded.forEach((e, i) => {
    const kind = classify(e);
    kinds[kind]++;
    if (kind === "plan-version") { shapeOk(e, problems, i); planEntries.push(e); }
    else if (kind === "node-backed") problems.push(`entry ${i}: node-backed retirement is UNREPRESENTABLE_CURRENT_AUTHORITY_REFLECTION (deferred cycle-1)`);
    else problems.push(`entry ${i}: UNSUPPORTED_RETIREMENT_KIND (malformed #superseded entry)`);
  });

  // uniqueness of plan_version
  const versions = new Set();
  for (const e of planEntries) {
    if (versions.has(e.plan_version)) problems.push(`duplicate plan_version '${e.plan_version}'`);
    versions.add(e.plan_version);
  }
  const activeVersion = authority.active_plan?.version;
  if (versions.has(activeVersion)) problems.push(`active_plan.version '${activeVersion}' is itself in #superseded`);

  // superseded_by resolution: terminates at active_plan.version, no self / dangling / cycle
  const bySuccessor = new Map(planEntries.map((e) => [e.plan_version, e.superseded_by]));
  for (const e of planEntries) {
    if (e.superseded_by === e.plan_version) { problems.push(`self-supersession '${e.plan_version}'`); continue; }
    const seen = new Set();
    let cur = e.plan_version;
    while (true) {
      const next = bySuccessor.get(cur);
      if (next === undefined) { problems.push(`'${cur}' superseded_by does not resolve within #superseded/active_plan`); break; }
      if (next === activeVersion) break;          // terminates at the current authority — good
      if (seen.has(next)) { problems.push(`supersession cycle at '${next}'`); break; }
      seen.add(next);
      if (!bySuccessor.has(next)) { problems.push(`dangling superseded_by '${next}' (not a superseded version or active_plan)`); break; }
      cur = next;
    }
  }

  terminalAuthorityOk(authority, rootDir, problems);

  return {
    verdict: problems.length === 0 ? "consistent" : "inconsistent",
    kinds,
    plan_version_count: planEntries.length,
    active_plan_version: activeVersion,
    problems,
    // ADVISORY report (input to TELOS/The Eye; never enforced by Atropos):
    advisory: {
      retired_plan_versions: planEntries.map((e) => e.plan_version),
      deferred: kinds["node-backed"] > 0 ? "node-backed retirements present but UNREPRESENTABLE in cycle-1" : "none",
      note: "read-only verification; retirement itself is a human CHANGE-PROTOCOL action, not performed by Atropos"
    }
  };
}
