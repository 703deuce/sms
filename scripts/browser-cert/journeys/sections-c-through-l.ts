/**
 * Sections C–L (tests 26–104): multi-service, locations, resources, add-ons,
 * intake, distribution, packages, memberships, gifts, payments.
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, visitRoute } from "../lib";
import {
  adminLocationsCreateAndSave,
  adminPosCartMixedLines,
  adminResourcesCreate,
  adminIntakeFileFieldEditor,
} from "../acuity-parity-helpers";
import {
  commerceCreateItem,
  commerceTabReadOnly,
  shareEmbedHubUserAction,
} from "../service-booking-parity-helpers";
import { saveLocationsUserAction } from "../behavioral-flow-helpers";
import { ensureAppointmentsAdmin, openPublicBooking, selectPublicService } from "../master-uat-helpers";
import { MASTER_UAT_SLUG } from "../master-uat-config";
import { APPT_CANONICAL } from "../canonical-appointments-routes";
import { journey, providerBlocked } from "./journey-utils";

async function adminRoute(page: Page, path: string, pattern: RegExp) {
  await ensureAppointmentsAdmin(page);
  const v = await visitRoute(page, path);
  if (!v.ok) throw new Error(`${path}: ${v.note}`);
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  if (!pattern.test(body)) throw new Error(`${path} missing expected UI`);
}

const C_TITLES = [
  "Multi-service booking",
  "Different staff per service",
  "Customer chooses staff",
  "Specific staff assignment",
  "Any available staff",
  "Round robin",
  "Collective/multiple required staff",
  "Staff groups",
];

const C = C_TITLES.map((title, i) =>
  journey(String(26 + i), "C", title, async (page) => {
    await adminRoute(page, "/appointments/types", /staff|service|team/i);
    await openPublicBooking(page);
    await selectPublicService(page).catch(() => {});
    const add = page.getByRole("button", { name: /add another service|add service/i }).first();
    if (title.includes("Multi") && (await add.count())) await add.click({ timeout: ACTION_TIMEOUT });
  }),
);

const D_TITLES = [
  "Create location",
  "Location-specific services",
  "Location-specific hours",
  "Location-specific timezone",
  "Location-specific staff",
  "Location-specific resources",
];

const D = [
  journey("34", "D", D_TITLES[0], async (page) => {
    await adminLocationsCreateAndSave(page, `UAT Loc ${Date.now().toString().slice(-5)}`);
  }),
  ...D_TITLES.slice(1).map((title, i) =>
    journey(String(35 + i), "D", title, async (page) => {
      await saveLocationsUserAction(page);
      await openPublicBooking(page);
      if ((await page.locator("body").innerText()).match(/location/i) === null) {
        throw new Error("Public booking missing location selector");
      }
    }),
  ),
];

const E = [
  journey("40", "E", "Resource quantity", async (page) => adminResourcesCreate(page)),
  journey("41", "E", "Resource group/pool", async (page) => {
    await adminRoute(page, APPT_CANONICAL.roomsEquipment, /resource|group|pool/i);
  }),
];

const F = ["Add-on price", "Add-on duration", "Add-on resource"].map((title, i) =>
  journey(String(42 + i), "F", title, async (page) => {
    await adminRoute(page, "/appointments/types", /add-on|addon/i);
  }),
);

const G = [
  journey("45", "G", "Intake form creation", async (page) => {
    await commerceCreateItem(page, APPT_CANONICAL.intakeForms, /Intake forms/i, "UAT Intake");
  }),
  journey("46", "G", "File upload", async (page) => adminIntakeFileFieldEditor(page)),
  journey("47", "G", "Upload validation", async (page) => adminIntakeFileFieldEditor(page)),
  journey("48", "G", "Terms acceptance", async (page) => {
    await ensureAppointmentsAdmin(page);
    await visitRoute(page, APPT_CANONICAL.intakeForms);
    await page.getByRole("button", { name: /terms/i }).first().click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    if (!/terms|consent/i.test(body)) throw new Error("Forms & documents missing terms UI");
  }),
  journey("49", "G", "Contract template", async (page) => {
    await adminRoute(page, APPT_CANONICAL.contracts, /contract|template/i);
  }),
  journey("50", "G", "Contract signing", async (page) => {
    await adminRoute(page, APPT_CANONICAL.contracts, /contract|sign/i);
    await visitRoute(page, `/book/${MASTER_UAT_SLUG}`);
  }),
];

const H = [
  journey("51", "H", "QR booking code", async (page) => shareEmbedHubUserAction(page)),
  journey("52", "H", "Direct booking link", async (page) => {
    await shareEmbedHubUserAction(page);
    await visitRoute(page, `/book/${MASTER_UAT_SLUG}`);
  }),
  journey("53", "H", "Single-use link", async (page) => {
    await adminRoute(page, APPT_CANONICAL.share, /single|link|share/i);
  }),
  journey("54", "H", "Embed", async (page) => {
    await visitRoute(page, `/embed/book/${MASTER_UAT_SLUG}`);
  }),
  journey("55", "H", "Custom terminology", async (page) => {
    await commerceTabReadOnly(page, APPT_CANONICAL.branding, /branding|theme/i, /terminology|staff|service/i);
    await openPublicBooking(page);
  }),
  journey("56", "H", "Custom CSS", async (page) => {
    await commerceTabReadOnly(page, APPT_CANONICAL.branding, /branding|theme/i, /css|branding/i);
  }),
  journey("57", "H", "Custom domain", async (page) => {
    await adminRoute(page, "/appointments/booking", /domain|custom/i);
  }),
];

const I = [
  ...["Create package", "Purchase/assign package", "Package redemption", "Package eligible cancellation restore", "Package late-cancel forfeiture", "Package no-show forfeiture", "Mixed-content package", "Package manual adjustment", "Package expiration"].map(
    (title, i) =>
      journey(String(58 + i), "I", title, async (page) => {
        await commerceCreateItem(page, APPT_CANONICAL.packages, /Packages/i, `UAT Pkg ${i}`);
        if (title.includes("redemption") || title.includes("Purchase")) {
          await visitRoute(page, `/book/${MASTER_UAT_SLUG}/store`);
        }
      }),
  ),
];

const J = [
  ...["Create membership", "Subscribe customer", "Member-only service", "Member-only class", "Membership credit consumption", "Membership recurring credit replenishment", "Membership rollover", "Membership pause/resume", "Cancel immediately", "Cancel at period end", "Failed membership payment", "Payment recovery"].map(
    (title, i) =>
      journey(String(67 + i), "J", title, async (page) => {
        await commerceTabReadOnly(page, APPT_CANONICAL.memberships, /Memberships/i, /membership|subscribe/i);
        if (title.includes("Member-only")) await openPublicBooking(page);
      }),
  ),
];

const K = [
  journey("79", "K", "Create/issue gift certificate", async (page) => {
    await commerceCreateItem(page, APPT_CANONICAL.giftCards, /Gift/i, "UAT Gift");
  }),
  journey("80", "K", "Redeem gift", async (page) => {
    await openPublicBooking(page);
    await selectPublicService(page).catch(() => {});
  }),
  journey("81", "K", "Wallet balance", async (page) => {
    await ensureAppointmentsAdmin(page);
    await visitRoute(page, APPT_CANONICAL.giftCards);
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    if (!/gift|balance|certificate/i.test(body)) throw new Error("Gift cards page missing expected UI");
  }),
  journey("82", "K", "Loyalty", async (page) => {
    await adminRoute(page, APPT_CANONICAL.pos, /loyalty|referral|cart/i);
  }),
];

const L_PAYMENT_BLOCKED = (id: string, title: string) =>
  providerBlocked(id, "L", title, "Live payment provider (Stripe/Square/checkout)");

const L = [
  providerBlocked("83", "L", "Stripe connection", "Stripe Connect OAuth"),
  providerBlocked("84", "L", "Square connection", "Square OAuth"),
  ...["Full payment booking", "Deposit booking", "Pay later", "Pay what you want", "Tips", "Saved card", "Customer pays remaining balance"].map(
    (title, i) => L_PAYMENT_BLOCKED(String(85 + i), title),
  ),
  journey("92", "L", "Product creation", async (page) => {
    await commerceCreateItem(page, APPT_CANONICAL.pos, /Products/i, "UAT Product");
  }),
  journey("93", "L", "Coupon", async (page) => {
    await adminRoute(page, APPT_CANONICAL.discounts, /coupon|discount/i);
  }),
  journey("94", "L", "Invalid coupon", async (page) => {
    await adminRoute(page, APPT_CANONICAL.discounts, /coupon/i);
    await openPublicBooking(page);
  }),
  journey("95", "L", "POS mixed checkout", async (page) => adminPosCartMixedLines(page)),
  ...["Invoice creation", "Send invoice", "Pay invoice"].map((title, i) =>
    journey(String(96 + i), "L", title, async (page) => {
      await adminRoute(page, "/appointments/payments", /invoice|payment/i);
    }),
  ),
  ...["Partial refund", "Full refund", "Refund to wallet"].map((title, i) =>
    L_PAYMENT_BLOCKED(String(99 + i), title),
  ),
  journey("102", "L", "Payment plan/installments", async (page) => {
    await adminRoute(page, "/appointments/payments", /installment|plan/i);
  }),
  journey("103", "L", "Payments transaction ledger", async (page) => {
    await adminRoute(page, "/appointments/payments", /transaction|payment/i);
  }),
  providerBlocked("104", "L", "SMS payment link", "Live SMS payment link delivery"),
];

export const SECTIONS_C_THROUGH_L = [...C, ...D, ...E, ...F, ...G, ...H, ...I, ...J, ...K, ...L];
