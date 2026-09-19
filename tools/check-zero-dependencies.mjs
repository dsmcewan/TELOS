// Repository policy oracle. This is a deterministic inventory and lexical review
// signal, not a JavaScript sandbox or proof against arbitrary trusted-code evasion.
import { readdir, readFile } from "node:fs/promises";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PACKAGE_ROOTS = Object.freeze(["ai-forge", "ai-native-memory", "atropos", "breakout", "build-gate", "clotho", "connectors/ai-peer-mcp", "forge", "lachesis", "merkle-dag", "narcissus/flagship", "saas-forge"]);
const SKIP = new Set([".git", "node_modules", "dist", ".gitnexus", ".telos", ".cache"]);
const BUCKETS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "bundledDependencies", "bundleDependencies"];
const LOCKS = /^(?:package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/;
// Conservative shell-command signal: options (including their values) can occur
// before the installer verb. Shell metaprogramming still needs human review.
const INSTALL = /\b(?:npx\b|(?:npm|pnpm|yarn|bun)(?:\.cmd|\.exe)?\b[^;|&\r\n]*?\s(?:ci|install|i|add|dlx|x)(?=\s|$|[;|&]))/;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);

// Tool-owned lexical profile: template raw text stays data, while each ${...}
// expression is tokenized recursively. No component-private parser is imported.
function tokens(text) {
  let i = 0;
  function quoted(quote) {
    let value = '', escaped = false, interpolated = false;
    const expressions = []; i++;
    while (i < text.length) {
      const ch = text[i++];
      if (ch === quote) return { kind: quote === '`' ? 'template' : 'string', value, escaped, interpolated, expressions };
      if (ch === '\\') { escaped = true; value += ch; if (i < text.length) value += text[i++]; }
      else if (quote === '`' && ch === '$' && text[i] === '{') {
        i++; interpolated = true; expressions.push(scan(true)); value += '${}';
      } else value += ch;
    }
    throw Error('Unclosed literal');
  }
  function scan(expression = false) {
    const out = []; let depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (/\s/.test(c)) { i++; continue; }
      if (text.startsWith('//', i)) { const end = text.indexOf('\n', i); i = end < 0 ? text.length : end; continue; }
      if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i + 2); if (end < 0) throw Error('Unclosed comment'); i = end + 2; continue; }
      if (c === '}' && expression && depth === 0) { i++; return out; }
      if (c === '"' || c === "'" || c === '`') { out.push(quoted(c)); continue; }
      const prior = out.at(-1);
      if (c === '/' && (!prior || ['(', '[', '{', ',', ':', ';', '=', '!', '?', '&', '|', '+', '-', '*', '%', '^', '~', '<', '>'].includes(prior.value) || ['return', 'throw', 'case', 'delete', 'void', 'typeof', 'instanceof', 'in', 'yield', 'await'].includes(prior.value))) {
        i++; let cls = false, closed = false;
        while (i < text.length) { const ch = text[i++]; if (ch === '\\') { i++; continue; } if (ch === '[') cls = true; else if (ch === ']') cls = false; else if (ch === '/' && !cls) { closed = true; break; } else if (ch === '\n' || ch === '\r') break; }
        if (!closed) throw Error('Unclosed regular expression'); while (i < text.length && /[a-z]/i.test(text[i])) i++;
        out.push({ kind: 'regex', value: '' }); continue;
      }
      const id = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
      if (id) { out.push({ kind: 'id', value: id[0] }); i += id[0].length; }
      else { out.push({ kind: 'punct', value: c }); if (c === '{') depth++; if (c === '}') depth--; i++; }
    }
    if (expression) throw Error('Unclosed template expression');
    return out;
  }
  return scan();
}
function moduleLoads(source) {
  const loads = [];
  function visit(ts) {
    const add = token => loads.push({ literal: !!token && ['string', 'template'].includes(token.kind) && !token.interpolated && !token.escaped, specifier: token?.value });
    function declaration(start) {
      let depth = 0;
      for (let j = start; j < ts.length && ts[j].value !== ';'; j++) {
        if (ts[j].value === '{') depth++;
        if (ts[j].value === '}') depth--;
        if (!depth && ts[j].value === 'from' && ts[j + 1]?.kind === 'string') { add(ts[j + 1]); return; }
      }
    }
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      for (const expression of t.expressions ?? []) visit(expression);
      if (t.kind !== 'id') continue;
      const prior = ts[i - 1]?.value;
      if (prior === '#' || (prior === '.' && !(t.value === 'require' && ts[i - 2]?.value === 'module'))) continue;
      if ((t.value === 'require' || t.value === 'import') && ts[i + 1]?.value === '(') {
        const next = ts[i + 3]?.value;
        add(next === ')' || next === ',' ? ts[i + 2] : null);
      } else if (t.value === 'import' && ts[i + 1]?.value !== '.') {
        if (ts[i + 1]?.kind === 'string') add(ts[i + 1]); else declaration(i + 1);
      } else if (t.value === 'export' && ['{', '*'].includes(ts[i + 1]?.value)) declaration(i + 1);
    }
  }
  visit(tokens(source)); return loads;
}

