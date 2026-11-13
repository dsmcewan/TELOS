#!/usr/bin/env node
// Opt-in LIVE A/B on an existing TELOS review question. No deterministic model
// fallbacks: three distinct provider-backed seats or a non-zero exit.
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnMcpClient } from '../../breakout/mcp_client.mjs';
import { ScopedTraceStore } from '../trace-mesh/trace-store.mjs';
import { deployMutualMesh } from '../trace-mesh/mutual-mesh.mjs';

const here=dirname(fileURLToPath(import.meta.url)), root=resolve(here,'../..');
const available=[
 {id:'implementation',tool:'claude_ask',keyAvailable:Boolean(process.env.ANTHROPIC_API_KEY),modelName:process.env.ANTHROPIC_MODEL},
 {id:'test-contract',tool:'codex_ask',keyAvailable:Boolean(process.env.OPENAI_API_KEY),modelName:process.env.OPENAI_MODEL},
 {id:'independent',tool:'gemini_ask',keyAvailable:Boolean(process.env.GEMINI_API_KEY),modelName:process.env.GEMINI_MODEL},
 {id:'alternative',tool:'grok_ask',keyAvailable:Boolean(process.env.XAI_API_KEY),modelName:process.env.XAI_MODEL}
].filter(x=>x.keyAvailable&&Boolean(x.modelName));
if(available.length<3){
 console.error(JSON.stringify({status:'BLOCKED_NO_LIVE_SEATS',required:3,available:available.length,note:'Cannot report live-model measurements using simulated callbacks.'}));
 process.exit(2);
}
const seats=available.slice(0,3);
const sourceText=readFileSync(resolve(root,'build-gate/build-orchestrator.mjs'),'utf8');
const tests=readFileSync(resolve(root,'build-gate/scripts/test-verify-stage.mjs'),'utf8');
const verifySection=sourceText.slice(sourceText.indexOf('async function runVerify'),sourceText.indexOf('export function makeTeamDispatch'));
const dispatchSection=sourceText.slice(sourceText.indexOf('export function makeTeamDispatch'),sourceText.indexOf('export function makeTeamKeyring'));
if(!verifySection.includes('runVerify') || !dispatchSection.includes('requireVerify')
 || !sourceText.includes('if (requireVerify) return { ok: false')
 || !tests.includes('un-runnable verify is advisory -> still ready')
 || !tests.includes('requireVerify + un-runnable verify blocks'))
 throw Error('The existing test-contract oracle no longer matches the repository. Do not report results.');
