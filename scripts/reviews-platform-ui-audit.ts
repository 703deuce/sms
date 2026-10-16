/**
 * Reviews product UI audit — visits canonical /reviews/* routes, records load/API errors.
 *
 *   UI_AGENT_BASE_URL=https://transovo.ai \
 *   DEV_AUTH_BYPASS=1 DEV_AUTH_BYPASS_EMAIL=anthony@transovo.ai \
 *   npx tsx scripts/reviews-platform-ui-audit.ts
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { request } from "playwright";

const BASE = (process.env.UI_AGENT_BASE_URL || "https://transovo.ai").replace(/\/$/, "");

async function authenticateReviews(baseUrl: string) {
  const email =
    process.env.DEV_AUTH_BYPASS_EMAIL?.trim() ||
    process.env.UI_AGENT_SMOKE_EMAIL?.trim() ||
    "703deuce@gmail.com";
  const api = await request.newContext({ baseURL: baseUrl });
  const paths = [
    `/api/auth/cert-browser-session?email=${encodeURIComponent(email)}&next=/reviews/overview`,
    `/api/auth/dev-bypass?email=${encodeURIComponent(email)}&next=/reviews/overview`,
  ];
  for (const path of paths) {
    const res = await api.get(path, { maxRedirects: 0 });
    if (res.ok() || [302, 307, 308].includes(res.status())) {
      const storageState = await api.storageState();
      await api.dispose();
      return { ok: true, storageState, email };
    }
  }
  await api.dispose();
  return { ok: false, storageState: undefined, email };
}
const OUT_DIR = process.env.REVIEWS_AUDIT_ARTIFACTS || "/opt/cursor/artifacts/reviews-audit";

const ROUTES = [
  "/reviews/overview",
  "/reviews/requests",
  "/reviews/campaigns",
  "/reviews/templates",
  "/reviews/contacts",
  "/reviews/automations",
  "/reviews/qr-campaigns",
  "/reviews/qr-campaigns/new",
  "/reviews/qr-campaigns/new/review",
  "/reviews/qr-campaigns/new/payment",
  "/reviews/qr-campaigns/plans",
  "/reviews/qr",
  "/reviews/reviews",
  "/reviews/feed",
  "/reviews/analytics",
  "/reviews/velocity",
  "/reviews/insights",
  "/reviews/competitors",
  "/reviews/alerts",
  "/reviews/audit",
  "/reviews/settings",
  "/tools/review-velocity",
];

type RouteResult = {
  path: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  httpStatus: number | null;
  title: string;
  apiErrors: string[];
  consoleErrors: string[];
  legacyLinks: number;
  notes: string[];
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const auth = await authenticateReviews(BASE);
  if (!auth.ok || !auth.storageState) {
    console.error("AUTH_FAILED — set DEV_AUTH_BYPASS or CERT_BROWSER_PASSWORD");
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: BASE,
    storageState: auth.storageState,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const results: RouteResult[] = [];

  for (const path of ROUTES) {
    const apiErrors: string[] = [];
    const consoleErrors: string[] = [];
    const notes: string[] = [];

    const onResponse = (res: { url: () => string; status: () => number; request: () => { method: () => string } }) => {
      const url = res.url();
      if (!url.includes("/api/")) return;
      const st = res.status();
      if (st >= 400) {
        apiErrors.push(`${res.request().method()} ${st} ${url.slice(0, 120)}`);
      }
    };
    const onConsole = (msg: { type: () => string; text: () => string }) => {
      if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
    };

    page.on("response", onResponse);
    page.on("console", onConsole);

    let httpStatus: number | null = null;
    let title = "";
    try {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded", timeout: 60_000 });
      httpStatus = resp?.status() ?? null;
      await page.waitForTimeout(1500);
      title = await page.title();
      const legacyLinks = await page.locator('a[href*="/businesses/"]').count();
      const bodyText = await page.locator("body").innerText();
      if (/coming soon/i.test(bodyText) && path.includes("reviews")) {
        notes.push("Page mentions Coming soon");
      }
      if (/upgrade/i.test(bodyText.toLowerCase()) && path.includes("requests")) {
        notes.push("Upgrade gate visible");
      }
      results.push({
        path,
        status: httpStatus && httpStatus < 400 ? "PASS" : "FAIL",
        httpStatus,
        title,
        apiErrors: [...new Set(apiErrors)].slice(0, 8),
        consoleErrors: [...new Set(consoleErrors)].slice(0, 5),
        legacyLinks,
        notes,
      });
    } catch (e) {
      results.push({
        path,
        status: "FAIL",
        httpStatus,
        title,
        apiErrors: [...new Set(apiErrors)],
        consoleErrors: [...new Set(consoleErrors), String(e)].slice(0, 5),
        legacyLinks: 0,
        notes: ["navigation_error"],
      });
    }

    page.removeListener("response", onResponse);
    page.removeListener("console", onConsole);

    try {
      await page.screenshot({
        path: join(OUT_DIR, path.replace(/\//g, "_") + ".png"),
        fullPage: false,
      });
    } catch {
      /* ignore */
    }
  }

  // Requests tabs
  try {
    await page.goto("/reviews/requests", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const tabs = ["Send", "Bulk", "QR", "Link", "Tracking", "Poster"];
    for (const tab of tabs) {
      const btn = page.getByRole("button", { name: new RegExp(tab, "i") }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 5000 }).catch(() => undefined);
        await page.waitForTimeout(800);
      }
    }
    await page.screenshot({ path: join(OUT_DIR, "requests_tabs.png"), fullPage: false });
  } catch {
    /* ignore */
  }

  await browser.close();

  const summary = {
    auditedAt: new Date().toISOString(),
    baseUrl: BASE,
    email: auth.email,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    routes: results,
  };

  writeFileSync(join(OUT_DIR, "audit.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail, out: OUT_DIR }, null, 2));
  for (const r of results) {
    const flag = r.status === "PASS" ? "✓" : "✗";
    const apis = r.apiErrors.length ? ` API:${r.apiErrors.length}` : "";
    const legacy = r.legacyLinks ? ` legacyLinks:${r.legacyLinks}` : "";
    console.log(`${flag} ${r.path}${apis}${legacy} ${r.notes.join("; ")}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
