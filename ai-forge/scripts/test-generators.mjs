import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { generatorDispatch, makePatternGenerators } from "../generators.mjs";

const CHECK_NODE = fileURLToPath(new URL("../checks/check-node.mjs", import.meta.url));
const dir = mkdtempSync(path.join(os.tmpdir(), "aiforge-gen-"));

// generator writes the workstream's files; dispatch returns the signer
{
  const pattern = { id: "p", workstreams: [{
    id: "w1", signer: "codex", lens: "codex", files: ["sub/a.txt"],
    requirements: "r", render: () => ({ "sub/a.txt": "hello #facts" }),
    checks: () => [{ type: "file_contains", path: "sub/a.txt", needle: "#facts" }],
    findingsKey: "k", finding: "f"
  }] };
  const dispatch = generatorDispatch({
    baseDir: dir,
    generateFiles: makePatternGenerators(pattern, { telos: "t" }),
    signerForTask: (id) => (id === "w1" ? "codex" : "claude")
  });
  const out = await dispatch({ id: "w1", files: ["sub/a.txt"], requirements: "r", test: {}, effective_hash: "x" });
  assert.equal(out.ok, true);
  assert.equal(out.signer, "codex");
  assert.ok(existsSync(path.join(dir, "sub/a.txt")));
  assert.match(readFileSync(path.join(dir, "sub/a.txt"), "utf8"), /#facts/);
}

// check-node CLI: passes when checks hold, non-zero when they don't
{
  const ok = [{ type: "file_contains", path: "sub/a.txt", needle: "#facts" }];
  execFileSync("node", [CHECK_NODE, JSON.stringify(ok)], { cwd: dir }); // throws on non-zero
  let failed = false;
  try { execFileSync("node", [CHECK_NODE, JSON.stringify([{ type: "file_contains", path: "sub/a.txt", needle: "ABSENT" }])], { cwd: dir, stdio: "ignore" }); }
  catch { failed = true; }
  assert.equal(failed, true, "check-node must exit non-zero on a failing check");
}
console.log("test-generators.mjs OK");
