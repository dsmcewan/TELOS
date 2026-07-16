// registry.mjs — the single authoritative source of Clotho's closed node/edge/
// status membership, canonical identity, and locator/source/endpoint validation
// (plan v12 Task 2). Zero dependencies: Node stdlib only.
//
// Everything here is deterministic and fail-closed: unknown kinds/statuses,
// malformed locators, mismatched node ids, bad couplings, and invalid endpoint
// pairs throw rather than being silently normalized.

import { createHash } from "node:crypto";

// ---- closed registries (read-only Set facades over private native Sets) ------
// Not `Object.freeze(new Set(...))`: a frozen Set still mutates via add/delete.
// The facade backs a private Set and makes every mutator throw.

function readonlySet(members) {
  const set = new Set(members);
  const deny = (op) => () => {
    throw new Error(`read-only set: ${op} is not permitted`);
  };
  const facade = {
    has: (value) => set.has(value),
    keys: () => set.keys(),
    values: () => set.values(),
    entries: () => set.entries(),
    forEach: (fn, thisArg) => set.forEach(fn, thisArg),
    add: deny("add"),
    delete: deny("delete"),
    clear: deny("clear"),
    [Symbol.iterator]: () => set[Symbol.iterator]()
  };
  Object.defineProperty(facade, "size", { get: () => set.size, enumerable: true });
  return Object.freeze(facade);
}

export const NODE_KINDS = readonlySet([
  "contract-clause", "code-symbol", "repository-file", "test", "commit",
  "concern", "obligation", "check-contract", "run-evidence", "doc-section", "decision"
]);

export const EDGE_KINDS = readonlySet([
  "depends-on", "introduced-by", "motivated-by", "verified-by",
  "documented-in", "evidenced-by", "discharges", "supersedes"
]);

export const ASSERTION_STATUS = readonlySet([
  "deterministic-extraction", "human-authorized", "model-proposal",
  "rejected", "superseded"
]);

// The five deterministic weaver ids (asserted_by => deterministic-extraction).
export const WEAVER_IDS = readonlySet([
  "clotho-git-weaver", "clotho-code-weaver", "clotho-test-weaver",
  "clotho-doc-weaver", "clotho-ledger-weaver"
]);

// ---- canonical JSON ----------------------------------------------------------
// Accepts JSON primitives, dense arrays, and plain objects only. Rejects
// undefined, sparse arrays, non-finite numbers, bigint, symbols, functions,
// cycles, and non-plain prototypes. Object keys sorted by JS string code-unit
// order; array order preserved.

export function canonicalJson(value) {
  return encode(value, new Set());
}

function encode(value, seen) {
  if (value === null) return "null";
  const type = typeof value;
  if (type === "boolean") return value ? "true" : "false";
  if (type === "string") return JSON.stringify(value);
  if (type === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonicalJson: non-finite number");
    return JSON.stringify(value);
  }
  if (type === "bigint") throw new TypeError("canonicalJson: bigint is not JSON");
  if (type === "undefined" || type === "symbol" || type === "function") {
    throw new TypeError(`canonicalJson: ${type} is not JSON`);
  }
  if (type !== "object") throw new TypeError(`canonicalJson: unsupported ${type}`);
  if (seen.has(value)) throw new TypeError("canonicalJson: cycle");
  seen.add(value);
  let out;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) {
        throw new TypeError("canonicalJson: sparse array");
      }
    }
    out = "[" + value.map((item) => encode(item, seen)).join(",") + "]";
  } else {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError("canonicalJson: non-plain object");
    }
    const keys = Object.keys(value).sort();
    out = "{" + keys.map((k) => JSON.stringify(k) + ":" + encode(value[k], seen)).join(",") + "}";
  }
  seen.delete(value);
  return out;
}

// ---- primitive validators ----------------------------------------------------

const HEX40 = /^[0-9a-f]{40}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const STABLE_ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const REPO_REF = /^git-root:[0-9a-f]{40}$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Exactly the expected own keys, no missing, no extra, no inherited enumerable.
function requireExactKeys(obj, expected, label) {
  if (!isPlainObject(obj)) throw new TypeError(`${label}: expected a plain object`);
  const keys = Object.keys(obj);
  if (keys.length !== expected.length) {
    throw new TypeError(`${label}: expected keys [${[...expected].sort().join(", ")}], got [${[...keys].sort().join(", ")}]`);
  }
  for (const k of expected) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) {
      throw new TypeError(`${label}: missing field '${k}'`);
    }
  }
}

