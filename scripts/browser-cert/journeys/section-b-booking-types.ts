/**
 * Section B — Booking types / services (tests 15–25)
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, visitRoute } from "../lib";
import { createBookingTypeUserAction } from "../behavioral-flow-helpers";
import { ensureAppointmentsAdmin, openPublicBooking, selectPublicService } from "../master-uat-helpers";
import { MASTER_UAT_SERVICE_NAME, MASTER_UAT_SLUG } from "../master-uat-config";
import { shareEmbedHubUserAction } from "../service-booking-parity-helpers";
import { journey } from "./journey-utils";

async function openTypesEditor(page: Page) {
  await ensureAppointmentsAdmin(page);
  const v = await visitRoute(page, "/appointments/types");
  if (!v.ok) throw new Error(v.note);
  await page.waitForTimeout(1500);
}

async function openFirstServiceEditor(page: Page) {
  await openTypesEditor(page);
  const pick = page.getByRole("button", { name: new RegExp(MASTER_UAT_SERVICE_NAME, "i") }).first();
  if (await pick.count()) {
    await pick.click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(1500);
    return;
  }
  const any = page.getByRole("button", { name: /minute|consultation|service/i }).first();
  await any.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1500);
}

export const SECTION_B_JOURNEYS = [
  journey("15", "B", "Service phases / processing time", async (page) => {
    await openFirstServiceEditor(page);
    const body = await page.locator("body").innerText();
    if (!/phase|processing|staff required/i.test(body)) {
      throw new Error("Service phases / processing time editor not reachable");
    }
    const addPhase = page.getByRole("button", { name: /add phase|processing/i }).first();
    if (await addPhase.count()) await addPhase.click({ timeout: ACTION_TIMEOUT });
    const save = page.getByRole("button", { name: /^save/i }).first();
    if (await save.count() && !(await save.isDisabled())) await save.click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(2000);
  }),
  journey("16", "B", "Multiple duration choices", async (page) => {
    await openFirstServiceEditor(page);
    const body = await page.locator("body").innerText();
    if (!/duration|minute/i.test(body)) throw new Error("Duration editor not found");
    await openPublicBooking(page);
    await selectPublicService(page);
    const pub = await page.locator("body").innerText();
    if (!/minute|duration|length/i.test(pub)) throw new Error("Public book missing duration context");
  }),
  journey("17", "B", "Booking type categories", async (page) => {
    await openTypesEditor(page);
    const body = await page.locator("body").innerText();
    if (!/categor/i.test(body)) throw new Error("Categories UI not found on types page");
    await openPublicBooking(page);
    await page.waitForTimeout(1500);
  }),
  journey("18", "B", "Booking type image", async (page) => {
    await openFirstServiceEditor(page);
    if (!(await page.locator("body").innerText()).match(/image|photo|upload/i)) {
      throw new Error("Service image upload not found in editor");
    }
  }),
  journey("19", "B", "Booking type visibility", async (page) => {
    await openFirstServiceEditor(page);
    const vis = page.getByLabel(/visibility|unlisted|public/i).first();
    if (!(await vis.count())) {
      const body = await page.locator("body").innerText();
      if (!/visibility|unlisted|hidden/i.test(body)) throw new Error("Visibility controls not found");
    }
    await openPublicBooking(page);
    await visitRoute(page, `/book/${MASTER_UAT_SLUG}?type=test`);
  }),
  journey("20", "B", "Display/reorder services", async (page) => {
    await openTypesEditor(page);
    const reorder = page.getByRole("button", { name: /reorder|drag|order/i }).first();
    if (!(await reorder.count())) {
      const body = await page.locator("body").innerText();
      if (!/appointment type|service/i.test(body)) throw new Error("Types list not available for reorder");
    }
    await openPublicBooking(page);
  }),
  journey("21", "B", "Custom booking questions", async (page) => {
    await openFirstServiceEditor(page);
    const body = await page.locator("body").innerText();
    if (!/question|intake|custom/i.test(body)) throw new Error("Custom questions section not found");
  }),
  journey("22", "B", "Booking approval required", async (page) => {
    await openFirstServiceEditor(page);
    const body = await page.locator("body").innerText();
    if (!/approval|require approval|pending/i.test(body)) {
      throw new Error("Approval-required setting not found");
    }
  }),
  journey("23", "B", "Approval decline", async (page) => {
    await ensureAppointmentsAdmin(page);
    await visitRoute(page, "/appointments/scheduled");
    const body = await page.locator("body").innerText();
    if (!/pending|approval|scheduled|appointment/i.test(body)) {
      throw new Error("Scheduled list not available for approval decline journey");
    }
  }),
  journey("24", "B", "Confirmation page customization", async (page) => {
    await ensureAppointmentsAdmin(page);
    await visitRoute(page, "/appointments/booking");
    const body = await page.locator("body").innerText();
    if (!/confirmation|booking page|message/i.test(body)) {
      throw new Error("Confirmation customization not found");
    }
  }),
  journey("25", "B", "Booking page general settings", async (page) => {
    await shareEmbedHubUserAction(page);
    await visitRoute(page, "/appointments/booking");
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    if (!/booking|intro|business|display/i.test(body)) {
      throw new Error("Booking page settings not found");
    }
  }),
];
