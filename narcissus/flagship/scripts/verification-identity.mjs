import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function buildIdentity(directory) {
  const root = directory instanceof URL ? fileURLToPath(directory) : directory;
  const bytes = await readFile(path.join(root, "build-manifest.json"));
  const manifest = JSON.parse(bytes);
  if (manifest.kind !== "native-static-build" || !manifest.files || !Object.keys(manifest.files).length) throw Error("Invalid native build manifest");
  for (const [file, expected] of Object.entries(manifest.files)) {
    if (path.posix.isAbsolute(file) || file.includes("\\") || file.split("/").some(part => !part || part === "." || part === "..") || !/^[a-f0-9]{64}$/.test(expected)) throw Error("Invalid build file identity");
    const actual = createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
    if (actual !== expected) throw Error(`Built bytes drifted: ${file}`);
  }
  return createHash("sha256").update(bytes).digest("hex");
}

// Bind the executable verification closure, not merely its top-level launcher.
const FILES = [
  "scripts/verification-identity.mjs",
  "native/scripts/test-browser.mjs", "native/scripts/browser.mjs",
  "native/scripts/server.mjs", "native/scripts/scenarios.mjs",
  "native/state.js", "native/stations.js", "native/livegraph.js",
  "native/live-graph.json", "native/evidence-ledger.json"
];
export async function browserHarnessHash() {
  const entries = [];
  for (const file of FILES) entries.push([file, createHash("sha256").update(await readFile(new URL("../" + file, import.meta.url))).digest("hex")]);
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}
