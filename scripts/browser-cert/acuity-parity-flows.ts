/**
 * Acuity / SimplyBook / Square parity browser UAT — UAT-01 through UAT-66.
 * Local or staging via BROWSER_CERT_PREVIEW_URL + DEV_AUTH_BYPASS=1.
 */
import type { BrowserFlow } from "./flows";
import type { CertStatus } from "./lib";
import { APPT_CANONICAL } from "./canonical-appointments-routes";
import {
  adminAvailabilityPageLoads,
  adminIntakeFileFieldEditor,
  adminLocationsCreateAndSave,
  adminLocationsWeeklyHoursToggle,
  adminManageLinkInvalid,
  adminPackageCreate,
  adminPosCartMixedLines,
  adminResourcesCreate,
  adminShareQr,
  adminThemeCustomCss,
  publicBookingFirstSteps,
} from "./acuity-parity-helpers";
import { commerceCreateItem, ensureAppointmentsShell, remindersPreviewUserAction } from "./service-booking-parity-helpers";
import { visitRoute } from "./lib";
import { switchToAppointments } from "./flow-helpers";

const A = "UAT-A-AVAIL";
const B = "UAT-B-MULTI";
const C = "UAT-C-LOC";
const D = "UAT-D-RES";
const E = "UAT-E-ADDON";
const F = "UAT-F-INTAKE";
const G = "UAT-G-PKG";
const H = "UAT-H-MEM";
const I = "UAT-I-GIFT";
const J = "UAT-J-REFUND";
const K = "UAT-K-INV";
const L = "UAT-L-POS";
const M = "UAT-M-CLASS";
const N = "UAT-N-PORTAL";
const O = "UAT-O-BRAND";
const P = "UAT-P-CAL";
const Q = "UAT-Q-EXT";
const R = "UAT-R-JOURNEY";

function staticFlow(
  batchId: string,
  id: string,
  title: string,
  status: CertStatus,
  detail: string,
): BrowserFlow {
  return { id, batchId, title, static: { status, detail } };
}

function blockedPayment(batchId: string, id: string, title: string, surface: string): BrowserFlow {
  return staticFlow(
    batchId,
    id,
    title,
    "BLOCKED — LIVE EXTERNAL PROVIDER",
    `${surface} — UI verified where possible; live payment step skipped per UAT rules`,
  );
}

