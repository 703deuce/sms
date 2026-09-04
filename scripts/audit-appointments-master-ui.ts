/**
 * Walk Appointments master (60335682) primary + preserved routes.
 * Run: npx tsx scripts/audit-appointments-master-ui.ts
 */
import { chromium } from "playwright";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

const PRIMARY_ROUTES = [
  { path: "/appointments/overview", label: "Overview" },
  { path: "/appointments/calendar", label: "Calendar" },
  { path: "/appointments", label: "Scheduled" },
  { path: "/appointments/types", label: "Types" },
  { path: "/appointments/reminders", label: "Reminders" },
  { path: "/appointments/booking", label: "Booking" },
  { path: "/appointments/setup", label: "Setup" },
  { path: "/appointments/analytics", label: "Analytics" },
  { path: "/conversations", label: "Conversations" },
  { path: "/contacts", label: "Contacts" },
  { path: "/numbers", label: "Numbers" },
  { path: "/compliance", label: "Compliance" },
  { path: "/settings", label: "Settings" },
];

const PRESERVED_ROUTES = [
  { path: "/campaigns", label: "Campaigns (hidden nav)" },
  { path: "/voice/missed-calls", label: "MCTB Missed Calls (hidden nav)" },
  { path: "/fax/overview", label: "Fax (hidden nav)" },
  { path: "/dashboard", label: "Dashboard redirect" },
  { path: "/app", label: "App launcher redirect" },
];

type Row = {
  path: string;
  label: string;
  finalUrl: string;
  status: number;
  title: string;
  navVisible: string[];
  bodySnippet: string;
  error?: string;
};

async function login(page: import("playwright").Page) {
  await page.goto(`${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/appointments/overview")}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(2000);
}

async function auditRoute(
  page: import("playwright").Page,
  route: { path: string; label: string },
): Promise<Row> {
  const response = await page.goto(`${BASE}${route.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForTimeout(1500);

  const finalUrl = page.url().replace(BASE, "");
  const status = response?.status() ?? 0;
  const title = await page.title().catch(() => "");
  const bodyText = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").trim();

  const navLabels = await page
    .locator("nav a, aside a")
    .allInnerTexts()
    .catch(() => []);
  const navVisible = [...new Set(navLabels.map((t) => t.trim()).filter(Boolean))].slice(0, 20);

  const error =
    bodyText.match(/Application error|Internal Server Error|500|not found/i)?.[0] ||
    (status >= 400 ? `HTTP ${status}` : undefined);

  return {
    path: route.path,
    label: route.label,
    finalUrl,
    status,
    title,
    navVisible,
    bodySnippet: bodyText.slice(0, 180),
    error,
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`\n=== Appointments Master UI Audit (${BASE}) ===\n`);

  try {
    await login(page);
    console.log(`Logged in → ${page.url().replace(BASE, "")}\n`);
  } catch (err) {
    console.error("Login failed:", err);
    await browser.close();
    process.exit(1);
  }

  const rows: Row[] = [];

  console.log("--- PRIMARY SHELL ---");
  for (const route of PRIMARY_ROUTES) {
    const row = await auditRoute(page, route);
    rows.push(row);
    const flag = row.error ? "FAIL" : "OK";
    console.log(`${flag}  ${route.label.padEnd(14)} ${route.path} → ${row.finalUrl} [${row.status}]`);
    if (row.error) console.log(`     ${row.error}: ${row.bodySnippet.slice(0, 100)}`);
  }

  console.log("\n--- PRESERVED / REDIRECTS ---");
  for (const route of PRESERVED_ROUTES) {
    const row = await auditRoute(page, route);
    rows.push(row);
    const flag = row.error ? "FAIL" : "OK";
    console.log(`${flag}  ${route.label.padEnd(28)} ${route.path} → ${row.finalUrl} [${row.status}]`);
    if (row.error) console.log(`     ${row.error}`);
  }

  const primaryNav = rows.find((r) => r.path === "/appointments/overview")?.navVisible ?? [];
  console.log("\n--- SIDEBAR LABELS (from Overview) ---");
  console.log(primaryNav.join(" · ") || "(none captured)");

  const failed = rows.filter((r) => r.error);
  console.log(`\n${rows.length - failed.length}/${rows.length} routes loaded without obvious errors`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
