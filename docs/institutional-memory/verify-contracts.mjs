#!/usr/bin/env node
// verify-contracts.mjs — the "system reality" half of the institutional-memory
// layer. A machine-readable CONTRACT (clotho/memory/CONTRACTS/*.json) is only
// trustworthy as a VERIFIED PROJECTION of the running code. This script proves each
// NORMATIVE contract equals what the code actually enforces, and that
// CURRENT-AUTHORITY.json matches the plan bytes on disk. Same fail-closed discipline
// as the build-gate: never trust a document's self-report.
//
//   node docs/institutional-memory/verify-contracts.mjs
//   exit 0 => every checked contract == system reality; exit 2 => drift found.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const readJson = (rel) => JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
const { canonicalize, sha256hex } = await imp("merkle-dag/vendor.mjs");

const results = [];
const check = (id, ok, detail) => results.push({ id, ok, detail });
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const deepEq = (a, b) => canonicalize(a) === canonicalize(b);

// ---- 1. CURRENT-AUTHORITY.json active plan hash == disk ------------------------
try {
  const auth = readJson("CURRENT-AUTHORITY.json");
  const active = auth.active_plan;
  const real = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: readFileSync(path.join(ROOT, active.path), "utf8") }));
  check("authority:active-plan-hash", real === active.sha256, `disk=${real} record=${active.sha256}`);
  // every superseded plan hash is also verifiable from disk
  for (const s of auth.superseded || []) {
    const rp = "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: readFileSync(path.join(ROOT, superPath(s.plan_version)), "utf8") }));
    check(`authority:superseded-${s.plan_version}-hash`, rp === s.sha256, `disk=${rp} record=${s.sha256}`);
  }
} catch (e) { check("authority:read", false, e.message); }

function superPath(v) {
  const map = { v11: "docs/runs/clotho-daedalus-delta10/matured-plan-v11.md", v12: "docs/runs/clotho-daedalus-delta11/matured-plan-v12.md", v13: "docs/runs/clotho-daedalus-delta12/matured-plan-v13.md", v14: "docs/runs/clotho-daedalus-delta13/matured-plan-v14.md" };
  return map[v];
}

// ---- 2. clotho package-roots contract == inventory.mjs -------------------------
try {
  const contract = readJson("clotho/memory/CONTRACTS/package-roots.json");
  const inv = await imp("clotho/inventory.mjs");
  check("contract:package-roots==PACKAGE_ROOTS", eqArr(contract.package_roots, inv.PACKAGE_ROOTS), `contract=${JSON.stringify(contract.package_roots)} code=${JSON.stringify(inv.PACKAGE_ROOTS)}`);
  check("contract:package-roots-exclude==PACKAGE_ROOTS_EXCLUDE", eqArr(contract.package_roots_exclude, inv.PACKAGE_ROOTS_EXCLUDE), `contract=${JSON.stringify(contract.package_roots_exclude)} code=${JSON.stringify(inv.PACKAGE_ROOTS_EXCLUDE)}`);
} catch (e) { check("contract:package-roots", false, e.message); }

// ---- 2b. inventory-id-table contract == inventory.REQUIRED_INVENTORY_IDS -------
try {
  const contract = readJson("clotho/memory/CONTRACTS/inventory-id-table.json");
  const inv = await imp("clotho/inventory.mjs");
  check("contract:inventory-id-table==REQUIRED_INVENTORY_IDS", deepEq(contract.required_inventory_ids, inv.REQUIRED_INVENTORY_IDS), "compared canonical JSON");
} catch (e) { check("contract:inventory-id-table", false, e.message); }

// ---- 2c. loader-safe-exports contract == inventory.LOADER_CAPABLE... -----------
try {
  const contract = readJson("clotho/memory/CONTRACTS/loader-safe-exports.json");
  const inv = await imp("clotho/inventory.mjs");
  check("contract:loader-safe-exports==LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS", deepEq(contract.loader_capable_builtin_safe_exports, inv.LOADER_CAPABLE_BUILTIN_SAFE_EXPORTS), "compared canonical JSON");
} catch (e) { check("contract:loader-safe-exports", false, e.message); }

