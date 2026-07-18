#!/usr/bin/env node
// verify.mjs — proves each NORMATIVE contract equals what reality enforces, by running
// the oracle the host names for it. Exit 0 only if every pair is green.
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { readJson, finding, printFindings } from "./lib/record.mjs";

const mapPath = process.argv[2];
if (!mapPath) { console.error("usage: verify.mjs <verify-map.json>"); process.exit(1); }
let map;
try { map = readJson(mapPath); } catch (e) { console.error("VERIFY_ERROR: " + e.message); process.exit(1); }
if (!Array.isArray(map)) { console.error("VERIFY_ERROR: verify-map must be an array"); process.exit(1); }
const base = path.dirname(path.resolve(mapPath));
const out = [];
for (const entry of map) {
  const cpath = path.resolve(base, entry.contract || "");
  if (!existsSync(cpath)) { out.push(finding("FAIL", "verify", entry.contract, "contract file missing")); continue; }
  try { readJson(cpath); } catch (e) { out.push(finding("FAIL", "verify", entry.contract, e.message)); continue; }
  const opath = path.resolve(base, entry.oracle || "");
  if (!existsSync(opath)) { out.push(finding("FAIL", "verify", entry.contract, `oracle missing: ${entry.oracle}`)); continue; }
  const r = spawnSync(process.execPath, [opath], { cwd: entry.cwd ? path.resolve(base, entry.cwd) : base, encoding: "utf8" });
  if (r.status !== 0) out.push(finding("FAIL", "verify", entry.contract, `oracle ${entry.oracle} exited ${r.status}: ${(r.stderr || r.stdout || "").trim().slice(0, 200)}`));
}
process.exit(printFindings(out, "verify"));
