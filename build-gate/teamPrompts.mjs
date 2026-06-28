// teamPrompts.mjs — LIVE wiring for the agentic teams over ai-peer-mcp.
//
// The orchestrator (build-orchestrator.mjs) is transport-agnostic: it takes an
// injected `callSeat` (council approval + Planning-team decompose) and `callTeam`
// (build execution). This module builds all of them over a minimal MCP client
// (../breakout/mcp_client.mjs), giving each team its own system prompt. It is
// opt-in: a seat with no API key fail-closes (the server returns no provenance →
// the gate honest-blocks), mirroring the existing `smoke` scripts. The pure
// prompt/parse helpers are unit-tested without a network.

import { agyApprovalPacket } from "./council.mjs";

// Chat seats expose an `<model>_ask` tool; agy is structured (no code generation).
const ASK_MODELS = new Set(["claude", "grok", "codex"]);
const VALID_DECISIONS = new Set(["approve", "revise", "reject", "advisory-note"]);
const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);

// Robustly pull the first {...} or [...] JSON value out of a model's answer
// (handles ```json fences and surrounding prose).
export function extractJson(text, open = "{", close = "}") {
  if (typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf(open);
  const end = body.lastIndexOf(close);
  if (start === -1 || end === -1 || end < start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

// A team's buildable lead: the first seat whose model has an _ask tool (so e.g.
// the ops team, led by the structured agy seat, still builds via its codex seat).
export function buildableSeat(team) {
  const seats = team && Array.isArray(team.seats) ? team.seats : [];
  const seat = seats.find((s) => ASK_MODELS.has(s.model));
  return seat ? seat.model : "claude";
}

// System prompt for a team: mission + the strict JSON contract the builder parses.
export function promptForTeam(team) {
  const mission = team && team.mission ? team.mission : "build the requested node";
  return [
    `You are the TELOS "${team?.id ?? "build"}" team. Mission: ${mission}.`,
    "You implement EXACTLY one task node. You see only its spec — never the wider plan.",
    "Return ONLY a JSON object of the form {\"files\":[{\"path\":\"<one of the node's declared files>\",\"content\":\"<file contents>\"}]}.",
    "Write every file the node declares and no others. No prose, no markdown fences."
  ].join(" ");
}

// Build the per-node user prompt from the injected spec (Rule 1: spec only).
// On a retry, `priorFailure` carries THIS node's OWN previous test failure so the
// team can self-correct — still own-node-only, no plan/other-node leak.
export function nodeBuildPrompt(node, priorFailure = null) {
  const lines = [
    `Task id: ${node.id}`,
    `Requirements: ${node.requirements}`,
    `Files to write (exactly these): ${JSON.stringify(node.files)}`
  ];
  if (priorFailure) {
    lines.push(
      "",
      `Your previous attempt FAILED its own test (exit ${priorFailure.status}).`,
      "Test output (truncated):",
      (priorFailure.stderr || priorFailure.stdout || priorFailure.detail || "").trim(),
      "Fix the files so the test passes."
    );
  }
  lines.push("Emit the JSON {files:[...]} now.");
  return lines.join("\n");
}

// Parse a team's response into a files array, CLAMPED to the node's declared
// files (a team cannot write outside its node spec — the orchestrator also
// re-checks path escapes, and Rule-3 verify re-derives the artifact hash).
export function parseTeamFiles(text, node) {
  let parsed;
  try { parsed = typeof text === "string" ? JSON.parse(text) : text; } catch { return []; }
  const body = parsed && typeof parsed.text === "string" ? safeJson(parsed.text) : parsed;
  const files = body && Array.isArray(body.files) ? body.files : [];
  const declared = new Set(node.files || []);
  return files
    .filter((f) => f && typeof f.path === "string" && declared.has(f.path) && typeof f.content === "string")
    .map((f) => ({ path: f.path, content: f.content }));
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

/**
 * Build a live callTeam({team,node,dossier}) over an MCP client. The team's
 * buildable lead is asked to emit the node's files as JSON; the result is parsed
 * and clamped. A response with no usable files becomes a fail-closed decline (the
 * orchestrator turns ok:false into a halt — never a silent empty write).
 *   client { callTool(name, args) -> Promise<string> }  (../breakout/mcp_client.mjs)
 */
export function makeLiveCallTeam({ client }) {
  return async ({ team, node, priorFailure }) => {
    const model = buildableSeat(team);
    const text = await client.callTool(`${model}_ask`, {
      system: promptForTeam(team),
      prompt: nodeBuildPrompt(node, priorFailure),
      include_provenance: true
    });
    const files = parseTeamFiles(text, node);
    if (files.length === 0) {
      return { ok: false, reason: `team ${team.id} (${model}) returned no usable files for ${node.id}` };
    }
    return { files };
  };
}

const PACKET_INSTRUCTION =
  'Return ONLY a JSON object: {"decision":"approve|revise|reject","confidence":"low|medium|high",' +
  '"required_edits":[],"hard_stops":[],"rationale":"one sentence"}. No prose outside the JSON.';

/**
 * Build a promptFor(model, role, dossier, workstream) for liveSeatCaller
 * (council.mjs) so the approval council emits gate-valid JSON packets. agy stays
 * structured (a real agy_checkpoint); chat seats get a strict decision-packet
 * instruction. `models` optionally overrides the per-seat model id (else the
 * server default applies).
 */
export function approvalPromptFor(dossier, { models = {} } = {}) {
  return (model, role, _dossier, workstream) => {
    if (model === "agy") {
      // A real governance checkpoint: required packets present, paths clean.
      return { tool: "agy_checkpoint", args: { phase: "merge-gate", scope: dossier?.use_case ?? "", required_packets: ["claude", "codex"], present_packets: ["claude", "codex"], protected_path_check: "pass" } };
    }
    const lens = workstream ? `, workstream lens: ${workstream}` : "";
    return {
      tool: `${model}_ask`,
      model: models[model],
      system: `You are ${model}, a council ${role} for TELOS${lens}. Judge the objective on the merits. ${PACKET_INSTRUCTION}`,
      prompt: `Objective:\n${dossier?.objective ?? ""}\n\n${PACKET_INSTRUCTION}`
    };
  };
}

/**
 * Turn a seat's response text into a gate-valid approval packet. agy's checkpoint
 * is adapted via agyApprovalPacket; a chat seat's JSON contributes ONLY its
 * judgment (decision/confidence/edits/stops/rationale) while identity fields
 * (build_id/use_case/proposal_ref/timestamp/docs_reviewed) are injected
 * authoritatively from the dossier so a sloppy model can't fail the gate's
 * identity checks. An unparseable answer degrades to a non-approving
 * 'advisory-note' (fail-closed), never a fabricated approve.
 */
export function parseApprovalPacket(text, model, dossier, meta = {}) {
  const direct = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (direct && direct.phase_gate_status) {
    return agyApprovalPacket(direct, { build_id: dossier?.build_id, use_case: dossier?.use_case, proposal_ref: meta.proposal_ref ?? dossier?.build_id, timestamp: meta.timestamp, docs_reviewed: meta.docs_reviewed ?? [] });
  }
  const m = (direct && !direct.phase_gate_status ? direct : extractJson(text)) || {};
  return {
    build_id: dossier?.build_id,
    use_case: dossier?.use_case,
    model,
    role: "approver",
    docs_reviewed: Array.isArray(meta.docs_reviewed) ? meta.docs_reviewed : [],
    proposal_ref: meta.proposal_ref ?? dossier?.build_id,
    decision: VALID_DECISIONS.has(m.decision) ? m.decision : "advisory-note",
    required_edits: Array.isArray(m.required_edits) ? m.required_edits : [],
    hard_stops: Array.isArray(m.hard_stops) ? m.hard_stops : [],
    confidence: VALID_CONFIDENCE.has(m.confidence) ? m.confidence : "medium",
    timestamp: meta.timestamp ?? new Date(0).toISOString(),
    rationale: typeof m.rationale === "string" ? m.rationale : undefined
  };
}

// The Planning team's decompose prompt: ask for a strict JSON task list whose
// nodes carry the footprints + test the merkle-dag planner needs.
export function decomposePrompt(dossier, telos, conventions = null) {
  const system = [
    "You are the TELOS Planning team. Decompose the objective into a build plan.",
    'Return ONLY a JSON array of task objects:',
    '[{"id":"kebab-id","writes":["relative/path"],"reads":["relative/path"],',
    '"requirements":"what this node must satisfy","test":{"cmd":"node","args":["-e","process.exit(0)"]},',
    '"workstream":"backend-schema|frontend-brand-experience|security-trust|scale-operations|product-architecture"}].',
    "One writer per file. Declare reads for cross-file dependencies. No prose outside the JSON."
  ].join(" ");
  // Project sense: if the real project has a test command, steer node tests toward it.
  const conventionLine = conventions?.testCmd
    ? `\n\nThis is an existing project; its real test command is "${conventions.testCmd}". Prefer node tests that invoke it (e.g. {"cmd":"npm","args":["test"]}) over a no-op.`
    : "";
  const prompt = `Objective:\n${dossier?.objective ?? ""}\n\nTelos statement:\n${telos ?? ""}${conventionLine}\n\nEmit the JSON task array now.`;
  return { system, prompt };
}

// Parse a decompose response into a raw task array (validation/normalization is
// the job of decompose.mjs, which is fail-closed on anything unusable).
export function parseDecomposeTasks(text) {
  const arr = extractJson(text, "[", "]");
  return Array.isArray(arr) ? arr : [];
}

/**
 * Build the full live callSeat for buildProject over an MCP client: it routes
 * intent==="decompose" to the Planning team's lead and everything else to the
 * approval council. signing/provenance are handled by runCouncil/liveSeatCaller
 * downstream for the approval path.
 *   client      MCP client
 *   liveSeatCaller  the council.mjs factory (injected to avoid a hard import cycle)
 *   dossier, meta   identity/context for approval packets
 *   models      optional per-seat model id overrides
 *   planningModel  model used for live decomposition (default "claude")
 */
export function makeLiveCallSeat({ client, liveSeatCaller, dossier, meta = {}, models = {}, planningModel = "claude" }) {
  const promptFor = approvalPromptFor(dossier, { models });
  const approval = (seatArg) =>
    liveSeatCaller({ client, promptFor, parsePacket: (t) => parseApprovalPacket(t, seatArg.model, dossier, meta) })(seatArg);

  return async (args) => {
    if (args && args.intent === "decompose") {
      const { system, prompt } = decomposePrompt(dossier, args.telos, args.conventions);
      const text = await client.callTool(`${planningModel}_ask`, { system, prompt, model: models[planningModel], include_provenance: true });
      const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
      const inner = body && typeof body.text === "string" ? body.text : text;
      return { tasks: parseDecomposeTasks(inner) };
    }
    return approval(args);
  };
}
