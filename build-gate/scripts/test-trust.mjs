#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateRecords } from "../gate.mjs";
import { signPacket } from "../sign.mjs";

// Local test secrets (HMAC floor is keyless — no API keys involved).
process.env.TELOS_SECRET_CLAUDE = "claude-secret";
process.env.TELOS_SECRET_AGY = "agy-secret";
process.env.TELOS_SECRET_CODEX = "codex-secret";
const SECRET = { claude: "claude-secret", agy: "agy-secret", codex: "codex-secret" };

function approval(model, docs = []) {
  return {
    build_id: "trust-demo", use_case: "telos-trust", model, role: "approver",
    docs_reviewed: docs, proposal_ref: "ref", decision: "approve",
    required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-27T00:00:00Z",
    provenance: { model: `real-${model}`, source: "ai-peer-mcp", response_id: `resp_${model}_123` }
  };
}
function signedTrio() {
  return ["claude", "agy", "codex"].map((m) => signPacket(approval(m, ["doc-a"]), SECRET[m]));
}
const dossier = {
  build_id: "trust-demo", use_case: "telos-trust", objective: "Prove signed mode.",
  required_docs: ["doc-a"], write_targets: ["shared/Coordination/x.md"], protected_paths: [],
  trust_mode: "signed"
};

// 1. Happy path: signed trio with real provenance -> pass.
assert.equal(validateRecords(dossier, signedTrio()).gate_status, "pass", "valid signed trio should pass");

// 2. Tampered signature -> blocked.
{
  const trio = signedTrio();
  trio[0] = { ...trio[0], decision: "approve", confidence: "low" }; // mutate after signing
  const r = validateRecords(dossier, trio);
  assert.equal(r.gate_status, "blocked");
  assert.ok(r.blockers.some((b) => b.includes("signature invalid")), "tampered packet must block on signature");
}

// 3. Missing provenance -> blocked.
{
  const trio = signedTrio().map((p) => ({ ...p }));
  delete trio[1].provenance;
  const resigned = [signPacket(trio[1], SECRET.agy)]; // re-sign so signature is valid but provenance absent
  const r = validateRecords(dossier, [trio[0], resigned[0], trio[2]]);
  assert.equal(r.gate_status, "blocked");
  assert.ok(r.blockers.some((b) => b.includes("carries no provenance")), "absent provenance must block in signed mode");
}

// 4. Placeholder response_id -> blocked.
{
  const p = approval("codex", ["doc-a"]);
  p.provenance.response_id = "codex_self";
  const trio = [signPacket(approval("claude", ["doc-a"]), SECRET.claude), signPacket(approval("agy", ["doc-a"]), SECRET.agy), signPacket(p, SECRET.codex)];
  const r = validateRecords(dossier, trio);
  assert.equal(r.gate_status, "blocked");
  assert.ok(r.blockers.some((b) => b.includes("placeholder provenance")), "placeholder response_id must block");
}

// 5. Missing secret -> blocked.
{
  delete process.env.TELOS_SECRET_AGY;
  const r = validateRecords(dossier, signedTrio());
  assert.equal(r.gate_status, "blocked");
  assert.ok(r.blockers.some((b) => b.includes("no secret to verify agy")), "missing secret must block");
  process.env.TELOS_SECRET_AGY = "agy-secret";
}

// 6. Legacy mode (no trust_mode) ignores signatures/provenance entirely.
{
  const legacy = { ...dossier }; delete legacy.trust_mode;
  const plain = ["claude", "agy", "codex"].map((m) => approval(m, ["doc-a"])); // unsigned, real-ish provenance
  const r = validateRecords(legacy, plain);
  assert.equal(r.gate_status, "pass", "legacy mode must ignore signatures");
}

