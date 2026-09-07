/**
 * One-off: capture MCTB page screenshots for visual review.
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-mctb-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const OUT_DIR = process.env.MCTB_SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots/mctb";

const ROUTES: Array<{ slug: string; path: string }> = [
  { slug: "01_overview", path: "/mctb" },
  { slug: "02_missed_calls", path: "/mctb/missed-calls" },
  { slug: "04_conversations", path: "/mctb/conversations" },
  { slug: "05_voicemail", path: "/mctb/voicemail" },
  { slug: "06_analytics", path: "/mctb/analytics" },
  { slug: "07_setup_overview", path: "/mctb/setup" },
  { slug: "07_setup_wizard", path: "/mctb/setup/start" },
  { slug: "08_setup_phone", path: "/mctb/setup/phone" },
  { slug: "09_setup_missed_call_rules", path: "/mctb/setup/missed-call-rules" },
  { slug: "10_setup_text_back", path: "/mctb/setup/text-back" },
  { slug: "11_setup_consent", path: "/mctb/setup/consent" },
  { slug: "12_setup_recovery", path: "/mctb/setup/recovery" },
  { slug: "05_setup_voicemail", path: "/mctb/setup/voicemail" },
  { slug: "07_setup_test", path: "/mctb/setup/test" },
  { slug: "onboarding_mctb", path: "/onboarding/mctb" },
];

async function dismissOverlays(page: import("playwright").Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function waitForPageReady(page: import("playwright").Page, path: string) {
  await page
    .waitForFunction(
      () => {
        const text = document.body.innerText;
        return !text.includes("Loading setup") && !text.includes("Loading missed call");
      },
      { timeout: 45000 },
    )
    .catch(() => undefined);

  if (path === "/mctb") {
    await page
      .waitForFunction(
        () => !document.querySelector(".mctb-page-inner[aria-busy='true']"),
        { timeout: 60000 },
      )
      .catch(() => undefined);
    await page
      .getByText("Missed calls today")
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (path.startsWith("/mctb/setup/") && path !== "/mctb/setup/start") {
    await page
      .waitForFunction(
        () => {
          const text = document.body.innerText;
          return !text.includes("Loading…") && !text.includes("Loading...");
        },
        { timeout: 90000 },
      )
      .catch(() => undefined);
    await page
      .getByRole("button", { name: /save changes/i })
      .first()
      .waitFor({ state: "visible", timeout: 90000 })
      .catch(() => undefined);
  } else if (path === "/mctb/setup" || path === "/mctb/setup/start") {
    await page
      .waitForFunction(
        () => !document.querySelector('[aria-label="Loading setup"]'),
        { timeout: 60000 },
      )
      .catch(() => undefined);
  } else if (path === "/mctb/voicemail") {
    await page
      .getByText(/voicemail|No voicemails|Listen|Loading voicemail/i)
      .first()
      .waitFor({ state: "visible", timeout: 45000 })
      .catch(() => undefined);
    await page
      .waitForFunction(() => !document.body.innerText.includes("Loading voicemail"), { timeout: 30000 })
      .catch(() => undefined);
  } else if (path.includes("/mctb/conversations")) {
    await page
      .waitForFunction(() => !document.body.innerText.includes("Loading conversations"), { timeout: 90000 })
      .catch(() => undefined);
    const thread = page.locator("button, a, [role='button']").filter({ hasText: /Caller|6017|Hours Ago|Days Ago/i }).first();
    if (await thread.isVisible().catch(() => false)) {
      await thread.click().catch(() => undefined);
      await page.waitForTimeout(2000);
    }
  }

  await page.waitForTimeout(1500);
}

async function authenticate(page: import("playwright").Page, targetPath: string) {
  const bypass = `${BASE_URL}/api/auth/dev-bypass?next=${encodeURIComponent(targetPath)}`;
  await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1200);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // Auth once via overview
    await authenticate(page, "/mctb");

    // Resolve missed-call detail ID from list page
    await page.goto(`${BASE_URL}/mctb/missed-calls`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1500);
    const detailHref = await page
      .locator('table a[href^="/mctb/missed-calls/"], a[href^="/mctb/missed-calls/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    const detailPath = detailHref?.startsWith("/mctb/missed-calls/") ? detailHref : null;

    const allRoutes = [...ROUTES];
    if (detailPath) {
      allRoutes.splice(2, 0, { slug: "03_missed_call_detail", path: detailPath });
    }

    for (const route of allRoutes) {
      const url = `${BASE_URL}${route.path}`;
      console.log(`Capturing ${route.slug} → ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForLoadState("load").catch(() => undefined);
      await dismissOverlays(page);
      await waitForPageReady(page, route.path);
      const out = join(OUT_DIR, `mctb_${route.slug}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ ${out}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nDone. Screenshots in ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
