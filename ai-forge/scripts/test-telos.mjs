import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { telosContext, signWorkstream, planWorkstream, provenanceWorkstream, gateWorkstream } from "../patterns/telos.mjs";

// Render a component's selftest to a temp file and run it; return exit code (0 = pass).
function runSelftest(ws) {
  const ctx = telosContext();
  const out = ws.render(ctx);
  const file = ws.files[0];               // e.g. "telos/sign.mjs"
  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-st-"));
  const abs = path.join(dir, path.basename(file));
  writeFileSync(abs, out[file]);
  try { execFileSync("node", [abs], { cwd: dir, stdio: "pipe" }); return 0; }
  catch (e) { return e.status ?? 1; }
}

// sign: the selftest genuinely executes build-gate/sign.mjs via the spineRoot file:// import
assert.equal(runSelftest(signWorkstream), 0, "sign selftest must execute the real spine and pass");

assert.equal(runSelftest(planWorkstream), 0, "plan selftest executes");
assert.equal(runSelftest(provenanceWorkstream), 0, "provenance selftest executes");
assert.equal(runSelftest(gateWorkstream), 0, "gate selftest executes");

console.log("test-telos.mjs OK");
