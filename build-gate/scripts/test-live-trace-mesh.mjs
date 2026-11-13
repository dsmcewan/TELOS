#!/usr/bin/env node
// Guard against accidentally replacing absent live LLMs with canned answers.
// This executes the real live runner with all provider credentials stripped.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const runner=fileURLToPath(new URL('./live-trace-mesh-compare.mjs',import.meta.url));
const env={...process.env};
for(const k of ['ANTHROPIC_API_KEY','OPENAI_API_KEY','GEMINI_API_KEY','XAI_API_KEY','ANTHROPIC_MODEL','OPENAI_MODEL','GEMINI_MODEL','XAI_MODEL'])delete env[k];
const r=spawnSync(process.execPath,[runner],{env,encoding:'utf8',timeout:5000});
assert.equal(r.status,2,'Unconfigured model run MUST fail closed with exit 2');
const output=JSON.parse(r.stderr.trim());
assert.equal(output.status,'BLOCKED_NO_LIVE_SEATS');
assert.equal(output.available,0);
console.log('PASS live seat absence fails closed (no fake data)');
