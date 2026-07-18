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
      m[n.id] = new THREE.ShaderMaterial({
        vertexShader: ferroVert, fragmentShader: ferroFrag,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(riskColor(n.risk_class)) } },
      });
    }
    return m;
  }, []);

  const edgePositions = useMemo(() => {
    const arr: number[] = [];
    for (const e of EDGES) {
      const a = LAYOUT[e.from]; const b = LAYOUT[e.to];
      if (a && b) arr.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    }
    return new Float32Array(arr);
  }, []);

  const labels = useMemo(
    () => LABELED_IDS.map((id) => {
      const n = nodeById(id)!;
      return { id, pos: LAYOUT[id], tex: makeLabelTexture(n.label, riskColor(n.risk_class)) };
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
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#b91c1c" transparent opacity={0.28} toneMapped={false} />
      </lineSegments>

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
