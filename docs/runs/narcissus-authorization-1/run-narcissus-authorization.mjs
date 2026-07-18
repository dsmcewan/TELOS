#!/usr/bin/env node
// TELOS authorization council for Narcissus flagship front-end plan (build-mode; builder makes the call).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";
import path from "node:path";
process.env.AI_PEER_LONG_TIMEOUT = "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
await imp("connectors/ai-peer-mcp/server.mjs");
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");
const { runCouncil, liveSeatCaller, agyApprovalPacket, agyCheckpointArgs } = await imp("build-gate/council.mjs");
const { validateRecords } = await imp("build-gate/gate.mjs");
const { spawnMcpClient } = await imp("breakout/mcp_client.mjs");

const PLAN_PATH = "docs/runs/narcissus-1-workshop/matured-approach.md";
const PRE = "docs/institutional-memory/iliad/PRE-REVIEWS/2026-07-18-narcissus-1.json";
const EXPECTED = "sha256:3e62ea9698aa18d4570a7df98b9f36be56b2fe82b8c851c9b9d274ebd8b9d724";
const planText = readFileSync(path.join(ROOT, PLAN_PATH), "utf8");
const planRef = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: planText }));
if (planRef !== EXPECTED) { console.error("PLAN DRIFT " + planRef); process.exit(1); }
const EPHEMERAL = [];
for (const m of ["CLAUDE","AGY","CODEX"]) if (!process.env[`TELOS_SECRET_${m}`]) { process.env[`TELOS_SECRET_${m}`]=randomBytes(24).toString("hex"); EPHEMERAL.push(m.toLowerCase()); }
const BUILD_ID="iliad-narcissus-1-authz", USE_CASE="iliad-narcissus-cycle-1", TS=new Date().toISOString();
const OBJECTIVE = `Authorize Argo to BUILD the Narcissus flagship development-story front-end per the matured plan (${planRef}). `+
`Narcissus produces award-standard front-ends for PRODUCTS (not the zero-dep core). Judge on the plan's terms: `+
`(1) NORMATIVE invariant 'WebGL is paint' — canvas is a pure view-layer; all state/action in a deterministic XState machine + typed command registry; every 3D element shadowed by a real semantic HTML control; ?e2e=1 freezes RNG/physics. `+
`(2) Two-blade gate: FUNCTIONAL = deterministic Playwright E2E where the command registry is the CLOSED inventory (coverage==inventory) + pinned perf budgets (LCP<=2.5s/CLS<=0.1/TBT<=200ms); AESTHETIC = Eye-judged HUMAN (no oracle, not faked). `+
`(3) Evidence Ledger = curated full-40-hex allowlist, fail-closed. (4) Accessibility is a real no-WebGL/reduced-motion DOM layer, not 'free'. `+
`Approve ONLY if implementation-ready + consistent with the pre-review and the repo trust model. This is a PORTFOLIO build; the aesthetic blade remains The Eye's.`;
const WRITE_TARGETS = ["narcissus/"];
const dossier = { build_id:BUILD_ID, use_case:USE_CASE, objective:OBJECTIVE, proposal_ref:planRef, required_docs:[PLAN_PATH,PRE], write_targets:WRITE_TARGETS, protected_paths:[], trust_mode:"signed" };
const meta = { build_id:BUILD_ID, use_case:USE_CASE, proposal_ref:planRef, timestamp:TS, docs_reviewed:[PLAN_PATH,PRE] };
const SCHEMA={type:"object",additionalProperties:false,properties:{decision:{type:"string",enum:["approve","revise","reject"]},confidence:{type:"string",enum:["low","medium","high"]},required_edits:{type:"array",items:{type:"string"}},hard_stops:{type:"array",items:{type:"string"}},rationale:{type:"string"}},required:["decision","confidence","required_edits","hard_stops","rationale"]};
function parsePacket(t,model){let m=null;try{m=JSON.parse(t);}catch{}if(m&&m.phase_gate_status)return agyApprovalPacket(m,meta);if(!m||typeof m!=="object")m={};return{build_id:BUILD_ID,use_case:USE_CASE,model,role:"approver",docs_reviewed:meta.docs_reviewed,proposal_ref:planRef,decision:["approve","revise","reject"].includes(m.decision)?m.decision:"revise",required_edits:Array.isArray(m.required_edits)?m.required_edits:[],hard_stops:Array.isArray(m.hard_stops)?m.hard_stops:[],confidence:["low","medium","high"].includes(m.confidence)?m.confidence:"low",timestamp:TS,rationale:typeof m.rationale==="string"?m.rationale:"unparsable"};}
const strip=(s)=>{const c=JSON.parse(JSON.stringify(s));const w=(n)=>{if(!n||typeof n!=="object")return;delete n.additionalProperties;for(const v of Object.values(n))w(v);};w(c);return c;};
function promptFor(model,_r,dsr){ if(model==="agy")return{tool:"agy_checkpoint",args:agyCheckpointArgs(dsr,"narcissus/")}; return {tool:`${model}_ask`,args:{prompt:`Objective:\n${OBJECTIVE}\n\n=== PLAN (${planRef}) ===\n\n${planText}`,system:`You are the ${model} seat on the TELOS authorization council. Approve only what you would stake your signature on.`,model,max_tokens:40000,include_provenance:true,response_schema:model==="gemini"?strip(SCHEMA):SCHEMA,schema_name:"telos_approval_packet"}}; }
const seats=[{model:"claude",role:"approver"},{model:"agy",role:"approver"},{model:"codex",role:"approver"},{model:"grok",role:"advisory"},{model:"gemini",role:"advisory"}];
const { client, close } = spawnMcpClient({ command: process.execPath, serverPath: path.join(ROOT,"connectors/ai-peer-mcp/server.mjs") });
const killer=setTimeout(()=>{console.error("AUTHZ_TIMEOUT");process.exit(2);},1_500_000);
try{
  const callSeat=(s)=>liveSeatCaller({client,promptFor,parsePacket:(t)=>parsePacket(t,s.model)})(s);
  const results=await runCouncil({seats,callSeat,dossier});
  mkdirSync(HERE,{recursive:true});
  const summary={build_id:BUILD_ID,plan_ref:planRef,timestamp:TS,trust_mode:"signed",ephemeral_signers:EPHEMERAL,seats:[]};const packets=[];
  for(const r of results){ if(r.ok){writeFileSync(path.join(HERE,`${r.model}.json`),JSON.stringify(r.packet,null,2));packets.push(r.packet);summary.seats.push({model:r.model,role:r.role,ok:true,signed:!!r.signed,decision:r.packet.decision,confidence:r.packet.confidence,provenance:r.packet.provenance});}else summary.seats.push({model:r.model,role:r.role,ok:false,reason:r.reason}); }
  const gate=validateRecords(dossier,packets); summary.gate={gate_status:gate.gate_status,blockers:gate.blockers,warnings:gate.warnings};
  const req=seats.filter(s=>s.role==="approver").map(s=>s.model); const appr=summary.seats.filter(s=>req.includes(s.model)&&s.ok&&s.decision==="approve");
  summary.authorized = gate.gate_status==="pass" && appr.length===req.length;
  summary.authorization = summary.authorized?{status:"AUTHORIZED",id:"authz-narcissus-1",plan_ref:planRef,note:"Argo build authorized by signed council (build-mode; builder confirms)."}:{status:"NOT_AUTHORIZED",note:"see gate.blockers + seat decisions; builder adjudicates in build-mode."};
  writeFileSync(path.join(HERE,"authorization-summary.json"),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({authorized:summary.authorized,gate:gate.gate_status,seats:summary.seats.map(s=>({m:s.model,ok:s.ok,d:s.decision??null}))},null,2));
  process.exit(summary.authorized?0:3);
}catch(e){console.error("AUTHZ_ERROR "+(e?.message||e));process.exitCode=1;}finally{clearTimeout(killer);close();}
