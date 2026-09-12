/**
 * Calendar operational visual QA set.
 * DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-calendar-operational-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";

async function snap(page: Page, name: string, pathSuffix = "") {
  const path = join(OUT, `${name}${pathSuffix}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log("wrote", path);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/appointments/calendar?view=week&date=2026-09-12`, { waitUntil: "networkidle" });
  await snap(page, "calendar-desktop-week");
  await page.goto(`${BASE}/appointments/calendar?view=day&date=2026-09-12`, { waitUntil: "networkidle" });
  await snap(page, "calendar-desktop-day");
  await page.goto(`${BASE}/appointments/calendar?view=month&date=2026-09-12`, { waitUntil: "networkidle" });
  await snap(page, "calendar-desktop-month");
  await page.goto(`${BASE}/appointments/calendar?view=agenda&date=2026-09-12`, { waitUntil: "networkidle" });
  await snap(page, "calendar-desktop-agenda");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE}/appointments/calendar?view=week&date=2026-09-12`, { waitUntil: "networkidle" });
  await snap(page, "calendar-tablet-week");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/appointments/calendar?view=day&date=2026-09-12`, { waitUntil: "networkidle" });
  await snap(page, "calendar-mobile-day");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
