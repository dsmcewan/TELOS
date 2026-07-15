// check-registry.mjs — the CLOSED, repo-owned registry mapping a verification `check_contract.kind`
// to a concrete, VETTED check executable + a per-kind params whitelist (decision 7 / rounds 8-10).
// Pure; depends only on vendor.mjs. Mirrors the closed-set discipline of risk-policy.mjs / evidence.mjs.
//
// Why this exists: a review concern's `required_verification` names only a `check_contract.kind`
// (from this closed set) + bounded `params_json`. The controller — never the model — resolves that
// to the discharge node's `test`. The proposal gate later RE-resolves the same (kind, params_json)
// and asserts deriveExecutableRef(node.test) === deriveExecutableRef(resolved), binding the executable
// that discharges the obligation to the concern's contract. So the model can neither name the
// executable nor swap in a no-op.
//
// The vetted executable is a REGISTRY CONSTANT — a self-contained `node -e` template that is
// byte-identical across mint and gate and carries no machine-specific path (portable content address).
// This is the decidable "genuineness discriminator" the review asked for: isVettedResolvedTest()
// asserts a resolved test's executable is exactly the kind's registered template, EXCLUDING the
// undecidable "prove this arbitrary command is non-trivial". Param VALUE guards (below) then keep the
// resolved check non-vacuous — strictly stronger than an empty-needle floor.
import { canonicalize, sha256hex } from "../merkle-dag/vendor.mjs";

const H = (v) => "sha256:" + sha256hex(canonicalize(v));

// A model may not smuggle an executable/path/interpreter override through params (mirror evidence.mjs).
export const FORBIDDEN_PARAM_KEYS = new Set([
  "cmd", "command", "script", "exec", "eval", "args", "argv", "cwd", "file", "path", "env", "shell", "node"
]);
const PLACEHOLDER_RE = /(^|[^a-z])(todo|fixme|placeholder|changeme|tbd|xxx+)([^a-z]|$)/i;
const MIN_NEEDLE_LEN = 4;
// Always-present files a needle would trivially match — denied as vacuous verification targets.
const VACUOUS_TARGET_DENY = new Set([
  "package.json", "package-lock.json", "readme.md", "license", ".gitignore", "node_modules"
]);

// resolveUnder-equivalent: a repo-RELATIVE path that does not escape baseDir. Rejects absolute AND
// "../"-escaping paths (round-10: both silently fall back to baseDir in ledger-gate, hashing the same
// so the gate cannot catch a vacuous run). Pure string check (no fs) so identity is machine-independent.
function isSafeRelPath(p) {
  if (typeof p !== "string" || !p) return false;
  if (p.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(p)) return false;    // absolute (posix / win)
  const segs = p.split(/[\\/]+/);
  let depth = 0;
  for (const s of segs) {
    if (s === "" || s === ".") continue;
    if (s === "..") { depth--; if (depth < 0) return false; } else depth++;
  }
  return true;
}

// The vetted, self-contained check executables. Each runs `node -e <template> -- <...args>` with a
// repo-relative cwd; the template reads its argv (process.argv.slice(1)) and exits 0 (pass) / 1 (fail).
// These are REGISTRY CONSTANTS — a resolved test whose executable is not byte-equal to its kind's
// template fails isVettedResolvedTest(), and the gate's deriveExecutableRef comparison rejects a swap.
const T_ASSERT_FILE_CONTAINS =
  "const fs=require('fs');const a=process.argv.slice(1);const target=a[0],needle=a[1];" +
  "if(!target||!needle){console.error('missing target/needle');process.exit(2);}" +
  "let s;try{s=fs.readFileSync(target,'utf8');}catch(e){console.error('cannot read '+target);process.exit(1);}" +
  "process.exit(s.indexOf(needle)>=0?0:1);";

const T_ASSERT_FILE_ABSENT =
  "const fs=require('fs');const a=process.argv.slice(1);const target=a[0];" +
  "if(!target){console.error('missing target');process.exit(2);}" +
  "process.exit(fs.existsSync(target)?1:0);";

