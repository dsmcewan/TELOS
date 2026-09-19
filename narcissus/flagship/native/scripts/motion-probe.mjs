// Observe uniforms actually sent to the GPU in both implementations. This is
// independent of implementation-reported timing metrics and never edits a baseline.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { browser } from "./browser.mjs";
import { serve } from "./server.mjs";
import { GRAPH_PROBE, button, ready, pause } from "./scenarios.mjs";
import { NODES, LAYOUT } from "../livegraph.js";
import { identity, multiply, translation, rotation, viewMatrix, ease } from "../math.js";
const probe = `(()=>{
 window.__motion=[];const seen=new Map();
 for(const kind of ['WebGLRenderingContext','WebGL2RenderingContext']){const proto=window[kind]?.prototype;if(!proto)continue;
  const locations=new WeakMap(),programs=new WeakMap();let active;
  const get=proto.getUniformLocation;proto.getUniformLocation=function(program,name){const l=get.call(this,program,name);if(l){locations.set(l,{program,name});if(!programs.has(program))programs.set(program,{});}return l;};
  const use=proto.useProgram;proto.useProgram=function(p){active=p;return use.call(this,p);};
  for(const fn of ['uniform1f','uniform1i','uniformMatrix4fv']){const old=proto[fn];proto[fn]=function(location,...args){const l=locations.get(location);if(l)programs.get(l.program)[l.name]=fn==='uniformMatrix4fv'?Array.from(args[1]):args[0];return old.call(this,location,...args);};}
  const draw=proto.drawElements;proto.drawElements=function(...args){const u=programs.get(active);if(u&&u.uTime!==undefined){const native=u.uKind!==undefined;const type=native?(u.uKind===0?'orb':u.uKind===2?'shell':null):(u.uDim!==undefined?'orb':'shell');if(type){const view=document.querySelector('.graph-view')?'graph':'story';const key=view+':'+type;if(seen.get(key)!==u.uTime){seen.set(key,u.uTime);window.__motion.push({type,view,t:u.uTime,at:performance.now(),matrix:u.modelViewMatrix});}}}return draw.apply(this,args);};
 }
})()`;
function maxDiff(a, b) { return Math.max(...a.map((x, i) => Math.abs(x - b[i]))); }
function inverseRigid(m) { const out = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1]; for (let row = 0; row < 3; row++)
    out[12 + row] = -(out[row] * m[12] + out[4 + row] * m[13] + out[8 + row] * m[14]); return out; }
