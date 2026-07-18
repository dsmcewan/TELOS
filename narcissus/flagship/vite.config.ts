import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// three.js + react-three-fiber are only reached through React.lazy(Loom/LiveGraph), so they land in an
// async "webgl" chunk — the initial payload (react + xstate + the DOM story = the LCP content) stays lean.
export default defineConfig({
  plugins: [react()],
  server: { port: 4317 },
  preview: { port: 4317 },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("three") || id.includes("@react-three")) return "webgl";
          if (id.includes("react") || id.includes("xstate") || id.includes("scheduler")) return "vendor";
          return undefined;
        },
      },
    },
  },
});