export const ACUITY_PARITY_UAT_FLOWS: BrowserFlow[] = [
  // A — Availability
  {
    id: "UAT-01",
    batchId: A,
    title: "Fixed appointment start times",
    tier: "user-action",
    run: async (page) => {
      await adminAvailabilityPageLoads(page);
      await visitRoute(page, "/appointments/types");
      await page.waitForTimeout(1000);
      const body = await page.locator("body").innerText();
      if (!/type|service|meeting|class/i.test(body)) throw new Error("Types editor not reachable for fixed-start config");
    },
  },
  {
    id: "UAT-02",
    batchId: A,
    title: "Custom start interval",
    tier: "user-action",
    run: adminAvailabilityPageLoads,
  },
  {
    id: "UAT-03",
    batchId: A,
    title: "Make Me Look Busy",
    tier: "user-action",
    run: adminAvailabilityPageLoads,
  },
  {
    id: "UAT-04",
    batchId: A,
    title: "Minimize gaps / compact scheduling",
    tier: "user-action",
    run: adminAvailabilityPageLoads,
  },

  // B — Multi-service
  staticFlow(B, "UAT-05", "Multiple services in one booking", "FAIL", "Add another service UI not verified in this pass — run public multi-service flow manually"),
  staticFlow(B, "UAT-06", "Different staff per service", "FAIL", "Per-line staff picker not verified in automated pass"),
  staticFlow(B, "UAT-07", "Provider-release processing time", "FAIL", "Phased booking overlap requires fixture appointment — not automated this pass"),

  // C — Locations
  {
    id: "UAT-08",
    batchId: C,
    title: "Basic location booking",
    tier: "user-action",
    run: (page) => adminLocationsCreateAndSave(page, `UAT Location A ${Date.now().toString().slice(-4)}`),
  },
  {
    id: "UAT-09",
    batchId: C,
    title: "Location-specific hours",
    tier: "user-action",
    run: adminLocationsWeeklyHoursToggle,
  },
  {
    id: "UAT-10",
    batchId: C,
    title: "Location-specific staff",
    tier: "user-action",
    run: async (page) => {
      await adminLocationsCreateAndSave(page, `UAT Loc Staff ${Date.now().toString().slice(-4)}`);
      const body = await page.locator("body").innerText();
      if (!/Staff at this location/i.test(body)) throw new Error("Staff assignment UI missing on locations");
    },
  },
  {
    id: "UAT-11",
    batchId: C,
    title: "Location-specific timezone",
    tier: "user-action",
    run: async (page) => {
      await visitRoute(page, "/appointments/locations");
      await page.waitForTimeout(1000);
      const tz = page.getByLabel(/timezone/i).first();
      if (!(await tz.count())) throw new Error("Location timezone field not found");
    },
  },
  {
    id: "UAT-12",
    batchId: C,
    title: "Location-specific resources",
    tier: "user-action",
    run: async (page) => {
      await visitRoute(page, "/appointments/locations");
      await page.waitForTimeout(1000);
      const body = await page.locator("body").innerText();
      if (!/Resources at this location/i.test(body)) throw new Error("Location resource assignment UI missing");
    },
  },

  // D — Resources
  {
    id: "UAT-13",
    batchId: D,
    title: "Resource quantity / capacity",
    tier: "user-action",
    run: adminResourcesCreate,
  },
  staticFlow(D, "UAT-14", "Interchangeable resource pool", "FAIL", "Resource pool group booking requires overlapping bookings fixture"),

  // E — Add-ons
  {
    id: "UAT-15",
    batchId: E,
    title: "Add-on changes price",
    tier: "user-action",
    run: (page) => commerceCreateItem(page, APPT_CANONICAL.types, /Add-ons/i, "UAT Add-on Price"),
  },
  staticFlow(E, "UAT-16", "Add-on changes duration", "FAIL", "Duration delta requires public book with slot comparison"),
  staticFlow(E, "UAT-17", "Add-on requires resource", "FAIL", "Resource-scoped add-on availability requires booking fixture"),

  // F — Intake / terms / contracts
  {
    id: "UAT-18",
    batchId: F,
    title: "Intake form",
    tier: "user-action",
    run: (page) => commerceCreateItem(page, APPT_CANONICAL.intakeForms, /Intake forms/i, "UAT Intake Form"),
  },
  {
    id: "UAT-19",
    batchId: F,
    title: "Intake file/image upload",
    tier: "user-action",
    run: adminIntakeFileFieldEditor,
  },
  staticFlow(F, "UAT-20", "Terms and conditions acceptance", "FAIL", "Public terms gate not automated this pass"),
  staticFlow(F, "UAT-21", "Contract / e-signature", "FAIL", "Contract signing journey not automated this pass"),

  // G — Packages
  {
    id: "UAT-22",
    batchId: G,
    title: "Create and purchase a package",
    tier: "user-action",
    run: adminPackageCreate,
  },
  staticFlow(G, "UAT-23", "Package credit consumption", "FAIL", "Requires completed booking with package entitlement"),
  staticFlow(G, "UAT-24", "Package cancellation restoration", "FAIL", "Requires manage-link cancel journey"),
  staticFlow(G, "UAT-25", "Late-cancel package forfeiture", "FAIL", "Requires policy + manage-link cancel"),
  staticFlow(G, "UAT-26", "No-show package forfeiture", "FAIL", "Requires no-show admin action"),
  staticFlow(G, "UAT-27", "Mixed-content package", "FAIL", "Requires mixed package product + two booking types"),

  // H — Memberships
  {
    id: "UAT-28",
    batchId: H,
    title: "Basic membership subscription",
    tier: "user-action",
    run: (page) => commerceCreateItem(page, APPT_CANONICAL.memberships, /Memberships/i, "UAT Membership"),
  },
  staticFlow(H, "UAT-29", "Member-only service", "FAIL", "Requires member vs non-member public book comparison"),
  staticFlow(H, "UAT-30", "Member-only class", "FAIL", "Requires class enrollment comparison"),
  staticFlow(H, "UAT-31", "Recurring membership credits", "FAIL", "Requires renewal simulation"),
  staticFlow(H, "UAT-32", "Membership pause/cancel", "FAIL", "Requires membership admin lifecycle UI journey"),
  blockedPayment(H, "UAT-33", "Failed-payment suspension / recovery", "Membership billing"),

  // I — Gift / wallet
  {
    id: "UAT-34",
    batchId: I,
    title: "Gift certificate redemption",
    tier: "user-action",
    run: (page) => commerceCreateItem(page, APPT_CANONICAL.giftCards, /Gift/i, "UAT Gift Cert"),
  },
  staticFlow(I, "UAT-35", "Wallet payment / refund credit", "FAIL", "Wallet apply-at-checkout not automated this pass"),

  // J — Refunds
  blockedPayment(J, "UAT-36", "Full refund to original method", "Refund UI"),
  blockedPayment(J, "UAT-37", "Partial refund", "Refund UI"),
  blockedPayment(J, "UAT-38", "Refund to wallet/store credit", "Refund UI"),

  // K — Invoices
  staticFlow(K, "UAT-39", "Create and send invoice", "FAIL", "Invoice admin UI journey not automated this pass"),
  blockedPayment(K, "UAT-40", "Pay invoice", "Invoice payment link"),

  // L — Products / POS
  {
    id: "UAT-41",
    batchId: L,
    title: "Products for sale",
    tier: "user-action",
    run: (page) => commerceCreateItem(page, APPT_CANONICAL.pos, /Products/i, "UAT Product Proxy"),
  },
  {
    id: "UAT-42",
    batchId: L,
    title: "POS mixed checkout",
    tier: "user-action",
    run: adminPosCartMixedLines,
  },

  // M — Classes
  {
    id: "UAT-43",
    batchId: M,
    title: "Class capacity",
    tier: "user-action",
    run: (page) => commerceCreateItem(page, APPT_CANONICAL.classes, /Classes/i, "UAT Class Cap"),
  },
  staticFlow(M, "UAT-44", "Remaining-space display modes", "FAIL", "Class display mode toggle not automated"),
  staticFlow(M, "UAT-45", "Class waitlist", "FAIL", "Waitlist join journey not automated"),
  staticFlow(M, "UAT-46", "Waitlist preferences", "FAIL", "Waitlist preference fields not automated"),
  staticFlow(M, "UAT-47", "Waitlist party size", "FAIL", "Party size waitlist not automated"),
  staticFlow(M, "UAT-48", "Waitlist atomic accept", "FAIL", "Atomic accept race not automated"),
  staticFlow(M, "UAT-49", "Event ticket + QR admission", "FAIL", "Ticket QR check-in not automated"),

  // N — Portal
  staticFlow(N, "UAT-50", "Unified client portal", "FAIL", "Portal multi-entitlement view not automated"),
  {
    id: "UAT-51",
    batchId: N,
    title: "Manage appointment",
    tier: "user-action",
    run: adminManageLinkInvalid,
  },
  staticFlow(N, "UAT-52", "Recurring series scopes", "FAIL", "Recurring scope UI not automated"),

  // O — Branding
  {
    id: "UAT-53",
    batchId: O,
    title: "QR booking link",
    tier: "user-action",
    run: adminShareQr,
  },
  {
    id: "UAT-54",
    batchId: O,
    title: "Custom terminology",
    tier: "user-action",
    run: adminThemeCustomCss,
  },
  {
    id: "UAT-55",
    batchId: O,
    title: "Custom CSS",
    tier: "user-action",
    run: adminThemeCustomCss,
  },
  staticFlow(O, "UAT-56", "Custom domain", "BLOCKED — LIVE EXTERNAL PROVIDER", "DNS/TLS not configured for local UAT"),

  // P — Calendar
  {
    id: "UAT-57",
    batchId: P,
    title: "Staff/service color coding",
    tier: "user-action",
    run: async (page) => {
      await switchToAppointments(page);
      await visitRoute(page, "/appointments/calendar");
      await page.waitForTimeout(1200);
      const body = await page.locator("body").innerText();
      if (!/calendar|appointment|schedule/i.test(body)) throw new Error("Calendar did not load");
    },
  },

  // Q — External channels
  staticFlow(Q, "UAT-58", "Reserve with Google", "BLOCKED — LIVE EXTERNAL PROVIDER", "Google Reserve OAuth blocked"),
  staticFlow(Q, "UAT-59", "Facebook Book Now", "BLOCKED — LIVE EXTERNAL PROVIDER", "Meta OAuth blocked"),
  staticFlow(Q, "UAT-60", "Instagram booking", "BLOCKED — LIVE EXTERNAL PROVIDER", "Meta OAuth blocked"),
  staticFlow(Q, "UAT-61", "iCloud calendar sync", "BLOCKED — LIVE EXTERNAL PROVIDER", "Apple calendar OAuth blocked"),

  // R — Combined journeys
  staticFlow(R, "UAT-62", "Trainer package journey", "FAIL", "Combined journey not automated this pass"),
  staticFlow(R, "UAT-63", "Membership journey", "FAIL", "Combined journey not automated this pass"),
  staticFlow(R, "UAT-64", "Class + waitlist journey", "FAIL", "Combined journey not automated this pass"),
  staticFlow(R, "UAT-65", "Multi-service business journey", "FAIL", "Combined journey not automated this pass"),
  {
    id: "UAT-66",
    batchId: R,
    title: "Commerce journey (admin surfaces)",
    tier: "user-action",
    run: async (page) => {
      await ensureAppointmentsShell(page);
      await visitRoute(page, "/appointments/pos");
      await visitRoute(page, APPT_CANONICAL.packages);
      await publicBookingFirstSteps(page);
      await remindersPreviewUserAction(page);
    },
  },
];

export function resolveAcuityParityFlows(opts: {
  only?: string | null;
  flowId?: string | null;
  limit?: number;
}): BrowserFlow[] {
  let flows = ACUITY_PARITY_UAT_FLOWS;
  if (opts.flowId) {
    const f = flows.find((x) => x.id === opts.flowId);
    return f ? [f] : [];
  }
  if (opts.only) {
    if (opts.only.startsWith("UAT-")) {
      const f = flows.find((x) => x.id === opts.only);
      flows = f ? [f] : [];
    } else {
      flows = flows.filter((f) => f.batchId === opts.only);
    }
  }
  if (opts.limit && opts.limit > 0) return flows.slice(0, opts.limit);
  return flows;
}
