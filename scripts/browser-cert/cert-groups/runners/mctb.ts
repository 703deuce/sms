/**
 * MCTB certification group runners (MCTB-01 … MCTB-58).
 */
import type { CertContext } from "../../cert-context";
import { configPageSaveReload } from "../../cert-context";
import {
  saveMctbConsentUserAction,
  saveMctbNotificationsUserAction,
  saveMctbPhoneUserAction,
  saveMctbTextBackUserAction,
} from "../../behavioral-flow-helpers";
import { assertMctbShell, assertRedirect, switchToMctb } from "../../flow-helpers";
import { ACTION_TIMEOUT } from "../../lib";

const MCTB_NAV_ROUTES = [
  "/mctb",
  "/mctb/missed-calls",
  "/mctb/conversations",
  "/mctb/voicemail",
  "/mctb/analytics",
  "/mctb/setup",
  "/mctb/numbers",
];

export async function runMCTB01(ctx: CertContext) {
  await assertMctbShell(ctx.page);
  for (const path of MCTB_NAV_ROUTES) {
    await ctx.visit(path);
    const body = await ctx.bodyText();
    if (/Booking Types|Appointments calendar/i.test(body) && !/Missed Call|MCTB|Overview/i.test(body)) {
      throw new Error(`MCTB nav leaked Appointments context on ${path}`);
    }
  }
  await ctx.setMobileViewport();
  await ctx.visit("/mctb");
  await ctx.setDesktopViewport();
}

export async function runMCTB02(ctx: CertContext) {
  await ctx.visit("/mctb");
  await ctx.waitForHeading(/overview|missed call|mctb/i);
  await ctx.reload();
}

