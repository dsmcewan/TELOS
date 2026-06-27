import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateRecords } from "../gate.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// -------------------------------------------------------------
// SECTION 1: Traversal Resistance Tests
// -------------------------------------------------------------
console.log("Running Traversal Resistance tests...");

// Test 1.1: Standard directory traversal attempting to write into a protected path
const travBlock1 = validateRecords(
  {
    build_id: "trav-1",
    use_case: "test",
    objective: "Test traversal blocking",
    required_docs: ["doc-a"],
    write_targets: ["shared/../../CHATGPT/exploit.md"],
    protected_paths: ["CHATGPT/"]
  },
  [
    approvalPacket("trav-1", "test", "claude", ["doc-a"]),
    approvalPacket("trav-1", "test", "agy", []),
    approvalPacket("trav-1", "test", "codex", [])
  ]
);
assert.equal(travBlock1.gate_status, "blocked");
assert.ok(travBlock1.blockers.some(b => b.includes("is inside protected path 'CHATGPT/'")));

// Test 1.2: Absolute path write target mapping into protected path.
// safeResolve flattens an absolute path's tail segments under vaultRoot, so an
// absolute path whose first segment is the protected dir lands inside it
// regardless of where the repo lives (root-independent — no hard-coded vault path).
const travBlock2 = validateRecords(
  {
    build_id: "trav-2",
    use_case: "test",
    objective: "Test traversal blocking with absolute paths",
    required_docs: ["doc-a"],
    write_targets: ["C:\\CHATGPT\\subfolder\\exploit.md"],
    protected_paths: ["CHATGPT/"]
  },
  [
    approvalPacket("trav-2", "test", "claude", ["doc-a"]),
    approvalPacket("trav-2", "test", "agy", []),
    approvalPacket("trav-2", "test", "codex", [])
  ]
);
assert.equal(travBlock2.gate_status, "blocked");
assert.ok(travBlock2.blockers.some(b => b.includes("is inside protected path 'CHATGPT/'")));

// Test 1.3: Absolute path trying to escape root directory to C:\Windows
// safeResolve should force it to resolve relative to root, making it V4\Windows\exploit.md.
// Let's add "Windows/" to protected paths to see if it catches it.
const travBlock3 = validateRecords(
  {
    build_id: "trav-3",
    use_case: "test",
    objective: "Test escape blocking with absolute paths outside root",
    required_docs: ["doc-a"],
    write_targets: ["C:\\Windows\\exploit.md"],
    protected_paths: ["Windows/"]
  },
  [
    approvalPacket("trav-3", "test", "claude", ["doc-a"]),
    approvalPacket("trav-3", "test", "agy", []),
    approvalPacket("trav-3", "test", "codex", [])
  ]
);
assert.equal(travBlock3.gate_status, "blocked");
assert.ok(travBlock3.blockers.some(b => b.includes("is inside protected path 'Windows/'")));

// Test 1.4: Slash variation and trailing dot traversal bypass attempts
const travBlock4 = validateRecords(
  {
    build_id: "trav-4",
    use_case: "test",
    objective: "Test slash variations",
    required_docs: ["doc-a"],
    write_targets: ["shared\\..\\..\\chatgpt/exploit.md"],
    protected_paths: ["CHATGPT/"]
  },
  [
    approvalPacket("trav-4", "test", "claude", ["doc-a"]),
    approvalPacket("trav-4", "test", "agy", []),
    approvalPacket("trav-4", "test", "codex", [])
  ]
);
assert.equal(travBlock4.gate_status, "blocked");
assert.ok(travBlock4.blockers.some(b => b.includes("is inside protected path 'CHATGPT/'")));

console.log("Traversal Resistance tests passed.");

// -------------------------------------------------------------
// SECTION 2: Sibling Folder Safety Tests
// -------------------------------------------------------------
console.log("Running Sibling Folder Safety tests...");

// Test 2.1: Target starts with same prefix but is sibling (no trailing slash on target)
const sibPass1 = validateRecords(
  {
    build_id: "sib-1",
    use_case: "test",
    objective: "Test sibling folder safety",
    required_docs: ["doc-a"],
    write_targets: ["me/gemini-addon/file.txt"],
    protected_paths: ["me/gemini/"]
  },
  [
    approvalPacket("sib-1", "test", "claude", ["doc-a"]),
    approvalPacket("sib-1", "test", "agy", []),
    approvalPacket("sib-1", "test", "codex", [])
  ]
);
assert.equal(sibPass1.gate_status, "pass");

// Test 2.2: Sibling folder safety with CHATGPT
const sibPass2 = validateRecords(
  {
    build_id: "sib-2",
    use_case: "test",
    objective: "Test sibling folder safety",
    required_docs: ["doc-a"],
    write_targets: ["CHATGPT-backup/file.txt"],
    protected_paths: ["CHATGPT/"]
  },
  [
    approvalPacket("sib-2", "test", "claude", ["doc-a"]),
    approvalPacket("sib-2", "test", "agy", []),
    approvalPacket("sib-2", "test", "codex", [])
  ]
);
assert.equal(sibPass2.gate_status, "pass");

// Test 2.3: Target is inside the protected path (should be blocked)
const sibBlock1 = validateRecords(
  {
    build_id: "sib-3",
    use_case: "test",
    objective: "Verify target inside is blocked",
    required_docs: ["doc-a"],
    write_targets: ["me/gemini/addon/file.txt"],
    protected_paths: ["me/gemini/"]
  },
  [
    approvalPacket("sib-3", "test", "claude", ["doc-a"]),
    approvalPacket("sib-3", "test", "agy", []),
    approvalPacket("sib-3", "test", "codex", [])
  ]
);
assert.equal(sibBlock1.gate_status, "blocked");

