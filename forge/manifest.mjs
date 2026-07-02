// manifest.mjs — product specs as data: the TELOS-as-a-service onramp.
//
// A manifest declares everything a convergence run needs — the dossier and the
// workstreams (files, contracts, checks, seats) — so a new idea is one JSON
// file plus a driver invocation, not a hand-authored runner. Validation is
// FAIL-CLOSED: unknown fields, missing required fields, or unknown check types
// reject the manifest rather than being silently ignored (a typo'd field name
// must never quietly weaken a contract).
//
// Hash-stability contract: defsFromManifest must be deterministic — identical
// manifest, identical task defs, identical plan hashes. Migrating an existing
// run to a manifest EMITTED from its current defs therefore invalidates
// nothing (verified by the zero-seat-call replay).

const MANIFEST_FIELDS = new Set([
  "build_id", "idea_id", "use_case", "telos", "objective",
  "business_thesis", "target_users", "trust_mode", "workstreams"
]);
const WORKSTREAM_FIELDS = new Set([
  "id", "signer", "lens", "dependencies", "files", "requirements",
  "checks", "test", "isUi", "findingsKey", "finding", "claims"
]);
const CLAIM_FIELDS = new Set(["statement", "grade"]);
const CHECK_FIELDS = new Set(["type", "path", "needle", "grade"]);
const CHECK_TYPES = new Set(["file_exists", "file_contains"]);
const GRADES = new Set(["executable", "inspectable", "cited", "hypothesis"]);

function fail(errors) {
  const e = new Error(`manifest invalid:\n${errors.map((x) => `  - ${x}`).join("\n")}`);
  e.errors = errors;
  throw e;
}

/** Validate a manifest object. Throws (fail-closed) with every error listed. */
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== "object" || Array.isArray(m)) fail(["manifest must be an object"]);
  for (const k of Object.keys(m)) if (!MANIFEST_FIELDS.has(k)) errors.push(`unknown manifest field "${k}"`);
  for (const k of ["build_id", "telos", "objective"]) {
    if (typeof m[k] !== "string" || !m[k].trim()) errors.push(`"${k}" must be a non-empty string`);
  }
  if (!Array.isArray(m.workstreams) || m.workstreams.length === 0) {
    errors.push(`"workstreams" must be a non-empty array`);
    fail(errors);
  }
  const ids = new Set();
  for (const ws of m.workstreams) {
    const tag = `workstream "${ws?.id ?? "?"}"`;
    if (!ws || typeof ws !== "object") { errors.push(`${tag}: must be an object`); continue; }
    for (const k of Object.keys(ws)) if (!WORKSTREAM_FIELDS.has(k)) errors.push(`${tag}: unknown field "${k}"`);
    for (const k of ["id", "signer", "lens", "requirements"]) {
      if (typeof ws[k] !== "string" || !ws[k].trim()) errors.push(`${tag}: "${k}" must be a non-empty string`);
    }
    if (ids.has(ws.id)) errors.push(`duplicate workstream id "${ws.id}"`);
    ids.add(ws.id);
    if (!Array.isArray(ws.files) || ws.files.length === 0) errors.push(`${tag}: "files" must be a non-empty array`);
    if (!Array.isArray(ws.dependencies)) errors.push(`${tag}: "dependencies" must be an array`);
    for (const dep of ws.dependencies || []) {
      if (!m.workstreams.some((w) => w?.id === dep)) errors.push(`${tag}: dependency "${dep}" is not a workstream id`);
    }
    if (!Array.isArray(ws.checks)) errors.push(`${tag}: "checks" must be an array`);
    for (const c of ws.checks || []) {
      for (const k of Object.keys(c)) if (!CHECK_FIELDS.has(k)) errors.push(`${tag}: unknown check field "${k}"`);
      if (!CHECK_TYPES.has(c.type)) errors.push(`${tag}: unknown check type "${c.type}"`);
      if (typeof c.path !== "string" || !c.path) errors.push(`${tag}: check missing "path"`);
      if (c.type === "file_contains" && (typeof c.needle !== "string" || !c.needle)) errors.push(`${tag}: file_contains check missing "needle"`);
      if (c.grade !== undefined && !GRADES.has(c.grade)) errors.push(`${tag}: unknown grade "${c.grade}"`);
    }
    if (ws.test !== undefined) {
      if (!ws.test || typeof ws.test.cmd !== "string" || !Array.isArray(ws.test.args)) {
        errors.push(`${tag}: "test" must be {cmd, args[]}`);
      }
    }
    if (ws.claims !== undefined) {
      if (!Array.isArray(ws.claims)) errors.push(`${tag}: "claims" must be an array`);
      for (const c of ws.claims || []) {
        for (const k of Object.keys(c)) if (!CLAIM_FIELDS.has(k)) errors.push(`${tag}: unknown claim field "${k}"`);
        if (typeof c.statement !== "string" || !c.statement.trim()) errors.push(`${tag}: claim missing "statement"`);
        if (!GRADES.has(c.grade)) errors.push(`${tag}: claim grade "${c.grade}" is not one of ${[...GRADES].join("|")}`);
      }
    }
  }
  if (errors.length) fail(errors);
  return m;
}

/**
 * Workstreams with checks attached (the bout stage's input shape).
 * Checks are passed through verbatim — grade fields ride along for the
 * claim-typing layer without affecting hashes for ungraded manifests.
 */
export function workstreamsFromManifest(m) {
  return m.workstreams.map((ws) => ({ ...ws, checks: ws.checks.map((c) => ({ ...c })) }));
}

/**
 * Deterministic task defs for computePlan. A workstream's node test is its
 * explicit {cmd,args} test, else the generic check-runner over its checks
 * (checkNodePath — the caller supplies the absolute check-node.mjs path).
 * Grade fields are STRIPPED from the test specs so grading (advisory
 * metadata) never re-hashes an existing plan.
 */
export function defsFromManifest(m, { checkNodePath }) {
  if (!checkNodePath) throw new Error("defsFromManifest: checkNodePath is required");
  return m.workstreams.map((ws) => ({
    id: ws.id,
    files: [...ws.files],
    requirements: ws.requirements,
    test: ws.test
      ? { cmd: ws.test.cmd, args: [...ws.test.args] }
      : { cmd: "node", args: [checkNodePath, JSON.stringify(ws.checks.map(({ grade, ...c }) => c))] },
    dependencies: [...ws.dependencies]
  }));
}

/** Dossier metadata (gate input) from the manifest. */
export function dossierFromManifest(m) {
  const d = {
    build_id: m.build_id,
    idea_id: m.idea_id || m.build_id,
    use_case: m.use_case || "forge-run",
    objective: m.objective,
    required_market_workstreams: m.workstreams.map((w) => w.id)
  };
  if (m.business_thesis) d.business_thesis = m.business_thesis;
  if (Array.isArray(m.target_users)) d.target_users = m.target_users;
  return d;
}
