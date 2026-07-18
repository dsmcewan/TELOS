// The live weave, rendered as WebGL PAINT (pointer-events:none, aria-hidden — the DOM list is the truth).
// Nodes: the top-by-blast-radius nodes Lachesis measured over Clotho's live weave. Size ∝ blast_radius,
// color = risk_class. The hub (canonicalize, blast 184) sits at the tension point. Edges = subgraph_edges.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { NODES, NODES_BY_BLAST, EDGES, LAYOUT, MAX_BLAST, riskColor } from "../livegraph";

function Graph({ selectedNodeId, reducedMotion }: { selectedNodeId: string | null; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const hubId = NODES_BY_BLAST[0].id;

  const edgePositions = useMemo(() => {
    const arr: number[] = [];
    for (const e of EDGES) {
      const a = LAYOUT[e.from]; const b = LAYOUT[e.to];
      if (a && b) { arr.push(a[0], a[1], a[2], b[0], b[1], b[2]); }
    }
    return new Float32Array(arr);
  }, []);

  useFrame((state) => {
    if (reducedMotion || !group.current) return;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.25;
  });

  return (
    <group ref={group}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[edgePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#7f1d1d" transparent opacity={0.45} toneMapped={false} />
      </lineSegments>
      {NODES.map((n) => {
        const p = LAYOUT[n.id];
        const size = 0.13 + (n.blast_radius / MAX_BLAST) * 0.55;
        const color = riskColor(n.risk_class);
        const sel = n.id === selectedNodeId;
        const hub = n.id === hubId;
        return (
          <mesh key={n.id} position={p}>
            <sphereGeometry args={[size, 22, 22]} />
            <meshStandardMaterial
              color={color} emissive={color}
              emissiveIntensity={sel ? 3.2 : hub ? 2.3 : 1.05}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function LiveGraphCanvas({ selectedNodeId, reducedMotion, theme }: {
  selectedNodeId: string | null; reducedMotion: boolean; theme: "dark" | "light";
}) {
  return (
    <div className="loom-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 11], fov: 46 }} dpr={[1, 2]} gl={{ antialias: true }} frameloop={reducedMotion ? "demand" : "always"}>
        <color attach="background" args={[theme === "dark" ? "#05070b" : "#dee2e7"]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 8]} intensity={70} color="#ef4444" distance={40} />
        <pointLight position={[-7, 5, 5]} intensity={22} color="#00e5ff" distance={30} />
        <Graph selectedNodeId={selectedNodeId} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
