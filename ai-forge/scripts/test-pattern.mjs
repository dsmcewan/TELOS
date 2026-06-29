import assert from "node:assert/strict";
import { validatePattern, patternTaskDefs, signerForTask, workstreamById, nodeTestFor } from "../pattern.mjs";

const ctx = { telos: "t" };
const ws = (over = {}) => ({
  id: "a", signer: "codex", lens: "codex", dependencies: [],
  files: ["a.txt"], requirements: "make a", render: () => ({ "a.txt": "x" }),
  checks: () => [{ type: "file_exists", path: "a.txt" }],
  findingsKey: "k", finding: "f", ...over
});

// valid pattern passes
{
  const r = validatePattern({ id: "p", workstreams: [ws()] });
  assert.equal(r.ok, true, JSON.stringify(r));
}
// missing fields fail closed (no throw)
{
  const r = validatePattern({ id: "", workstreams: [] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.length >= 1);
}
// duplicate workstream ids rejected
{
  const r = validatePattern({ id: "p", workstreams: [ws(), ws()] });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /duplicate/i.test(e)));
}
// task defs match computePlan's expected shape
{
  const p = { id: "p", workstreams: [ws({ dependencies: [] })] };
  const defs = patternTaskDefs(p, ctx);
  assert.equal(defs.length, 1);
  assert.deepEqual(defs[0].files, ["a.txt"]);
  assert.equal(defs[0].test.cmd, "node");
  assert.ok(defs[0].test.args[0].endsWith("check-node.mjs"));
  assert.equal(JSON.parse(defs[0].test.args[1])[0].type, "file_exists");
}
// signer + lookup
{
  const p = { id: "p", workstreams: [ws({ id: "b", signer: "grok" })] };
  assert.equal(signerForTask(p)("b"), "grok");
  assert.equal(signerForTask(p)("missing"), "claude");
  assert.equal(workstreamById(p, "b").signer, "grok");
}
// nodeTest override respected
{
  const w = ws({ nodeTest: { cmd: "node", args: ["-e", "process.exit(0)"] } });
  assert.deepEqual(nodeTestFor(w, ctx), { cmd: "node", args: ["-e", "process.exit(0)"] });
}
console.log("test-pattern.mjs OK");
