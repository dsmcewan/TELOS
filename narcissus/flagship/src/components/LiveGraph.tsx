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

function Graph({ selectedNodeId, reducedMotion, labelHost }: {
  selectedNodeId: string | null; reducedMotion: boolean; labelHost: React.RefObject<HTMLDivElement>;
}) {
  const group = useRef<THREE.Group>(null);
  const hubId = NODES_BY_BLAST[0].id;

  const materials = useMemo(() => {
    const m: Record<string, THREE.ShaderMaterial> = {};
    for (const n of NODES) {
      const weight = n.blast_radius / MAX_BLAST;
      const z = LAYOUT[n.id]?.[2] ?? 0;
      const depthDim = 1 + Math.min(0, z) * 0.16;
      const rankDim = 0.45 + weight * 0.65;
      m[n.id] = new THREE.ShaderMaterial({
        vertexShader: ferroVert, fragmentShader: ferroFrag,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(riskColor(n.risk_class)) },
          uDim: { value: Math.max(0.28, rankDim * depthDim) },
        },
      });
    }
    return m;
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

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const id in materials) materials[id].uniforms.uTime.value = t;
    shellMat.uniforms.uTime.value = t;
    // selection drama: connected threads brighten, unrelated dim
    for (const th of threads) {
      const connected = selectedNodeId && (th.from === selectedNodeId || th.to === selectedNodeId);
      th.mat.uniforms.uBoost.value = selectedNodeId ? (connected ? 2.4 : 0.45) : 1;
    }
    if (!reducedMotion && group.current) {
      group.current.rotation.y = Math.sin(t * 0.09) * 0.22;
      group.current.rotation.x = Math.sin(t * 0.05) * 0.05;
    }
    // project labeled nodes' world positions to screen space and place the HTML labels (pure paint)
    const host = labelHost.current;
    if (host && group.current) {
      const v = new THREE.Vector3();
      for (const id of LABELED_IDS) {
        const el = host.querySelector<HTMLElement>(`[data-label="${id}"]`);
        const p = LAYOUT[id];
        if (!el || !p) continue;
        v.set(p[0], p[1], p[2]).applyMatrix4(group.current.matrixWorld).project(state.camera);
        // clamp inward so labels never sit under the HUD panels or clip the viewport edge
        const x = Math.max(16, Math.min(83, (v.x * 0.5 + 0.5) * 100));
        const y = Math.max(9, Math.min(88, (-v.y * 0.5 + 0.5) * 100));
        el.style.left = `${x}%`;
        el.style.top = `${y}%`;
      }
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
              <mesh material={shellMat} scale={1.45}>
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
      <Canvas camera={{ position: [0, 0, 10.5], fov: 48 }} dpr={[1, 2]} gl={{ antialias: true }} frameloop={reducedMotion ? "demand" : "always"}>
        <color attach="background" args={[theme === "dark" ? "#05070b" : "#dee2e7"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 9]} intensity={80} color="#ef4444" distance={44} />
        <pointLight position={[-8, 6, 5]} intensity={24} color="#00e5ff" distance={34} />
        <Graph selectedNodeId={selectedNodeId} reducedMotion={reducedMotion} labelHost={labelHost} />
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
