import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const VERIFY = fileURLToPath(new URL("../workstreams/design-verify.mjs", import.meta.url));

// Build a temp project root with a consistent plan + ledger + DESIGN.md + artifacts,
// then allow a mutator to perturb exactly one thing.
function makeRoot(mutate = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), "dverify-"));
  mkdirSync(path.join(root, ".telos"), { recursive: true });
  mkdirSync(path.join(root, "docs", "design"), { recursive: true });
  mkdirSync(path.join(root, "a"), { recursive: true });
  mkdirSync(path.join(root, "b"), { recursive: true });

  // two build nodes + the design node
  const nodes = [
    { id: "alpha", files: ["a/alpha.txt"], dependencies: [] },
    { id: "beta", files: ["b/beta.txt"], dependencies: ["alpha"] },
    { id: "design", files: ["docs/DESIGN.md", "docs/design/verify.mjs"], dependencies: ["alpha", "beta"] }
  ];
  writeFileSync(path.join(root, ".telos", "plan.json"), JSON.stringify({ nodes }));
  // ledger: only the build nodes (design settles after verify)
  const ledger = [
    { task_id: "alpha", signer: "codex" },
    { task_id: "beta", signer: "claude" }
  ].map((r) => JSON.stringify(r)).join("\n");
  writeFileSync(path.join(root, ".telos", "ledger.jsonl"), ledger);
  // artifacts on disk
  writeFileSync(path.join(root, "a/alpha.txt"), "alpha");
  writeFileSync(path.join(root, "b/beta.txt"), "beta");

  // the design's component block + 5 sections (consistent by default)
  let components = [
    { workstream: "alpha", model: "codex", artifact: "a/alpha.txt", depends_on: [] },
    { workstream: "beta", model: "claude", artifact: "b/beta.txt", depends_on: ["alpha"] }
  ];
  if (mutate.components) components = mutate.components(components);
  const sections = mutate.sections || {
    "Component boundaries": "alpha ingests; beta builds on alpha.",
    "Data flow": "alpha -> beta.",
    "Model/infra choices": "codex for alpha, claude for beta.",
    "Eval plan": "node tests gate each artifact.",
    "Risks": "none material at this scale."
  };
  let md = "# Design\n\n```json\n" + JSON.stringify(components, null, 2) + "\n```\n";
  for (const [h, body] of Object.entries(sections)) md += `\n## ${h}\n\n${body}\n`;
  writeFileSync(path.join(root, "docs", "DESIGN.md"), md);
  return root;
}

function runVerify(root) {
  try { execFileSync("node", [VERIFY], { cwd: root, stdio: "pipe" }); return 0; }
  catch (e) { return e.status ?? 1; }
}

// consistent => exit 0
assert.equal(runVerify(makeRoot()), 0, "consistent design must pass");

// (a) coverage: omit a component => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.filter((x) => x.workstream !== "beta") })), 0, "missing component must fail");
// (a) coverage: phantom component => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => [...c, { workstream: "ghost", model: "codex", artifact: "a/alpha.txt", depends_on: [] }] })), 0, "phantom component must fail");
// (b) data-flow: wrong edge => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.map((x) => x.workstream === "beta" ? { ...x, depends_on: [] } : x) })), 0, "wrong dep edge must fail");
// (c) realized: artifact not on disk (claim a path not in files) => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.map((x) => x.workstream === "alpha" ? { ...x, artifact: "a/missing.txt" } : x) })), 0, "unrealized artifact must fail");
// (d) model: wrong model vs ledger signer => fail
assert.notEqual(runVerify(makeRoot({ components: (c) => c.map((x) => x.workstream === "alpha" ? { ...x, model: "grok" } : x) })), 0, "wrong model must fail");
// (e) sections: empty section => fail
assert.notEqual(runVerify(makeRoot({ sections: { "Component boundaries": "", "Data flow": "x", "Model/infra choices": "x", "Eval plan": "x", "Risks": "x" } })), 0, "empty section must fail");

console.log("test-design-verify.mjs OK");
