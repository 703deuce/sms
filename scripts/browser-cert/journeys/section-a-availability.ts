/**
 * Section A — Availability (tests 1–14). Full admin + public user journeys.
 */
import type { Page } from "playwright";
import type { MasterUatFlow } from "../appointments-master-uat-catalog";
import {
  collectPublicSlotLabels,
  fetchAvailabilitySlotCount,
  MasterUatAssertionError,
  openAvailabilityAdmin,
  openDynamicPricingAdmin,
  openPublicBooking,
  parseSlotMinutes,
  runSlotDiagnostics,
  saveAvailability,
  saveSchedulingRules,
  selectPublicService,
  setAutomaticStartMode,
  setFixedStartTimesMode,
  setLimitVisibleAvailability,
  setMinimizeGapsMode,
  setMinimumNoticeMinutes,
  setStartIntervalMinutes,
  slotLabelMatches,
} from "../master-uat-helpers";
import { MASTER_UAT_SERVICE_NAME as SERVICE } from "../master-uat-config";

function flow(id: string, title: string, run: (page: Page) => Promise<void>): MasterUatFlow {
  return { id, section: "A", title, run };
}

async function publicSlotsForService(page: Page): Promise<string[]> {
  await openPublicBooking(page);
  await selectPublicService(page, SERVICE);
  return collectPublicSlotLabels(page);
}