// 7. Sufficiency: signed-mode meets with existence-only checks -> blocked; with file_contains on non-empty -> pass that aspect.
{
  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-meets-"));
  writeFileSync(path.join(dir, "art.txt"), "marker-TELOS-OK");
  writeFileSync(path.join(dir, "empty.txt"), "");

  const marketDossier = {
    ...dossier, idea_id: "telos-upgrade", market_bound: true, user_facing_frontend: false,
    affected_directories: [dir],
    required_market_workstreams: ["frontend-brand-experience"]
  };
  function marketPacket(checks) {
    return {
      build_id: "trust-demo", idea_id: "telos-upgrade", model: "claude", project_state: "prototype",
      workstreams_reviewed: ["frontend-brand-experience"], business_thesis: "t", target_users: ["u"],
      architecture_findings: [], backend_schema_findings: [], security_findings: [], accuracy_eval_findings: [],
      scalability_findings: [], frontend_design_findings: [], lexi_class_ui_status: "meets",
      go_to_market_blockers: [], recommendation_to_claude: "ship", timestamp: "2026-06-27T00:00:00Z",
      provenance: { model: "real-claude", source: "ai-peer-mcp", response_id: "resp_market_claude_1" },
      breakout: {
        workstream: "frontend-brand-experience", converged: true, finalStatus: "meets",
        surviving_blockers: [], rounds: [{ round: 1 }], checks
      }
    };
  }
  const market = (checks) => [signPacket(marketPacket(checks), SECRET.claude)];

  const existenceOnly = validateRecords(marketDossier, signedTrio(), {}, [], market([{ type: "file_exists", path: "art.txt" }]));
  assert.ok(existenceOnly.blockers.some((b) => b.includes("existence-only")), "existence-only meets must block in signed mode");

  const emptyEvidence = validateRecords(marketDossier, signedTrio(), {}, [], market([{ type: "file_contains", path: "empty.txt", needle: "" }, { type: "file_exists", path: "empty.txt" }]));
  assert.ok(emptyEvidence.blockers.some((b) => b.includes("zero-byte")), "zero-byte evidence must block in signed mode");

  const good = validateRecords(marketDossier, signedTrio(), {}, [], market([{ type: "file_contains", path: "art.txt", needle: "marker-TELOS-OK" }]));
  assert.equal(good.gate_status, "pass", "real file_contains on non-empty artifact should pass");
}

// 8. Empty-needle bypass is closed in signed mode: a meets packet whose ONLY
//    evidence is file_contains with needle:"" on a zero-byte file must be
//    blocked — the gate must report "existence-only" or "zero-byte".
{
  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-bypass-gate-"));
  writeFileSync(path.join(dir, "empty.txt"), "");

  const bypassDossier = {
    ...dossier, idea_id: "telos-upgrade", market_bound: true, user_facing_frontend: false,
    affected_directories: [dir],
    required_market_workstreams: ["frontend-brand-experience"]
  };
  function bypassMarketPacket(checks) {
    return {
      build_id: "trust-demo", idea_id: "telos-upgrade", model: "claude", project_state: "prototype",
      workstreams_reviewed: ["frontend-brand-experience"], business_thesis: "t", target_users: ["u"],
      architecture_findings: [], backend_schema_findings: [], security_findings: [], accuracy_eval_findings: [],
      scalability_findings: [], frontend_design_findings: [], lexi_class_ui_status: "meets",
      go_to_market_blockers: [], recommendation_to_claude: "ship", timestamp: "2026-06-27T00:00:00Z",
      provenance: { model: "real-claude", source: "ai-peer-mcp", response_id: "resp_market_claude_1" },
      breakout: {
        workstream: "frontend-brand-experience", converged: true, finalStatus: "meets",
        surviving_blockers: [], rounds: [{ round: 1 }], checks
      }
    };
  }
  const bypassMarket = (checks) => [signPacket(bypassMarketPacket(checks), SECRET.claude)];

  const emptyNeedleBypass = validateRecords(
    bypassDossier, signedTrio(), {}, [],
    bypassMarket([{ type: "file_contains", path: "empty.txt", needle: "" }])
  );
  assert.equal(emptyNeedleBypass.gate_status, "blocked", "empty-needle file_contains on zero-byte must be blocked");
  assert.ok(
    emptyNeedleBypass.blockers.some((b) => b.includes("existence-only") || b.includes("zero-byte")),
    "blocker must mention existence-only or zero-byte; got: " + JSON.stringify(emptyNeedleBypass.blockers)
  );
}

