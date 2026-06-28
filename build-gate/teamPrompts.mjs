// teamPrompts.mjs — LIVE wiring for the agentic teams over ai-peer-mcp.
//
// The orchestrator (build-orchestrator.mjs) is transport-agnostic: it takes an
// injected `callSeat` (council approval) and `callTeam` (build execution). This
// module builds both over a minimal MCP client (../breakout/mcp_client.mjs),
// giving each team its own system prompt. It is opt-in: nothing here runs without
// API keys, mirroring the existing `smoke` scripts. The pure prompt/parse helpers
// are unit-tested without a network.

// Chat seats expose an `<model>_ask` tool; agy is structured (no code generation).
const ASK_MODELS = new Set(["claude", "grok", "codex"]);

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
export function nodeBuildPrompt(node) {
  return [
    `Task id: ${node.id}`,
    `Requirements: ${node.requirements}`,
    `Files to write (exactly these): ${JSON.stringify(node.files)}`,
    "Emit the JSON {files:[...]} now."
  ].join("\n");
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
  return async ({ team, node }) => {
    const model = buildableSeat(team);
    const text = await client.callTool(`${model}_ask`, {
      system: promptForTeam(team),
      prompt: nodeBuildPrompt(node),
      include_provenance: true
    });
    const files = parseTeamFiles(text, node);
    if (files.length === 0) {
      return { ok: false, reason: `team ${team.id} (${model}) returned no usable files for ${node.id}` };
    }
    return { files };
  };
}

/**
 * Build a promptFor(model, role, dossier, workstream) for liveSeatCaller
 * (council.mjs) so the approval council emits gate-valid JSON packets. agy stays
 * structured (agy_checkpoint args); chat seats get a packet-emitting instruction.
 */
export function approvalPromptFor(dossier) {
  return (model, role, _dossier, workstream) => {
    if (model === "agy") {
      return { tool: "agy_checkpoint", args: { phase: "approval", scope: dossier?.use_case ?? "" } };
    }
    const system = [
      `You are the ${model} approval seat (role: ${role}${workstream ? `, workstream: ${workstream}` : ""}).`,
      "Review the build and return ONLY a JSON approval packet with fields:",
      "build_id, use_case, model, role, docs_reviewed[], proposal_ref, decision",
      "(approve|revise|reject), required_edits[], hard_stops[], confidence (low|medium|high), timestamp."
    ].join(" ");
    const prompt = [
      `build_id: ${dossier?.build_id}`,
      `use_case: ${dossier?.use_case}`,
      `objective: ${dossier?.objective}`,
      "Emit the JSON approval packet now."
    ].join("\n");
    return { tool: `${model}_ask`, system, prompt };
  };
}
