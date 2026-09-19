import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,rm,readFile,mkdir,writeFile,symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "./build.mjs";
test("native builds are reproducible and exclude tools/tests/dependencies",async t=>{
 const root=await mkdtemp(path.join(tmpdir(),"flagship-build-test-"));t.after(()=>rm(root,{recursive:true,force:true}));
 const a=await build(path.join(root,"a")),b=await build(path.join(root,"b"));assert.deepEqual(a,b);assert.ok(a.files['renderer.js']);assert.ok(!Object.keys(a.files).some(p=>/node_modules|tests\/|scripts\//.test(p)));
 await assert.rejects(build(path.join(root,"a")),/unrelated output/);
 await assert.rejects(build(path.resolve(new URL('../',import.meta.url).pathname)),/Unsafe/);
});
test("build refuses symlink input and leaves old unrelated output intact",async t=>{
 const root=await mkdtemp(path.join(tmpdir(),"flagship-symlink-test-"));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,"native"));await mkdir(path.join(root,"public"));await writeFile(path.join(root,"outside"),"not a source");await symlink(path.join(root,"outside"),path.join(root,"native","app.js"));
 await assert.rejects(build(path.join(root,"out"),{root,checkGraph:false}),/symbolic link/);
 await mkdir(path.join(root,"existing"));await writeFile(path.join(root,"existing","keep"),"preserve");await assert.rejects(build(path.join(root,"existing"),{root,checkGraph:false}),/without native build marker/);assert.equal(await readFile(path.join(root,"existing","keep"),"utf8"),"preserve");
});
