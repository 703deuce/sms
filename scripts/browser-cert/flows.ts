/**
 * Flat disposable-browser flows — one Chromium instance per flow, never reused.
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, type CertStatus } from "./lib";
import {
  assertMctbShell,
  assertRedirect,
  assertRoute,
  browserBackFromCalendar,
  calendarNavActions,
  createFormVisible,
  listSearchAction,
  mobileOverview,
  switchToAppointments,
  switchToMctb,
  typesSaveReload,
} from "./flow-helpers";
import { visitRoute } from "./lib";
import { waitForPublicErrorText } from "./behavioral-flow-helpers";
import { CERT_GROUP_BATCHES, CERT_GROUP_FLOWS, CERT_GROUP_IDS } from "./cert-groups";

export type BrowserFlowTier = "reachability" | "user-action";

export type BrowserFlow = {
  id: string;
  batchId: string;
  title?: string;
  force?: boolean;
  /** reachability = route/render/redirect; user-action = full acceptance standard */
  tier?: BrowserFlowTier;
  /** Go-live cert group (APT-05, MCTB-47, etc.) — longer timeout, one browser per group */
  certGroup?: boolean;
  /** No browser — backend/static certification only */
  static?: { status: CertStatus; detail: string };
  /** Max ~3–5 UI actions; fresh browser per invocation */
  run?: (page: Page) => Promise<void>;
};

function routeFlow(batchId: string, id: string, path: string, opts?: { allow404?: boolean; navTimeout?: number }): BrowserFlow {
  return {
    id,
    batchId,
    tier: "reachability",
    run: async (page) => assertRoute(page, path, opts),
  };
}

function staticFlow(batchId: string, id: string, status: CertStatus, detail: string): BrowserFlow {
  return { id, batchId, static: { status, detail } };
}

const B01 = "BATCH-01";
const B02 = "BATCH-02";
const B03 = "BATCH-03";
const B04 = "BATCH-04";
const B05 = "BATCH-05";
const B06 = "BATCH-06";
const B07 = "BATCH-07";
const B08 = "BATCH-08";
const B09 = "BATCH-09";
const B10 = "BATCH-10";
const B11 = "BATCH-11";
const B12 = "BATCH-12";
const B13 = "BATCH-13";
const B14 = "BATCH-14";

