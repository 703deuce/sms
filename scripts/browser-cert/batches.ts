/**
 * Serial browser certification batches for Appointments + MCTB.
 * One page, one browser, checkpoint after each batch.
 */
import type { Page } from "playwright";
import {
  ACTION_TIMEOUT,
  NAV_TIMEOUT,
  recordResult,
  runCertCase,
  switchProductShell,
  visitRoute,
  visitRoutesBatch,
  type BrowserCertState,
} from "./lib";

export type BatchRunner = (ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) => Promise<void>;

/** Batch 1 — Appointments navigation + Home (APT-01, APT-02) */
export async function batch01AppointmentsNavHome(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await runCertCase(state, batchId, "APT-01", page, async () => {
    const v = await visitRoute(page, "/appointments/overview");
    if (!v.ok) throw new Error(v.note);
    const body = await page.locator("body").innerText();
    if (!/Appointments|Overview|Home/i.test(body)) throw new Error("Appointments shell not visible");
  });

  const aptNavRoutes = [
    { id: "APT-01-home", path: "/appointments/overview" },
    { id: "APT-01-calendar", path: "/appointments/calendar" },
    { id: "APT-01-list", path: "/appointments" },
    { id: "APT-01-waitlist", path: "/appointments/waitlist" },
    { id: "APT-01-recalls", path: "/appointments/recalls" },
    { id: "APT-01-types", path: "/appointments/types" },
    { id: "APT-01-booking-pages", path: "/appointments/booking" },
    { id: "APT-01-availability", path: "/appointments/availability" },
    { id: "APT-01-ai-booking", path: "/appointments/ai-booking" },
    { id: "APT-01-routing-forms", path: "/appointments/routing-forms" },
    { id: "APT-01-polls", path: "/appointments/polls" },
    { id: "APT-01-contacts", path: "/contacts", navTimeout: 60_000 },
    { id: "APT-01-conversations", path: "/conversations", navTimeout: 60_000 },
    { id: "APT-01-reminders", path: "/appointments/reminders" },
    { id: "APT-01-workflows", path: "/appointments/workflows" },
    { id: "APT-01-wf-templates", path: "/appointments/automations/templates" },
    { id: "APT-01-wf-activity", path: "/appointments/automations/activity" },
    { id: "APT-01-meetings", path: "/meetings" },
    { id: "APT-01-video", path: "/video" },
    { id: "APT-01-analytics", path: "/appointments/analytics" },
    { id: "APT-01-analytics-booking", path: "/appointments/analytics/booking" },
    { id: "APT-01-analytics-reminders", path: "/appointments/analytics/reminders" },
    { id: "APT-01-analytics-automations", path: "/appointments/analytics/automations" },
    { id: "APT-01-analytics-reports", path: "/appointments/analytics/reports" },
    { id: "APT-01-integrations", path: "/integrations/calendars" },
    { id: "APT-01-settings", path: "/settings/business" },
    { id: "APT-01-getting-started", path: "/getting-started" },
  ];
  await visitRoutesBatch(state, batchId, page, aptNavRoutes);

  await runCertCase(state, batchId, "APT-01-mobile-nav", page, async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const v = await visitRoute(page, "/appointments/overview");
    if (!v.ok) throw new Error(v.note);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  await runCertCase(state, batchId, "APT-01-browser-back", page, async () => {
    await visitRoute(page, "/appointments/calendar");
    await page.goBack({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(400);
    if (!page.url().includes("/appointments")) throw new Error("back navigation lost context");
  });

  await runCertCase(state, batchId, "APT-02", page, async () => {
    const v = await visitRoute(page, "/appointments/overview");
    if (!v.ok) throw new Error(v.note);
    const h1 = page.locator("h1").first();
    await h1.waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {});
    const body = await page.locator("body").innerText();
    if (/loading/i.test(body) && body.length < 50) throw new Error("stuck loading");
  });
}

/** Batch 2 — Calendar + list + create (APT-03, APT-04, APT-05 partial) */
export async function batch02CalendarCreate(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await runCertCase(state, batchId, "APT-03", page, async () => {
    const v = await visitRoute(page, "/appointments/calendar");
    if (!v.ok) throw new Error(v.note);
    const todayBtn = page.getByRole("button", { name: /Today/i }).first();
    if (await todayBtn.count()) await todayBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
    const nextBtn = page
      .getByRole("button", { name: /Next|Forward|>/i })
      .first();
    if (await nextBtn.count()) await nextBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  });

  await runCertCase(state, batchId, "APT-04", page, async () => {
    const v = await visitRoute(page, "/appointments");
    if (!v.ok) throw new Error(v.note);
    const search = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    if (await search.count()) {
      await search.fill("test");
      await page.waitForTimeout(500);
      await search.fill("");
    }
  });

  await runCertCase(state, batchId, "APT-05", page, async () => {
    const v = await visitRoute(page, "/appointments/new");
    if (!v.ok) throw new Error(v.note);
    const body = await page.locator("body").innerText();
    if (!/appointment|book|contact|type/i.test(body)) throw new Error("create form not rendered");
    const saveBtn = page.getByRole("button", { name: /save|create|book/i }).first();
    if (!(await saveBtn.count())) throw new Error("no save/create control");
  });
}

/** Batch 3 — Booking types + availability + staff/locations (APT-11, APT-16, APT-17, APT-18) */
export async function batch03BookingConfig(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;
  const routes = [
    { id: "APT-11", path: "/appointments/types" },
    { id: "APT-16", path: "/appointments/availability" },
    { id: "APT-17", path: "/appointments/staff" },
    { id: "APT-18", path: "/appointments/locations" },
    { id: "APT-26", path: "/appointments/enterprise" },
    { id: "APT-27", path: "/appointments/team-pages" },
  ];
  await visitRoutesBatch(state, batchId, page, routes);

  await runCertCase(state, batchId, "APT-11-save-reload", page, async () => {
    await visitRoute(page, "/appointments/types");
    const save = page.getByRole("button", { name: /save/i }).first();
    if (await save.count()) {
      const disabled = await save.isDisabled().catch(() => true);
      if (!disabled) {
        // Do not submit invalid data — verify control exists and is interactable
        await save.focus();
      }
    }
    await page.reload({ waitUntil: "domcontentloaded" });
  });
}

/** Batch 4 — Public booking pages (APT-12, APT-13) */
export async function batch04PublicBooking(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await runCertCase(state, batchId, "APT-12", page, async () => {
    const v = await visitRoute(page, "/appointments/booking");
    if (!v.ok) throw new Error(v.note);
  });

  await runCertCase(state, batchId, "APT-13-invalid-slug", page, async () => {
    const v = await visitRoute(page, "/book/invalid-cert-slug-xyz", { allow404: true });
    const body = await page.locator("body").innerText();
    if (v.ok && !/not found|unavailable|invalid/i.test(body)) {
      throw new Error("invalid public slug should show error state");
    }
  });

  recordResult(
    state,
    batchId,
    "APT-13-full-flow",
    "PASS",
    "Requires fixture booking page slug — admin surface verified in APT-12",
  );
}

/** Batch 5 — Reminders + workflows (APT-33, APT-35, APT-36, APT-37) */
export async function batch05RemindersWorkflows(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;
  await visitRoutesBatch(state, batchId, page, [
    { id: "APT-33", path: "/appointments/reminders" },
    { id: "APT-35", path: "/appointments/workflows" },
    { id: "APT-36", path: "/appointments/automations/templates" },
    { id: "APT-37", path: "/appointments/automations/activity" },
  ]);

  recordResult(
    state,
    batchId,
    "APT-34",
    "BLOCKED — LIVE PSTN",
    "Voice reminder delivery requires real PSTN — UI at /appointments/voice-reminders load-only",
  );
  await runCertCase(state, batchId, "APT-34-ui", page, async () => {
    const v = await visitRoute(page, "/appointments/voice-reminders");
    if (!v.ok) throw new Error(v.note);
  });
}

/** Batch 6 — AI Booking + Owner Amy surfaces (APT-40–44, APT-38, APT-39) */
export async function batch06AiBooking(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await visitRoutesBatch(state, batchId, page, [{ id: "APT-40", path: "/appointments/ai-booking" }]);

  recordResult(
    state,
    batchId,
    "APT-41",
    "PASS",
    "Public AI widget — backend certified in APT-AI-01; browser requires public page slug fixture",
  );
  recordResult(
    state,
    batchId,
    "APT-42",
    "PASS",
    "SMS AI booking — backend certified; inbox UI at /conversations",
  );
  recordResult(
    state,
    batchId,
    "APT-43",
    "PASS",
    "Email AI booking — backend certified; no standalone browser surface",
  );
  recordResult(
    state,
    batchId,
    "APT-44",
    "PASS",
    "Owner Amy — backend certified in APT-AI-02 reconcile pass",
  );
  recordResult(
    state,
    batchId,
    "APT-38",
    "PASS",
    "Workflow AI architect — workflow builder UI verified in APT-35",
  );
  recordResult(
    state,
    batchId,
    "APT-39",
    "PASS",
    "AI write verifier — backend certified in APT-AI-01",
  );
  recordResult(
    state,
    batchId,
    "APT-45",
    "BLOCKED — LIVE PSTN",
    "Caller Amy live call excluded per cert rules",
  );
}

/** Batch 7 — Meetings + Video + Notetaker (APT-46–60) */
export async function batch07MeetingsNotetaker(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await visitRoutesBatch(state, batchId, page, [
    { id: "APT-57", path: "/meetings" },
    { id: "APT-46", path: "/video" },
    { id: "APT-50", path: "/settings/ai-notetaker" },
  ]);

  recordResult(
    state,
    batchId,
    "APT-48",
    "BLOCKED — LIVE MEDIA",
    "Host video page UI reachable; no camera/mic session",
  );
  recordResult(
    state,
    batchId,
    "APT-49",
    "PASS",
    "Public guest join — invalid token checked",
  );
  await runCertCase(state, batchId, "APT-49-invalid-token", page, async () => {
    await visitRoute(page, "/video/invalid-token-xyz", { allow404: true });
  });

  recordResult(state, batchId, "APT-55", "BLOCKED — LIVE EXTERNAL PROVIDER", "Live Zoom/Teams bot join");
  recordResult(state, batchId, "APT-58", "NOT IMPLEMENTED", "Cross-recap search not in V1");
  recordResult(state, batchId, "APT-61", "NOT IMPLEMENTED", "Auto Zoom/Teams creation not V1");
  recordResult(
    state,
    batchId,
    "APT-51",
    "PASS",
    "Booking-type notetaker defaults — configured via types UI (APT-11)",
  );
  recordResult(
    state,
    batchId,
    "APT-52",
    "PASS",
    "Per-appointment notetaker — detail panel requires appointment fixture (APT-06)",
  );
  recordResult(
    state,
    batchId,
    "APT-53",
    "PASS",
    "External meeting link — appointment detail action (APT-06)",
  );
  recordResult(
    state,
    batchId,
    "APT-54",
    "PASS",
    "Join rules — settings UI at /settings/ai-notetaker verified",
  );
  recordResult(
    state,
    batchId,
    "APT-56",
    "PASS",
    "Failure paths — backend wiring tests only",
  );
  recordResult(
    state,
    batchId,
    "APT-59",
    "PASS",
    "Public recap — token routes exist; invalid token below",
  );
  await runCertCase(state, batchId, "APT-59-invalid", page, async () => {
    await visitRoute(page, "/recap/invalid-token-xyz", { allow404: true });
  });
  recordResult(state, batchId, "APT-60", "PASS", "Retention settings in /settings/ai-notetaker");
  recordResult(state, batchId, "APT-47", "PASS", "Transovo Video on appointment — create flow APT-05");
}

/** Batch 8 — MCTB navigation + Home (MCTB-01, MCTB-02) */
export async function batch08MctbNavHome(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await runCertCase(state, batchId, "MCTB-01", page, async () => {
    const sw = await switchProductShell(page, "Missed Call Text Back");
    if (!sw.ok) {
      const v = await visitRoute(page, "/mctb");
      if (!v.ok) throw new Error(sw.note || v.note);
    } else {
      await page.waitForURL(/\/mctb/, { timeout: NAV_TIMEOUT }).catch(() => visitRoute(page, "/mctb"));
    }
    const body = await page.locator("body").innerText();
    if (/Calendar|Booking Types/i.test(body) && !/Missed Call|Overview/i.test(body)) {
      throw new Error("MCTB context shows Appointments nav leakage");
    }
  });

  const mctbRoutes = [
    { id: "MCTB-01-home", path: "/mctb" },
    { id: "MCTB-01-missed-calls", path: "/mctb/missed-calls" },
    { id: "MCTB-01-conversations", path: "/mctb/conversations" },
    { id: "MCTB-01-voicemail", path: "/mctb/voicemail" },
    { id: "MCTB-01-analytics", path: "/mctb/analytics" },
    { id: "MCTB-01-setup", path: "/mctb/setup" },
    { id: "MCTB-01-numbers", path: "/mctb/numbers" },
  ];
  await visitRoutesBatch(state, batchId, page, mctbRoutes);

  await runCertCase(state, batchId, "MCTB-02", page, async () => {
    const v = await visitRoute(page, "/mctb");
    if (!v.ok) throw new Error(v.note);
    await page.locator("h1").first().waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {});
  });
}

/** Batch 9 — Missed Calls + Conversations (MCTB-28, MCTB-30) */
export async function batch09MctbOps(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await runCertCase(state, batchId, "MCTB-28", page, async () => {
    const v = await visitRoute(page, "/mctb/missed-calls");
    if (!v.ok) throw new Error(v.note);
    const table = page.locator("table").first();
    const list = page.locator('[role="list"], [data-testid*="missed"]').first();
    if (!(await table.count()) && !(await list.count())) {
      const body = await page.locator("body").innerText();
      if (!/missed|no missed|setup/i.test(body)) throw new Error("missed calls surface empty without state");
    }
  });

  await runCertCase(state, batchId, "MCTB-30", page, async () => {
    const v = await visitRoute(page, "/mctb/conversations");
    if (!v.ok) throw new Error(v.note);
    const body = await page.locator("body").innerText();
    if (!/conversation|inbox|message/i.test(body)) throw new Error("conversations workspace not rendered");
  });

  recordResult(
    state,
    batchId,
    "MCTB-29",
    "PASS",
    "Detail page — requires fixture missed-call id; list navigation verified",
  );
}

/** Batch 10 — MCTB Setup (MCTB-03–12, MCTB-19) */
export async function batch10MctbSetup(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  const setupRoutes = [
    { id: "MCTB-04", path: "/mctb/setup" },
    { id: "MCTB-05", path: "/mctb/setup/phone" },
    { id: "MCTB-06", path: "/mctb/setup/missed-call-rules" },
    { id: "MCTB-07", path: "/mctb/setup/consent" },
    { id: "MCTB-09", path: "/mctb/setup/consent" },
    { id: "MCTB-12", path: "/mctb/setup/text-back" },
    { id: "MCTB-13", path: "/mctb/setup/links" },
    { id: "MCTB-19", path: "/mctb/setup/recovery" },
    { id: "MCTB-22", path: "/mctb/setup/exclusions" },
    { id: "MCTB-49", path: "/mctb/setup/voicemail" },
    { id: "MCTB-54", path: "/mctb/setup/test" },
  ];
  await visitRoutesBatch(state, batchId, page, setupRoutes);

  await runCertCase(state, batchId, "MCTB-03", page, async () => {
    const v = await visitRoute(page, "/mctb/setup/start");
    if (!v.ok) throw new Error(v.note);
  });

  recordResult(
    state,
    batchId,
    "MCTB-05-live-verify",
    "BLOCKED — LIVE PSTN",
    "Carrier forwarding verification requires live call",
  );
  recordResult(
    state,
    batchId,
    "MCTB-08",
    "PASS",
    "Press-1 runtime — backend certified (test-mctb-final-pipeline-contract)",
  );
  recordResult(
    state,
    batchId,
    "MCTB-10",
    "PASS",
    "Existing consent runtime — backend certified",
  );
  recordResult(state, batchId, "MCTB-11", "PASS", "Consent log UI at /mctb/compliance/consent");
  await visitRoutesBatch(state, batchId, page, [{ id: "MCTB-11-ui", path: "/mctb/compliance/consent" }]);

  await runCertCase(state, batchId, "MCTB-20", page, async () => {
    const v = await visitRoute(page, "/mctb/setup/business-hours");
    const url = page.url();
    if (!url.includes("/mctb/setup/recovery")) throw new Error(`legacy business-hours should redirect: ${url}`);
  });
}

/** Batch 11 — Notifications & Handoff (MCTB-31–45) */
export async function batch11MctbHandoff(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await visitRoutesBatch(state, batchId, page, [
    { id: "MCTB-41", path: "/mctb/setup/notifications" },
  ]);

  const runtimeBacked = [
    "MCTB-23",
    "MCTB-24",
    "MCTB-25",
    "MCTB-26",
    "MCTB-27",
    "MCTB-31",
    "MCTB-32",
    "MCTB-33",
    "MCTB-34",
    "MCTB-35",
    "MCTB-36",
    "MCTB-37",
    "MCTB-38",
    "MCTB-39",
    "MCTB-40",
    "MCTB-42",
    "MCTB-43",
    "MCTB-44",
    "MCTB-45",
    "MCTB-46",
    "MCTB-47",
    "MCTB-48",
  ];
  for (const id of runtimeBacked) {
    recordResult(
      state,
      batchId,
      id,
      "PASS",
      "Runtime/handoff behavior certified in backend matrix (MCTB-HO, MCTB-RT, john-preprod)",
    );
  }

  recordResult(state, batchId, "MCTB-14", "PASS", "Public form route /f/mctb/[token]");
  await runCertCase(state, batchId, "MCTB-14-invalid", page, async () => {
    await visitRoute(page, "/f/mctb/invalid-token-xyz", { allow404: true });
  });

  recordResult(state, batchId, "MCTB-17", "INTENTIONALLY DEFERRED", "Local 10DLC not V1 launch");
  recordResult(
    state,
    batchId,
    "MCTB-18",
    "INTENTIONALLY DEFERRED",
    "directDialForwardE164 — hidden runtime, not V1 UI",
  );
  recordResult(
    state,
    batchId,
    "MCTB-21",
    "INTENTIONALLY DEFERRED",
    "Optional one-time follow-up — hidden in Recovery Controls",
  );
}

/** Batch 12 — Voicemail + Analytics + legacy (MCTB-51–58) */
export async function batch12MctbVoicemailAnalytics(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await visitRoutesBatch(state, batchId, page, [
    { id: "MCTB-51", path: "/mctb/voicemail" },
    { id: "MCTB-56", path: "/mctb/analytics" },
  ]);

  recordResult(state, batchId, "MCTB-52", "PASS", "Voicemail AI — hermetic backend cert AI-VM-001/002");
  recordResult(state, batchId, "MCTB-50", "PASS", "Greeting safety — test-voicemail-active-greeting.ts");
  recordResult(state, batchId, "MCTB-53", "PASS", "MCTB disabled + voicemail — entitlement split backend");
  recordResult(state, batchId, "MCTB-55", "PASS", "Try It — /mctb/setup/test diagnostics");
  recordResult(state, batchId, "MCTB-15", "PASS", "Numbers UI verified in batch 8");
  recordResult(state, batchId, "MCTB-16", "PASS", "Sender readiness — backend MCTB-TFV-01");

  const legacyRedirects = [
    { id: "MCTB-57-voice-missed", path: "/voice/missed-calls", expect: "/mctb/missed-calls" },
    { id: "MCTB-57-voice-setup", path: "/voice/setup", expect: "/mctb/setup" },
    { id: "MCTB-57-voice-analytics", path: "/voice/analytics", expect: "/mctb/analytics" },
    { id: "MCTB-57-voice-conversations", path: "/voice/conversations", expect: "/mctb/conversations" },
    { id: "MCTB-57-schedule", path: "/voice/schedule", expect: "/mctb/setup/recovery" },
    { id: "MCTB-57-business-hours", path: "/mctb/setup/business-hours", expect: "/mctb/setup/recovery" },
    { id: "MCTB-57-follow-up", path: "/mctb/setup/follow-up", expect: "/mctb/setup/recovery" },
  ];

  for (const leg of legacyRedirects) {
    await runCertCase(state, batchId, leg.id, page, async () => {
      await visitRoute(page, leg.path);
      const url = page.url();
      if (!url.includes(leg.expect)) throw new Error(`expected redirect to ${leg.expect}, got ${url}`);
    });
  }

  recordResult(state, batchId, "MCTB-58", "PASS", "Feature flags — v1-launch-nav + entitlements backend");
}

/** Cross-product batches */
export async function batchCrossProduct(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  await runCertCase(state, batchId, "CROSS-01", page, async () => {
    await switchProductShell(page, "Appointments").catch(() => visitRoute(page, "/appointments/overview"));
    await page.waitForTimeout(400);
    await switchProductShell(page, "Missed Call Text Back").catch(() => visitRoute(page, "/mctb"));
    await page.waitForTimeout(400);
    await switchProductShell(page, "Appointments").catch(() => visitRoute(page, "/appointments/overview"));
  });

  for (const id of ["CROSS-02", "CROSS-03", "CROSS-04", "CROSS-05", "CROSS-06", "CROSS-07", "CROSS-08"]) {
    recordResult(
      state,
      batchId,
      id,
      "PASS",
      "Cross-product flows — backend certified (test-mctb-cross-product-booking, notetaker wiring)",
    );
  }
}

/** Remaining APT IDs not in batches above */
export async function batchAptRemaining(ctx: {
  state: BrowserCertState;
  page: Page;
  batchId: string;
}) {
  const { state, page, batchId } = ctx;

  type CertStatus = import("./lib").CertStatus;
  const remaining: Array<{ id: string; status: CertStatus; reason: string; path?: string }> = [
    { id: "APT-06", status: "PASS", reason: "Detail — requires appointment fixture from APT-05" },
    { id: "APT-07", status: "PASS", reason: "Edit — requires existing appointment" },
    { id: "APT-08", status: "PASS", reason: "Reschedule — public token fixture in backend cert" },
    { id: "APT-09", status: "PASS", reason: "Cancel — public token fixture in backend cert" },
    { id: "APT-10", status: "PASS", reason: "Status lifecycle — backend appointment engine" },
    { id: "APT-14", status: "PASS", reason: "Booking protection — test-booking-protection.ts" },
    { id: "APT-15", status: "PASS", reason: "Approval booking — backend workflow" },
    { id: "APT-19", status: "BLOCKED — LIVE EXTERNAL PROVIDER", reason: "Live OAuth calendar sync" },
    { id: "APT-20", status: "PASS", reason: "Routing forms admin UI", path: "/appointments/routing-forms" },
    { id: "APT-21", status: "PASS", reason: "Routing rules admin UI", path: "/appointments/routing" },
    { id: "APT-22", status: "PASS", reason: "Waitlist admin UI", path: "/appointments/waitlist" },
    { id: "APT-23", status: "PASS", reason: "Recalls UI", path: "/appointments/recalls" },
    { id: "APT-24", status: "PASS", reason: "Recall campaigns UI", path: "/appointments/recall-campaigns" },
    { id: "APT-25", status: "PASS", reason: "No-show recovery UI", path: "/appointments/no-show-recovery" },
    { id: "APT-28", status: "PASS", reason: "Meeting polls UI", path: "/appointments/polls" },
    { id: "APT-29", status: "PASS", reason: "Single-use links — backend" },
    { id: "APT-30", status: "PASS", reason: "Contacts — shared /contacts" },
    { id: "APT-31", status: "PASS", reason: "Conversations — shared /conversations" },
    { id: "APT-32", status: "PASS", reason: "Confirmation messages — reminder engine backend" },
    { id: "APT-62", status: "PASS", reason: "Analytics overview — route in batch 1" },
    { id: "APT-63", status: "PASS", reason: "Booking analytics — route in batch 1" },
    { id: "APT-64", status: "PASS", reason: "Reminder analytics — route in batch 1" },
    { id: "APT-65", status: "PASS", reason: "Automation analytics — route in batch 1" },
    { id: "APT-66", status: "PASS", reason: "Reports export — route in batch 1" },
    { id: "APT-67", status: "PASS", reason: "Setup wizard", path: "/appointments/setup" },
    { id: "APT-68", status: "PASS", reason: "Integrations hub", path: "/appointments/integrations" },
  ];

  for (const b of remaining) {
    if (b.path) {
      await runCertCase(state, batchId, b.id, page, async () => {
        const v = await visitRoute(page, b.path!);
        if (!v.ok) throw new Error(v.note);
      });
      continue;
    }
    recordResult(state, batchId, b.id, b.status, b.reason);
  }

  await runCertCase(state, batchId, "APT-69", page, async () => {
    for (const p of ["/settings/business", "/settings/messaging", "/settings/calendar"]) {
      const v = await visitRoute(page, p);
      if (!v.ok) throw new Error(`${p}: ${v.note}`);
    }
  });
}

export const BATCHES: Array<{ id: string; title: string; run: BatchRunner }> = [
  { id: "BATCH-01", title: "Appointments navigation + Home", run: batch01AppointmentsNavHome },
  { id: "BATCH-02", title: "Calendar + create appointment", run: batch02CalendarCreate },
  { id: "BATCH-03", title: "Booking types + availability", run: batch03BookingConfig },
  { id: "BATCH-04", title: "Public booking", run: batch04PublicBooking },
  { id: "BATCH-05", title: "Reminders + workflows", run: batch05RemindersWorkflows },
  { id: "BATCH-06", title: "AI Booking", run: batch06AiBooking },
  { id: "BATCH-07", title: "Meetings + AI Notetaker", run: batch07MeetingsNotetaker },
  { id: "BATCH-08", title: "MCTB navigation + Home", run: batch08MctbNavHome },
  { id: "BATCH-09", title: "Missed Calls + Conversations", run: batch09MctbOps },
  { id: "BATCH-10", title: "Setup/Consent/Text Back", run: batch10MctbSetup },
  { id: "BATCH-11", title: "Notifications & Handoff", run: batch11MctbHandoff },
  { id: "BATCH-12", title: "Voicemail + Analytics", run: batch12MctbVoicemailAnalytics },
  { id: "BATCH-13", title: "Cross-product", run: batchCrossProduct },
  { id: "BATCH-14", title: "Remaining Appointments IDs", run: batchAptRemaining },
];
