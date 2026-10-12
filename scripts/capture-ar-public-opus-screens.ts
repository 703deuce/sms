import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT_DIR = process.env.AR_SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

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
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, "ar-manage-appointment-opus.png"), fullPage: true });

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
            ],
          },
        }),
      });
      return;
    }
    await route.fulfill({ status: 200, body: "{}" });
  });

  await page.goto(`${BASE_URL}/appointments/reschedule/${rescheduleToken}`, {
    waitUntil: "networkidle",
    timeout: 180000,
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT_DIR, "ar-public-reschedule-slots-opus.png"), fullPage: true });

  await browser.close();
  console.log(`Saved to ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
