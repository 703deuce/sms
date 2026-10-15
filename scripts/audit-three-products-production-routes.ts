/**
 * Production route smoke: MCTB + Appointment Reminders + Campaigns + Reviews.
 *
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/audit-three-products-production-routes.ts
 *
 * Output default: /opt/cursor/artifacts/four-products-route-audit.json
 * Doc: docs/FOUR-PRODUCTS-USER-JOURNEY-E2E-AUDIT.md
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_JSON =
  process.env.AUDIT_OUT_JSON || "/opt/cursor/artifacts/four-products-route-audit.json";

type RouteDef = { product: string; tab?: string; path: string; label: string };

const ROUTES: RouteDef[] = [
  // —— MCTB service tabs ——
  { product: "MCTB", tab: "Activity", path: "/mctb", label: "Overview" },
  { product: "MCTB", tab: "Recovery Rules", path: "/mctb/missed-call-recovery", label: "Recovery Rules" },
  { product: "MCTB", tab: "Text Back", path: "/mctb/text-back", label: "Text Back" },
  { product: "MCTB", tab: "AI Recovery", path: "/mctb/ai-recovery", label: "AI Recovery" },
  { product: "MCTB", tab: "Phone Setup", path: "/mctb/phone", label: "Phone Setup" },
  { product: "MCTB", tab: "Analytics", path: "/mctb/analytics", label: "Analytics" },
  // MCTB inbox / ops (linked from unified Inbox)
  { product: "MCTB", path: "/mctb/missed-calls", label: "Missed Calls list" },
  { product: "MCTB", path: "/mctb/conversations", label: "Conversations" },
  { product: "MCTB", path: "/mctb/voicemail", label: "Voicemail inbox" },
  { product: "MCTB", path: "/mctb/notifications", label: "Notifications" },
  { product: "MCTB", path: "/mctb/compliance/consent", label: "Consent log" },
  { product: "MCTB", path: "/mctb/setup", label: "Setup (legacy redirect)" },
  { product: "MCTB", path: "/mctb/numbers", label: "Numbers redirect" },
  // —— AR service tabs ——
  { product: "AR", tab: "Calendar", path: "/appointment-reminders", label: "Calendar home" },
  { product: "AR", tab: "Appointments", path: "/appointment-reminders/appointments", label: "Appointments" },
  { product: "AR", tab: "Reminders", path: "/appointment-reminders/reminders", label: "Reminders log" },
  { product: "AR", tab: "Sequences", path: "/appointment-reminders/reminders/sequences", label: "Sequences" },
  { product: "AR", tab: "AI Rescheduler", path: "/appointment-reminders/ai-rescheduler", label: "AI Rescheduler" },
  { product: "AR", tab: "Analytics", path: "/appointment-reminders/analytics", label: "Analytics" },
  // AR adjacent
  { product: "AR", path: "/appointment-reminders/responses", label: "Responses inbox" },
  { product: "AR", path: "/appointment-reminders/responses?view=held", label: "Held replies" },
  { product: "AR", path: "/appointment-reminders/settings", label: "Settings" },
  { product: "AR", path: "/appointment-reminders/calendars", label: "Calendars" },
  { product: "AR", path: "/appointment-reminders/reminders/templates", label: "Reminder templates" },
  { product: "AR", path: "/appointment-reminders/setup/connect", label: "Setup connect" },
  { product: "AR", path: "/appointment-reminders/pricing", label: "Pricing" },
  // —— Campaigns service tabs ——
  { product: "Campaigns", tab: "All Campaigns", path: "/campaigns", label: "All campaigns" },
  { product: "Campaigns", tab: "Drafts", path: "/campaigns/drafts", label: "Drafts" },
  { product: "Campaigns", tab: "Scheduled", path: "/campaigns/scheduled", label: "Scheduled" },
  { product: "Campaigns", tab: "Completed", path: "/campaigns/completed", label: "Completed" },
  { product: "Campaigns", tab: "Templates", path: "/templates", label: "Templates" },
  { product: "Campaigns", tab: "Analytics", path: "/sms/analytics", label: "SMS analytics" },
  // Campaigns extra list routes
  { product: "Campaigns", path: "/campaigns/all", label: "All (alias)" },
  { product: "Campaigns", path: "/campaigns/sending", label: "Sending" },
  { product: "Campaigns", path: "/campaigns/paused", label: "Paused" },
  { product: "Campaigns", path: "/campaigns/failed", label: "Failed" },
  { product: "Campaigns", path: "/campaigns/canceled", label: "Canceled" },
  { product: "Campaigns", path: "/campaigns/recurring", label: "Recurring" },
  { product: "Campaigns", path: "/campaigns/calendar", label: "Calendar" },
  { product: "Campaigns", path: "/campaigns/new", label: "Create campaign" },
  { product: "Campaigns", path: "/campaigns/new/review", label: "Create review" },
  { product: "Campaigns", path: "/templates/new", label: "New template" },
  // —— Reviews (Reputation) ——
  { product: "Reviews", tab: "Overview", path: "/reviews/overview", label: "Overview" },
  { product: "Reviews", tab: "Requests", path: "/reviews/requests", label: "Requests" },
  { product: "Reviews", tab: "Campaigns", path: "/reviews/campaigns", label: "Review campaigns" },
  { product: "Reviews", tab: "Insights", path: "/reviews/insights", label: "Insights" },
  { product: "Reviews", tab: "Alerts", path: "/reviews/alerts", label: "Alerts" },
  { product: "Reviews", path: "/reviews/qr-campaigns", label: "QR campaigns list" },
  { product: "Reviews", path: "/reviews/qr-campaigns/new", label: "QR create type" },
  { product: "Reviews", path: "/reviews/qr-campaigns/new/review", label: "QR poster wizard" },
  { product: "Reviews", path: "/reviews/qr-campaigns/new/payment", label: "Pay & Review wizard" },
  { product: "Reviews", path: "/reviews/reviews", label: "Review feed" },
  { product: "Reviews", path: "/reviews/analytics", label: "Velocity" },
  { product: "Reviews", path: "/reviews/settings", label: "Settings" },
  { product: "Reviews", path: "/reviews/contacts", label: "Contacts" },
];

type Row = {
  product: string;
  tab?: string;
  path: string;
  label: string;
  finalUrl: string;
  redirected: boolean;
  httpStatus: number | null;
  pageTitle: string;
  hasLogin: boolean;
  errorUi: boolean;
  emptyShell: boolean;
  apiFailures: { url: string; status: number }[];
  consoleErrors: string[];
  verdict: "LOAD_OK" | "REDIRECT_OK" | "ERROR_UI" | "LOGIN" | "API_FAIL" | "NAV_FAIL";
};

const ERROR_PATTERNS = [
  /something went wrong/i,
  /application error/i,
  /internal server error/i,
  /failed to load/i,
  /could not load/i,
  /unhandled runtime error/i,
];

async function main() {
  if (
    !process.env.CERT_BROWSER_PASSWORD?.trim() &&
    !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()
  ) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }

  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email} at ${BASE_URL}`);
    process.exit(1);
  }

  mkdirSync(join(OUT_JSON, ".."), { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
    ignoreHTTPSErrors: true,
  });

  const results: Row[] = [];

  for (const route of ROUTES) {
    const page = await context.newPage();
    const apiFailures: { url: string; status: number }[] = [];
    const consoleErrors: string[] = [];

    page.on("response", (res) => {
      const url = res.url();
      const status = res.status();
      if (
        status >= 400 &&
        url.includes("/api/") &&
        !url.includes("/api/auth/") &&
        apiFailures.length < 8
      ) {
        apiFailures.push({ url: url.slice(0, 200), status });
      }
    });
    page.on("console", (msg) => {
      if (msg.type() === "error" && consoleErrors.length < 5) {
        consoleErrors.push(msg.text().slice(0, 300));
      }
    });

    let httpStatus: number | null = null;
    let finalUrl = "";
    let verdict: Row["verdict"] = "LOAD_OK";
    let errorUi = false;
    let hasLogin = false;
    let emptyShell = false;

    try {
      const res = await page.goto(`${BASE_URL}${route.path}`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      httpStatus = res?.status() ?? null;
      await page.waitForTimeout(2500);
      finalUrl = page.url();
      hasLogin = /\/login/.test(finalUrl);

      const bodyText = await page.locator("body").innerText().catch(() => "");
      errorUi = ERROR_PATTERNS.some((p) => p.test(bodyText));
      emptyShell =
        bodyText.length < 80 && !hasLogin && !errorUi;

      const redirected = finalUrl.replace(BASE_URL, "").split("?")[0] !== route.path.split("?")[0];

      if (hasLogin) verdict = "LOGIN";
      else if (errorUi) verdict = "ERROR_UI";
      else if (apiFailures.some((f) => f.status >= 500)) verdict = "API_FAIL";
      else if (apiFailures.filter((f) => f.status === 403 || f.status === 401).length >= 3)
        verdict = "API_FAIL";
      else if (redirected) verdict = "REDIRECT_OK";
      else verdict = "LOAD_OK";
    } catch (e) {
      errorUi = true;
      verdict = "NAV_FAIL";
      consoleErrors.push(String(e).slice(0, 300));
    }

    const title = await page.title().catch(() => "");

    results.push({
      product: route.product,
      tab: route.tab,
      path: route.path,
      label: route.label,
      finalUrl: finalUrl.replace(BASE_URL, ""),
      redirected: finalUrl.replace(BASE_URL, "").split("?")[0] !== route.path.split("?")[0],
      httpStatus,
      pageTitle: title,
      hasLogin,
      errorUi,
      emptyShell,
      apiFailures,
      consoleErrors,
      verdict,
    });

    console.log(`${route.product} ${route.path} → ${verdict} ${finalUrl.replace(BASE_URL, "")}`);
    await page.close();
  }

  await browser.close();
  writeFileSync(OUT_JSON, JSON.stringify({ baseUrl: BASE_URL, at: new Date().toISOString(), results }, null, 2));
  console.log(`Wrote ${OUT_JSON}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
