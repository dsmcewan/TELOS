#!/usr/bin/env node

import assert from "node:assert/strict";
import { validateRecords } from "../gate.mjs";

console.log("Starting Build Gate Stress/Security Tests...");

function approvalPacket(buildId, useCase, model, docsReviewed) {
  const roleByModel = {
    claude: "builder",
    agy: "checkpoint",
    codex: "implementation-review",
    grok: "adversarial-review"
  };

  return {
    build_id: buildId,
    use_case: useCase,
    model,
    role: roleByModel[model],
    docs_reviewed: docsReviewed,
    proposal_ref: "shared/Coordination/Multi-Model Agentic Build Gate.md",
    decision: "approve",
    required_edits: [],
    hard_stops: [],
    confidence: "high",
    timestamp: "2026-06-26T12:00:00-04:00"
  };
}

// ----------------------------------------------------
// 1. Sibling Folder Safety Tests
// ----------------------------------------------------
console.log("Running Sibling Folder Safety tests...");

// Test A: Sibling folders of protected paths should be allowed.
const siblingPassDossier = {
  build_id: "sibling-stress",
  use_case: "sibling-stress-case",
  objective: "Verify sibling paths are not blocked.",
  required_docs: ["doc-a"],
  write_targets: [
    "me/gemini-addon/foo.txt",
    "me/claude-desktop-helper/config.json",
    "CHATGPT-backup/log.txt",
    "me/claude-coder/main.py"
  ],
  protected_paths: ["CHATGPT/", "me/claude-code/", "me/claude-desktop/", "me/gemini/"]
};
const siblingPassPackets = [
  approvalPacket("sibling-stress", "sibling-stress-case", "claude", ["doc-a"]),
  approvalPacket("sibling-stress", "sibling-stress-case", "agy", []),
  approvalPacket("sibling-stress", "sibling-stress-case", "codex", [])
];
const siblingPassReport = validateRecords(siblingPassDossier, siblingPassPackets);
assert.equal(siblingPassReport.gate_status, "pass", "Sibling paths should not block the gate.");

// Test B: Subfolders of protected paths must be blocked.
const subfolderBlockDossier = {
  build_id: "subfolder-stress",
  use_case: "subfolder-stress-case",
  objective: "Verify subfolder paths are blocked.",
  required_docs: ["doc-a"],
  write_targets: [
    "me/gemini/addon/foo.txt"
  ],
  protected_paths: ["CHATGPT/", "me/claude-code/", "me/claude-desktop/", "me/gemini/"]
};
const subfolderBlockPackets = [
  approvalPacket("subfolder-stress", "subfolder-stress-case", "claude", ["doc-a"]),
  approvalPacket("subfolder-stress", "subfolder-stress-case", "agy", []),
  approvalPacket("subfolder-stress", "subfolder-stress-case", "codex", [])
];
const subfolderBlockReport = validateRecords(subfolderBlockDossier, subfolderBlockPackets);
assert.equal(subfolderBlockReport.gate_status, "blocked", "Subfolders of protected paths must block.");
assert.ok(
  subfolderBlockReport.blockers.some(b => b.includes("is inside protected path")),
  "Expected blocker message for subfolder of protected path"
);

// Test C: Exact protected path (with or without slash) must be blocked.
const exactBlockDossier = {
  build_id: "exact-stress",
  use_case: "exact-stress-case",
  objective: "Verify exact paths are blocked.",
  required_docs: ["doc-a"],
  write_targets: [
    "me/gemini",
    "CHATGPT/"
  ],
  protected_paths: ["CHATGPT/", "me/claude-code/", "me/claude-desktop/", "me/gemini/"]
};
const exactBlockReport = validateRecords(exactBlockDossier, [
  approvalPacket("exact-stress", "exact-stress-case", "claude", ["doc-a"]),
  approvalPacket("exact-stress", "exact-stress-case", "agy", []),
  approvalPacket("exact-stress", "exact-stress-case", "codex", [])
]);
assert.equal(exactBlockReport.gate_status, "blocked", "Exact protected paths must block.");

// ----------------------------------------------------
// 2. Traversal Resistance Tests
// ----------------------------------------------------
console.log("Running Traversal Resistance tests...");

// Test A: Targets trying to traverse into protected paths must block.
const traversalBlockDossier = {
  build_id: "traversal-stress",
  use_case: "traversal-stress-case",
  objective: "Verify traversal into protected paths blocks.",
  required_docs: ["doc-a"],
  write_targets: [
    "shared/../../CHATGPT/exploit.md",
    "shared/../me/gemini/exploit.json"
  ],
  protected_paths: ["CHATGPT/", "me/gemini/"]
};
const traversalBlockReport = validateRecords(traversalBlockDossier, [
  approvalPacket("traversal-stress", "traversal-stress-case", "claude", ["doc-a"]),
  approvalPacket("traversal-stress", "traversal-stress-case", "agy", []),
  approvalPacket("traversal-stress", "traversal-stress-case", "codex", [])
]);
assert.equal(traversalBlockReport.gate_status, "blocked", "Traversal into protected paths must block.");
assert.equal(traversalBlockReport.blockers.length, 2, "Both traversal targets should be blocked.");

