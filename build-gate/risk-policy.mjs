// risk-policy.mjs — deterministic risk classification (Required Point 9). Repo-owned policy,
// never model-controlled: models may only RECOMMEND a class (a powerless `proposedClass`), and a
// downgrade requires a signed human adjudication. Unknown paths default to the HIGHEST class.
import { sign as edSign, verify as edVerify, createPublicKey, createPrivateKey } from "node:crypto";
import { canonicalize } from "../merkle-dag/vendor.mjs";

// Classes are ascending severity; index = rank; the LAST entry is the highest configured class.
export const DEFAULT_RISK_POLICY = Object.freeze({
  version: 1,
  classes: ["documentation-only", "application", "data", "authentication", "authorization",
    "secrets", "infrastructure", "deployment", "payments", "privacy", "governance"],
  rules: [
    { match: "docs/**", class: "documentation-only" },
    { match: "**/*.md", class: "documentation-only" },
    { match: "contracts/**", class: "governance" },
    { match: ".github/**", class: "deployment" },
    { match: "**/sign.mjs", class: "secrets" },
    { match: "**/crypto.mjs", class: "secrets" },
    { match: "**/proposal-ledger.mjs", class: "secrets" }
  ],
  workstream_rules: [{ workstream: "security-trust", min_class: "authentication" }],
  flag_rules: {
    dependency_change: "infrastructure", deployment_change: "deployment",
    data_boundary_change: "privacy", protected_path_hit: "governance"
  },
  hold_policy: {
    "documentation-only": { ttl_ms: 3600000, escalation: "none" },
    application: { ttl_ms: 3600000, escalation: "none" },
    data: { ttl_ms: 86400000, escalation: "second-review" },
    infrastructure: { ttl_ms: 86400000, escalation: "second-review" },
    deployment: { ttl_ms: 86400000, escalation: "second-review" },
    authentication: { ttl_ms: 86400000, escalation: "human-adjudication" },
    authorization: { ttl_ms: 86400000, escalation: "human-adjudication" },
    secrets: { ttl_ms: 86400000, escalation: "human-adjudication" },
    payments: { ttl_ms: 86400000, escalation: "human-adjudication" },
    privacy: { ttl_ms: 86400000, escalation: "human-adjudication" },
    governance: { ttl_ms: 86400000, escalation: "human-adjudication" }
  },
  hold_bounds: { min_ttl_ms: 60000, max_ttl_ms: 604800000 },
  adjudicators: {}   // { key_id: Ed25519 public JWK } — human keys, repo/dossier-pinned
});

// Load + validate policy. Any malformed field fails CLOSED: a policy whose rules are empty
// classifies everything to the highest class.
export function loadRiskPolicy(dossier) {
  const ext = dossier && typeof dossier.risk_policy === "object" && dossier.risk_policy ? dossier.risk_policy : {};
  try {
    const classes = Array.isArray(ext.classes) && ext.classes.length ? ext.classes : DEFAULT_RISK_POLICY.classes;
    const merged = {
      version: DEFAULT_RISK_POLICY.version,
      classes,
      rules: [...DEFAULT_RISK_POLICY.rules, ...(Array.isArray(ext.rules) ? ext.rules : [])],
      workstream_rules: [...DEFAULT_RISK_POLICY.workstream_rules, ...(Array.isArray(ext.workstream_rules) ? ext.workstream_rules : [])],
      flag_rules: { ...DEFAULT_RISK_POLICY.flag_rules, ...(ext.flag_rules && typeof ext.flag_rules === "object" ? ext.flag_rules : {}) },
      hold_policy: { ...DEFAULT_RISK_POLICY.hold_policy, ...(ext.hold_policy && typeof ext.hold_policy === "object" ? ext.hold_policy : {}) },
      hold_bounds: { ...DEFAULT_RISK_POLICY.hold_bounds, ...(ext.hold_bounds && typeof ext.hold_bounds === "object" ? ext.hold_bounds : {}) },
      adjudicators: { ...DEFAULT_RISK_POLICY.adjudicators, ...(ext.adjudicators && typeof ext.adjudicators === "object" ? ext.adjudicators : {}) }
    };
    for (const r of merged.rules) if (!r || typeof r.match !== "string" || !merged.classes.includes(r.class)) throw new Error("bad rule");
    return merged;
  } catch {
    return { ...DEFAULT_RISK_POLICY, rules: [], workstream_rules: [], failClosedReason: "malformed risk_policy — every path classifies highest" };
  }
}

// Flatten drive roots + dot-segments so "docs/../build-gate/sign.mjs" cannot masquerade as "docs/**".
export function normalizeRelPath(p) {
  let s = String(p || "");
  const driveRoot = /^[A-Za-z]:[/\\]?/;
  if (driveRoot.test(s)) s = s.replace(driveRoot, "");
  const stack = [];
  for (const seg of s.split(/[/\\]/)) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") { if (stack.length) stack.pop(); }
    else stack.push(seg);
  }
  return stack.join("/");
}