// ---- 3. discipline: NORMATIVE has an oracle; SPECIFIED-PENDING has becomes_normative_when
const CONTRACT_FILES = [
  "package-roots", "inventory-id-table", "loader-safe-exports", "source-profile", "git-allowlist",
  "coverage-schema", "verified-by-provenance", "discharges-matrix"
];
for (const name of CONTRACT_FILES) {
  try {
    const c = readJson(`clotho/memory/CONTRACTS/${name}.json`);
    if (c.status === "SPECIFIED-PENDING-IMPLEMENTATION") {
      const ok = typeof c.becomes_normative_when === "string" && c.becomes_normative_when.length > 0;
      check(`discipline:pending-has-becomes-normative-when(${name})`, ok, ok ? `becomes NORMATIVE when: ${c.becomes_normative_when}` : "SPECIFIED-PENDING but no becomes_normative_when");
    } else {
      const hasOracle = c.normativity === "NORMATIVE" ? (c.oracle && Object.keys(c.oracle).length > 0) : true;
      check(`discipline:normative-has-oracle(${name})`, !!hasOracle, `${c.normativity} oracle=${c.oracle ? "present" : "MISSING"}`);
    }
  } catch (e) { check(`discipline:contract(${name})`, false, e.message); }
}

// ---- 3b. same discipline over the component INVARIANTS ------------------------
try {
  for (const inv of readJson("clotho/memory/INVARIANTS.json")) {
    if (inv.status === "SPECIFIED-PENDING-IMPLEMENTATION") {
      const ok = typeof inv.becomes_normative_when === "string" && inv.becomes_normative_when.length > 0;
      check(`discipline:pending-invariant(${inv.id})`, ok, ok ? `becomes NORMATIVE when: ${inv.becomes_normative_when}` : "SPECIFIED-PENDING but no becomes_normative_when");
    } else if (inv.normativity === "NORMATIVE") {
      const ok = inv.oracle && Object.keys(inv.oracle).length > 0;
      check(`discipline:normative-invariant(${inv.id})`, !!ok, ok ? "oracle present" : "NORMATIVE but no oracle");
    }
  }
} catch (e) { check("discipline:invariants", false, e.message); }

// ---- 4. role modules (docs/institutional-memory/<role>/) -----------------------
// Role modules are enumerated FROM DISK (readdirSync), not a hand-list — any
// institutional-memory subdirectory carrying a CONTRACTS/ dir is swept, so a new
// module or a new contract file cannot be silently skipped.
const IM_DIR = path.join(ROOT, "docs/institutional-memory");
const roleModules = readdirSync(IM_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(path.join(IM_DIR, d.name, "CONTRACTS")))
  .map((d) => d.name);
for (const mod of roleModules) {
  const cdir = path.join(IM_DIR, mod, "CONTRACTS");
  for (const f of readdirSync(cdir).filter((n) => n.endsWith(".json"))) {
    try {
      const c = JSON.parse(readFileSync(path.join(cdir, f), "utf8"));
      const name = `${mod}/${f}`;
      if (c.status === "SPECIFIED-PENDING-IMPLEMENTATION") {
        const ok = typeof c.becomes_normative_when === "string" && c.becomes_normative_when.length > 0;
        check(`discipline:pending-has-becomes-normative-when(${name})`, ok, ok ? `becomes NORMATIVE when: ${c.becomes_normative_when}` : "SPECIFIED-PENDING but no becomes_normative_when");
      } else {
        const hasOracle = c.normativity === "NORMATIVE" ? (c.oracle && Object.keys(c.oracle).length > 0) : true;
        check(`discipline:normative-has-oracle(${name})`, !!hasOracle, `${c.normativity} oracle=${c.oracle ? "present" : "MISSING"}`);
      }
    } catch (e) { check(`discipline:contract(${mod}/${f})`, false, e.message); }
  }
  const invPath = path.join(IM_DIR, mod, "INVARIANTS.json");
  if (existsSync(invPath)) {
    try {
      for (const inv of JSON.parse(readFileSync(invPath, "utf8"))) {
        if (inv.status === "SPECIFIED-PENDING-IMPLEMENTATION") {
          const ok = typeof inv.becomes_normative_when === "string" && inv.becomes_normative_when.length > 0;
          check(`discipline:pending-invariant(${mod}/${inv.id})`, ok, ok ? `becomes NORMATIVE when: ${inv.becomes_normative_when}` : "SPECIFIED-PENDING but no becomes_normative_when");
        } else if (inv.normativity === "NORMATIVE") {
          const ok = inv.oracle && Object.keys(inv.oracle).length > 0;
          check(`discipline:normative-invariant(${mod}/${inv.id})`, !!ok, ok ? "oracle present" : "NORMATIVE but no oracle");
        }
      }
    } catch (e) { check(`discipline:invariants(${mod})`, false, e.message); }
  }
}