// 9. Market packets are authenticated in signed mode: unsigned or no-provenance
//    market evidence must block even when its on-disk checks would pass.
{
  const dir = mkdtempSync(path.join(os.tmpdir(), "telos-market-auth-"));
  writeFileSync(path.join(dir, "art.txt"), "marker-TELOS-OK");
  const marketDossier = {
    ...dossier, idea_id: "telos-upgrade", market_bound: true, user_facing_frontend: false,
    affected_directories: [dir], required_market_workstreams: ["frontend-brand-experience"]
  };
  const mkPacket = () => ({
    build_id: "trust-demo", idea_id: "telos-upgrade", model: "claude", project_state: "prototype",
    workstreams_reviewed: ["frontend-brand-experience"], business_thesis: "t", target_users: ["u"],
    architecture_findings: [], backend_schema_findings: [], security_findings: [], accuracy_eval_findings: [],
    scalability_findings: [], frontend_design_findings: [], lexi_class_ui_status: "meets",
    go_to_market_blockers: [], recommendation_to_claude: "ship", timestamp: "2026-06-27T00:00:00Z",
    provenance: { model: "real-claude", source: "ai-peer-mcp", response_id: "resp_market_claude_1" },
    breakout: {
      workstream: "frontend-brand-experience", converged: true, finalStatus: "meets",
      surviving_blockers: [], rounds: [{ round: 1 }],
      checks: [{ type: "file_contains", path: "art.txt", needle: "marker-TELOS-OK" }]
    }
  });

  const good = validateRecords(marketDossier, signedTrio(), { dossierDir: dir }, [], [signPacket(mkPacket(), SECRET.claude)]);
  assert.equal(good.gate_status, "pass", "signed market packet with provenance should pass; got: " + JSON.stringify(good.blockers));

  const unsigned = validateRecords(marketDossier, signedTrio(), { dossierDir: dir }, [], [mkPacket()]);
  assert.equal(unsigned.gate_status, "blocked");
  assert.ok(unsigned.blockers.some((b) => b.includes("Market readiness packet for claude signature invalid")),
    "unsigned market packet must block in signed mode; got: " + JSON.stringify(unsigned.blockers));

  const noProv = mkPacket(); delete noProv.provenance;
  const noProvSigned = validateRecords(marketDossier, signedTrio(), { dossierDir: dir }, [], [signPacket(noProv, SECRET.claude)]);
  assert.equal(noProvSigned.gate_status, "blocked");
  assert.ok(noProvSigned.blockers.some((b) => b.includes("Market readiness packet for claude carries no provenance")),
    "market packet without provenance must block in signed mode; got: " + JSON.stringify(noProvSigned.blockers));
}

// 10. Capability packets are authenticated in signed mode the same way.
{
  const capDossier = {
    ...dossier, idea_id: "cap-idea", telos: "prove capability signing", required_capability_models: ["claude"]
  };
  const capPacket = () => ({
    build_id: "trust-demo", idea_id: "cap-idea", model: "claude", telos: "prove capability signing",
    docs_needed: [], skills_needed: [], connectors_needed: [], available_now: [],
    missing_capabilities: [], can_build_during_planning: [], built_during_planning: [],
    must_request_user_or_install: [], presented_to_claude: true,
    recommendation_to_claude: "ready", timestamp: "2026-06-27T00:00:00Z",
    provenance: { model: "real-claude", source: "ai-peer-mcp", response_id: "resp_cap_claude_1" }
  });

  const good = validateRecords(capDossier, signedTrio(), {}, [signPacket(capPacket(), SECRET.claude)]);
  assert.equal(good.gate_status, "pass", "signed capability packet with provenance should pass; got: " + JSON.stringify(good.blockers));

  const unsigned = validateRecords(capDossier, signedTrio(), {}, [capPacket()]);
  assert.ok(unsigned.blockers.some((b) => b.includes("Capability packet for claude signature invalid")),
    "unsigned capability packet must block in signed mode; got: " + JSON.stringify(unsigned.blockers));

  const noProv = capPacket(); delete noProv.provenance;
  const noProvSigned = validateRecords(capDossier, signedTrio(), {}, [signPacket(noProv, SECRET.claude)]);
  assert.ok(noProvSigned.blockers.some((b) => b.includes("Capability packet for claude carries no provenance")),
    "capability packet without provenance must block in signed mode; got: " + JSON.stringify(noProvSigned.blockers));

  console.log("test-trust.mjs signed-mode market/capability auth OK");
}

console.log("test-trust.mjs OK");
