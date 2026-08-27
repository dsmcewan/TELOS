#!/usr/bin/env node

// Operator tests: rulebook execution within bounds, fail-closed on unbounded
// or out-of-bounds actions (needs-human + halt), quota-class errors halt
// instead of retrying, every decision lands as a verifiable signed ledger
// line, inbox renders.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createOperator, renderInbox, entryHash, QUOTA_ERROR } from "../operator.mjs";

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
  assert.deepEqual(audit, { total: 1, invalid: 0, ok: true, code: null, errors: [] }, "signed chained ledger verifies");
  const line = JSON.parse(readFileSync(op.ledgerPath, "utf8").trim());
  assert.equal(line.rule, "scale-up");
  assert.equal(line.outcome, "executed");
  assert.equal(line.sequence, 1, "entries carry a sequence");
  assert.equal(line.parent_hash, null, "genesis entry has a null parent");

  // Tamper test: altering a ledgered decision breaks its signature.
  const { writeFileSync } = await import("node:fs");
  const tampered = { ...line, args: { adset: "a1", cents: 999900 } };
  writeFileSync(op.ledgerPath, JSON.stringify(tampered) + "\n");
  const audit2 = op.verifyLedger();
  assert.equal(audit2.ok, false, "a flipped byte is detected");
  assert.equal(audit2.invalid, 1);
  assert.equal(audit2.code, "bad-signature");
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