function assess(trace) {
    const checks = [];
    // First canvas mount begins at the first observed shader tick in each view.
    for (const view of ['story', 'graph']) {
        let frames = trace.filter(f => f.type === 'orb' && f.view === view);
        // React can commit the graph HUD one frame before its old story canvas unmounts.
        // Identify the new renderer's observed clock reset, retaining the transition count.
        const start = frames.findIndex(f => f.t < .2);
        if (start > 0) {
            checks.push({ name: view + '-old-canvas-transition-bounded', pass: start <= 2, frames: start });
            frames = frames.slice(start);
        }
        const first = frames[0];
        if (!first) {
            checks.push({ name: view + '-frames', pass: false });
            continue;
        }
        const span = view === 'graph' ? 1.7 : 1.2, body = view === 'graph' ? LAYOUT[NODES[0].id] : [-6.3, -1.6, -2.2];
        const selected = frames.filter(f => f.t >= first.t && f.t - first.t <= span + .15);
        let maxError = 0;
        const camera = selected.map(f => { const group = view === 'graph' ? rotation(Math.sin(f.t * .05) * .05, Math.sin(f.t * .09) * .22) : multiply(translation(0, Math.sin(f.t * .2) * .05, 0), rotation(0, Math.sin(f.t * .12) * .05)); const v = multiply(f.matrix, inverseRigid(multiply(group, translation(...body)))); return { t: f.t, eye: inverseRigid(v).slice(12, 15) }; });
        let durationFit = { error: Infinity, duration: null, offset: null };
        for (let ds = -100; ds <= 100; ds++)
            for (let os = -20; os <= 20; os++) {
                const duration = span + ds * .002, offset = first.t + os * .0025;
                let error = 0;
                for (const f of camera) {
                    const expected = view === 'graph' ? 15.5 - 5 * ease((f.t - offset) / duration) : 9.8 - 1.3 * ease((f.t - offset) / duration);
                    error = Math.max(error, Math.abs(f.eye[2] - expected));
                }
                if (error < durationFit.error)
                    durationFit = { error, duration, offset };
            }
        checks.push({ name: view + '-measured-dolly-duration', pass: durationFit.error < .015 && Math.abs(durationFit.duration - span) <= 2 / (view === 'graph' ? 40 : 30), expected_seconds: span, measured_seconds: durationFit.duration, max_camera_z_error: durationFit.error, tolerance_seconds: 2 / (view === 'graph' ? 40 : 30) });
        if (view === 'story') {
            let error = 0;
            for (let i = 1; i < camera.length; i++) {
                const a = camera[i - 1], b = camera[i], target = -6.3 * .16;
                error = Math.max(error, Math.abs(b.eye[0] - (target + (a.eye[0] - target) * Math.exp(-2.6 * (b.t - a.t)))));
            }
            checks.push({ name: 'story-camera-pan-damping', pass: error < .015, max_x_error: error });
        }
        // Fit the camera's mount instant within one actual frame. React schedules its
        // clock's first useFrame independently of the first DOM readiness observation.
        let best = { error: Infinity, offset: 0 };
        for (let step = 0; step <= 40; step++) {
            const offset = first.t - step * .0025;
            let error = 0;
            for (const f of selected) {
                const elapsed = Math.max(0, f.t - offset), d = ease(elapsed / span), t = f.t;
                const eye = view === 'graph' ? [0, 1.4 * (1 - d), 15.5 - 5 * d] : null;
                if (!eye)
                    continue;
                const group = rotation(Math.sin(t * .05) * .05, Math.sin(t * .09) * .22);
                error = Math.max(error, maxDiff(f.matrix, multiply(viewMatrix(eye, [0, 0, 0]), multiply(group, translation(...body)))));
            }
            if (error < best.error)
                best = { error, offset };
        }
        if (view === 'graph') {
            maxError = best.error;
            checks.push({ name: 'graph-entry-camera-and-idle-rotation', pass: maxError < .015, max_matrix_error: maxError, frames: selected.length, inferred_mount_time: best.offset, duration_seconds: span });
        }
        checks.push({ name: view + '-motion-has-distinct-rendered-frames', pass: frames.length >= 15 && maxDiff(frames[0].matrix, frames[Math.min(14, frames.length - 1)].matrix) > .001, frames: frames.length });
    }
    const shells = trace.filter(f => f.type === 'shell' && f.view === 'graph');
    if (shells.length) {
        const start = shells[0].t;
        let best = { error: Infinity, duration: null };
        for (let step = -100; step <= 100; step++) {
            const duration = .45 + step * .002;
            let error = 0;
            for (const f of shells.filter(f => f.t - start <= .65)) {
                const actual = Math.hypot(...f.matrix.slice(0, 3)), expected = 1.45 * (.55 + .45 * ease((f.t - start) / duration));
                error = Math.max(error, Math.abs(actual - expected));
            }
            if (error < best.error)
                best = { error, duration };
        }
        checks.push({ name: 'selection-shell-duration-and-easing', pass: best.error < .015 && Math.abs(best.duration - .45) <= 2 / 40, max_scale_error: best.error, measured_seconds: best.duration, expected_seconds: .45, tolerance_seconds: 2 / 40, frames: shells.length });
    }
    else
        checks.push({ name: 'selection-shell-duration-and-easing', pass: false });
    return checks;
}
const [root, output] = process.argv.slice(2);
if (!root || !output)
    throw Error('Usage: motion-probe.mjs <site> <NEW-receipt.json>');
try {
    await readFile(output);
    throw Error('Refusing to overwrite motion receipt');
}
catch (error) {
    if (error.code !== 'ENOENT')
        throw error;
}
const server = await serve(path.resolve(root), { publicRoot: path.resolve(root, '../public') }), b = await browser(process.env.BROWSER_PATH);
try {
    const p = await b.page();
    await p.command('Page.addScriptToEvaluateOnNewDocument', { source: GRAPH_PROBE + ';' + probe });
    await p.goto(server.url + '/');
    await ready(p);
    await pause(1600);
    await p.click(button('ENTER_GRAPH'));
    await pause(2200);
    await p.click(button('SELECT_NODE'));
    await pause(850);
    await p.click(button('CLEAR_NODE'));
    await pause(650);
    const trace = await p.evaluate('window.__motion'), checks = assess(trace);
    const report = { root: path.resolve(root), created_at: new Date().toISOString(), browser: await b.send('Browser.getVersion'), checks, pass: checks.every(c => c.pass), trace };
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ pass: report.pass, checks }, null, 2));
    if (!report.pass)
        process.exitCode = 1;
}
finally {
    await b.close();
    await server.close();
}
