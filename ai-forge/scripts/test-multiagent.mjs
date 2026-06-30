import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { multiagentBuildWorkstreams } from "../patterns/multiagent.mjs";

// Render ALL build workstreams into ONE tmpdir so sibling imports resolve.
// (router.mjs imports ./roles.mjs; blackboard.mjs imports ./protocol.mjs)
const dir = mkdtempSync(path.join(os.tmpdir(), "multiagent-st-"));
for (const ws of multiagentBuildWorkstreams) {
  const out = ws.render();
  for (const [file, src] of Object.entries(out)) {
    const abs = path.join(dir, file);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, src);
  }
}

// Run each --selftest; all must exit 0.
for (const ws of multiagentBuildWorkstreams) {
  const abs = path.join(dir, ws.files[0]);
  try {
    const out = execFileSync("node", [abs, "--selftest"], { stdio: "pipe" });
    console.log(out.toString().trim());
  } catch (e) {
    const msg = (e.stderr || e.stdout || Buffer.alloc(0)).toString();
    console.error("FAIL " + ws.id + ":", msg || e.message);
    process.exit(1);
  }
}

console.log("test-multiagent.mjs OK");
