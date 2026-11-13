#!/usr/bin/env node
// Real TELOS review task: interpret unknown-workstream routing against source and tests.
// Reads the actual files when invoked in an ordinary TELOS checkout.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ScopedTraceStore } from '../trace-mesh/trace-store.mjs';
import { deployMutualMesh } from '../trace-mesh/mutual-mesh.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(resolve(here,'../teams.mjs'),'utf8');
const tests=readFileSync(resolve(here,'test-teams.mjs'),'utf8');
const dest=process.argv[2]||resolve(here,'../../.trace-mesh-run');
mkdirSync(dest,{recursive:true});
const scope='TELOS:build-gate:teamForNode:route-audit:'+Date.now();
const gate={validateProposedStateChange:({stateChange})=>({ok:stateChange?.allowed===true,reason:'no unauthorized state write'}),escalate:()=>({accepted:true,id:'external-received'})};
const store=new ScopedTraceStore({dir:dest,gate});
const hasFallback=source.includes('return roster.find((t) => t.lifecycle === "build") || roster[0];');
const testExpectsFallback=tests.includes('unknown workstream falls back')||tests.includes('no/unknown workstream falls back');
const observed={fallbackInSource:hasFallback,sourceTestExpectsFallback:testExpectsFallback};
const agents=[
 {id:'S1',run:async ({read,write,waitFor})=>{
   read();
   const claim=write({type:'claim',payload:{finding:'An unmatched workstream should block automatically',source:'build-gate/teams.mjs',status:'provisional'}});
   const evidence=await waitFor(t=>t.type==='evidence' && t.payload?.supports==='intentional-fallback');
   read();
   return write({type:'result',payload:{resolution:'corrected',finding:'intentional-fallback',supported_by:[claim.id,evidence.id],statement:'Current TELOS contract intentionally routes unknown workstreams to the first build team; this is not a proven defect.'},response_to:evidence.response_to,supersedes:claim.id});
 }},
 {id:'S2',run:async ({waitFor,read,write})=>{
   const claim=await waitFor(t=>t.type==='claim');
   read();
   return write({type:'contradiction',payload:{finding:'The test suite explicitly expects fallback for no/unknown workstreams',source:'build-gate/scripts/test-teams.mjs',quote:'no/unknown workstream falls back to the first build team',evidence:observed.sourceTestExpectsFallback},response_to:claim.id});
 }},
 {id:'S3',run:async ({waitFor,read,write})=>{
   const contradiction=await waitFor(t=>t.type==='contradiction');
   read();
   return write({type:'evidence',payload:{supports:'intentional-fallback',source:'build-gate/teams.mjs',code:'return roster.find((t) => t.lifecycle === "build") || roster[0];',evidence:observed.fallbackInSource},response_to:contradiction.id});
 }}
];
const criterion={id:'TELOS-team-routing-contract-consistent',check:({traces,worldState})=>{
  const result=traces.find(t=>t.type==='result'&&t.payload.resolution==='corrected');
  return Boolean(worldState.fallbackInSource&&worldState.sourceTestExpectsFallback&&result?.payload.finding==='intentional-fallback'&&traces.some(t=>t.type==='contradiction')&&traces.some(t=>t.type==='evidence'));
}};
const outcome=await deployMutualMesh({store,parentId:'build-gate-team',scope,agents,criterion,lifetimeMs:3000,maxWrites:16,worldState:observed});
const record={task:'TELOS build-gate: reconcile teamForNode unknown-workstream fallback with source and tests',source_paths:['build-gate/teams.mjs','build-gate/scripts/test-teams.mjs'],evidence:observed,representation:'deterministic subagent callbacks reading current repository files; NOT model-backed inference',...outcome};
writeFileSync(resolve(dest,'run-result.json'),JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
if(outcome.status!=='completed')process.exitCode=1;
