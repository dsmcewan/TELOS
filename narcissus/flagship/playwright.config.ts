import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  retries: 0, workers: 1, reporter: [["list"]],
  use: { baseURL: "http://localhost:4317", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "npm run build && npm run preview", url: "http://localhost:4317", reuseExistingServer: false, timeout: 120000 }
});
