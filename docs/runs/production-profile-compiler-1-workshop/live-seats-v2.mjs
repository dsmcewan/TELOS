#!/usr/bin/env node
// Daedalus v2 live seat adapters — role-tuned per provider documentation.
// Governing document (HELD, The Eye 2026-07-20; does not move):
//   docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md
// Provider contracts verified against official docs 2026-07-20:
//   xAI:    Responses API (POST /v1/responses) — chat completions is legacy at
//           xAI; text.format json_schema structured output; server-side
//           web_search/x_search tools return citations on the response object;
//           budget exhaustion = status "incomplete" + incomplete_details.reason.
//   Google: generateContent (fully supported; new agentic features land on the
//           Interactions API first — migration is a watch item, not a blocker);
//           generationConfig.thinkingConfig.thinkingLevel (Gemini 3+ only, and
//           thinking tokens bill against maxOutputTokens); responseMimeType +
//           responseSchema (OpenAPI-subset) structured output; fail-loud on
//           finishReason MAX_TOKENS/SAFETY and promptFeedback.blockReason.
// Seat 1/2 (claude/codex) live transports remain the vendor CLIs already used
// by the governed workshop (claude-code-seat.mjs / codex-cli-seat.mjs); a live
// Stage 1 join runs through run-workshop.mjs in the governed directory and is
// NOT wired here (see assembleLiveSeats preflight).
//
// Every adapter is fail-loud: provider errors, budget exhaustion, safety
// blocks, and empty content THROW — the v2 orchestrator converts throws into
// burned verdicts or governed needs-work terminals. No adapter ever returns
// raw response JSON as answer text.

const XAI_BASE = "https://api.x.ai";
const GEMINI_BASE = "https://generativelanguage.googleapis.com";

// seats.json frames, quoted verbatim — the seat's registered voice.
const GROK_FRAME = "Approach: challenge it — you are the adversary. Attack the strongest version of the claim, hunt the failure modes everyone else is incentivized to miss, and draw on the live landscape you know. An empty objection list must mean you genuinely found nothing, never that you went easy.";
const GEMINI_FRAME = "Approach: independently verify. Don't trust — re-derive: recompute every checkable quantity from the material given, cross-check it against first principles, and flag anything you could not reconstruct yourself.";

const CHALLENGE_BRIEF = [
  "You are a challenge seat in a plan-maturation gate. Interrogate the plan below.",
  "Return ONLY the JSON verdict. Rules:",
  "- verdict \"denied\" requires at least one objection {scope, claim, evidence_refs}.",
  "- verdict \"accepted\" requires an empty objections array AND",
  "  empty_list_attestation \"genuinely-found-nothing\" — attest silence only if true.",
  "- Your acceptance forwards the plan to a human gate; it authorizes nothing."
].join("\n");

const REFEREE_BRIEF = [
  "You are the neutral referee (role R) of a plan-maturation gate. You judge round",
  "DYNAMICS only — never plan content. You see a ledger of rounds: verdicts,",
  "objection texts, defense rationales, candidate hash lineage.",
  "Return \"stalemate\" ONLY for semantic non-progress: an objection reworded each",
  "round with unchanged substance, defend/deny ping-pong restating rationales, or",
  "revisions with no behavioral delta — and cite the entry_ids as refs.",
  "Otherwise return \"continue\". You can only shorten the run, never extend it."
].join("\n");

