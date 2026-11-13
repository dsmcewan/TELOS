// Bounded subteam invocation. The parent defines scope/criterion and is never
// a reviewer or participant in the three-peer loop. All communication is via store.
const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));

export async function deployMutualMesh({store,parentId,parentScope=null,scope,agents,criterion,lifetimeMs=5000,maxWrites=24,worldState=null}) {
  if (!criterion || typeof criterion.id!=='string' || typeof criterion.check!=='function') fail('INVALID_CRITERION','Host-owned deterministic criterion required');
  if (!Array.isArray(agents)||agents.length!==3||new Set(agents.map(x=>x.id)).size!==3||agents.some(x=>typeof x.run!=='function')) fail('INVALID_TEAM','Three distinct agent callbacks required');
  const expiresAtMs=Date.now()+lifetimeMs;
  if (!Number.isInteger(lifetimeMs)||lifetimeMs<10||lifetimeMs>60000) fail('INVALID_BOUNDS','Bounded team lifetime must be 10ms..60s');
  // If parent belongs to a parent mesh, document deployment in that mesh so
  // the parent's own peers can challenge the cost/scope afterward.
  if(parentScope){
    store.read(parentScope,parentId);
    store.write(parentScope,parentId,{type:'info',payload:{deployment:{scope,members:agents.map(a=>a.id),criterion:criterion.id,lifetimeMs,maxWrites}}});
  }
  store.register({scope,parent:parentId,members:agents.map(a=>a.id),expiresAtMs,maxWrites,criterionId:criterion.id,parentScope});
  const token={aborted:false};
  const actors=agents.map(agent=>{
    const api=Object.freeze({
      scope,
      id:agent.id,
      read:(options)=>store.read(scope,agent.id,options),
      write:(trace)=>store.write(scope,agent.id,trace),
      escalate:(args)=>store.escalateToGate(scope,agent.id,args),
      waitFor: async (match,{pollMs=2}={})=>{
        while(!token.aborted&&Date.now()<=expiresAtMs){
          const rows=store.read(scope,agent.id,{includeSuperseded:true});
          const hit=rows.find(match); if(hit) return hit;
          await delay(pollMs);
        }
        fail('LIFETIME_EXHAUSTED','Team lifetime ended while waiting for a trace');
      }
    });
    return Promise.resolve().then(()=>agent.run(api)).catch(e=>({error:e.code||e.message||String(e)}));
  });
  // Note: JS cannot forcibly stop arbitrary already-running callbacks; store
  // enforces the lifetime and write budget even if a callback ignores the token.
  let timeoutHandle;
  const timeout = new Promise(resolve => { timeoutHandle=setTimeout(()=>resolve({allSettled:false,results:[]}),lifetimeMs); });
  const result=await Promise.race([
    Promise.all(actors).then(x=>({allSettled:true,results:x})), timeout
  ]);
  clearTimeout(timeoutHandle);
  token.aborted=true;
  store.close(scope);
  const traces=store.read(scope,parentId,{includeSuperseded:true});
  const success=result.allSettled && result.results.every(x=>!x||!x.error) && criterion.check({traces,worldState})===true;
  return {scope,criterion:criterion.id,status:success?'completed':'unresolved',trace_ids:traces.map(t=>t.id),metrics:store.metrics(scope),outcome:result.allSettled?'settled':'timed_out'};
}
