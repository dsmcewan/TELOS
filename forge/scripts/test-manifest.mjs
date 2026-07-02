#!/usr/bin/env node

// Manifest tests: fail-closed validation (unknown fields, bad checks, dangling
// deps, duplicates), deterministic def derivation, grade fields riding along
// without touching test specs, dossier extraction.

import assert from "node:assert/strict";
import { validateManifest, workstreamsFromManifest, defsFromManifest, dossierFromManifest } from "../manifest.mjs";

const GOOD = {
  build_id: "demo",
  telos: "Ship it.",
  objective: "Certify the thing.",
  business_thesis: "Thesis.",
  target_users: ["people"],
  workstreams: [
    {
      id: "a", signer: "codex", lens: "codex", dependencies: [],
      files: ["docs/A.md"], requirements: "REQ-A",
      checks: [
        { type: "file_exists", path: "docs/A.md" },
        { type: "file_contains", path: "docs/A.md", needle: "alpha", grade: "inspectable" }
      ]
    },
    {
      id: "b", signer: "claude", lens: "grok", dependencies: ["a"],
      files: ["evals/run.mjs"], requirements: "REQ-B",
      checks: [{ type: "file_exists", path: "evals/run.mjs" }],
      test: { cmd: "node", args: ["evals/run.mjs"] },
      isUi: false, findingsKey: "accuracy_eval_findings", finding: "F"
    }
  ]
};

// 1. A good manifest validates (returns the manifest); every corruption fails
//    CLOSED with a named error.
{
  const m = structuredClone(GOOD);
  assert.equal(validateManifest(m), m, "valid manifest returned unchanged");
}
{
  const cases = [
    [(m) => { m.surprise = 1; }, /unknown manifest field "surprise"/],
    [(m) => { delete m.objective; }, /"objective" must be a non-empty string/],
    [(m) => { m.workstreams[0].sneaky = 1; }, /unknown field "sneaky"/],
    [(m) => { m.workstreams[0].checks[0].type = "file_maybe"; }, /unknown check type/],
    [(m) => { delete m.workstreams[0].checks[1].needle; }, /missing "needle"/],
    [(m) => { m.workstreams[1].dependencies = ["ghost"]; }, /dependency "ghost"/],
    [(m) => { m.workstreams[1].id = "a"; }, /duplicate workstream id/],
    [(m) => { m.workstreams[0].checks[1].grade = "vibes"; }, /unknown grade "vibes"/],
    [(m) => { m.workstreams[1].test = { cmd: "node" }; }, /"test" must be \{cmd, args\[\]\}/]
  ];
  for (const [corrupt, re] of cases) {
    const m = structuredClone(GOOD);
    corrupt(m);
    assert.throws(() => validateManifest(m), re, `expected ${re}`);
  }
}

// 2. defsFromManifest is deterministic, honors explicit tests, and strips
//    grade fields from check-derived test specs (grading never re-hashes).
{
  const defs1 = defsFromManifest(structuredClone(GOOD), { checkNodePath: "/x/check-node.mjs" });
  const defs2 = defsFromManifest(structuredClone(GOOD), { checkNodePath: "/x/check-node.mjs" });
  assert.deepEqual(defs1, defs2, "deterministic");
  assert.deepEqual(defs1[1].test, { cmd: "node", args: ["evals/run.mjs"] }, "explicit test honored");
  const specs = JSON.parse(defs1[0].test.args[1]);
  assert.deepEqual(specs[1], { type: "file_contains", path: "docs/A.md", needle: "alpha" }, "grade stripped from test spec");

  const graded = structuredClone(GOOD);
  delete graded.workstreams[0].checks[1].grade;
  const defsUngraded = defsFromManifest(graded, { checkNodePath: "/x/check-node.mjs" });
  assert.deepEqual(defs1, defsUngraded, "adding/removing grades does not change defs (hash-stable)");
}

// 3. workstreamsFromManifest keeps grades for the bout layer.
{
  const ws = workstreamsFromManifest(structuredClone(GOOD));
  assert.equal(ws[0].checks[1].grade, "inspectable", "grades ride to the bout layer");
}

// 4. dossierFromManifest carries thesis/users and derives required workstreams.
{
  const d = dossierFromManifest(GOOD);
  assert.deepEqual(d.required_market_workstreams, ["a", "b"]);
  assert.equal(d.business_thesis, "Thesis.");
  assert.equal(d.idea_id, "demo", "idea_id defaults to build_id");
}

console.log("test-manifest: all assertions passed");
