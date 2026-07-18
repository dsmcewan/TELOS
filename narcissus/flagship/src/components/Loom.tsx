// The WebGL loom — PAINT ONLY. It reads machine state and renders; it never owns interaction (the CSS pins
// pointer-events: none, and it is aria-hidden — the DOM layer carries the whole story). A field of warp
// threads on near-black; the current station's band glows LEXI-red; pulling a thread tightens its band.
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { STATION_COUNT } from "../stations";
import { ferroVert, ferroFrag } from "../ferrofluid";
import { isE2E } from "../e2e-mode";
import { FrameDriver } from "../frame-driver";

const N = 30;
const easeOutCubic = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const E2E_T = 1.234;

function Warp({ stationIndex, threadPulled, reducedMotion }: {
  stationIndex: number; threadPulled: boolean; reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  // shared ferrofluid material for the tension knots (consistent with the graph hub)
  const knotMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ferroVert, fragmentShader: ferroFrag,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#ef4444") }, uDim: { value: 1 } },
  }), []);
  const mountAt = useRef<number | null>(null);
  useFrame((state, delta) => {
    const E2E = isE2E();
    const wall = state.clock.elapsedTime;
    const t = E2E ? E2E_T : wall;
    if (mountAt.current === null) mountAt.current = wall;
    knotMat.uniforms.uTime.value = t;

    // RETURNING TO THE STORY: a gentle settle-back dolly (z 9.8 -> 8.5), and the camera PANS toward
    // the current band on station change (the loom slides under the reader — movement, not a cut).
    const dolly = E2E || reducedMotion ? 1 : easeOutCubic((wall - mountAt.current) / 1.2);
    state.camera.position.z = 9.8 - 1.3 * dolly;
    const bandX = (Math.floor((stationIndex / STATION_COUNT) * N) - N / 2) * 0.42;
    const targetX = bandX * 0.16;
    state.camera.position.x = E2E || reducedMotion
      ? targetX
      : THREE.MathUtils.damp(state.camera.position.x, targetX, 2.6, delta);
    state.camera.lookAt(state.camera.position.x * 0.4, 0, 0);

    if (reducedMotion || E2E || !group.current) return;
    group.current.rotation.y = Math.sin(t * 0.12) * 0.05;
    group.current.position.y = Math.sin(t * 0.2) * 0.05;
  });
  const threads = [];
  // warp threads as round TUBES with a gentle catenary bow toward the viewer on the current band —
  // the same woven-thread material language as the live-graph view (parity).
  for (let i = 0; i < N; i++) {
    const x = (i - N / 2) * 0.42;
    const band = Math.floor((i / N) * STATION_COUNT);
    const isCurrent = band === stationIndex;
    const color = isCurrent ? "#ef4444" : band < stationIndex ? "#7f1d1d" : "#1f2a3d";
    const h = isCurrent && threadPulled ? 10.5 : 7.6 + ((i * 37) % 7) * 0.12;
    const z = -2.4 - (i % 4) * 0.55;
    const bow = isCurrent ? (threadPulled ? 0.85 : 0.4) : 0.12; // tension bows the current band forward
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x, -h / 2, z),
      new THREE.Vector3(x, 0, z + bow),
      new THREE.Vector3(x, h / 2, z),
    );
    const radius = isCurrent ? 0.028 : 0.016;
    threads.push(
      <mesh key={i}>
        <tubeGeometry args={[curve, 16, radius, 6, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isCurrent ? 2.1 : band < stationIndex ? 0.5 : 0.18}
          toneMapped={false}
        />
      </mesh>,
    );
  }
  // a few weft knots at the current band (the "tension")
  const knots = [];
  const kx = (Math.floor((stationIndex / STATION_COUNT) * N) - N / 2) * 0.42;
  for (let k = 0; k < 3; k++) {
    knots.push(
      <mesh key={`k${k}`} position={[kx, (k - 1) * 1.6, -2.2]} material={knotMat}>
        <sphereGeometry args={[threadPulled ? 0.2 : 0.14, 32, 32]} />
      </mesh>,
    );
  }
  return <group ref={group}>{threads}{knots}</group>;
}

export function Loom({ stationIndex, threadPulled, reducedMotion, theme }: {
  stationIndex: number; threadPulled: boolean; reducedMotion: boolean; theme: "dark" | "light";
}) {
  return (
    <div className="loom-canvas" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 8.5], fov: 46 }} dpr={[1, 2]} gl={{ antialias: true }} frameloop="demand">
        {!reducedMotion && <FrameDriver fps={30} />}
        <color attach="background" args={[theme === "dark" ? "#05070b" : "#dee2e7"]} />
        <ambientLight intensity={0.35} />
        <pointLight position={[0, 0, 6]} intensity={55} color="#ef4444" distance={30} />
        <pointLight position={[-6, 4, 4]} intensity={18} color="#00e5ff" distance={26} />
        <Warp stationIndex={stationIndex} threadPulled={threadPulled} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
