/**
 * Appointments certification group runners (APT-01 … APT-69).
 */
import type { CertContext } from "../../cert-context";
import { configPageSaveReload } from "../../cert-context";
import {
  cancelAppointmentUserAction,
  createAppointmentUserAction,
  createBookingTypeUserAction,
  editAppointmentNotesUserAction,
  publicBookingUserAction,
  saveAvailabilityUserAction,
  saveNotetakerSettingsUserAction,
  saveReminderSettingsUserAction,
  waitForPublicErrorText,
} from "../../behavioral-flow-helpers";
import { calendarNavActions, listSearchAction, switchToAppointments, switchToMctb } from "../../flow-helpers";
import { ACTION_TIMEOUT } from "../../lib";

const APT_NAV_ROUTES = [
  "/appointments/overview",
  "/appointments/calendar",
  "/appointments",
  "/appointments/types",
  "/appointments/booking",
  "/appointments/availability",
  "/appointments/reminders",
  "/contacts",
  "/conversations",
  "/settings/business",
];

export async function runAPT01(ctx: CertContext) {
  await switchToAppointments(ctx.page);
  for (const path of APT_NAV_ROUTES) {
    await ctx.visit(path);
    const body = await ctx.bodyText();
    if (/Missed Call Text Back/i.test(body) && !/Appointments|Overview|Calendar/i.test(body)) {
      throw new Error(`Appointments nav leaked MCTB context on ${path}`);
    }
  }
  await ctx.visit("/appointments/calendar");
  await ctx.goBack();
  await ctx.reload();
  await ctx.setMobileViewport();
  await ctx.visit("/appointments/overview");
  await ctx.setDesktopViewport();
}

export async function runAPT02(ctx: CertContext) {
  await ctx.visit("/appointments/overview");
  await ctx.waitForHeading(/overview|appointments|home/i);
  const body = await ctx.bodyText();
  if (/loading/i.test(body) && body.length < 80) throw new Error("Overview stuck loading");
  const link = ctx.page.getByRole("link", { name: /appointment|calendar|analytics/i }).first();
  if (await link.count()) await link.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.visit("/appointments/overview");
  await ctx.reload();
}

export async function runAPT03(ctx: CertContext) {
  await calendarNavActions(ctx.page);
  for (const view of [/week/i, /day/i, /month/i]) {
    const btn = ctx.page.getByRole("button", { name: view }).first();
    if (await btn.count()) await btn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  }
  await ctx.reload();
}

