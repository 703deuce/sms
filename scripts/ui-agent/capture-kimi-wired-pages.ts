/**
 * Capture one full-page screenshot per Kimi wired route (verification).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3456";
const OUT = "/opt/cursor/artifacts/kimi-wired-pages-verify";

const ROUTES: { path: string; label: string }[] = [
  { path: "/conversations", label: "conversations" },
  { path: "/campaigns", label: "campaigns" },
  { path: "/contacts", label: "contacts" },
  { path: "/contacts/imports", label: "contacts-imports" },
  { path: "/contacts/lists", label: "contacts-lists" },
  { path: "/contacts/fields", label: "contacts-fields" },
  { path: "/contacts/segments", label: "contacts-segments" },
  { path: "/grow/keywords", label: "grow-keywords" },
  { path: "/grow/qr-codes", label: "grow-qr-codes" },
  { path: "/grow/tap-to-join", label: "grow-tap-to-join" },
  { path: "/grow/forms", label: "grow-forms" },
  { path: "/auto-replies", label: "auto-replies" },
  { path: "/messaging/media", label: "messaging-media" },
  { path: "/automations", label: "automations" },
];

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const bypass = `${BASE}/api/auth/dev-bypass?next=${encodeURIComponent("/dashboard")}`;
  await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);

  const results: string[] = [];
  for (const route of ROUTES) {
    const url = `${BASE}${route.path}`;
    console.log(`Capturing ${route.label} → ${url}`);
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(1500);
      const outPath = join(OUT, `${route.label}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      results.push(outPath);
      console.log(`  OK ${outPath}`);
    } catch (err) {
      console.error(`  FAIL ${route.label}:`, err instanceof Error ? err.message : err);
    }
  }

  await browser.close();
  console.log(`\nCaptured ${results.length}/${ROUTES.length} screenshots in ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
