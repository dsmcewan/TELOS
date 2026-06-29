import assert from "node:assert/strict";
import { makeDesignWorkstream } from "../workstreams/design.mjs";
import { validatePattern } from "../pattern.mjs";

const build = [
  { id: "alpha", signer: "codex", lens: "codex", dependencies: [], files: ["a/alpha.txt"], requirements: "r", render: () => ({}), checks: () => [], findingsKey: "k", finding: "f" },
  { id: "beta", signer: "claude", lens: "claude", dependencies: ["alpha"], files: ["b/beta.txt"], requirements: "r", render: () => ({}), checks: () => [], findingsKey: "k", finding: "f" }
];
const ws = makeDesignWorkstream(build);

// shape: a valid pattern workstream, design id, claude author, depends on all build ids
assert.equal(ws.id, "design");
assert.equal(ws.signer, "claude");
assert.deepEqual([...ws.dependencies].sort(), ["alpha", "beta"]);
assert.deepEqual(ws.files, ["docs/DESIGN.md", "docs/design/verify.mjs"]);
assert.ok(typeof ws.findingsKey === "string" && typeof ws.finding === "string");
assert.deepEqual(ws.nodeTest, { cmd: "node", args: ["docs/design/verify.mjs"] });
assert.equal(validatePattern({ id: "p", workstreams: [...build, ws] }).ok, true);

// render: DESIGN.md has a component block matching the build workstreams + mermaid + 5 sections; verify.mjs written
const out = ws.render({});
assert.ok(out["docs/DESIGN.md"], "writes DESIGN.md");
assert.ok(out["docs/design/verify.mjs"] && out["docs/design/verify.mjs"].includes("DESIGN_DRIFT"), "writes the real verify.mjs");
const md = out["docs/DESIGN.md"];
const block = JSON.parse(md.match(/```json\s*([\s\S]*?)```/)[1]);
assert.deepEqual(block.map((c) => c.workstream).sort(), ["alpha", "beta"]);
assert.equal(block.find((c) => c.workstream === "beta").model, "claude");
assert.deepEqual(block.find((c) => c.workstream === "beta").depends_on, ["alpha"]);
assert.equal(block.find((c) => c.workstream === "alpha").artifact, "a/alpha.txt");
assert.ok(md.includes("```mermaid"), "includes a mermaid diagram");
for (const h of ["Component boundaries", "Data flow", "Model/infra choices", "Eval plan", "Risks"]) assert.ok(new RegExp("#+\\s*" + h).test(md), "section " + h);

// surface checks include existence + the 5 section headers
const checks = ws.checks({});
assert.ok(checks.some((c) => c.type === "file_exists" && c.path === "docs/DESIGN.md"));
assert.ok(checks.some((c) => c.type === "file_exists" && c.path === "docs/design/verify.mjs"));
assert.equal(checks.filter((c) => c.type === "file_contains").length, 5);

console.log("test-design.mjs OK");