// ---- 4a. daedalus: workshop-protocol contract == build-gate/daedalus.mjs -------
// The constants are deep-equaled and the state machine is PROBED (each claimed
// terminal is reached through the real deriveWorkshopState/deriveParallelState),
// so the contract cannot describe a protocol the code does not enforce.
try {
  const c = readJson("docs/institutional-memory/daedalus/CONTRACTS/workshop-protocol.json");
  const dd = await imp("build-gate/daedalus.mjs");
  check("daedalus:serial.seats==DAEDALUS_SEATS", eqArr(c.serial.seats, dd.DAEDALUS_SEATS), `contract=${JSON.stringify(c.serial.seats)} code=${JSON.stringify(dd.DAEDALUS_SEATS)}`);
  check("daedalus:serial.max_rounds==DAEDALUS_MAX_ROUNDS", c.serial.max_rounds === dd.DAEDALUS_MAX_ROUNDS, `contract=${c.serial.max_rounds} code=${dd.DAEDALUS_MAX_ROUNDS}`);
  check("daedalus:parallel.roles==PARALLEL_ROLES", deepEq(c.parallel.roles, dd.PARALLEL_ROLES), "compared canonical JSON");
  check("daedalus:parallel.obligation_fields==OBLIGATION_FIELDS", eqArr(c.parallel.obligation_fields, dd.OBLIGATION_FIELDS), "compared arrays");

  const cleanRound = {
    round: 1, input_plan_artifact_hash: "c0", output_plan_artifact_hash: "c1",
    author: { seat: "claude", provenance_key: "anthropic:probe-a1" },
    reviewer: { seat: "codex", provenance_key: "openai:probe-b1", bound_hash: "c1" },
    objections: [], resolutions: [], supersessions: [], withdrawals: []
  };
  const conv = dd.deriveWorkshopState({ rounds: [cleanRound], maxRounds: dd.DAEDALUS_MAX_ROUNDS, initialCandidateRef: "c0" });
  check("daedalus:probe-converged-terminal", conv.state === "converged-for-submission" && conv.terminal === c.serial.terminals["converged-for-submission"],
    `state=${conv.state} terminal=${conv.terminal} contract=${c.serial.terminals["converged-for-submission"]}`);
  const obj = { scope: "probe", claim: "unresolved", evidence_refs: [] };
  const stale = dd.deriveWorkshopState({
    rounds: [
      { ...cleanRound, objections: [obj] },
      { ...cleanRound, round: 2, input_plan_artifact_hash: "c1", output_plan_artifact_hash: "c1", author: { seat: "codex", provenance_key: "openai:probe-b2" }, reviewer: { seat: "claude", provenance_key: "anthropic:probe-a2", bound_hash: "c1" } }
    ], maxRounds: dd.DAEDALUS_MAX_ROUNDS, initialCandidateRef: "c0"
  });
  check("daedalus:probe-stalemate-terminal", stale.state === "stalemate" && stale.terminal === c.serial.terminals.stalemate,
    `state=${stale.state} terminal=${stale.terminal} contract=${c.serial.terminals.stalemate}`);

  const row = { invariant: "i", mechanism: "m", task: "t", negative_test: "n", exit_criterion: "e", obligation_id: "OBL-1" };
  const sources = [
    { role: "constraints", seat: "codex", artifact_ref: "s1", obligations: ["OBL-1"], provenance_key: "openai:probe-k1" },
    { role: "implementation", seat: "claude", artifact_ref: "s2", provenance_key: "anthropic:probe-k2" }
  ];
  const integration = { candidate_ref: "cand", descends_from: ["s1", "s2"], obligation_matrix: [row], provenance_key: "anthropic:probe-k3" };
  const verify = (vc, vi, viKey = "anthropic:probe-k5") => dd.deriveParallelState({ sources, integration, verifications: [
    { role: "constraints", verdict: vc, conflicts: vc === "violated" ? ["probe"] : [], provenance_key: "openai:probe-k4" },
    { role: "implementation", verdict: vi, conflicts: [], provenance_key: viKey }
  ] });
  const par = verify("preserved", "preserved");
  check("daedalus:probe-parallel-converged-terminal", par.state === "converged-parallel" && par.terminal === c.parallel.terminals["converged-parallel"],
    `state=${par.state} terminal=${par.terminal} contract=${c.parallel.terminals["converged-parallel"]}`);
  const con = verify("violated", "preserved");
  check("daedalus:probe-conflict-terminal", con.state === "conflict" && con.terminal === c.parallel.terminals.conflict,
    `state=${con.state} terminal=${con.terminal} contract=${c.parallel.terminals.conflict}`);
  // replaying the integrator's key on a verifier must refuse convergence (the 5-distinct rule, probed)
  const reused = verify("preserved", "preserved", "anthropic:probe-k3");
  check("daedalus:probe-provenance-reuse-refused", reused.state === "continue" && reused.reason === "provenance-reused-across-calls",
    `state=${reused.state} reason=${reused.reason}`);
} catch (e) { check("daedalus:workshop-protocol", false, e.message); }

