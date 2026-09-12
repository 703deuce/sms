/**
 * Soft Cool Slate overview screenshot set (204px sidebar).
 * DEV_AUTH_BYPASS=1 npm run dev  →  npx tsx scripts/capture-overview-soft-cool-slate-screenshot.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3000";
const OUT =
  process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/transovo-soft-cool-slate-204-test";
const ROUTE = `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/appointments/overview")}`;
const SIDEBAR_W = 204;

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function ready(page: Page) {
  await page.goto(ROUTE, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForURL(/\/appointments\/overview/, { timeout: 120000 });
  await page.waitForSelector("html.appt-overview-slate-204, html:has(.appt-overview-pilot)", {
    timeout: 90000,
  }).catch(() => undefined);
  await page.waitForSelector('[data-overview-revision="soft-cool-slate-204"]', { timeout: 120000 }).catch(
    () => undefined,
  );
  await page.waitForSelector('[data-overview-revision="soft-cool-slate-204"]', {
    state: "attached",
    timeout: 120000,
  });
  await page.waitForSelector(".appt-overview-pilot", { state: "attached", timeout: 120000 });
  await page.waitForFunction(
    () => {
      const shell = document.querySelector(".product-theme");
      return shell ? shell.getBoundingClientRect().width > 200 : false;
    },
    { timeout: 120000 },
  );
  await dismissOverlays(page);
  await page.waitForTimeout(2500);
}

async function shot(
  page: Page,
  name: string,
  opts?: { fullPage?: boolean; clip?: { x: number; y: number; width: number; height: number } },
) {
  const path = join(OUT, name);
  await page.screenshot({ path, fullPage: opts?.fullPage ?? false, clip: opts?.clip });
  console.log("wrote", path);
}

async function scrollTo(page: Page, selector: string) {
  const loc = page.locator(selector).first();
  if (await loc.count()) {
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const contentX = SIDEBAR_W;
  const contentW = 1440 - SIDEBAR_W;

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await ready(desktop);
    await shot(desktop, "01-desktop-full.png", { fullPage: true });
    await shot(desktop, "02-desktop-sidebar.png", {
      clip: { x: 0, y: 0, width: SIDEBAR_W + 12, height: 900 },
    });
    await shot(desktop, "03-desktop-page-header.png", {
      clip: { x: contentX, y: 54, width: contentW, height: 120 },
    });
    await shot(desktop, "04-desktop-kpi.png", {
      clip: { x: contentX, y: 160, width: contentW, height: 200 },
    });
    await scrollTo(desktop, ".appt-overview-chart-module, h2:has-text('Bookings')");
    await shot(desktop, "05-desktop-chart-lower.png", {
      clip: { x: contentX, y: 280, width: contentW, height: 620 },
    });
  } finally {
    await desktop.close();
  }

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await ready(mobile);
    await shot(mobile, "06-mobile-top.png", { clip: { x: 0, y: 0, width: 390, height: 280 } });
    await scrollTo(mobile, ".ref-deco-kpi");
    await shot(mobile, "07-mobile-kpi.png", { clip: { x: 0, y: 80, width: 390, height: 240 } });
    await scrollTo(mobile, "h2:has-text(\"Today's schedule\")");
    await shot(mobile, "08-mobile-operational.png", { clip: { x: 0, y: 0, width: 390, height: 480 } });
    await mobile.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await mobile.waitForTimeout(500);
    await shot(mobile, "09-mobile-bottom-nav.png", { clip: { x: 0, y: 744, width: 390, height: 100 } });
  } finally {
    await mobile.close();
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