console.log("Sibling Folder Safety tests passed.");

// -------------------------------------------------------------
// SECTION 3: LEXI Checks when lexi_required is true
// -------------------------------------------------------------
console.log("Running LEXI Checks tests...");

// Test 3.1: lexi_required is true but lexi_reference_read is missing/false
const lexiFail1 = validateRecords(
  {
    build_id: "lexi-1",
    use_case: "test",
    objective: "LEXI verification",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: false
  },
  [
    approvalPacket("lexi-1", "test", "claude", ["doc-a", "shared/Filing_Package_July_2026/LEXI_DB_REFERENCE.md"]),
    approvalPacket("lexi-1", "test", "agy", []),
    approvalPacket("lexi-1", "test", "codex", [])
  ]
);
assert.equal(lexiFail1.gate_status, "blocked");
assert.ok(lexiFail1.blockers.some(b => b.includes("lexi_reference_read is not true")));

// Test 3.2: lexi_required is true, lexi_reference_read is true, but doc not reviewed
const lexiFail2 = validateRecords(
  {
    build_id: "lexi-2",
    use_case: "test",
    objective: "LEXI verification",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: true
  },
  [
    approvalPacket("lexi-2", "test", "claude", ["doc-a"]),
    approvalPacket("lexi-2", "test", "agy", []),
    approvalPacket("lexi-2", "test", "codex", [])
  ]
);
assert.equal(lexiFail2.gate_status, "blocked");
assert.ok(lexiFail2.blockers.some(b => b.includes("LEXI reference document")));

// Test 3.3: lexi_required is true, lexi_reference_read is true, and doc is reviewed (with case/slash changes)
const lexiPass1 = validateRecords(
  {
    build_id: "lexi-3",
    use_case: "test",
    objective: "LEXI verification",
    required_docs: ["doc-a"],
    write_targets: ["shared/Coordination/example.md"],
    lexi_required: true,
    lexi_reference_read: true
  },
  [
    approvalPacket("lexi-3", "test", "claude", ["doc-a", "SHARED\\Filing_Package_July_2026\\lexi_db_reference.md"]),
    approvalPacket("lexi-3", "test", "agy", []),
    approvalPacket("lexi-3", "test", "codex", [])
  ]
);
assert.equal(lexiPass1.gate_status, "pass");

console.log("LEXI Checks tests passed.");

// -------------------------------------------------------------
// SECTION 4: Dynamic HKCU Registry Key Env Var Loading Tests
// -------------------------------------------------------------
if (process.platform === "win32") {
  console.log("Running HKCU Registry Key Environment Variable Loading tests...");

  const varName1 = "AI_PEER_TEST_VAR";
  const varValue1 = "HelloRegistryVal";
  const varName2 = "AI_PEER_TEST_EXPAND";
  const varValue2 = "%" + varName1 + "%_Suffix";

  // Clean any leftover keys first
  try {
    execSync(`reg delete HKCU\\Environment /v ${varName1} /f`, { stdio: "ignore" });
  } catch {}
  try {
    execSync(`reg delete HKCU\\Environment /v ${varName2} /f`, { stdio: "ignore" });
  } catch {}

  try {
    // Add variables to HKCU registry
    execSync(`reg add HKCU\\Environment /v ${varName1} /t REG_SZ /d "${varValue1}" /f`);
    execSync(`reg add HKCU\\Environment /v ${varName2} /t REG_EXPAND_SZ /d "${varValue2}" /f`);

    // Now spawn a child process to load server.mjs and output the env values
    const mcpServerPath = path.resolve(__dirname, "../../connectors/ai-peer-mcp/server.mjs");
    const mcpServerUrl = pathToFileURL(mcpServerPath).href;
    
    // We run an inline node script that imports server.mjs.
    // Since server.mjs runs loadWin32Env immediately, the env variables should be populated.
    // Note: server.mjs also starts reading from stdin, so we need to pass a command or exit.
    // We can just set process.env before importing, or run loadWin32Env's code inline.
    const evalCode = `
      // Clean process.env first to ensure it's not inherited from parent
      delete process.env.${varName1};
      delete process.env.${varName2};
      
      import("${mcpServerUrl}")
        .then(() => {
          console.log(JSON.stringify({
            val1: process.env.${varName1},
            val2: process.env.${varName2}
          }));
          process.exit(0);
        })
        .catch(err => {
          console.error(err);
          process.exit(1);
        });
    `;

    const result = spawnSync(process.execPath, ["--input-type=module", "-e", evalCode], {
      encoding: "utf8"
    });

    if (result.status !== 0) {
      throw new Error(`Child process failed: ${result.stderr}`);
    }

    const output = JSON.parse(result.stdout.trim());
    assert.equal(output.val1, varValue1, `Expected ${varName1} to be ${varValue1}`);
    assert.equal(output.val2, `${varValue1}_Suffix`, `Expected ${varName2} to expand variables`);

    console.log("HKCU Registry Key Environment Variable Loading tests passed.");
  } finally {
    // Clean up registry keys
    try {
      execSync(`reg delete HKCU\\Environment /v ${varName1} /f`, { stdio: "ignore" });
    } catch {}
    try {
      execSync(`reg delete HKCU\\Environment /v ${varName2} /f`, { stdio: "ignore" });
    } catch {}
  }
} else {
  console.log("Skipping HKCU Registry tests on non-Windows platform.");
}

console.log("All stress tests completed successfully!");