function isCanonicalPath(p) {
  if (typeof p !== "string" || p.length === 0) return false;
  if (p.includes("\0") || p.includes("\\")) return false;
  if (p.startsWith("/") || p.endsWith("/")) return false;
  for (const seg of p.split("/")) {
    if (seg === "" || seg === "." || seg === "..") return false;
  }
  return true;
}

function requirePath(p, label) {
  if (!isCanonicalPath(p)) throw new TypeError(`${label}: not a canonical POSIX relative path: ${JSON.stringify(p)}`);
}

function requireHex(value, re, label) {
  if (typeof value !== "string" || !re.test(value)) {
    throw new TypeError(`${label}: expected lowercase ${re === HEX40 ? "40" : "64"}-hex, got ${JSON.stringify(value)}`);
  }
}

function normalizeHeading(h) {
  return h.normalize("NFC").trim().replace(/\s+/g, " ");
}

function requireHeadingPath(hp, label) {
  if (!Array.isArray(hp) || hp.length === 0) throw new TypeError(`${label}: heading_path must be a nonempty array`);
  for (const h of hp) {
    if (typeof h !== "string" || h.length === 0) throw new TypeError(`${label}: heading must be a nonempty string`);
    if (h !== normalizeHeading(h)) throw new TypeError(`${label}: heading is not normalized: ${JSON.stringify(h)}`);
  }
}

function requireRepositoryRef(value, repositoryRef, label) {
  if (typeof value !== "string" || !REPO_REF.test(value)) {
    throw new TypeError(`${label}: repository_ref must be 'git-root:<40-hex>', got ${JSON.stringify(value)}`);
  }
  if (repositoryRef !== undefined && value !== repositoryRef) {
    throw new TypeError(`${label}: repository_ref ${JSON.stringify(value)} does not match derived ${JSON.stringify(repositoryRef)}`);
  }
}

// ---- locator schemas ---------------------------------------------------------

const LOCATOR_FIELDS = {
  "code-symbol": ["repository_ref", "path", "symbol", "blob_sha"],
  "repository-file": ["repository_ref", "path", "blob_sha"],
  "test": ["repository_ref", "path", "blob_sha"],
  "commit": ["sha"],
  "doc-section": ["repository_ref", "path", "heading_path", "text_sha256"],
  "contract-clause": ["repository_ref", "path", "heading_path", "text_sha256"],
  "decision": ["repository_ref", "path", "heading_path", "text_sha256"],
  "concern": ["repository_ref", "ledger_path", "entry_hash"],
  "obligation": ["repository_ref", "ledger_path", "entry_hash"],
  "check-contract": ["repository_ref", "path", "contract_id", "blob_sha"],
  "run-evidence": ["repository_ref", "path", "summary_sha256"]
};

export function validateLocator(kind, locator, { repositoryRef } = {}) {
  if (!NODE_KINDS.has(kind)) throw new TypeError(`validateLocator: unknown kind ${JSON.stringify(kind)}`);
  const fields = LOCATOR_FIELDS[kind];
  requireExactKeys(locator, fields, `locator[${kind}]`);

  if (kind === "commit") {
    requireHex(locator.sha, HEX40, "commit.sha");
    return;
  }

  requireRepositoryRef(locator.repository_ref, repositoryRef, `${kind}.repository_ref`);

  switch (kind) {
    case "code-symbol":
      requirePath(locator.path, "code-symbol.path");
      if (typeof locator.symbol !== "string" || !IDENTIFIER.test(locator.symbol)) {
        throw new TypeError(`code-symbol.symbol: not a JavaScript identifier: ${JSON.stringify(locator.symbol)}`);
      }
      requireHex(locator.blob_sha, HEX40, "code-symbol.blob_sha");
      break;
    case "repository-file":
    case "test":
      requirePath(locator.path, `${kind}.path`);
      requireHex(locator.blob_sha, HEX40, `${kind}.blob_sha`);
      break;
    case "doc-section":
    case "contract-clause":
    case "decision":
      requirePath(locator.path, `${kind}.path`);
      requireHeadingPath(locator.heading_path, `${kind}.heading_path`);
      requireHex(locator.text_sha256, HEX64, `${kind}.text_sha256`);
      break;
    case "concern":
    case "obligation":
      requirePath(locator.ledger_path, `${kind}.ledger_path`);
      requireHex(locator.entry_hash, HEX64, `${kind}.entry_hash`);
      break;
    case "check-contract":
      requirePath(locator.path, "check-contract.path");
      if (typeof locator.contract_id !== "string" || locator.contract_id.trim() === "") {
        throw new TypeError("check-contract.contract_id: must be a nonblank string");
      }
      requireHex(locator.blob_sha, HEX40, "check-contract.blob_sha");
      break;
    case "run-evidence":
      requirePath(locator.path, "run-evidence.path");
      if (!locator.path.startsWith("docs/runs/")) {
        throw new TypeError(`run-evidence.path: must be below docs/runs/, got ${JSON.stringify(locator.path)}`);
      }
      requireHex(locator.summary_sha256, HEX64, "run-evidence.summary_sha256");
      break;
    default:
      throw new TypeError(`validateLocator: unhandled kind ${kind}`);
  }
}

