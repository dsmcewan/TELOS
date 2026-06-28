#!/usr/bin/env node
// test-breakout-coverage.mjs — the gate re-verifies EVERY team's breakout record
// on facts, not just the UI team's. A non-UI market packet that carries a
// breakout has its declarative checks re-run against disk; fabricated/absent
// facts block even when lexi_class_ui_status is "not-applicable".
//
// Runs from the build-gate dir, so file_exists "gate.mjs" resolves to a real file.

import assert from "node:assert/strict";
import { validateRecords } from "../gate.mjs";

const TS = "2026-06-28T00:00:00-04:00";

const approval = (model) => ({
  build_id: "bc", use_case: "breakout-coverage", model, role: "builder",
  docs_reviewed: [], proposal_ref: "x", decision: "approve",
  required_edits: [], hard_stops: [], confidence: "high", timestamp: TS
});

function marketPacket(checks, lexi = "not-applicable") {
  return {
    build_id: "bc", idea_id: "idea-bc", model: "codex", project_state: "demo",
    workstreams_reviewed: ["backend-schema"],
    business_thesis: "Deterministic forensics earns trust.", target_users: ["evaluators"],
    architecture_findings: [], backend_schema_findings: ["RLS enforced"], security_findings: [],
    accuracy_eval_findings: [], scalability_findings: [], frontend_design_findings: [],
    lexi_class_ui_status: lexi, go_to_market_blockers: [],
    breakout: {
      workstream: "backend-schema", claimedStatus: "meets", finalStatus: "meets",
      converged: true, surviving_blockers: [], go_to_market_blockers: [],
      checks, rounds: [{ round: 1, blockers: [], resolved: [] }]
    },
    recommendation_to_claude: "go", timestamp: TS
  };
}

// Non-UI (user_facing_frontend:false) so the frontend-meets requirement is off.
const dossier = {
  build_id: "bc", idea_id: "idea-bc", use_case: "breakout-coverage", objective: "o",
  required_docs: [], write_targets: [], protected_paths: [],
  market_bound: true, user_facing_frontend: false,
  required_market_workstreams: ["backend-schema"]
};
const approvals = ["claude", "agy", "codex"].map(approval);

// 1. A non-UI team's breakout with a check that holds is re-verified -> pass.
const pass = validateRecords(dossier, approvals, {}, [], [marketPacket([{ type: "file_exists", path: "gate.mjs" }])]);
assert.equal(pass.gate_status, "pass",
  "non-UI breakout with a passing check should pass; blockers=" + JSON.stringify(pass.blockers));

// 2. The SAME packet with a check that does NOT hold is now re-verified -> blocked.
//    (Before this change a 'not-applicable' packet's breakout was never re-run.)
const blocked = validateRecords(dossier, approvals, {}, [], [marketPacket([{ type: "file_exists", path: "does-not-exist.xyz" }])]);
assert.equal(blocked.gate_status, "blocked", "non-UI breakout with a failing check must block");
assert.ok(blocked.blockers.some((b) => b.includes("FAILED gate re-verification")),
  "should cite re-verification failure; blockers=" + JSON.stringify(blocked.blockers));

console.log("breakout-coverage: OK — every team's breakout record is re-verified on facts");
