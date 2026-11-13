#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScopedTraceStore } from '../trace-mesh/trace-store.mjs';
import { deployMutualMesh } from '../trace-mesh/mutual-mesh.mjs';

let testCount=0;
async function test(name,fn){const dir=mkdtempSync(join(tmpdir(),'trace-mesh-'));try{await fn(dir);++testCount;console.log('PASS',name)}finally{rmSync(dir,{recursive:true,force:true})}}
function make(dir){const stats={gateCalls:0,escalations:0};const gate={validateProposedStateChange:({stateChange})=>{stats.gateCalls++;return {ok:stateChange?.allowed===true,reason:'hard invariant'}},escalate:()=>{stats.escalations++;return {accepted:true,id:'external-gate'}}};const store=new ScopedTraceStore({dir,gate});const s='task:'+Math.random();store.register({scope:s,parent:'P',members:['A','B','C'],expiresAtMs:Date.now()+2000,maxWrites:16,criterionId:'check'});return {store,s,stats}}
function throwsCode(fn,code){assert.throws(fn,e=>e.code===code)}
await test('requires three peers, excludes parent from participation',dir=>{
 const {store,s}=make(dir);assert.equal(store.status(s).team.length,3);throwsCode(()=>store.write(s,'P',{type:'info',payload:{text:'review'}}),'ACCESS_DENIED');throwsCode(()=>store.read(s,'stranger'),'ACCESS_DENIED');
});
await test('no ordinary direct-message API',dir=>{const {store}=make(dir);assert.equal(typeof store.sendToAgent,'undefined')});
await test('read-before-write and stale-context rejection',dir=>{
 const {store,s}=make(dir);throwsCode(()=>store.write(s,'A',{type:'info',payload:{q:1}}),'READ_REQUIRED');store.read(s,'A');store.read(s,'B');store.write(s,'A',{type:'claim',payload:{q:1}});throwsCode(()=>store.write(s,'B',{type:'info',payload:{q:2}}),'STALE_PEER_CONTEXT');store.read(s,'B');store.write(s,'B',{type:'contradiction',payload:{q:2}});
});
await test('typed trace schema and bounded payloads',dir=>{
 const {store,s}=make(dir);store.read(s,'A');throwsCode(()=>store.write(s,'A',{type:'new_unknown',payload:{}}),'INVALID_TYPE');throwsCode(()=>store.write(s,'A',{type:'info',payload:{raw:'x'.repeat(5000)}}),'PAYLOAD_TOO_LARGE');
});
await test('external invariant gate rejects state-change proposal before append',dir=>{
 const {store,s,stats}=make(dir);store.read(s,'A');throwsCode(()=>store.write(s,'A',{type:'result',payload:{state_change:{allowed:false,operation:'transfer_unique_item'}}}),'INVARIANT_REJECTED');store.close(s);assert.equal(store.read(s,'P').length,0);assert.equal(stats.gateCalls,1);
});
await test('permitted state proposal is a trace, never a world commit',dir=>{
 const {store,s,stats}=make(dir);store.read(s,'A');store.write(s,'A',{type:'result',payload:{state_change:{allowed:true,operation:'checked_only'}}});assert.equal(stats.gateCalls,1);store.close(s);assert.equal(store.read(s,'P').length,1);
});
await test('supersession leaves source history intact with filtered view',dir=>{
 const {store,s}=make(dir);store.read(s,'A');const first=store.write(s,'A',{type:'claim',payload:{text:'wrong'}});store.write(s,'A',{type:'result',payload:{text:'corrected'},supersedes:first.id});store.close(s);assert.equal(store.read(s,'P').length,1);assert.equal(store.read(s,'P',{includeSuperseded:true}).length,2);assert.equal(store.readDisk(s).length,2);
});
await test('scope bound and resource exhaustion',dir=>{
 const {store,s}=make(dir);throwsCode(()=>store.read('other','A'),'UNKNOWN_SCOPE');store.read(s,'A');for(let i=0;i<16;i++)store.write(s,'A',{type:'info',payload:{i}});throwsCode(()=>store.write(s,'A',{type:'info',payload:{i:16}}),'WRITE_BUDGET');
});
await test('unresolved exception escalates only through external gate',dir=>{
 const {store,s,stats}=make(dir);store.read(s,'A');const t=store.write(s,'A',{type:'danger',payload:{reason:'unknown'}});store.read(s,'A');store.escalateToGate(s,'A',{traceId:t.id,reason:'not-resolved'});assert.equal(stats.escalations,1);assert.equal(store.metrics(s).escalations_to_external_invariant_gate,1);
});
await test('local correction metrics count referenced peer response',dir=>{
 const {store,s}=make(dir);store.read(s,'A');store.read(s,'B');store.read(s,'C');const c=store.write(s,'A',{type:'contradiction',payload:{issue:'x'}});store.read(s,'B');store.write(s,'B',{type:'evidence',payload:{proof:true},response_to:c.id});store.read(s,'A');store.write(s,'A',{type:'result',payload:{resolution:'corrected'},response_to:c.id});const m=store.metrics(s);assert.ok(m.contradiction_first_peer_reaction_ms>=0);assert.equal(m.corrections_remaining_in_team.fraction,1);assert.equal(m.escalations_to_external_invariant_gate,0);
});
await test('parent may only read the final stigmergic trace',async dir=>{
 const {store}=make(dir);let parentReader='P';const agents=[{id:'D',run:({read,write})=>{read();write({type:'result',payload:{done:true}})}},{id:'E',run:({read})=>{read()}},{id:'F',run:({read})=>{read()}}];const out=await deployMutualMesh({store,parentId:parentReader,scope:'child:123',agents,criterion:{id:'has_result',check:({traces})=>traces.some(t=>t.type==='result')},lifetimeMs:300,maxWrites:5});assert.equal(out.status,'completed');assert.equal(store.read('child:123',parentReader).length,1);throwsCode(()=>store.write('child:123',parentReader,{type:'info',payload:{}}),'ACCESS_DENIED');
});
await test('outer peers can challenge a parent subteam deployment',async dir=>{
 const {store,s}=make(dir);const agents=['S1','S2','S3'].map(id=>({id,run:async({read})=>{read()}}));const out=await deployMutualMesh({store,parentId:'A',parentScope:s,scope:'sub:456',agents,criterion:{id:'no_artifact',check:()=>true},lifetimeMs:300,maxWrites:4});assert.equal(out.status,'completed');assert.equal(store.read(s,'B').filter(t=>t.type==='info'&&t.payload.deployment).length,1);
});
await test('no consensus is allowed to bypass TELOS',dir=>{
 const {store,s,stats}=make(dir);for(const id of ['A','B','C']){store.read(s,id);store.write(s,id,{type:'claim',payload:{approve:true}})}store.read(s,'A');throwsCode(()=>store.write(s,'A',{type:'result',payload:{state_change:{allowed:false},peers:'unanimous'}}),'INVARIANT_REJECTED');assert.equal(stats.gateCalls,1);
});
await test('exactly three callback agents required',async dir=>{
 const {store}=make(dir);await assert.rejects(deployMutualMesh({store,parentId:'P',scope:'few',agents:[{id:'A',run:()=>{}}],criterion:{id:'test',check:()=>true}}),e=>e.code==='INVALID_TEAM');
});


