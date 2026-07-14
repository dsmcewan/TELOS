// council.mjs — dynamic-workflow council orchestrator for TELOS.
//
// The council is a FAN-OUT: each model "seat" independently produces its packet,
// and every packet is HMAC-signed + stamped with provenance from the response
// that produced it. This is the dynamic-workflow layer the gate then validates —
// packets are GENERATED, not hand-authored. The seat caller is injected
// (keyless/testable); liveSeatCaller wires it to ai-peer-mcp.
//
// DYNAMIC SIZING — how TELOS decides how many agents to run per job:
//   - planSeats(dossier) computes the roster FROM the job: required approval
//     seats always; a market-bound job adds one market-lens seat per required
//     workstream; grok rides as advisory. Bigger / market-bound jobs => more
//     seats. So the agent count is a function of the dossier, not a fixed roster.
//   - runCouncil runs the seats through a CPU-aware BOUNDED POOL (never more than
//     min(requested, cores-2) at once), mirroring the workflow engine's cap, so a
//     large fan-out cannot thrash the host.
//
// The convergence step (loop-until-converged + adversarial verify) is the
// existing engine: ../breakout/breakout.mjs (runBreakout / makeCouncilBreakout),
// decided by ../breakout/verifier.mjs.

import os from "node:os";
import { signPacket, secretFor } from "./sign.mjs";
import { normalizeLegacyHardStops } from "./concerns.mjs";

const REQUIRED_SEATS = ["claude", "agy", "codex"];

/**
 * Resource-aware concurrency cap: never run more seats at once than the host can
 * bear. `requested` is clamped to [1, cores-2]; absent/non-positive => host cap.
 */
export function maxConcurrency(requested) {
  const hostCap = Math.max(1, os.cpus().length - 2);
  const want = Number.isInteger(requested) && requested > 0 ? requested : hostCap;
  return Math.min(want, hostCap);
}

/**
 * Decide the council roster for a job FROM the dossier — this is how TELOS sizes
 * the council per job. Required approval seats always; market-bound jobs add one
 * market-lens seat per required workstream; grok is advisory.
 */
export function planSeats(dossier) {
  const seats = REQUIRED_SEATS.map((model) => ({ model, role: "approver" }));
  seats.push({ model: "grok", role: "advisory" });
  // Gemini rides as advisory — a fourth perspective (independent verification), never
  // gate-required (REQUIRED_SEATS/REQUIRED_MODELS unchanged), so a missing GEMINI key
  // never blocks the gate.
  seats.push({ model: "gemini", role: "advisory" });
  if (dossier && dossier.market_bound === true) {
    const workstreams = Array.isArray(dossier.required_market_workstreams) ? dossier.required_market_workstreams : [];
    for (const ws of workstreams) seats.push({ model: "claude", role: "market-lens", workstream: ws });
  }
  return seats;
}

// One seat: call it, sign + provenance-stamp the packet, never throw.
// `context` (proposal-lifecycle) injects the trusted proposal_ref / review-input bindings and
// normalizes any legacy hard_stops into typed concerns — BOTH before signing, so the HMAC covers
// them (sign.mjs canonicalize signs the whole packet).
async function runSeat(seat, callSeat, dossier, context = null) {
  try {
    const ctx = context && context.invocations ? context.invocations.find((iv) => iv.seat === seat.model && (iv.role == null || iv.role === seat.role) && (iv.workstream == null || iv.workstream === seat.workstream)) : null;
    const out = (await callSeat({ model: seat.model, role: seat.role, workstream: seat.workstream, dossier, context: ctx })) || {};
    if (!out.packet || typeof out.packet !== "object") {
      return { model: seat.model, role: seat.role, ok: false, reason: "seat returned no packet" };
    }
    let stamped = { ...out.packet, provenance: out.provenance || out.packet.provenance };
    if (ctx) {
      if (typeof ctx.proposal_ref === "string") stamped.proposal_ref = ctx.proposal_ref;
      if (typeof ctx.review_input_hash === "string") stamped.review_input_hash = ctx.review_input_hash;
      if (typeof ctx.review_manifest_ref === "string") stamped.review_manifest_ref = ctx.review_manifest_ref;
      if (typeof ctx.review_call_ref === "string") stamped.review_call_ref = ctx.review_call_ref;
    }
    if (dossier && dossier.proposal_lifecycle === true) {
      stamped = normalizeLegacyHardStops(stamped, context && context.writeArtifact ? { writeArtifact: context.writeArtifact } : {}).packet;
    }
    const secret = secretFor(seat.model);
    const packet = secret ? signPacket(stamped, secret) : stamped;
    return { model: seat.model, role: seat.role, ok: true, signed: !!secret, packet };
  } catch (error) {
    return { model: seat.model, role: seat.role, ok: false, reason: error?.message || String(error) };
  }
}

/**
 * Fan out the council through a CPU-aware bounded pool. Results preserve seat
 * order. A thrown/empty seat becomes { ok:false, reason } (never a rejection).
 * Pass `seats` explicitly, or omit to derive them from the dossier via planSeats.
 */
export async function runCouncil({ seats, callSeat, dossier, maxConcurrency: requested, context = null } = {}) {
  const list = Array.isArray(seats) ? seats : planSeats(dossier);
  const limit = maxConcurrency(requested);
  const results = new Array(list.length);
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const i = next++;
      results[i] = await runSeat(list[i], callSeat, dossier, context);
    }
  }
  const poolSize = Math.min(limit, list.length);
  await Promise.all(Array.from({ length: poolSize > 0 ? poolSize : 0 }, () => worker()));
  return results;
}