const task='TELOS verification-stage review: if the verifier is unavailable or returns malformed data, distinguish the default advisory behavior from requireVerify:true. Does strict mode block node settlement? Cite evidence.';
const groundTruth='strict-blocks-advisory-passes';
const allowed=new Set([groundTruth,'always-blocks','strict-also-passes','uncertain']);
const parse=raw=>{
 let env; try{env=JSON.parse(raw)}catch{throw Error('model returned invalid provenance envelope')}
 if(typeof env?.text!=='string'||!env?.provenance?.response_id||!env?.provenance?.model)
   throw Error('model response missing actual provider provenance');
 let answer;try { const clean=env.text.trim().replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\x60{3}\s*$/,''); answer=JSON.parse(clean); } catch { throw Error('model must return structured JSON'); }
 if(!allowed.has(answer.finding)||typeof answer.reason!=='string'||answer.reason.length>1000)
   throw Error('invalid model answer contract');
 return {finding:answer.finding,reason:answer.reason,provenance:{model:env.provenance.model,response_id:env.provenance.response_id}};
};
const outDir=process.argv[2]||mkdtempSync(join(tmpdir(),'telos-live-mesh-'));
const gate={validateProposedStateChange:()=>({ok:false,reason:'read-only review cannot mutate authoritative state'}),escalate:()=>({accepted:true,id:'external-review-request'})};
const store=new ScopedTraceStore({dir:outDir,gate});
const {client,close}=spawnMcpClient({serverPath:resolve(root,'connectors/ai-peer-mcp/server.mjs')});
const ask=async(seat,system,context)=>{
 const prompt=[task,context,'Return JSON only: {"finding":"strict-blocks-advisory-passes|always-blocks|strict-also-passes|uncertain","reason":"short cited explanation"}'].join('\n\n');
 return parse(await client.callTool(seat.tool,{system,prompt,model:seat.modelName,include_provenance:true,max_tokens:700,effort:'medium'}));
};
const agents=[
 {id:'S1',run:async a=>{
   a.read();
   const first=await ask(seats[0],'Implementation specialist: reason only from code supplied.',verifySection);
   const origin=a.write({type:'claim',payload:{...first,source:'build-gate/build-orchestrator.mjs'}});
   const second=await a.waitFor(t=>t.author==='S2'&&t.response_to===origin.id);
   const third=await a.waitFor(t=>t.author==='S3');
   const peerContext=a.read().map(t=>({author:t.author,type:t.type,finding:t.payload.finding,reason:t.payload.reason}));
   const final=await ask(seats[0],'Recheck only with corroborated evidence; retain disagreements if unresolved.',
     'Implementation:\n'+dispatchSection+'\nTests:\n'+tests+'\nPeer traces:\n'+JSON.stringify(peerContext));
   a.read();
   return a.write({type:'result',payload:{...final,resolution:final.finding===first.finding?'unchanged':'corrected'},
     response_to:second.type==='contradiction'?second.id:third.type==='contradiction'?third.id:origin.id});
 }},
 {id:'S2',run:async a=>{
   const first=await a.waitFor(t=>t.author==='S1'&&t.type==='claim');
   const check=await ask(seats[1],'Test-contract specialist: determine expected behavior independently.',
     'Claim: '+first.payload.finding+'\nActual unit tests:\n'+tests);
   a.read();
   return a.write({type:check.finding===first.payload.finding?'evidence':'contradiction',
     payload:{...check,source:'build-gate/scripts/test-verify-stage.mjs'},response_to:first.id});
 }},
 {id:'S3',run:async a=>{
   const first=await a.waitFor(t=>t.author==='S1'&&t.type==='claim');
   const second=await a.waitFor(t=>t.author==='S2'&&t.response_to===first.id);
   const check=await ask(seats[2],'Independent cross-reference specialist: inspect both code and tests.',
     'Initial claim: '+first.payload.finding+'\nPeer: '+second.payload.finding+'; '+second.payload.reason+
     '\nImplementation:\n'+dispatchSection+'\nTests:\n'+tests);
   a.read();
   return a.write({type:check.finding===first.payload.finding?'evidence':'contradiction',
     payload:{...check,source:'build-gate/build-orchestrator.mjs + test-verify-stage.mjs'},
     response_to:second.type==='contradiction'?second.id:first.id});
 }}
];
try{
 const mesh=await deployMutualMesh({store,parentId:'build-team-parent',scope:'verify-stage:'+Date.now(),agents,
   criterion:{id:'checked-in-verify-contract',check:({traces})=>traces.some(t=>t.type==='result'&&t.payload.finding===groundTruth)},
   lifetimeMs:180000,maxWrites:16});
 const worker=await ask(seats[0],'Baseline worker: analyze source independently.',verifySection);
 const reviewer=await ask(seats[1],'Baseline reviewer: independently inspect full source and test suite.',
   'Worker: '+worker.finding+'\nFull source:\n'+sourceText+'\nFull tests:\n'+tests);
 const outcome={status:'MODEL_BACKED',task,mesh:{status:mesh.status,metrics:mesh.metrics,trace_ids:mesh.trace_ids},
   baseline:{worker_finding:worker.finding,reviewer_finding:reviewer.finding,
     reviewer_matches_source_contract:reviewer.finding===groundTruth},
   note:'Provider responses must carry server provenance. This comparison does not measure or claim lower inference cost.'};
 writeFileSync(join(outDir,'live-comparison.json'),JSON.stringify(outcome,null,2)+'\n');
 console.log(JSON.stringify(outcome,null,2));
 if(mesh.status!=='completed'||reviewer.finding!==groundTruth)process.exitCode=1;
}finally{close()}
