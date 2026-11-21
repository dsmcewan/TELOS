#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScopedTraceStore } from '../trace-mesh/trace-store.mjs';
import { makeTELOSInvariantGate } from '../trace-mesh/telos-gate.mjs';
import { computePlan, writePlan } from '../../merkle-dag/merkle.mjs';
import { generateKeypair } from '../../merkle-dag/crypto.mjs';
import { PROPOSAL_KEY_ID, POLICY_CONTRACT_V1, POLICY_CHECK_KEYS, makeProposalEvent, atomicAppendProposalEvent, writeProposalArtifact } from '../../merkle-dag/proposal-ledger.mjs';

let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS',name); }
const plan={plan_hash:'sha256:case-one',nodes:[{id:'N1',files:['src/safe.mjs']}]};
const delta={action:'propose_node_delta',node_id:'N1',file_path:'src/safe.mjs',plan_hash:plan.plan_hash};
const request=d=>({scope:'node:N1',stateChange:d,invariantLink:plan.plan_hash});
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
 assert.equal(g.validateProposedStateChange({scope:'node:N1',stateChange:delta,invariantLink:'sha256:wrong'}).reason,'PLAN_HASH_MISMATCH');
});
test('gate refuses undeclared file and node',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 assert.equal(g.validateProposedStateChange(request({...delta,file_path:'src/other.mjs'})).reason,'NODE_FILE_NOT_DECLARED');
 assert.equal(g.validateProposedStateChange({scope:'node:N2',stateChange:{...delta,node_id:'N2'},invariantLink:plan.plan_hash}).reason,'NODE_FILE_NOT_DECLARED');
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
   store.register({scope:'node:N1',parent:'P',members:['A','B','C'],criterionId:'check',expiresAtMs:Date.now()+1000});
   store.read('node:N1','A');
   assert.throws(()=>store.write('node:N1','A',{type:'result',payload:{state_change:delta},invariant_link:plan.plan_hash}),e=>e.code==='INVARIANT_REJECTED');
   assert.deepEqual(store.readDisk('node:N1'),[]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('real signed TELOS authorization admits only a node proposal and blocks lifecycle drift',()=>{
 const ws=mkdtempSync(join(tmpdir(),'telos-mesh-signed-'));
 try {
   const telosDir=join(ws,'.telos'); mkdirSync(telosDir,{recursive:true});
   const {privatePem,publicJwk}=generateKeypair();
   const tasks=[{id:'N1',files:['src/safe.mjs'],requirements:'produce safe artifact',test:{cmd:'node',args:['-e','process.exit(0)']},dependencies:[]}];
   const computed=computePlan(tasks,{authorizedSigners:{[PROPOSAL_KEY_ID]:publicJwk}});
   assert.equal(computed.errors,undefined);
   const plan=computed.plan; writePlan(telosDir,plan);
   const checks=Object.fromEntries(POLICY_CHECK_KEYS.map(k=>[k,'pass']));
   const artifact={policy_contract_ref:POLICY_CONTRACT_V1,plan_hash:plan.plan_hash,outcome:'authorized',checks,blockers:[],findings:[],revision:{index:1,maximum:3}};
   const {ref}=writeProposalArtifact(telosDir,artifact);
   atomicAppendProposalEvent(telosDir,(parentHash,sequence)=>makeProposalEvent({
     proposal_id:'proposal-mesh',sequence,stage:'decision',plan_hash:plan.plan_hash,
     parent_event_hash:parentHash,artifact_refs:[ref],actor:{},provenance:null,
     policy_result:null,recorded_at:'t',decision:'authorized',policy_result_ref:ref
   },privatePem),{publicJwk});
   const proposed={action:'propose_node_delta',node_id:'N1',file_path:'src/safe.mjs',plan_hash:plan.plan_hash};
   const allowed=makeTELOSInvariantGate({telosDir,lifecycleVerify:()=>({ok:true})});
   assert.deepEqual(allowed.validateProposedStateChange({scope:'node:N1',stateChange:proposed,invariantLink:plan.plan_hash}),{
     ok:true,authorized_plan_hash:plan.plan_hash,decision:'TRACE_ADMISSION_ONLY'
   });
   const dir=join(ws,'trace');
   const store=new ScopedTraceStore({dir,gate:allowed});
   store.register({scope:'node:N1',parent:'P',members:['A','B','C'],criterionId:'signed',expiresAtMs:Date.now()+2000});
   store.read('node:N1','A');
   const trace=store.write('node:N1','A',{type:'claim',payload:{state_change:proposed},invariant_link:plan.plan_hash});
   assert.equal(trace.type,'claim');
   assert.equal(existsSync(join(ws,'src','safe.mjs')),false,'trace never writes the declared artifact');
   const stale=makeTELOSInvariantGate({telosDir,lifecycleVerify:()=>({ok:false,blockers:['hold after decision']})});
   assert.equal(stale.validateProposedStateChange({scope:'node:N1',stateChange:proposed,invariantLink:plan.plan_hash}).reason,'LIFECYCLE_STATE_DRIFT');
 }finally{rmSync(ws,{recursive:true,force:true});}
});


test('node-scoped gate refuses a proposal targeting another pod',()=>{
 const g=makeTELOSInvariantGate({...opts,authorize:authorized});
 assert.equal(g.validateProposedStateChange({scope:'node:N2',stateChange:delta,invariantLink:plan.plan_hash}).reason,'SCOPE_NODE_MISMATCH');
});

console.log('TELOS trace gate:',count,'tests passed');
