import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveUnder } from "../merkle-dag/vendor.mjs";

async function writeUnder(baseDir, rel, content) {
  const abs = resolveUnder(baseDir, rel);
  if (abs === null) throw new Error(`refusing to write outside project root: ${rel}`);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content);
}

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