function requireEnv(env, name) {
  const value = env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

// --- xAI (grok) — Stage 2 challenger ---------------------------------------------
export function makeGrokChallenger({ fetchImpl = fetch, env = process.env } = {}) {
  return async ({ plan_text, plan_ref, round, open_objection_hashes = [], defended = [] }) => {
    const apiKey = requireEnv(env, "XAI_API_KEY");
    const model = env.XAI_MODEL || "grok-4.5";
    const searchEnabled = (env.DAEDALUS_V2_GROK_SEARCH || "").toLowerCase() === "on";
    const body = {
      model,
      input: [
        { role: "system", content: `${CHALLENGE_BRIEF}\n\n${GROK_FRAME}` },
        {
          role: "user",
          content: JSON.stringify({
            plan_ref,
            round,
            open_objection_hashes,
            defended,
            plan: plan_text
          })
        }
      ],
      // grok-4.5 reasoning: low|medium|high, default high, cannot be disabled.
      reasoning: { effort: "high" },
      // Includes reasoning tokens — generous headroom per the seat review.
      max_output_tokens: 16384,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "challenge_verdict",
          schema: {
            type: "object",
            properties: {
              verdict: { type: "string", enum: ["accepted", "denied"] },
              objections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    scope: { type: "string" },
                    claim: { type: "string" },
                    evidence_refs: { type: "array", items: { type: "string" } }
                  },
                  required: ["scope", "claim", "evidence_refs"],
                  additionalProperties: false
                }
              },
              empty_list_attestation: { type: ["string", "null"] }
            },
            required: ["verdict", "objections", "empty_list_attestation"],
            additionalProperties: false
          },
          strict: true
        }
      },
      // Opt-in server-side live search: citations are evidence-shaped output.
      ...(searchEnabled ? {
        tools: [
          { type: "web_search" },
          { type: "x_search" }
        ]
      } : {})
    };
    const httpResponse = await fetchImpl(`${env.XAI_BASE_URL || XAI_BASE}/v1/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!httpResponse.ok) {
      throw new Error(`xai responses http ${httpResponse.status}`);
    }
    const json = await httpResponse.json();
    if (json.error) throw new Error(`xai responses error: ${json.error.message ?? json.error}`);
    if (json.status === "incomplete") {
      throw new Error(`xai response incomplete: ${json.incomplete_details?.reason ?? "unknown"} — raise max_output_tokens or lower effort`);
    }
    if (json.status !== "completed") {
      throw new Error(`xai response status ${json.status}`);
    }
    const message = (json.output ?? []).find((item) => item.type === "message");
    const refusal = message?.content?.find((block) => block.type === "refusal");
    if (refusal) throw new Error(`xai refusal: ${refusal.refusal}`);
    const text = (message?.content ?? [])
      .filter((block) => block.type === "output_text")
      .map((block) => block.text)
      .join("");
    if (text.trim().length === 0) throw new Error("xai response carried no output text");
    return {
      response: JSON.parse(text),
      provenance: {
        provider: "xai",
        model: json.model,
        response_id: json.id ?? "",
        source: "xai/responses",
        // Evidence-shaped search output (empty unless search was enabled/used).
        search_evidence: {
          citations: json.citations ?? [],
          server_side_tool_usage: json.usage?.server_side_tool_usage_details ?? null
        }
      }
    };
  };
}

// --- Google (gemini) — shared generateContent core -------------------------------
async function geminiGenerate({ fetchImpl, env, model, system, user, thinkingLevel, responseSchema }) {
  const apiKey = requireEnv(env, "GEMINI_API_KEY");
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      // Thinking bills against maxOutputTokens on Gemini 3 — generous headroom.
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingLevel },
      responseMimeType: "application/json",
      responseSchema
    }
  };
  const httpResponse = await fetchImpl(
    `${env.GEMINI_BASE_URL || GEMINI_BASE}/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(body)
    }
  );
  if (!httpResponse.ok) {
    throw new Error(`gemini generateContent http ${httpResponse.status}`);
  }
  const json = await httpResponse.json();
  // Fail loud — never stringify the raw response as an answer.
  if (json.promptFeedback?.blockReason) {
    throw new Error(`gemini prompt blocked: ${json.promptFeedback.blockReason}`);
  }
  const candidate = json.candidates?.[0];
  if (!candidate) throw new Error("gemini response carried no candidates");
  if (candidate.finishReason !== "STOP") {
    throw new Error(`gemini finishReason ${candidate.finishReason} — raise maxOutputTokens or lower thinkingLevel if MAX_TOKENS`);
  }
  const text = (candidate.content?.parts ?? [])
    .filter((part) => part.thought !== true && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (text.trim().length === 0) throw new Error("gemini response carried no text parts");
  return {
    parsed: JSON.parse(text),
    provenance: {
      provider: "google",
      model: json.modelVersion ?? model,
      // Honest-null discipline: an absent responseId burns downstream rather
      // than being invented here.
      response_id: json.responseId ?? "",
      source: "google/generateContent"
    }
  };
}

const GEMINI_VERDICT_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["accepted", "denied"] },
    objections: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          scope: { type: "STRING" },
          claim: { type: "STRING" },
          evidence_refs: { type: "ARRAY", items: { type: "STRING" } }
        },
        required: ["scope", "claim", "evidence_refs"]
      }
    },
    empty_list_attestation: { type: "STRING", nullable: true }
  },
  required: ["verdict", "objections"],
  propertyOrdering: ["verdict", "objections", "empty_list_attestation"]
};

