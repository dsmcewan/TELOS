#!/usr/bin/env node
import assert from "node:assert/strict";
import os from "node:os";
import { runCouncil, planSeats, maxConcurrency, liveSeatCaller, agyApprovalPacket } from "../council.mjs";
import { verifyPacket } from "../sign.mjs";
import { validateRecords } from "../gate.mjs";
// Cross-package (integration): the agy seat consumes the REAL agy_checkpoint
// output, so the test exercises the actual connector function — no drift.
import { agyCheckpoint, agyAttestation } from "../../connectors/ai-peer-mcp/lib.mjs";

process.env.TELOS_SECRET_CLAUDE = "cs";
process.env.TELOS_SECRET_AGY = "as";
process.env.TELOS_SECRET_CODEX = "ds";

const okSeatCaller = async ({ model }) => ({
  packet: { build_id: "c1", use_case: "u", model, role: "approver", decision: "approve", docs_reviewed: [], required_edits: [], hard_stops: [], proposal_ref: "r", confidence: "high", timestamp: "2026-06-27T00:00:00Z" },
  provenance: { model: `real-${model}`, source: "ai-peer-mcp", response_id: `resp_${model}` }
});

// --- fan-out: signed + provenance-stamped, order preserved ---
{
  const seats = [{ model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" }];
  const results = await runCouncil({ seats, callSeat: okSeatCaller, dossier: { build_id: "c1" } });
  assert.equal(results.length, 3);
  assert.deepEqual(results.map((r) => r.model), ["claude", "agy", "codex"], "results preserve seat order");
  for (const r of results) {
    assert.equal(r.ok, true, `${r.model} should succeed`);
    assert.equal(r.signed, true, `${r.model} should be signed`);
    assert.ok(r.packet.signature, "packet must carry a signature");
    assert.ok(r.packet.provenance.response_id.startsWith("resp_"), "provenance preserved");
    const secret = { claude: "cs", agy: "as", codex: "ds" }[r.model];
    assert.equal(verifyPacket(r.packet, secret).ok, true, "signed packet must verify");
  }
}

// --- failure handling: thrown / empty seat -> ok:false (never a rejection) ---
{
  const boom = await runCouncil({ seats: [{ model: "claude" }], callSeat: async () => { throw new Error("seat down"); }, dossier: {} });
  assert.equal(boom[0].ok, false);
  assert.match(boom[0].reason, /seat down/);
  const empty = await runCouncil({ seats: [{ model: "claude" }], callSeat: async () => ({}), dossier: {} });
  assert.equal(empty[0].ok, false);
  assert.match(empty[0].reason, /no packet/);
}

// --- planSeats: roster sized FROM the job ---
{
  const simple = planSeats({ build_id: "x" });
  assert.deepEqual(simple.map((s) => s.model), ["claude", "agy", "codex", "grok", "gemini"], "non-market job = required seats + grok & gemini advisory");
  assert.equal(simple.find((s) => s.model === "grok").role, "advisory");
  assert.equal(simple.find((s) => s.model === "gemini").role, "advisory", "gemini rides as advisory, never gate-required");

  const market = planSeats({ build_id: "x", market_bound: true, required_market_workstreams: ["backend-schema", "security-trust"] });
  assert.equal(market.length, 7, "market-bound job adds one lens seat per workstream (5 base + 2 lenses)");
  const lenses = market.filter((s) => s.role === "market-lens");
  assert.deepEqual(lenses.map((s) => s.workstream), ["backend-schema", "security-trust"]);
}

// --- runCouncil derives seats from the dossier when seats omitted ---
{
  const derived = await runCouncil({ callSeat: okSeatCaller, dossier: { build_id: "c1" } });
  assert.deepEqual(derived.map((r) => r.model), ["claude", "agy", "codex", "grok", "gemini"], "omitted seats => planSeats(dossier)");
}

// --- maxConcurrency: clamped to [1, cores-2] ---
{
  const hostCap = Math.max(1, os.cpus().length - 2);
  assert.equal(maxConcurrency(1), Math.min(1, hostCap), "explicit small request honored");
  assert.equal(maxConcurrency(10_000), hostCap, "huge request clamped to host cap");
  assert.equal(maxConcurrency(undefined), hostCap, "absent => host cap");
  assert.equal(maxConcurrency(0), hostCap, "non-positive => host cap");
}

// --- bounded pool: peak concurrency never exceeds the cap, all seats complete ---
{
  let active = 0, peak = 0;
  const tracking = async ({ model }) => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return okSeatCaller({ model });
  };
  const limit = maxConcurrency(2);
  const seats = Array.from({ length: 6 }, (_, i) => ({ model: ["claude", "agy", "codex"][i % 3], role: "approver" }));
  const results = await runCouncil({ seats, callSeat: tracking, dossier: {}, maxConcurrency: 2 });
  assert.equal(results.length, 6, "all seats complete under the cap");
  assert.ok(peak <= limit, `peak concurrency ${peak} must not exceed cap ${limit}`);
  assert.ok(peak >= Math.min(2, limit), `pool should parallelize up to the cap (peak=${peak}, limit=${limit})`);
}

// --- liveSeatCaller: every seat binds to its OWN real provenance (no borrowing) ---
// codex -> codex_ask (real OpenAI response id), agy -> agy_checkpoint (local
// attestation). This is the wiring that retires the recursion-run residual where
// agy/codex shared claude's council response_id.
{
  const packetFor = (model) => JSON.stringify({
    build_id: "live1", use_case: "u", model, role: "approver", decision: "approve",
    docs_reviewed: [], required_edits: [], hard_stops: [], proposal_ref: "r",
    confidence: "high", timestamp: "2026-06-27T00:00:00Z"
  });

  // Fake MCP client returning the exact text shapes the real server returns:
  // ask tools (with include_provenance) -> {text, provenance} envelope;
  // agy_checkpoint -> the checkpoint with an embedded local-deterministic attestation.
  const fakeClient = {
    async callTool(tool, args) {
      if (tool === "claude_ask") {
        assert.equal(args.include_provenance, true, "chat seats must request the provenance envelope");
        return JSON.stringify({ text: packetFor("claude"), provenance: { model: "claude-sonnet-4-6", response_id: "msg_live_claude", source: "ai-peer-mcp/claude_ask" } });
      }
      if (tool === "codex_ask") {
        assert.equal(args.include_provenance, true, "chat seats must request the provenance envelope");
        return JSON.stringify({ text: packetFor("codex"), provenance: { model: "gpt-4o-2024-08-06", response_id: "chatcmpl_live_codex", source: "ai-peer-mcp/codex_ask" } });
      }
      if (tool === "agy_checkpoint") {
        return JSON.stringify({
          build_id: "live1", use_case: "u", model: "agy", role: "approver", decision: "approve",
          docs_reviewed: [], required_edits: [], hard_stops: [], proposal_ref: "r",
          confidence: "high", timestamp: "2026-06-27T00:00:00Z",
          provenance: { model: "agy-checkpoint", response_id: "agy-0123456789abcdef0123456789abcdef01234567", source: "ai-peer-mcp/agy_checkpoint", attestation: "local-deterministic", engine_version: "agy-checkpoint/1" }
        });
      }
      throw new Error(`unexpected tool ${tool}`);
    }
  };

  const promptFor = (model) => model === "agy"
    ? { tool: "agy_checkpoint", args: { phase: "p", scope: "s" } }
    : { tool: `${model}_ask`, prompt: "objective", system: "sys" };

  const callSeat = liveSeatCaller({ client: fakeClient, promptFor, parsePacket: (t) => JSON.parse(t) });
  const seats = [{ model: "claude", role: "approver" }, { model: "agy", role: "approver" }, { model: "codex", role: "approver" }];
  const results = await runCouncil({ seats, callSeat, dossier: { build_id: "live1" } });

  const placeholder = /^$|_self$|^self$|placeholder/i; // the gate's reject filter

  const codex = results.find((r) => r.model === "codex");
  assert.equal(codex.ok, true, "codex seat should succeed");
  assert.equal(codex.packet.model, "codex", "codex packet parsed from the envelope text");
  assert.equal(codex.packet.provenance.response_id, "chatcmpl_live_codex", "codex binds to its OWN OpenAI response id");
  assert.equal(codex.packet.provenance.model, "gpt-4o-2024-08-06", "codex provenance carries the real OpenAI model");
  assert.equal(codex.packet.provenance.tool, "codex_ask", "codex provenance records the tool used");
  assert.ok(!placeholder.test(codex.packet.provenance.response_id), "codex id passes the gate placeholder filter");

  const agy = results.find((r) => r.model === "agy");
  assert.equal(agy.ok, true, "agy seat should succeed");
  assert.match(agy.packet.provenance.response_id, /^agy-[0-9a-f]{40}$/, "agy carries its OWN content-addressed attestation id");
  assert.equal(agy.packet.provenance.attestation, "local-deterministic");
  assert.ok(!placeholder.test(agy.packet.provenance.response_id), "agy id passes the gate placeholder filter");

  const claude = results.find((r) => r.model === "claude");
  assert.equal(claude.packet.provenance.response_id, "msg_live_claude", "claude binds to its own response id");

  // The borrowing the residual called out is gone: every seat has a DISTINCT id.
  const ids = results.map((r) => r.packet.provenance.response_id);
  assert.equal(new Set(ids).size, ids.length, "every seat has a distinct provenance id (no borrowing)");

  // Seats are still signed + verifiable (provenance wiring didn't break signing).
  for (const r of results) {
    const secret = { claude: "cs", agy: "as", codex: "ds" }[r.model];
    assert.equal(verifyPacket(r.packet, secret).ok, true, `${r.model} signed packet must verify`);
  }
}

// --- liveSeatCaller fail-closed: a response with NO structured provenance gets
// response_id:null, NEVER an id scraped from the model's own prose. A model that
// emits "response_id: msg_legit_123" must not thereby authenticate itself. ---
{
  const proseClient = {
    async callTool() {
      // A bare prose response that even *contains* a plausible id token — which
      // must be ignored (it is model-authored, not server-issued).
      return 'decision approved. response_id: msg_attacker_chose_this .';
    }
  };
  const callSeat = liveSeatCaller({
    client: proseClient,
    promptFor: () => ({ tool: "claude_ask", prompt: "p", system: "s" }),
    parsePacket: () => ({ build_id: "p1", model: "claude", role: "approver", decision: "approve", docs_reviewed: [], required_edits: [], hard_stops: [], proposal_ref: "r", confidence: "high", timestamp: "2026-06-27T00:00:00Z" })
  });
  const [r] = await runCouncil({ seats: [{ model: "claude", role: "approver" }], callSeat, dossier: {} });
  assert.equal(r.ok, true, "prose seat still yields a packet (no throw)");
  assert.equal(r.packet.provenance.response_id, null, "no structured provenance => response_id null (gate blocks; never scraped from prose)");
}

// --- I-2 end-to-end: the REAL agy_checkpoint output becomes a gate-valid
// approval packet (not just provenance-correct). Proves the agy seat works end
// to end, using the actual agyCheckpoint function + the agyApprovalPacket adapter
// + the gate's own validateRecords. ---
{
  const meta = {
    build_id: "e2e1", use_case: "telos-self-upgrade", proposal_ref: "e2e1",
    timestamp: "2026-06-27T00:00:00Z", docs_reviewed: ["spec.md"]
  };

  // The exact text the server returns for agy_checkpoint: the real checkpoint
  // with its embedded local-deterministic attestation.
  const advanceCheckpoint = agyCheckpoint({ required_packets: ["x"], present_packets: ["x"], protected_path_check: "pass" });
  assert.equal(advanceCheckpoint.phase_gate_status, "advance", "checkpoint should advance");
  const serverText = JSON.stringify({ ...advanceCheckpoint, provenance: agyAttestation(advanceCheckpoint) });

  const callSeat = liveSeatCaller({
    client: { async callTool() { return serverText; } },
    promptFor: () => ({ tool: "agy_checkpoint", args: { required_packets: ["x"], present_packets: ["x"], protected_path_check: "pass" } }),
    // production wiring: parse the checkpoint, then adapt it into an approval packet.
    parsePacket: (t) => agyApprovalPacket(JSON.parse(t), meta)
  });

  const [agyResult] = await runCouncil({ seats: [{ model: "agy", role: "approver" }], callSeat, dossier: { build_id: "e2e1" } });
  assert.equal(agyResult.ok, true, "agy seat should succeed");
  const agyPkt = agyResult.packet;

  // The adapter produced every field validatePacketShape requires.
  for (const f of ["build_id", "use_case", "model", "role", "docs_reviewed", "proposal_ref", "decision", "required_edits", "hard_stops", "confidence", "timestamp"]) {
    assert.ok(agyPkt[f] !== undefined, `agy packet missing gate-required field '${f}'`);
  }
  assert.equal(agyPkt.decision, "approve", "advance checkpoint => decision approve");
  assert.equal(agyPkt.provenance.attestation, "local-deterministic", "agy packet carries its own attestation");
  assert.match(agyPkt.provenance.response_id, /^agy-[0-9a-f]{40}$/);

  // The gate ITSELF accepts the agy packet (no agy shape/decision blockers).
  const dossier = { build_id: "e2e1", use_case: "telos-self-upgrade", objective: "o", required_docs: ["spec.md"], write_targets: [], protected_paths: [] };
  const mkApprover = (model) => ({ build_id: "e2e1", use_case: "telos-self-upgrade", model, role: "approver", docs_reviewed: ["spec.md"], proposal_ref: "e2e1", decision: "approve", required_edits: [], hard_stops: [], confidence: "high", timestamp: "2026-06-27T00:00:00Z" });
  const report = validateRecords(dossier, [agyPkt, mkApprover("claude"), mkApprover("codex")]);
  const agyBlockers = report.blockers.filter((b) => /agy/i.test(b));
  assert.deepEqual(agyBlockers, [], `agy packet must raise no gate blockers; got: ${JSON.stringify(agyBlockers)}`);

  // A BLOCKED checkpoint must NOT approve (fail-closed governance).
  const blockedCheckpoint = agyCheckpoint({ required_packets: ["a", "b"], present_packets: ["a"] });
  const blockedPkt = agyApprovalPacket(blockedCheckpoint, meta);
  assert.equal(blockedPkt.decision, "revise", "blocked checkpoint => decision NOT approve");
  assert.ok(blockedPkt.hard_stops.length > 0, "blocked checkpoint carries hard_stops");
  const blockedReport = validateRecords(dossier, [blockedPkt, mkApprover("claude"), mkApprover("codex")]);
  assert.ok(blockedReport.blockers.some((b) => /agy/i.test(b)), "a blocked agy checkpoint must block the gate");
}

console.log("test-council-orchestrator.mjs OK");