// Test B: Targets that traverse but resolve outside protected paths should pass (within reason).
const traversalPassDossier = {
  build_id: "traversal-pass-stress",
  use_case: "traversal-pass-case",
  objective: "Verify traversal resolving to safe paths passes.",
  required_docs: ["doc-a"],
  write_targets: [
    "me/gemini/../../shared/Coordination/example.md"
  ],
  protected_paths: ["me/gemini/"]
};
const traversalPassReport = validateRecords(traversalPassDossier, [
  approvalPacket("traversal-pass-stress", "traversal-pass-case", "claude", ["doc-a"]),
  approvalPacket("traversal-pass-stress", "traversal-pass-case", "agy", []),
  approvalPacket("traversal-pass-stress", "traversal-pass-case", "codex", [])
]);
assert.equal(traversalPassReport.gate_status, "pass", "Traversal resolving to safe paths should pass.");

// ----------------------------------------------------
// 3. LEXI Gate Verification (lexi_required: true)
// ----------------------------------------------------
console.log("Running LEXI Gate verification tests...");

const LEXI_DOC = "shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md";

// Test A: lexi_required is true, but lexi_reference_read is false/missing.
const lexiNoReadDossier = {
  build_id: "lexi-no-read",
  use_case: "lexi-no-read-case",
  objective: "LEXI check",
  required_docs: ["doc-a"],
  write_targets: ["shared/Coordination/example.md"],
  lexi_required: true,
  lexi_reference_read: false
};
const lexiNoReadReport = validateRecords(lexiNoReadDossier, [
  approvalPacket("lexi-no-read", "lexi-no-read-case", "claude", ["doc-a", LEXI_DOC]),
  approvalPacket("lexi-no-read", "lexi-no-read-case", "agy", []),
  approvalPacket("lexi-no-read", "lexi-no-read-case", "codex", [])
]);
assert.equal(lexiNoReadReport.gate_status, "blocked");
assert.ok(
  lexiNoReadReport.blockers.some(b => b.includes("lexi_reference_read is not true")),
  "Expected blocker for lexi_reference_read being false"
);

// Test B: lexi_required is true, lexi_reference_read is true, but no packet reviewed the LEXI doc.
const lexiNoDocDossier = {
  build_id: "lexi-no-doc",
  use_case: "lexi-no-doc-case",
  objective: "LEXI check",
  required_docs: ["doc-a"],
  write_targets: ["shared/Coordination/example.md"],
  lexi_required: true,
  lexi_reference_read: true
};
const lexiNoDocReport = validateRecords(lexiNoDocDossier, [
  approvalPacket("lexi-no-doc", "lexi-no-doc-case", "claude", ["doc-a"]),
  approvalPacket("lexi-no-doc", "lexi-no-doc-case", "agy", []),
  approvalPacket("lexi-no-doc", "lexi-no-doc-case", "codex", [])
]);
assert.equal(lexiNoDocReport.gate_status, "blocked");
assert.ok(
  lexiNoDocReport.blockers.some(b => b.includes("LEXI reference document")),
  "Expected blocker for missing LEXI reference document in reviewed docs"
);

// Test C: lexi_required is true, lexi_reference_read is true, and the doc is reviewed with case/slash variations.
const variations = [
  "shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md",
  "SHARED/Filing_Package_July_2026/LEXI_DB_REFERENCE.md",
  "shared\\Filing_Package_July_2026\\LEXI_DB_REFERENCE.md",
  "SHARED\\Filing_Package_July_2026\\lexi_db_reference.md"
];

for (const variant of variations) {
  const lexiPassDossier = {
    build_id: `lexi-pass-${variant.replace(/[\\/]/g, "-")}`,
    use_case: "lexi-pass-case",
    objective: "LEXI check",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: true
  };
  const lexiPassReport = validateRecords(lexiPassDossier, [
    approvalPacket(lexiPassDossier.build_id, "lexi-pass-case", "claude", ["doc-a", variant]),
    approvalPacket(lexiPassDossier.build_id, "lexi-pass-case", "agy", []),
    approvalPacket(lexiPassDossier.build_id, "lexi-pass-case", "codex", [])
  ]);
  assert.equal(lexiPassReport.gate_status, "pass", `LEXI check should pass with variant: ${variant}`);
}

console.log("All build-gate stress and security tests passed successfully!");
