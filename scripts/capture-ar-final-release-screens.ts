/**
 * Screenshots for AR calendar home, write-back settings, public book + manage flows.
 * DEV_AUTH_BYPASS=1 npm run dev -p 3000
 * npx tsx scripts/capture-ar-final-release-screens.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";

async function installCalendarMocks(page: import("playwright").Page) {
  await page.route("**/api/integrations/calendars**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "demo-conn",
            name: "Outlook Main",
            provider: "microsoft",
            status: "connected",
            config: { importCalendarIds: ["cal-1"], email: "demo@transovo.ai" },
          },
        ],
      }),
    });
  });
  await page.route("**/api/appointment-reminders/overview**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          timezone: "America/New_York",
          sync: { lastSyncAt: "2026-10-11T12:00:00.000Z" },
          upcomingAppointments: [],
          customerResponses: [],
          calendarEvents: [
            {
              id: "ev-1",
              title: "Dental Cleaning",
              startsAt: "2026-10-13T14:00:00.000Z",
              endsAt: "2026-10-13T15:00:00.000Z",
              status: "scheduled",
            },
          ],
        },
      }),
    });
  });
  await page.route("**/api/appointment-reminders/calendar**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          events: [
            {
              id: "demo-ar-cal-1",
              eventKind: "appointment",
              inviteeName: "Sarah Chen",
              serviceName: "Dental Cleaning",
              startsAt: "2026-10-13T14:00:00.000Z",
              endsAt: "2026-10-13T15:00:00.000Z",
              status: "scheduled",
              timezone: "America/New_York",
            },
          ],
        },
      }),
    });
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await installCalendarMocks(page);

  await page.goto(`${BASE_URL}/dev/ar-layout-b?view=week&date=2026-10-13`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT_DIR, "ar-calendar-weekly-view.png"), fullPage: false });

  await page.goto(`${BASE_URL}/dev/ar-layout-b?view=agenda&date=2026-10-13`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT_DIR, "ar-calendar-agenda-view.png"), fullPage: false });

  await page.route("**/api/appointment-reminders/settings**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            appointmentReminders: {
              calendarWriteBack: {
                enabled: true,
                includeStatusBlock: true,
                microsoftCategoryColors: true,
              },
            },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`${BASE_URL}/appointment-reminders/settings?tab=integrations`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT_DIR, "ar-calendar-write-back-settings.png"), fullPage: false });

  await page.unroute("**/api/appointment-reminders/settings**");

  await page.route("**/api/public/booking/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          workspace: {
            name: "ABC Dental",
            businessPhone: "(555) 555-0100",
            businessAddress: "123 Main St",
          },
          types: [{ id: "svc-1", name: "New patient exam", durationMinutes: 60 }],
        },
      }),
    });
  });

  await page.goto(`${BASE_URL}/book/demo-practice`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT_DIR, "ar-public-booking-link-page.png"), fullPage: false });

  const manageToken = "screenshot-manage-token";
  await page.route(`**/api/public/appointments/manage/${manageToken}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          serviceName: "Dental Cleaning",
          startsAt: "2026-10-13T18:00:00.000Z",
          timezone: "America/New_York",
          businessName: "ABC Dental",
          status: "scheduled",
          actions: {
            reschedule: `/appointments/reschedule/reschedule-${manageToken}`,
            cancel: `/appointments/cancel/cancel-${manageToken}`,
          },
        },
      }),
    });
  });

  await page.goto(`${BASE_URL}/appointments/manage/${manageToken}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT_DIR, "ar-manage-appointment-opus.png"), fullPage: false });

  const rescheduleToken = `reschedule-${manageToken}`;
  await page.route(`**/api/public/appointments/reschedule/${rescheduleToken}**`, async (route) => {
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
    await route.fulfill({ status: 200, body: JSON.stringify({ data: { startsAt: "2026-10-14T14:00:00.000Z" } }) });
  });

  await page.goto(`${BASE_URL}/appointments/reschedule/${rescheduleToken}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT_DIR, "ar-public-reschedule-slots-opus.png"), fullPage: false });

  await browser.close();
  console.log(`Saved screenshots to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
