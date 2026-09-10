/**
 * Shared Playwright helpers for master Appointments browser UAT (real user journeys).
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, visitRoute } from "./lib";
import { switchToAppointments } from "./flow-helpers";
import { MASTER_UAT_SERVICE_NAME, MASTER_UAT_SLUG } from "./master-uat-config";

export class MasterUatAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterUatAssertionError";
  }
}

export async function ensureAppointmentsAdmin(page: Page) {
  await switchToAppointments(page);
}

export async function openAvailabilityAdmin(page: Page) {
  await ensureAppointmentsAdmin(page);
  const v = await visitRoute(page, "/appointments/availability");
  if (!v.ok) throw new Error(`Availability admin: ${v.note}`);
  await page.getByRole("heading", { name: /^Availability$/i }).waitFor({ timeout: ACTION_TIMEOUT });
  await page.getByRole("heading", { name: /Start time rules/i }).scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(1500);
}

export async function saveAvailability(page: Page) {
  const btn = page.getByRole("button", { name: /^Save availability$/i });
  await btn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  if (!/saved/i.test(body) && !/Saving/i.test(body)) {
    throw new Error("Save availability did not show confirmation");
  }
}

export async function saveSchedulingRules(page: Page) {
  const btn = page.getByRole("button", { name: /^Save scheduling rules$/i });
  await btn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  if (!/saved/i.test(body)) {
    throw new MasterUatAssertionError("Save scheduling rules did not show confirmation");
  }
}

export async function setAutomaticStartMode(page: Page) {
  await page.getByRole("radio", { name: /Automatically from availability/i }).check({ timeout: ACTION_TIMEOUT });
}

export async function setFixedStartTimesMode(page: Page, times24h: string[]) {
  await page.getByRole("radio", { name: /Only at specific times/i }).check({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(500);
  for (const time of times24h) {
    const timeInput = page.getByRole("button", { name: /^Add start time$/i }).locator("..").locator('input[type="time"]').first();
    const fallback = page.locator('input[type="time"]').first();
    const input = (await timeInput.count()) ? timeInput : fallback;
    await input.fill(time);
    await page.getByRole("button", { name: /^Add start time$/i }).click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(300);
  }
  await saveSchedulingRules(page);
}

export async function setStartIntervalMinutes(page: Page, minutes: number) {
  await setAutomaticStartMode(page);
  await page.locator("#start-interval").selectOption(String(minutes), { timeout: ACTION_TIMEOUT });
  await saveSchedulingRules(page);
}

export async function setMinimumNoticeMinutes(page: Page, minutes: number) {
  const input = page.locator("#avail-minimum-notice");
  await input.fill(String(minutes));
  await saveAvailability(page);
}

export async function setBookingHorizonDays(page: Page, days: number) {
  const input = page.locator('input[type="number"]').filter({ has: page.locator("xpath=..") }).nth(1);
  const horizon = page.getByRole("heading", { name: /Booking rules/i }).locator("..").locator('input[type="number"]').nth(1);
  await horizon.fill(String(days));
  await saveAvailability(page);
}

export async function setLimitVisibleAvailability(page: Page, percent: number) {
  await page.getByRole("checkbox", { name: /Limit how many open times customers see/i }).check({ timeout: ACTION_TIMEOUT });
  await page.locator('select').filter({ has: page.locator('option[value="25"]') }).first().selectOption(String(percent));
  await saveSchedulingRules(page);
}

export async function setMinimizeGapsMode(page: Page, enabled: boolean) {
  if (enabled) {
    await page.getByRole("radio", { name: /Prefer times near existing appointments/i }).check({ timeout: ACTION_TIMEOUT });
  } else {
    await page.getByRole("radio", { name: /Show all available times normally/i }).check({ timeout: ACTION_TIMEOUT });
  }
  await saveSchedulingRules(page);
}

export async function setDayWindows(page: Page, dayLabel: string, windows: Array<{ open: string; close: string }> | "closed") {
  const row = page.locator(`div:has(> div >> text=${dayLabel})`).first();
  if (windows === "closed") {
    const closedPill = row.locator('.avail-pill-closed, span:has-text("Closed")').first();
    if (await closedPill.count()) return;
    const windowsInRow = row.locator('input[type="time"]');
    while ((await windowsInRow.count()) > 0) {
      await row.getByRole("button", { name: /Remove window/i }).first().click({ timeout: ACTION_TIMEOUT }).catch(() => {});
      await page.waitForTimeout(200);
    }
  } else {
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      const openInputs = row.locator('input[type="time"]');
      if ((await openInputs.count()) < (i + 1) * 2) {
        await row.getByRole("button", { name: /Add window/i }).click({ timeout: ACTION_TIMEOUT }).catch(async () => {
          await row.getByRole("button", { name: /Add/i }).first().click({ timeout: ACTION_TIMEOUT });
        });
      }
      await openInputs.nth(i * 2).fill(w.open);
      await openInputs.nth(i * 2 + 1).fill(w.close);
    }
  }
}

export async function openPublicBooking(page: Page) {
  const v = await visitRoute(page, `/book/${MASTER_UAT_SLUG}?_=${Date.now()}`);
  if (!v.ok) throw new Error(`Public booking: ${v.note}`);
  await page.waitForTimeout(2000);
}

export async function fetchAvailabilitySlotCount(
  page: Page,
  serviceName = MASTER_UAT_SERVICE_NAME,
): Promise<number> {
  const res = await page.request.get(
    `/api/appointments/availability?serviceName=${encodeURIComponent(serviceName)}&daysAhead=14`,
    { timeout: 120_000 },
  );
  if (!res.ok()) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Availability API failed: ${err.error || res.status()}`);
  }
  const json = await res.json();
  const slots = (json.data?.slots || []) as unknown[];
  return slots.length;
}

export async function selectPublicService(page: Page, serviceName = MASTER_UAT_SERVICE_NAME) {
  const serviceBtn = page.getByRole("button", { name: new RegExp(serviceName, "i") }).first();
  await serviceBtn.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await serviceBtn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2000);
}

export async function waitForPublicSlotsLoaded(page: Page) {
  const loading = page.getByText(/Loading available times/i);
  if (await loading.count()) {
    await loading.waitFor({ state: "hidden", timeout: 60_000 }).catch(() => {});
  }
  await page.locator(".slot-grid button").first().waitFor({ state: "visible", timeout: 60_000 });
}

export async function collectPublicSlotLabels(page: Page): Promise<string[]> {
  await waitForPublicSlotsLoaded(page);
  const buttons = page.locator(".slot-grid button");
  const count = await buttons.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    labels.push((await buttons.nth(i).innerText()).trim());
  }
  return [...new Set(labels)];
}

export function slotLabelMatches(labels: string[], hour12: number, minute: number, period: "AM" | "PM"): boolean {
  const normalized = labels.map((l) => l.replace(/\s+/g, " ").toUpperCase());
  const target = `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  return normalized.some((l) => l.includes(target));
}

export function parseSlotMinutes(label: string): number | null {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const p = m[3].toUpperCase();
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

export async function runSlotDiagnostics(
  page: Page,
  serviceName: string,
  datetimeLocal: string,
): Promise<{ available: boolean; displayText: string }> {
  await openAvailabilityAdmin(page);
  const serviceSelect = page.locator('section:has(#slot-diagnostics-heading) select').first();
  await serviceSelect.selectOption({ label: serviceName }).catch(async () => {
    await serviceSelect.selectOption(serviceName);
  });
  await page.locator('section:has(#slot-diagnostics-heading) input[type="datetime-local"]').fill(datetimeLocal);
  await page.getByRole("button", { name: /^Check slot$/i }).click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2000);
  const resultBox = page.locator('section:has(#slot-diagnostics-heading) .rounded-lg.border.bg-\\[\\#faf9fc\\]');
  const displayText = await resultBox.innerText().catch(() => "");
  const available = /Available/i.test(displayText) && !/Unavailable/i.test(displayText.split("—")[0] || "");
  return { available, displayText };
}

export async function createMasterUatAppointment(page: Page) {
  const typesRes = await page.request.get("/api/appointments/types");
  if (!typesRes.ok()) throw new Error("Could not load appointment types");
  const typesJson = await typesRes.json();
  const types = (typesJson.data || []) as Array<{ id: string; name: string }>;
  const service =
    types.find((t) => t.name === MASTER_UAT_SERVICE_NAME) ||
    types.find((t) => /browser cert/i.test(t.name)) ||
    types[0];
  if (!service) throw new Error(`No appointment type found for master UAT`);

  const availRes = await page.request.get(
    `/api/appointments/availability?serviceName=${encodeURIComponent(service.name)}&daysAhead=14`,
  );
  if (!availRes.ok()) {
    const err = await availRes.json().catch(() => ({}));
    throw new Error(`Availability API failed: ${err.error || availRes.status()}`);
  }
  const availJson = await availRes.json();
  const slots = (availJson.data?.slots || []) as Array<{ startsAt: string }>;
  if (!slots.length) throw new Error(`No available time slots for "${service.name}"`);

  const unique = `UAT${Date.now().toString().slice(-6)}`;
  const createRes = await page.request.post("/api/appointments", {
    timeout: 120_000,
    data: {
      serviceId: service.id,
      serviceName: service.name,
      startsAt: slots[0].startsAt,
      firstName: unique,
      lastName: "Master",
      phone: "+15555550188",
      email: `uat+${unique}@harborhome.co`,
      smsConsent: false,
      status: "scheduled",
      skipSms: true,
    },
  });
  if (!createRes.ok()) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`Create appointment API failed: ${err.error || createRes.status()}`);
  }
  const created = await createRes.json();
  const appointmentId = String(created.data?.appointmentId || created.data?.id || "");
  if (!appointmentId) throw new Error("Create appointment API did not return appointment id");

  const v = await visitRoute(page, `/appointments/${appointmentId}`);
  if (!v.ok) throw new Error(v.note);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const afterReload = await page.locator("body").innerText();
  if (!new RegExp(unique, "i").test(afterReload) && !/scheduled|confirmed/i.test(afterReload)) {
    throw new Error("Appointment did not persist after reload");
  }
  return { appointmentId, unique };
}

export async function openDynamicPricingAdmin(page: Page) {
  await ensureAppointmentsAdmin(page);
  const v = await visitRoute(page, "/appointments/types");
  if (!v.ok) throw new Error(`Service booking admin: ${v.note}`);
  await page.getByRole("button", { name: /Dynamic pricing/i }).click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await page.waitForTimeout(1000);
}