// The closed kind registry. `template` is the vetted executable; `validate(p)` enforces the per-kind
// param whitelist + VALUE guards; `argv(p)` builds the args after `--`.
const KINDS = {
  // Assert a project file contains a specific, non-trivial marker (e.g. the remediation added a guard).
  "assert-file-contains": {
    template: T_ASSERT_FILE_CONTAINS,
    validate(p) {
      const errs = [];
      const target = p.target, needle = p.needle;
      if (!isSafeRelPath(target)) errs.push("target must be a repo-relative path under baseDir");
      else if (VACUOUS_TARGET_DENY.has(String(target).toLowerCase())) errs.push(`target '${target}' is an always-present file (vacuous)`);
      if (typeof needle !== "string" || needle.trim().length < MIN_NEEDLE_LEN) errs.push(`needle must be a specific string (>= ${MIN_NEEDLE_LEN} non-space chars)`);
      else if (PLACEHOLDER_RE.test(needle)) errs.push("needle is a placeholder token");
      return errs;
    },
    argv(p) { return [String(p.target), String(p.needle)]; }
  },
  // Assert a project path is ABSENT (e.g. a forbidden file/secret was removed by the remediation).
  "assert-path-absent": {
    template: T_ASSERT_FILE_ABSENT,
    validate(p) {
      const errs = [];
      if (!isSafeRelPath(p.target)) errs.push("target must be a repo-relative path under baseDir");
      return errs;
    },
    argv(p) { return [String(p.target)]; }
  }
};

export function checkKinds() { return Object.keys(KINDS); }
export function isRegistered(kind) { return Object.prototype.hasOwnProperty.call(KINDS, kind); }

// check_contract_ref — hashed in the STORED schema shape { kind, params_json } (params_json a JSON
// STRING), identically at mint and at gate, so the obligation's check_contract_ref reconciles.
export function checkContractRef(checkContract) {
  const cc = checkContract || {};
  return H({ kind: cc.kind || "", params_json: cc.params_json || "" });
}

/**
 * Resolve (kind, params_json) to the discharge node's canonical test { cmd, args, cwd }. Fail CLOSED
 * on an unregistered kind, unparseable params, a forbidden param key, or a per-kind value-guard
 * failure — never a partial/vacuous test. Deterministic: the gate re-resolution yields the identical
 * test, so deriveExecutableRef matches.
 * @returns { ok:true, test } | { ok:false, error, detail }
 */
export function resolve(kind, params_json) {
  if (!isRegistered(kind)) return { ok: false, error: "UNREGISTERED_KIND", detail: `'${kind}' not in check-registry` };
  const spec = KINDS[kind];
  let params;
  try { params = params_json === undefined || params_json === "" ? {} : JSON.parse(params_json); }
  catch (e) { return { ok: false, error: "BAD_PARAMS_JSON", detail: String((e && e.message) || e) }; }
  if (!params || typeof params !== "object" || Array.isArray(params)) return { ok: false, error: "BAD_PARAMS_JSON", detail: "params_json must decode to an object" };
  for (const k of Object.keys(params)) if (FORBIDDEN_PARAM_KEYS.has(k)) return { ok: false, error: "FORBIDDEN_PARAM", detail: `param key '${k}' is forbidden` };
  const verrs = spec.validate(params);
  if (verrs.length) return { ok: false, error: "PARAM_VALUE", detail: verrs };
  const test = { cmd: "node", args: ["-e", spec.template, "--", ...spec.argv(params)], cwd: "." };
  return { ok: true, test };
}

// Decidable genuineness discriminator: a resolved node test's executable is EXACTLY the kind's
// registered template (model-uncontrollable), run via `node -e ... --` with a repo-relative cwd.
// The primitive genuineness test asserts this for every kind — replacing the undecidable
// "prove the command is non-trivial".
export function isVettedResolvedTest(kind, test) {
  const spec = KINDS[kind];
  if (!spec || !test || typeof test !== "object") return false;
  const a = test.args || [];
  return test.cmd === "node" && a[0] === "-e" && a[1] === spec.template && a[2] === "--" && isSafeRelPath(test.cwd || ".");
}
