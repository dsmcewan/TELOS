#!/usr/bin/env node
// Antigravity CLI (agy) seat transport — Daedalus v2 Seat 4 / role R alternative.
// Governing document (HELD, The Eye 2026-07-20; does not move):
//   docs/superpowers/specs/2026-07-20-daedalus-workflow-v2-design.md
//
// Drives the locally installed, already-authenticated `agy` binary in print
// mode (subscription auth — Google Sign-In; zero API spend). Proven invocation
// pattern inherited from the live-verified agy-plugin (claude-plugins/agy-plugin,
// evidence: docs/runs/plugin-seats/summary.json, 2026-07-02):
//   - spawn, NOT execFile: agy inspects stdin; an open pipe with no data hangs
//     the CLI forever. The prompt travels OVER STDIN and stdin is closed after
//     writing.
//   - stdin, not argv: Windows caps command lines at ~32K chars and re-quotes
//     argv; JSON-heavy prompts get mangled. Piping sidesteps both.
//   - The CLI returns no server-side response id, so provenance is
//     content-addressed: "agy-" + sha256(canonical {model, prompt, text}) —
//     reproducible from the evidence, never fabricated. Identical replays
//     collide by construction, which the v2 provenance registry then burns as
//     reused-provenance: replay detection for free.
// Fail-closed: nonzero exit, timeout, empty output, or non-JSON output in
// schema mode all THROW — the v2 orchestrator converts throws into burns or
// governed needs-work terminals. The binary is closed-source; nothing here
// trusts its output beyond what the content address pins.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";

export const AGY_DEFAULT_MODEL = "gemini-3.1-pro-high";
export const AGY_SOURCE = "antigravity-cli";
const DEFAULT_TIMEOUT_MS = 600_000;

const POINTER_INSTRUCTION = "Follow the piped input exactly — it contains your full instructions and context.";

function contentAddressedId(model, prompt, text) {
  const canonical = JSON.stringify({ model, prompt, text });
  return `agy-${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

export function agyBin(env = process.env) {
  return env.DAEDALUS_V2_AGY_BIN || env.AGY_BIN || "agy";
}

/**
 * One-shot prompt through the Antigravity CLI.
 * Returns { text, json, model, provenance } — json is present only when a
 * schema was given (strict JSON.parse of the trimmed output; anything else,
 * including code fences, throws).
 */
export function callAgyCli({ prompt, system, schema, model }, {
  bin,
  env = process.env,
  timeoutMs = Number(env.AGY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  spawnImpl = spawn
} = {}) {
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return Promise.reject(new Error("agy seat requires a non-empty prompt"));
  }
  const binary = bin || agyBin(env);
  const usedModel = model || env.AGY_DEFAULT_MODEL || AGY_DEFAULT_MODEL;
  let fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
  if (schema) {
    fullPrompt += "\n\nRespond ONLY with a single JSON object (no prose, no code fences) that validates against this JSON Schema:\n"
      + JSON.stringify(schema);
  }
  const timeoutSeconds = Math.max(60, Math.ceil(timeoutMs / 1000));
  const args = [
    "--model", usedModel,
    "--print-timeout", `${timeoutSeconds}s`,
    "--print", POINTER_INSTRUCTION
  ];
  return new Promise((resolve, reject) => {
    const child = spawnImpl(binary, args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    child.stdin.on("error", () => { /* CLI exited early; close() surfaces it */ });
    child.stdin.write(fullPrompt);
    child.stdin.end();

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill();
      reject(new Error(`agy CLI timed out after ${Math.round(timeoutMs / 1000)}s with no response`));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error.code === "ENOENT") {
        reject(new Error(`agy binary not found at ${JSON.stringify(binary)} — install the Antigravity CLI, sign in, and set DAEDALUS_V2_AGY_BIN`));
      } else {
        reject(new Error(`agy CLI failed to start: ${error.message}`));
      }
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        const detail = (stderr || stdout || `exit code ${code}`).toString().slice(0, 2000);
        reject(new Error(`agy CLI failed: ${detail}`));
        return;
      }
      const text = stdout.trim();
      if (text.length === 0) {
        reject(new Error("agy CLI returned empty output"));
        return;
      }
      let json;
      if (schema) {
        try {
          json = JSON.parse(text);
        } catch {
          reject(new Error("agy CLI output is not the single JSON object the schema demands"));
          return;
        }
      }
      resolve({
        text,
        json,
        model: usedModel,
        provenance: {
          provider: "google",
          model: usedModel,
          response_id: contentAddressedId(usedModel, fullPrompt, text),
          source: AGY_SOURCE
        }
      });
    });
  });
}

// --- v2 seat factories (drop-in alternatives to the API adapters) ---------------
const CHALLENGE_BRIEF = [
  "You are a challenge seat in a plan-maturation gate. Interrogate the plan below.",
  "Rules:",
  "- verdict \"denied\" requires at least one objection {scope, claim, evidence_refs}.",
  "- verdict \"accepted\" requires an empty objections array AND",
  "  empty_list_attestation \"genuinely-found-nothing\" — attest silence only if true.",
  "- Your acceptance forwards the plan to a human gate; it authorizes nothing.",
  "",
  "Approach: independently verify. Don't trust — re-derive: recompute every",
  "checkable quantity from the material given, cross-check it against first",
  "principles, and flag anything you could not reconstruct yourself."
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

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { enum: ["accepted", "denied"] },
    objections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scope: { type: "string" },
          claim: { type: "string" },
          evidence_refs: { type: "array", items: { type: "string" } }
        },
        required: ["scope", "claim", "evidence_refs"]
      }
    },
    empty_list_attestation: { type: ["string", "null"] }
  },
  required: ["verdict", "objections", "empty_list_attestation"]
};

const REFEREE_SCHEMA = {
  type: "object",
  properties: {
    verdict: { enum: ["continue", "stalemate"] },
    loop_evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { enum: ["rehashed-objection", "ping-pong", "empty-delta", "agreement-theater"] },
          refs: { type: "array", items: { type: "string" } },
          why: { type: "string" }
        },
        required: ["kind", "refs", "why"]
      }
    }
  },
  required: ["verdict", "loop_evidence"]
};

export function makeAgyChallenger(options = {}) {
  return async ({ plan_text, plan_ref, round, open_objection_hashes = [], defended = [] }) => {
    const { json, provenance } = await callAgyCli({
      system: CHALLENGE_BRIEF,
      prompt: JSON.stringify({ plan_ref, round, open_objection_hashes, defended, plan: plan_text }),
      schema: VERDICT_SCHEMA
    }, options);
    if (json && typeof json === "object" && !("empty_list_attestation" in json)) {
      json.empty_list_attestation = null;
    }
    return { response: json, provenance };
  };
}

export function makeAgyReferee(options = {}) {
  return async ({ ledger_view, round, stage }) => {
    const { json, provenance } = await callAgyCli({
      system: REFEREE_BRIEF,
      prompt: JSON.stringify({ stage, round, ledger_view }),
      schema: REFEREE_SCHEMA
    }, options);
    return { response: json, provenance };
  };
}
