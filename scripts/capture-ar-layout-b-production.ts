/**
 * Production Layout B screenshots (authenticated, real UI2 + data).
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-ar-layout-b-production.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

async function dismissOnboarding(page: Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function openArHome(page: Page, query = "view=week") {
  const url = `${BASE_URL}/appointment-reminders?${query}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 180_000 });
  await dismissOnboarding(page);
  await page.getByRole("heading", { level: 1, name: "Calendar" }).waitFor({ timeout: 60_000 });
  await page.getByText("Upcoming reminders").waitFor({ timeout: 60_000 }).catch(() => {});
  await page.locator("aside[aria-label='Appointment context']").waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

async function shot(page: Page, name: string) {
  const path = join(OUT_DIR, name);
  await page.screenshot({ path, fullPage: false });
  console.log(`Saved ${path}`);
}

function calendarGridAppointmentButtons(page: Page): Locator {
  return page
    .locator("div.min-w-\\[640px\\]")
    .locator("button")
    .filter({ hasText: /\d{1,2}:\d{2}\s*(AM|PM)/i });
}

async function waitForAppointmentDetail(page: Page) {
  const aside = page.locator("aside[aria-label='Appointment context']");
  if (await aside.isVisible().catch(() => false)) {
    await aside.getByRole("tab", { name: "Reminders" }).waitFor({ timeout: 25_000 });
    return;
  }
  await page
    .getByRole("tab", { name: "Reminders" })
    .first()
    .waitFor({ timeout: 25_000 });
}

async function openFirstGridAppointment(page: Page): Promise<boolean> {
  const btn = calendarGridAppointmentButtons(page).first();
  if (!(await btn.isVisible().catch(() => false))) {
    const fallback = page.locator("button").filter({ hasText: /\d{1,2}:\d{2}\s*(AM|PM)/i }).first();
    if (!(await fallback.isVisible().catch(() => false))) return false;
    await fallback.click();
  } else {
    await btn.click();
  }
  await waitForAppointmentDetail(page);
  await page.waitForTimeout(800);
  return true;
}

async function openRemindersTab(page: Page) {
  const asideTab = page
    .locator("aside[aria-label='Appointment context']")
    .getByRole("tab", { name: "Reminders" });
  if (await asideTab.isVisible().catch(() => false)) {
    await asideTab.click();
  } else {
    await page.getByRole("tab", { name: "Reminders" }).first().click();
  }
  await page.waitForTimeout(600);
}

async function backToActivity(page: Page) {
  const back = page
    .locator("aside[aria-label='Appointment context']")
    .getByRole("button", { name: /Activity/i });
  if (await back.isVisible().catch(() => false)) {
    await back.click();
    await page.getByText("Upcoming reminders").waitFor({ timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

/** Scan a few appointments for reminder on/off, blockers, or customer replies. */
async function findAppointmentState(
  page: Page,
  want: "reminders_on" | "reminders_off" | "blocker" | "replies",
): Promise<boolean> {
  const buttons = calendarGridAppointmentButtons(page);
  const count = Math.min(await buttons.count(), 12);
  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click();
    await waitForAppointmentDetail(page).catch(() => {});
    await openRemindersTab(page);
    const aside = page.locator("aside[aria-label='Appointment context']");
    const body = (await aside.isVisible().catch(() => false))
      ? await aside.innerText().catch(() => "")
      : await page.locator("[role='dialog'], [data-slot='sheet-content']").first().innerText().catch(() => "");
    const match =
      want === "reminders_on"
        ? /Reminders are on/i.test(body) && !/Reminders are off/i.test(body)
        : want === "reminders_off"
          ? /Reminders are off/i.test(body)
          : want === "blocker"
            ? /Missing phone|Invalid phone|delivery|blocked|needs review|Stop reminders/i.test(body)
            : /Customer:|Open full conversation|replied/i.test(body);
    if (match) return true;
    await backToActivity(page);
  }
  return false;
}

async function verifyLegacyRedirect(page: Page): Promise<void> {
  const response = await page.goto(`${BASE_URL}/appointment-reminders/calendar?view=week`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page
    .waitForURL((url) => !url.pathname.includes("/calendar"), { timeout: 60_000 })
    .catch(() => {});
  const finalUrl = page.url();
  const redirected = !finalUrl.includes("/appointment-reminders/calendar");
  const status = response?.status();
  console.log(
    redirected
      ? `Legacy redirect OK (${status ?? "?"}): ${finalUrl}`
      : `Legacy calendar redirect may have failed (${status ?? "?"}): ${finalUrl}`,
  );
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
  await shot(page, "ar-layout-b-prod-desktop-week-activity.png");

  if (await openFirstGridAppointment(page)) {
    await shot(page, "ar-layout-b-prod-desktop-week-selected.png");
    await backToActivity(page);
  }

  await openArHome(page, "view=day");
  await shot(page, "ar-layout-b-prod-desktop-day.png");

  await openArHome(page, "view=month");
  await shot(page, "ar-layout-b-prod-desktop-month.png");

  await openArHome(page, "view=week");
  if (await findAppointmentState(page, "reminders_on")) {
    await openRemindersTab(page);
    await shot(page, "ar-layout-b-prod-desktop-reminders-enabled.png");
    await backToActivity(page);
  } else {
    console.warn("No appointment with reminders enabled found for screenshot");
  }

  await openArHome(page, "view=week");
  if (await findAppointmentState(page, "reminders_off")) {
    await openRemindersTab(page);
    await shot(page, "ar-layout-b-prod-desktop-reminders-disabled.png");
    await backToActivity(page);
  } else {
    console.warn("No appointment with reminders disabled found for screenshot");
  }

  await openArHome(page, "view=week");
  if (await findAppointmentState(page, "blocker")) {
    await shot(page, "ar-layout-b-prod-desktop-phone-or-blocker.png");
    await backToActivity(page);
  } else {
    console.warn("No appointment with phone/blocker state found for screenshot");
  }

  await openArHome(page, "view=week");
  if (await findAppointmentState(page, "replies")) {
    await page
      .locator("aside[aria-label='Appointment context']")
      .getByRole("tab", { name: /Activity|Conversation/i })
      .first()
      .click()
      .catch(() => {});
    await shot(page, "ar-layout-b-prod-desktop-customer-replies.png");
    await backToActivity(page);
  } else {
    console.warn("No appointment with customer replies found for screenshot");
  }

  await verifyLegacyRedirect(page);

  const tablet = await browser.newContext({
    viewport: { width: 1024, height: 800 },
    storageState: auth.storageState,
  });
  const tabPage = await tablet.newPage();
  await openArHome(tabPage);
  await shot(tabPage, "ar-layout-b-prod-tablet-week.png");
  if (await openFirstGridAppointment(tabPage)) {
    await shot(tabPage, "ar-layout-b-prod-tablet-appointment-sheet.png");
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: auth.storageState,
  });
  const mobPage = await mobile.newPage();
  await openArHome(mobPage, "view=day");
  await shot(mobPage, "ar-layout-b-prod-mobile-day.png");
  if (await openFirstGridAppointment(mobPage)) {
    await shot(mobPage, "ar-layout-b-prod-mobile-appointment-sheet.png");
  }

  await browser.close();
  console.log("capture-ar-layout-b-production: done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
