/**
 * Single production screenshot: AR Calendar page + nav.
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-ar-calendar-production-screenshot.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

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

  const url = `${BASE_URL}/appointment-reminders/calendar`;
  console.log(`Opening ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
  }
  await page.waitForTimeout(3000);

  const out = join(OUT_DIR, "ar-calendar-production.png");
  await page.screenshot({ path: out, fullPage: true });
  console.log(`Saved ${out}`);

  const navHasCalendar = await page.getByRole("link", { name: "Calendar", exact: true }).isVisible();
  console.log(`Nav Calendar link visible: ${navHasCalendar}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
