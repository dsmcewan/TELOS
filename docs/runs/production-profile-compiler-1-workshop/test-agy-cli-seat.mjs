#!/usr/bin/env node
// agy CLI seat suite — a fake `agy` script stands in for the closed-source
// binary; no Antigravity invocation, no subscription spend.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  callAgyCli,
  makeAgyChallenger,
  makeAgyReferee,
  AGY_DEFAULT_MODEL
} from "./agy-cli-seat.mjs";

function fakeAgy(root, { stdoutBody, exitCode = 0, stderrBody = "" }) {
  const binPath = path.join(root, "fake-agy");
  const argsFile = path.join(root, "argv.lines");
  const stdinFile = path.join(root, "stdin.txt");
  const stdoutFile = path.join(root, "canned-stdout.txt");
  const stderrFile = path.join(root, "canned-stderr.txt");
  writeFileSync(stdoutFile, stdoutBody);
  writeFileSync(stderrFile, stderrBody);
  writeFileSync(binPath, [
    "#!/bin/bash",
    `printf '%s\\n' "$@" > ${JSON.stringify(argsFile)}`,
    `cat > ${JSON.stringify(stdinFile)}`,
    `cat ${JSON.stringify(stderrFile)} >&2`,
    `cat ${JSON.stringify(stdoutFile)}`,
    `exit ${exitCode}`
  ].join("\n"));
  chmodSync(binPath, 0o755);
  return {
    binPath,
    argv: () => readFileSync(argsFile, "utf8").trim().split("\n"),
    stdin: () => readFileSync(stdinFile, "utf8")
  };
}

async function withTemp(fn) {
  const root = mkdtempSync(path.join(tmpdir(), "agy-seat-"));
  try {
    return await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// Case 1: prompt travels over stdin, never argv; args carry model + print mode
await withTemp(async (root) => {
  const fake = fakeAgy(root, { stdoutBody: "plain answer" });
  const result = await callAgyCli(
    { prompt: "long prompt with \"quotes\" and {json}", system: "SYSTEM PREAMBLE" },
    { bin: fake.binPath, env: {} }
  );
  const argv = fake.argv();
  assert.ok(argv.includes("--model"));
  assert.ok(argv.includes(AGY_DEFAULT_MODEL));
  assert.ok(argv.includes("--print"));
  assert.ok(!argv.some((arg) => arg.includes("long prompt")), "prompt must not ride argv");
  const stdin = fake.stdin();
  assert.ok(stdin.startsWith("SYSTEM PREAMBLE\n\nlong prompt"));
  assert.equal(result.text, "plain answer");
  console.log("Case 1 OK: prompt rides stdin; argv carries only flags");
});

// Case 2: provenance is content-addressed and recomputable from the evidence
await withTemp(async (root) => {
  const fake = fakeAgy(root, { stdoutBody: "the reply" });
  const result = await callAgyCli({ prompt: "q" }, { bin: fake.binPath, env: {} });
  const expected = `agy-${createHash("sha256")
    .update(JSON.stringify({ model: AGY_DEFAULT_MODEL, prompt: "q", text: "the reply" }), "utf8")
    .digest("hex")}`;
  assert.equal(result.provenance.response_id, expected);
  assert.equal(result.provenance.source, "antigravity-cli");
  assert.equal(result.provenance.provider, "google");
  console.log("Case 2 OK: response id recomputes from {model, prompt, text}");
});

// Case 3: schema mode parses strict JSON; fences or prose throw
await withTemp(async (root) => {
  const good = fakeAgy(root, { stdoutBody: "{\"verdict\":\"accepted\",\"objections\":[],\"empty_list_attestation\":\"genuinely-found-nothing\"}" });
  const parsed = await callAgyCli({ prompt: "q", schema: { type: "object" } }, { bin: good.binPath, env: {} });
  assert.equal(parsed.json.verdict, "accepted");
  const stdin = good.stdin();
  assert.ok(stdin.includes("Respond ONLY with a single JSON object"));
});
await withTemp(async (root) => {
  const fenced = fakeAgy(root, { stdoutBody: "```json\n{\"verdict\":\"accepted\"}\n```" });
  await assert.rejects(
    () => callAgyCli({ prompt: "q", schema: { type: "object" } }, { bin: fenced.binPath, env: {} }),
    /not the single JSON object/
  );
  console.log("Case 3 OK: schema mode is strict — fenced output throws, never repaired");
});

// Case 4: nonzero exit and empty output fail loud
await withTemp(async (root) => {
  const failing = fakeAgy(root, { stdoutBody: "", exitCode: 3, stderrBody: "Please sign in to view available models." });
  await assert.rejects(
    () => callAgyCli({ prompt: "q" }, { bin: failing.binPath, env: {} }),
    /Please sign in/
  );
});
await withTemp(async (root) => {
  const empty = fakeAgy(root, { stdoutBody: "   " });
  await assert.rejects(
    () => callAgyCli({ prompt: "q" }, { bin: empty.binPath, env: {} }),
    /empty output/
  );
  console.log("Case 4 OK: CLI failures and empty replies throw with the real detail");
});

// Case 5: missing binary produces the actionable install/sign-in error
{
  await assert.rejects(
    () => callAgyCli({ prompt: "q" }, { bin: "/nonexistent/agy-binary", env: {} }),
    /binary not found[\s\S]*sign in[\s\S]*DAEDALUS_V2_AGY_BIN/
  );
  console.log("Case 5 OK: ENOENT names the fix, not just the failure");
}

// Case 6: challenger factory yields v2-shaped verdicts with attestation default
await withTemp(async (root) => {
  const fake = fakeAgy(root, { stdoutBody: "{\"verdict\":\"denied\",\"objections\":[{\"scope\":\"plan\",\"claim\":\"x\",\"evidence_refs\":[]}]}" });
  const challenger = makeAgyChallenger({ bin: fake.binPath, env: {} });
  const result = await challenger({ plan_text: "PLAN", plan_ref: "sha256:p", round: 1 });
  assert.equal(result.response.verdict, "denied");
  assert.equal(result.response.empty_list_attestation, null, "missing attestation defaults to null");
  assert.match(result.provenance.response_id, /^agy-[0-9a-f]{64}$/);
  const stdin = fake.stdin();
  assert.ok(stdin.includes("re-derive"));
  assert.ok(stdin.includes("\"plan\":\"PLAN\""));
  console.log("Case 6 OK: agy challenger speaks the v2 verdict contract");
});

// Case 7: referee factory sends the ledger, never candidate text, process-only brief
await withTemp(async (root) => {
  const fake = fakeAgy(root, { stdoutBody: "{\"verdict\":\"continue\",\"loop_evidence\":[]}" });
  const referee = makeAgyReferee({ bin: fake.binPath, env: {} });
  const result = await referee({ ledger_view: { rounds: [{ entry_id: "round-1" }] }, round: 2, stage: "plan-challenge" });
  assert.equal(result.response.verdict, "continue");
  const stdin = fake.stdin();
  assert.ok(stdin.includes("never plan content"));
  assert.ok(stdin.includes("round-1"));
  console.log("Case 7 OK: agy referee is process-only over the ledger view");
});

console.log("test-agy-cli-seat.mjs OK");