await test('gate is not called when peer has not read scope',dir=>{
 const {store,s,stats}=make(dir);store.read(s,'A');
 const e=store.write(s,'A',{type:'contradiction',payload:{issue:'unknown'}});
 throwsCode(()=>store.escalateToGate(s,'B',{traceId:e.id,reason:'dispute'}),'READ_REQUIRED');
 assert.equal(stats.escalations,0);
});
await test('gate is not called with stale peer context',dir=>{
 const {store,s,stats}=make(dir);store.read(s,'A');store.read(s,'B');
 const e=store.write(s,'A',{type:'contradiction',payload:{issue:'unknown'}});
 throwsCode(()=>store.escalateToGate(s,'B',{traceId:e.id,reason:'dispute'}),'STALE_PEER_CONTEXT');
 assert.equal(stats.escalations,0);
});
await test('gate is not called after scope closure',dir=>{
 const {store,s,stats}=make(dir);store.read(s,'A');
 const e=store.write(s,'A',{type:'contradiction',payload:{issue:'unknown'}});
 store.close(s);
 throwsCode(()=>store.escalateToGate(s,'A',{traceId:e.id,reason:'dispute'}),'EXPIRED_SCOPE');
 assert.equal(stats.escalations,0);
});
await test('rejected gate call preserves auditable request',dir=>{
 const gate={validateProposedStateChange:()=>({ok:true}),escalate:()=>({accepted:false})};
 const store=new ScopedTraceStore({dir,gate});
 const s='rejected-gate';
 store.register({scope:s,parent:'P',members:['A','B','C'],expiresAtMs:Date.now()+2000,criterionId:'check'});
 store.read(s,'A');const e=store.write(s,'A',{type:'contradiction',payload:{issue:'unknown'}});
 throwsCode(()=>store.escalateToGate(s,'A',{traceId:e.id,reason:'dispute'}),'ESCALATION_REJECTED');
 assert.equal(store.readDisk(s).length,2);
 store.close(s);assert.equal(store.read(s,'P')[1].payload.status,'requested');
 assert.equal(store.metrics(s).escalations_to_external_invariant_gate,1);
});
await test('throwing gate call preserves auditable request',dir=>{
 const gate={validateProposedStateChange:()=>({ok:true}),escalate:()=>{throw new Error('external-down')}};
 const store=new ScopedTraceStore({dir,gate});
 const s='throwing-gate';
 store.register({scope:s,parent:'P',members:['A','B','C'],expiresAtMs:Date.now()+2000,criterionId:'check'});
 store.read(s,'A');const e=store.write(s,'A',{type:'contradiction',payload:{issue:'unknown'}});
 assert.throws(()=>store.escalateToGate(s,'A',{traceId:e.id,reason:'dispute'}),/external-down/);
 assert.equal(store.readDisk(s).length,2);
 assert.equal(store.metrics(s).escalations_to_external_invariant_gate,0);
});

