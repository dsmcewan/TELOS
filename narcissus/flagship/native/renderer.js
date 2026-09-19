import { NODES, NODES_BY_BLAST, EDGES, LAYOUT, LABELED_IDS, MAX_BLAST, riskColor, nodeById } from "./livegraph.js";
import { STATIONS } from "./stations.js";
import { add, sub, scale, length, identity, multiply, translation, rotation, perspective, viewMatrix, normalMatrix, transform, ease, linearColor, displayColor, sphere, tube } from "./math.js";
const VERTEX = `#version 300 es
precision highp float;
in vec3 position; in vec3 normal; in vec2 uv;
uniform mat4 projectionMatrix,modelViewMatrix;
uniform mat3 normalMatrix;
out vec3 vN; out vec3 vV; out vec3 vPosition; out float vT;
void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=normalize(-mv.xyz);vPosition=mv.xyz;vT=uv.x;gl_Position=projectionMatrix*mv;}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vN;in vec3 vV;in vec3 vPosition;in float vT;
uniform int uKind;uniform float uTime,uDim,uHubEnd,uBoost,uEmissive;
uniform vec3 uColor;uniform vec3 uLightA,uLightB;
out vec4 outputColor;
vec3 srgb(vec3 c){return mix(1.055*pow(max(c,vec3(0)),vec3(1.0/2.4))-.055,c*12.92,lessThanEqual(c,vec3(.0031308)));}
vec3 light(vec3 p,vec3 color,float intensity,float cutoff,vec3 n,vec3 v){
 vec3 delta=p-vPosition;float d=length(delta);vec3 l=normalize(delta);float nl=max(dot(n,l),0.0),nv=max(dot(n,v),0.000001);vec3 h=normalize(l+v);float vh=max(dot(v,h),0.0);
 vec3 f=vec3(.04)+vec3(.96)*exp2((-5.55473*vh-6.98316)*vh);
 float atten=pow(clamp(1.0-pow(d/cutoff,4.0),0.0,1.0),2.0)/max(d*d,.01);
 return nl*color*intensity*atten*(uColor/3.141592653589793+f*(.5/(nl+nv))/3.141592653589793);
}
void main(){
 if(uKind==0){float fres=pow(1.0-max(dot(vN,vV),0.0),2.4);float pulse=.86+.14*sin(uTime*1.8);outputColor=vec4(uColor*(.3+fres*2.6*pulse)*uDim,1.0);}
 else if(uKind==1){float towardHub=uHubEnd>.5?vT:1.0-vT;float glow=(.22+pow(towardHub,2.0)*1.15)*uBoost;outputColor=vec4(uColor*glow,.9);}
 else if(uKind==2){float fres=pow(1.0-max(dot(vN,vV),0.0),1.6);float pulse=.55+.45*sin(uTime*3.2);outputColor=vec4(uColor*2.2,fres*pulse*.85);}
 else{vec3 n=normalize(vN),v=normalize(vV);vec3 col=uColor*(.35+uEmissive);col+=light(uLightA,vec3(.863157213,.05780543,.05780543),55.0,30.0,n,v);col+=light(uLightB,vec3(0,.78353779,1),18.0,26.0,n,v);outputColor=vec4(srgb(col),1.0);}
}`;
function compile(gl, type, source) { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw Error(error);
} return s; }
function makeProgram(gl) { const vs = compile(gl, gl.VERTEX_SHADER, VERTEX), fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT), p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p); gl.deleteShader(vs); gl.deleteShader(fs); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const e = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw Error(e);
} return p; }
function upload(gl, p, shape) {
    const vao = gl.createVertexArray(), buffers = [];
    gl.bindVertexArray(vao);
    for (const [name, data, size] of [["position", shape.positions, 3], ["normal", shape.normals, 3], ["uv", shape.uvs, 2]]) {
        const buffer = gl.createBuffer();
        buffers.push(buffer);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        const at = gl.getAttribLocation(p, name);
        if (at >= 0) {
            gl.enableVertexAttribArray(at);
            gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0);
        }
    }
    const indices = gl.createBuffer();
    buffers.push(indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(shape.indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: shape.indices.length, dispose() { for (const buffer of buffers)
            gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); } };
}
export function createPainter(root, initial, e2e = false) {
    let state = initial, host, canvas, gl, program, uniforms, items = [], frame = 0, lastFrame = -Infinity, epoch = performance.now(), mountPending = true, disposed = false, lost = false, sceneKey = "", cameraX = 0, selectionAt = -10, selected = null, previousGroup = identity();
    const metrics = { frames: 0, draws: 0, view: state.view, time: 0, camera: null, resourceCount: 0 };
    function release() { for (const item of items)
        item.geometry.dispose(); items = []; if (program)
        gl.deleteProgram(program); program = null; metrics.resourceCount = 0; }
    function setup() {
        gl = canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "high-performance", premultipliedAlpha: true });
        if (!gl)
            throw Error("WebGL2 unavailable");
        program = makeProgram(gl);
        uniforms = Object.fromEntries(["projectionMatrix", "modelViewMatrix", "normalMatrix", "uKind", "uTime", "uDim", "uHubEnd", "uBoost", "uEmissive", "uColor", "uLightA", "uLightB"].map(n => [n, gl.getUniformLocation(program, n)]));
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.frontFace(gl.CCW);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(gl.FUNC_ADD);
        sceneKey = "";
    }
    function mount() {
        host = document.createElement("div");
        host.className = "loom-canvas";
        host.setAttribute("aria-hidden", "true");
        canvas = document.createElement("canvas");
        canvas.style.cssText = "display:block;width:100%;height:100%;";
        host.append(canvas);
        root.prepend(host);
        canvas.addEventListener("webglcontextlost", event => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); document.documentElement.dataset.graphics = "context-lost"; });
        canvas.addEventListener("webglcontextrestored", () => { lost = false; items = []; program = null; setup(); draw(performance.now()); schedule(); document.documentElement.dataset.graphics = "ready"; });
        setup();
        document.documentElement.dataset.graphics = "ready";
    }
    function geometry(shape, kind, color, model = identity(), extra = {}) { const item = { geometry: upload(gl, program, shape), kind, color: linearColor(color), model, ...extra }; items.push(item); return item; }
    function rebuild() {
        const key = state.view === "graph" ? `graph:${state.selectedNodeId}` : `story:${state.stationIndex}:${state.threadPulled}`;
        if (key === sceneKey)
            return;
        const priorBoosts = new Map(items.filter(item => item.kind === 1).map(item => [`${item.from}:${item.to}`, item.boost]));
        for (const item of items)
            item.geometry.dispose();
        items = [];
        sceneKey = key;
        if (state.view === "story") {
            const current = state.stationIndex;
            for (let i = 0; i < 30; i++) {
                const x = (i - 15) * .42, band = Math.floor(i / 30 * STATIONS.length), active = band === current, h = active && state.threadPulled ? 10.5 : 7.6 + ((i * 37) % 7) * .12, z = -2.4 - (i % 4) * .55, bow = active ? (state.threadPulled ? .85 : .4) : .12;
                geometry(tube([x, -h / 2, z], [x, 0, z + bow], [x, h / 2, z], 16, active ? .028 : .016), 3, active ? "#ef4444" : band < current ? "#7f1d1d" : "#1f2a3d", identity(), { emissive: active ? 2.1 : band < current ? .5 : .18 });
            }
            const kx = (Math.floor(current / STATIONS.length * 30) - 15) * .42;
            for (let k = 0; k < 3; k++)
                geometry(sphere(state.threadPulled ? .2 : .14, 32), 0, "#ef4444", translation(kx, (k - 1) * 1.6, -2.2), { dim: 1 });
        }
        else {
            const hub = NODES_BY_BLAST[0].id;
            for (const n of NODES) {
                const weight = n.blast_radius / MAX_BLAST, p = LAYOUT[n.id], sel = n.id === state.selectedNodeId, size = (.14 + weight * .72) * (sel ? 1.15 : 1), dim = Math.max(.28, (.45 + weight * .65) * (1 + Math.min(0, p[2]) * .16));
                geometry(sphere(size, n.id === hub ? 48 : 30), 0, riskColor(n.risk_class), translation(...p), { dim, hub: n.id === hub });
            }
            for (const e of EDGES) {
                const a = LAYOUT[e.from], b = LAYOUT[e.to];
                if (!a || !b)
                    continue;
                const mid = scale(add(a, b), .5);
                mid[1] -= .16 * length(sub(a, b)) * .35;
                mid[2] -= .1;
                const weight = Math.max(nodeById(e.from).blast_radius, nodeById(e.to).blast_radius) / MAX_BLAST;
                const hubThread = e.to === hub || e.from === hub;
                geometry(tube(a, mid, b, 24, .012 + weight * .05), 1, hubThread ? "#b91c1c" : "#7f1d1d", identity(), { from: e.from, to: e.to, hubThread, hubEnd: e.to === hub ? 1 : 0, boost: priorBoosts.get(`${e.from}:${e.to}`) ?? 1 });
            }
            const n = nodeById(state.selectedNodeId);
            if (n) {
                const size = (.14 + n.blast_radius / MAX_BLAST * .72) * 1.15;
                geometry(sphere(size, 32), 2, "#ef4444", translation(...LAYOUT[n.id]), { shell: true });
            }
        }
        metrics.resourceCount = items.length;
    }
    function labels(group, view, projection) {
        let box = host.querySelector(".gl-labels");
        if (state.view !== "graph") {
            box?.remove();
            return;
        }
        if (!box) {
            box = document.createElement("div");
            box.className = "gl-labels";
            box.setAttribute("aria-hidden", "true");
            for (const id of LABELED_IDS) {
                const n = nodeById(id), el = document.createElement("div");
                el.className = "gl-label";
                el.dataset.label = id;
                const name = document.createElement("span");
                name.className = "gl-name";
                name.textContent = n.label;
                const metric = document.createElement("span");
                metric.className = "gl-metric";
                metric.textContent = n.blast_radius;
                el.append(name, metric);
                box.append(el);
            }
            host.append(box);
        }
        const pv = multiply(projection, multiply(view, group)), placed = [];
        for (const el of box.children) {
            const id = el.dataset.label, p = transform(pv, LAYOUT[id]);
            placed.push({ el, x: Math.max(16, Math.min(83, (p[0] / p[3] * .5 + .5) * 100)), y: Math.max(9, Math.min(88, (-p[1] / p[3] * .5 + .5) * 100)), w: 3.2 + nodeById(id).label.length * .62 });
            el.className = "gl-label" + (id === state.selectedNodeId ? " sel" : "");
        }
        for (let iter = 0; iter < 3; iter++)
            for (let i = 0; i < placed.length; i++)
                for (let j = i + 1; j < placed.length; j++) {
                    const a = placed[i], b = placed[j], dy = Math.abs(a.y - b.y);
                    if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && dy < 4.6) {
                        const push = (4.6 - dy) / 2 + .3;
                        if (a.y <= b.y) {
                            a.y = Math.max(9, a.y - push);
                            b.y = Math.min(88, b.y + push);
                        }
                        else {
                            a.y = Math.min(88, a.y + push);
                            b.y = Math.max(9, b.y - push);
                        }
                    }
                }
        for (const p of placed) {
            p.el.style.left = `${p.x}%`;
            p.el.style.top = `${p.y}%`;
        }
    }
    function draw(now) {
        if (disposed || lost)
            return;
        rebuild();
        // Start the entrance clock when the first drawable scene exists. Shader and
        // geometry preparation must not silently consume the opening camera motion.
        if (mountPending) {
            now = performance.now();
            epoch = now;
            lastFrame = -Infinity;
            mountPending = false;
        }
        const dt = Number.isFinite(lastFrame) ? Math.max(0, (now - lastFrame) / 1000) : 0;
        lastFrame = now;
        const wall = (now - epoch) / 1000, t = e2e ? 1.234 : wall, settled = e2e || state.reducedMotion;
        if (selected !== state.selectedNodeId) {
            selected = state.selectedNodeId;
            selectionAt = wall;
        }
        const dpr = Math.min(2, Math.max(1, devicePixelRatio)), width = Math.round(host.clientWidth * dpr), height = Math.round(host.clientHeight * dpr);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        const bg = displayColor(state.theme === "dark" ? "#05070b" : "#dee2e7");
        gl.clearColor(...bg, 1);
        gl.depthMask(true);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(program);
        const graph = state.view === "graph";
        let eye, look, group;
        if (graph) {
            const dolly = settled ? 1 : ease(wall / 1.7);
            eye = [0, 1.4 * (1 - dolly), 15.5 - 5 * dolly];
            look = [0, 0, 0];
            group = settled ? identity() : rotation(Math.sin(t * .05) * .05, Math.sin(t * .09) * .22);
        }
        else {
            const dolly = settled ? 1 : ease(wall / 1.2), band = (Math.floor(state.stationIndex / STATIONS.length * 30) - 15) * .42, target = band * .16;
            cameraX = settled ? target : target + (cameraX - target) * Math.exp(-2.6 * dt);
            eye = [cameraX, 0, 9.8 - 1.3 * dolly];
            look = [cameraX * .4, 0, 0];
            group = settled ? identity() : multiply(translation(0, Math.sin(t * .2) * .05, 0), rotation(0, Math.sin(t * .12) * .05));
        }
        const view = viewMatrix(eye, look), projection = perspective(graph ? 48 : 46, width / height), ripple = settled ? 1 : ease((wall - selectionAt) / .45);
        gl.uniformMatrix4fv(uniforms.projectionMatrix, false, new Float32Array(projection));
        gl.uniform1f(uniforms.uTime, t);
        gl.uniform3fv(uniforms.uLightA, transform(view, [0, 0, 6]).slice(0, 3));
        gl.uniform3fv(uniforms.uLightB, transform(view, [-6, 4, 4]).slice(0, 3));
        for (const item of items) {
            const transparent = item.kind === 1 || item.kind === 2;
            if (transparent)
                gl.enable(gl.BLEND);
            else
                gl.disable(gl.BLEND);
            gl.depthMask(!item.shell);
            let model = item.model;
            if (item.shell) {
                const k = 1.45 * (.55 + .45 * ripple), size = identity();
                size[0] = size[5] = size[10] = k;
                model = multiply(model, size);
            }
            const mv = multiply(view, multiply(group, model));
            gl.uniformMatrix4fv(uniforms.modelViewMatrix, false, new Float32Array(mv));
            gl.uniformMatrix3fv(uniforms.normalMatrix, false, new Float32Array(normalMatrix(mv)));
            let color = item.color;
            if (item.kind === 1) {
                const connected = selected && (item.from === selected || item.to === selected), target = selected ? (connected ? 2.4 : .45) : 1;
                item.boost += (target - item.boost) * ripple;
                color = linearColor(state.theme === "light" ? (item.hubThread ? "#c2410c" : "#9a5b4f") : (item.hubThread ? "#b91c1c" : "#7f1d1d"));
            }
            gl.uniform1i(uniforms.uKind, item.kind);
            gl.uniform3fv(uniforms.uColor, color);
            gl.uniform1f(uniforms.uDim, (item.dim ?? 1) * (item.hub ? 1 + .06 * Math.sin(t * .7) : 1));
            gl.uniform1f(uniforms.uHubEnd, item.hubEnd ?? 0);
            gl.uniform1f(uniforms.uBoost, item.boost ?? 1);
            gl.uniform1f(uniforms.uEmissive, item.emissive ?? 0);
            gl.bindVertexArray(item.geometry.vao);
            gl.drawElements(gl.TRIANGLES, item.geometry.count, gl.UNSIGNED_SHORT, 0);
            metrics.draws++;
        }
        gl.depthMask(true);
        gl.bindVertexArray(null);
        labels(e2e ? group : previousGroup, view, projection);
        previousGroup = group;
        metrics.frames++;
        metrics.view = state.view;
        metrics.time = t;
        metrics.camera = eye;
        metrics.ripple = ripple;
        canvas.dataset.frame = String(metrics.frames);
        if (gl.getError() !== gl.NO_ERROR)
            throw Error("WebGL draw failed");
    }
    function loop(now) { if (disposed || lost)
        return; if (now - lastFrame >= 1000 / (state.view === "graph" ? 40 : 30))
        draw(now); frame = requestAnimationFrame(loop); }
    function schedule() { cancelAnimationFrame(frame); if (!e2e && !state.reducedMotion && !lost && !disposed)
        frame = requestAnimationFrame(loop); }
    mount();
    draw(performance.now());
    schedule();
    const resize = new ResizeObserver(() => draw(performance.now()));
    resize.observe(host);
    return {
        update(next) { const changeView = next.view !== state.view; state = next; if (changeView) {
            mountPending = true;
            cameraX = 0;
            selected = null;
            selectionAt = -10;
            previousGroup = identity();
            host.style.animation = "none";
            void host.offsetWidth;
            host.style.animation = "";
        } draw(performance.now()); schedule(); },
        metrics,
        dispose() { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); release(); host.remove(); }
    };
}
