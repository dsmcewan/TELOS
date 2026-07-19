// Fail-closed: every Evidence-Ledger entry must pin the CURRENT git blob sha of its source record. Drift fails.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const LEDGER_PATH = path.join(HERE, "../src/evidence-ledger.json");

function readLedger() {
  try {
    const value = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
    if (
      value === null ||
      typeof value !== "object" ||
      !Array.isArray(value.entries) ||
      value.entries.length === 0
    ) {
      throw new Error("root must be an object with a non-empty entries array");
    }
    return value;
  } catch (error) {
    console.error(`INVALID EVIDENCE LEDGER: ${error.message}`);
    process.exit(1);
  }
}

function isRepoRelativePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) return false;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) return false;
  if (value.includes("\\") || path.posix.normalize(value) !== value) return false;
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function indexBlob(sourcePath) {
  try {
    const output = execFileSync(
      "git",
      ["--literal-pathspecs", "ls-files", "--stage", "--", sourcePath],
      { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    const sha = output === "" ? "" : output.split(/\s+/, 3)[1] || "";
    if (!/^[0-9a-f]{40}$/.test(sha)) return { sha, text: null };
    const text = execFileSync(
      "git",
      ["cat-file", "blob", sha],
      { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return { sha, text };
  } catch {
    return { sha: "", text: null };
  }
}

// Quotes are verbatim modulo formatting whitespace: line wrapping, indentation,
// and CRLF/LF differences collapse to one ASCII space. Case, punctuation, and
// every non-whitespace character must still occur in the pinned index blob.
const normalizedExcerpt = (value) => value.replace(/\s+/gu, " ").trim();

const ledger = readLedger();
let fail = 0;
const seenIds = new Set();
for (const [index, e] of ledger.entries.entries()) {
  if (
    e === null ||
    typeof e !== "object" ||
    typeof e.id !== "string" ||
    e.id.length === 0 ||
    seenIds.has(e.id) ||
    !isRepoRelativePath(e.source_path) ||
    typeof e.blob_sha !== "string" ||
    !/^[0-9a-f]{40}$/.test(e.blob_sha) ||
    typeof e.quote !== "string" ||
    normalizedExcerpt(e.quote).length === 0
  ) {
    console.error(
      `INVALID ENTRY ${index}: id must be unique, source_path must be a normalized repo-relative path, blob_sha must be 40 lowercase hex characters, and quote must be non-empty`,
    );
    fail++;
    continue;
  }
  seenIds.add(e.id);

  const indexed = indexBlob(e.source_path);
  if (indexed.sha !== e.blob_sha) {
    console.error(`DRIFT: ${e.source_path} -> ${indexed.sha || "MISSING/UNCOMMITTED"} (ledger pins ${e.blob_sha})`);
    fail++;
  } else if (indexed.text === null) {
    console.error(`UNREADABLE BLOB: ${e.source_path} -> ${indexed.sha}`);
    fail++;
  } else if (!normalizedExcerpt(indexed.text).includes(normalizedExcerpt(e.quote))) {
    console.error(`QUOTE DRIFT: ${e.source_path} does not contain the ledger excerpt after whitespace normalization`);
    fail++;
  } else {
    console.log(`ok  ${e.blob_sha}  ${e.source_path}`);
  }
}
console.log(fail ? `verify-evidence: ${fail} drift(s)` : `verify-evidence: ${ledger.entries.length} entries pinned + present`);
process.exit(fail ? 1 : 0);
