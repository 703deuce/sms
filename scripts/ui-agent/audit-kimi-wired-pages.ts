/**
 * Runtime audit for Kimi wired pages — console errors + API smoke checks.
 */
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3456";

const WIRED_ROUTES = [
  "/conversations",
  "/campaigns",
  "/campaigns/new",
  "/campaigns/new/review",
  "/contacts",
  "/contacts/imports",
  "/contacts/lists",
  "/contacts/fields",
  "/contacts/segments",
  "/grow/keywords",
  "/grow/qr-codes",
  "/grow/tap-to-join",
  "/grow/forms",
  "/auto-replies",
  "/auto-replies/new",
  "/messaging/media",
  "/messaging/media?create=1",
  "/automations",
];

const API_CHECKS: Array<{ name: string; path: string; method?: string }> = [
  { name: "inbox", path: "/api/inbox" },
  { name: "campaigns", path: "/api/mass-texting/campaigns" },
  { name: "contacts", path: "/api/contacts?take=5" },
  { name: "lists", path: "/api/contacts/lists" },
  { name: "fields", path: "/api/contacts/fields" },
  { name: "segments", path: "/api/contacts/segments" },
  { name: "keywords", path: "/api/growth/keywords" },
  { name: "forms", path: "/api/growth/forms" },
  { name: "tap-to-join", path: "/api/growth/tap-to-join" },
  { name: "auto-replies", path: "/api/auto-replies" },
  { name: "automations", path: "/api/automations" },
];

async function authenticate(page: Page) {
  await page.goto(`${BASE}/api/auth/dev-bypass?next=/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRoutes: string[] = [];
  const failedApis: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await authenticate(page);

  for (const route of WIRED_ROUTES) {
    const errorsBefore = consoleErrors.length;
    try {
      const res = await page.goto(`${BASE}${route}`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      await page.waitForTimeout(800);
      if (!res || res.status() >= 400) {
        failedRoutes.push(`${route} HTTP ${res?.status() ?? "?"}`);
      }
      const bodyText = await page.locator("body").innerText();
      if (/Could not load|Failed to load|Loading…$/.test(bodyText.slice(0, 500))) {
        // still loading or hard error banner — flag if error text present
        if (/Could not load|Failed to load/.test(bodyText)) {
          failedRoutes.push(`${route} error UI`);
        }
      }
    } catch (err) {
      failedRoutes.push(`${route}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
    }
    const newErrors = consoleErrors.slice(errorsBefore).filter(
      (e) => !e.includes("favicon") && !e.includes("404") && !e.includes("hydration"),
    );
    if (newErrors.length) {
      failedRoutes.push(`${route} console: ${newErrors[0].slice(0, 120)}`);
    }
  }

  for (const api of API_CHECKS) {
    const result = await page.evaluate(async (path) => {
      const res = await fetch(path);
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, error: json.error };
    }, api.path);
    if (!result.ok) {
      failedApis.push(`${api.name} ${result.status}: ${result.error || "failed"}`);
    }
  }

  await browser.close();

  console.log("\n=== Kimi Wired Page Audit ===\n");
  console.log(`Routes checked: ${WIRED_ROUTES.length}`);
  console.log(`API checks: ${API_CHECKS.length}`);
  console.log(`Route issues: ${failedRoutes.length}`);
  console.log(`API failures: ${failedApis.length}`);
  console.log(`Page errors: ${pageErrors.length}`);
  console.log(`Console errors (total): ${consoleErrors.length}`);

  if (failedRoutes.length) {
    console.log("\nRoute issues:");
    failedRoutes.forEach((r) => console.log(`  - ${r}`));
  }
  if (failedApis.length) {
    console.log("\nAPI failures:");
    failedApis.forEach((r) => console.log(`  - ${r}`));
  }
  if (pageErrors.length) {
    console.log("\nPage errors:");
    pageErrors.slice(0, 10).forEach((r) => console.log(`  - ${r}`));
  }

  process.exit(failedRoutes.length || failedApis.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
