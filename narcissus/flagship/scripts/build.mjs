import { cp, mkdir, readdir, readFile, lstat, rm, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { syncLiveGraph } from "./build-live-graph.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export async function build(output = path.join(ROOT, "dist"), { root = ROOT, checkGraph = true } = {}) {
  root = path.resolve(root); output = path.resolve(output);
  if (checkGraph) syncLiveGraph({ check: true });
  if (output === root || root.startsWith(output + path.sep) || output.startsWith(path.join(root, "native") + path.sep)) throw Error("Unsafe build destination");
  let exists = false;
  try {
    await lstat(output); exists = true;
    const marker = JSON.parse(await readFile(path.join(output, "build-manifest.json"), "utf8"));
    if (output !== path.join(root, "dist") || marker.kind !== "native-static-build") throw Error("Refusing to replace an unrelated output directory");
  } catch (error) { if (error.code !== "ENOENT") throw error; if (exists) throw Error("Refusing to replace output without native build marker"); }
  await mkdir(path.dirname(output), { recursive: true });
  const staging = `${output}.tmp-${randomUUID()}`;
  await mkdir(staging);
  const hashes = {};
  const copy = async (from, relative) => {
    const info = await lstat(from);
    if (info.isSymbolicLink()) throw Error(`Build input is a symbolic link: ${relative}`);
    if (info.isDirectory()) { for (const name of (await readdir(from)).sort()) await copy(path.join(from,name), path.posix.join(relative,name)); return; }
    if (!info.isFile()) throw Error(`Nonregular build input: ${relative}`);
    const target = path.join(staging, relative); await mkdir(path.dirname(target), {recursive:true}); await cp(from,target);
    hashes[relative] = createHash("sha256").update(await readFile(target)).digest("hex");
  };
  try {
    for (const name of (await readdir(path.join(root,"native"))).sort()) {
      if (/\.(?:js|css|json|html)$/.test(name)) await copy(path.join(root,"native",name),name);
    }
    await copy(path.join(root,"public"),"");
    for (const required of ["index.html","app.js","renderer.js","state.js","index.css","live-graph.json","evidence-ledger.json"]) if (!hashes[required]) throw Error(`Missing build entry: ${required}`);
    const manifest = {kind:"native-static-build",files:Object.fromEntries(Object.entries(hashes).sort(([a],[b])=>a.localeCompare(b)))};
    await writeFile(path.join(staging,"build-manifest.json"),JSON.stringify(manifest,null,2)+"\n");
    if (exists) await rm(output,{recursive:true});
    await rename(staging,output); return manifest;
  } catch(error) { await rm(staging,{recursive:true,force:true}); throw error; }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const args=process.argv.slice(2);
  if(args.length && (args.length!==2 || args[0]!=="--out"))throw Error("Usage: node scripts/build.mjs [--out NEW_DIRECTORY]");
  const result=await build(args[1]);console.log(`Native static build: ${Object.keys(result.files).length} files; no dependency installation or compilation`);
}
