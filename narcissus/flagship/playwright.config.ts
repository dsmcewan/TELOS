import { defineConfig, devices } from "@playwright/test";
// PW_PORT lets the suite run beside a live dev server (default 4317 preserved for CI parity).
const port = process.env.PW_PORT ?? "4317";
export default defineConfig({
  testDir: "./tests/e2e",
  retries: 0, workers: 1, reporter: [["list"]],
  use: { baseURL: `http://localhost:${port}`, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `npm run build && npx vite preview --port ${port}`, url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 120000 }
});
