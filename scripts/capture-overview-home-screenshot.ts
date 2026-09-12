/** Appointments Home neutral pilot — Revision 2 screenshot set.
 * UI_AGENT_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-overview-home-screenshot.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/transovo-neutral-2027-test";
const ROUTE = `${BASE}/appointments/overview`;

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function ready(page: Page) {
  await page.goto(ROUTE, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("html.appt-overview-pilot-active", { timeout: 60000 });
  await page.waitForSelector(".appt-overview-pilot", { timeout: 120000 });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
}

async function shot(page: Page, name: string, opts?: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } }) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: opts?.fullPage ?? false, clip: opts?.clip });
  console.log("wrote", path);
}

async function scrollToSelector(page: Page, selector: string) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "attached", timeout: 120000 });
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await ready(desktop);
    await shot(desktop, "R2_DESKTOP_FULL.png", { fullPage: true });
    await shot(desktop, "R2_DESKTOP_VIEWPORT.png");
    await shot(desktop, "R2_DESKTOP_SIDEBAR.png", {
      clip: { x: 0, y: 0, width: 260, height: 900 },
    });
    await shot(desktop, "R2_DESKTOP_KPI.png", {
      clip: { x: 248, y: 72, width: 1180, height: 200 },
    });
    await scrollToSelector(desktop, ".appt-overview-row-lower, h2:has-text('Recent conversations')");
    await shot(desktop, "R2_DESKTOP_LOWER.png", {
      clip: { x: 248, y: 380, width: 1180, height: 520 },
    });
  } finally {
    await desktop.close();
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await ready(mobile);
    await shot(mobile, "R2_MOBILE_TOP.png", {
      clip: { x: 0, y: 0, width: 390, height: 320 },
    });
    await scrollToSelector(mobile, ".ref-deco-kpi");
    await shot(mobile, "R2_MOBILE_KPI.png", {
      clip: { x: 0, y: 120, width: 390, height: 220 },
    });
    await scrollToSelector(mobile, ".appt-overview-module");
    await shot(mobile, "R2_MOBILE_SCHEDULE.png", {
      clip: { x: 0, y: 0, width: 390, height: 420 },
    });
    await scrollToSelector(mobile, ".appt-overview-chart-module");
    await shot(mobile, "R2_MOBILE_CHART.png", {
      clip: { x: 0, y: 0, width: 390, height: 440 },
    });
    await scrollToSelector(mobile, ".appt-overview-row-lower");
    await shot(mobile, "R2_MOBILE_LOWER.png", {
      clip: { x: 0, y: 0, width: 390, height: 480 },
    });
    await mobile.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mobile.waitForTimeout(400);
    await shot(mobile, "R2_MOBILE_BOTTOM_NAV.png", {
      clip: { x: 0, y: 744, width: 390, height: 100 },
    });
    await shot(mobile, "R2_MOBILE_FULL.png", { fullPage: true });
  } finally {
    await mobile.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