// Glob -> RegExp. `*` and `?` never cross "/"; `**` matches any number of segments.
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { i++; if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } else re += ".*"; }
      else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if ("\\^$.|+()[]{}".includes(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}

export function riskRank(policy, cls) {
  const i = policy.classes.indexOf(cls);
  return i < 0 ? policy.classes.length - 1 : i;   // unknown class -> highest rank
}
export function highestClass(policy) { return policy.classes[policy.classes.length - 1]; }

// Classify one normalized path against the rules. Returns { class, rule } or null (no match).
export function classifyPath(relPath, policy) {
  const norm = normalizeRelPath(relPath);
  let best = null;
  for (const r of policy.rules) {
    if (globToRegExp(r.match).test(norm)) {
      if (!best || riskRank(policy, r.class) > riskRank(policy, best.class)) best = { class: r.class, rule: r.match };
    }
  }
  return best;
}

/**
 * Deterministic effective class = MAX rank over matched path rules + workstream min_class + set flags.
 * ANY unmatched path -> highest class. Empty input -> highest class (fail closed).
 * @param inputs { paths:[...], workstreams:[...], flags:{...} }
 * @returns { risk_class, rank, matched:[{path,rule,class}], unmatched:[...], reasons:[...] }
 */
export function evaluateRiskClass(inputs, policy) {
  const paths = inputs.paths || [];
  const workstreams = inputs.workstreams || [];
  const flags = inputs.flags || {};
  const matched = [];
  const unmatched = [];
  const reasons = [];
  let rank = -1;
  let cls = null;
  const bump = (c, reason) => { const r = riskRank(policy, c); if (r > rank) { rank = r; cls = c; } reasons.push(reason); };

  if (paths.length === 0 && workstreams.length === 0 && Object.keys(flags).filter((k) => flags[k]).length === 0) {
    return { risk_class: highestClass(policy), rank: policy.classes.length - 1, matched, unmatched, reasons: ["empty input -> highest"] };
  }
  for (const p of paths) {
    const m = classifyPath(p, policy);
    if (m) { matched.push({ path: p, rule: m.rule, class: m.class }); bump(m.class, `path ${p} -> ${m.class}`); }
    else { unmatched.push(p); bump(highestClass(policy), `unknown path ${p} -> highest`); }
  }
  for (const w of workstreams) {
    const wr = (policy.workstream_rules || []).find((x) => x.workstream === w);
    if (wr) bump(wr.min_class, `workstream ${w} -> min ${wr.min_class}`);
  }
  for (const [flag, on] of Object.entries(flags)) {
    if (on && policy.flag_rules[flag]) bump(policy.flag_rules[flag], `flag ${flag} -> ${policy.flag_rules[flag]}`);
  }
  return { risk_class: cls ?? highestClass(policy), rank, matched, unmatched, reasons };
}

// Hold policy for a risk class (TTL + escalation), clamped to bounds. Unknown class -> human.
export function holdPolicyFor(riskClass, policy) {
  const hp = (policy.hold_policy && policy.hold_policy[riskClass]) || { ttl_ms: policy.hold_bounds.max_ttl_ms, escalation: "human-adjudication" };
  const ttl = Math.max(policy.hold_bounds.min_ttl_ms, Math.min(hp.ttl_ms, policy.hold_bounds.max_ttl_ms));
  return { ttl_ms: ttl, escalation: hp.escalation, min_ttl_ms: policy.hold_bounds.min_ttl_ms, max_ttl_ms: policy.hold_bounds.max_ttl_ms };
}

// A signed risk-adjudication record binds a downgrade to an exact plan hash + adjudicator key.
export function adjudicationPayload(adj) {
  return Buffer.from(canonicalize({ record_type: "risk-adjudication", plan_hash: adj.plan_hash, from_class: adj.from_class, to_class: adj.to_class, key_id: adj.key_id }));
}
export function signAdjudication(adj, privatePem) {
  return edSign(null, adjudicationPayload(adj), createPrivateKey(privatePem)).toString("base64");
}

export function verifyAdjudication(adj, policy) {
  try {
    if (!adj || !adj.sig || !adj.key_id) return false;
    const pub = policy.adjudicators[adj.key_id];
    if (!pub) return false;
    return edVerify(null, adjudicationPayload(adj), createPublicKey({ key: pub, format: "jwk" }), Buffer.from(adj.sig.value, "base64"));
  } catch { return false; }
}

/**
 * Apply a model-proposed class + an optional signed adjudication.
 * Upgrade (higher rank) applies freely; downgrade is powerless without a valid signed adjudication
 * bound to the exact plan hash and matching from/to classes.
 */
export function applyAdjudication(derivedClass, proposedClass, adjudication, policy, { plan_hash } = {}) {
  const reasons = [];
  const dRank = riskRank(policy, derivedClass);
  if (proposedClass && riskRank(policy, proposedClass) > dRank) {
    reasons.push(`upgrade to ${proposedClass} applied`);
    return { effective_class: proposedClass, upgrade_applied: true, downgrade_applied: false, reasons };
  }
  if (proposedClass && riskRank(policy, proposedClass) < dRank) {
    const ok = adjudication && verifyAdjudication(adjudication, policy)
      && adjudication.plan_hash === plan_hash && adjudication.from_class === derivedClass && adjudication.to_class === proposedClass;
    if (ok) { reasons.push(`downgrade to ${proposedClass} ratified by ${adjudication.key_id}`); return { effective_class: proposedClass, upgrade_applied: false, downgrade_applied: true, reasons }; }
    reasons.push("downgrade ignored: no valid signed human adjudication");
  }
  return { effective_class: derivedClass, upgrade_applied: false, downgrade_applied: false, reasons };
}
