#!/usr/bin/env node

// Operator tests: rulebook execution within bounds, fail-closed on unbounded
// or out-of-bounds actions (needs-human + halt), quota-class errors halt
// instead of retrying, every decision lands as a verifiable signed ledger
// line, inbox renders.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOperator, renderInbox, QUOTA_ERROR } from "../operator.mjs";

const tmp = () => mkdtempSync(path.join(os.tmpdir(), "forge-op-"));

// 1. A matching rule executes its action within bounds; the decision is a
//    SIGNED ledger line that verifies.
{
  const w = tmp();
  const executed = [];
  const op = createOperator({
    workdir: w,
    rulebook: [{
      id: "scale-up", description: "scale on good ROAS",
      when: (s) => s.roas >= 2,
      act: (s) => ({ action: "update_budget", args: { adset: "a1", cents: 1200 } })
    }],
    bounds: { update_budget: (args) => args.cents <= 2000 ? true : `cents ${args.cents} over cap` },
    actions: { update_budget: async (args) => { executed.push(args); return { ok: true }; } }
  });
  const r = await op.runPass({ roas: 2.4 });
  assert.equal(r.halted, false);
  assert.equal(executed.length, 1);
  const audit = op.verifyLedger();
  assert.deepEqual(audit, { total: 1, invalid: 0, ok: true }, "signed ledger verifies");
  const line = JSON.parse(readFileSync(op.ledgerPath, "utf8").trim());
  assert.equal(line.rule, "scale-up");
  assert.equal(line.outcome, "executed");

  // Tamper test: altering a ledgered decision breaks its signature.
  const { writeFileSync } = await import("node:fs");
  const tampered = { ...line, args: { adset: "a1", cents: 999900 } };
  writeFileSync(op.ledgerPath, JSON.stringify(tampered) + "\n");
  const audit2 = op.verifyLedger();
  assert.deepEqual(audit2, { total: 1, invalid: 1, ok: false }, "a flipped byte is detected");
}

// 2. Out-of-bounds action: NOT executed, needs-human recorded, pass halts.
{
  const w = tmp();
  const executed = [];
  const op = createOperator({
    workdir: w,
    rulebook: [{
      id: "greedy", when: () => true,
      act: () => ({ action: "update_budget", args: { cents: 99999 } })
    }],
    bounds: { update_budget: (args) => args.cents <= 2000 ? true : `cents ${args.cents} over cap` },
    actions: { update_budget: async (a) => { executed.push(a); } }
  });
  const r = await op.runPass({});
  assert.equal(r.halted, true);
  assert.equal(executed.length, 0, "never executed");
  const inbox = readFileSync(op.inboxPath, "utf8");
  assert.ok(inbox.includes("over cap"), "needs-human recorded");
  assert.ok(readFileSync(path.join(w, "INBOX.md"), "utf8").includes("1 open"), "inbox rendered");
}

// 3. An action with NO declared bounds is fail-closed too.
{
  const w = tmp();
  const op = createOperator({
    workdir: w,
    rulebook: [{ id: "r", when: () => true, act: () => ({ action: "mystery", args: {} }) }],
    bounds: {},
    actions: { mystery: async () => { throw new Error("should never run"); } }
  });
  const r = await op.runPass({});
  assert.equal(r.halted, true);
  assert.ok(r.reason.includes("no bounds declared"), "unbounded action fails closed");
}

// 4. Quota-class errors halt the pass with needs-human (never retried);
//    ordinary action errors are ledgered but do not halt.
{
  assert.ok(QUOTA_ERROR.test("Your credit balance is too low"), "quota regex sanity");
  const w = tmp();
  const op = createOperator({
    workdir: w,
    rulebook: [
      { id: "flaky", multi: true, when: () => true, act: () => ({ action: "ok_then_err", args: {} }) },
      { id: "starved", multi: true, when: () => true, act: () => ({ action: "quota", args: {} }) },
      { id: "never", multi: true, when: () => true, act: () => ({ action: "ok_then_err", args: {} }) }
    ],
    bounds: { ok_then_err: () => true, quota: () => true },
    actions: {
      ok_then_err: async () => { throw new Error("transient widget failure"); },
      quota: async () => { throw new Error("insufficient_quota: please check billing"); }
    }
  });
  const r = await op.runPass({});
  assert.equal(r.halted, true);
  assert.equal(r.reason, "quota-halt");
  const outcomes = readFileSync(op.ledgerPath, "utf8").trim().split("\n").map((l) => JSON.parse(l).outcome);
  assert.deepEqual(outcomes, ["action-error", "quota-halt"], "ordinary error continues; quota halts; later rules never run");
}

// 5. renderInbox counts only unresolved records.
{
  const w = tmp();
  const op = createOperator({
    workdir: w,
    rulebook: [{ id: "r", when: () => true, act: () => ({ action: "x", args: {} }) }],
    bounds: {}, actions: {}
  });
  await op.runPass({});
  assert.equal(renderInbox(w).open, 1);
}

console.log("test-operator: all assertions passed");