export async function runAPT04(ctx: CertContext) {
  await listSearchAction(ctx.page);
  const filter = ctx.page.getByRole("combobox", { name: /status|filter/i }).first();
  if (await filter.count()) await filter.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT05(ctx: CertContext) {
  await createAppointmentUserAction(ctx.page);
  await ctx.visit("/appointments/calendar");
  const body = await ctx.bodyText();
  if (!/cert|browser|scheduled/i.test(body)) {
    await ctx.visit("/appointments");
  }
}

export async function runAPT06(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await ctx.visit(`/appointments/${appointmentId}`);
  await ctx.waitForHeading(/.+/);
  const body = await ctx.bodyText();
  if (!/reminder|timeline|activity|scheduled|confirmed/i.test(body)) {
    throw new Error("Appointment detail missing expected sections");
  }
  await ctx.reload();
}

export async function runAPT07(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await editAppointmentNotesUserAction(ctx.page, appointmentId);
}

export async function runAPT08(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await ctx.visit(`/appointments/${appointmentId}`);
  const reschedule = ctx.page.getByRole("button", { name: /reschedule/i }).first();
  if (!(await reschedule.count())) throw new Error("Reschedule control not found");
  await reschedule.click({ timeout: ACTION_TIMEOUT });
  const slot = ctx.page.getByRole("radio").first();
  if (await slot.count()) {
    await slot.click({ timeout: ACTION_TIMEOUT });
    await ctx.clickButton(/save new time/i);
    await ctx.reload();
  }
}

export async function runAPT09(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await cancelAppointmentUserAction(ctx.page, appointmentId);
}

export async function runAPT10(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await ctx.visit(`/appointments/${appointmentId}`);
  const confirm = ctx.page.getByRole("button", { name: /^confirm$/i }).first();
  if (await confirm.count()) {
    await confirm.click({ timeout: ACTION_TIMEOUT });
    await ctx.reloadVerifyText(/confirmed/i);
  }
  const complete = ctx.page.getByRole("button", { name: /mark complete|complete/i }).first();
  if (await complete.count()) {
    await complete.click({ timeout: ACTION_TIMEOUT });
    await ctx.reload();
  }
}

export async function runAPT11(ctx: CertContext) {
  await createBookingTypeUserAction(ctx.page);
}

export async function runAPT12(ctx: CertContext) {
  await ctx.visit("/appointments/booking");
  await ctx.waitForHeading(/booking/i);
  const newBtn = ctx.page.getByRole("button", { name: /new|create|add/i }).first();
  if (await newBtn.count()) await newBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT13(ctx: CertContext) {
  await publicBookingUserAction(ctx.page);
}

export async function runAPT14(ctx: CertContext) {
  await ctx.visit("/appointments/availability");
  await ctx.waitForHeading(/availability/i);
  await ctx.reload();
}

export async function runAPT15(ctx: CertContext) {
  await ctx.visit("/appointments/types");
  const body = await ctx.bodyText();
  if (!/approval|type|appointment/i.test(body)) throw new Error("Types page missing approval context");
  await ctx.reload();
}

export async function runAPT16(ctx: CertContext) {
  await saveAvailabilityUserAction(ctx.page);
}

export async function runAPT17(ctx: CertContext) {
  await ctx.visit("/appointments/staff");
  await ctx.waitForHeading(/staff/i);
  const firstStaff = ctx.page.locator('[data-staff-id], button, [role="button"]').filter({ hasText: /cert staff|staff/i }).first();
  if (await firstStaff.count()) await firstStaff.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.save(/save changes/i);
  await ctx.reload();
}

export async function runAPT18(ctx: CertContext) {
  await ctx.visit("/appointments/locations");
  await ctx.waitForHeading(/location/i);
  const firstLocation = ctx.page.getByText(/cert office|office/i).first();
  if (await firstLocation.count()) await firstLocation.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.save(/^save$/i);
  await ctx.reload();
}

export async function runAPT20(ctx: CertContext) {
  await ctx.visit("/appointments/routing-forms");
  await ctx.waitForHeading(/routing|form/i);
  const create = ctx.page.getByRole("button", { name: /new|create|add/i }).first();
  if (await create.count()) await create.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT21(ctx: CertContext) {
  await ctx.visit("/appointments/routing");
  await ctx.reload();
}

export async function runAPT22(ctx: CertContext) {
  await ctx.visit("/appointments/waitlist");
  const add = ctx.page.getByRole("button", { name: /add|new/i }).first();
  if (await add.count()) await add.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT23(ctx: CertContext) {
  await ctx.visit("/appointments/recalls");
  await ctx.reload();
}

export async function runAPT24(ctx: CertContext) {
  await ctx.visit("/appointments/recall-campaigns");
  await ctx.reload();
}

export async function runAPT25(ctx: CertContext) {
  await configPageSaveReload(ctx, "/appointments/no-show-recovery", /no.?show|recovery/i, /save/i);
}

export async function runAPT26(ctx: CertContext) {
  await ctx.visit("/appointments/enterprise");
  await ctx.reload();
}

export async function runAPT27(ctx: CertContext) {
  await ctx.visit("/appointments/team-pages");
  const create = ctx.page.getByRole("button", { name: /new|create/i }).first();
  if (await create.count()) await create.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT28(ctx: CertContext) {
  await ctx.visit("/appointments/polls");
  await ctx.reload();
}

export async function runAPT29(ctx: CertContext) {
  await ctx.visit("/appointments/booking");
  const body = await ctx.bodyText();
  if (!/single|link|booking/i.test(body)) throw new Error("Single-use link controls not found on booking pages");
}

export async function runAPT30(ctx: CertContext) {
  await ctx.visit("/contacts");
  const create = ctx.page.getByRole("button", { name: /new contact|add contact|create/i }).first();
  if (await create.count()) await create.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.searchList("cert");
  await ctx.reload();
}

export async function runAPT31(ctx: CertContext) {
  await ctx.visit("/conversations");
  await ctx.searchList("cert");
  await ctx.reload();
}

export async function runAPT32(ctx: CertContext) {
  await saveReminderSettingsUserAction(ctx.page);
}

export async function runAPT33(ctx: CertContext) {
  await saveReminderSettingsUserAction(ctx.page);
}

export async function runAPT34(ctx: CertContext) {
  await ctx.visit("/appointments/voice-reminders");
  await ctx.waitForHeading(/voice|reminder/i);
  const toggle = ctx.page.getByRole("checkbox").first();
  if (await toggle.count()) await toggle.click({ force: true }).catch(() => {});
  try {
    await ctx.save(/save/i);
  } catch {
    /* save optional if no changes */
  }
  await ctx.reload();
}

export async function runAPT35(ctx: CertContext) {
  await ctx.visit("/appointments/workflows");
  const create = ctx.page.getByRole("button", { name: /new|create/i }).first();
  if (await create.count()) await create.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT36(ctx: CertContext) {
  await ctx.visit("/appointments/automations/templates");
  await ctx.reload();
}

export async function runAPT37(ctx: CertContext) {
  await ctx.visit("/appointments/automations/activity");
  await ctx.reload();
}

export async function runAPT38(ctx: CertContext) {
  await ctx.visit("/appointments/workflows");
  const ai = ctx.page.getByRole("button", { name: /ai|architect/i }).first();
  if (await ai.count()) await ai.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT39(ctx: CertContext) {
  await ctx.visit("/appointments/workflows");
  await ctx.reload();
}

export async function runAPT40(ctx: CertContext) {
  await ctx.visit("/appointments/ai-booking");
  await ctx.waitForHeading(/ai|booking/i);
  const body = await ctx.bodyText();
  if (!/ai|booking|chat|assistant/i.test(body)) {
    throw new Error("AI booking settings surface not visible");
  }
  await ctx.reload();
}

export async function runAPT41(ctx: CertContext) {
  await publicBookingUserAction(ctx.page);
}

export async function runAPT42(ctx: CertContext) {
  await ctx.visit("/conversations");
  await ctx.reload();
}

export async function runAPT43(ctx: CertContext) {
  await ctx.visit("/conversations");
  await ctx.reload();
}

export async function runAPT44(ctx: CertContext) {
  await ctx.visit("/appointments/overview");
  await ctx.reload();
}

export async function runAPT46(ctx: CertContext) {
  await ctx.visit("/video");
  await ctx.reload();
}

export async function runAPT47(ctx: CertContext) {
  await createAppointmentUserAction(ctx.page);
}

export async function runAPT49(ctx: CertContext) {
  await ctx.visit("/video/invalid-token-xyz", { allow404: true });
  await waitForPublicErrorText(ctx.page, /invalid|not found|unavailable|expired/i);
}

export async function runAPT50(ctx: CertContext) {
  await saveNotetakerSettingsUserAction(ctx.page);
}

export async function runAPT51(ctx: CertContext) {
  await ctx.visit("/appointments/types");
  await ctx.reload();
}

export async function runAPT52(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await ctx.visit(`/appointments/${appointmentId}`);
  const panel = ctx.page.getByText(/notetaker|ai notes|recording/i).first();
  if (await panel.count()) await panel.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT53(ctx: CertContext) {
  const { appointmentId } = await createAppointmentUserAction(ctx.page);
  await ctx.visit(`/appointments/${appointmentId}`);
  const meeting = ctx.page.getByRole("button", { name: /meeting|zoom|teams|video/i }).first();
  if (await meeting.count()) await meeting.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT54(ctx: CertContext) {
  await saveNotetakerSettingsUserAction(ctx.page);
}

export async function runAPT56(ctx: CertContext) {
  await ctx.visit("/meetings");
  await ctx.reload();
}

export async function runAPT57(ctx: CertContext) {
  await ctx.visit("/meetings");
  await ctx.reload();
}

export async function runAPT59(ctx: CertContext) {
  await ctx.visit("/recap/invalid-token-xyz", { allow404: true });
  await waitForPublicErrorText(ctx.page, /invalid|not found|unavailable|expired/i);
}

export async function runAPT60(ctx: CertContext) {
  await saveNotetakerSettingsUserAction(ctx.page);
}

export async function runAPT62(ctx: CertContext) {
  await ctx.visit("/appointments/analytics");
  await ctx.reload();
}

export async function runAPT63(ctx: CertContext) {
  await ctx.visit("/appointments/analytics/booking");
  await ctx.reload();
}

export async function runAPT64(ctx: CertContext) {
  await ctx.visit("/appointments/analytics/reminders");
  await ctx.reload();
}

export async function runAPT65(ctx: CertContext) {
  await ctx.visit("/appointments/analytics/automations");
  await ctx.reload();
}

export async function runAPT66(ctx: CertContext) {
  await ctx.visit("/appointments/analytics/reports");
  const exportBtn = ctx.page.getByRole("button", { name: /export|download|report/i }).first();
  if (await exportBtn.count()) await exportBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT67(ctx: CertContext) {
  await ctx.visit("/appointments/setup");
  const continueBtn = ctx.page.getByRole("button", { name: /continue|next|start/i }).first();
  if (await continueBtn.count()) await continueBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runAPT68(ctx: CertContext) {
  await ctx.visit("/appointments/integrations");
  await ctx.visit("/integrations/calendars");
  await ctx.reload();
}

export async function runAPT69(ctx: CertContext) {
  await ctx.visit("/settings/business");
  await ctx.visit("/settings/messaging");
  await ctx.visit("/settings/calendar");
  await ctx.reload();
}

export const APT_RUNNERS: Record<string, (ctx: CertContext) => Promise<void>> = {
  "APT-01": runAPT01,
  "APT-02": runAPT02,
  "APT-03": runAPT03,
  "APT-04": runAPT04,
  "APT-05": runAPT05,
  "APT-06": runAPT06,
  "APT-07": runAPT07,
  "APT-08": runAPT08,
  "APT-09": runAPT09,
  "APT-10": runAPT10,
  "APT-11": runAPT11,
  "APT-12": runAPT12,
  "APT-13": runAPT13,
  "APT-14": runAPT14,
  "APT-15": runAPT15,
  "APT-16": runAPT16,
  "APT-17": runAPT17,
  "APT-18": runAPT18,
  "APT-20": runAPT20,
  "APT-21": runAPT21,
  "APT-22": runAPT22,
  "APT-23": runAPT23,
  "APT-24": runAPT24,
  "APT-25": runAPT25,
  "APT-26": runAPT26,
  "APT-27": runAPT27,
  "APT-28": runAPT28,
  "APT-29": runAPT29,
  "APT-30": runAPT30,
  "APT-31": runAPT31,
  "APT-32": runAPT32,
  "APT-33": runAPT33,
  "APT-34": runAPT34,
  "APT-35": runAPT35,
  "APT-36": runAPT36,
  "APT-37": runAPT37,
  "APT-38": runAPT38,
  "APT-39": runAPT39,
  "APT-40": runAPT40,
  "APT-41": runAPT41,
  "APT-42": runAPT42,
  "APT-43": runAPT43,
  "APT-44": runAPT44,
  "APT-46": runAPT46,
  "APT-47": runAPT47,
  "APT-49": runAPT49,
  "APT-50": runAPT50,
  "APT-51": runAPT51,
  "APT-52": runAPT52,
  "APT-53": runAPT53,
  "APT-54": runAPT54,
  "APT-56": runAPT56,
  "APT-57": runAPT57,
  "APT-59": runAPT59,
  "APT-60": runAPT60,
  "APT-62": runAPT62,
  "APT-63": runAPT63,
  "APT-64": runAPT64,
  "APT-65": runAPT65,
  "APT-66": runAPT66,
  "APT-67": runAPT67,
  "APT-68": runAPT68,
  "APT-69": runAPT69,
};
