/**
 * Supplemental captures: scheduling bottom, activity tab with history, inbox thread.
 */
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/ar-remaining-13";

async function dismissChrome(page: import("playwright").Page) {
  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      // ignore
    }
  });
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function main() {
  if (!process.env.CERT_BROWSER_PASSWORD?.trim()) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }
  const auth = await certAuthenticate(BASE);
  if (!auth.ok) process.exit(1);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
    ignoreHTTPSErrors: true,
  });

  await page.goto(`${BASE}/appointment-reminders/settings?tab=scheduling`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await dismissChrome(page);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(OUT, "11-settings-scheduling-full.png"), fullPage: true });
  const businessHours = page.getByText("Business hours").first();
  if (await businessHours.isVisible().catch(() => false)) {
    await businessHours.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }
  const apptRules = page.getByText("Appointment-type rules").first();
  if (await apptRules.isVisible().catch(() => false)) {
    await apptRules.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: join(OUT, "11-settings-scheduling-scrolled.png"), fullPage: false });
  console.log("updated 11");

  for (const engagement of ["confirmed", "reschedule_requested", "cancellation_requested", "needs_attention"]) {
    await page.goto(`${BASE}/appointment-reminders/appointments?date=all&engagement=${engagement}`, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await dismissChrome(page);
    await page.waitForTimeout(2500);
    const row = page.locator("table tbody tr").first();
    if (!(await row.isVisible().catch(() => false))) continue;
    await row.click();
    await page.locator("[data-slot='sheet-content']").waitFor({ state: "visible", timeout: 15000 });
    await page.getByRole("tab", { name: "Activity" }).click();
    await page.waitForTimeout(1500);
    const hasHistory = await page.getByText(/Customer action history|Delivery ledger/i).isVisible().catch(() => false);
    if (hasHistory) {
      await page.screenshot({ path: join(OUT, "05-appointment-tab-activity.png"), fullPage: false });
      console.log(`updated 05 via engagement=${engagement}`);
      break;
    }
  }

  await page.goto(`${BASE}/conversations`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dismissChrome(page);
  await page.waitForTimeout(5000);
  const listItem = page.locator('[role="button"], button, a').filter({ hasText: /\+1|\(\d{3}\)/ }).first();
  if (await listItem.isVisible().catch(() => false)) {
    await listItem.click();
    await page.waitForTimeout(3500);
    await page.screenshot({ path: join(OUT, "12-held-sms-conversation-thread.png"), fullPage: false });
    console.log("captured 12 conversation thread");
  } else {
    console.warn("no conversation list item found");
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
