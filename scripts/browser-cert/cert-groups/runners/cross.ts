/**
 * Cross-product certification runners (CROSS-01 … CROSS-08).
 */
import type { CertContext } from "../../cert-context";
import { createAppointmentUserAction, publicBookingUserAction } from "../../behavioral-flow-helpers";
import { switchToAppointments, switchToMctb } from "../../flow-helpers";

export async function runCROSS01(ctx: CertContext) {
  await switchToAppointments(ctx.page);
  await ctx.visit("/appointments/overview");
  await switchToMctb(ctx.page);
  await ctx.visit("/mctb");
  await switchToAppointments(ctx.page);
  await ctx.reload();
}

export async function runCROSS02(ctx: CertContext) {
  await ctx.visit("/contacts");
  await ctx.searchList("cert");
  await ctx.reload();
}

export async function runCROSS03(ctx: CertContext) {
  await ctx.visit("/conversations");
  await ctx.visit("/mctb/conversations");
  await ctx.reload();
}

export async function runCROSS04(ctx: CertContext) {
  await publicBookingUserAction(ctx.page);
  await ctx.visit("/appointments");
  await ctx.reload();
}

export async function runCROSS05(ctx: CertContext) {
  await createAppointmentUserAction(ctx.page);
  await ctx.visit("/appointments/reminders");
  await ctx.reload();
}

export async function runCROSS06(ctx: CertContext) {
  await createAppointmentUserAction(ctx.page);
  await ctx.visit("/meetings");
  await ctx.visit("/settings/ai-notetaker");
  await ctx.reload();
}

export async function runCROSS07(ctx: CertContext) {
  await createAppointmentUserAction(ctx.page);
  await ctx.visit("/video");
  await ctx.reload();
}

export const CROSS_RUNNERS: Record<string, (ctx: CertContext) => Promise<void>> = {
  "CROSS-01": runCROSS01,
  "CROSS-02": runCROSS02,
  "CROSS-03": runCROSS03,
  "CROSS-04": runCROSS04,
  "CROSS-05": runCROSS05,
  "CROSS-06": runCROSS06,
  "CROSS-07": runCROSS07,
};
