// Fail-closed: every Evidence-Ledger entry must pin the CURRENT git blob sha of its source record. Drift fails.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const ledger = JSON.parse(readFileSync(path.join(HERE, "../src/evidence-ledger.json"), "utf8"));
let fail = 0;
for (const e of ledger.entries) {
  let sha = "";
  try { sha = (execSync(`git ls-files -s -- "${e.source_path}"`, { cwd: REPO, encoding: "utf8" }).trim().split(/\s+/)[1]) || ""; } catch { /* missing */ }
  if (sha !== e.blob_sha) { console.error(`DRIFT: ${e.source_path} -> ${sha || "MISSING/UNCOMMITTED"} (ledger pins ${e.blob_sha})`); fail++; }
  else console.log(`ok  ${e.blob_sha}  ${e.source_path}`);
}
console.log(fail ? `verify-evidence: ${fail} drift(s)` : `verify-evidence: ${ledger.entries.length} entries pinned + present`);
process.exit(fail ? 1 : 0);
