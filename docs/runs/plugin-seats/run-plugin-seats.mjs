#!/usr/bin/env node

// Live smoke run: council tool names -> seat router -> claude-plugins seat
// servers -> real providers. Verifies each plugin-backed seat returns the
// provenance envelope the gate demands: non-null, non-placeholder response_id,
// unique across seats (a seat may not borrow another's id).
//
//   node run-plugin-seats.mjs            # grok + codex + agy (+ gemini)
//
// Requires: XAI_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY in env; the agy CLI
// signed in. Writes summary.json next to this script.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createSeatRouter } from "../../../breakout/seat_router.mjs";
import { defaultSeatRegistry } from "../../../build-gate/seat-registry.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDERS = new Set(["", "self", "placeholder"]);

const SEATS = [
  { tool: "grok_ask" },
  { tool: "codex_ask" },
  { tool: "gemini_ask" },
  { tool: "agy_ask" }
];

const router = createSeatRouter(defaultSeatRegistry());
const killer = setTimeout(() => { process.stderr.write("SMOKE_TIMEOUT\n"); process.exit(2); }, 480000);

const summary = { timestamp: new Date().toISOString(), seats: [] };
let failed = false;

try {
  const results = await Promise.all(SEATS.map(async ({ tool }) => {
    try {
      const text = await router.callTool(tool, {
        prompt: "In one short sentence: what is the purpose of a merge gate?",
        include_provenance: true
      });
      const parsed = JSON.parse(text);
      return { tool, text: parsed.text, provenance: parsed.provenance ?? null };
    } catch (err) {
      return { tool, error: String(err?.message || err) };
    }
  }));

  const seenIds = new Map();
  for (const r of results) {
    const p = r.provenance;
    const id = p?.response_id;
    const ok = !r.error
      && typeof r.text === "string" && r.text.trim().length > 0
      && typeof id === "string" && !PLACEHOLDERS.has(id) && !id.endsWith("_self")
      && !seenIds.has(id);
    if (typeof id === "string") {
      if (seenIds.has(id)) r.error = `response_id shared with ${seenIds.get(id)}`;
      else seenIds.set(id, r.tool);
    }
    if (!ok) failed = true;
    summary.seats.push({
      tool: r.tool,
      ok,
      model: p?.model ?? null,
      source: p?.source ?? null,
      response_id: id ?? null,
      error: r.error ?? null,
      answer: typeof r.text === "string" ? r.text.slice(0, 200) : null
    });
    console.log(`${ok ? "PASS" : "FAIL"} ${r.tool} model=${p?.model ?? "-"} id=${id ?? "null"}${r.error ? ` error=${r.error}` : ""}`);
  }
} finally {
  clearTimeout(killer);
  router.close();
}

summary.result = failed ? "FAIL" : "PASS";
await writeFile(path.join(here, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`plugin-seats smoke: ${summary.result}`);
process.exit(failed ? 1 : 0);