// ---- 4b. daedalus: plan-version-chain contract == disk + CURRENT-AUTHORITY -----
try {
  const c = readJson("docs/institutional-memory/daedalus/CONTRACTS/plan-version-chain.json");
  const auth = readJson("CURRENT-AUTHORITY.json");
  const hashOf = (rel) => "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: readFileSync(path.join(ROOT, rel), "utf8") }));
  for (const entry of c.chain) {
    const real = hashOf(entry.path);
    check(`daedalus:chain-${entry.version}-hash`, real === entry.sha256, `disk=${real} contract=${entry.sha256}`);
  }
  const active = c.chain.filter((e) => e.active);
  check("daedalus:chain-exactly-one-active", active.length === 1, `active entries=${active.length}`);
  check("daedalus:chain-head==authority.active_plan", active.length === 1 && active[0].sha256 === auth.active_plan.sha256 && active[0].path === auth.active_plan.path,
    active.length === 1 ? `chain=${active[0].sha256} authority=${auth.active_plan.sha256}` : "no single active entry");
  const superByVersion = new Map((auth.superseded || []).map((s) => [s.plan_version, s]));
  for (const entry of c.chain.filter((e) => !e.active)) {
    const s = superByVersion.get(entry.version);
    check(`daedalus:chain-${entry.version}==superseded-record`,
      !!s && s.sha256 === entry.sha256 && s.authorization === entry.authorization && s.authz_status === entry.authz_status,
      s ? `authority=${s.sha256} ${s.authorization}/${s.authz_status}` : "no matching superseded record in CURRENT-AUTHORITY");
  }
  const chainVersions = new Set(c.chain.map((e) => e.version));
  const missing = [auth.active_plan.version, ...(auth.superseded || []).map((s) => s.plan_version)].filter((v) => !chainVersions.has(v));
  check("daedalus:chain-covers-authority", missing.length === 0, missing.length ? `missing versions: ${missing.join(",")}` : "every authority-named version present");
} catch (e) { check("daedalus:plan-version-chain", false, e.message); }

