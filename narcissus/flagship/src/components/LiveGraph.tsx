// The live weave, rendered as WebGL PAINT (pointer-events:none, aria-hidden — the DOM list is the truth).
// Nodes: the top-by-blast-radius nodes Lachesis measured over Clotho's live weave. Size ∝ blast_radius,
// color = risk_class. The hub (canonicalize) sits at the tension point with a fresnel/ferrofluid shader.
// Edges = subgraph_edges. Top nodes carry billboarded in-scene labels.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NODES, NODES_BY_BLAST, EDGES, LAYOUT, LABELED_IDS, MAX_BLAST, riskColor, nodeById } from "../livegraph";
import { ferroVert, ferroFrag } from "../ferrofluid";

// billboarded label as a sprite with a canvas texture (no extra deps; culled to the important nodes).
function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
  const dpr = 2, w = 320, h = 72;
  const c = document.createElement("canvas");
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.font = "600 30px Inter, ui-sans-serif, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.9)"; ctx.shadowBlur = 8;
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(text, w / 2, h / 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.fillRect(w / 2 - 22, h - 14, 44, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function Graph({ selectedNodeId, reducedMotion }: { selectedNodeId: string | null; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const hubId = NODES_BY_BLAST[0].id;
  // one ferrofluid material per node — dimensional orbs, risk-colored, all ticked together in useFrame.
  const materials = useMemo(() => {
    const m: Record<string, THREE.ShaderMaterial> = {};
    for (const n of NODES) {
      // depth/value hierarchy WITHOUT lying about risk color: brightness falls off with blast rank +
      // z-depth (far/minor orbs dimmer), so the field reads dimensional instead of monotone.
      const weight = n.blast_radius / MAX_BLAST;
      const z = LAYOUT[n.id]?.[2] ?? 0;
      const depthDim = 1 + Math.min(0, z) * 0.16;              // farther (negative z) -> dimmer
      const rankDim = 0.45 + weight * 0.65;                    // minor orbs dimmer, hub full
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

  // Edges as WOVEN THREAD under load: dimensional tubes with a catenary sag, thickness scaled by the
  // heavier endpoint's blast radius, and an emissive gradient intensifying toward the hub end.
  const threads = useMemo(() => {
    const out: { key: string; geo: THREE.TubeGeometry; mat: THREE.ShaderMaterial }[] = [];
    const threadVert = /* glsl */`
      varying float vT;
      void main(){ vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const threadFrag = /* glsl */`
      uniform vec3 uColor; uniform float uHubEnd; varying float vT;
      void main(){
        float towardHub = uHubEnd > 0.5 ? vT : (1.0 - vT);
        float glow = 0.22 + pow(towardHub, 2.0) * 1.15;   // brightens toward the hub end
        gl_FragColor = vec4(uColor * glow, 0.9);
      }`;
    for (const e of EDGES) {
      const a = LAYOUT[e.from]; const b = LAYOUT[e.to];
      if (!a || !b) continue;
      const na = nodeById(e.from)!; const nb = nodeById(e.to)!;
      const va = new THREE.Vector3(...a); const vb = new THREE.Vector3(...b);
      const mid = va.clone().add(vb).multiplyScalar(0.5);
      const len = va.distanceTo(vb);
      mid.y -= 0.16 * len * 0.35;                 // catenary sag — thread under gravity/tension
      mid.z -= 0.1;
      const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
      const weight = Math.max(na.blast_radius, nb.blast_radius) / MAX_BLAST;
      const radius = 0.012 + weight * 0.05;       // thickness ∝ heavier endpoint's blast
      const geo = new THREE.TubeGeometry(curve, 24, radius, 6, false);
      const hubEnd = e.to === NODES_BY_BLAST[0].id ? 1 : e.from === NODES_BY_BLAST[0].id ? 0 : -1;
      const mat = new THREE.ShaderMaterial({
        vertexShader: threadVert, fragmentShader: threadFrag, transparent: true,
        uniforms: { uColor: { value: new THREE.Color("#b91c1c") }, uHubEnd: { value: hubEnd === 1 ? 1 : 0 } },
      });
      if (hubEnd === -1) mat.uniforms.uColor.value = new THREE.Color("#7f1d1d"); // non-hub threads dimmer
      out.push({ key: `${e.from}-${e.to}`, geo, mat });
    }
    return out;
  }, []);

  // Position-aware labels: nudge inward away from the HUD zones (left panel ~ x < -4.6 in world space at
  // z≈0, right list ~ x > 5.2) and clamp the vertical extremes, so labels never clip behind the overlays.
  const labels = useMemo(
    () => LABELED_IDS.map((id) => {
      const n = nodeById(id)!;
      const p = LAYOUT[id];
      const x = Math.max(-4.4, Math.min(4.9, p[0]));
      const y = Math.max(-3.4, Math.min(3.6, p[1]));
      return { id, pos: [x, y, p[2]] as [number, number, number], tex: makeLabelTexture(n.label, riskColor(n.risk_class)) };
    }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    for (const id in materials) materials[id].uniforms.uTime.value = t;
    if (reducedMotion || !group.current) return;
    group.current.rotation.y = Math.sin(t * 0.09) * 0.22;
    group.current.rotation.x = Math.sin(t * 0.05) * 0.05;
  });

  return (
    <group ref={group}>
      {threads.map((t) => (
        <mesh key={t.key} geometry={t.geo} material={t.mat} />
      ))}

      {NODES.map((n) => {
        const p = LAYOUT[n.id];
        const sel = n.id === selectedNodeId;
        const size = (0.14 + (n.blast_radius / MAX_BLAST) * 0.72) * (sel ? 1.2 : 1);
        const seg = n.id === hubId ? 48 : 30;
        return (
          <mesh key={n.id} position={p} material={materials[n.id]}>
            <sphereGeometry args={[size, seg, seg]} />
          </mesh>
        );
      })}

      {labels.map((l) => (
        <sprite key={l.id} position={[l.pos[0], l.pos[1] + (l.id === hubId ? 1.15 : 0.62), l.pos[2]]} scale={[2.5, 0.56, 1]}>
          <spriteMaterial map={l.tex} transparent depthWrite={false} depthTest={false} />
        </sprite>
      ))}
    </group>
  );
}

export function LiveGraphCanvas({ selectedNodeId, reducedMotion, theme }: {
  selectedNodeId: string | null; reducedMotion: boolean; theme: "dark" | "light";
}) {
  return (
    <div className="loom-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 10.5], fov: 48 }} dpr={[1, 2]} gl={{ antialias: true }} frameloop={reducedMotion ? "demand" : "always"}>
        <color attach="background" args={[theme === "dark" ? "#05070b" : "#dee2e7"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 9]} intensity={80} color="#ef4444" distance={44} />
        <pointLight position={[-8, 6, 5]} intensity={24} color="#00e5ff" distance={34} />
        <Graph selectedNodeId={selectedNodeId} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
