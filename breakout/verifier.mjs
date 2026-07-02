// verifier.mjs — deterministic grounding for the breakout.
//
// The council breakout is a prose debate: the challenger and reviewer only see
// the text of a claim, so a maximally-skeptical reviewer can always demand proof
// that doesn't fit in a sentence, and the loop never converges. The verifier
// fixes that: it runs real checks (file existence, a subprocess exit code, a
// file's contents) and decides `meets` on the FACTS. No rhetoric can move a
// passing check, and no claim reaches `meets` while any check fails.
//
// A check is { id, description, run: () => {ok, detail} | Promise<...> }.

import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

export async function verifyChecks(checks) {
  const facts = [];
  for (const check of checks || []) {
    let ok = false;
    let detail = "";
    try {
      const result = (await check.run()) || {};
      ok = result.ok === true;
      detail = typeof result.detail === "string" ? result.detail : "";
    } catch (error) {
      ok = false;
      detail = `check threw: ${error?.message || String(error)}`;
    }
    facts.push({ id: check.id, description: check.description || check.id, ok, detail });
  }
  const failing = facts.filter((f) => !f.ok);
  return { facts, allPass: failing.length === 0, failing };
}

/**
 * Run a breakout whose verdict is decided by deterministic checks. Returns a
 * gate-compatible breakout record (converged / finalStatus / surviving_blockers
 * / rounds) plus verified_facts — the actual check results, which ARE the
 * produced evidence a prose reviewer kept demanding.
 */
export async function runVerifiedBreakout(input, checks) {
  const goalStatus = input.goalStatus || "meets";
  const checkList = Array.isArray(checks) ? checks : [];
  const { facts, allPass: ranPass, failing } = await verifyChecks(checkList);
  // An empty set of checks is not evidence — `meets` requires at least one
  // passing check, not merely "nothing failed".
  const allPass = ranPass && checkList.length > 0;
  const surviving_blockers = checkList.length === 0
    ? ["no checks provided — 'meets' cannot be verified"]
    : failing.map((f) => f.description);

  return {
    workstream: input.workstream,
    claimedStatus: input.claimedStatus,
    finalStatus: allPass ? goalStatus : "needs-work",
    converged: allPass,
    verified_facts: facts,
    // Declarative specs so the gate can re-verify this record independently.
    checks: (checks || []).map((c) => c.spec).filter(Boolean),
    surviving_blockers,
    go_to_market_blockers: surviving_blockers,
    rounds: [{ round: 1, checks: facts.map((f) => ({ id: f.id, ok: f.ok, detail: f.detail })) }]
  };
}

// ---- declarative re-verification (used by the build gate) ------------------
//
// A breakout record carries declarative check SPECS (JSON, no functions) so a
// third party — the gate — can REBUILD and RE-RUN the checks itself instead of
// trusting a self-reported `converged` boolean. Only read-only checks are
// re-runnable from a spec; command specs are recorded but NEVER executed by the
// gate (executing packet-declared commands would be a worse hole than the one
// this closes). All paths are resolved under and confined to `baseDir`.

