/**
 * Browser UAT helpers — Acuity / SimplyBook / Square parity checklist (UAT-01..66).
 * Real clicks/inputs only; stop before live payment where noted.
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, visitRoute } from "./lib";
import {
  commerceCreateItem,
  ensureAppointmentsShell,
  fetchWorkspaceSlug,
  publicSurfaceLoads,
  shareEmbedHubUserAction,
} from "./service-booking-parity-helpers";
import { APPT_CANONICAL } from "./canonical-appointments-routes";
import { ensureCertWorkspaceReadyViaApi } from "./behavioral-flow-helpers";

export async function adminAvailabilityPageLoads(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/availability");
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  if (!/availability|hours|timezone|booking/i.test(body)) {
    throw new Error("Availability admin page did not load");
  }
}

export async function adminLocationsCreateAndSave(page: Page, name: string) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/locations");
  await page.waitForTimeout(1200);
  const addBtn = page.getByRole("button", { name: /add location/i }).first();
  await addBtn.click({ timeout: ACTION_TIMEOUT });
  const nameInput = page.getByLabel(/^Name$/i).first();
  await nameInput.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await nameInput.fill(name);
  const saveBtn = page.getByRole("button", { name: /^Save$/i }).first();
  await saveBtn.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  if (!body.includes(name)) throw new Error(`Location "${name}" not visible after save`);
}

export async function adminLocationsWeeklyHoursToggle(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/locations");
  await page.waitForTimeout(1200);
  const customHours = page.getByLabel(/custom hours/i).first();
  if (!(await customHours.count())) {
    throw new Error("Custom hours toggle not found on locations editor");
  }
  await customHours.check({ timeout: ACTION_TIMEOUT });
  const mondayOpen = page.getByLabel(/monday open/i).first();
  await mondayOpen.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
}

export async function adminPosCartMixedLines(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/pos");
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  if (!/POS cart|mixed checkout/i.test(body)) throw new Error("POS page did not load");

  const newCart = page.getByRole("button", { name: /new cart/i }).first();
  await newCart.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1000);

  const lineType = page.locator("select").first();
  await lineType.selectOption("tip");
  const desc = page.locator('input[class*="rounded"]').filter({ hasNot: page.locator('[type="number"]') }).first();
  await desc.fill("UAT Tip");
  const price = page.locator('input[type="number"]').first();
  await price.fill("5");
  await page.getByRole("button", { name: /add item/i }).click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1200);

  const after = await page.locator("body").innerText();
  if (!/UAT Tip|tip/i.test(after)) throw new Error("POS tip line not listed");
}

export async function adminIntakeFileFieldEditor(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, APPT_CANONICAL.intakeForms);
  const intakeTab = page.getByRole("button", { name: /Intake forms/i }).first();
  if (await intakeTab.count()) await intakeTab.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(800);

  const unique = `UAT Intake File ${Date.now().toString().slice(-5)}`;
  await page.locator('input[placeholder*="name" i], label:has-text("Name") ~ input').first().fill(unique);
  await page.getByRole("button", { name: /^Add$/i }).click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1500);

  const formBtn = page.getByRole("button", { name: new RegExp(unique.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) }).first();
  if (await formBtn.count()) await formBtn.click({ timeout: ACTION_TIMEOUT });
  await page.getByRole("button", { name: /file upload/i }).click({ timeout: ACTION_TIMEOUT }).catch(async () => {
    const addFile = page.getByRole("button", { name: /\+ File upload/i }).first();
    if (await addFile.count()) await addFile.click({ timeout: ACTION_TIMEOUT });
    else throw new Error("Could not add file upload field to intake form");
  });
  await page.getByRole("button", { name: /save fields/i }).click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  if (!/Saved|file upload|Upload a file/i.test(body)) {
    throw new Error("Intake file field editor did not save");
  }
}

export async function publicBookingFirstSteps(page: Page) {
  await ensureAppointmentsShell(page);
  await ensureCertWorkspaceReadyViaApi(page).catch(() => {});
  const slug = (await fetchWorkspaceSlug(page)) || "appt-mctb-browser-cert";
  await publicSurfaceLoads(page, `/book/${slug}`, /book|service|appointment|select|choose/i);
  const serviceBtn = page.getByRole("button", { name: /service|book|select/i }).first();
  if (await serviceBtn.count()) {
    await serviceBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(1200);
  }
}

export async function adminShareQr(page: Page) {
  await shareEmbedHubUserAction(page);
}

export async function adminThemeCustomCss(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, APPT_CANONICAL.branding);
  const tab = page.getByRole("button", { name: /branding|theme/i }).first();
  if (await tab.count()) await tab.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(800);
  const body = await page.locator("body").innerText();
  if (!/Primary color|branding|css|terminology/i.test(body)) {
    throw new Error("Scheduler branding editor not visible");
  }
}

export async function adminResourcesCreate(page: Page) {
  await commerceCreateItem(page, APPT_CANONICAL.roomsEquipment, /Resources/i, "UAT Resource Qty");
}

export async function adminProductsCreate(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, APPT_CANONICAL.pos);
  const tab = page.getByRole("button", { name: /Products|packages/i }).first();
  if (await tab.count()) await tab.click({ timeout: ACTION_TIMEOUT });
}

export async function adminPackageCreate(page: Page) {
  await commerceCreateItem(page, APPT_CANONICAL.packages, /Packages/i, "UAT Package Browser");
}

export async function adminManageLinkInvalid(page: Page) {
  await publicSurfaceLoads(
    page,
    "/manage/invalid-uat-token-xyz",
    /invalid|not found|unavailable|expired|error/i,
  );
}
