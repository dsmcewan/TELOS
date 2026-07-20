#!/usr/bin/env node

import assert from "node:assert/strict";

import { validateRecords } from "../../../build-gate/gate.mjs";
import { signPacket } from "../../../build-gate/sign.mjs";

const FIXTURE_SECRETS = Object.freeze({
  claude: "fixture-only-claude-secret",
  agy: "fixture-only-agy-secret",
  codex: "fixture-only-codex-secret"
});

Object.assign(process.env, {
  TELOS_SECRET_CLAUDE: FIXTURE_SECRETS.claude,
  TELOS_SECRET_AGY: FIXTURE_SECRETS.agy,
  TELOS_SECRET_CODEX: FIXTURE_SECRETS.codex
});

const DOSSIER = Object.freeze({
  build_id: "fail-closed-demo",
  use_case: "portfolio-proof",
  objective: "Prove a changed required-seat packet cannot settle.",
  required_docs: ["docs/design.md"],
  write_targets: ["shared/Coordination/fail-closed-demo.md"],
  protected_paths: [],
  trust_mode: "signed"
});

function approval(model) {
  return {
    build_id: DOSSIER.build_id,
    use_case: DOSSIER.use_case,
    model,
    role: "approver",
    docs_reviewed: [...DOSSIER.required_docs],
    proposal_ref: "fixture-plan-ref",
    decision: "approve",
    required_edits: [],
    hard_stops: [],
    confidence: "high",
    timestamp: "2026-07-19T00:00:00.000Z",
    provenance: {
      model: `real-${model}`,
      source: "ai-peer-mcp",
      response_id: `resp_${model}_fail_closed_demo`
    }
  };
}

function runGateProof() {
  const packets = ["claude", "agy", "codex"]
    .map((model) => signPacket(approval(model), FIXTURE_SECRETS[model]));

  packets[0] = { ...packets[0], confidence: "low" };
  const report = validateRecords(DOSSIER, packets);
  const signatureBlockers = report.blockers
    .filter((blocker) => blocker.includes("signature invalid"));

  assert.equal(report.gate_status, "blocked", "tampered packet must block");
  assert.equal(signatureBlockers.length, 1, "exactly one signature discriminator must fire");
  assert.equal(report.blockers.length, 1, "fixture must not create unrelated blockers");

  return {
    status: "blocked",
    reason: "invalid-signature",
    tampered_packet_rejected: true
  };
}

async function main() {
  const gate = runGateProof();
  process.stdout.write("BLOCKED  tampered required-seat packet: signature invalid\n");
  process.stdout.write(JSON.stringify({ ok: true, gate }) + "\n");
}

if (process.argv.length !== 2) {
  process.stderr.write("Usage: node docs/runs/fail-closed-demo/run.mjs\n");
  process.exit(2);
}

try {
  await main();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`fail-closed-demo: ${detail}\n`);
  process.exitCode = 1;
}
