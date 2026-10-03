/**
 * Verifies main content scrolls on narrow viewport (mobile) for key MCTB routes.
 * Run: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/test-mobile-scroll-mctb.ts
 */
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://127.0.0.1:3000";
const ROUTES = [
  "/mctb",
  "/mctb/missed-calls",
  "/mctb/setup",
  "/mctb/setup/phone",
  "/mctb/analytics",
  "/mctb/voicemail",
];

async function canScroll(page: import("playwright").Page): Promise<{ ok: boolean; detail: string }> {
  const result = await page.evaluate(() => {
    const candidates = [
      document.querySelector("[data-slot='sidebar-inset'] > div:last-child"),
      document.querySelector("main"),
      document.documentElement,
    ].filter(Boolean) as HTMLElement[];

    for (const el of candidates) {
      const before = el.scrollTop;
      el.scrollTop = before + 400;
      const after = el.scrollTop;
      if (after > before) {
        return { ok: true, detail: `${el.tagName} scrollTop ${before}->${after}` };
      }
    }
    const docH = document.documentElement.scrollHeight;
    const winH = window.innerHeight;
    if (docH <= winH + 8) {
      return { ok: true, detail: `short page (${docH}px)` };
    }
    const bodyOverflow = document.body.style.overflow;
    return { ok: false, detail: `no scroll; body.overflow=${bodyOverflow}; doc ${docH} vs ${winH}` };
  });
  return result;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  try {
    await page.goto(`${BASE}/api/auth/dev-bypass`, { waitUntil: "commit", timeout: 180_000 });
    await page.waitForTimeout(2000);
  } catch {
    console.warn("dev-bypass slow or unavailable; continuing unauthenticated");
  }

  let failed = 0;
  for (const route of ROUTES) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "commit", timeout: 180_000 });
      await page.waitForTimeout(1200);
    } catch (e) {
      console.log(`FAIL ${route} — navigation: ${(e as Error).message}`);
      failed += 1;
      continue;
    }
    let scroll: { ok: boolean; detail: string };
    try {
      scroll = await canScroll(page);
    } catch (e) {
      console.log(`FAIL ${route} — evaluate: ${(e as Error).message}`);
      failed += 1;
      continue;
    }
    const status = scroll.ok ? "PASS" : "FAIL";
    console.log(`${status} ${route} — ${scroll.detail}`);
    if (!scroll.ok) failed += 1;
  }

  await browser.close();
  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} route(s) failed mobile scroll check`);
  } else {
    console.log("\nAll routes passed mobile scroll check");
  }
}

void main();
