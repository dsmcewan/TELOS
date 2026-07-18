// Captures rendered visual evidence of the flagship for The Eye's aesthetic-blade review.
import { test } from "@playwright/test";
import path from "node:path";
const dir = path.resolve("screenshots");

test("capture flagship views", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?e2e=1");
  await page.getByTestId("station-title").waitFor();
  await page.waitForTimeout(600); // let the loom paint one frame
  await page.screenshot({ path: path.join(dir, "01-station-distrust-dark.png") });

  // station 3 (Daedalus / reiteration) with the thread pulled + evidence open
  await page.locator('[data-testid="cmd-GO_STATION"][data-index="2"]').click();
  await page.getByTestId("cmd-PULL_THREAD").click();
  await page.getByTestId("cmd-OPEN_EVIDENCE").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, "02-station-loom-evidence.png") });

  // station 5 (ground truth) — the emotional peak
  await page.locator('[data-testid="cmd-GO_STATION"][data-index="4"]').click();
  await page.getByTestId("cmd-OPEN_EVIDENCE").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, "03-station-ground-truth.png") });

  // light theme
  await page.getByTestId("cmd-TOGGLE_THEME").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, "04-light-theme.png") });
});
