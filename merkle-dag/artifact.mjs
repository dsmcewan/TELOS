// artifact.mjs — deterministic raw-bytes artifact tree-hash, confined under baseDir.
import { readFileSync, existsSync } from "node:fs";
import { canonicalize, sha256hex, resolveUnder } from "./vendor.mjs";

// Sort paths; hash RAW BYTES of each; escape/missing recorded as facts (never throws).
export function computeDiskTreeHash(files, baseDir) {
  const paths = [...(files || [])].sort();
  const entries = [];
  for (const p of paths) {
    const abs = resolveUnder(baseDir, p);
    if (abs === null) { entries.push({ path: p, filehash: null, status: "escape" }); continue; }
    if (!existsSync(abs)) { entries.push({ path: p, filehash: null, status: "missing" }); continue; }
    entries.push({ path: p, filehash: "sha256:" + sha256hex(readFileSync(abs)), status: "present" });
  }
  return { tree_hash: "sha256:" + sha256hex(canonicalize({ files: entries })), files: entries };
}

// Convenience: any escaping path is a hard plan error the caller must reject.
export function hasEscape(result) { return result.files.some((f) => f.status === "escape"); }
