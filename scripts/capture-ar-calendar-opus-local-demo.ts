/**
 * Screenshot native Opus AR calendar on local dev (API mocks + DEV_AUTH_BYPASS_AUTO).
 * PORT=3010 DEV_AUTH_BYPASS_AUTO=1 npm run dev
 * npx tsx scripts/capture-ar-calendar-opus-local-demo.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3010";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts";

const MOCK_EVENTS = [
  {
    id: "demo-ar-cal-1",
    eventKind: "appointment",
    domainType: "service",
    inviteeName: "AR Live Cert",
    inviteePhone: "+15714073615",
    serviceName: "Service Visit",
    startsAt: "2026-10-09T16:00:00.000Z",
    endsAt: "2026-10-09T17:00:00.000Z",
    status: "scheduled",
    timezone: "America/New_York",
    metadata: { provider: "microsoft" },
  },
  {
    id: "demo-ar-cal-2",
    eventKind: "appointment",
    domainType: "service",
    inviteeName: "AR Live Cert",
    serviceName: "Service Visit",
    startsAt: "2026-10-09T17:00:00.000Z",
    endsAt: "2026-10-09T18:00:00.000Z",
    status: "scheduled",
    timezone: "America/New_York",
    metadata: { provider: "microsoft" },
  },
  {
    id: "demo-ar-cal-3",
    eventKind: "appointment",
    domainType: "service",
    inviteeName: "Demo Customer",
    serviceName: "Consultation",
    startsAt: "2026-10-15T14:00:00.000Z",
    endsAt: "2026-10-15T15:00:00.000Z",
    status: "scheduled",
    timezone: "America/New_York",
    metadata: { provider: "microsoft" },
  },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route("**/api/integrations/calendars**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [
          {
            id: "demo-conn",
            provider: "microsoft",
            status: "connected",
            importCalendarCount: 1,
            accountEmail: "demo@transovo.ai",
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
          calendarConnected: true,
          calendarHealthy: true,
        },
      }),
    });
  });

  await page.route("**/api/appointment-reminders/calendar/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_EVENTS, meta: { count: MOCK_EVENTS.length } }),
    });
  });

  await page.route("**/api/appointment-reminders/appointments/demo-ar-cal-1**", async (route) => {
    if (route.request().url().includes("reminder-timeline")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            customerResponse: { label: "Rescheduled", kind: "rescheduled" },
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          serviceName: "Service Visit",
          inviteeName: "AR Live Cert",
          startsAt: MOCK_EVENTS[0].startsAt,
          endsAt: MOCK_EVENTS[0].endsAt,
          timezone: "America/New_York",
          status: "scheduled",
          metadata: {
            provider: "microsoft",
            inviteePhone: "+15714073615",
          },
          reminderSchedule: [
            { label: "Booking confirmation", status: "scheduled" },
            { label: "24-hour reminder", status: "scheduled" },
            { label: "2-hour reminder", status: "scheduled" },
          ],
        },
      }),
    });
  });

  const url = `${BASE_URL}/appointment-reminders/calendar?view=month&date=2026-10-09`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(2000);

  const heading = page.getByRole("heading", { level: 2, name: /October 2026/i });
  await heading.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});

  const monthShot = join(OUT_DIR, "ar-calendar-opus-rebuild-month.png");
  await page.screenshot({ path: monthShot, fullPage: true });
  console.log(`Saved ${monthShot}`);

  const eventBtn = page.getByRole("button", { name: /12:00/i }).first();
  await eventBtn.click();
  await page.locator("[data-slot='sheet-content']").waitFor({ state: "visible", timeout: 10000 });
  await page.getByText("AR Live Cert").first().waitFor({ state: "visible", timeout: 10000 });
  await page.waitForTimeout(400);

  const detailShot = join(OUT_DIR, "ar-calendar-opus-rebuild-event-sheet.png");
  await page.screenshot({ path: detailShot, fullPage: true });
  console.log(`Saved ${detailShot}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
