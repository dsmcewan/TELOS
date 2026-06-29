// generator.mjs — the GENERATOR LAYER wired into merkle-dag's dispatch.
//
// runBuild calls dispatch(injected) per ready node, where injected is ONLY the
// node spec { id, requirements, files, test, effective_hash } (Rule 1). A
// generator dispatch turns that spec into real files and returns the signer;
// runBuild then runs the node's test (verifyNode) and only settles a signed
// ledger entry if it passes. The seat never declares "done" — the test does.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveUnder } from "../merkle-dag/vendor.mjs";
import { workstreamById } from "./pattern.mjs";

async function writeUnder(baseDir, rel, content) {
  const abs = resolveUnder(baseDir, rel);
  if (abs === null) throw new Error(`refusing to write outside project root: ${rel}`);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content);
}

// Wrap a `generateFiles(injected) -> { rel: content }` producer as a dispatch.
// Live: generateFiles calls a model seat through ai-peer-mcp. Tests: the
// deterministic team renderers (makePatternGenerators) so the loop runs keyless.
export function generatorDispatch({ baseDir, generateFiles, signerForTask }) {
  return async (injected) => {
    let files;
    try {
      files = await generateFiles(injected);
    } catch (e) {
      return { ok: false, reason: `${injected.id}: generator threw: ${e?.message || String(e)}` };
    }
    if (!files || typeof files !== "object") {
      return { ok: false, reason: `${injected.id}: generator produced no files` };
    }
    for (const rel of injected.files) {
      if (!(rel in files)) return { ok: false, reason: `${injected.id}: missing required file ${rel}` };
      await writeUnder(baseDir, rel, files[rel]);
    }
    return { ok: true, signer: signerForTask(injected.id) };
  };
}

// Pattern-based generators: render workstreams from the pattern registry.
// Stand-in for live model-seat generation — same dispatch contract, no API keys,
// so research -> generate -> verify -> gate runs in tests and CI.
export function makePatternGenerators(pattern, ctx) {
  return async (injected) => workstreamById(pattern, injected.id).render(ctx);
}