// ---- node identity -----------------------------------------------------------

export function deriveNodeId({ kind, locator }) {
  validateLocator(kind, locator);
  return createHash("sha256").update(Buffer.from(canonicalJson({ kind, locator }), "utf8")).digest("hex");
}

// ---- source references -------------------------------------------------------
// git:<40-hex> | file:<repo-relative-path>@<40-hex> | ledger:<path>#<64-hex>

export function validateSourceRef(sourceRef) {
  if (typeof sourceRef !== "string" || sourceRef.length === 0) {
    throw new TypeError("validateSourceRef: must be a nonempty string");
  }
  if (sourceRef.startsWith("git:")) {
    requireHex(sourceRef.slice(4), HEX40, "source_ref git");
    return;
  }
  if (sourceRef.startsWith("file:")) {
    const at = sourceRef.lastIndexOf("@");
    if (at < 0) throw new TypeError("source_ref file: missing '@<blob_sha>'");
    requirePath(sourceRef.slice(5, at), "source_ref file path");
    requireHex(sourceRef.slice(at + 1), HEX40, "source_ref file blob_sha");
    return;
  }
  if (sourceRef.startsWith("ledger:")) {
    const hash = sourceRef.lastIndexOf("#");
    if (hash < 0) throw new TypeError("source_ref ledger: missing '#<entry_hash>'");
    requirePath(sourceRef.slice(7, hash), "source_ref ledger path");
    requireHex(sourceRef.slice(hash + 1), HEX64, "source_ref ledger entry_hash");
    return;
  }
  throw new TypeError(`validateSourceRef: unknown scheme in ${JSON.stringify(sourceRef)}`);
}

// ---- assertor / status coupling ---------------------------------------------

function requireAssertor(assertedBy) {
  if (typeof assertedBy !== "string" || assertedBy.length === 0) {
    throw new TypeError("asserted_by: must be a nonempty string");
  }
  if (assertedBy !== assertedBy.trim()) throw new TypeError("asserted_by: must be trimmed");
  if (assertedBy.length > 128) throw new TypeError("asserted_by: exceeds 128 characters");
  if (!STABLE_ID.test(assertedBy)) throw new TypeError(`asserted_by: not a stable identifier: ${JSON.stringify(assertedBy)}`);
}

export function validateAssertionStatus(assertedBy, assertionStatus) {
  requireAssertor(assertedBy);
  if (!ASSERTION_STATUS.has(assertionStatus)) {
    throw new TypeError(`validateAssertionStatus: unknown status ${JSON.stringify(assertionStatus)}`);
  }
  let required;
  if (WEAVER_IDS.has(assertedBy)) required = "deterministic-extraction";
  else if (assertedBy === "human") required = "human-authorized";
  else if (assertedBy.startsWith("model:")) required = "model-proposal";
  else throw new TypeError(`validateAssertionStatus: unrecognized assertor ${JSON.stringify(assertedBy)}`);
  if (assertionStatus !== required) {
    throw new TypeError(`validateAssertionStatus: ${assertedBy} requires ${required}, got ${assertionStatus}`);
  }
}

// ---- endpoint matrix + edge validation --------------------------------------

