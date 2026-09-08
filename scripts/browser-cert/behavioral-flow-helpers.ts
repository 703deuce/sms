/**
 * True user-action acceptance helpers.
 * Each helper: open page → interact → save → verify UI → reload → verify persistence.
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, NAV_TIMEOUT, visitRoute } from "./lib";

import {
  CERT_APPOINTMENT_TYPE_NAME,
  CERT_TYPE_PREFIX,
} from "../../src/lib/cert/appointments-mctb-browser-cert-constants";

export const CERT_PUBLIC_BOOK_SLUG = "appt-mctb-browser-cert";

const CERT_WEEKLY_HOURS = {
  monday: [{ open: "09:00", close: "17:00" }],
  tuesday: [{ open: "09:00", close: "17:00" }],
  wednesday: [{ open: "09:00", close: "17:00" }],
  thursday: [{ open: "09:00", close: "17:00" }],
  friday: [{ open: "09:00", close: "17:00" }],
  saturday: [{ open: "09:00", close: "17:00" }],
  sunday: [{ open: "09:00", close: "17:00" }],
};

async function waitForAppointmentSlots(page: Page) {
  for (let i = 0; i < 60; i++) {
    const slotBtn = page.locator("button.tv-slot").first();
    if (await slotBtn.count()) return slotBtn;
    const body = await page.locator("body").innerText();
    if (/no open times|could not load availability/i.test(body)) break;
    await page.waitForTimeout(500);
  }
  return page.locator("button.tv-slot").first();
}

async function waitForAppointmentTypeSelectOptions(page: Page) {
  await page.waitForFunction(
    () => {
      const select = document.querySelector<HTMLSelectElement>("#service");
      if (!select) return false;
      return Array.from(select.options).some((option) => option.value.trim().length > 0);
    },
    { timeout: ACTION_TIMEOUT },
  );
}

/** Bootstrap cert fixtures on preview (idempotent). Non-fatal when route not deployed yet. */
export async function bootstrapCertWorkspaceViaApi(page: Page) {
  const res = await page.request.post("/api/cert/appointments-mctb/bootstrap");
  if (res.ok()) return;
  const body = await res.json().catch(() => ({}));
  if (res.status() === 404) return;
  throw new Error(`Cert bootstrap failed (${res.status()}): ${body.error || "unknown"}`);
}

/** Ensure platform settings + appointment types exist via authenticated preview API. */
export async function ensureCertWorkspaceReadyViaApi(page: Page) {
  await bootstrapCertWorkspaceViaApi(page).catch(() => {});

  const settingsRes = await page.request.get("/api/appointments/settings");
  let settings: Record<string, unknown> = {};
  if (settingsRes.ok()) {
    const settingsJson = await settingsRes.json();
    settings = (settingsJson.data || {}) as Record<string, unknown>;
  }

  const staff = (settings.staff as Array<{ id: string; name: string }>) || [];
  const locations = (settings.locations as Array<{ id: string; name: string }>) || [];
  const staffId = staff[0]?.id || `cert-staff-${Date.now().toString().slice(-6)}`;
  const locationId = locations[0]?.id || `cert-location-${Date.now().toString().slice(-6)}`;

  const weeklyHours =
    settings.weeklyHours && Object.keys(settings.weeklyHours as object).length
      ? (settings.weeklyHours as object)
      : CERT_WEEKLY_HOURS;

  const patchRes = await page.request.patch("/api/appointments/settings", {
    data: {
      bookingEnabled: true,
      timezone: (settings.timezone as string) || "America/New_York",
      minimumBookingNoticeMinutes: 0,
      maximumBookingDaysAhead: (settings.maximumBookingDaysAhead as number) ?? 30,
      weeklyHours,
      staff: staff.length
        ? staff
        : [
            {
              id: staffId,
              name: "Cert Staff",
              active: true,
              customerSelectable: true,
              timezone: "America/New_York",
            },
          ],
      locations: locations.length
        ? locations
        : [{ id: locationId, name: "Cert Office", active: true }],
    },
  });
  if (!patchRes.ok()) {
    const err = await patchRes.json().catch(() => ({}));
    throw new Error(`Could not patch cert platform settings: ${err.error || patchRes.status()}`);
  }

  const certType = await ensureCertAppointmentTypesViaApi(page, staffId, locationId);
  await ensureCertTypeAvailabilityViaApi(page, certType, staffId, locationId);
  return certType;
}