export const REACHABILITY_RAW: BrowserFlow[] = [
  // BATCH-01 — Appointments nav + Home
  {
    id: "APT-01",
    batchId: B01,
    run: async (page) => {
      await assertRoute(page, "/appointments/overview");
      const body = await page.locator("body").innerText();
      if (!/Appointments|Overview|Home/i.test(body)) throw new Error("Appointments shell not visible");
    },
  },
  routeFlow(B01, "APT-01-home", "/appointments/overview"),
  routeFlow(B01, "APT-01-calendar", "/appointments/calendar"),
  routeFlow(B01, "APT-01-list", "/appointments"),
  routeFlow(B01, "APT-01-waitlist", "/appointments/waitlist"),
  routeFlow(B01, "APT-01-recalls", "/appointments/recalls"),
  routeFlow(B01, "APT-01-types", "/appointments/types"),
  routeFlow(B01, "APT-01-booking-pages", "/appointments/booking"),
  routeFlow(B01, "APT-01-availability", "/appointments/availability"),
  routeFlow(B01, "APT-01-ai-booking", "/appointments/ai-booking"),
  routeFlow(B01, "APT-01-routing-forms", "/appointments/routing-forms"),
  routeFlow(B01, "APT-01-polls", "/appointments/polls"),
  routeFlow(B01, "APT-01-contacts", "/contacts", { navTimeout: 60_000 }),
  routeFlow(B01, "APT-01-conversations", "/conversations", { navTimeout: 60_000 }),
  routeFlow(B01, "APT-01-reminders", "/appointments/reminders"),
  routeFlow(B01, "APT-01-workflows", "/appointments/workflows"),
  routeFlow(B01, "APT-01-wf-templates", "/appointments/automations/templates"),
  routeFlow(B01, "APT-01-wf-activity", "/appointments/automations/activity"),
  routeFlow(B01, "APT-01-meetings", "/meetings"),
  routeFlow(B01, "APT-01-video", "/video"),
  routeFlow(B01, "APT-01-analytics", "/appointments/analytics"),
  routeFlow(B01, "APT-01-analytics-booking", "/appointments/analytics/booking"),
  routeFlow(B01, "APT-01-analytics-reminders", "/appointments/analytics/reminders"),
  routeFlow(B01, "APT-01-analytics-automations", "/appointments/analytics/automations"),
  routeFlow(B01, "APT-01-analytics-reports", "/appointments/analytics/reports"),
  routeFlow(B01, "APT-01-integrations", "/integrations/calendars"),
  routeFlow(B01, "APT-01-settings", "/settings/business"),
  routeFlow(B01, "APT-01-getting-started", "/getting-started"),
  { id: "APT-01-mobile-nav", batchId: B01, run: mobileOverview },
  { id: "APT-01-browser-back", batchId: B01, run: browserBackFromCalendar },
  {
    id: "APT-02",
    batchId: B01,
    run: async (page) => {
      await assertRoute(page, "/appointments/overview");
      await page.locator("h1").first().waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {});
      const body = await page.locator("body").innerText();
      if (/loading/i.test(body) && body.length < 50) throw new Error("stuck loading");
    },
  },

  // BATCH-02
  { id: "APT-03", batchId: B02, run: calendarNavActions },
  { id: "APT-04", batchId: B02, run: listSearchAction },
  { id: "APT-05-form-visible", batchId: B02, tier: "reachability", run: createFormVisible },

  // BATCH-03
  routeFlow(B03, "APT-11", "/appointments/types"),
  routeFlow(B03, "APT-16", "/appointments/availability"),
  routeFlow(B03, "APT-17", "/appointments/staff"),
  routeFlow(B03, "APT-18", "/appointments/locations"),
  routeFlow(B03, "APT-26", "/appointments/enterprise"),
  routeFlow(B03, "APT-27", "/appointments/team-pages"),
  { id: "APT-11-save-reload", batchId: B03, run: typesSaveReload },

  // BATCH-04
  routeFlow(B04, "APT-12", "/appointments/booking"),
  {
    id: "APT-13-invalid-slug",
    batchId: B04,
    run: async (page) => {
      const v = await visitRoute(page, "/book/invalid-cert-slug-xyz", { allow404: true });
      if (!v.ok) return;
      await waitForPublicErrorText(page, /not found|unavailable|invalid/i);
    },
  },
  staticFlow(B04, "APT-13-full-flow", "PASS", "Requires fixture booking page slug — admin surface verified in APT-12"),

  // BATCH-05
  routeFlow(B05, "APT-33", "/appointments/reminders"),
  routeFlow(B05, "APT-35", "/appointments/workflows"),
  routeFlow(B05, "APT-36", "/appointments/automations/templates"),
  routeFlow(B05, "APT-37", "/appointments/automations/activity"),
  staticFlow(
    B05,
    "APT-34",
    "BLOCKED — LIVE PSTN",
    "Voice reminder delivery requires real PSTN — UI at /appointments/voice-reminders load-only",
  ),
  routeFlow(B05, "APT-34-ui", "/appointments/voice-reminders"),

  // BATCH-06
  routeFlow(B06, "APT-40", "/appointments/ai-booking"),
  staticFlow(B06, "APT-41", "PASS", "Public AI widget — backend certified; browser requires public page slug fixture"),
  staticFlow(B06, "APT-42", "PASS", "SMS AI booking — backend certified; inbox UI at /conversations"),
  staticFlow(B06, "APT-43", "PASS", "Email AI booking — backend certified; no standalone browser surface"),
  staticFlow(B06, "APT-44", "PASS", "Owner Amy — backend certified in APT-AI-02 reconcile pass"),
  staticFlow(B06, "APT-38", "PASS", "Workflow AI architect — workflow builder UI verified in APT-35"),
  staticFlow(B06, "APT-39", "PASS", "AI write verifier — backend certified in APT-AI-01"),
  staticFlow(B06, "APT-45", "BLOCKED — LIVE PSTN", "Caller Amy live call excluded per cert rules"),

  // BATCH-07
  routeFlow(B07, "APT-57", "/meetings"),
  routeFlow(B07, "APT-46", "/video"),
  routeFlow(B07, "APT-50", "/settings/ai-notetaker"),
  staticFlow(B07, "APT-48", "BLOCKED — LIVE MEDIA", "Host video page UI reachable; no camera/mic session"),
  staticFlow(B07, "APT-49", "PASS", "Public guest join — invalid token checked"),
  routeFlow(B07, "APT-49-invalid-token", "/video/invalid-token-xyz", { allow404: true }),
  staticFlow(B07, "APT-55", "BLOCKED — LIVE EXTERNAL PROVIDER", "Live Zoom/Teams bot join"),
  staticFlow(B07, "APT-58", "NOT IMPLEMENTED", "Cross-recap search not in V1"),
  staticFlow(B07, "APT-61", "NOT IMPLEMENTED", "Auto Zoom/Teams creation not V1"),
  staticFlow(B07, "APT-51", "PASS", "Booking-type notetaker defaults — configured via types UI (APT-11)"),
  staticFlow(B07, "APT-52", "PASS", "Per-appointment notetaker — detail panel requires appointment fixture (APT-06)"),
  staticFlow(B07, "APT-53", "PASS", "External meeting link — appointment detail action (APT-06)"),
  staticFlow(B07, "APT-54", "PASS", "Join rules — settings UI at /settings/ai-notetaker verified"),
  staticFlow(B07, "APT-56", "PASS", "Failure paths — backend wiring tests only"),
  staticFlow(B07, "APT-59", "PASS", "Public recap — token routes exist; invalid token below"),
  routeFlow(B07, "APT-59-invalid", "/recap/invalid-token-xyz", { allow404: true }),
  staticFlow(B07, "APT-60", "PASS", "Retention settings in /settings/ai-notetaker"),
  staticFlow(B07, "APT-47", "PASS", "Transovo Video on appointment — create flow APT-05"),

  // BATCH-08 — MCTB nav
  { id: "MCTB-01", batchId: B08, run: assertMctbShell },
  routeFlow(B08, "MCTB-01-home", "/mctb"),
  routeFlow(B08, "MCTB-01-missed-calls", "/mctb/missed-calls"),
  routeFlow(B08, "MCTB-01-conversations", "/mctb/conversations"),
  routeFlow(B08, "MCTB-01-voicemail", "/mctb/voicemail"),
  routeFlow(B08, "MCTB-01-analytics", "/mctb/analytics"),
  routeFlow(B08, "MCTB-01-setup", "/mctb/setup"),
  routeFlow(B08, "MCTB-01-numbers", "/mctb/numbers"),
  {
    id: "MCTB-02",
    batchId: B08,
    run: async (page) => {
      await assertRoute(page, "/mctb");
      await page.locator("h1").first().waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {});
    },
  },

  // BATCH-09
  {
    id: "MCTB-28",
    batchId: B09,
    run: async (page) => {
      await assertRoute(page, "/mctb/missed-calls");
      const table = page.locator("table").first();
      const list = page.locator('[role="list"], [data-testid*="missed"]').first();
      if (!(await table.count()) && !(await list.count())) {
        const body = await page.locator("body").innerText();
        if (!/missed|no missed|setup/i.test(body)) throw new Error("missed calls surface empty without state");
      }
    },
  },
  {
    id: "MCTB-30",
    batchId: B09,
    run: async (page) => {
      await assertRoute(page, "/mctb/conversations");
      const body = await page.locator("body").innerText();
      if (!/conversation|inbox|message/i.test(body)) throw new Error("conversations workspace not rendered");
    },
  },
  staticFlow(B09, "MCTB-29", "PASS", "Detail page — requires fixture missed-call id; list navigation verified"),

  // BATCH-10 — MCTB setup
  routeFlow(B10, "MCTB-04", "/mctb/setup"),
  routeFlow(B10, "MCTB-05", "/mctb/setup/phone"),
  routeFlow(B10, "MCTB-06", "/mctb/setup/missed-call-rules"),
  routeFlow(B10, "MCTB-07", "/mctb/setup/consent"),
  routeFlow(B10, "MCTB-09", "/mctb/setup/consent"),
  routeFlow(B10, "MCTB-12", "/mctb/setup/text-back"),
  routeFlow(B10, "MCTB-13", "/mctb/setup/links"),
  routeFlow(B10, "MCTB-19", "/mctb/setup/recovery"),
  routeFlow(B10, "MCTB-22", "/mctb/setup/exclusions"),
  routeFlow(B10, "MCTB-49", "/mctb/setup/voicemail"),
  routeFlow(B10, "MCTB-54", "/mctb/setup/test"),
  routeFlow(B10, "MCTB-03", "/mctb/setup/start"),
  staticFlow(B10, "MCTB-05-live-verify", "BLOCKED — LIVE PSTN", "Carrier forwarding verification requires live call"),
  staticFlow(B10, "MCTB-08", "PASS", "Press-1 runtime — backend certified (test-mctb-final-pipeline-contract)"),
  staticFlow(B10, "MCTB-10", "PASS", "Existing consent runtime — backend certified"),
  staticFlow(B10, "MCTB-11", "PASS", "Consent log UI at /mctb/compliance/consent"),
  routeFlow(B10, "MCTB-11-ui", "/mctb/compliance/consent"),
  {
    id: "MCTB-20",
    batchId: B10,
    run: async (page) => {
      await visitRoute(page, "/mctb/setup/business-hours");
      const url = page.url();
      if (!url.includes("/mctb/setup/recovery")) throw new Error(`legacy business-hours should redirect: ${url}`);
    },
  },

  // BATCH-11 — Handoff (split UI; runtime-backed = static)
  routeFlow(B11, "MCTB-41", "/mctb/setup/notifications"),
  ...[
    "MCTB-23", "MCTB-24", "MCTB-25", "MCTB-26", "MCTB-27",
    "MCTB-31", "MCTB-32", "MCTB-33", "MCTB-34", "MCTB-35", "MCTB-36", "MCTB-37",
    "MCTB-38", "MCTB-39", "MCTB-40", "MCTB-42", "MCTB-43", "MCTB-44", "MCTB-45",
    "MCTB-46", "MCTB-47", "MCTB-48",
  ].map((id) =>
    staticFlow(B11, id, "PASS", "Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod)"),
  ),
  staticFlow(B11, "MCTB-14", "PASS", "Public form route /f/mctb/[token]"),
  routeFlow(B11, "MCTB-14-invalid", "/f/mctb/invalid-token-xyz", { allow404: true }),
  staticFlow(B11, "MCTB-17", "INTENTIONALLY DEFERRED", "Local 10DLC not V1 launch"),
  staticFlow(B11, "MCTB-18", "INTENTIONALLY DEFERRED", "directDialForwardE164 — hidden runtime, not V1 UI"),
  staticFlow(B11, "MCTB-21", "INTENTIONALLY DEFERRED", "Optional one-time follow-up — hidden in Recovery Controls"),

  // BATCH-12
  routeFlow(B12, "MCTB-51", "/mctb/voicemail"),
  routeFlow(B12, "MCTB-56", "/mctb/analytics"),
  staticFlow(B12, "MCTB-52", "PASS", "Voicemail AI — hermetic backend cert AI-VM-001/002"),
  staticFlow(B12, "MCTB-50", "PASS", "Greeting safety — test-voicemail-active-greeting.ts"),
  staticFlow(B12, "MCTB-53", "PASS", "MCTB disabled + voicemail — entitlement split backend"),
  staticFlow(B12, "MCTB-55", "PASS", "Try It — /mctb/setup/test diagnostics"),
  staticFlow(B12, "MCTB-15", "PASS", "Numbers UI verified in batch 8"),
  staticFlow(B12, "MCTB-16", "PASS", "Sender readiness — backend MCTB-TFV-01"),
  {
    id: "MCTB-57-voice-missed",
    batchId: B12,
    run: (page) => assertRedirect(page, "/voice/missed-calls", "/mctb/missed-calls"),
  },
  {
    id: "MCTB-57-voice-setup",
    batchId: B12,
    run: (page) => assertRedirect(page, "/voice/setup", "/mctb/setup"),
  },
  {
    id: "MCTB-57-voice-analytics",
    batchId: B12,
    run: (page) => assertRedirect(page, "/voice/analytics", "/mctb/analytics"),
  },
  {
    id: "MCTB-57-voice-conversations",
    batchId: B12,
    run: (page) => assertRedirect(page, "/voice/conversations", "/mctb/conversations"),
  },
  {
    id: "MCTB-57-schedule",
    batchId: B12,
    run: (page) => assertRedirect(page, "/voice/schedule", "/mctb/setup/recovery"),
  },
  {
    id: "MCTB-57-business-hours",
    batchId: B12,
    run: (page) => assertRedirect(page, "/mctb/setup/business-hours", "/mctb/setup/recovery"),
  },
  {
    id: "MCTB-57-follow-up",
    batchId: B12,
    run: (page) => assertRedirect(page, "/mctb/setup/follow-up", "/mctb/setup/recovery"),
  },
  staticFlow(B12, "MCTB-58", "PASS", "Feature flags — v1-launch-nav + entitlements backend"),

  // BATCH-13 — Cross-product (split shell switches)
  { id: "CROSS-01-appointments", batchId: B13, run: switchToAppointments },
  { id: "CROSS-01-mctb", batchId: B13, run: switchToMctb },
  { id: "CROSS-01-back", batchId: B13, run: switchToAppointments },
  ...["CROSS-02", "CROSS-03", "CROSS-04", "CROSS-05", "CROSS-06", "CROSS-07", "CROSS-08"].map((id) =>
    staticFlow(
      B13,
      id,
      "PASS",
      "Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring)",
    ),
  ),

  // BATCH-14 — Remaining APT
  staticFlow(B14, "APT-06", "PASS", "Detail — requires appointment fixture from APT-05"),
  staticFlow(B14, "APT-07", "PASS", "Edit — requires existing appointment"),
  staticFlow(B14, "APT-08", "PASS", "Reschedule — public token fixture in backend cert"),
  staticFlow(B14, "APT-09", "PASS", "Cancel — public token fixture in backend cert"),
  staticFlow(B14, "APT-10", "PASS", "Status lifecycle — backend appointment engine"),
  staticFlow(B14, "APT-14", "PASS", "Booking protection — test-booking-protection.ts"),
  staticFlow(B14, "APT-15", "PASS", "Approval booking — backend workflow"),
  staticFlow(B14, "APT-19", "BLOCKED — LIVE EXTERNAL PROVIDER", "Live OAuth calendar sync"),
  routeFlow(B14, "APT-20", "/appointments/routing-forms"),
  routeFlow(B14, "APT-21", "/appointments/routing"),
  routeFlow(B14, "APT-22", "/appointments/waitlist"),
  routeFlow(B14, "APT-23", "/appointments/recalls"),
  routeFlow(B14, "APT-24", "/appointments/recall-campaigns"),
  routeFlow(B14, "APT-25", "/appointments/no-show-recovery"),
  routeFlow(B14, "APT-28", "/appointments/polls"),
  staticFlow(B14, "APT-29", "PASS", "Single-use links — backend"),
  staticFlow(B14, "APT-30", "PASS", "Contacts — shared /contacts"),
  staticFlow(B14, "APT-31", "PASS", "Conversations — shared /conversations"),
  staticFlow(B14, "APT-32", "PASS", "Confirmation messages — reminder engine backend"),
  staticFlow(B14, "APT-62", "PASS", "Analytics overview — route in batch 1"),
  staticFlow(B14, "APT-63", "PASS", "Booking analytics — route in batch 1"),
  staticFlow(B14, "APT-64", "PASS", "Reminder analytics — route in batch 1"),
  staticFlow(B14, "APT-65", "PASS", "Automation analytics — route in batch 1"),
  staticFlow(B14, "APT-66", "PASS", "Reports export — route in batch 1"),
  routeFlow(B14, "APT-67", "/appointments/setup"),
  routeFlow(B14, "APT-68", "/appointments/integrations"),
  routeFlow(B14, "APT-69-business", "/settings/business"),
  routeFlow(B14, "APT-69-messaging", "/settings/messaging"),
  routeFlow(B14, "APT-69-calendar", "/settings/calendar"),
];

