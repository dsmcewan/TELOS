#!/usr/bin/env node
// drive-ops.mjs — the ads-ops loop: provision (once, idempotent) then an ops
// pass. Both stages are bounded and signed; both halt to needs-human without
// Meta credentials. Re-run weekly (or via cron) once live — provision is a
// no-op after the first success, and each ops pass applies the certified
// kill/scale rules to the previous week's insights.
//
//   node docs/runs/crossroad-ads/drive-ops.mjs
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const run = (script) => spawnSync("node", [path.join(here, script)], { cwd: root, stdio: "inherit" }).status ?? 1;

console.log("[drive-ops] stage 1/2 — provision (PAUSED objects, idempotent)");
const p = run("provision.mjs");
console.log(`[drive-ops] stage 2/2 — ops pass (certified kill/scale rules)`);
const o = run("ops-pass.mjs");
console.log(`[drive-ops] done — provision exit ${p}, ops-pass exit ${o}. Any needs-human items are in workdir/INBOX.md.`);
process.exit(p === 0 && o === 0 ? 0 : 1);
