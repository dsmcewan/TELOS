// Capped-rate frame driver: the canvases run frameloop="demand" and this drives invalidation at a
// deliberate rate (the loom's ambient motion reads identically at 30fps; the graph's ripple at 40).
// Halves main-thread render cost on weak devices — measured-perf work, not a visual compromise.
// Under ?e2e=1 it invalidates exactly once: a single deterministic frame.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { isE2E } from "./e2e-mode";

export function FrameDriver({ fps }: { fps: number }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate(); // first frame
    if (isE2E()) return;
    let id: number;
    let last = 0;
    const loop = (t: number) => {
      if (t - last >= 1000 / fps) { last = t; invalidate(); }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [fps, invalidate]);
  return null;
}
