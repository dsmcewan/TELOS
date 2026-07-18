// The live weave, rendered as WebGL PAINT (pointer-events:none, aria-hidden — the DOM list is the truth).
// Nodes: the top-by-blast-radius nodes Lachesis measured over Clotho's live weave. Size ∝ blast_radius,
// color = risk_class. The hub (canonicalize) sits at the tension point with a fresnel/ferrofluid shader.
// Edges = subgraph_edges. Top nodes carry billboarded in-scene labels.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NODES, NODES_BY_BLAST, EDGES, LAYOUT, LABELED_IDS, MAX_BLAST, riskColor, nodeById } from "../livegraph";

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

const hubVert = /* glsl */`
  varying vec3 vN; varying vec3 vV;
  void main(){
    vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const hubFrag = /* glsl */`
  uniform float uTime; uniform vec3 uColor;
  varying vec3 vN; varying vec3 vV;
  void main(){
    float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.4);
    float pulse = 0.86 + 0.14 * sin(uTime * 1.8);
    vec3 col = uColor * (0.3 + fres * 2.6 * pulse);
    gl_FragColor = vec4(col, 1.0);
  }`;

function Graph({ selectedNodeId, reducedMotion }: { selectedNodeId: string | null; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const hubMat = useRef<THREE.ShaderMaterial>(null);
  const hubId = NODES_BY_BLAST[0].id;

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
    if (hubMat.current) hubMat.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (reducedMotion || !group.current) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.09) * 0.22;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05;
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
        const size = 0.14 + (n.blast_radius / MAX_BLAST) * 0.72;
        const color = riskColor(n.risk_class);
        const sel = n.id === selectedNodeId;
        const hub = n.id === hubId;
        if (hub) {
          return (
            <mesh key={n.id} position={p}>
              <sphereGeometry args={[size, 48, 48]} />
              <shaderMaterial ref={hubMat} vertexShader={hubVert} fragmentShader={hubFrag}
                uniforms={{ uTime: { value: 0 }, uColor: { value: new THREE.Color("#ef4444") } }} toneMapped={false} />
            </mesh>
          );
        }
        return (
          <mesh key={n.id} position={p}>
            <sphereGeometry args={[size, 24, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={sel ? 3.4 : 1.15} toneMapped={false} />
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
      <Canvas camera={{ position: [0, 0, 12], fov: 46 }} dpr={[1, 2]} gl={{ antialias: true }} frameloop={reducedMotion ? "demand" : "always"}>
        <color attach="background" args={[theme === "dark" ? "#05070b" : "#dee2e7"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 9]} intensity={80} color="#ef4444" distance={44} />
        <pointLight position={[-8, 6, 5]} intensity={24} color="#00e5ff" distance={34} />
        <Graph selectedNodeId={selectedNodeId} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
