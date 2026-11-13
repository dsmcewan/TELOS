#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScopedTraceStore } from '../trace-mesh/trace-store.mjs';
import { makeTELOSInvariantGate } from '../trace-mesh/telos-gate.mjs';

let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS',name); }
const plan={plan_hash:'sha256:case-one',nodes:[{id:'N1',files:['src/safe.mjs']}]};
const delta={action:'propose_node_delta',node_id:'N1',file_path:'src/safe.mjs',plan_hash:plan.plan_hash};
const request=d=>({stateChange:d,invariantLink:plan.plan_hash});
const authorized=()=>({ok:true,planHash:plan.plan_hash});
const opts={telosDir:'/nonexistent-test-plan',loadPlan:()=>structuredClone(plan),lifecycleVerify:()=>({ok:true})};

test('gate refuses absent real plan',()=>{
 const g=makeTELOSInvariantGate({telosDir:'/no/real/plan',lifecycleVerify:()=>({ok:true})});
 assert.equal(g.validateProposedStateChange(request(delta)).ok,false);
});
test('gate refuses absent production lifecycle reverify',()=>{
 const g=makeTELOSInvariantGate({...opts,lifecycleVerify:undefined,authorize:authorized});
 assert.equal(g.validateProposedStateChange(request(delta)).reason,'LIFECYCLE_REVERIFY_REQUIRED');
});
test('gate refuses wrong plan hash and invariant pointer',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 assert.equal(g.validateProposedStateChange(request({...delta,plan_hash:'sha256:wrong'})).reason,'PLAN_HASH_MISMATCH');
 assert.equal(g.validateProposedStateChange({stateChange:delta,invariantLink:'sha256:wrong'}).reason,'PLAN_HASH_MISMATCH');
});
test('gate refuses undeclared file and node',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 assert.equal(g.validateProposedStateChange(request({...delta,file_path:'src/other.mjs'})).reason,'NODE_FILE_NOT_DECLARED');
 assert.equal(g.validateProposedStateChange(request({...delta,node_id:'N2'})).reason,'NODE_FILE_NOT_DECLARED');
});
test('gate refuses path traversal even when plan is mocked authorized',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 for(const bad of ['../.telos/plan.json','src/../safe.mjs','/etc/passwd','src\\safe.mjs','src/.telos/plan.json'])
   assert.equal(g.validateProposedStateChange(request({...delta,file_path:bad})).reason,'INVALID_NODE_DELTA');
});
test('gate refuses mutation/commit claims',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 for(const action of ['commit','world_state_change','transfer_item','write_file'])
   assert.equal(g.validateProposedStateChange(request({...delta,action})).reason,'UNSUPPORTED_STATE_ACTION');
});
test('default real TELOS authorization rejects unsigned invalid plan',()=>{
 const g=makeTELOSInvariantGate({...opts});
 assert.equal(g.validateProposedStateChange(request(delta)).ok,false);
});
test('authorized mock proof admits trace only, not execution',()=>{
 let calls=0;const g=makeTELOSInvariantGate({...opts,authorize:()=>{calls++;return authorized();}});
 const result=g.validateProposedStateChange(request(delta));
 assert.equal(result.ok,true);assert.equal(result.decision,'TRACE_ADMISSION_ONLY');assert.equal(calls,1);
});
test('no fake escalation receipt without external TELOS receiver',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 assert.equal(g.escalate({scope:'S',author:'A',traceId:'X',reason:'dispute',requestTraceId:'Y'}).accepted,false);
});
test('real external receiver response preserved but rejection not upgraded',()=>{
 const good=makeTELOSInvariantGate({...opts,authorize:authorized,onEscalation:()=>({accepted:true,id:'receipt-7'})});
 assert.equal(good.escalate({scope:'S',author:'A',traceId:'X',reason:'dispute',requestTraceId:'Y'}).id,'receipt-7');
 const bad=makeTELOSInvariantGate({...opts,authorize:authorized,onEscalation:()=>({accepted:false})});
 assert.equal(bad.escalate({scope:'S',author:'A',traceId:'X',reason:'dispute',requestTraceId:'Y'}).accepted,false);
});
test('trace store rejects unauthorized state delta before append',()=>{
 const dir=mkdtempSync(join(tmpdir(),'telos-trace-gate-'));
 try{
   const g=makeTELOSInvariantGate({...opts,authorize:()=>({ok:false,error:'DECISION_NOT_AUTHORIZED'})});
   const store=new ScopedTraceStore({dir,gate:g});
   store.register({scope:'S',parent:'P',members:['A','B','C'],criterionId:'check',expiresAtMs:Date.now()+1000});
   store.read('S','A');
   assert.throws(()=>store.write('S','A',{type:'result',payload:{state_change:delta},invariant_link:plan.plan_hash}),e=>e.code==='INVARIANT_REJECTED');
   assert.deepEqual(store.readDisk('S'),[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
console.log('TELOS trace gate:',count,'tests passed');
