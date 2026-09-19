#!/usr/bin/env node
// Live seat adapter suite — mocked transports only; no network, no provider spend.
import assert from "node:assert/strict";
import {
  makeGrokChallenger,
  makeGeminiChallenger,
  makeGeminiReferee,
  liveSeatsPreflight
} from "./live-seats-v2.mjs";

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, options, body });
    const reply = await handler({ url, options, body });
    return {
      ok: reply.ok ?? true,
      status: reply.status ?? 200,
      json: async () => reply.json
    };
  };
  fn.calls = calls;
  return fn;
}

function xaiCompleted(payloadText, extra = {}) {
  return {
    json: {
      id: "resp-xai-1",
      object: "response",
      model: "grok-4.5",
      status: "completed",
      output: [
        { type: "reasoning" },
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: payloadText }]
        }
      ],
      citations: extra.citations ?? [],
      usage: extra.usage ?? { input_tokens: 10, output_tokens: 20 }
    }
  };
}

const ENV = {
  XAI_API_KEY: "xai-test-key",
  GEMINI_API_KEY: "gemini-test-key"
};

// Case 1: grok challenger — request shaped per xAI Responses docs
{
  const fetchImpl = mockFetch(() => xaiCompleted(JSON.stringify({
    verdict: "accepted", objections: [], empty_list_attestation: "genuinely-found-nothing"
  })));
  const grok = makeGrokChallenger({ fetchImpl, env: ENV });
  const result = await grok({ plan_text: "PLAN", plan_ref: "sha256:x", round: 1 });
  const { url, options, body } = fetchImpl.calls[0];
  assert.equal(url, "https://api.x.ai/v1/responses");
  assert.equal(options.headers.authorization, "Bearer xai-test-key");
  assert.equal(body.model, "grok-4.5");
  assert.deepEqual(body.reasoning, { effort: "high" });
  assert.equal(body.max_output_tokens, 16384);
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.ok(!("tools" in body), "search must be opt-in, not default");
  assert.ok(body.input[0].content.includes("you are the adversary"));
  assert.equal(result.response.verdict, "accepted");
  assert.equal(result.provenance.provider, "xai");
  assert.equal(result.provenance.response_id, "resp-xai-1");
  console.log("Case 1 OK: grok challenger speaks current xAI Responses API");
}

// Case 2: grok search opt-in attaches tools and captures citations as evidence
{
  const fetchImpl = mockFetch(() => xaiCompleted(
    JSON.stringify({ verdict: "denied", objections: [{ scope: "plan", claim: "stale dep", evidence_refs: [] }], empty_list_attestation: null }),
    {
      citations: ["https://example.com/advisory"],
      usage: { server_side_tool_usage_details: { web_search_calls: 2, x_search_calls: 1 } }
    }
  ));
  const grok = makeGrokChallenger({ fetchImpl, env: { ...ENV, DAEDALUS_V2_GROK_SEARCH: "on" } });
  const result = await grok({ plan_text: "PLAN", plan_ref: "sha256:x", round: 1 });
  const { body } = fetchImpl.calls[0];
  assert.deepEqual(body.tools.map((tool) => tool.type), ["web_search", "x_search"]);
  assert.deepEqual(result.provenance.search_evidence.citations, ["https://example.com/advisory"]);
  assert.equal(result.provenance.search_evidence.server_side_tool_usage.web_search_calls, 2);
  console.log("Case 2 OK: opt-in live search captures citations as evidence");
}

// Case 3: grok budget exhaustion and refusal fail loud
{
  const incomplete = mockFetch(() => ({
    json: { id: "r", model: "grok-4.5", status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }
  }));
  await assert.rejects(
    () => makeGrokChallenger({ fetchImpl: incomplete, env: ENV })({ plan_text: "P", plan_ref: "sha256:x", round: 1 }),
    /incomplete: max_output_tokens/
  );
  const refusal = mockFetch(() => ({
    json: {
      id: "r", model: "grok-4.5", status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "cannot comply" }] }]
    }
  }));
  await assert.rejects(
    () => makeGrokChallenger({ fetchImpl: refusal, env: ENV })({ plan_text: "P", plan_ref: "sha256:x", round: 1 }),
    /refusal/
  );
  console.log("Case 3 OK: xai exhaustion and refusal throw instead of passing");
}

