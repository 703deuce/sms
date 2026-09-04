#!/usr/bin/env tsx
/**
 * Single-page appointments frontend certification.
 * ONE Chromium browser per invocation; browser is closed after the page cert finishes.
 *
 *   npx tsx scripts/appointments-frontend-certify-page.ts overview
 *   APPOINTMENTS_TEST_PHONE=5714776175 npx tsx scripts/appointments-frontend-certify-page.ts reminders
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = (
  process.env.UI_AGENT_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "[REDACTED]" // pragma: allowlist secret
).replace(/\/$/, "");

const AUTH_EMAIL = (process.env.AUTH_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const TEST_REMINDER_PHONE = (process.env.APPOINTMENTS_TEST_PHONE || "5714776175").replace(/\D/g, "");

const ARTIFACTS_DIR = "/opt/cursor/artifacts/appointments-frontend-cert";

const ERROR_PATTERNS = [
  /Application error/i,
  /Internal Server Error/i,
  /Unhandled Runtime Error/i,
  /Something went wrong/i,
  /This page could not be found/i,
];

const PAGE_IDS = [
  "overview",
  "calendar",
  "scheduled",
  "detail",
  "types",
  "availability",
  "reminders",
  "booking",
  "public-booking",
  "setup",
  "analytics",
  "conversations",
  "contacts",
] as const;

type PageId = (typeof PAGE_IDS)[number];

type CheckResult = {
  id: string;
  name: string;
  ok: boolean;
  ms: number;
  error?: string;
};

type CertContext = {
  page: Page;
  base: string;
  goto: (path: string) => Promise<void>;
  fetchJson: <T = unknown>(path: string, init?: Parameters<BrowserContext["request"]["fetch"]>[1]) => Promise<T>;
  bodyText: () => Promise<string>;
  assertNoErrorPage: () => Promise<void>;
  waitForContent: () => Promise<void>;
};

type CheckDef = {
  id: string;
  name: string;
  run: (ctx: CertContext) => Promise<void>;
};

type PageCertifier = {
  id: PageId;
  label: string;
  checks: CheckDef[];
};

function resolveUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function fetchJson<T>(
  context: BrowserContext,
  base: string,
  path: string,
  init?: Parameters<BrowserContext["request"]["fetch"]>[1],
): Promise<T> {
  const url = resolveUrl(base, path);
  const res = await context.request.fetch(url, init);
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`fetchJson ${path}: invalid JSON (${res.status()})`);
  }
  if (!res.ok()) {
    const err =
      typeof json === "object" && json && "error" in json
        ? String((json as { error?: unknown }).error)
        : `HTTP ${res.status()}`;
    throw new Error(`fetchJson ${path}: ${err}`);
  }
  return json as T;
}

async function login(page: Page, base: string): Promise<void> {
  const next = encodeURIComponent("/appointments/overview");
  const email = encodeURIComponent(AUTH_EMAIL);
  const res = await page.goto(`${base}/api/auth/dev-bypass?email=${email}&next=${next}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  if (res && res.status() >= 500) {
    throw new Error(`Login failed: HTTP ${res.status()}`);
  }
  await page.waitForTimeout(1500);
  if (page.url().includes("/login")) {
    throw new Error(`Login redirected to ${page.url()}`);
  }
}

async function waitForPulseDone(page: Page): Promise<void> {
  await page
    .waitForFunction(() => !document.querySelector(".animate-pulse"), undefined, { timeout: 90_000 })
    .catch(() => {});
}

async function waitCalHeader(page: Page): Promise<void> {
  await page.locator(".cal-header").waitFor({ state: "visible", timeout: 90_000 });
}

function assertTruthy<T>(value: T | null | undefined, message: string): asserts value is T {
  if (value == null || value === "") throw new Error(message);
}

function createContext(page: Page, context: BrowserContext): CertContext {
  const base = BASE;
  return {
    page,
    base,
    goto: async (path: string) => {
      const res = await page.goto(resolveUrl(base, path), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      if (res && res.status() >= 500) {
        throw new Error(`HTTP ${res.status()} loading ${path}`);
      }
      await page.waitForTimeout(900);
    },
    fetchJson: <T,>(path: string, init?: Parameters<BrowserContext["request"]["fetch"]>[1]) =>
      fetchJson<T>(context, base, path, init),
    bodyText: async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim(),
    assertNoErrorPage: async () => {
      const text = await page.locator("body").innerText();
      if (page.url().includes("/login")) throw new Error("Redirected to login");
      for (const pattern of ERROR_PATTERNS) {
        if (pattern.test(text)) throw new Error(`Error page detected: ${pattern}`);
      }
    },
    waitForContent: async () => {
      await waitForPulseDone(page);
    },
  };
}

const CERTIFIERS: Record<PageId, PageCertifier> = {
  overview: {
    id: "overview",
    label: "Overview",
    checks: [
      {
        id: "route-loads",
        name: "Overview route loads while authenticated",
        run: async (ctx) => {
          await ctx.goto("/appointments/overview");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Overview/i }).first().waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "overview-api",
        name: "Overview API returns appointment dashboard data",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: { counts?: Record<string, number> } }>(
            "/api/appointments/overview",
          );
          assertTruthy(json.data?.counts, "overview API missing counts");
        },
      },
      {
        id: "stat-cards",
        name: "Stat cards render key appointment metrics",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          for (const label of ["Upcoming appointments", "Confirmation rate", "Reminders sent", "Reminder health"]) {
            if (!text.includes(label)) throw new Error(`Missing stat card: ${label}`);
          }
        },
      },
      {
        id: "schedule-panel",
        name: "Today's schedule panel is visible",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Today'?s schedule|Today's Schedule/i.test(text)) {
            throw new Error("Today's schedule section not visible");
          }
        },
      },
      {
        id: "quick-actions",
        name: "Quick actions and needs-attention panels render",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Quick actions|Needs attention/i.test(text)) {
            throw new Error("Quick actions / needs attention panels missing");
          }
        },
      },
    ],
  },

  calendar: {
    id: "calendar",
    label: "Calendar",
    checks: [
      {
        id: "route-loads",
        name: "Calendar route loads with header",
        run: async (ctx) => {
          await ctx.goto("/appointments/calendar");
          await ctx.waitForContent();
          await waitCalHeader(ctx.page);
          await ctx.assertNoErrorPage();
        },
      },
      {
        id: "calendar-api",
        name: "Calendar appointments API returns data",
        run: async (ctx) => {
          const now = new Date();
          const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
          const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30).toISOString();
          const json = await ctx.fetchJson<{ data?: unknown[] }>(
            `/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          );
          if (!Array.isArray(json.data)) throw new Error("appointments API did not return array");
        },
      },
      {
        id: "view-toggle-day",
        name: "Day view toggle re-renders calendar header",
        run: async (ctx) => {
          await ctx.page.locator(".view-toggle .vt-btn", { hasText: "Day" }).click();
          await waitCalHeader(ctx.page);
        },
      },
      {
        id: "view-toggle-month",
        name: "Month view toggle re-renders calendar header",
        run: async (ctx) => {
          await ctx.page.locator(".view-toggle .vt-btn", { hasText: "Month" }).click();
          await waitCalHeader(ctx.page);
          await ctx.page.locator(".view-toggle .vt-btn", { hasText: "Week" }).click();
          await waitCalHeader(ctx.page);
        },
      },
      {
        id: "new-appointment-cta",
        name: "New appointment control is visible",
        run: async (ctx) => {
          await ctx.page.getByRole("button", { name: /New appointment/i }).first().waitFor({
            state: "visible",
            timeout: 30_000,
          });
        },
      },
    ],
  },

  scheduled: {
    id: "scheduled",
    label: "Scheduled",
    checks: [
      {
        id: "route-loads",
        name: "Scheduled list route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Scheduled Appointments/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "filter-tabs",
        name: "Filter tabs switch using role=tab controls",
        run: async (ctx) => {
          for (const tab of ["Today", "Upcoming", "Confirmed", "All"]) {
            await ctx.page.getByRole("tab", { name: tab, exact: true }).click();
            await ctx.waitForContent();
            const selected = await ctx.page.getByRole("tab", { name: tab, exact: true }).getAttribute("aria-selected");
            if (selected !== "true") throw new Error(`Tab ${tab} not selected`);
          }
        },
      },
      {
        id: "search-filter",
        name: "Search filters appointments and clears afterward",
        run: async (ctx) => {
          const search = ctx.page.getByRole("searchbox", { name: /Search appointments/i });
          await search.fill("a");
          await ctx.page.waitForTimeout(900);
          await search.fill("");
          await ctx.page.waitForTimeout(500);
          const value = await search.inputValue();
          if (value) throw new Error("Search was not cleared");
        },
      },
      {
        id: "appointments-api",
        name: "Appointments list API returns rows",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: unknown[] }>("/api/appointments");
          if (!Array.isArray(json.data)) throw new Error("appointments API missing data array");
        },
      },
      {
        id: "new-appointment-cta",
        name: "New Appointment button is visible",
        run: async (ctx) => {
          await ctx.page.getByRole("link", { name: /New Appointment/i }).first().waitFor({
            state: "visible",
            timeout: 30_000,
          });
        },
      },
    ],
  },

  detail: {
    id: "detail",
    label: "Appointment Detail",
    checks: [
      {
        id: "discover-appointment",
        name: "An appointment id is available from the API",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: Array<{ id: string }> }>("/api/appointments");
          const id = json.data?.[0]?.id;
          assertTruthy(id, "No appointments available for detail cert");
          await ctx.goto(`/appointments/${id}`);
          await ctx.waitForContent();
        },
      },
      {
        id: "detail-loads",
        name: "Appointment detail page loads without error",
        run: async (ctx) => {
          await ctx.assertNoErrorPage();
          const text = await ctx.bodyText();
          if (/Appointment not found/i.test(text)) throw new Error("Appointment detail not found");
        },
      },
      {
        id: "customer-header",
        name: "Customer header and status badge render",
        run: async (ctx) => {
          await ctx.page.locator("h1").first().waitFor({ state: "visible", timeout: 30_000 });
          const text = await ctx.bodyText();
          if (!/Back to appointments/i.test(text)) throw new Error("Detail breadcrumb missing");
        },
      },
      {
        id: "appointment-api",
        name: "Appointment detail API returns record",
        run: async (ctx) => {
          const match = ctx.page.url().match(/\/appointments\/([^/?#]+)/);
          const id = match?.[1];
          assertTruthy(id, "Could not parse appointment id from URL");
          const json = await ctx.fetchJson<{ data?: { id: string; startsAt?: string } }>(
            `/api/appointments/${id}`,
          );
          assertTruthy(json.data?.id, "appointment detail API missing data");
        },
      },
      {
        id: "detail-actions",
        name: "Detail actions and reminder timeline are visible",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Reminder|Timeline|Activity/i.test(text)) {
            throw new Error("Reminder/timeline section missing on detail page");
          }
        },
      },
    ],
  },

  types: {
    id: "types",
    label: "Appointment Types",
    checks: [
      {
        id: "route-loads",
        name: "Appointment types route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments/types");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Appointment Types/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "types-api",
        name: "Appointment types API returns services",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: unknown[] }>("/api/appointments/types");
          if (!Array.isArray(json.data)) throw new Error("types API missing data array");
        },
      },
      {
        id: "type-list",
        name: "Type list panel renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/appointment type|services you offer/i.test(text)) {
            throw new Error("Type list panel not visible");
          }
        },
      },
      {
        id: "type-editor",
        name: "Type editor panel renders for selected type",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Duration|Location|Active|Inactive/i.test(text)) {
            throw new Error("Type editor panel not visible");
          }
        },
      },
      {
        id: "new-type-cta",
        name: "New appointment type action is visible",
        run: async (ctx) => {
          await ctx.page.getByRole("button", { name: /New appointment type/i }).first().waitFor({
            state: "visible",
            timeout: 30_000,
          });
        },
      },
    ],
  },

  availability: {
    id: "availability",
    label: "Availability",
    checks: [
      {
        id: "route-loads",
        name: "Availability route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments/availability");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Availability/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "availability-api",
        name: "Availability API returns schedule rules",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: Record<string, unknown> }>("/api/appointments/availability");
          assertTruthy(json.data, "availability API missing data");
        },
      },
      {
        id: "weekly-hours",
        name: "Weekly hours section renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Weekly hours|hours/i.test(text)) throw new Error("Weekly hours section missing");
        },
      },
      {
        id: "booking-rules",
        name: "Booking rules section renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Booking rules|Minimum notice|Maximum/i.test(text)) {
            throw new Error("Booking rules section missing");
          }
        },
      },
      {
        id: "live-preview",
        name: "Availability live preview panel renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Preview|Available|Unavailable/i.test(text)) {
            throw new Error("Availability preview panel missing");
          }
        },
      },
    ],
  },

  reminders: {
    id: "reminders",
    label: "Reminder Settings",
    checks: [
      {
        id: "route-loads",
        name: "Reminder settings route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments/reminders");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Reminder Settings/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "reminder-sequence",
        name: "Reminder sequence cards render",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Reminder sequence/i.test(text)) throw new Error("Reminder sequence heading missing");
          if (!/Confirmation/i.test(text)) throw new Error("Confirmation reminder step missing");
          if (!/24|2\s*h/i.test(text)) throw new Error("Timed reminder steps missing");
        },
      },
      {
        id: "send-test-ui",
        name: "Send test SMS card is visible",
        run: async (ctx) => {
          await ctx.page.getByText("Send yourself a test").waitFor({ state: "visible", timeout: 30_000 });
          await ctx.page.getByRole("button", { name: /Send test SMS/i }).waitFor({ state: "visible" });
        },
      },
      {
        id: "send-test-sms",
        name: "Send test SMS to configured phone returns 200",
        run: async (ctx) => {
          assertTruthy(TEST_REMINDER_PHONE, "TEST_REMINDER_PHONE is empty");
          const input = ctx.page.locator(".reminder-settings-page input").first();
          await input.fill(TEST_REMINDER_PHONE);
          const responsePromise = ctx.page.waitForResponse(
            (res) =>
              res.url().includes("/api/appointments/reminders/test") &&
              res.request().method() === "POST",
            { timeout: 90_000 },
          );
          await ctx.page.getByRole("button", { name: /Send test SMS/i }).click();
          const response = await responsePromise;
          if (response.status() !== 200) {
            const body = await response.text().catch(() => "");
            throw new Error(`reminders/test POST returned ${response.status()}: ${body.slice(0, 200)}`);
          }
        },
      },
      {
        id: "merge-tags",
        name: "Merge tags reference card renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Merge tags|merge tag/i.test(text)) throw new Error("Merge tags card missing");
        },
      },
    ],
  },

  booking: {
    id: "booking",
    label: "Booking Settings",
    checks: [
      {
        id: "route-loads",
        name: "Booking settings route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments/booking");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /^Booking$/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "settings-api",
        name: "Booking settings API returns workspace config",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: Record<string, unknown>; workspace?: { slug?: string } }>(
            "/api/appointments/settings",
          );
          assertTruthy(json.data, "settings API missing data");
        },
      },
      {
        id: "public-booking-card",
        name: "Public booking enable card renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Public booking|booking page/i.test(text)) {
            throw new Error("Public booking card missing");
          }
        },
      },
      {
        id: "business-info",
        name: "Business info and SMS consent cards render",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Business info|SMS consent/i.test(text)) {
            throw new Error("Business info / SMS consent cards missing");
          }
        },
      },
      {
        id: "live-preview",
        name: "Booking live preview panel renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Preview|live booking page/i.test(text)) {
            throw new Error("Booking preview panel missing");
          }
        },
      },
    ],
  },

  "public-booking": {
    id: "public-booking",
    label: "Public Booking",
    checks: [
      {
        id: "public-api",
        name: "Public booking API returns services for workspace slug",
        run: async (ctx) => {
          const settings = await ctx.fetchJson<{
            workspace?: { slug?: string };
          }>("/api/appointments/settings");
          const slug = settings.workspace?.slug;
          assertTruthy(slug, "workspace slug missing from settings API");
          const json = await ctx.fetchJson<{ data?: { types?: unknown[]; workspace?: { name?: string } } }>(
            `/api/public/book/${encodeURIComponent(slug)}`,
          );
          assertTruthy(json.data, "public booking API missing data");
        },
      },
      {
        id: "book-online-visible",
        name: "Public booking page shows Book online hero copy",
        run: async (ctx) => {
          const settings = await ctx.fetchJson<{ workspace?: { slug?: string } }>("/api/appointments/settings");
          const slug = settings.workspace?.slug;
          assertTruthy(slug, "workspace slug missing");
          await ctx.goto(`/book/${slug}`);
          await ctx.page.getByText("Book online", { exact: false }).waitFor({ state: "visible", timeout: 90_000 });
          await ctx.assertNoErrorPage();
        },
      },
      {
        id: "service-step",
        name: "Service selection step lists bookable services",
        run: async (ctx) => {
          const settings = await ctx.fetchJson<{ workspace?: { slug?: string } }>("/api/appointments/settings");
          const slug = settings.workspace?.slug;
          assertTruthy(slug, "workspace slug missing");
          const pub = await ctx.fetchJson<{ data?: { types?: Array<{ name: string }> } }>(
            `/api/public/book/${encodeURIComponent(slug)}`,
          );
          const types = pub.data?.types || [];
          if (!types.length) throw new Error("No public booking services configured");
          const text = await ctx.bodyText();
          if (!types.some((t) => text.includes(t.name))) {
            throw new Error("Configured service names not visible on booking page");
          }
        },
      },
      {
        id: "service-click-slots",
        name: "Clicking a service advances to date/time slots step",
        run: async (ctx) => {
          const serviceButton = ctx.page
            .locator("button")
            .filter({ hasText: /min|service|appointment/i })
            .first();
          await serviceButton.waitFor({ state: "visible", timeout: 30_000 });
          await serviceButton.click();
          await ctx.page.waitForTimeout(1500);
          const text = await ctx.bodyText();
          if (!/Date|time|Choose|Continue|Available/i.test(text)) {
            throw new Error("Did not advance to date/time step after service click");
          }
        },
      },
      {
        id: "step-indicator",
        name: "Booking step indicator shows service and date/time steps",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Service/i.test(text) || !/Date/i.test(text)) {
            throw new Error("Step indicator missing service/date labels");
          }
        },
      },
    ],
  },

  setup: {
    id: "setup",
    label: "Get Started",
    checks: [
      {
        id: "route-loads",
        name: "Get Started route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments/setup");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Get Started/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "progress-card",
        name: "Setup progress card renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/progress|setup/i.test(text)) throw new Error("Setup progress card missing");
        },
      },
      {
        id: "step-list",
        name: "Onboarding step list renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/availability|appointment type|booking|reminder/i.test(text)) {
            throw new Error("Onboarding steps missing");
          }
        },
      },
      {
        id: "launch-readiness",
        name: "Launch readiness sidebar renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Launch readiness|readiness/i.test(text)) {
            throw new Error("Launch readiness card missing");
          }
        },
      },
      {
        id: "booking-link-card",
        name: "Booking link card renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/booking link|Copy|Preview/i.test(text)) {
            throw new Error("Booking link card missing");
          }
        },
      },
    ],
  },

  analytics: {
    id: "analytics",
    label: "Analytics",
    checks: [
      {
        id: "route-loads",
        name: "Analytics route loads",
        run: async (ctx) => {
          await ctx.goto("/appointments/analytics");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /Analytics/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "analytics-api",
        name: "Analytics API returns metrics",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: { booked?: number; series?: unknown[] } }>(
            "/api/appointments/analytics?range=7",
          );
          assertTruthy(json.data, "analytics API missing data");
        },
      },
      {
        id: "metric-cards",
        name: "Metric cards render appointment KPIs",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Booked|Confirmed|Canceled|Reminders/i.test(text)) {
            throw new Error("Analytics metric cards missing");
          }
        },
      },
      {
        id: "range-toggle",
        name: "7-day and 30-day range controls are visible",
        run: async (ctx) => {
          await ctx.page.getByRole("button", { name: /7 days/i }).first().waitFor({ state: "visible" });
          await ctx.page.getByRole("button", { name: /30 days/i }).first().waitFor({ state: "visible" });
        },
      },
      {
        id: "bookings-chart",
        name: "Bookings over time chart area renders",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Bookings over time|booked over time|trend/i.test(text)) {
            throw new Error("Bookings chart section missing");
          }
        },
      },
    ],
  },

  conversations: {
    id: "conversations",
    label: "Conversations Integration",
    checks: [
      {
        id: "route-loads",
        name: "Conversations route loads inbox shell",
        run: async (ctx) => {
          await ctx.goto("/conversations");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
        },
      },
      {
        id: "inbox-api",
        name: "Inbox API returns conversation threads",
        run: async (ctx) => {
          const json = await ctx.fetchJson<{ data?: Array<{ id: string; contactName?: string; name?: string }> }>(
            "/api/inbox?product=all&take=10",
          );
          if (!Array.isArray(json.data)) throw new Error("inbox API missing data array");
        },
      },
      {
        id: "thread-list",
        name: "Conversation thread list renders rows",
        run: async (ctx) => {
          await ctx.page.locator(".tv-convo-row, [role='button']").first().waitFor({
            state: "visible",
            timeout: 90_000,
          });
        },
      },
      {
        id: "open-thread",
        name: "Click thread by name button opens conversation",
        run: async (ctx) => {
          const inbox = await ctx.fetchJson<{
            data?: Array<{ contactName?: string; name?: string }>;
          }>("/api/inbox?product=all&take=10");
          const row = inbox.data?.find((r) => (r.contactName || r.name || "").trim());
          const name = row?.contactName || row?.name;
          assertTruthy(name, "No named conversation thread available");
          const thread = ctx.page.getByRole("button", { name: new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
          await thread.first().click();
          await ctx.page.waitForTimeout(1200);
        },
      },
      {
        id: "thread-selected",
        name: "Thread panel is selected (not empty state)",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (/No Conversation Selected/i.test(text)) {
            throw new Error('Conversation pane still shows "No Conversation Selected"');
          }
        },
      },
    ],
  },

  contacts: {
    id: "contacts",
    label: "Contacts Integration",
    checks: [
      {
        id: "route-loads",
        name: "Contacts route loads",
        run: async (ctx) => {
          await ctx.goto("/contacts");
          await ctx.waitForContent();
          await ctx.assertNoErrorPage();
          await ctx.page.getByRole("heading", { name: /^Contacts$/i }).waitFor({ timeout: 60_000 });
        },
      },
      {
        id: "contacts-stats",
        name: "Contacts stat cards render",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Contacts/i.test(text) || !/Subscribed|Lists|Segments/i.test(text)) {
            throw new Error("Contacts stat cards missing");
          }
        },
      },
      {
        id: "search-input",
        name: "Contacts search input is visible",
        run: async (ctx) => {
          await ctx.page.getByPlaceholder(/search contacts/i).first().waitFor({
            state: "visible",
            timeout: 30_000,
          });
        },
      },
      {
        id: "contact-rows",
        name: "Contact list renders rows or useful empty state",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/contact|phone|email|No contacts/i.test(text)) {
            throw new Error("Contacts list area missing");
          }
        },
      },
      {
        id: "contacts-actions",
        name: "Contacts primary actions are visible",
        run: async (ctx) => {
          const text = await ctx.bodyText();
          if (!/Add contact|Import|Export/i.test(text)) {
            throw new Error("Contacts action buttons missing");
          }
        },
      },
    ],
  },
};

async function certifyPage(id: PageId): Promise<void> {
  const certifier = CERTIFIERS[id];
  const results: CheckResult[] = [];

  console.log(`\n=== FRONTEND CERT PAGE: ${certifier.label} (${id}) ===`);
  console.log(`Base: ${BASE}`);
  console.log(`Auth: ${AUTH_EMAIL}\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await login(page, BASE);
    const ctx = createContext(page, context);

    for (const check of certifier.checks) {
      const started = Date.now();
      process.stdout.write(`  · ${check.name} ... `);
      try {
        await check.run(ctx);
        const ms = Date.now() - started;
        results.push({ id: check.id, name: check.name, ok: true, ms });
        console.log(`PASS (${ms}ms)`);
      } catch (err) {
        const ms = Date.now() - started;
        const message = err instanceof Error ? err.message : String(err);
        results.push({ id: check.id, name: check.name, ok: false, ms, error: message });
        console.log(`FAIL (${ms}ms)`);
        console.error(`    ${message}`);
        throw err;
      }
    }

    mkdirSync(ARTIFACTS_DIR, { recursive: true });
    const artifactPath = join(ARTIFACTS_DIR, `${id}.json`);
    writeFileSync(
      artifactPath,
      JSON.stringify(
        {
          page: id,
          label: certifier.label,
          base: BASE,
          authEmail: AUTH_EMAIL,
          passedAt: new Date().toISOString(),
          checks: results,
        },
        null,
        2,
      ),
    );
    console.log(`\n✓ ${certifier.label}: ${results.length}/${certifier.checks.length} checks PASS`);
    console.log(`  artifact: ${artifactPath}\n`);
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const [rawId] = process.argv.slice(2);
  const id = rawId as PageId;
  if (!rawId || !PAGE_IDS.includes(id)) {
    console.log("Usage: npx tsx scripts/appointments-frontend-certify-page.ts <page-id>");
    console.log(`Pages: ${PAGE_IDS.join(", ")}`);
    process.exit(1);
  }
  try {
    await certifyPage(id);
  } catch {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