await test('parent cannot inspect an active team until it completes',dir=>{
 const {store,s}=make(dir);store.read(s,'A');
 store.write(s,'A',{type:'result',payload:{done:true}});
 throwsCode(()=>store.read(s,'P'),'PARENT_READ_EMBARGO');
 store.close(s);assert.equal(store.read(s,'P').length,1);
});
await test('spoofed danger trace cannot release parent embargo or count as external escalation',dir=>{
 const {store,s}=make(dir);store.read(s,'A');
 store.write(s,'A',{type:'danger',payload:{escalated_to:'TELOS',status:'requested',reason:'spoofed'}});
 throwsCode(()=>store.read(s,'P'),'PARENT_READ_EMBARGO');
 assert.equal(store.metrics(s).escalations_to_external_invariant_gate,0);
});
await test('accepted gate escalation opens parent read before team completion',dir=>{
 const {store,s}=make(dir);store.read(s,'A');
 const t=store.write(s,'A',{type:'contradiction',payload:{issue:'unresolved'}});
 throwsCode(()=>store.read(s,'P'),'PARENT_READ_EMBARGO');
 store.escalateToGate(s,'A',{traceId:t.id,reason:'unresolved matter'});
 assert.equal(store.read(s,'P').length,2);
 assert.equal(store.status(s).closed,false);
 assert.equal(store.metrics(s).escalations_to_external_invariant_gate,1);
});
await test('empty scope audit is an empty list without an on-disk trace file',dir=>{
 const {store,s}=make(dir);assert.deepEqual(store.readDisk(s),[]);
});
console.log('trace-mesh: '+testCount+' tests passed');
