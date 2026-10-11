/**
 * Layout B calendar-first home screenshots (mocked APIs).
 * PORT=3010 DEV_AUTH_BYPASS_AUTO=1 npm run dev
 * npx tsx scripts/capture-ar-calendar-workspace-layout-b.ts
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
    inviteeName: "Demo Customer",
    serviceName: "Consultation",
    startsAt: "2026-10-09T18:00:00.000Z",
    endsAt: "2026-10-09T19:00:00.000Z",
    status: "scheduled",
    timezone: "America/New_York",
    metadata: { provider: "microsoft", remindersSuppressed: true },
  },
];

async function installMocks(page: import("playwright").Page) {
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
          upcomingAppointments: [
            {
              appointmentId: "demo-ar-cal-1",
              customerName: "AR Live Cert",
              appointmentTitle: "Service Visit",
              startsAt: MOCK_EVENTS[0].startsAt,
              nextReminder: "24h before · SMS",
            },
          ],
          customerResponses: [
            {
              appointmentId: "demo-ar-cal-1",
              customerName: "AR Live Cert",
              appointmentTitle: "Service Visit",
              responseAt: "2026-10-10T15:00:00.000Z",
              customerResponse: { label: "Confirmed" },
            },
          ],
          needsAttentionRows: [
            {
              appointmentId: "demo-ar-cal-2",
              customerName: "Demo Customer",
              title: "Consultation",
              reason: "Reminders off",
            },
          ],
          activity: [
            {
              appointmentId: "demo-ar-cal-1",
              customerLabel: "AR Live Cert",
              reminderLabel: "24-hour reminder",
              status: "sent",
              channel: "sms",
              at: "2026-10-08T16:00:00.000Z",
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/appointment-reminders/calendar/events**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_EVENTS }),
    });
  });

  await page.route("**/api/appointment-reminders/appointments/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/customer-outcome")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { customerResponse: { label: "Confirmed", kind: "confirmed" } } }),
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
          metadata: { provider: "microsoft", inviteePhone: "+15714073615" },
          reminderSchedule: [{ label: "24-hour reminder", status: "scheduled" }],
        },
      }),
    });
  });
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await installMocks(desktop);
  const previewPath = "/dev/ar-layout-b?view=week&date=2026-10-09";
  await desktop.goto(`${BASE_URL}${previewPath}`, {
    waitUntil: "domcontentloaded",
    timeout: 300000,
  });
  await desktop.getByRole("heading", { level: 1, name: "Calendar" }).waitFor({ timeout: 20000 });
  await desktop.waitForTimeout(800);
  await desktop.screenshot({
    path: join(OUT_DIR, "ar-layout-b-desktop-week-activity.png"),
    fullPage: false,
  });

  await desktop.getByRole("button", { name: /12:00/i }).first().click();
  await desktop.getByRole("tab", { name: "Reminders" }).waitFor({ timeout: 15000 });
  await desktop.waitForTimeout(400);
  await desktop.screenshot({
    path: join(OUT_DIR, "ar-layout-b-desktop-week-selected.png"),
    fullPage: false,
  });

  await desktop.goto(`${BASE_URL}/dev/ar-layout-b?view=month&date=2026-10-09`, {
    waitUntil: "domcontentloaded",
    timeout: 300000,
  });
  await desktop.waitForTimeout(600);
  await desktop.screenshot({
    path: join(OUT_DIR, "ar-layout-b-desktop-month.png"),
    fullPage: false,
  });

  await desktop.goto(`${BASE_URL}/dev/ar-layout-b?view=day&date=2026-10-09`, {
    waitUntil: "domcontentloaded",
    timeout: 300000,
  });
  await desktop.waitForTimeout(600);
  await desktop.screenshot({
    path: join(OUT_DIR, "ar-layout-b-desktop-day.png"),
    fullPage: false,
  });

  const tablet = await browser.newPage({ viewport: { width: 1024, height: 800 } });
  await installMocks(tablet);
  await tablet.goto(`${BASE_URL}/dev/ar-layout-b?view=week`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await tablet.waitForTimeout(800);
  await tablet.screenshot({
    path: join(OUT_DIR, "ar-layout-b-tablet-week.png"),
    fullPage: false,
  });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await installMocks(mobile);
  await mobile.goto(`${BASE_URL}/dev/ar-layout-b?view=day`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await mobile.waitForTimeout(800);
  await mobile.screenshot({
    path: join(OUT_DIR, "ar-layout-b-mobile-day.png"),
    fullPage: false,
  });

  await browser.close();
  console.log(`Screenshots saved under ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
