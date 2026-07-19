#!/usr/bin/env node
// init.mjs — scaffolds a machine-first record set. Idempotent: never overwrites.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { contentAddress, renderRecordList } from "./lib/record.mjs";

const [, , rootArg, componentArg] = process.argv;
if (!rootArg) { console.error("usage: init.mjs <repo-root> [component-dir]"); process.exit(1); }
const root = path.resolve(rootArg);
const address = (record) => ({ ...record, id: contentAddress(record) });
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
2. CURRENT-AUTHORITY.json — the active governing authority. If active is null, a human must bind it before any record can claim NORMATIVE status.
3. Each component's memory/IDENTITY.md, then its CONTRACTS/.

Rules: machine records are the source of truth; human docs are rendered projections. A claim is NORMATIVE only with a passing oracle. No implementation authority until the comprehension gate GRANTS it.
`);
put("CURRENT-AUTHORITY.json", JSON.stringify({
  note: "A human binds active to {ref,path,sha256}. Superseded entries never govern new work.",
  active: null,
  superseded: []
}, null, 2) + "\n");
put("MEMORY-MANIFEST.json", JSON.stringify({
  version: 1,
  components: componentArg ? [componentArg] : []
}, null, 2) + "\n");
put("LOAD-ORDER.json", JSON.stringify({
  note: "Minimal reading order for a fresh model. Load slim: stop when the task's component is loaded.",
  order: ["AI-START-HERE.md", "CURRENT-AUTHORITY.json", "<component>/memory/IDENTITY.md", "<component>/memory/INVARIANTS.json", "<component>/memory/CONTRACTS/", "<component>/memory/NON-CLAIMS.json"],
  token_budget: {
    guidance: "Load the start file, current authority, and only the component records needed for the task; stop before unrelated components."
  }
}, null, 2) + "\n");

if (componentArg) {
  const m = path.join(componentArg, "memory");
  const name = path.basename(componentArg);
  const invariants = [
    address({
      kind: "invariant",
      statement: "REPLACE: a load-bearing always-true property.",
      oracle: "",
      normativity: "NORMATIVE",
      status: "SPECIFIED-PENDING-IMPLEMENTATION",
      becomes_normative_when: ""
    })
  ];
  const nonClaims = [
    address({
      kind: "non-claim",
      statement: "REPLACE: something this component deliberately does NOT do or prove.",
      oracle: "",
      status: "SPECIFIED-PENDING-IMPLEMENTATION",
      becomes_normative_when: ""
    })
  ];
  const contract = address({
    kind: "contract",
    title: `${name} — frozen semantics`,
    status: "SPECIFIED-PENDING-IMPLEMENTATION",
    normativity: "NORMATIVE",
    becomes_normative_when: "",
    lifecycle: "docs-first",
    decided_by: "human",
    oracle: { test: "" }
  });

  put(path.join(m, "README.md"), `# ${name} — memory

- \`IDENTITY.md\`
- \`INVARIANTS.json\` → \`INVARIANTS.md\`
- \`NON-CLAIMS.json\` → \`NON-CLAIMS.md\`
- \`CONTRACTS/component.json\`
- \`comprehension-queries.json\`
- \`DECISIONS/rejected-alternatives.md\`
- \`FAILURE-MODES.md\`
- \`EVIDENCE/README.md\`
`);
  put(path.join(m, "IDENTITY.md"), `# ${name} — identity\n\nWhat this component IS and is NOT, in two paragraphs. State the boundary.\n`);
  put(path.join(m, "INVARIANTS.json"), JSON.stringify(invariants, null, 2) + "\n");
  put(path.join(m, "INVARIANTS.md"), renderRecordList("Invariants", invariants));
  put(path.join(m, "NON-CLAIMS.json"), JSON.stringify(nonClaims, null, 2) + "\n");
  put(path.join(m, "NON-CLAIMS.md"), renderRecordList("Non-claims", nonClaims));
  put(path.join(m, "CONTRACTS", "component.json"), JSON.stringify(contract, null, 2) + "\n");
  put(path.join(m, "comprehension-queries.json"), JSON.stringify({
    component: name, governing_authority: { ref: "BIND-TO-AUTHORITY-REF" },
    required_invariants: [], required_non_claims: [], queries: []
  }, null, 2) + "\n");
  put(path.join(m, "DECISIONS", "rejected-alternatives.md"), `# ${name} — rejected alternatives\n\nPreserve every rejected path so a successor does not rediscover it as novel.\n`);
  put(path.join(m, "FAILURE-MODES.md"), `# ${name} — failure modes\n\nHow it fails, and that it fails closed.\n`);
  put(path.join(m, "EVIDENCE", "README.md"), `# ${name} — evidence\n\nPointers to oracle runs and golden data.\n`);
}