// 6. Fail-closed ledger audit: garbage, deletion (middle + tail + whole file),
//    reorder, and truncation are DISTINCT failures — never {total:0, ok:true}.
{
  const { writeFileSync, readFileSync: rf, rmSync } = await import("node:fs");
  const mk = async (w, passes = 3) => {
    const op = createOperator({
      workdir: w,
      rulebook: [{ id: "r", when: () => true, act: () => ({ action: "x", args: {} }) }],
      bounds: { x: () => true }, actions: { x: async () => ({ ok: true }) }
    });
    for (let i = 0; i < passes; i++) await op.runPass({});
    return op;
  };

  // (a) garbage file — the headline regression: must NOT verify as empty-and-ok.
  {
    const w = tmp(); const op = await mk(w);
    writeFileSync(op.ledgerPath, "NOT JSON AT ALL\n");
    const a = op.verifyLedger();
    assert.equal(a.ok, false, "garbage ledger must NOT be ok");
    assert.equal(a.code, "malformed");
  }
  // (b) middle-line deletion -> chain-broken.
  {
    const w = tmp(); const op = await mk(w);
    const lines = rf(op.ledgerPath, "utf8").trim().split("\n");
    writeFileSync(op.ledgerPath, [lines[0], lines[2]].join("\n") + "\n");
    const a = op.verifyLedger();
    assert.equal(a.ok, false); assert.equal(a.code, "chain-broken");
  }
  // (c) TAIL deletion -> chain-broken via the head sidecar (a pure parent-hash
  //     chain cannot see this).
  {
    const w = tmp(); const op = await mk(w);
    const lines = rf(op.ledgerPath, "utf8").trim().split("\n");
    writeFileSync(op.ledgerPath, lines.slice(0, 2).join("\n") + "\n");
    const a = op.verifyLedger();
    assert.equal(a.ok, false, "tail deletion detected"); assert.equal(a.code, "chain-broken");
  }
  // (d) whole-file deletion with the sidecar present -> chain-broken, not "missing".
  {
    const w = tmp(); const op = await mk(w);
    rmSync(op.ledgerPath);
    const a = op.verifyLedger();
    assert.equal(a.ok, false, "deleted ledger with surviving sidecar detected"); assert.equal(a.code, "chain-broken");
  }
  // (e) reorder -> chain-broken.
  {
    const w = tmp(); const op = await mk(w);
    const lines = rf(op.ledgerPath, "utf8").trim().split("\n");
    writeFileSync(op.ledgerPath, [lines[1], lines[0], lines[2]].join("\n") + "\n");
    const a = op.verifyLedger();
    assert.equal(a.ok, false); assert.equal(a.code, "chain-broken");
  }
  // (f) truncation mid-line -> malformed.
  {
    const w = tmp(); const op = await mk(w);
    const raw = rf(op.ledgerPath, "utf8");
    writeFileSync(op.ledgerPath, raw.slice(0, raw.length - 25));
    const a = op.verifyLedger();
    assert.equal(a.ok, false); assert.equal(a.code, "malformed");
  }
  // (g) fresh operator, never-created ledger -> ok with code "missing".
  {
    const w = tmp();
    const op = createOperator({ workdir: w, rulebook: [], bounds: {}, actions: {} });
    assert.deepEqual(op.verifyLedger(), { ok: true, total: 0, invalid: 0, code: "missing", errors: [] });
  }
  // (h) crash-window heal-forward: sidecar one behind a valid chain -> ok (healed).
  {
    const w = tmp(); const op = await mk(w);
    const path_ = await import("node:path");
    const headPath = path_.join(w, "ops-ledger.head.json");
    const lines = rf(op.ledgerPath, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    writeFileSync(headPath, JSON.stringify({ sequence: 2, entry_hash: entryHash(lines[1]) }) + "\n");
    const a = op.verifyLedger();
    assert.equal(a.ok, true, "one-behind sidecar heals forward for a verified chain");
    const healed = JSON.parse(rf(headPath, "utf8"));
    assert.equal(healed.sequence, 3, "sidecar healed to the true head");
  }
  // (i) held lock -> append refuses (single-writer invariant).
  {
    const w = tmp(); const op = await mk(w, 1);
    writeFileSync(op.ledgerPath + ".lock", "");
    await assert.rejects(() => op.runPass({}), /lock held/);
  }
  // (j) legacy chainless entries -> distinct failure, and append refuses to extend.
  {
    const w = tmp(); const op = await mk(w, 1);
    const line = JSON.parse(rf(op.ledgerPath, "utf8").trim());
    const { sequence, parent_hash, ...legacy } = line;
    writeFileSync(op.ledgerPath, JSON.stringify(legacy) + "\n");
    rmSync(w + "/ops-ledger.head.json", { force: true });
    const a = op.verifyLedger();
    assert.equal(a.ok, false); assert.equal(a.code, "legacy-chainless");
    await assert.rejects(() => op.runPass({}), /not clean/);
  }
}

// 7. runPass hardening: act/bounds throws are ledgered with distinct outcomes;
//    a throwing bound HALTS without executing; unserializable results stay executed.
{
  const { readFileSync: rf } = await import("node:fs");
  // (a) act() throws -> act-error recorded, pass continues to the next rule.
  {
    const w = tmp(); const ran = [];
    const op = createOperator({
      workdir: w,
      rulebook: [
        { id: "boom", when: () => true, act: () => { throw new Error("act exploded"); } },
        { id: "good", when: () => true, act: () => ({ action: "x", args: {} }) }
      ],
      bounds: { x: () => true }, actions: { x: async () => { ran.push(1); return {}; } }
    });
    const r = await op.runPass({});
    assert.equal(r.halted, false);
    assert.equal(ran.length, 1, "later rule still ran");
    const outcomes = rf(op.ledgerPath, "utf8").trim().split("\n").map((l) => JSON.parse(l).outcome);
    assert.deepEqual(outcomes, ["act-error", "executed"]);
  }
  // (b) bounds() throws -> bounds-error + needs-human + HALT, action never executed.
  {
    const w = tmp(); const ran = [];
    const op = createOperator({
      workdir: w,
      rulebook: [{ id: "r", when: () => true, act: () => ({ action: "x", args: {} }) }],
      bounds: { x: () => { throw new Error("bound exploded"); } },
      actions: { x: async () => { ran.push(1); } }
    });
    const r = await op.runPass({});
    assert.equal(r.halted, true);
    assert.match(r.reason, /bounds-error/);
    assert.equal(ran.length, 0, "a throwing bound never authorizes execution");
    const line = JSON.parse(rf(op.ledgerPath, "utf8").trim());
    assert.equal(line.outcome, "bounds-error");
    assert.equal(renderInbox(w).open, 1, "needs-human recorded");
  }
  // (c) circular action result -> still 'executed' (summarize is total).
  {
    const w = tmp();
    const circular = {}; circular.self = circular;
    const op = createOperator({
      workdir: w,
      rulebook: [{ id: "r", when: () => true, act: () => ({ action: "x", args: {} }) }],
      bounds: { x: () => true }, actions: { x: async () => circular }
    });
    const r = await op.runPass({});
    assert.equal(r.halted, false);
    const line = JSON.parse(rf(op.ledgerPath, "utf8").trim());
    assert.equal(line.outcome, "executed", "serialization never flips executed to error");
    assert.match(line.result_summary, /unserializable/);
  }
}

// 8. Inbox: {id, resolution} lines CLOSE the original record; corruption throws.
{
  const { appendFileSync: af, writeFileSync: wf } = await import("node:fs");
  const path_ = await import("node:path");
  {
    const w = tmp();
    const op = createOperator({
      workdir: w,
      rulebook: [{ id: "r", when: () => true, act: () => ({ action: "x", args: {} }) }],
      bounds: {}, actions: {}
    });
    await op.runPass({});
    assert.equal(renderInbox(w).open, 1);
    const rec = JSON.parse((await import("node:fs")).readFileSync(op.inboxPath, "utf8").trim());
    af(op.inboxPath, JSON.stringify({ id: rec.id, resolution: "approved: do it" }) + "\n");
    assert.equal(renderInbox(w).open, 0, "resolution line closes the original request");
  }
  {
    const w = tmp();
    wf(path_.join(w, "needs-human.jsonl"), "GARBAGE\n");
    assert.throws(() => renderInbox(w), /inbox corrupt/, "corrupt inbox throws, never renders empty");
  }
}

// 9. Corrupt operator keys THROW (silent regeneration would orphan signed lines).
{
  const { writeFileSync: wf, mkdirSync: mkd } = await import("node:fs");
  const path_ = await import("node:path");
  const w = tmp();
  mkd(w, { recursive: true });
  wf(path_.join(w, "operator-keys.json"), "{corrupt");
  assert.throws(
    () => createOperator({ workdir: w, rulebook: [], bounds: {}, actions: {} }),
    /corrupt\/unreadable/
  );
}

console.log("test-operator: all assertions passed");