export function importFindings(source, { root, file } = {}) {
  const issues = [];
  for (const load of moduleLoads(source)) {
    if (!load.literal) { issues.push("computed module loader requires explicit source review"); continue; }
    const specifier = load.specifier;
    if (specifier.startsWith("node:")) continue;
    if (!specifier.startsWith("./") && !specifier.startsWith("../")) {
      issues.push(`external module specifier: ${specifier.slice(0, 160)}`); continue;
    }
    if (!root || !file) continue; // Standalone classification; audit adds disk ownership.
    try {
      const target = fileURLToPath(new URL(specifier, pathToFileURL(path.resolve(root, file))));
      const relative = path.relative(root, target);
      if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('outside repository');
      if (relative.split(path.sep).some(part => SKIP.has(part))) throw Error('excluded source directory');
      // Resolve physical identity as well as the textual URL: symlink components
      // cannot make a repository-relative path load external bytes.
      const physical = realpathSync(target);
      if (physical !== target) throw Error('symlinked module source');
      if (!statSync(physical).isFile()) throw Error('module is not an owned file');
    } catch (error) { issues.push(`unowned relative module ${specifier.slice(0, 160)}: ${error.message}`); }
  }
  return issues;
}
function browserSources(source) {
  const sources = [];
  const uncommented = source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const tag of uncommented.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    for (const attr of tag[0].matchAll(/\b(?:src|href)\s*=\s*(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s>]+))/gi)) {
      sources.push((attr[1] ?? attr[2] ?? attr[3]).trim());
    }
  }
  for (const rule of uncommented.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\s;)]+))/gi)) {
    sources.push((rule[1] ?? rule[2] ?? rule[3]).trim());
  }
  return sources;
}
export async function audit(root,{expectedRoots=PACKAGE_ROOTS}={}) {
  root=path.resolve(root);const violations=[],files=[],manifests=[];
  async function walk(dir,relative=""){
    for(const e of await readdir(dir,{withFileTypes:true})){
      if(SKIP.has(e.name))continue;
      const rel=path.posix.join(relative,e.name),full=path.join(dir,e.name);
      if(e.isSymbolicLink()){violations.push(`${rel}: symlink requires explicit source classification`);continue;}
      if(e.isDirectory())await walk(full,rel);else if(e.isFile()){files.push(rel);if(e.name==='package.json')manifests.push(rel.slice(0,-'/package.json'.length));}
    }
  }
  await walk(root);
  if(JSON.stringify([...manifests].sort())!==JSON.stringify([...expectedRoots].sort()))violations.push(`Package inventory mismatch: found ${manifests.sort().join(', ')}`);
  for(const pkg of manifests){
    let data;try{data=JSON.parse(await readFile(path.join(root,pkg,'package.json'),'utf8'));}catch(error){violations.push(`${pkg}: invalid package manifest: ${error.message}`);continue;}
    if(!object(data)){violations.push(`${pkg}: invalid package manifest: object required`);continue;}
    for(const bucket of BUCKETS)if(Object.hasOwn(data,bucket)){
      const value=data[bucket];if((!object(value)&&!(['bundledDependencies','bundleDependencies'].includes(bucket)&&Array.isArray(value)))||Object.keys(value).length)violations.push(`${pkg}: prohibited ${bucket}`);
    }
    if(Object.hasOwn(data,'scripts')&&!object(data.scripts)){violations.push(`${pkg}: invalid scripts: object required`);continue;}
    for(const [name,command]of Object.entries(data.scripts??{}))if(typeof command!=='string'||INSTALL.test(command))violations.push(`${pkg}: dependency installer in script ${name}`);
  }
  let scanned=0;
  for(const file of files){
    if(LOCKS.test(path.posix.basename(file)))violations.push(`${file}: dependency lockfile prohibited`);
    const inPackage=manifests.some(pkg=>file.startsWith(pkg+'/'));
    if(inPackage&&/\.(?:[cm]?js|jsx|tsx?)$/.test(file)){
      const source=await readFile(path.join(root,file),'utf8');scanned++;
      try{for(const reason of importFindings(source,{root,file}))violations.push(`${file}: ${reason}`);}catch(error){violations.push(`${file}: lexical scan failed: ${error.message}`);}
      if(/(?:@license|@preserve)[\s\S]{0,400}(?:React|Three\.js|react-dom|xstate)|\b__vite__mapDeps\b|\bReactCurrentDispatcher\b/.test(source))violations.push(`${file}: known third-party bundle/vendor signature`);
    }
    if(inPackage&&/\.(?:html|css)$/.test(file)){
      const source=await readFile(path.join(root,file),'utf8');
      for (const specifier of browserSources(source)) {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(specifier)) { violations.push(`${file}: externally loaded browser code/style`); continue; }
        try {
          // Root-relative browser URLs refer to the served site, not the host
          // filesystem. Check path components without conflating font/image URLs
          // with module loads: only script/link/@import sources enter this loop.
          const decoded = decodeURIComponent(specifier.split(/[?#]/,1)[0]);
          if (decoded.split(/[\\/]/).some(part => SKIP.has(part))) throw Error('excluded source directory');
          if (decoded.includes('\\')) throw Error('ambiguous browser path separator');
          if (!decoded.startsWith('/')) {
            const target = path.resolve(root, path.dirname(file), decoded);
            const relative = path.relative(root, target);
            if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw Error('outside repository');
            try { if (realpathSync(target) !== target) throw Error('symlinked browser source'); }
            catch(error) { if(error.code !== 'ENOENT') throw error; }
          }
        } catch(error) { violations.push(`${file}: unowned browser code/style source: ${error.message}`); }
      }
    }
    if(file.startsWith('.github/workflows/')&&/\.ya?ml$/.test(file)){
      const source=await readFile(path.join(root,file),'utf8');if(INSTALL.test(source))violations.push(`${file}: dependency installation in CI`);
    }
  }
  return {status:violations.length?'fail':'pass',package_roots:manifests.sort(),source_files_scanned:scanned,violations,limits:['Recognized loader forms use a tool-owned lexical classifier; computed or escaped loaders fail closed. Generated/evaluated code still requires review.','Known vendor signatures are a review signal, not a universal third-party-code detector.','Node, Git, OS, browser executable and CI host actions are platform prerequisites; no npm runtime/build/test packages are permitted.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=await audit(process.argv[2]??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));console.log(JSON.stringify(result,null,2));if(result.status!=='pass')process.exitCode=1;}
