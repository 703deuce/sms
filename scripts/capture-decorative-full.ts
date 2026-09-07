/**
 * Capture fully-loaded decorative premium screenshots for MCTB + Appointments.
 * Waits for real content (not skeleton loaders) before shooting.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots/decorative-full";

type Route = { slug: string; path: string; waitFor?: string | RegExp };

const MCTB_ROUTES: Route[] = [
  { slug: "mctb_01_overview", path: "/mctb", waitFor: "Missed calls today" },
  { slug: "mctb_02_missed_calls", path: "/mctb/missed-calls", waitFor: /Caller|Missed|No missed calls/i },
  { slug: "mctb_03_analytics", path: "/mctb/analytics", waitFor: /Missed calls|Recovery texts|Analytics/i },
  { slug: "mctb_04_setup", path: "/mctb/setup", waitFor: /Phone|Forwarding|Setup|Configuration/i },
  { slug: "mctb_05_voicemail", path: "/mctb/voicemail", waitFor: /Voicemail|No voicemails|Listen/i },
  { slug: "mctb_06_setup_phone", path: "/mctb/setup/phone", waitFor: /Business line|Forwarding|Save changes/i },
];

const APPT_ROUTES: Route[] = [
  { slug: "appt_01_overview", path: "/appointments/overview", waitFor: /Upcoming appointments|Today's schedule|Overview/i },
  { slug: "appt_02_calendar", path: "/appointments/calendar", waitFor: /Calendar|appointments|Today/i },
  { slug: "appt_03_scheduled", path: "/appointments", waitFor: /Scheduled|Appointment|No appointments/i },
  { slug: "appt_04_types", path: "/appointments/types", waitFor: /Appointment types|Type|New type/i },
  { slug: "appt_05_availability", path: "/appointments/availability", waitFor: /Availability|Hours|Schedule/i },
  { slug: "appt_06_reminders", path: "/appointments/reminders", waitFor: /Reminder|SMS|notification/i },
];

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function waitForLoaded(page: Page, route: Route) {
  await page
    .waitForFunction(
      () => {
        const busy = document.querySelector("[aria-busy='true']");
        const pulse = document.querySelector(".animate-pulse");
        const text = document.body.innerText;
        const loading =
          text.includes("Loading…") ||
          text.includes("Loading...") ||
          text.includes("Loading setup") ||
          text.includes("Loading missed call");
        return !busy && !pulse && !loading;
      },
      { timeout: 90000 },
    )
    .catch(() => undefined);

  if (route.waitFor) {
    await page
      .getByText(route.waitFor)
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  }

  await dismissOverlays(page);
  await page.waitForTimeout(2000);
}

async function capture(page: Page, route: Route) {
  const url = `${BASE}${route.path}`;
  console.log(`Capturing ${route.slug} → ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitForLoaded(page, route);
  const file = join(OUT, `${route.slug}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${file}`);
  return file;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  console.log("\n=== MCTB ===");
  for (const route of MCTB_ROUTES) {
    await capture(page, route);
  }

  console.log("\n=== Appointments ===");
  for (const route of APPT_ROUTES) {
    await capture(page, route);
  }

  await browser.close();
  console.log(`\nDone. ${MCTB_ROUTES.length + APPT_ROUTES.length} screenshots in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