/**
 * Build a seat caller backed by an MCP client (LIVE transport). Each seat binds
 * its packet to its OWN real provenance — no seat borrows another model's id:
 *   - chat seats (claude/grok/codex) call `<model>_ask` with
 *     `include_provenance: true`, so the server returns a {text, provenance}
 *     envelope carrying the real server-issued model + response_id.
 *   - structured seats (agy) call `agy_checkpoint`; the checkpoint already
 *     embeds a local-deterministic attestation as its provenance.
 * If the response carries NO structured provenance (e.g. a tool that does not
 * honor include_provenance), `response_id` is set to null and the gate blocks.
 * We deliberately do NOT scrape an id out of the model's own prose: a
 * model-authored token is not authentication, so honest-null (fail-closed) is
 * the only safe fallback — never a fabricated/self-asserted id.
 *
 *   client     { callTool(name, args) -> Promise<string> }  (see ../breakout/mcp_client.mjs)
 *   promptFor  (model, role, dossier, workstream) -> { tool, prompt?, system?, model?, args? }
 *              chat seats return prompt/system (and optionally a per-seat model);
 *              structured seats return args.
 *   parsePacket(text) -> packet object  (for agy, compose with agyApprovalPacket)
 */
export function liveSeatCaller({ client, promptFor, parsePacket }) {
  return async ({ model, role, workstream, dossier }) => {
    const spec = promptFor(model, role, dossier, workstream) || {};
    const tool = spec.tool;
    // Structured seats pass explicit args; chat seats pass prompt/system (+ an
    // optional per-seat model override) AND ask for the provenance envelope so
    // the packet binds to the real response.
    const callArgs = spec.args
      ? spec.args
      : { prompt: spec.prompt, system: spec.system, model: spec.model, include_provenance: true, response_schema: spec.response_schema, schema_name: spec.schema_name };
    const text = await client.callTool(tool, callArgs);
    const parsed = tryParseJson(text);

    // Provenance: ONLY trust what the server attested/returned. No structured
    // provenance => response_id:null => the gate blocks. Never fabricated.
    const provenance = parsed && parsed.provenance && typeof parsed.provenance === "object"
      ? { ...parsed.provenance, tool }
      : { model, source: "ai-peer-mcp", response_id: null, tool };

    // The ask envelope carries the packet body under `.text`; a structured seat's
    // result IS the packet object itself.
    const packetText = parsed && typeof parsed.text === "string" ? parsed.text : text;
    return { packet: parsePacket(packetText), provenance };
  };
}

function tryParseJson(text) {
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Adapt an `agy_checkpoint` result (a governance object) into a gate-valid
 * approval packet. agy is the local governance seat: it APPROVES iff its
 * checkpoint says `phase_gate_status === "advance"`; otherwise it returns a
 * `revise` decision carrying the checkpoint's blocked_reasons as hard_stops (so
 * the gate blocks, as it should). `meta` supplies the dossier-derived fields the
 * gate requires (build_id, use_case, proposal_ref, timestamp, docs_reviewed) —
 * the council fills these from the dossier; provenance is stamped separately by
 * runSeat from the checkpoint's attestation.
 */
// Protected-path prefixes the gate treats as off-limits (mirror of gate.mjs's
// DEFAULT_PROTECTED_PATHS), kept here so the council can DERIVE agy's checkpoint
// inputs from the dossier instead of asserting them.
const DEFAULT_PROTECTED_PATHS = ["CHATGPT/", "me/claude-code/", "me/claude-desktop/", "me/gemini/"];

function normalizeGovPath(p) {
  return String(p).replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

/**
 * Build the agy_checkpoint inputs for a merge-gate governance check FROM the
 * dossier rather than asserting them. The prior wiring hardcoded
 * `present_packets == required_packets` and `protected_path_check: "pass"`, so
 * agyCheckpoint could only ever return "advance" — a REQUIRED governance seat
 * reduced to a constant approve, with its documented blocking path dead. Here:
 *   - protected_path_check is DERIVED: "pass" only when no declared write target
 *     falls under a protected prefix; otherwise a fail reason (agy dissents).
 *   - lexi_required / lexi_reference_read pass through so agy blocks an unmet LEXI.
 *   - packet PRESENCE is NOT asserted — the concurrent council can't know it at
 *     agy's call time, and the gate independently requires every seat's packet.
 */
export function agyCheckpointArgs(dossier, scope) {
  const protectedPaths = [...DEFAULT_PROTECTED_PATHS, ...(Array.isArray(dossier?.protected_paths) ? dossier.protected_paths : [])]
    .map(normalizeGovPath)
    .filter(Boolean);
  let violation = null;
  for (const target of Array.isArray(dossier?.write_targets) ? dossier.write_targets : []) {
    const t = normalizeGovPath(target);
    if (protectedPaths.some((p) => t === p || t.startsWith(p + "/"))) { violation = target; break; }
  }
  return {
    phase: "merge-gate",
    scope: scope ?? dossier?.use_case ?? "",
    protected_path_check: violation ? `not-pass: write target '${violation}' is under a protected path` : "pass",
    lexi_required: dossier?.lexi_required === true,
    lexi_reference_read: dossier?.lexi_reference_read === true
  };
}

export function agyApprovalPacket(checkpoint, meta = {}) {
  const advance = !!checkpoint && checkpoint.phase_gate_status === "advance";
  const blocked = Array.isArray(checkpoint?.blocked_reasons) ? checkpoint.blocked_reasons : [];
  return {
    build_id: meta.build_id,
    use_case: meta.use_case,
    model: "agy",
    role: "approver",
    docs_reviewed: Array.isArray(meta.docs_reviewed) ? meta.docs_reviewed : [],
    proposal_ref: meta.proposal_ref,
    decision: advance ? "approve" : "revise",
    required_edits: [],
    hard_stops: advance ? [] : blocked,
    confidence: "high",
    timestamp: meta.timestamp
  };
}