function resolveUnder(baseDir, p) {
  if (typeof p !== "string" || !p) return null;
  const resolved = path.resolve(baseDir, p);
  const rel = path.relative(baseDir, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null; // escapes baseDir
  return resolved;
}

export function safeCheckFromSpec(spec, baseDir) {
  if (!spec || typeof spec !== "object") return { skip: true };
  if (spec.type !== "file_exists" && spec.type !== "file_contains") return { skip: true };
  const id = spec.id || `${spec.type}:${spec.path}`;
  const resolved = resolveUnder(baseDir, spec.path);
  if (resolved === null) {
    return { id, description: `unsafe/escaping path: ${spec.path}`, run: () => ({ ok: false, detail: `path '${spec.path}' is outside the allowed base dir` }) };
  }
  if (spec.type === "file_exists") return fileExistsCheck(id, resolved);
  return fileContainsCheck(id, resolved, spec.needle);
}

/**
 * Build a runnable check from a declarative spec — the FULL set including
 * `command`. For LIVE verifier runs (live.mjs), where executing a command is the
 * caller's intent. The gate uses the restricted `safeCheckFromSpec` instead.
 * Paths are resolved against baseDir when one is given.
 */
export function buildCheck(spec, baseDir) {
  if (!spec || typeof spec !== "object") {
    return { id: "invalid", description: "invalid check spec", run: () => ({ ok: false, detail: "invalid check spec" }) };
  }
  const resolve = (p) => (baseDir && typeof p === "string" ? path.resolve(baseDir, p) : p);
  const id = spec.id || `${spec.type}:${spec.path || spec.command || "check"}`;
  if (spec.type === "file_exists") return fileExistsCheck(id, resolve(spec.path));
  if (spec.type === "file_contains") return fileContainsCheck(id, resolve(spec.path), spec.needle);
  if (spec.type === "command") {
    return commandCheck(id, spec.description || id, spec.command, spec.args || [], { cwd: resolve(spec.cwd), expectExit: spec.expectExit ?? 0 });
  }
  return { id, description: `unknown check type: ${spec.type}`, run: () => ({ ok: false, detail: `unknown check type '${spec.type}'` }) };
}

/**
 * Rebuild and run a breakout record's declarative `checks` against the real
 * filesystem, confined to baseDir. Returns the actual results — the gate decides
 * `meets` from `allPass` + `reverifiable`, NOT from the record's self-report.
 */
export function reverifyRecord(record, baseDir) {
  const specs = Array.isArray(record?.checks) ? record.checks : [];
  const facts = [];
  let reverifiable = 0;
  let skipped = 0;
  let hasFileContains = false;
  const emptyEvidenceFiles = [];
  for (const spec of specs) {
    const check = safeCheckFromSpec(spec, baseDir);
    if (!check || check.skip) { skipped++; continue; }
    reverifiable++;
    const realNeedle = typeof spec.needle === "string" && spec.needle.trim().length > 0;
    if (spec.type === "file_contains" && realNeedle) hasFileContains = true;
    let ok = false;
    let detail = "";
    try {
      const result = check.run() || {};
      ok = result.ok === true;
      detail = typeof result.detail === "string" ? result.detail : "";
    } catch (error) {
      ok = false;
      detail = `check threw: ${error?.message || String(error)}`;
    }
    if (spec.type === "file_exists" && ok) {
      const resolved = resolveUnder(baseDir, spec.path);
      try {
        if (resolved && statSync(resolved).size === 0) emptyEvidenceFiles.push(spec.path);
      } catch {
        // stat failure is not "empty"; leave it to the ok/detail above
      }
    }
    if (spec.type === "file_contains" && ok) {
      const resolved = resolveUnder(baseDir, spec.path);
      try {
        if (resolved && statSync(resolved).size === 0) emptyEvidenceFiles.push(spec.path);
      } catch {
        // stat failure is not "empty"; leave it to the ok/detail above
      }
    }
    facts.push({ id: check.id, description: check.description, ok, detail });
  }
  const failing = facts.filter((f) => !f.ok);
  return { facts, failing, allPass: failing.length === 0, reverifiable, skipped, hasFileContains, emptyEvidenceFiles };
}

// ---- check builders --------------------------------------------------------
// Each builder carries a declarative `spec` so a verifier run can emit a
// gate-re-verifiable record (record.checks = checks.map(c => c.spec)).

export function fileExistsCheck(id, path) {
  return {
    id,
    description: `file exists: ${path}`,
    spec: { type: "file_exists", path, id },
    run: () => {
      const ok = existsSync(path);
      return { ok, detail: ok ? `found ${path}` : `missing ${path}` };
    }
  };
}

export function fileContainsCheck(id, path, needle) {
  // A missing / empty / whitespace-only needle is not evidence: includes("") is
  // always true and includes(undefined) matches the literal "undefined". Such a
  // check must FAIL so a vacuous file_contains can never satisfy re-verification
  // in any mode. Same predicate as reverifyRecord's realNeedle / the signed-mode
  // sufficiency floor, so "a real needle" has one definition.
  const validNeedle = typeof needle === "string" && needle.trim().length > 0;
  return {
    id,
    description: `${path} contains "${needle}"`,
    spec: { type: "file_contains", path, needle, id },
    run: () => {
      if (!validNeedle) return { ok: false, detail: `file_contains needs a non-empty needle (got ${JSON.stringify(needle)})` };
      if (!existsSync(path)) return { ok: false, detail: `missing ${path}` };
      const ok = readFileSync(path, "utf8").includes(needle);
      return { ok, detail: ok ? `found "${needle}"` : `"${needle}" not in ${path}` };
    }
  };
}

export function commandCheck(id, description, command, args, { cwd, expectExit = 0 } = {}) {
  return {
    id,
    description,
    // Recorded for provenance but NOT gate-re-verifiable: the gate never runs
    // packet-declared commands.
    spec: { type: "command", id, description, command, args, cwd, expectExit },
    run: () => {
      const result = spawnSync(command, args, { cwd, encoding: "utf8" });
      if (result.error) return { ok: false, detail: `spawn error: ${result.error.message}` };
      const ok = result.status === expectExit;
      const lastLine = (result.stdout || "").trim().split(/\r?\n/).pop() || "";
      return { ok, detail: `exit=${result.status} ${lastLine}`.trim() };
    }
  };
}
