/**
 * Screenshots requested for AR release review (production UI2).
 * UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-ar-user-requested-screens.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
const BOOK_SLUG = process.env.AR_BOOK_SLUG?.trim() || "transovo";

async function shot(page: import("playwright").Page, name: string) {
  const path = join(OUT_DIR, name);
  await page.screenshot({ path, fullPage: false });
  console.log(`Saved ${path}`);
}

async function dismissOnboarding(page: import("playwright").Page) {
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();
}

async function openCalendar(page: import("playwright").Page, view: string) {
  await page.goto(`${BASE_URL}/appointment-reminders?view=${view}`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await dismissOnboarding(page);
  await page.getByRole("heading", { level: 1, name: "Calendar" }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const auth = await authenticate(BASE_URL);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });
  const page = await context.newPage();

  await openCalendar(page, "week");
  await shot(page, "ar-calendar-weekly-view.png");

  await openCalendar(page, "agenda");
  await page.getByText(/Appointment|No appointments/i).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await shot(page, "ar-calendar-agenda-view.png");

  await page.goto(`${BASE_URL}/appointment-reminders/settings?tab=integrations`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await dismissOnboarding(page);
  await page.getByText(/Calendar write-back/i).first().waitFor({ timeout: 60_000 });
  await page.getByText(/Calendar write-back/i).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await shot(page, "ar-calendar-write-back-settings.png");

  await page.goto(`${BASE_URL}/appointment-reminders/ai-rescheduler`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await page.getByText(/Self-service link/i).first().waitFor({ timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, "ar-self-service-link-handling-mode.png");

  const publicCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const pub = await publicCtx.newPage();

  await pub.goto(`${BASE_URL}/book/${BOOK_SLUG}`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await pub.waitForTimeout(2000);
  await shot(pub, "ar-public-booking-link-page.png");

  const manageToken = "demo-manage-screenshot";
  await pub.route(`**/api/public/appointments/manage/${manageToken}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          serviceName: "Dental Cleaning",
          startsAt: "2026-10-13T18:00:00.000Z",
          timezone: "America/New_York",
          businessName: "Your business",
          status: "scheduled",
          actions: {
            reschedule: `${BASE_URL}/appointments/reschedule/demo-reschedule-screenshot`,
            cancel: `${BASE_URL}/appointments/cancel/demo-cancel-screenshot`,
          },
        },
      }),
    });
  });
  await pub.goto(`${BASE_URL}/appointments/manage/${manageToken}`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await pub.waitForTimeout(800);
  await shot(pub, "ar-manage-appointment-opus.png");

  const rescheduleToken = "demo-reschedule-screenshot";
  await pub.route(`**/api/public/appointments/reschedule/${rescheduleToken}**`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            serviceName: "Dental Cleaning",
            startsAt: "2026-10-13T18:00:00.000Z",
            timezone: "America/New_York",
            requestOnly: false,
            slots: [
              { startsAt: "2026-10-14T14:00:00.000Z", endsAt: "2026-10-14T15:00:00.000Z" },
              { startsAt: "2026-10-15T10:00:00.000Z", endsAt: "2026-10-15T11:00:00.000Z" },
              { startsAt: "2026-10-16T16:00:00.000Z", endsAt: "2026-10-16T17:00:00.000Z" },
            ],
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });
  await pub.goto(`${BASE_URL}/appointments/reschedule/${rescheduleToken}`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await pub.waitForTimeout(800);
  await shot(pub, "ar-public-reschedule-slots-opus.png");

  await browser.close();
  console.log(`All screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
