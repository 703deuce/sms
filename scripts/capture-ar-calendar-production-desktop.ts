/**
 * Production desktop screenshots: AR Calendar grid + event detail sheet.
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-ar-calendar-production-desktop.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

async function main() {
  if (process.env.AR_SCREENSHOT_DEV_BYPASS?.trim() === "1") {
    process.env.DEV_AUTH_BYPASS = "1";
    if (process.env.AR_SCREENSHOT_EMAIL?.trim()) {
      process.env.DEV_AUTH_BYPASS_EMAIL = process.env.AR_SCREENSHOT_EMAIL.trim();
    }
  }
  const useBypass =
    process.env.DEV_AUTH_BYPASS?.trim() === "1" ||
    process.env.DEV_AUTH_BYPASS?.trim()?.toLowerCase() === "true";
  if (
    !useBypass &&
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      // ignore
    }
  });

  const calendarUrl = `${BASE_URL}/appointment-reminders/calendar?view=month`;
  console.log(`Opening ${calendarUrl}`);
  await page.goto(calendarUrl, { waitUntil: "networkidle", timeout: 120000 });

  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
  }

  await page.waitForTimeout(4000);

  const emptyConnect = page.getByRole("heading", { name: "Connect a calendar" });
  if (await emptyConnect.isVisible().catch(() => false)) {
    console.error("Calendar still showing connect empty state — check workspace / deploy");
    await page.screenshot({
      path: join(OUT_DIR, "ar-calendar-production-desktop-empty.png"),
      fullPage: true,
    });
    await browser.close();
    process.exit(2);
  }

  const gridShot = join(OUT_DIR, "ar-calendar-production-desktop-month.png");
  await page.screenshot({ path: gridShot, fullPage: true });
  console.log(`Saved ${gridShot}`);

  const monthBtn = page.getByRole("button", { name: "Month" });
  if (await monthBtn.isVisible().catch(() => false)) {
    await monthBtn.click().catch(() => {});
    await page.waitForTimeout(800);
  }

  const target = page.locator("button").filter({ hasText: /Service Visit|AR Live|AM|PM|\d{1,2}:\d{2}/ }).first();
  await target.waitFor({ state: "visible", timeout: 30000 });
  await target.click();

  const sheet = page.locator("[data-slot='sheet-content']");
  await sheet.waitFor({ state: "visible", timeout: 15000 });
  await page.getByText("Loading…").waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
  await page.locator("[data-slot='sheet-content']").getByText(/When|Customer|Reminders|Service Visit/).first().waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(400);

  const detailShot = join(OUT_DIR, "ar-calendar-production-desktop-event-detail.png");
  await page.screenshot({ path: detailShot, fullPage: true });
  console.log(`Saved ${detailShot}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
