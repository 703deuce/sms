/**
 * Stage 1: one browser tab, sequential routes, count GET /api/call-handling.
 * Requires dev server on BASE_URL with DEV_AUTH_BYPASS=1.
 */
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const routes = ["/voice/overview", "/mctb", "/integrations"];

async function main() {
  const callHandlingGets = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: "unused",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  const page = await context.newPage();
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/call-handling") && req.method() === "GET") {
      callHandlingGets.push(url);
    }
  });

  await page.goto(`${BASE}/api/auth/dev-bypass`, { waitUntil: "networkidle", timeout: 120_000 });

  const results = [];
  for (const route of routes) {
    const res = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const shell = await page.locator('[data-newui-shell="true"]').count();
    results.push({ route, status: res?.status(), shellCount: shell });
    await page.waitForTimeout(1500);
  }

  await browser.close();
  console.log(
    JSON.stringify(
      {
        base: BASE,
        routes: results,
        getCallHandlingCount: callHandlingGets.length,
        getCallHandlingUrls: callHandlingGets,
      },
      null,
      2,
    ),
  );
  process.exit(callHandlingGets.length > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
