#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { validateRecords } from "../../../build-gate/gate.mjs";
import { signPacket } from "../../../build-gate/sign.mjs";
import { createOperator, renderInbox } from "../../../forge/operator.mjs";

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

async function runOperatorProof() {
  const workdir = mkdtempSync(path.join(os.tmpdir(), "telos-fail-closed-demo-"));
  let actionCalls = 0;

  try {
    const op = createOperator({
      workdir,
      signerName: "fail-closed-demo",
      rulebook: [{
        id: "overspend",
        when: () => true,
        act: () => ({
          action: "update_budget",
          args: { campaign_id: "fixture-campaign", daily_budget_cents: 2501 }
        })
      }],
      bounds: {
        update_budget: (args) => args.daily_budget_cents <= 2000
          ? true
          : `daily_budget_cents ${args.daily_budget_cents} over cap 2000`
      },
      actions: {
        update_budget: async () => {
          actionCalls += 1;
          return { ok: true };
        }
      }
    });

    const result = await op.runPass({ source: "fixture" });
    assert.equal(result.halted, true, "out-of-bounds pass must halt");
    assert.equal(actionCalls, 0, "out-of-bounds action must never execute");
    assert.equal(result.decisions.length, 1, "one rule must produce one decision");

    const decision = result.decisions[0];
    assert.equal(decision.outcome, "needs-human", "decision must require a human");
    assert.equal(decision.sig?.alg, "Ed25519", "decision must use Ed25519");

    const inboxRecords = readFileSync(op.inboxPath, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(inboxRecords.length, 1, "one needs-human record must exist");
    assert.equal(inboxRecords[0].resolution, null, "needs-human record must remain open");
    assert.match(inboxRecords[0].question, /over cap 2000/, "record must name the bound");

    const inbox = renderInbox(workdir);
    assert.equal(inbox.open, 1, "rendered inbox must report one open item");
    assert.match(
      readFileSync(path.join(workdir, "INBOX.md"), "utf8"),
      /\*\*1 open\*\*/,
      "human inbox must render the open decision"
    );

    const cleanAudit = op.verifyLedger();
    assert.deepEqual(
      cleanAudit,
      { total: 1, invalid: 0, ok: true },
      "untouched Ed25519 ledger must verify"
    );

    const ledgerRecord = JSON.parse(readFileSync(op.ledgerPath, "utf8").trim());
    const tampered = { ...ledgerRecord, reason: `${ledgerRecord.reason} [tampered]` };
    writeFileSync(op.ledgerPath, JSON.stringify(tampered) + "\n");
    const tamperedAudit = op.verifyLedger();
    assert.deepEqual(
      tamperedAudit,
      { total: 1, invalid: 1, ok: false },
      "one-field ledger mutation must fail verification"
    );

    return {
      status: "needs-human",
      action_executed: actionCalls !== 0,
      inbox_open: inbox.open,
      ledger_verified: cleanAudit.ok,
      tampered_ledger_rejected: !tamperedAudit.ok && tamperedAudit.invalid === 1,
      signature_algorithm: decision.sig.alg
    };
  } finally {
    rmSync(workdir, { recursive: true, force: true });
  }
}

async function main() {
  const gate = runGateProof();
  const operator = await runOperatorProof();
  process.stdout.write("BLOCKED  tampered required-seat packet: signature invalid\n");
  process.stdout.write("HALTED   out-of-bounds action: not executed; needs-human recorded\n");
  process.stdout.write("VERIFIED HMAC gate + Ed25519 decision ledger; tamper rejected\n");
  process.stdout.write(JSON.stringify({ ok: true, gate, operator }) + "\n");
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
