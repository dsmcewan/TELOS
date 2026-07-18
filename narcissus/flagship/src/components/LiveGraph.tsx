// The live weave, rendered as WebGL PAINT (pointer-events:none, aria-hidden — the DOM list is the truth).
// Nodes: ferrofluid orbs sized by blast radius, risk-colored, depth-dimmed. Edges: woven catenary threads,
// thickness ∝ blast, glow toward the hub. Labels: HTML OVERLAYS positioned from projected 3D coords —
// pixel-crisp self-hosted type, still pure paint (pointer-events:none; the interactive path stays the
// DOM-shadowed controls). Selection: shell-pulse on the orb + connected threads brighten, unrelated dim.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NODES, NODES_BY_BLAST, EDGES, LAYOUT, LABELED_IDS, MAX_BLAST, riskColor, nodeById } from "../livegraph";
import { ferroVert, ferroFrag } from "../ferrofluid";
import { isE2E } from "../e2e-mode";
import { FrameDriver } from "../frame-driver";

const easeOutCubic = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const E2E_T = 1.234; // frozen shader clock under ?e2e=1 — deterministic pixels

const threadVert = /* glsl */`
  varying float vT;
  void main(){ vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const threadFrag = /* glsl */`
  uniform vec3 uColor; uniform float uHubEnd; uniform float uBoost; varying float vT;
  void main(){
    float towardHub = uHubEnd > 0.5 ? vT : (1.0 - vT);
    float glow = (0.22 + pow(towardHub, 2.0) * 1.15) * uBoost;
    gl_FragColor = vec4(uColor * glow, 0.9);
  }`;
const shellFrag = /* glsl */`
  uniform float uTime; uniform vec3 uColor;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float fres = pow(1.0 - max(dot(vN, vV), 0.0), 1.6);
    float pulse = 0.55 + 0.45 * sin(uTime * 3.2);
    gl_FragColor = vec4(uColor * 2.2, fres * pulse * 0.85);
  }`;

function Graph({ selectedNodeId, reducedMotion, labelHost, theme }: {
  selectedNodeId: string | null; reducedMotion: boolean; labelHost: React.RefObject<HTMLDivElement>; theme: "dark" | "light";
}) {
  const group = useRef<THREE.Group>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const hubId = NODES_BY_BLAST[0].id;

  const { materials, baseDims } = useMemo(() => {
    const m: Record<string, THREE.ShaderMaterial> = {};
    const dims: Record<string, number> = {};
    for (const n of NODES) {
      const weight = n.blast_radius / MAX_BLAST;
      const z = LAYOUT[n.id]?.[2] ?? 0;
      const depthDim = 1 + Math.min(0, z) * 0.16;
      const rankDim = 0.45 + weight * 0.65;
      dims[n.id] = Math.max(0.28, rankDim * depthDim);
      m[n.id] = new THREE.ShaderMaterial({
        vertexShader: ferroVert, fragmentShader: ferroFrag,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(riskColor(n.risk_class)) },
          uDim: { value: dims[n.id] },
        },
      });
    }
    return { materials: m, baseDims: dims };
  }, []);

  const shellMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ferroVert, fragmentShader: shellFrag, transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#ef4444") } },
  }), []);

  // woven threads; endpoint ids kept so selection can boost/dim them
  const threads = useMemo(() => {
    const out: { key: string; from: string; to: string; geo: THREE.TubeGeometry; mat: THREE.ShaderMaterial }[] = [];
    for (const e of EDGES) {
      const a = LAYOUT[e.from]; const b = LAYOUT[e.to];
      if (!a || !b) continue;
      const na = nodeById(e.from)!; const nb = nodeById(e.to)!;
      const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b);
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      const len = va.distanceTo(vb);
      mid.y -= 0.16 * len * 0.35;
      mid.z -= 0.1;
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
      const weight = Math.max(na.blast_radius, nb.blast_radius) / MAX_BLAST;
      const geo = new THREE.TubeGeometry(curve, 24, 0.012 + weight * 0.05, 6, false);
      const isHubThread = e.to === hubId || e.from === hubId;
      const mat = new THREE.ShaderMaterial({
        vertexShader: threadVert, fragmentShader: threadFrag, transparent: true,
        uniforms: {
          uColor: { value: new THREE.Color(isHubThread ? "#b91c1c" : "#7f1d1d") },
          uHubEnd: { value: e.to === hubId ? 1 : 0 },
          uBoost: { value: 1 },
        },
      });
      out.push({ key: `${e.from}-${e.to}`, from: e.from, to: e.to, geo, mat });
    }
    return out;
  }, [hubId]);

  // motion clocks: mount time (the dolly-in) and last selection change (the ripple).
  const mountAt = useRef<number | null>(null);
  const selMark = useRef<{ id: string | null; at: number }>({ id: null, at: -10 });

  useFrame((state) => {
    const E2E = isE2E();
    const wall = state.clock.elapsedTime;
    const t = E2E ? E2E_T : wall; // frozen shader clock under e2e — deterministic pixels
    if (mountAt.current === null) mountAt.current = wall;
    if (selMark.current.id !== selectedNodeId) selMark.current = { id: selectedNodeId, at: wall };

    for (const id in materials) materials[id].uniforms.uTime.value = t;
    shellMat.uniforms.uTime.value = t;
    // the hub's idle breath — a slow luminosity swell on the tension point (paint only)
    materials[hubId].uniforms.uDim.value = baseDims[hubId] * (1 + 0.06 * Math.sin(t * 0.7));

    // ENTERING THE LOOM: a camera dolly-in (not a cut) — z 15.5 -> 10.5 with a slight descend,
    // expo-out over 1.7s. Settled instantly under e2e / reduced motion.
    const dolly = E2E || reducedMotion ? 1 : easeOutCubic((wall - mountAt.current) / 1.7);
    state.camera.position.z = 15.5 - 5.0 * dolly;
    state.camera.position.y = 1.4 * (1 - dolly);
    state.camera.lookAt(0, 0, 0);

    // SELECTION RIPPLE: the boost/dim propagates over ~0.45s instead of snapping — the weave
    // reacts to the pull. Theme-aware thread color (light theme gets a warmer dark-red).
    const ripple = E2E || reducedMotion ? 1 : easeOutCubic((wall - selMark.current.at) / 0.45);
    for (const th of threads) {
      const connected = selectedNodeId && (th.from === selectedNodeId || th.to === selectedNodeId);
      const target = selectedNodeId ? (connected ? 2.4 : 0.45) : 1;
      const cur = th.mat.uniforms.uBoost.value as number;
      th.mat.uniforms.uBoost.value = cur + (target - cur) * ripple;
      const isHubThread = th.to === hubId || th.from === hubId;
      th.mat.uniforms.uColor.value.set(
        theme === "light" ? (isHubThread ? "#c2410c" : "#9a5b4f") : (isHubThread ? "#b91c1c" : "#7f1d1d"),
      );
    }
    // the selection shell grows in with the ripple (a pop, then the pulse takes over)
    if (shellRef.current) shellRef.current.scale.setScalar(1.45 * (0.55 + 0.45 * ripple));
    if (!reducedMotion && !E2E && group.current) {
      group.current.rotation.y = Math.sin(t * 0.09) * 0.22;
      group.current.rotation.x = Math.sin(t * 0.05) * 0.05;
    }
    // project labeled nodes' world positions to screen space and place the HTML labels (pure paint)
    const host = labelHost.current;
    if (host && group.current) {
      const v = new THREE.Vector3();
      // 1st pass: project + clamp inward (away from HUD panels / viewport edges)
      const placed: { el: HTMLElement; x: number; y: number; w: number }[] = [];
      for (const id of LABELED_IDS) {
        const el = host.querySelector<HTMLElement>(`[data-label="${id}"]`);
        const p = LAYOUT[id];
        if (!el || !p) continue;
        v.set(p[0], p[1], p[2]).applyMatrix4(group.current.matrixWorld).project(state.camera);
        const x = Math.max(16, Math.min(83, (v.x * 0.5 + 0.5) * 100));
        const y = Math.max(9, Math.min(88, (-v.y * 0.5 + 0.5) * 100));
        placed.push({ el, x, y, w: 3.2 + (nodeById(id)!.label.length * 0.62) }); // est. width in vw
      }
      // 2nd pass: deterministic label<->label repulsion — fixed order (LABELED_IDS), fixed iterations,
      // no RNG, so identical state projects identically under ?e2e=1.
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < placed.length; i++) {
          for (let j = i + 1; j < placed.length; j++) {
            const a = placed[i], b = placed[j];
            const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
            const minX = (a.w + b.w) / 2, minY = 4.6; // pill height ≈ 4.6% viewport
            if (dx < minX && dy < minY) {
              const push = (minY - dy) / 2 + 0.3;
              if (a.y <= b.y) { a.y = Math.max(9, a.y - push); b.y = Math.min(88, b.y + push); }
              else { a.y = Math.min(88, a.y + push); b.y = Math.max(9, b.y - push); }
            }
          }
        }
      }
      for (const p of placed) { p.el.style.left = `${p.x}%`; p.el.style.top = `${p.y}%`; }
    }
  });

  return (
    <group ref={group}>
      {threads.map((t) => (<mesh key={t.key} geometry={t.geo} material={t.mat} />))}
      {NODES.map((n) => {
        const p = LAYOUT[n.id];
        const sel = n.id === selectedNodeId;
        const size = (0.14 + (n.blast_radius / MAX_BLAST) * 0.72) * (sel ? 1.15 : 1);
        const seg = n.id === hubId ? 48 : 30;
        return (
          <group key={n.id} position={p}>
            <mesh material={materials[n.id]}>
              <sphereGeometry args={[size, seg, seg]} />
            </mesh>
            {sel && (
              <mesh ref={shellRef} material={shellMat} scale={1.45}>
                <sphereGeometry args={[size, 32, 32]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function LiveGraphCanvas({ selectedNodeId, reducedMotion, theme }: {
  selectedNodeId: string | null; reducedMotion: boolean; theme: "dark" | "light";
}) {
  const labelHost = useRef<HTMLDivElement>(null);
  return (
    <div className="loom-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 10.5], fov: 48 }} dpr={[1, 2]} gl={{ antialias: true }} frameloop="demand">
        {!reducedMotion && <FrameDriver fps={40} />}
        <color attach="background" args={[theme === "dark" ? "#05070b" : "#dee2e7"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 9]} intensity={80} color="#ef4444" distance={44} />
        <pointLight position={[-8, 6, 5]} intensity={24} color="#00e5ff" distance={34} />
        <Graph selectedNodeId={selectedNodeId} reducedMotion={reducedMotion} labelHost={labelHost} theme={theme} />
      </Canvas>
      {/* HTML label overlays — pixel-crisp type, positioned from projected 3D coords; PAINT ONLY */}
      <div ref={labelHost} className="gl-labels" aria-hidden="true">
        {LABELED_IDS.map((id) => {
          const n = nodeById(id)!;
          return (
            <div key={id} className={"gl-label" + (id === selectedNodeId ? " sel" : "")} data-label={id}>
              <span className="gl-name">{n.label}</span>
              <span className="gl-metric">{n.blast_radius}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
