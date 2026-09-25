/**
 * Low-memory visual audit screenshots (production or local — no Next build).
 * Usage:
 *   UI_AGENT_BASE_URL=<production-or-staging-base> npx tsx scripts/capture-mctb-voice-visual-audit.ts
 *   UI_AGENT_BASE_URL=<base> npx tsx scripts/capture-mctb-voice-visual-audit.ts --product mctb
 *   UI_AGENT_BASE_URL=<base> npx tsx scripts/capture-mctb-voice-visual-audit.ts --product voice
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const OUT_ROOT = process.env.VISUAL_AUDIT_DIR || "/opt/cursor/artifacts/screenshots/visual-audit";

const MCTB_ROUTES: Array<{ slug: string; path: string }> = [
  { slug: "mctb_01_overview", path: "/mctb" },
  { slug: "mctb_02_missed_calls", path: "/mctb/missed-calls" },
  { slug: "mctb_04_inbox", path: "/mctb/conversations" },
  { slug: "mctb_ai_recovery", path: "/mctb/ai-recovery" },
  { slug: "mctb_05_voicemail", path: "/mctb/voicemail" },
  { slug: "mctb_06_analytics", path: "/mctb/analytics" },
  { slug: "mctb_07_setup_overview", path: "/mctb/setup" },
  { slug: "mctb_08_setup_phone", path: "/mctb/setup/phone" },
  { slug: "mctb_09_setup_missed_call_rules", path: "/mctb/setup/missed-call-rules" },
  { slug: "mctb_10_setup_text_back", path: "/mctb/setup/text-back" },
  { slug: "mctb_11_setup_consent", path: "/mctb/setup/consent" },
  { slug: "mctb_12_setup_recovery", path: "/mctb/setup/recovery" },
  { slug: "mctb_setup_voicemail", path: "/mctb/setup/voicemail" },
  { slug: "mctb_setup_links", path: "/mctb/setup/links" },
  { slug: "mctb_setup_exclusions", path: "/mctb/setup/exclusions" },
  { slug: "mctb_setup_test", path: "/mctb/setup/test" },
];

const VOICE_ROUTES: Array<{ slug: string; path: string }> = [
  { slug: "voice_01_overview", path: "/voice/overview" },
  { slug: "voice_02_calls", path: "/voice/calls" },
  { slug: "voice_03_receptionist", path: "/voice/receptionist" },
  { slug: "voice_04_business_knowledge", path: "/voice/knowledge" },
  { slug: "voice_05_call_handling", path: "/voice/call-handling" },
  { slug: "voice_06_analytics", path: "/voice/analytics" },
];

function parseProductArg(): "all" | "mctb" | "voice" {
  const idx = process.argv.indexOf("--product");
  const v = idx >= 0 ? process.argv[idx + 1] : "all";
  if (v === "mctb" || v === "voice") return v;
  return "all";
}

async function authenticate(page: Page, nextPath: string) {
  const bypass = `${BASE_URL}/api/auth/dev-bypass?next=${encodeURIComponent(nextPath)}`;
  await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(1000);
}

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

async function captureRoute(page: Page, slug: string, path: string, outDir: string) {
  const url = `${BASE_URL}${path}`;
  console.log(`→ ${slug}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined);
  await dismissOverlays(page);
  await page.waitForTimeout(2000);
  const out = join(outDir, `${slug}.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log(`  ✓ ${out}`);
}

async function runBatch(routes: Array<{ slug: string; path: string }>, subdir: string) {
  const outDir = join(OUT_ROOT, subdir);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  try {
    await authenticate(page, routes[0]?.path ?? "/mctb");
    for (const route of routes) {
      await captureRoute(page, route.slug, route.path, outDir);
    }
    if (subdir === "mctb") {
      await page.goto(`${BASE_URL}/mctb/missed-calls`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(1500);
      const detailHref = await page
        .locator('a[href^="/mctb/missed-calls/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      if (detailHref?.includes("/mctb/missed-calls/")) {
        await captureRoute(page, "mctb_03_missed_call_detail", detailHref, outDir);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  const product = parseProductArg();
  mkdirSync(OUT_ROOT, { recursive: true });
  console.log(`Base: ${BASE_URL} | product: ${product} | out: ${OUT_ROOT}\n`);

  if (product === "all" || product === "mctb") {
    await runBatch(MCTB_ROUTES, "mctb");
  }
  if (product === "all" || product === "voice") {
    await runBatch(VOICE_ROUTES, "voice");
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
