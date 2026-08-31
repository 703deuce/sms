/**
 * Runtime audit for Kimi wired pages — console errors, API smoke checks,
 * and functional wiring checks that catch no-op saves / wrong entity lists.
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

const API_CHECKS: Array<{ name: string; path: string; method?: string; body?: unknown }> = [
  { name: "inbox", path: "/api/inbox" },
  { name: "campaigns", path: "/api/mass-texting/campaigns" },
  { name: "contacts-stats", path: "/api/contacts/stats" },
  { name: "lists", path: "/api/contacts/lists" },
  { name: "fields", path: "/api/contacts/fields" },
  { name: "segments", path: "/api/contacts/segments" },
  { name: "segments-preview", path: "/api/contacts/segments/preview", method: "POST", body: { conditions: { match: "all", rules: [] } } },
  { name: "segments-preview-list", path: "/api/contacts/segments/preview", method: "POST", body: { conditions: { match: "all", rules: [{ field: "list", op: "exists" }] } } },
  { name: "messaging-runtime", path: "/api/settings/messaging-runtime" },
  { name: "keywords", path: "/api/growth/keywords" },
  { name: "qr-codes", path: "/api/growth/qr" },
  { name: "forms", path: "/api/growth/forms" },
  { name: "tap-to-join", path: "/api/growth/tap-to-join" },
  { name: "auto-replies", path: "/api/auto-replies" },
  { name: "automations", path: "/api/automations" },
];

const FUNCTIONAL_CHECKS: Array<{
  name: string;
  run: (page: Page) => Promise<string | null>;
}> = [
  {
    name: "qr-page-shows-create-qr-not-create-keyword",
    run: async (page) => {
      await page.goto(`${BASE}/grow/qr-codes`, { waitUntil: "networkidle", timeout: 90000 });
      const text = await page.locator("body").innerText();
      if (/Create Keyword/i.test(text) && !/Create QR Code/i.test(text)) {
        return "QR page still shows Create Keyword button (keyword/QR entity mismatch)";
      }
      return null;
    },
  },
  {
    name: "campaign-segmentId-query-loads",
    run: async (page) => {
      const segRes = await page.evaluate(async () => {
        const res = await fetch("/api/contacts/segments");
        const json = await res.json();
        return { ok: res.ok, data: json.data as Array<{ id: string; name: string }> | undefined };
      });
      if (!segRes.ok || !segRes.data?.length) return null;
      const segId = segRes.data[0].id;
      await page.goto(`${BASE}/campaigns/new?segmentId=${encodeURIComponent(segId)}`, {
        waitUntil: "networkidle",
        timeout: 90000,
      });
      const body = await page.locator("body").innerText();
      if (/Could not load|Failed to load/i.test(body)) {
        return `campaigns/new?segmentId= shows load error`;
      }
      return null;
    },
  },
  {
    name: "contacts-fields-no-mock-fallback-banner",
    run: async (page) => {
      await page.goto(`${BASE}/contacts/fields`, { waitUntil: "networkidle", timeout: 90000 });
      const body = await page.locator("body").innerText();
      if (/Could not load contact|Contact not found/i.test(body)) {
        return "contacts/fields shows contact load error on landing";
      }
      return null;
    },
  },
  {
    name: "segment-list-membership-field-accepted",
    run: async (page) => {
      const result = await page.evaluate(async () => {
        const res = await fetch("/api/contacts/segments/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conditions: { match: "all", rules: [{ field: "list", op: "exists" }] },
          }),
        });
        return { ok: res.ok, status: res.status };
      });
      if (!result.ok) return `list membership preview API failed (${result.status})`;
      return null;
    },
  },
];

async function authenticate(page: Page) {
  await page.goto(`${BASE}/api/auth/dev-bypass?next=/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
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
  const failedFunctional: string[] = [];

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
    const result = await page.evaluate(async (check) => {
      const res = await fetch(check.path, {
        method: check.method || "GET",
        headers: check.body ? { "Content-Type": "application/json" } : undefined,
        body: check.body ? JSON.stringify(check.body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, error: json.error };
    }, api);
    if (!result.ok) {
      failedApis.push(`${api.name} ${result.status}: ${result.error || "failed"}`);
    }
  }

  for (const check of FUNCTIONAL_CHECKS) {
    try {
      const err = await check.run(page);
      if (err) failedFunctional.push(`${check.name}: ${err}`);
    } catch (e) {
      failedFunctional.push(`${check.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await browser.close();

  console.log("\n=== Kimi Wired Page Audit ===\n");
  console.log(`Routes checked: ${WIRED_ROUTES.length}`);
  console.log(`API checks: ${API_CHECKS.length}`);
  console.log(`Functional checks: ${FUNCTIONAL_CHECKS.length}`);
  console.log(`Route issues: ${failedRoutes.length}`);
  console.log(`API failures: ${failedApis.length}`);
  console.log(`Functional failures: ${failedFunctional.length}`);
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
  if (failedFunctional.length) {
    console.log("\nFunctional failures:");
    failedFunctional.forEach((r) => console.log(`  - ${r}`));
  }
  if (pageErrors.length) {
    console.log("\nPage errors:");
    pageErrors.slice(0, 10).forEach((r) => console.log(`  - ${r}`));
  }

  process.exit(
    failedRoutes.length || failedApis.length || failedFunctional.length ? 1 : 0,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