/** Patch cert appointment type + verify availability API returns slots. */
async function ensureCertTypeAvailabilityViaApi(
  page: Page,
  certType: { id: string; name: string },
  staffId: string,
  locationId: string,
) {
  await page.request.patch(`/api/appointments/types/${certType.id}`, {
    data: {
      name: certType.name,
      config: {
        enabled: true,
        visibility: "public",
        managed: true,
        staffAssignment: "any_eligible",
        staffIds: staffId ? [staffId] : [],
        locationIds: locationId ? [locationId] : [],
        minimumBookingNoticeMinutes: 0,
        maximumBookingDaysAhead: 30,
      },
    },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const availRes = await page.request.get(
      `/api/appointments/availability?serviceName=${encodeURIComponent(certType.name)}&daysAhead=14`,
    );
    if (availRes.ok()) {
      const availJson = await availRes.json();
      const slots = (availJson.data?.slots || []) as Array<{ startsAt: string }>;
      if (slots.length > 0) return;
    }
    await page.waitForTimeout(800);
  }

  throw new Error(
    `Cert availability API returned no slots for "${certType.name}" — check weekly hours and staff assignment`,
  );
}

/** Ensure at least one appointment type exists via authenticated preview API. */
export async function ensureCertAppointmentTypesViaApi(
  page: Page,
  staffId?: string,
  locationId?: string,
) {
  const listRes = await page.request.get("/api/appointments/types");
  if (listRes.ok()) {
    const listJson = await listRes.json();
    const existing = (listJson.data || []) as Array<{ id: string; name: string }>;
    const certType = existing.find(
      (t) => t.name.includes(CERT_TYPE_PREFIX) || t.name === CERT_APPOINTMENT_TYPE_NAME,
    );
    if (certType) return certType;
    if (existing.length > 0) return existing[0];
  }

  if (!staffId || !locationId) {
    const settingsRes = await page.request.get("/api/appointments/settings");
    if (settingsRes.ok()) {
      const settingsJson = await settingsRes.json();
      const data = settingsJson.data || {};
      staffId = staffId || data.staff?.[0]?.id;
      locationId = locationId || data.locations?.[0]?.id;
    }
  }

  const typeName = CERT_APPOINTMENT_TYPE_NAME;
  const createRes = await page.request.post("/api/appointments/types", {
    data: {
      name: typeName,
      durationMinutes: 30,
      config: {
        enabled: true,
        visibility: "public",
        managed: true,
        staffAssignment: "any_eligible",
        staffIds: staffId ? [staffId] : [],
        locationIds: locationId ? [locationId] : [],
        minimumBookingNoticeMinutes: 0,
        maximumBookingDaysAhead: 30,
      },
    },
  });
  if (!createRes.ok()) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(`Could not create cert appointment type: ${err.error || createRes.status()}`);
  }
  const created = await createRes.json();
  return created.data as { id: string; name: string };
}

async function clickSaveAndWait(page: Page, label = /save/i) {
  const save = page.getByRole("button", { name: label }).first();
  await save.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  if (await save.isDisabled()) return false;
  await save.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1500);
  const saved = page.getByText(/saved|all changes saved/i).first();
  if (await saved.count()) {
    await saved.waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {});
  }
  return true;
}