// ---- 5a. telos: authorization-chain contract == records on disk + authority ----
try {
  const c = readJson("docs/institutional-memory/telos/CONTRACTS/authorization-chain.json");
  const auth = readJson("CURRENT-AUTHORITY.json");
  const hashOf = (rel) => "sha256:" + sha256hex(canonicalize({ kind: "candidate", plan: readFileSync(path.join(ROOT, rel), "utf8") }));
  for (const entry of c.chain) {
    try {
      const rec = readJson(entry.record);
      const idOk = typeof rec.build_id === "string" && rec.build_id.endsWith(entry.id);
      const statusOk = rec.authorization && rec.authorization.status === entry.status && rec.authorized === entry.authorized;
      const planOk = rec.plan_ref === entry.plan_ref;
      const signedOk = rec.trust_mode === entry.trust_mode;
      check(`telos:${entry.id}-record`, idOk && statusOk && planOk && signedOk,
        `record=${entry.record} build_id=${rec.build_id} status=${rec.authorization && rec.authorization.status} plan_ref=${(rec.plan_ref || "").slice(0, 20)}… trust=${rec.trust_mode}`);
      if (entry.plan_path) {
        const real = hashOf(entry.plan_path);
        check(`telos:${entry.id}-plan-hash`, real === entry.plan_ref, `disk=${real} contract=${entry.plan_ref}`);
      }
    } catch (e) { check(`telos:${entry.id}-record`, false, e.message); }
  }
  const active = c.chain.filter((e) => e.active);
  check("telos:chain-exactly-one-active", active.length === 1, `active entries=${active.length}`);
  check("telos:chain-active==authority.active_authorization",
    active.length === 1 && active[0].id === auth.active_authorization.id && active[0].record === auth.active_authorization.record
      && active[0].status === auth.active_authorization.status && active[0].plan_ref === auth.active_authorization.authorizes_plan,
    active.length === 1 ? `chain=${active[0].id}/${active[0].status} authority=${auth.active_authorization.id}/${auth.active_authorization.status}` : "no single active entry");
  const byId = new Map(c.chain.map((e) => [e.id, e]));
  for (const s of auth.superseded || []) {
    const e = byId.get(s.authorization);
    check(`telos:chain-${s.authorization}==superseded-record`, !!e && e.status === s.authz_status && e.plan_ref === s.sha256,
      e ? `chain=${e.status}/${e.plan_ref.slice(0, 20)}… authority=${s.authz_status}/${s.sha256.slice(0, 20)}…` : "authorization named by CURRENT-AUTHORITY missing from chain");
  }
} catch (e) { check("telos:authorization-chain", false, e.message); }

// ---- 5b. telos: authorization-protocol contract == council roster + evidence ---
try {
  const c = readJson("docs/institutional-memory/telos/CONTRACTS/authorization-protocol.json");
  const auth = readJson("CURRENT-AUTHORITY.json");
  const council = await imp("build-gate/council.mjs");
  const seats = council.planSeats({});
  const approvers = seats.filter((s) => s.role === "approver").map((s) => s.model);
  const advisory = seats.filter((s) => s.role === "advisory").map((s) => s.model);
  check("telos:required_seats==planSeats-approvers", eqArr(c.required_seats, approvers), `contract=${JSON.stringify(c.required_seats)} planSeats=${JSON.stringify(approvers)}`);
  check("telos:advisory_seats==planSeats-advisory", eqArr(c.advisory_seats, advisory), `contract=${JSON.stringify(c.advisory_seats)} planSeats=${JSON.stringify(advisory)}`);
  check("telos:required_seats==authority.required_seats", eqArr(c.required_seats, auth.active_authorization.required_seats), `contract=${JSON.stringify(c.required_seats)} authority=${JSON.stringify(auth.active_authorization.required_seats)}`);
  // evidence probes — the recorded pass enforced both blockers; the recorded refusal carries the dissent
  const pass = readJson("docs/runs/clotho-authorization-8/authorization-summary.json");
  check("telos:authz-008-dual-enforcement", pass.gate && pass.gate.gate_status === "pass" && pass.gate.signing_enforced === true && pass.gate.provenance_enforced === true,
    `gate_status=${pass.gate && pass.gate.gate_status} signing=${pass.gate && pass.gate.signing_enforced} provenance=${pass.gate && pass.gate.provenance_enforced}`);
  const refusal = readJson("docs/runs/clotho-authorization-7/authorization-summary.json");
  const dissent = refusal.gate && Array.isArray(refusal.gate.blockers) && refusal.gate.blockers.some((b) => /codex decision is 'revise'/.test(b));
  check("telos:authz-007-dissent-blocker", refusal.gate && refusal.gate.gate_status === "blocked" && dissent,
    `gate_status=${refusal.gate && refusal.gate.gate_status} codex-revise-blocker=${!!dissent}`);
} catch (e) { check("telos:authorization-protocol", false, e.message); }

