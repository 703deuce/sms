/**
 * Quick visual sample of MCTB Opus surfaces (post-reconciliation).
 * DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://127.0.0.1:3000 npx tsx scripts/capture-mctb-opus-sample-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://127.0.0.1:3000";
const OUT = process.env.OUT_DIR?.trim() || "/opt/cursor/artifacts";

const ROUTES: Array<{ name: string; path: string }> = [
  { name: "mctb_opus_overview", path: "/mctb" },
  { name: "mctb_getting_started", path: "/getting-started" },
  { name: "mctb_opus_missed_call_recovery", path: "/mctb/missed-call-recovery" },
  { name: "mctb_opus_text_back_ia", path: "/mctb/text-back" },
  { name: "mctb_opus_notifications", path: "/mctb/notifications" },
  { name: "mctb_opus_phone", path: "/mctb/phone" },
  { name: "mctb_opus_setup_overview", path: "/mctb/setup" },
  { name: "mctb_opus_text_back", path: "/mctb/setup/text-back" },
  { name: "mctb_opus_consent", path: "/mctb/setup/consent" },
];

async function waitReady(page: import("playwright").Page, path: string) {
  await page.waitForLoadState("load").catch(() => undefined);
  await page.waitForTimeout(1200);

  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }

  if (path === "/getting-started") {
    await page
      .getByRole("heading", { name: /getting started/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
    await page
      .getByText(/essential setup|missed-call recovery/i)
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (path === "/mctb") {
    await page
      .getByRole("heading", { name: /overview/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
    await page
      .getByText(/missed calls today|needs attention/i)
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (path === "/mctb/missed-call-recovery") {
    await page
      .getByRole("heading", { name: /missed-call recovery/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
    await page.getByRole("tab", { name: /general/i }).waitFor({ state: "visible", timeout: 30000 }).catch(() => undefined);
  } else if (path === "/mctb/text-back") {
    await page
      .getByRole("heading", { name: /text back/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (path === "/mctb/notifications") {
    await page
      .getByRole("heading", { name: /notifications/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (path === "/mctb/phone") {
    await page
      .getByRole("heading", { name: /phone & forwarding/i })
      .first()
      .waitFor({ state: "visible", timeout: 60000 })
      .catch(() => undefined);
  } else if (path.startsWith("/mctb/setup")) {
    await page
      .waitForFunction(
        () => {
          const text = document.body.innerText;
          return !text.includes("Loading setup") && !text.includes("Loading…");
        },
        { timeout: 90000 },
      )
      .catch(() => undefined);
    await page
      .getByRole("button", { name: /save changes/i })
      .first()
      .waitFor({ state: "visible", timeout: 90000 })
      .catch(() => undefined);
  }

  await page.waitForTimeout(600);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/mctb")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(1500);

  for (const route of ROUTES) {
    console.log(`Capturing ${route.name} → ${route.path}`);
    await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitReady(page, route.path);
    const out = join(OUT, `${route.name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`  ✓ ${out}`);
  }

  await browser.close();
  console.log(`Done. ${ROUTES.length} screenshots in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
