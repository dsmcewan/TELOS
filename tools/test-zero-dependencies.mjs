import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,mkdir,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {audit,importFindings} from "./check-zero-dependencies.mjs";
test('loader scan rejects packages/CDNs and ignores quoted examples/comments',()=>{
 for(const code of ['import React from "react";','import("https://cdn.example/x.js")','const x=require("three");','export {x} from "foreign";'])assert.ok(importFindings(code).length);
 assert.deepEqual(importFindings('import { readFile } from "node:fs/promises"; import "./own.js"; // import x from "react"\nconst example = "import x from \\\"react\\\"";'),[]);
 assert.deepEqual(importFindings('const pattern=/["\x27]/g;const nested=`one${`two${1}`}`;import x from "./owned.js";'),[]);
 assert.ok(importFindings('const nested=`one${`two${1}`}`;import x from "react";').length);
});
test('inventory rejects new package, hidden dev dependencies, lockfiles and installers',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'zero-deps-test-'));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(path.join(root,'app'));
 const manifest=path.join(root,'app/package.json');await writeFile(manifest,JSON.stringify({name:'app',type:'module',scripts:{test:'node --test'}}));
 assert.equal((await audit(root,{expectedRoots:['app']})).status,'pass');
 for(const bucket of ['dependencies','devDependencies','optionalDependencies','peerDependencies','bundledDependencies']){await writeFile(manifest,JSON.stringify({name:'app',[bucket]:{bad:'1'}}));assert.equal((await audit(root,{expectedRoots:['app']})).status,'fail');}
 await writeFile(manifest,JSON.stringify({scripts:{test:'npx playwright test'}}));assert.equal((await audit(root,{expectedRoots:['app']})).status,'fail');
 await writeFile(manifest,'{}');await writeFile(path.join(root,'app/package-lock.json'),'{}');assert.equal((await audit(root,{expectedRoots:['app']})).status,'fail');await rm(path.join(root,'app/package-lock.json'));
 await mkdir(path.join(root,'new'));await writeFile(path.join(root,'new/package.json'),'{}');assert.equal((await audit(root,{expectedRoots:['app']})).status,'fail');
});

test('loaders in template expressions and long import/export clauses remain visible',()=>{
 const bindings=Array.from({length:80},(_,i)=>`symbol${i}`).join(',');
 for(const code of [
  'const x = `${await import("react")}`;',
  'const x = `outer${`inner${require("three")}`}`;',
  `import {${bindings}} from "react";`,
  `export {${bindings}} from "react";`,
  'const x = import(`react`);',
  'const x = import(modulePath);',
  'const x = import("\\u0072eact");',
 ])assert.ok(importFindings(code).length,code);
 assert.deepEqual(importFindings('const x = `import("react") ${"require(three)"}`;'),[]);
 assert.deepEqual(importFindings(`import {${bindings}} from "node:fs";`),[]);
});
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'zero-deps-cold-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(root,'app'));await writeFile(path.join(root,'app/package.json'),'{}');
 const run=()=>audit(root,{expectedRoots:['app']});return {root,run};
}
test('manifest and dependency buckets have explicit valid shapes',async t=>{
 const {root,run}=await fixture(t),manifest=path.join(root,'app/package.json');
 for(const malformed of [[],null,'package',1,{dependencies:[]},{devDependencies:null},{scripts:[]}]){
  await writeFile(manifest,JSON.stringify(malformed));assert.equal((await run()).status,'fail',JSON.stringify(malformed));
 }
 await writeFile(manifest,JSON.stringify({dependencies:{},bundledDependencies:[],scripts:{test:'node --test'}}));
 assert.equal((await run()).status,'pass');
});
test('installer options cannot hide the operation in package scripts or CI',async t=>{
 const {root,run}=await fixture(t),manifest=path.join(root,'app/package.json');
 await mkdir(path.join(root,'.github/workflows'),{recursive:true});
 for(const command of ['npm --prefix /tmp/deps install react','npm --prefix=/tmp/deps --silent i react','pnpm --dir /tmp/deps add react','yarn --cwd /tmp/deps add react','bun --cwd /tmp/deps install react','npm.cmd --prefix C:/deps install react']){
  await writeFile(manifest,JSON.stringify({scripts:{test:command}}));assert.equal((await run()).status,'fail',command);
  await writeFile(manifest,'{}');await writeFile(path.join(root,'.github/workflows/check.yml'),`steps:\n  - run: ${command}\n`);
  assert.equal((await run()).status,'fail',command);await rm(path.join(root,'.github/workflows/check.yml'));
 }
});
test('unquoted browser loads are rejected while local assets remain allowed',async t=>{
 const {root,run}=await fixture(t);
 for(const [name,source]of [
  ['index.html','<script src=https://cdn.example/react.js></script>'],
  ['index.html','<link rel=stylesheet href=//cdn.example/app.css>'],
  ['index.css','@import url(https://cdn.example/app.css);'],
  ['index.css','@import url( //cdn.example/app.css );'],
  ['index.css','@import "https://cdn.example/app.css";'],
 ]){await writeFile(path.join(root,'app',name),source);assert.equal((await run()).status,'fail',source);await rm(path.join(root,'app',name));}
 await writeFile(path.join(root,'app/index.html'),'<script src=./app.js></script><link rel=stylesheet href=./app.css>');
 await writeFile(path.join(root,'app/index.css'),'@import url(./theme.css);');assert.equal((await run()).status,'pass');
});
test('relative loaders must resolve to physical owned files inside reviewed directories',async t=>{
 const {root,run}=await fixture(t),entry=path.join(root,'app/main.mjs');
 await mkdir(path.join(root,'other'));await writeFile(path.join(root,'other/owned.mjs'),'export const x=1;');
 await writeFile(entry,'import "../other/owned.mjs";');assert.equal((await run()).status,'pass');
 await mkdir(path.join(root,'app/node_modules/foreign'),{recursive:true});await writeFile(path.join(root,'app/node_modules/foreign/index.js'),'export default 1;');
 for(const source of ['import "../../outside/third-party.mjs";','import "./node_modules/foreign/index.js";','import "./%6eode_modules/foreign/index.js";','import "../other/missing.mjs";']){
  await writeFile(entry,source);assert.equal((await run()).status,'fail',source);
 }
 const {symlink}=await import('node:fs/promises');await symlink(path.join(root,'other/owned.mjs'),path.join(root,'app/link.mjs'));
 await writeFile(entry,'import "./link.mjs";');assert.equal((await run()).status,'fail');
});

// Review regression: browser loading must not evade the JS loader ownership rule.
test('browser code/style cannot load skipped dependency directories',async t=>{
 const {root,run}=await fixture(t);
 await mkdir(path.join(root,'app/node_modules/vendor'),{recursive:true});
 await writeFile(path.join(root,'app/node_modules/vendor/library.js'),'window.vendor=true;');
 for(const source of ['<script src="./node_modules/vendor/library.js"></script>', '<script src="./%6eode_modules/vendor/library.js"></script>', '<script src="/node_modules/vendor/library.js"></script>', '<link rel=stylesheet href=./node_modules/vendor/library.css>']) {
  await writeFile(path.join(root,'app/index.html'),source);assert.equal((await run()).status,'fail',source);
 }
 await rm(path.join(root,'app/index.html'));
 await writeFile(path.join(root,'app/index.css'),'@import url(./%6eode_modules/vendor/library.css);');assert.equal((await run()).status,'fail');
 await writeFile(path.join(root,'app/index.css'),'body { background-image: url(./media/background.png); }');assert.equal((await run()).status,'pass');
});
