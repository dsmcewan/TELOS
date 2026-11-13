// Scoped stigmergic trace store, v0.1. Zero runtime dependencies, single-process
// coordinator; the append-only JSONL file is an audit artifact, NOT world state.
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const TYPES = new Set(['claim', 'contradiction', 'evidence', 'result', 'danger', 'info']);
const reserved = new Set(['__proto__', 'constructor', 'prototype']);
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };
const clone = x => structuredClone(x);
const bounded = (s, limit) => typeof s === 'string' && s.trim().length > 0 && s.length <= limit && !reserved.has(s);

export class ScopedTraceStore {
  #scopes = new Map();
  #gate; #dir; #clock; #monotonic;
  constructor({ dir, gate, clock = () => Date.now(), monotonic = () => performance.now() }) {
    if (!dir || !gate || typeof gate.validateProposedStateChange !== 'function') fail('NO_GATE', 'A real external validation adapter is mandatory');
    this.#dir = dir;
    this.#gate = gate;
    this.#clock = clock;
    this.#monotonic = monotonic;
    mkdirSync(dir, {recursive: true});
  }
  register({ scope, parent, members, expiresAtMs, maxWrites = 32, criterionId, parentScope = null }) {
    if (!bounded(scope, 180) || !bounded(parent, 100) || !bounded(criterionId, 120)) fail('INVALID_SCOPE', 'Invalid scope or criterion');
    if (!Array.isArray(members) || members.length !== 3 || new Set(members).size !== 3 || members.some(m => !bounded(m, 100)) || members.includes(parent)) fail('INVALID_MESH', 'Exactly three distinct peers; parent outside the mesh');
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= this.#clock() || !Number.isInteger(maxWrites) || maxWrites < 1 || maxWrites > 1000) fail('INVALID_BOUNDS', 'Scope must have a finite lifetime and resource budget');
    if (this.#scopes.has(scope)) fail('DUPLICATE_SCOPE', 'Scope already registered');
    const file = join(this.#dir, createHash('sha256').update(scope).digest('hex') + '.jsonl');
    if (existsSync(file)) fail('DUPLICATE_SCOPE', 'Trace file already exists; no implicit replay/reuse');
    this.#scopes.set(scope, {scope, parent, members:new Set(members), membersList:[...members], expiresAtMs, maxWrites, criterionId, parentScope, traces:[], seen:new Map(), file, closed:false});
    return {scope, members:[...members], parent, criterionId, expiresAtMs, maxWrites, parentScope};
  }
  #get(scope) {
    const s=this.#scopes.get(scope);
    if (!s) fail('UNKNOWN_SCOPE', 'Unknown scope: ' + scope);
    return s;
  }
  read(scope, actor, { sinceVersion = 0, includeSuperseded = false } = {}) {
    const s=this.#get(scope);
    if (!s.members.has(actor) && actor!==s.parent) fail('ACCESS_DENIED', 'Actor does not share this scope');
    if (!Number.isInteger(sinceVersion) || sinceVersion < 0) fail('INVALID_CURSOR', 'Invalid version');
    // A read acknowledges all committed peer traces up to the current version.
    if (s.members.has(actor)) s.seen.set(actor, s.traces.length);
    const superseded = new Set(s.traces.map(t=>t.supersedes).filter(Boolean));
    return clone(s.traces.filter(t=>t.version>sinceVersion && (includeSuperseded || !superseded.has(t.id)) && (!t.expires_at || Date.parse(t.expires_at)>this.#clock())));
  }
  write(scope, author, {type,payload,intensity=null,supersedes=null,expiresAtMs=null,invariant_link=null,response_to=null} = {}) {
    const s=this.#get(scope);
    if (!s.members.has(author)) fail('ACCESS_DENIED', 'Only team peers may publish; parent is read-only');
    if (s.closed || this.#clock()>s.expiresAtMs) fail('EXPIRED_SCOPE','Scope closed/expired');
    if (s.traces.length>=s.maxWrites) fail('WRITE_BUDGET','Trace write budget exhausted');
    if (!TYPES.has(type)) fail('INVALID_TYPE','Trace type not in typed union');
    if (!payload || typeof payload!=='object' || Array.isArray(payload)) fail('INVALID_PAYLOAD','Payload must be a structured object');
    const payloadBytes=Buffer.byteLength(JSON.stringify(payload));
    if (payloadBytes>4096) fail('PAYLOAD_TOO_LARGE','Payload must remain narrow');
    const seen=s.seen.get(author);
    if (seen === undefined) fail('READ_REQUIRED','Read shared traces before acting');
    const newestPeerVersion=s.traces.reduce((v,t)=>t.author===author?v:Math.max(v,t.version),0);
    if (seen<newestPeerVersion) fail('STALE_PEER_CONTEXT','A peer published since last read; reread before acting');
    if (supersedes && !s.traces.some(t=>t.id===supersedes)) fail('INVALID_SUPERSESSION','Cannot supersede missing trace');
    if (response_to && !s.traces.some(t=>t.id===response_to)) fail('INVALID_REFERENCE','Response must reference an existing trace');
    if (expiresAtMs !== null && (!Number.isFinite(expiresAtMs) || expiresAtMs<=this.#clock())) fail('INVALID_EXPIRY','Invalid expiry');
    // This is a compulsory trust boundary: any *structured* state-change proposal
    // is validated by the injected external gate before entering the trace store.
    // Plain traces NEVER mutate world state. Unstructured text is never executable.
    if (Object.hasOwn(payload,'state_change')) {
      const decision=this.#gate.validateProposedStateChange({scope,actor:author,stateChange:clone(payload.state_change),invariantLink:invariant_link});
      if (!decision || decision.ok!==true) fail('INVARIANT_REJECTED',decision?.reason || 'TELOS rejected proposed world-state change');
    }
    const now=this.#clock();
    const trace={id:randomUUID(),scope,author,type,payload:clone(payload),intensity,version:s.traces.length+1,created_at:new Date(now).toISOString(),expires_at:expiresAtMs===null?null:new Date(expiresAtMs).toISOString(),supersedes,invariant_link,response_to};
    // Audit committed traces, but no state changes occur in this store.
    appendFileSync(s.file,JSON.stringify(trace)+'\n',{encoding:'utf8'});
    s.traces.push({...trace,monotonic_ms:this.#monotonic()});
    return clone(trace);
  }
  close(scope) { const s=this.#get(scope); s.closed=true; }
  status(scope) { const s=this.#get(scope); return {scope,criterionId:s.criterionId,closed:s.closed,writes:s.traces.length,remainingWrites:s.maxWrites-s.traces.length,team:[...s.membersList]}; }
  metrics(scope) {
    const s=this.#get(scope);
    const contradictions=s.traces.filter(t=>t.type==='contradiction');
    const delays=contradictions.map(t=>{
      const replies=s.traces.filter(p=>p.response_to===t.id&&p.author!==t.author&&p.monotonic_ms>=t.monotonic_ms);
      return replies.length?Math.min(...replies.map(p=>p.monotonic_ms-t.monotonic_ms)):null;
    }).filter(v=>v!==null);
    const corrections=s.traces.filter(t=>t.type==='result'&&t.payload.resolution==='corrected'&&t.response_to);
    const localCorrections=corrections.filter(t=>s.members.has(t.author)&&s.traces.some(src=>src.id===t.response_to&&src.scope===scope)).length;
    const toGate=s.traces.filter(t=>t.type==='danger'&&t.payload.escalated_to==='TELOS').length;
    return {
      contradiction_first_peer_reaction_ms:delays.length?Math.round(Math.min(...delays)*1000)/1000:null,
      corrections_remaining_in_team: {local:localCorrections,total:corrections.length,fraction:corrections.length?localCorrections/corrections.length:null},
      escalations_to_external_invariant_gate:toGate
    };
  }
  // This never creates a peer-to-peer message. It records a narrow unresolved
  // exception for the external gate, which may only block or route it higher.
  escalateToGate(scope,author,{traceId,reason}) {
    const s=this.#get(scope);
    if (!s.members.has(author)) fail('ACCESS_DENIED','Escalation must originate in the team');
    if (s.closed || this.#clock()>s.expiresAtMs) fail('EXPIRED_SCOPE','Closed/expired scope cannot escalate');
    if (s.traces.length>=s.maxWrites) fail('WRITE_BUDGET','No trace capacity for escalation');
    if (!s.traces.some(t=>t.id===traceId)) fail('INVALID_REFERENCE','Missing trace for escalation');
    if (typeof this.#gate.escalate !== 'function') fail('NO_ESCALATION_GATE','No external escalation adapter');
    if (typeof reason !== 'string' || reason.length<1 || reason.length>1000) fail('INVALID_REASON','Bounded escalation reason required');
    // Persist the request BEFORE contacting the external gate. Rejected calls
    // and transport failures still have an auditable origin. write() enforces
    // read-before-write, current context, resource and lifetime constraints.
    const trace=this.write(scope,author,{type:'danger',payload:{escalated_to:'TELOS',status:'requested',reason},response_to:traceId});
    const receipt=this.#gate.escalate({scope,author,traceId,reason,requestTraceId:trace.id});
    if (!receipt || receipt.accepted!==true) fail('ESCALATION_REJECTED','External gate did not accept unresolved dispute; request trace persists');
    return {...trace,receipt_id:receipt.id||'accepted'};
  }
  // Read-only audit replay; no claims that it is a cross-process transactional DB.
  readDisk(scope) {const s=this.#get(scope); return readFileSync(s.file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));}
}
