/**
 * Service-booking parity browser UAT flows (color pilot → master).
 * One disposable Chromium per flow — hits https://transovo.ai only.
 */
import type { BrowserFlow } from "./flows";
import type { CertStatus } from "./lib";
import {
  commerceCreateItem,
  commerceTabReadOnly,
  invalidPublicTokenSurfaces,
  overviewPilotAndSearch,
  publicSurfacesWithSlug,
  remindersPreviewUserAction,
  segmentsPageUserAction,
  shareEmbedHubUserAction,
  typeEditorSectionsVisible,
  typesArchetypePickerVisible,
} from "./service-booking-parity-helpers";
import { visitRoute } from "./lib";
import { switchToAppointments } from "./flow-helpers";
import { ensureAppointmentsShell } from "./service-booking-parity-helpers";

const B1 = "SB-BATCH-01";
const B2 = "SB-BATCH-02";
const B3 = "SB-BATCH-03";
const B4 = "SB-BATCH-04";
const B5 = "SB-BATCH-05";
const B6 = "SB-BATCH-06";

import type { CertStatus } from "./lib";

function staticFlow(batchId: string, id: string, status: CertStatus, detail: string): BrowserFlow {
  return { id, batchId, static: { status, detail } };
}

export const SERVICE_BOOKING_UAT_FLOWS: BrowserFlow[] = [
  // §1 Overview & shell
  { id: "SB-01", batchId: B1, tier: "user-action", run: overviewPilotAndSearch },

  // §2 Booking type archetypes
  { id: "SB-02", batchId: B1, tier: "user-action", run: typesArchetypePickerVisible },

  // §3 Type editor sections
  { id: "SB-03", batchId: B1, tier: "user-action", run: typeEditorSectionsVisible },

  // §4 Commerce hub — create flows
  {
    id: "SB-04",
    batchId: B2,
    tier: "user-action",
    run: (page) => commerceCreateItem(page, "/appointments/commerce", /Packages/i, "UAT Package"),
  },
  {
    id: "SB-05",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(page, "/appointments/commerce", /Memberships/i, "UAT Membership"),
  },
  {
    id: "SB-06",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(page, "/appointments/commerce", /Gift certificates/i, "UAT Gift"),
  },
  {
    id: "SB-07",
    batchId: B2,
    tier: "user-action",
    run: (page) => commerceCreateItem(page, "/appointments/commerce", /Coupons/i, "UAT Coupon"),
  },
  {
    id: "SB-08",
    batchId: B2,
    tier: "user-action",
    run: (page) => commerceCreateItem(page, "/appointments/commerce", /Add-ons/i, "UAT Add-on"),
  },
  {
    id: "SB-09",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(page, "/appointments/resources", /Resources/i, "UAT Resource"),
  },
  {
    id: "SB-10",
    batchId: B2,
    tier: "user-action",
    run: (page) => commerceCreateItem(page, "/appointments/classes", /Classes/i, "UAT Class"),
  },
  {
    id: "SB-11",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(page, "/appointments/commerce", /Programs/i, "UAT Program"),
  },
  {
    id: "SB-12",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(page, "/appointments/commerce", /Payment plans/i, /payment|plan|installment/i),
  },
  {
    id: "SB-13",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(page, "/appointments/commerce", /Processing phases/i, /phase|processing/i),
  },
  {
    id: "SB-14",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(page, "/appointments/commerce", /Households/i, "UAT Household"),
  },
  {
    id: "SB-15",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(
        page,
        "/appointments/client-restrictions",
        /Client restrictions/i,
        "UAT Restriction",
      ),
  },
  {
    id: "SB-16",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceCreateItem(page, "/appointments/commerce", /Intake forms/i, "UAT Intake"),
  },
  {
    id: "SB-17",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(page, "/appointments/commerce", /Webhooks/i, /webhook|endpoint|url/i),
  },
  {
    id: "SB-18",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(
        page,
        "/appointments/commerce",
        /Scheduler branding/i,
        /theme|branding|css|terminology/i,
      ),
  },
  {
    id: "SB-19",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(page, "/appointments/reports/service-booking", /Reports/i, /report|export|csv/i),
  },
  {
    id: "SB-20",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(
        page,
        "/appointments/commerce",
        /Import \/ export/i,
        /import|export|csv/i,
      ),
  },
  {
    id: "SB-21",
    batchId: B2,
    tier: "user-action",
    run: (page) =>
      commerceTabReadOnly(page, "/appointments/categories", /Categories/i, /categor/i),
  },

  // §5 Share & embed
  { id: "SB-22", batchId: B3, tier: "user-action", run: shareEmbedHubUserAction },

  // §6 Public customer surfaces
  { id: "SB-23", batchId: B3, tier: "user-action", run: publicSurfacesWithSlug },
  { id: "SB-24", batchId: B3, tier: "user-action", run: invalidPublicTokenSurfaces },

  // §7 Segments
  { id: "SB-25", batchId: B3, tier: "user-action", run: segmentsPageUserAction },

  // §8 Thin / API parity — documented skips (not browser-crash bait)
  staticFlow(
    B4,
    "SB-26",
    "SKIPPED",
    "Fixed start times — config JSON only; availability engine covered by public book flow",
  ),
  staticFlow(B4, "SB-27", "SKIPPED", "Make Me Look Busy — API/config only"),
  staticFlow(B4, "SB-28", "SKIPPED", "Formal contracts + e-sign — API only"),
  staticFlow(B4, "SB-29", "SKIPPED", "Invoices — API only"),
  staticFlow(
    B4,
    "SB-30",
    "BLOCKED — LIVE EXTERNAL PROVIDER",
    "Booking channels (Google/Facebook/Instagram) — OAuth blocked",
  ),
  staticFlow(
    B4,
    "SB-31",
    "BLOCKED — LIVE EXTERNAL PROVIDER",
    "iCloud calendar sync — provider blocked",
  ),

  // §9 Recurring preview + reminders
  {
    id: "SB-32",
    batchId: B5,
    tier: "user-action",
    run: async (page) => {
      await ensureAppointmentsShell(page);
      await visitRoute(page, "/appointments/types");
      await page.waitForTimeout(1200);
      const body = await page.locator("body").innerText();
      if (!/recurr|repeat|series|advanced/i.test(body)) {
        throw new Error("Recurrence / advanced settings not visible on type editor");
      }
    },
  },
  { id: "SB-33", batchId: B5, tier: "user-action", run: remindersPreviewUserAction },

  // §10 Core admin routes from cheat sheet
  {
    id: "SB-34",
    batchId: B6,
    tier: "user-action",
    run: async (page) => {
      await switchToAppointments(page);
      for (const path of [
        "/appointments/booking",
        "/appointments/setup",
        "/appointments/calendar",
        "/appointments",
        "/contacts",
        "/conversations",
        "/appointments/analytics",
      ]) {
        await visitRoute(page, path);
        await page.waitForTimeout(600);
      }
    },
  },
];

export const SERVICE_BOOKING_UAT_BATCHES = [
  { id: B1, title: "Overview, types, editor" },
  { id: B2, title: "Commerce hub CRUD" },
  { id: B3, title: "Share, public surfaces, segments" },
  { id: B4, title: "API-only / provider-blocked (static)" },
  { id: B5, title: "Recurrence + reminders" },
  { id: B6, title: "Core admin smoke navigation" },
] as const;

export function resolveServiceBookingUatFlows(opts: {
  only?: string | null;
  flowId?: string | null;
  limit?: number;
}): BrowserFlow[] {
  let flows = SERVICE_BOOKING_UAT_FLOWS;
  if (opts.flowId) {
    const f = flows.find((x) => x.id === opts.flowId);
    return f ? [f] : [];
  }
  if (opts.only) {
    if (opts.only.startsWith("SB-BATCH-")) {
      flows = flows.filter((f) => f.batchId === opts.only);
    } else {
      const f = flows.find((x) => x.id === opts.only);
      flows = f ? [f] : [];
    }
  }
  if (opts.limit && opts.limit > 0) return flows.slice(0, opts.limit);
  return flows;
}