// ---- 6a. argo: accepted-slices contract == CURRENT-AUTHORITY + slice evidence --
try {
  const c = readJson("docs/institutional-memory/argo/CONTRACTS/accepted-slices.json");
  const ia = readJson("CURRENT-AUTHORITY.json").implementation_authority;
  check("argo:holder==authority.holder", c.holder === ia.holder, `contract=${c.holder} authority=${ia.holder}`);
  check("argo:governs==authority.governs", c.governs === ia.governs, `contract=${c.governs.slice(0, 24)}… authority=${ia.governs.slice(0, 24)}…`);
  check("argo:next_slice==authority.next_slice", c.next_slice === ia.next_slice, `contract=${c.next_slice} authority=${ia.next_slice}`);
  check("argo:pending==authority.pending", eqArr(c.specified_pending_slices, ia.specified_pending_slices), `contract=${JSON.stringify(c.specified_pending_slices)} authority=${JSON.stringify(ia.specified_pending_slices)}`);
  const authByTask = new Map((ia.accepted_slices || []).map((s) => [s.task, s]));
  check("argo:accepted-count==authority", c.accepted.length === (ia.accepted_slices || []).length, `contract=${c.accepted.length} authority=${(ia.accepted_slices || []).length}`);
  for (const slice of c.accepted) {
    const a = authByTask.get(slice.task);
    check(`argo:slice-${slice.task}==authority`, !!a && a.pr === slice.pr && a.merge_anchor === slice.merge_anchor && a.reviewed_head === slice.reviewed_head && a.deferred_backlog === slice.deferred_backlog,
      a ? `authority pr=${a.pr} merge=${a.merge_anchor} head=${a.reviewed_head}` : "task missing from CURRENT-AUTHORITY.accepted_slices");
    check(`argo:slice-${slice.task}-backlog-exists`, existsSync(path.join(ROOT, slice.deferred_backlog)), slice.deferred_backlog);
    try {
      const rev = readJson(slice.final_review_record);
      const headOk = "git:" + (rev.pr_head || "").slice(0, 7) === slice.reviewed_head;
      check(`argo:slice-${slice.task}-review-record`, rev.pr === slice.pr && headOk && rev.trust_mode === "signed" && eqArr(rev.ephemeral_signers, ["claude", "agy", "codex"]),
        `pr=${rev.pr} head=${(rev.pr_head || "").slice(0, 7)} trust=${rev.trust_mode} signers=${JSON.stringify(rev.ephemeral_signers)}`);
      const gateRes = readJson(slice.slice_gate_result);
      check(`argo:slice-${slice.task}-gate-meets`, gateRes.finalStatus === "meets" && gateRes.converged === true, `finalStatus=${gateRes.finalStatus} converged=${gateRes.converged}`);
    } catch (e) { check(`argo:slice-${slice.task}-records`, false, e.message); }
  }
  for (const task of c.specified_pending_slices) {
    const q = `clotho/memory/comprehension-queries.${task}.json`;
    check(`argo:pending-${task}-queries-exist`, existsSync(path.join(ROOT, q)), q);
  }
} catch (e) { check("argo:accepted-slices", false, e.message); }

// ---- 6b. argo: implementation-protocol — EXECUTE the entry ritual both ways ----
// The comprehension gate is not paraphrased; it is run. The correct example reader
// must be GRANTED (exit 0) and the hallucinating reader DENIED (exit 3), proving
// the fail-closed entry ritual a future implementer will actually face.
try {
  const gate = path.join(HERE, "comprehension-gate.mjs");
  const run = (answers) => spawnSync(process.execPath, [gate, path.join(ROOT, "clotho/memory/comprehension-queries.json"), path.join(HERE, "examples", answers)], { encoding: "utf8" });
  const ok = run("reader-correct.json");
  check("argo:entry-ritual-grants-correct-reader", ok.status === 0, `exit=${ok.status} (expected 0)`);
  const bad = run("reader-hallucinating.json");
  check("argo:entry-ritual-denies-hallucinating-reader", bad.status === 3, `exit=${bad.status} (expected 3)`);
} catch (e) { check("argo:implementation-protocol", false, e.message); }