const GEMINI_REFEREE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["continue", "stalemate"] },
    loop_evidence: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: { type: "STRING", enum: ["rehashed-objection", "ping-pong", "empty-delta", "agreement-theater"] },
          refs: { type: "ARRAY", items: { type: "STRING" } },
          why: { type: "STRING" }
        },
        required: ["kind", "refs", "why"]
      }
    }
  },
  required: ["verdict", "loop_evidence"],
  propertyOrdering: ["verdict", "loop_evidence"]
};

// Stage 2 challenger — deep verification: thinkingLevel "high".
export function makeGeminiChallenger({ fetchImpl = fetch, env = process.env } = {}) {
  return async ({ plan_text, plan_ref, round, open_objection_hashes = [], defended = [] }) => {
    const model = env.GEMINI_MODEL || "gemini-3.5-flash";
    const { parsed, provenance } = await geminiGenerate({
      fetchImpl,
      env,
      model,
      system: `${CHALLENGE_BRIEF}\n\n${GEMINI_FRAME}`,
      user: JSON.stringify({ plan_ref, round, open_objection_hashes, defended, plan: plan_text }),
      thinkingLevel: "high",
      responseSchema: GEMINI_VERDICT_SCHEMA
    });
    if (!("empty_list_attestation" in parsed)) parsed.empty_list_attestation = null;
    return { response: parsed, provenance };
  };
}

// Role R referee — process watch: thinkingLevel "medium" (the referee tier);
// the ledger view is the entire input; the referee never sees candidate bytes.
export function makeGeminiReferee({ fetchImpl = fetch, env = process.env } = {}) {
  return async ({ ledger_view, round, stage }) => {
    const model = env.GEMINI_REFEREE_MODEL || env.GEMINI_MODEL || "gemini-3.5-flash";
    const { parsed, provenance } = await geminiGenerate({
      fetchImpl,
      env,
      model,
      system: REFEREE_BRIEF,
      user: JSON.stringify({ stage, round, ledger_view }),
      thinkingLevel: "medium",
      responseSchema: GEMINI_REFEREE_SCHEMA
    });
    return { response: parsed, provenance };
  };
}

// --- Live preflight --------------------------------------------------------------
// File-first wiring: the live arc runs only when every transport requirement is
// present. Stage 1 live joins additionally run through run-workshop.mjs in the
// governed directory under The Eye's budget approval — not from this module.
export function liveSeatsPreflight(env = process.env) {
  const missing = [];
  if (!env.XAI_API_KEY) missing.push("XAI_API_KEY (grok challenger — xAI Responses API)");
  // Seat 4 + role R accept either transport: the Gemini API, or the
  // subscription-auth Antigravity CLI (agy-cli-seat.mjs; zero API spend).
  if (!env.GEMINI_API_KEY && !env.DAEDALUS_V2_AGY_BIN) {
    missing.push("GEMINI_API_KEY or DAEDALUS_V2_AGY_BIN (gemini challenger + role R referee — API key, or path to a signed-in agy binary)");
  }
  if (env.CLAUDE_CODE_OAUTH !== "1") missing.push("CLAUDE_CODE_OAUTH=1 (Seat 1 claude via Claude Code CLI)");
  if (env.CODEX_CLI_OAUTH !== "1") missing.push("CODEX_CLI_OAUTH=1 (Seat 2 codex via Codex CLI)");
  return {
    ready: missing.length === 0,
    missing,
    notes: [
      "Live Stage 1 joins run via run-workshop.mjs in the governed directory (Eye-approved budget).",
      "Grok live search is opt-in: DAEDALUS_V2_GROK_SEARCH=on (bills separately; citations captured as evidence).",
      "Gemini thinkingLevel validity is per model — verify before overriding GEMINI_MODEL.",
      "The agy transport requires a completed Google Sign-In (`agy` run once interactively); the CLI errors fail closed otherwise.",
      "Whether agy also exposes Anthropic models is unverified until sign-in (`agy models`); even if it does, keep Seat 4 on a non-Claude model — seat diversity is the point of the challenge pair.",
      "The Eye's open items 1-7 (caps, cadence, vehicle) remain unruled; defaults are proposals."
    ]
  };
}
