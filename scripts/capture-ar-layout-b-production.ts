/**
 * Production Layout B screenshots (authenticated, real UI2 + data).
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-ar-layout-b-production.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

async function dismissOnboarding(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function openArHome(page: Page, query = "view=week") {
  const url = `${BASE_URL}/appointment-reminders?${query}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await dismissOnboarding(page);
  await page.getByRole("heading", { level: 1, name: "Calendar" }).waitFor({ timeout: 60_000 });
}

async function shot(page: Page, name: string) {
  const path = join(OUT_DIR, name);
  await page.screenshot({ path, fullPage: false });
  console.log(`Saved ${path}`);
}

async function main() {
  if (
    !process.env.CERT_BROWSER_PASSWORD?.trim() &&
    !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()
  ) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }

  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email} at ${BASE_URL}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
    ignoreHTTPSErrors: true,
  });
  const page = await desktop.newPage();
  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      // ignore
    }
  });

  await openArHome(page);
  await page.waitForTimeout(2000);
  await shot(page, "ar-layout-b-prod-desktop-week-activity.png");

  const apptBtn = page.locator("button").filter({ hasText: /AM|PM|\d{1,2}:\d{2}/ }).first();
  if (await apptBtn.isVisible().catch(() => false)) {
    await apptBtn.click();
    await page.getByRole("tab", { name: "Reminders" }).waitFor({ timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, "ar-layout-b-prod-desktop-week-selected.png");
    await page.getByRole("button", { name: /Activity/i }).first().click().catch(() => {});
    await page.waitForTimeout(500);
  }

  await openArHome(page, "view=day");
  await page.waitForTimeout(1500);
  await shot(page, "ar-layout-b-prod-desktop-day.png");

  await openArHome(page, "view=month");
  await page.waitForTimeout(1500);
  await shot(page, "ar-layout-b-prod-desktop-month.png");

  await page.goto(`${BASE_URL}/appointment-reminders/calendar?view=week`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  const finalUrl = page.url();
  if (!finalUrl.includes("/appointment-reminders") || finalUrl.includes("/calendar")) {
    console.warn("Legacy calendar redirect may have failed:", finalUrl);
  }

  const tablet = await browser.newContext({
    viewport: { width: 1024, height: 800 },
    storageState: auth.storageState,
  });
  const tabPage = await tablet.newPage();
  await openArHome(tabPage);
  await tabPage.waitForTimeout(1500);
  await shot(tabPage, "ar-layout-b-prod-tablet-week.png");

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: auth.storageState,
  });
  const mobPage = await mobile.newPage();
  await openArHome(mobPage, "view=day");
  await mobPage.waitForTimeout(1500);
  await shot(mobPage, "ar-layout-b-prod-mobile-day.png");

  if (await apptBtn.isVisible().catch(() => false)) {
    await mobPage.locator("button").filter({ hasText: /AM|PM|\d{1,2}:\d{2}/ }).first().click();
    await mobPage.waitForTimeout(1200);
    await shot(mobPage, "ar-layout-b-prod-mobile-appointment-sheet.png");
  }

  await browser.close();
  console.log("capture-ar-layout-b-production: done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
