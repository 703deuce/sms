/**
 * Layout B UI smoke (mocked APIs, no database).
 * UI_AGENT_BASE_URL=http://localhost:3010 npx tsx scripts/verify-ar-layout-b-ui.ts
 */
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3010";
const PREVIEW = "/dev/ar-layout-b";

const MOCK_EVENTS = [
  {
    id: "verify-cal-1",
    inviteeName: "Verify Customer",
    inviteePhone: "+15714073615",
    serviceName: "Consult",
    startsAt: "2026-10-09T16:00:00.000Z",
    endsAt: "2026-10-09T17:00:00.000Z",
    status: "scheduled",
    timezone: "America/New_York",
    metadata: { provider: "microsoft", connectionId: "conn-a" },
  },
  {
    id: "verify-cal-2",
    inviteeName: "Other Calendar",
    serviceName: "Follow-up",
    startsAt: "2026-10-09T17:00:00.000Z",
    endsAt: "2026-10-09T18:00:00.000Z",
    status: "scheduled",
    timezone: "America/New_York",
    metadata: { provider: "microsoft", connectionId: "conn-b" },
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
            id: "conn-a",
            name: "Outlook Main",
            provider: "microsoft",
            status: "connected",
            config: { importCalendarIds: ["cal-1"], email: "main@example.com" },
          },
          {
            id: "conn-b",
            name: "Outlook Secondary",
            provider: "microsoft",
            status: "connected",
            config: { importCalendarIds: ["cal-2"], email: "team@example.com" },
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
              appointmentId: "verify-cal-1",
              customerName: "Verify Customer",
              appointmentTitle: "Consult",
              startsAt: MOCK_EVENTS[0].startsAt,
              nextReminder: "24h before",
            },
          ],
          customerResponses: [],
          needsAttentionRows: [],
          activity: [],
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          inviteeName: "Verify Customer",
          serviceName: "Consult",
          startsAt: MOCK_EVENTS[0].startsAt,
          endsAt: MOCK_EVENTS[0].endsAt,
          timezone: "America/New_York",
          metadata: { inviteePhone: "+15714073615", remindersSuppressed: false },
          reminderSchedule: [{ label: "24-hour reminder", status: "scheduled" }],
        },
      }),
    });
  });
  await page.route("**/api/appointment-reminders/conversations/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          customerName: "Verify Customer",
          appointmentTitle: "Consult",
          startsAt: MOCK_EVENTS[0].startsAt,
          customerResponse: { label: "No reply", kind: "none" },
          messages: [{ direction: "outbound", body: "Reminder text", at: "2026-10-08T16:00:00.000Z" }],
        },
      }),
    });
  });
}

type Check = { name: string; pass: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await installMocks(page);

  await page.goto(`${BASE}${PREVIEW}?view=week`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  checks.push({
    name: "Week view heading",
    pass: await page.getByRole("heading", { level: 1, name: "Calendar" }).isVisible(),
  });
  checks.push({
    name: "Activity panel visible",
    pass: await page.getByText("Upcoming reminders").isVisible(),
  });

  const grid = page.locator("aside[aria-label='Appointment context']");
  await page.getByRole("button", { name: /12:00/i }).first().click();
  checks.push({
    name: "Panel shows appointment after click",
    pass: await grid.getByRole("tab", { name: "Reminders" }).isVisible({ timeout: 8000 }),
  });
  checks.push({
    name: "Panel back to activity",
    pass: await grid.getByRole("button", { name: /Activity/i }).isVisible(),
  });
  await grid.getByRole("button", { name: /Activity/i }).click();
  checks.push({
    name: "Returns to activity feed",
    pass: await grid.getByText("Upcoming reminders").isVisible(),
  });

  const calSelect = page.locator("#ar-calendar-connection-filter");
  if (await calSelect.isVisible()) {
    await calSelect.click();
    await page.getByRole("option", { name: /Outlook Secondary/i }).click();
    checks.push({
      name: "Calendar filter hides other connection events",
      pass: (await page.getByRole("button", { name: /Other Calendar/i }).count()) === 0,
    });
  } else {
    checks.push({ name: "Calendar filter control", pass: false, detail: "select not visible" });
  }

  await page.goto(`${BASE}${PREVIEW}?view=month`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  checks.push({
    name: "Month view renders",
    pass: await page.getByRole("button", { name: /View day/i }).first().isVisible({ timeout: 8000 }),
  });

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  if (failed.length) process.exit(1);
  console.log("verify-ar-layout-b-ui: all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