export async function runMCTB03(ctx: CertContext) {
  await ctx.visit("/mctb/setup/start");
  const next = ctx.page.getByRole("button", { name: /continue|next/i }).first();
  if (await next.count()) await next.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runMCTB04(ctx: CertContext) {
  await ctx.visit("/mctb/setup");
  const link = ctx.page.getByRole("link", { name: /phone|consent|text back|recovery/i }).first();
  if (await link.count()) await link.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runMCTB05(ctx: CertContext) {
  await saveMctbPhoneUserAction(ctx.page);
}

export async function runMCTB06(ctx: CertContext) {
  await configPageSaveReload(ctx, "/mctb/setup/missed-call-rules", /missed|rule/i, /save changes/i, async (c) => {
    const cb = c.page.getByRole("checkbox").first();
    if (await cb.count()) await cb.click({ force: true });
    return undefined;
  });
}

export async function runMCTB07(ctx: CertContext) {
  await ctx.visit("/mctb/setup/consent");
  const press1 = ctx.page.getByText(/press 1|ask callers/i).first();
  if (await press1.count()) await press1.click({ timeout: ACTION_TIMEOUT });
  await ctx.save(/save changes/i);
  await ctx.reload();
}

export async function runMCTB08(ctx: CertContext) {
  await ctx.visit("/mctb/setup/test");
  const body = await ctx.bodyText();
  if (!/press|consent|test|diagnostic/i.test(body)) {
    throw new Error("Press-1 runtime diagnostics surface not available");
  }
}

export async function runMCTB09(ctx: CertContext) {
  await saveMctbConsentUserAction(ctx.page);
}

export async function runMCTB10(ctx: CertContext) {
  await saveMctbConsentUserAction(ctx.page);
  await ctx.visit("/mctb/setup/test");
  await ctx.reload();
}

export async function runMCTB11(ctx: CertContext) {
  await ctx.visit("/mctb/compliance/consent");
  await ctx.searchList("cert");
  await ctx.reload();
}

export async function runMCTB12(ctx: CertContext) {
  await saveMctbTextBackUserAction(ctx.page);
}

export async function runMCTB13(ctx: CertContext) {
  await configPageSaveReload(ctx, "/mctb/setup/links", /link|request form/i, /save changes/i);
}

export async function runMCTB14(ctx: CertContext) {
  await ctx.visit("/f/mctb/invalid-token-xyz", { allow404: true });
  const body = await ctx.bodyText();
  if (!/invalid|not found|unavailable/i.test(body)) {
    throw new Error("Invalid MCTB request form token should error");
  }
}

export async function runMCTB15(ctx: CertContext) {
  await ctx.visit("/mctb/numbers");
  const body = await ctx.bodyText();
  if (!/business line|sender|forward|number/i.test(body)) {
    throw new Error("Numbers page missing canonical number role labels");
  }
  await ctx.reload();
}

export async function runMCTB16(ctx: CertContext) {
  await ctx.visit("/mctb/numbers");
  await ctx.reload();
}

export async function runMCTB19(ctx: CertContext) {
  await configPageSaveReload(ctx, "/mctb/setup/recovery", /recovery|pause/i, /save changes/i);
}

export async function runMCTB20(ctx: CertContext) {
  await assertRedirect(ctx.page, "/mctb/setup/business-hours", "/mctb/setup/recovery");
  await assertRedirect(ctx.page, "/mctb/setup/follow-up", "/mctb/setup/recovery");
}

export async function runMCTB22(ctx: CertContext) {
  await configPageSaveReload(ctx, "/mctb/setup/exclusions", /exclusion/i, /save changes/i);
}

export async function runMCTB23(ctx: CertContext) {
  await ctx.visit("/mctb/conversations");
  await ctx.reload();
}

export async function runMCTB24(ctx: CertContext) {
  await ctx.visit("/mctb/setup/test");
  await ctx.reload();
}

export async function runMCTB25(ctx: CertContext) {
  await ctx.visit("/mctb/setup/recovery");
  await ctx.reload();
}

export async function runMCTB26(ctx: CertContext) {
  await ctx.visit("/mctb/setup");
  await ctx.reload();
}

export async function runMCTB27(ctx: CertContext) {
  await ctx.visit("/mctb/missed-calls");
  await ctx.reload();
}

export async function runMCTB28(ctx: CertContext) {
  await ctx.visit("/mctb/missed-calls");
  await ctx.searchList("cert");
  const row = ctx.page.locator("table tbody tr, [role='row']").first();
  if (await row.count()) await row.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runMCTB29(ctx: CertContext) {
  await ctx.visit("/mctb/missed-calls");
  const link = ctx.page.getByRole("link").first();
  if (await link.count()) {
    const href = await link.getAttribute("href");
    if (href?.includes("/mctb/missed-calls/")) {
      await link.click({ timeout: ACTION_TIMEOUT });
      await ctx.reload();
      return;
    }
  }
  throw new Error("No missed call detail link available — seed fixture missed call");
}

export async function runMCTB30(ctx: CertContext) {
  await ctx.visit("/mctb/conversations");
  await ctx.searchList("cert");
  await ctx.reload();
}

async function runHandoffMode(ctx: CertContext, modePattern: RegExp) {
  await saveMctbNotificationsUserAction(ctx.page);
  await ctx.visit("/mctb/setup/notifications");
  const mode = ctx.page.getByText(modePattern).first();
  if (await mode.count()) await mode.click({ timeout: ACTION_TIMEOUT });
  await ctx.save(/save changes/i);
  await ctx.reload();
}

export async function runMCTB31(ctx: CertContext) {
  await runHandoffMode(ctx, /notify/i);
}

export async function runMCTB32(ctx: CertContext) {
  await runHandoffMode(ctx, /guided|collection/i);
}

export async function runMCTB33(ctx: CertContext) {
  await runHandoffMode(ctx, /ai conversation/i);
}

export async function runMCTB34(ctx: CertContext) {
  await runHandoffMode(ctx, /immediate handoff/i);
}

export async function runMCTB35(ctx: CertContext) {
  await ctx.visit("/mctb/setup/notifications");
  await ctx.reload();
}

export async function runMCTB36(ctx: CertContext) {
  await ctx.visit("/mctb/setup/notifications");
  await ctx.reload();
}

export async function runMCTB37(ctx: CertContext) {
  await ctx.visit("/mctb/setup/notifications");
  await ctx.reload();
}

export async function runMCTB38(ctx: CertContext) {
  await ctx.visit("/mctb/setup/notifications");
  await ctx.reload();
}

export async function runMCTB39(ctx: CertContext) {
  await ctx.visit("/mctb/conversations");
  await ctx.reload();
}

export async function runMCTB40(ctx: CertContext) {
  await ctx.visit("/mctb/conversations");
  const takeover = ctx.page.getByRole("button", { name: /take over|human/i }).first();
  if (await takeover.count()) await takeover.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runMCTB41(ctx: CertContext) {
  await saveMctbNotificationsUserAction(ctx.page);
}

export async function runMCTB42(ctx: CertContext) {
  await saveMctbNotificationsUserAction(ctx.page);
}

export async function runMCTB43(ctx: CertContext) {
  await ctx.visit("/mctb/setup/notifications");
  await ctx.reload();
}

export async function runMCTB44(ctx: CertContext) {
  await ctx.visit("/mctb/setup/notifications");
  const test = ctx.page.getByRole("button", { name: /test notification|send test/i }).first();
  if (await test.count()) await test.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runMCTB45(ctx: CertContext) {
  await ctx.visit("/mctb/missed-calls");
  await ctx.reload();
}

export async function runMCTB46(ctx: CertContext) {
  await saveMctbNotificationsUserAction(ctx.page);
}

export async function runMCTB47(ctx: CertContext) {
  await publicBookingFromMctb(ctx);
}

async function publicBookingFromMctb(ctx: CertContext) {
  await ctx.visit("/mctb/conversations");
  await ctx.visit("/book/appt-mctb-browser-cert");
  const body = await ctx.bodyText();
  if (/not found|unavailable/i.test(body)) throw new Error("Public booking slug required for MCTB-47");
}

export async function runMCTB48(ctx: CertContext) {
  await ctx.visit("/mctb/setup/links");
  await ctx.reload();
}

export async function runMCTB49(ctx: CertContext) {
  await configPageSaveReload(ctx, "/mctb/setup/voicemail", /voicemail|greeting/i, /save changes/i);
}

export async function runMCTB50(ctx: CertContext) {
  await ctx.visit("/mctb/setup/voicemail");
  await ctx.reload();
}

export async function runMCTB51(ctx: CertContext) {
  await ctx.visit("/mctb/voicemail");
  await ctx.reload();
}

export async function runMCTB52(ctx: CertContext) {
  await ctx.visit("/mctb/voicemail");
  const body = await ctx.bodyText();
  if (!/voicemail|transcript|audio|summary/i.test(body)) {
    throw new Error("Voicemail inbox missing expected sections");
  }
}

export async function runMCTB53(ctx: CertContext) {
  await ctx.visit("/mctb/voicemail");
  await ctx.visit("/mctb/setup/recovery");
  await ctx.reload();
}

export async function runMCTB54(ctx: CertContext) {
  await ctx.visit("/mctb/setup/test");
  await ctx.reload();
}

export async function runMCTB55(ctx: CertContext) {
  await ctx.visit("/mctb/setup/test");
  const tryIt = ctx.page.getByRole("button", { name: /try|demo|test/i }).first();
  if (await tryIt.count()) await tryIt.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  await ctx.reload();
}

export async function runMCTB56(ctx: CertContext) {
  await ctx.visit("/mctb/analytics");
  await ctx.reload();
}

export async function runMCTB57(ctx: CertContext) {
  await assertRedirect(ctx.page, "/voice/missed-calls", "/mctb/missed-calls");
  await assertRedirect(ctx.page, "/voice/setup", "/mctb/setup");
  await assertRedirect(ctx.page, "/voice/conversations", "/mctb/conversations");
  await assertRedirect(ctx.page, "/mctb/setup/business-hours", "/mctb/setup/recovery");
}

export async function runMCTB58(ctx: CertContext) {
  await switchToMctb(ctx.page);
  await ctx.visit("/mctb");
  await ctx.reload();
}

export const MCTB_RUNNERS: Record<string, (ctx: CertContext) => Promise<void>> = {
  "MCTB-01": runMCTB01,
  "MCTB-02": runMCTB02,
  "MCTB-03": runMCTB03,
  "MCTB-04": runMCTB04,
  "MCTB-05": runMCTB05,
  "MCTB-06": runMCTB06,
  "MCTB-07": runMCTB07,
  "MCTB-08": runMCTB08,
  "MCTB-09": runMCTB09,
  "MCTB-10": runMCTB10,
  "MCTB-11": runMCTB11,
  "MCTB-12": runMCTB12,
  "MCTB-13": runMCTB13,
  "MCTB-14": runMCTB14,
  "MCTB-15": runMCTB15,
  "MCTB-16": runMCTB16,
  "MCTB-19": runMCTB19,
  "MCTB-20": runMCTB20,
  "MCTB-22": runMCTB22,
  "MCTB-23": runMCTB23,
  "MCTB-24": runMCTB24,
  "MCTB-25": runMCTB25,
  "MCTB-26": runMCTB26,
  "MCTB-27": runMCTB27,
  "MCTB-28": runMCTB28,
  "MCTB-29": runMCTB29,
  "MCTB-30": runMCTB30,
  "MCTB-31": runMCTB31,
  "MCTB-32": runMCTB32,
  "MCTB-33": runMCTB33,
  "MCTB-34": runMCTB34,
  "MCTB-35": runMCTB35,
  "MCTB-36": runMCTB36,
  "MCTB-37": runMCTB37,
  "MCTB-38": runMCTB38,
  "MCTB-39": runMCTB39,
  "MCTB-40": runMCTB40,
  "MCTB-41": runMCTB41,
  "MCTB-42": runMCTB42,
  "MCTB-43": runMCTB43,
  "MCTB-44": runMCTB44,
  "MCTB-45": runMCTB45,
  "MCTB-46": runMCTB46,
  "MCTB-47": runMCTB47,
  "MCTB-48": runMCTB48,
  "MCTB-49": runMCTB49,
  "MCTB-50": runMCTB50,
  "MCTB-51": runMCTB51,
  "MCTB-52": runMCTB52,
  "MCTB-53": runMCTB53,
  "MCTB-54": runMCTB54,
  "MCTB-55": runMCTB55,
  "MCTB-56": runMCTB56,
  "MCTB-57": runMCTB57,
  "MCTB-58": runMCTB58,
};
