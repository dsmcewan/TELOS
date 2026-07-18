#!/usr/bin/env node
// init.mjs — scaffolds a machine-first record set. Idempotent: never overwrites.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , rootArg, componentArg] = process.argv;
if (!rootArg) { console.error("usage: init.mjs <repo-root> [component-dir]"); process.exit(1); }
const root = path.resolve(rootArg);
const put = (rel, content) => {
  const p = path.join(root, rel);
  if (existsSync(p)) { console.log(`skip: ${rel}`); return; }
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, content);
  console.log(`write: ${rel}`);
};

put("AI-START-HERE.md", `# AI START HERE

You are inheriting an institution, not just source code. Do not begin from a confident guess.

Read in this order (see LOAD-ORDER.json):
1. This file.
2. AUTHORITY.json — the active governing authority. If active is null, a human must bind it before any record can claim NORMATIVE status.
3. Each component's memory/IDENTITY.md, then its CONTRACTS/.

Rules: machine records are the source of truth; human docs are rendered projections. A claim is NORMATIVE only with a passing oracle. No implementation authority until the comprehension gate GRANTS it.
`);
put("AUTHORITY.json", JSON.stringify({
  note: "Bind active to the governing document: { ref, path, sha256: 'sha256:<64hex of raw bytes>' }. Superseded entries must never govern new work.",
  active: null,
  superseded: []
}, null, 2) + "\n");
put("LOAD-ORDER.json", JSON.stringify({
  note: "Minimal reading order for a fresh model. Load slim: stop when the task's component is loaded.",
  order: ["AI-START-HERE.md", "AUTHORITY.json", "<component>/memory/IDENTITY.md", "<component>/memory/INVARIANTS.json", "<component>/memory/CONTRACTS/", "<component>/memory/NON-CLAIMS.json"]
}, null, 2) + "\n");

if (componentArg) {
  const m = path.join(componentArg, "memory");
  const name = path.basename(componentArg);
  put(path.join(m, "IDENTITY.md"), `# ${name} — identity\n\nWhat this component IS and is NOT, in two paragraphs. State the boundary.\n`);
  put(path.join(m, "INVARIANTS.json"), JSON.stringify([
    { id: `${name}-example-invariant`, kind: "invariant", statement: "REPLACE: a load-bearing always-true property.", oracle: "NAME-THE-ORACLE-TEST-FILE", normativity: "NORMATIVE", status: "SPECIFIED-PENDING-IMPLEMENTATION" }
  ], null, 2) + "\n");
  put(path.join(m, "INVARIANTS.md"), `# ${name} — invariants (rendered)\n\nRendered projection of INVARIANTS.json. Regenerate; do not hand-edit facts here.\n`);
  put(path.join(m, "NON-CLAIMS.json"), JSON.stringify([
    { id: `${name}-example-non-claim`, kind: "non-claim", statement: "REPLACE: something this component deliberately does NOT do or prove.", status: "NORMATIVE-CURRENT" }
  ], null, 2) + "\n");
  put(path.join(m, "NON-CLAIMS.md"), `# ${name} — non-claims (rendered)\n`);
  put(path.join(m, "CONTRACTS", "component.json"), JSON.stringify({
    kind: "contract", id: `${name}-component`, title: `${name} — frozen semantics`,
    status: "SPECIFIED-PENDING-IMPLEMENTATION", normativity: "NORMATIVE",
    becomes_normative_when: "NAME-THE-ORACLE-TEST-FILE",
    lifecycle: "docs-first", decided_by: "human",
    oracle: { test: "" }
  }, null, 2) + "\n");
  put(path.join(m, "comprehension-queries.json"), JSON.stringify({
    component: name, governing_authority: { ref: "BIND-TO-AUTHORITY-REF" },
    required_invariants: [], required_non_claims: [], queries: []
  }, null, 2) + "\n");
  put(path.join(m, "DECISIONS", "rejected-alternatives.md"), `# ${name} — rejected alternatives\n\nPreserve every rejected path so a successor does not rediscover it as novel.\n`);
  put(path.join(m, "FAILURE-MODES.md"), `# ${name} — failure modes\n\nHow it fails, and that it fails closed.\n`);
  put(path.join(m, "EVIDENCE", "README.md"), `# ${name} — evidence\n\nPointers to oracle runs and golden data.\n`);
}