// ---- 7a. loadout: seat-backends contract == seat-registry.mjs ------------------
try {
  const c = readJson("docs/institutional-memory/loadout/CONTRACTS/seat-backends.json");
  const sr = await imp("build-gate/seat-registry.mjs");
  const reg = sr.defaultSeatRegistry({ dir: "__PROBE__" });
  // every contract route == the built registry (server, tool, argMap presence) — both directions
  const contractTools = Object.keys(c.tool_routes).sort();
  const regTools = Object.keys(reg.tools).sort();
  check("loadout:tool-set==registry", eqArr(contractTools, regTools), `contract=${JSON.stringify(contractTools)} registry=${JSON.stringify(regTools)}`);
  for (const [tool, route] of Object.entries(c.tool_routes)) {
    const r = reg.tools[tool];
    const ok = r && r.server === route.server && r.tool === route.tool && (typeof r.argMap === "function") === route.arg_map;
    check(`loadout:route-${tool}`, !!ok, r ? `registry=${r.server}:${r.tool} argMap=${typeof r.argMap === "function"}` : "tool missing from registry");
  }
  const contractServers = Object.keys(c.servers).sort();
  const regServers = Object.keys(reg.servers).sort();
  check("loadout:server-set==registry", eqArr(contractServers, regServers), `contract=${JSON.stringify(contractServers)} registry=${JSON.stringify(regServers)}`);
  for (const [name, s] of Object.entries(c.servers)) {
    const r = reg.servers[name];
    check(`loadout:server-${name}-framing`, !!r && r.framing === s.framing, r ? `registry=${r.framing} contract=${s.framing}` : "server missing");
  }
  // no-shadow probe: a loadout server named like a seat server must NOT displace it,
  // and tool routes must be untouched.
  const shadowed = sr.withLoadout(reg, { "ai-peer": { command: "evil", serverPath: "evil.mjs", framing: "ndjson" } });
  check("loadout:probe-no-shadow-server", shadowed.servers["ai-peer"].serverPath === reg.servers["ai-peer"].serverPath && shadowed.servers["ai-peer"].command !== "evil",
    `ai-peer serverPath after shadow attempt: ${shadowed.servers["ai-peer"].serverPath.endsWith("server.mjs") ? "registry wins" : "SHADOWED"}`);
  check("loadout:probe-tools-untouched", canonicalize(shadowed.tools) === canonicalize(reg.tools), "withLoadout must not alter council tool routes");
  // a genuinely new loadout server IS admitted (the mechanism works)
  const extended = sr.withLoadout(reg, { docs: { command: "node", serverPath: "docs.mjs", framing: "ndjson" } });
  check("loadout:probe-extension-admitted", !!extended.servers.docs && !!extended.servers["ai-peer"], `docs server present=${!!extended.servers.docs}`);
} catch (e) { check("loadout:seat-backends", false, e.message); }

// ---- 7b. loadout: capability-packet contract == worked fixtures ----------------
try {
  const c = readJson("docs/institutional-memory/loadout/CONTRACTS/capability-packet.json");
  const example = readJson("build-gate/examples/capability-blocked/capabilities/claude.json");
  const exampleFields = Object.keys(example).sort();
  const contractFields = [...c.fields].sort();
  check("loadout:capability-fields==worked-example", eqArr(contractFields, exampleFields), `contract=${contractFields.length} fields, example=${exampleFields.length} fields${eqArr(contractFields, exampleFields) ? "" : ` diff=${JSON.stringify(contractFields.filter((f) => !exampleFields.includes(f)).concat(exampleFields.filter((f) => !contractFields.includes(f))))}`}`);
  check("loadout:capability-blocked-fixture", existsSync(path.join(ROOT, "build-gate/examples/capability-blocked/dossier.json")), "fail-closed worked example present");
  check("loadout:capability-pass-fixture", existsSync(path.join(ROOT, "build-gate/examples/prototype-pass/capabilities/claude.json")), "passing worked example present");
} catch (e) { check("loadout:capability-packet", false, e.message); }

// ---- 7c. loadout: a per-task review exists for every pending slice -------------
try {
  const ia = readJson("CURRENT-AUTHORITY.json").implementation_authority;
  for (const task of ia.specified_pending_slices || []) {
    const p = `docs/institutional-memory/loadout/TASK-LOADOUTS/task-${task}.json`;
    let ok = existsSync(path.join(ROOT, p));
    let detail = p;
    if (ok) {
      const rec = readJson(p);
      ok = rec.task === task && rec.normativity === "ADVISORY" && typeof rec.entry_ritual === "string" && Array.isArray(rec.optimization_opportunities) && rec.optimization_opportunities.length > 0;
      detail = `${p} task=${rec.task} advisory=${rec.normativity === "ADVISORY"} opportunities=${(rec.optimization_opportunities || []).length}`;
    }
    check(`loadout:task-review-${task}`, ok, detail);
  }
} catch (e) { check("loadout:task-reviews", false, e.message); }

// ---- report -------------------------------------------------------------------
for (const r of results) console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.id}: ${r.detail}`);
const failed = results.filter((r) => !r.ok);
console.log(`-> ${results.length - failed.length}/${results.length} contracts match system reality`);
process.exit(failed.length ? 2 : 0);
