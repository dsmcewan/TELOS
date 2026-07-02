// test-runner.mjs — a build-gate-local node-test runner that CAPTURES stdout/stderr.
//
// The merkle-dag substrate's runTest (orchestrate.mjs) deliberately captures only
// the exit status — it is the minimal, independent Rule-3 check. Runtime
// adaptation, though, needs the actual failure text to hand back to a team so it
// can self-correct. This runner mirrors defaultVerifyNode's cwd-escape guard but
// returns the captured output. It is advisory pre-flight for the team; it is NOT a
// substitute for Rule-3 verify (the controller still re-runs the test before
// signing), so a team can never self-certify by passing this.

import { spawn } from "node:child_process";
import { resolveUnder, spawnCommand } from "../merkle-dag/vendor.mjs";

const DEFAULT_TIMEOUT_MS = 60000;
const TAIL = 800; // keep a bounded failure tail so it can flow into a respec/effective_hash

function tail(s) {
  const str = typeof s === "string" ? s : "";
  return str.length > TAIL ? str.slice(-TAIL) : str;
}

/**
 * Run node.test in a cwd confined under baseDir, capturing stdio. Mirrors
 * defaultVerifyNode's guards (no cmd -> fail; cwd escape -> fail; timeout).
 * Never throws — returns a fact object.
 *   -> Promise<{ ok, status, stdout, stderr, detail, timedOut? }>
 */
export function runNodeTest(node, baseDir, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const id = node?.id ?? "node";
  const t = node?.test || {};
  if (!t.cmd) return Promise.resolve({ ok: false, status: null, stdout: "", stderr: "", detail: `${id}: no test command` });
  const cwd = resolveUnder(baseDir, t.cwd || ".");
  if (cwd === null) return Promise.resolve({ ok: false, status: null, stdout: "", stderr: "", detail: `${id}: test cwd escapes baseDir` });

  return new Promise((resolve) => {
    let done = false;
    let out = "";
    let err = "";
    let child;
    try {
      const spec = spawnCommand(t.cmd, t.args || []);
      child = spawn(spec.command, spec.args, { cwd });
    } catch (e) {
      return resolve({ ok: false, status: null, stdout: "", stderr: "", detail: `${id}: spawn failed: ${e?.message || String(e)}` });
    }
    const finish = (res) => { if (!done) { done = true; clearTimeout(timer); resolve(res); } };
    const timer = setTimeout(() => {
      try { child.kill("SIGTERM"); } catch {}
      finish({ ok: false, status: null, stdout: tail(out), stderr: tail(err), detail: `${id}: test timed out`, timedOut: true });
    }, timeoutMs);

    child.stdout?.on("data", (d) => { out += d.toString(); });
    child.stderr?.on("data", (d) => { err += d.toString(); });
    child.on("error", (e) => finish({ ok: false, status: null, stdout: tail(out), stderr: tail(err), detail: `${id}: test error: ${e?.message || String(e)}` }));
    child.on("close", (code) => {
      const ok = code === 0;
      const summary = `${id}: test exit ${code}`;
      const detail = ok ? summary : `${summary}${err || out ? " — " + tail(err || out) : ""}`;
      finish({ ok, status: code, stdout: tail(out), stderr: tail(err), detail });
    });
  });
}