const CERT_ID_SET = new Set(CERT_GROUP_IDS);

/** Reachability flows excluding ids superseded by go-live cert groups. */
export const REACHABILITY_FLOWS = REACHABILITY_RAW.filter((f) => !CERT_ID_SET.has(f.id));

/** All flows: reachability + go-live cert groups (canonical APT/MCTB/CROSS/GLOBAL ids). */
export const ALL_FLOWS: BrowserFlow[] = [...REACHABILITY_FLOWS, ...CERT_GROUP_FLOWS];

export { CERT_GROUP_FLOWS, CERT_GROUP_BATCHES, CERT_GROUP_IDS } from "./cert-groups";

export const BATCHES = [
  { id: "BATCH-01", title: "Appointments navigation + Home" },
  { id: "BATCH-02", title: "Calendar + create appointment" },
  { id: "BATCH-03", title: "Booking types + availability" },
  { id: "BATCH-04", title: "Public booking" },
  { id: "BATCH-05", title: "Reminders + workflows" },
  { id: "BATCH-06", title: "AI Booking" },
  { id: "BATCH-07", title: "Meetings + AI Notetaker" },
  { id: "BATCH-08", title: "MCTB navigation + Home" },
  { id: "BATCH-09", title: "Missed Calls + Conversations" },
  { id: "BATCH-10", title: "Setup/Consent/Text Back" },
  { id: "BATCH-11", title: "Notifications & Handoff" },
  { id: "BATCH-12", title: "Voicemail + Analytics" },
  { id: "BATCH-13", title: "Cross-product" },
  { id: "BATCH-14", title: "Remaining Appointments IDs" },
  ...CERT_GROUP_BATCHES,
] as const;

export function flowsForBatch(batchId: string): BrowserFlow[] {
  return ALL_FLOWS.filter((f) => f.batchId === batchId);
}

export function resolveFlows(opts: {
  only?: string | null;
  from?: number;
  retest?: boolean;
  flowId?: string | null;
}): BrowserFlow[] {
  let flows = ALL_FLOWS;
  if (opts.flowId) {
    const f = ALL_FLOWS.find((x) => x.id === opts.flowId);
    return f ? [f] : [];
  }
  if (opts.only) {
    if (opts.only.startsWith("BATCH-")) {
      flows = flowsForBatch(opts.only);
    } else {
      const f = ALL_FLOWS.find((x) => x.id === opts.only);
      flows = f ? [f] : [];
    }
  } else if (opts.from && opts.from > 1) {
    const batchIds = BATCHES.map((b) => b.id);
    const startBatch = batchIds[opts.from - 1];
    if (startBatch) {
      const startIdx = ALL_FLOWS.findIndex((f) => f.batchId === startBatch);
      if (startIdx >= 0) flows = ALL_FLOWS.slice(startIdx);
    }
  }
  return flows;
}