const ENDPOINTS = {
  "introduced-by": [["code-symbol", "commit"], ["repository-file", "commit"]],
  "depends-on": [
    ["code-symbol", "code-symbol"], ["code-symbol", "repository-file"],
    ["repository-file", "code-symbol"], ["repository-file", "repository-file"]
  ],
  "verified-by": [["code-symbol", "test"], ["repository-file", "test"]],
  "documented-in": [
    ["code-symbol", "doc-section"], ["code-symbol", "contract-clause"],
    ["repository-file", "doc-section"], ["repository-file", "contract-clause"]
  ],
  "motivated-by": [["code-symbol", "concern"]],
  "evidenced-by": [["code-symbol", "run-evidence"]],
  "discharges": [["code-symbol", "obligation"], ["obligation", "contract-clause"]]
  // "supersedes" is handled specially: same-kind endpoints, human/model assertor.
};

const EDGE_INPUT_FIELDS = ["edge_kind", "from_node", "to_node", "source_ref", "asserted_by", "assertion_status"];

function requireNodeDescriptor(node, repositoryRef, label) {
  requireExactKeys(node, ["kind", "locator"], label);
  validateLocator(node.kind, node.locator, { repositoryRef });
}

export function validateEdgeInput(edgeInput, { repositoryRef } = {}) {
  requireExactKeys(edgeInput, EDGE_INPUT_FIELDS, "edgeInput");
  const { edge_kind, from_node, to_node, source_ref, asserted_by, assertion_status } = edgeInput;
  if (!EDGE_KINDS.has(edge_kind)) throw new TypeError(`validateEdgeInput: unknown edge_kind ${JSON.stringify(edge_kind)}`);

  requireNodeDescriptor(from_node, repositoryRef, "edgeInput.from_node");
  requireNodeDescriptor(to_node, repositoryRef, "edgeInput.to_node");

  if (edge_kind === "supersedes") {
    if (from_node.kind !== to_node.kind) {
      throw new TypeError(`supersedes: endpoints must share a kind (${from_node.kind} -> ${to_node.kind})`);
    }
    if (!(asserted_by === "human" || asserted_by.startsWith("model:"))) {
      throw new TypeError("supersedes: asserted_by must be 'human' or begin with 'model:'");
    }
  } else {
    const allowed = ENDPOINTS[edge_kind];
    const ok = allowed.some(([f, t]) => f === from_node.kind && t === to_node.kind);
    if (!ok) {
      throw new TypeError(`validateEdgeInput: ${from_node.kind} -> ${to_node.kind} is not a valid ${edge_kind} endpoint`);
    }
  }

  validateAssertionStatus(asserted_by, assertion_status);
  validateSourceRef(source_ref);
}

// ---- current-document address key -------------------------------------------

export function docAddressKey({ path, heading_path }) {
  requirePath(path, "docAddressKey.path");
  requireHeadingPath(heading_path, "docAddressKey.heading_path");
  return canonicalJson({ path, heading_path });
}

// ---- repository identity -----------------------------------------------------
// `git` is an injected runner: git(argsArray) -> stdout string. This keeps the
// module free of a git dependency (the no-shell runner lands in weavers/util.mjs
// at Task 4a) and lets Task 2 prove the contract with both injected units and a
// real-git fixture.

export class ShallowRepositoryError extends Error {
  constructor(message = "repository has shallow history; full history is required") {
    super(message);
    this.name = "ShallowRepositoryError";
    this.code = "CLOTHO_SHALLOW_REPOSITORY";
  }
}

export function deriveRepositoryRef(git) {
  if (typeof git !== "function") throw new TypeError("deriveRepositoryRef: git runner must be a function");
  const shallow = String(git(["rev-parse", "--is-shallow-repository"])).trim();
  if (shallow !== "false") throw new ShallowRepositoryError();
  const roots = String(git(["rev-list", "--max-parents=0", "HEAD"]))
    .trim().split(/\r?\n/).filter((line) => line.length > 0);
  if (roots.length !== 1) {
    throw new Error(`deriveRepositoryRef: expected exactly one root commit, got ${roots.length}`);
  }
  if (!HEX40.test(roots[0])) {
    throw new Error(`deriveRepositoryRef: malformed root commit ${JSON.stringify(roots[0])}`);
  }
  return `git-root:${roots[0]}`;
}