// Case 4: gemini challenger — request shaped per generateContent docs
{
  const fetchImpl = mockFetch(() => ({
    json: {
      modelVersion: "gemini-3.5-flash",
      responseId: "resp-gem-1",
      candidates: [{
        finishReason: "STOP",
        content: {
          parts: [
            { thought: true, text: "hidden thought summary" },
            { text: JSON.stringify({ verdict: "accepted", objections: [], empty_list_attestation: "genuinely-found-nothing" }) }
          ]
        }
      }]
    }
  }));
  const gemini = makeGeminiChallenger({ fetchImpl, env: ENV });
  const result = await gemini({ plan_text: "PLAN", plan_ref: "sha256:x", round: 1 });
  const { url, options, body } = fetchImpl.calls[0];
  assert.match(url, /\/v1beta\/models\/gemini-3\.5-flash:generateContent$/);
  assert.equal(options.headers["x-goog-api-key"], "gemini-test-key");
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "high");
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.equal(body.generationConfig.maxOutputTokens, 16384);
  assert.equal(body.generationConfig.responseSchema.type, "OBJECT");
  assert.ok(body.systemInstruction.parts[0].text.includes("re-derive"));
  assert.equal(result.response.verdict, "accepted");
  assert.equal(result.provenance.response_id, "resp-gem-1");
  assert.ok(!JSON.stringify(result.response).includes("hidden thought"), "thought parts must be skipped");
  console.log("Case 4 OK: gemini challenger speaks current generateContent");
}

// Case 5: gemini MAX_TOKENS, SAFETY, and prompt-block fail loud — never raw JSON
{
  const maxTokens = mockFetch(() => ({
    json: { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }
  }));
  await assert.rejects(
    () => makeGeminiChallenger({ fetchImpl: maxTokens, env: ENV })({ plan_text: "P", plan_ref: "sha256:x", round: 1 }),
    /MAX_TOKENS/
  );
  const blocked = mockFetch(() => ({
    json: { promptFeedback: { blockReason: "SAFETY" } }
  }));
  await assert.rejects(
    () => makeGeminiChallenger({ fetchImpl: blocked, env: ENV })({ plan_text: "P", plan_ref: "sha256:x", round: 1 }),
    /prompt blocked: SAFETY/
  );
  console.log("Case 5 OK: gemini failure modes throw instead of dumping raw JSON");
}

// Case 6: gemini referee — process-only brief, medium thinking, closed schema
{
  const fetchImpl = mockFetch(() => ({
    json: {
      modelVersion: "gemini-3.5-flash",
      responseId: "resp-ref-1",
      candidates: [{
        finishReason: "STOP",
        content: { parts: [{ text: JSON.stringify({ verdict: "continue", loop_evidence: [] }) }] }
      }]
    }
  }));
  const referee = makeGeminiReferee({ fetchImpl, env: ENV });
  const result = await referee({ ledger_view: { rounds: [] }, round: 2, stage: "plan-challenge" });
  const { body } = fetchImpl.calls[0];
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "medium");
  assert.ok(body.systemInstruction.parts[0].text.includes("never plan content"));
  assert.equal(body.generationConfig.responseSchema.properties.verdict.enum.length, 2);
  assert.equal(result.response.verdict, "continue");
  console.log("Case 6 OK: referee runs at the referee tier with a closed schema");
}

// Case 7: preflight reports every missing requirement; either gemini transport satisfies
{
  const empty = liveSeatsPreflight({});
  assert.equal(empty.ready, false);
  assert.equal(empty.missing.length, 4);
  const viaApi = liveSeatsPreflight({
    XAI_API_KEY: "x", GEMINI_API_KEY: "g", CLAUDE_CODE_OAUTH: "1", CODEX_CLI_OAUTH: "1"
  });
  assert.equal(viaApi.ready, true);
  const viaAgy = liveSeatsPreflight({
    XAI_API_KEY: "x", DAEDALUS_V2_AGY_BIN: "/path/to/agy.exe", CLAUDE_CODE_OAUTH: "1", CODEX_CLI_OAUTH: "1"
  });
  assert.equal(viaAgy.ready, true);
  assert.ok(viaAgy.notes.some((note) => /Sign-In/.test(note)));
  console.log("Case 7 OK: live preflight is fail-closed; agy CLI satisfies the gemini seat");
}

// Case 8: missing keys fail closed before any request
{
  await assert.rejects(
    () => makeGrokChallenger({ fetchImpl: mockFetch(() => ({ json: {} })), env: {} })({ plan_text: "P", plan_ref: "r", round: 1 }),
    /XAI_API_KEY/
  );
  await assert.rejects(
    () => makeGeminiChallenger({ fetchImpl: mockFetch(() => ({ json: {} })), env: {} })({ plan_text: "P", plan_ref: "r", round: 1 }),
    /GEMINI_API_KEY/
  );
  console.log("Case 8 OK: absent keys block before any transport call");
}

console.log("test-live-seats-v2.mjs OK");