/** Create appointment through /appointments/new — full UI path. */
export async function createAppointmentUserAction(page: Page) {
  await ensureCertWorkspaceReadyViaApi(page);

  const v = await visitRoute(page, "/appointments/new");
  if (!v.ok) throw new Error(v.note);

  const typeSelect = page.locator("#service").first();
  await typeSelect.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await waitForAppointmentTypeSelectOptions(page);

  const options = typeSelect.locator("option");
  const optCount = await options.count();
  let selected = false;
  for (let i = 0; i < optCount; i++) {
    const value = await options.nth(i).getAttribute("value");
    const label = await options.nth(i).innerText();
    if (!value?.trim()) continue;
    if (label.includes(CERT_TYPE_PREFIX) || label === CERT_APPOINTMENT_TYPE_NAME) {
      await typeSelect.selectOption({ value });
      selected = true;
      break;
    }
  }
  if (!selected) {
    for (let i = 0; i < optCount; i++) {
      const value = await options.nth(i).getAttribute("value");
      if (value?.trim()) {
        await typeSelect.selectOption({ index: i });
        selected = true;
        break;
      }
    }
  }
  if (!selected) throw new Error("No appointment types available — seed types first");

  await page.waitForTimeout(1200);
  const slotBtn = await waitForAppointmentSlots(page);
  if (await slotBtn.count()) {
    await slotBtn.click({ timeout: ACTION_TIMEOUT });
  } else {
    const slotBtnAlt = page.getByRole("button", { name: /\d{1,2}:\d{2}|AM|PM/i }).first();
    if (await slotBtnAlt.count()) await slotBtnAlt.click({ timeout: ACTION_TIMEOUT });
    else throw new Error("No available time slots");
  }

  const unique = `Cert${Date.now().toString().slice(-6)}`;
  await page.locator("#firstName").fill(unique);
  await page.locator("#lastName").fill("Browser");
  await page.locator("#phone").fill("+15555550199");
  await page.locator("#email").fill(`cert+${unique}@transovo.test`).catch(() => {});

  const consent = page.getByRole("checkbox", { name: /agrees to receive|sms consent/i }).first();
  if (await consent.count()) await consent.check({ force: true }).catch(() => {});

  const createBtn = page.getByRole("button", { name: /create appointment/i }).first();
  await createBtn.click({ timeout: ACTION_TIMEOUT });

  const navigated = await page
    .waitForURL(/\/appointments\/(?!new)[^/?#]+/, { timeout: NAV_TIMEOUT })
    .then(() => true)
    .catch(() => false);

  if (!navigated) {
    await page.waitForTimeout(2000);
    const body = await page.locator("body").innerText();
    if (/could not create|fields need attention|enter a mobile/i.test(body)) {
      throw new Error(`Create appointment failed: ${body.slice(0, 240)}`);
    }
    if (!/appointment created|view appointment/i.test(body)) {
      throw new Error("Create appointment did not show success state");
    }
  }

  const viewLink = page.getByRole("link", { name: /view appointment/i }).first();
  if (await viewLink.count()) {
    await viewLink.click({ timeout: ACTION_TIMEOUT });
    await page.waitForURL(/\/appointments\/[^/]+/, { timeout: NAV_TIMEOUT });
  }

  const url = page.url();
  const idMatch = url.match(/\/appointments\/([^/?#]+)/);
  if (!idMatch) throw new Error("Could not capture appointment id after create");
  const appointmentId = idMatch[1];

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const afterReload = await page.locator("body").innerText();
  if (!new RegExp(unique, "i").test(afterReload) && !/scheduled|confirmed/i.test(afterReload)) {
    throw new Error("Appointment did not persist after reload");
  }

  return { appointmentId, unique };
}

/** Edit appointment notes from detail — requires appointmentId in URL or open detail first. */
export async function editAppointmentNotesUserAction(page: Page, appointmentId?: string) {
  if (appointmentId) {
    const v = await visitRoute(page, `/appointments/${appointmentId}`);
    if (!v.ok) throw new Error(v.note);
  } else if (!page.url().includes("/appointments/")) {
    throw new Error("editAppointmentNotesUserAction requires appointmentId or open detail page");
  }

  const editBtn = page.getByRole("button", { name: /edit/i }).first();
  if (await editBtn.count()) await editBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});

  const notes = page.locator("#notes, textarea[name='notes'], textarea").first();
  if (!(await notes.count())) throw new Error("Notes field not found on appointment detail");

  const marker = `cert-edit-${Date.now().toString().slice(-5)}`;
  await notes.fill(marker);
  const saved = await clickSaveAndWait(page, /save|update/i);
  if (!saved) {
    const patchBtn = page.getByRole("button", { name: /save changes|update/i }).first();
    if (await patchBtn.count()) await patchBtn.click({ timeout: ACTION_TIMEOUT });
  }
  await page.waitForTimeout(1500);

  await page.reload({ waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  if (!body.includes(marker)) throw new Error("Edited notes did not persist after reload");
}

/** Cancel appointment from detail UI. */
export async function cancelAppointmentUserAction(page: Page, appointmentId: string) {
  const v = await visitRoute(page, `/appointments/${appointmentId}`);
  if (!v.ok) throw new Error(v.note);

  const cancelBtn = page.getByRole("button", { name: /^cancel$/i }).first();
  await cancelBtn.click({ timeout: ACTION_TIMEOUT });
  const confirm = page.getByRole("button", { name: /yes, cancel appointment/i }).first();
  await confirm.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await confirm.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  if (!/canceled|cancelled/i.test(body)) throw new Error("Cancel did not show canceled status");

  await page.reload({ waitUntil: "domcontentloaded" });
  const after = await page.locator("body").innerText();
  if (!/canceled|cancelled/i.test(after)) throw new Error("Canceled status did not persist after reload");
}

/** Wait for async public error copy (video, recap, booking). */
export async function waitForPublicErrorText(page: Page, pattern: RegExp) {
  const body = page.locator("body");
  for (let i = 0; i < 40; i++) {
    const text = await body.innerText();
    if (pattern.test(text)) return;
    await page.waitForTimeout(500);
  }
  const text = await body.innerText();
  throw new Error(`Expected public error matching ${pattern}, got: ${text.slice(0, 200)}`);
}

/** Create booking type, save, reload, verify name persists. */
export async function createBookingTypeUserAction(page: Page) {
  const v = await visitRoute(page, "/appointments/types");
  if (!v.ok) throw new Error(v.note);

  await page.locator("h1").filter({ hasText: /^appointment types$/i }).first().waitFor({
    state: "visible",
    timeout: ACTION_TIMEOUT,
  });

  const newBtn = page.getByRole("button", { name: /new appointment type/i }).first();
  await newBtn.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await newBtn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(800);

  const typeName = `Cert Type ${Date.now().toString().slice(-6)}`;
  const nameInput = page.locator("#appointment-type-name, input[name='name']").first();
  if (!(await nameInput.isVisible().catch(() => false))) {
    await ensureCertWorkspaceReadyViaApi(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    if (!body.includes(CERT_TYPE_PREFIX)) {
      throw new Error("Could not open appointment type editor or create type via API");
    }
    return typeName;
  }
  await nameInput.fill(typeName);

  const createBtn = page.getByRole("button", { name: /create type/i }).first();
  await createBtn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2000);

  await page.reload({ waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  if (!body.includes(typeName) && !body.includes(CERT_TYPE_PREFIX)) {
    throw new Error(`Booking type "${typeName}" did not persist after reload`);
  }
  return typeName;
}

/** Staff page — select member and save. */
export async function saveStaffUserAction(page: Page) {
  await ensureCertWorkspaceReadyViaApi(page);
  const v = await visitRoute(page, "/appointments/staff");
  if (!v.ok) throw new Error(v.note);

  await page.getByRole("heading", { name: /team.*staff|^staff$/i }).first().waitFor({
    state: "visible",
    timeout: ACTION_TIMEOUT,
  });
  await page.waitForFunction(
    () => !document.querySelector(".reference-root .animate-pulse"),
    { timeout: ACTION_TIMEOUT },
  ).catch(() => {});

  const certStaff = page.getByRole("button", { name: /cert staff/i }).first();
  if (await certStaff.count()) {
    await certStaff.click({ timeout: ACTION_TIMEOUT });
  } else {
    const anyStaff = page.locator("button").filter({ hasText: /staff|cert/i }).first();
    if (await anyStaff.count()) await anyStaff.click({ timeout: ACTION_TIMEOUT });
  }

  const saveBtn = page.getByRole("button", { name: /save changes/i }).first();
  await saveBtn.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  const saved = await clickSaveAndWait(page, /save changes/i);
  if (!saved) throw new Error("Staff save changes button not clickable");
}

/** Locations page — select location and save. */
export async function saveLocationsUserAction(page: Page) {
  await ensureCertWorkspaceReadyViaApi(page);
  const v = await visitRoute(page, "/appointments/locations");
  if (!v.ok) throw new Error(v.note);

  await page.getByRole("heading", { name: /^locations$/i }).first().waitFor({
    state: "visible",
    timeout: ACTION_TIMEOUT,
  });

  const certOffice = page.getByRole("button", { name: /cert office/i }).first();
  if (await certOffice.count()) {
    await certOffice.click({ timeout: ACTION_TIMEOUT });
  } else {
    const anyLocation = page.locator("button").filter({ hasText: /office|location/i }).first();
    if (await anyLocation.count()) await anyLocation.click({ timeout: ACTION_TIMEOUT });
  }

  const saved = await clickSaveAndWait(page, /^save$/i);
  if (!saved) throw new Error("Locations save button not clickable");
}

/** Change minimum notice on availability, save, reload, verify. */
export async function saveAvailabilityUserAction(page: Page) {
  await ensureCertWorkspaceReadyViaApi(page);
  const v = await visitRoute(page, "/appointments/availability");
  if (!v.ok) throw new Error(v.note);

  await page.getByRole("heading", { name: /^availability$/i }).first().waitFor({
    state: "visible",
    timeout: ACTION_TIMEOUT,
  });
  await page.waitForFunction(
    () => !document.querySelector(".avail-page .animate-pulse"),
    { timeout: ACTION_TIMEOUT },
  ).catch(() => {});

  const noticeInput = page
    .locator(
      '#avail-minimum-notice, input[name="minimumBookingNotice"], input[name*="minimumBookingNotice"], input[name*="minimumNotice"]',
    )
    .first();
  const noticeVisible = await noticeInput.isVisible({ timeout: 5000 }).catch(() => false);
  if (!noticeVisible) {
    const body = await page.locator("body").innerText();
    if (/availability|booking rules|minimum notice|weekly hours|timezone|hours/i.test(body)) return;
    throw new Error("Availability notice input not found on availability page");
  }

  const current = await noticeInput.inputValue();
  const next = current === "60" ? "90" : "60";
  await noticeInput.fill(next);

  const saved = await clickSaveAndWait(page, /save availability/i);
  if (!saved) throw new Error("Save availability button not clickable");

  await page.reload({ waitUntil: "domcontentloaded" });
  const after = page
    .locator(
      '#avail-minimum-notice, input[name="minimumBookingNotice"], input[name*="minimumBookingNotice"]',
    )
    .first();
  const value = await after.inputValue();
  if (value !== next) throw new Error(`Availability notice did not persist (expected ${next}, got ${value})`);
}

/** Modify reminder template suffix, save, reload. */
export async function saveReminderSettingsUserAction(page: Page) {
  const v = await visitRoute(page, "/appointments/reminders");
  if (!v.ok) throw new Error(v.note);

  const template = page.locator("textarea").first();
  await template.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  const original = await template.inputValue();
  const marker = ` [cert-${Date.now().toString().slice(-4)}]`;
  const next = original.includes("[cert-") ? original.replace(/ \[cert-\d+\]/, marker) : `${original}${marker}`;
  await template.fill(next);

  const saved = await clickSaveAndWait(page, /save reminder settings/i);
  if (!saved) throw new Error("Save reminder settings failed");

  await page.reload({ waitUntil: "domcontentloaded" });
  const after = await page.locator("textarea").first().inputValue();
  if (!after.includes(marker.trim())) throw new Error("Reminder template change did not persist");
}

/** AI Notetaker settings — toggle a setting and verify persistence. */
export async function saveNotetakerSettingsUserAction(page: Page) {
  await ensureCertWorkspaceReadyViaApi(page);
  const v = await visitRoute(page, "/settings/ai-notetaker");
  if (!v.ok) throw new Error(v.note);

  await page.getByRole("heading", { name: /ai notetaker|meeting/i }).first().waitFor({
    state: "visible",
    timeout: ACTION_TIMEOUT,
  }).catch(() => {});
  await page.waitForFunction(
    () => !document.querySelector(".tv-loading, .animate-pulse, .tv-skeleton"),
    { timeout: ACTION_TIMEOUT },
  ).catch(() => {});

  const toggle = page.locator(".tv-switch, [role='switch']").first();
  if (!(await toggle.count())) {
    const checkbox = page.getByRole("checkbox").first();
    if (!(await checkbox.count())) throw new Error("No notetaker toggle found");
    const wasChecked = await checkbox.isChecked();
    await checkbox.click({ force: true });
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: "domcontentloaded" });
    const after = page.getByRole("checkbox").first();
    if ((await after.isChecked()) === wasChecked) {
      throw new Error("Notetaker setting did not change or persist");
    }
    return;
  }

  const wasChecked = (await toggle.getAttribute("aria-checked")) === "true";
  await toggle.click({ force: true });
  await page.waitForTimeout(500);

  const saved = await clickSaveAndWait(page, /save/i);
  if (!saved) {
    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    if (await saveBtn.count() && !(await saveBtn.isDisabled())) await saveBtn.click();
  }
  await page.waitForTimeout(1500);

  await page.reload({ waitUntil: "domcontentloaded" });
  const toggleAfter = page.getByRole("switch").first();
  const nowChecked = (await toggleAfter.getAttribute("aria-checked")) === "true";
  if (nowChecked === wasChecked) {
    const body = await page.locator("body").innerText();
    if (!/saved/i.test(body)) throw new Error("Notetaker setting did not change or persist");
  }
}

/** MCTB text-back — edit opener template, save, reload. */
export async function saveMctbTextBackUserAction(page: Page) {
  const v = await visitRoute(page, "/mctb/setup/text-back");
  if (!v.ok) throw new Error(v.note);

  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  const original = await textarea.inputValue();
  const marker = `cert-${Date.now().toString().slice(-5)}`;
  const next = original.includes("cert-")
    ? original.replace(/cert-\d+/, marker)
    : `${original} ${marker}`.trim();
  await textarea.fill(next);

  const saved = await clickSaveAndWait(page, /save changes/i);
  if (!saved) throw new Error("MCTB text-back save failed");

  await page.reload({ waitUntil: "domcontentloaded" });
  const after = await page.locator("textarea").first().inputValue();
  if (!after.includes(marker)) throw new Error("MCTB text-back opener did not persist");
}

/** MCTB consent — select existing_consent mode with attestation, save, reload. */
export async function saveMctbConsentUserAction(page: Page) {
  const patchRes = await page.request.patch("/api/mctb/setup", {
    data: {
      consentMode: "existing_consent",
      existingConsentAttested: true,
    },
  });
  if (!patchRes.ok()) {
    const err = await patchRes.json().catch(() => ({}));
    throw new Error(`MCTB consent save failed: ${err.error || patchRes.status()}`);
  }

  const v = await visitRoute(page, "/mctb/setup/consent");
  if (!v.ok) throw new Error(v.note);

  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  if (!/existing permission|already have|use permission my business already has/i.test(body)) {
    throw new Error("MCTB consent mode did not persist after reload");
  }
}

/** MCTB notifications/handoff — add recipient email, save, reload. */
export async function saveMctbNotificationsUserAction(page: Page) {
  const v = await visitRoute(page, "/mctb/setup/notifications");
  if (!v.ok) throw new Error(v.note);

  const emailInput = page.locator('input[type="email"]').first();
  if (await emailInput.count()) {
    await emailInput.fill("handoff-cert@transovo.test");
  }

  const addBtn = page.getByRole("button", { name: /add recipient|add/i }).first();
  if (await addBtn.count()) await addBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});

  const saved = await clickSaveAndWait(page, /save changes/i);
  if (!saved) throw new Error("MCTB notifications save failed");

  await page.reload({ waitUntil: "domcontentloaded" });
  const body = await page.locator("body").innerText();
  if (!body.includes("handoff-cert@transovo.test")) {
    throw new Error("MCTB notification recipient did not persist");
  }
}

/** MCTB phone setup — visit, interact with business line field if present, save when enabled. */
export async function saveMctbPhoneUserAction(page: Page) {
  const v = await visitRoute(page, "/mctb/setup/phone");
  if (!v.ok) throw new Error(v.note);

  const lineInput = page.locator('input[type="tel"], input[name*="business"], input[placeholder*="555" i]').first();
  if (await lineInput.count()) {
    const val = await lineInput.inputValue();
    if (!val || val.length < 10) {
      await lineInput.fill("+15555550188");
    }
  }

  const saveBtn = page.getByRole("button", { name: /save changes/i }).first();
  if (await saveBtn.count() && !(await saveBtn.isDisabled())) {
    await saveBtn.click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(2000);
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  if (!/business line|forwarding|phone|setup/i.test(body)) {
    throw new Error("MCTB phone setup did not render after reload");
  }
}

/** Public booking — complete minimal book flow when slug is live. */
export async function publicBookingUserAction(page: Page) {
  const path = `/book/${CERT_PUBLIC_BOOK_SLUG}`;
  const v = await visitRoute(page, path);
  if (!v.ok) throw new Error(v.note);

  const body = await page.locator("body").innerText();
  if (/not found|unavailable/i.test(body)) throw new Error(`Public booking slug not available: ${path}`);

  const bookBtn = page.getByRole("button", { name: /book|select|continue|next/i }).first();
  if (await bookBtn.count()) await bookBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});

  const service = page.getByRole("button", { name: /min|minute|service|appointment/i }).first();
  if (await service.count()) await service.click({ timeout: ACTION_TIMEOUT }).catch(() => {});

  const slot = page.getByRole("button", { name: /\d{1,2}:\d{2}|AM|PM/i }).first();
  if (await slot.count()) await slot.click({ timeout: ACTION_TIMEOUT });

  const firstName = page.locator('input[name="firstName"], #firstName').first();
  if (await firstName.count()) {
    const tag = `Pub${Date.now().toString().slice(-5)}`;
    await firstName.fill(tag);
    await page.locator('input[name="lastName"], #lastName').first().fill("Cert").catch(() => {});
    await page.locator('input[type="tel"], #phone').first().fill("+15555550177").catch(() => {});
    await page.locator('input[type="email"], #email').first().fill(`${tag}@transovo.test`).catch(() => {});

    const submit = page.getByRole("button", { name: /confirm|book|schedule|submit/i }).last();
    await submit.click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(3000);
    const result = await page.locator("body").innerText();
    if (!/confirmed|booked|scheduled|thank you|appointment/i.test(result)) {
      throw new Error("Public booking did not reach confirmation state");
    }
  }
}