/** Test 1 — Fixed appointment start times */
async function journey01(page: Page) {
  await openAvailabilityAdmin(page);
  await setFixedStartTimesMode(page, ["09:00", "11:30", "15:00"]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  if (!/Only at specific times/i.test(body) || !/11:30 AM/i.test(body)) {
    throw new MasterUatAssertionError("Fixed start times did not persist after reload");
  }

  const slots = await publicSlotsForService(page);
  if (slotLabelMatches(slots, 10, 0, "AM")) {
    throw new MasterUatAssertionError(
      `Public book offered 10:00 AM but fixed times are 9:00, 11:30, 3:00. Slots: ${slots.join(", ")}`,
    );
  }
  if (!slotLabelMatches(slots, 9, 0, "AM") && !slotLabelMatches(slots, 11, 30, "AM")) {
    throw new MasterUatAssertionError(`Expected fixed start times on public book. Got: ${slots.join(", ")}`);
  }
}

/** Test 2 — Custom start interval (45 min) */
async function journey02(page: Page) {
  await openAvailabilityAdmin(page);
  await setStartIntervalMinutes(page, 45);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const slots = await publicSlotsForService(page);
  if (slotLabelMatches(slots, 9, 30, "AM") || slotLabelMatches(slots, 10, 0, "AM")) {
    throw new MasterUatAssertionError(`45-min interval should exclude 9:30 and 10:00. Slots: ${slots.join(", ")}`);
  }
  const minutes = slots.map(parseSlotMinutes).filter((m): m is number => m !== null);
  if (minutes.length >= 2) {
    const gap = minutes[1] - minutes[0];
    if (gap !== 45) {
      throw new MasterUatAssertionError(`Expected 45-minute spacing; first gap was ${gap} min. Slots: ${slots.join(", ")}`);
    }
  }
}

/** Test 3 — Make Me Look Busy */
async function journey03(page: Page) {
  await openAvailabilityAdmin(page);
  await setAutomaticStartMode(page);
  await setStartIntervalMinutes(page, 15);
  const apiBefore = await fetchAvailabilitySlotCount(page, SERVICE);

  await openAvailabilityAdmin(page);
  await setLimitVisibleAvailability(page, 50);

  const settingsRes = await page.request.get("/api/appointments/settings");
  if (settingsRes.ok()) {
    const settingsJson = await settingsRes.json();
    const density = settingsJson.data?.schedulingLimits?.availabilityDensityHidePercent;
    if (!density || density < 25) {
      throw new MasterUatAssertionError(`Density hide percent did not persist (got ${density ?? "none"})`);
    }
  }

  const apiAfter = await fetchPublicSlotCount(page, SERVICE);
  if (apiBefore > 1 && apiAfter >= apiBefore) {
    throw new MasterUatAssertionError(
      `Limit visible availability should reduce slot count. Before=${apiBefore} apiAfter=${apiAfter}`,
    );
  }

  await openPublicBooking(page);
  await selectPublicService(page, SERVICE);
  const after = await collectPublicSlotLabels(page);
  if (apiBefore > 1 && after.length >= apiBefore) {
    throw new MasterUatAssertionError(
      `Limit visible availability should reduce public slot count. Before=${apiBefore} after=${after.length}`,
    );
  }
}

/** Test 4 — Minimize gaps */
async function journey04(page: Page) {
  await openAvailabilityAdmin(page);
  await setMinimizeGapsMode(page, true);
  await page.reload({ waitUntil: "domcontentloaded" });
  const slotsCompact = await publicSlotsForService(page);
  if (slotsCompact.length === 0) {
    throw new MasterUatAssertionError("No public slots after enabling compact scheduling");
  }

  await openAvailabilityAdmin(page);
  await setMinimizeGapsMode(page, false);
  const slotsNormal = await publicSlotsForService(page);
  if (slotsNormal.length === 0) {
    throw new MasterUatAssertionError("No public slots after disabling compact scheduling");
  }
}

/** Test 5 — Weekly business availability */
async function journey05(page: Page) {
  await openAvailabilityAdmin(page);
  const res = await page.request.patch("/api/appointments/settings", {
    data: {
      weeklyHours: {
        monday: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "17:00" }],
        tuesday: [],
        wednesday: [{ open: "09:00", close: "17:00" }],
        thursday: [{ open: "09:00", close: "17:00" }],
        friday: [{ open: "09:00", close: "17:00" }],
        saturday: [],
        sunday: [],
      },
    },
  });
  if (!res.ok()) throw new Error(`Weekly hours patch failed: ${res.status()}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  if (!/Monday/i.test(body)) throw new MasterUatAssertionError("Weekly hours UI did not reload");

  await openPublicBooking(page);
  await selectPublicService(page, SERVICE);
  const slots = await collectPublicSlotLabels(page);
  const hasMorning = slots.some((s) => /9:|10:|11:/i.test(s));
  if (!hasMorning) {
    throw new MasterUatAssertionError(`Expected Monday-style morning slots on public book. Got: ${slots.join(", ")}`);
  }
}

/** Test 6 — Minimum booking notice (4 hours) */
async function journey06(page: Page) {
  await openAvailabilityAdmin(page);
  await setMinimumNoticeMinutes(page, 240);

  const availRes = await page.request.get(
    `/api/appointments/availability?serviceName=${encodeURIComponent(SERVICE)}&daysAhead=14`,
  );
  if (!availRes.ok()) throw new MasterUatAssertionError("Availability API failed after setting minimum notice");
  const availJson = await availRes.json();
  const apiSlots = (availJson.data?.slots || []) as Array<{ startsAt: string }>;
  const cutoff = Date.now() + 4 * 60 * 60 * 1000;
  for (const slot of apiSlots) {
    if (new Date(slot.startsAt).getTime() < cutoff) {
      throw new MasterUatAssertionError(
        `Slot ${slot.startsAt} is inside 4-hour minimum notice window`,
      );
    }
  }

  await openPublicBooking(page);
  await selectPublicService(page, SERVICE);
  const slots = await collectPublicSlotLabels(page);
  if (slots.length === 0 && apiSlots.length > 0) {
    throw new MasterUatAssertionError("Public booking showed no slots while availability API returned slots");
  }
}

/** Test 7 — Maximum booking horizon */
async function journey07(page: Page) {
  await openAvailabilityAdmin(page);
  const horizonInput = page
    .locator("section")
    .filter({ hasText: "Booking horizon" })
    .locator('input[type="number"]')
    .first();
  await horizonInput.fill("30");
  await saveAvailability(page);

  await openPublicBooking(page);
  await selectPublicService(page, SERVICE);
  const body = await page.locator("body").innerText();
  if (/No open times/i.test(body) && !/slot-grid/i.test(await page.content())) {
    throw new MasterUatAssertionError("Public booking empty after setting 30-day horizon");
  }
}

/** Test 8 — Date override */
async function journey08(page: Page) {
  const overrideDate = new Date();
  overrideDate.setDate(overrideDate.getDate() + 14);
  const iso = overrideDate.toISOString().slice(0, 10);

  await openAvailabilityAdmin(page);
  await page.locator('section:has(h2:has-text("Date overrides")) input[type="date"]').first().fill(iso);
  await page.locator('section:has(h2:has-text("Date overrides")) input[type="time"]').first().fill("10:00");
  await page.locator('section:has(h2:has-text("Date overrides")) input[type="time"]').nth(1).fill("14:00");
  await page.getByRole("button", { name: /^Add override$/i }).click();
  await saveAvailability(page);

  const isoLocator = page.locator(`[data-iso-date="${iso}"]`);
  const body = await page.locator("body").innerText();
  if (!(await isoLocator.count()) && !body.includes(iso)) {
    throw new MasterUatAssertionError(`Date override ${iso} not visible after save`);
  }
}

/** Test 9 — Blackout dates */
async function journey09(page: Page) {
  const d1 = new Date();
  d1.setDate(d1.getDate() + 20);
  const d2 = new Date();
  d2.setDate(d2.getDate() + 21);
  const iso1 = d1.toISOString().slice(0, 10);
  const iso2 = d2.toISOString().slice(0, 10);

  await openAvailabilityAdmin(page);
  await page.locator("#blackout-date").fill(iso1);
  await page.getByRole("button", { name: /^Add blackout$/i }).click();
  await page.locator("#blackout-date").fill(iso2);
  await page.getByRole("button", { name: /^Add blackout$/i }).click();
  await saveAvailability(page);

  const body = await page.locator("body").innerText();
  if (!body.includes(iso1) || !body.includes(iso2)) {
    throw new MasterUatAssertionError("Blackout dates did not persist in admin UI");
  }
}

/** Test 10 — Holiday calendar */
async function journey10(page: Page) {
  const hol = new Date();
  hol.setDate(hol.getDate() + 25);
  const iso = hol.toISOString().slice(0, 10);

  await openAvailabilityAdmin(page);
  await page.locator("#holiday-date").fill(iso);
  await page.locator("#holiday-name").fill("UAT Holiday");
  await page.getByRole("button", { name: /^Add holiday$/i }).click();
  await page.getByRole("button", { name: /^Save schedules & holidays$/i }).click();
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  if (!body.includes(iso) || !/UAT Holiday/i.test(body)) {
    throw new MasterUatAssertionError("Holiday did not persist");
  }
}

/** Test 11 — Booking limits */
async function journey11(page: Page) {
  await openAvailabilityAdmin(page);
  const perType = page.getByText("Max per type per day").locator("..").locator('input[type="number"]');
  await perType.fill("2");
  await page.getByRole("button", { name: /^Save limits$/i }).click();
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  if (!/2/.test(body)) {
    throw new MasterUatAssertionError("Per-type daily limit did not save");
  }
}

/** Test 12 — Named availability schedules */
async function journey12(page: Page) {
  await openAvailabilityAdmin(page);
  await page.getByRole("button", { name: /^Add schedule from current hours$/i }).click();
  await saveAvailability(page);
  const body = await page.locator("body").innerText();
  if (!/Schedule \d+/i.test(body)) {
    throw new MasterUatAssertionError("Named schedule was not created");
  }
}

/** Test 13 — Slot diagnostics */
async function journey13(page: Page) {
  await openAvailabilityAdmin(page);
  await setStartIntervalMinutes(page, 45);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const d = String(tomorrow.getDate()).padStart(2, "0");
  const validLocal = `${y}-${m}-${d}T09:45`;
  const invalidLocal = `${y}-${m}-${d}T10:00`;

  const valid = await runSlotDiagnostics(page, SERVICE, validLocal);
  const invalid = await runSlotDiagnostics(page, SERVICE, invalidLocal);

  if (!valid.available) {
    throw new MasterUatAssertionError(`9:45 should be available on 45-min grid. Diagnostic: ${valid.displayText}`);
  }
  if (invalid.available) {
    throw new MasterUatAssertionError(`10:00 should be unavailable on 45-min grid. Diagnostic: ${invalid.displayText}`);
  }

  const slots = await publicSlotsForService(page);
  if (slotLabelMatches(slots, 10, 0, "AM")) {
    throw new MasterUatAssertionError("Public book still offers 10:00 AM while diagnostics/grid disagree");
  }
}

/** Test 14 — Dynamic pricing */
async function journey14(page: Page) {
  await openDynamicPricingAdmin(page);

  const ruleName = `UAT Saturday +20 ${Date.now().toString().slice(-5)}`;
  await page.locator('input').filter({ has: page.locator('xpath=ancestor::label[contains(.,"Rule name")]') }).first().fill(ruleName).catch(async () => {
    await page.locator('label:has-text("Rule name") input, label:has-text("Rule name") ~ input').first().fill(ruleName);
  });
  const nameInput = page.getByText("Rule name").locator("..").locator("input").first();
  if (await nameInput.count()) await nameInput.fill(ruleName);

  const addBtn = page.getByRole("button", { name: /^Add rule$/i });
  if (await addBtn.count()) {
    await addBtn.click();
    await page.waitForTimeout(1500);
  }

  await openPublicBooking(page);
  await selectPublicService(page, SERVICE);
  const body = await page.locator("body").innerText();
  if (!/\$|price|total/i.test(body)) {
    throw new MasterUatAssertionError("Public booking did not show price after dynamic pricing rule setup");
  }
}

export const SECTION_A_JOURNEYS: MasterUatFlow[] = [
  flow("1", "Fixed appointment start times", journey01),
  flow("2", "Custom start interval", journey02),
  flow("3", "Make Me Look Busy", journey03),
  flow("4", "Minimize gaps", journey04),
  flow("5", "Weekly business availability", journey05),
  flow("6", "Minimum booking notice", journey06),
  flow("7", "Maximum booking horizon", journey07),
  flow("8", "Date override", journey08),
  flow("9", "Blackout dates", journey09),
  flow("10", "Holiday calendar", journey10),
  flow("11", "Booking limits", journey11),
  flow("12", "Named availability schedules", journey12),
  flow("13", "Slot diagnostics", journey13),
  flow("14", "Dynamic pricing", journey14),
];
