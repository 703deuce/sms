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

  let bookSlug = process.env.AR_BOOK_SLUG?.trim() || "";
  let manageToken = "";
  let rescheduleToken = "";
  let bookingWasEnabled = true;
  let priorArConfig: Record<string, unknown> | null = null;

  const arGet = await page.request.get(`${BASE_URL}/api/appointment-reminders/ai-rescheduler`);
  if (arGet.ok()) {
    const arJson = (await arGet.json()) as { data?: Record<string, unknown> };
    priorArConfig = arJson.data || null;
    const patchRes = await page.request.patch(`${BASE_URL}/api/appointment-reminders/ai-rescheduler`, {
      data: { mode: "self_service_link", approval: "automatic" },
    });
    if (patchRes.ok()) {
      console.log("Temporarily set self-service link + automatic approval for slot screenshot");
    } else {
      console.warn("Could not patch AI rescheduler for slots:", await patchRes.text());
    }
  }
  const bookRes = await page.request.get(`${BASE_URL}/api/appointment-reminders/booking`);
  if (bookRes.ok()) {
    const bookJson = (await bookRes.json()) as {
      data?: {
        workspace?: { slug?: string };
        settings?: { bookingEnabled?: boolean };
      };
    };
    bookSlug = bookSlug || bookJson.data?.workspace?.slug || "";
    bookingWasEnabled = bookJson.data?.settings?.bookingEnabled === true;
    if (!bookingWasEnabled) {
      const enableRes = await page.request.patch(`${BASE_URL}/api/appointment-reminders/booking`, {
        data: { bookingEnabled: true, publicBookingProfile: "simple" },
      });
      if (!enableRes.ok()) {
        console.warn("Could not enable public booking for screenshot:", await enableRes.text());
      } else {
        console.log("Temporarily enabled public booking for production screenshot");
      }
    }
  }
  const apptRes = await page.request.get(
    `${BASE_URL}/api/appointment-reminders/appointments?pageSize=50&date=upcoming`,
  );
  if (apptRes.ok()) {
    const apptJson = (await apptRes.json()) as {
      data?: unknown;
    };
    const raw = apptJson.data as { rows?: Array<{ id?: string; metadata?: Record<string, unknown> }> };
    const rows = raw?.rows || [];
    for (const row of rows) {
      if (!row.id) continue;
      const detailRes = await page.request.get(
        `${BASE_URL}/api/appointment-reminders/appointments/${row.id}`,
      );
      if (!detailRes.ok()) continue;
      const detailJson = (await detailRes.json()) as {
        data?: { metadata?: { manageToken?: string; rescheduleToken?: string } };
      };
      const meta = detailJson.data?.metadata || {};
      if (!meta.manageToken || !meta.rescheduleToken) continue;
      const slotProbe = await page.request.get(
        `${BASE_URL}/api/public/appointments/reschedule/${meta.rescheduleToken}`,
      );
      if (!slotProbe.ok()) continue;
      const slotJson = (await slotProbe.json()) as {
        data?: { slots?: unknown[]; requestOnly?: boolean; selfServiceBlocked?: boolean };
      };
      const slotData = slotJson.data;
      const hasSlots =
        Array.isArray(slotData?.slots) &&
        slotData.slots.length > 0 &&
        !slotData.requestOnly &&
        !slotData.selfServiceBlocked;
      if (!manageToken) {
        manageToken = meta.manageToken;
        rescheduleToken = meta.rescheduleToken;
      }
      if (hasSlots) {
        manageToken = meta.manageToken;
        rescheduleToken = meta.rescheduleToken;
        break;
      }
    }
  }
  if (!bookSlug) bookSlug = "brightline-dental";

  const publicCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const pub = await publicCtx.newPage();

  await pub.goto(`${BASE_URL}/book/${bookSlug}`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await pub.waitForTimeout(2500);
  await shot(pub, "ar-public-booking-link-page.png");

  if (!bookingWasEnabled) {
    await page.request.patch(`${BASE_URL}/api/appointment-reminders/booking`, {
      data: { bookingEnabled: false },
    });
  }

  if (manageToken) {
    await pub.goto(`${BASE_URL}/appointments/manage/${manageToken}`, {
      waitUntil: "networkidle",
      timeout: 180_000,
    });
    await pub.getByRole("heading", { name: /Appointment|Cleaning|Visit/i }).waitFor({ timeout: 30_000 }).catch(() => {});
    await pub.waitForTimeout(800);
    await shot(pub, "ar-manage-appointment-opus.png");
  } else {
    console.warn("No manageToken on production appointments — skipping manage screenshot");
  }

  if (rescheduleToken) {
    await pub.goto(`${BASE_URL}/appointments/reschedule/${rescheduleToken}`, {
      waitUntil: "networkidle",
      timeout: 180_000,
    });
    await pub.getByText(/Reschedule|Pick a new time/i).first().waitFor({ timeout: 30_000 }).catch(() => {});
    await pub.waitForTimeout(800);
    await shot(pub, "ar-public-reschedule-slots-opus.png");
  } else {
    console.warn("No rescheduleToken — skipping reschedule screenshot");
  }

  if (priorArConfig) {
    await page.request.patch(`${BASE_URL}/api/appointment-reminders/ai-rescheduler`, {
      data: priorArConfig,
    });
  }

  await browser.close();
  console.log(`All screenshots in ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
