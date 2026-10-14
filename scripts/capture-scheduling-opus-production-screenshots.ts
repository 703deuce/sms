/**
 * Capture advanced scheduling Opus pages from production.
 *
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-scheduling-opus-production-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.SCHEDULING_SCREENSHOT_DIR || "/opt/cursor/artifacts/scheduling-opus-prod";
const PUBLIC_SLUG = process.env.SCHEDULING_PUBLIC_SLUG?.trim() || "harbor-home";

const ROUTES = [
  { slug: "sell-hub", path: "/appointments/sell" },
  { slug: "scheduling-overview", path: "/appointments/scheduling" },
  { slug: "package-wizard", path: "/appointments/packages/new" },
  { slug: "membership-wizard", path: "/appointments/memberships/new" },
  { slug: "service-wizard", path: "/appointments/services/new" },
  { slug: "class-wizard", path: "/appointments/classes/new" },
  { slug: "workshop-wizard", path: "/appointments/workshops/new" },
  { slug: "classes-workspace", path: "/appointments/classes" },
  { slug: "packages-list", path: "/appointments/packages" },
  { slug: "public-store", path: `/book/${PUBLIC_SLUG}/store` },
  { slug: "public-classes", path: `/book/${PUBLIC_SLUG}/classes` },
];

async function main() {
  if (process.env.SCHEDULING_SCREENSHOT_DEV_BYPASS?.trim() === "1") {
    process.env.DEV_AUTH_BYPASS = "1";
    delete process.env.DEV_AUTH_BYPASS_EMAIL;
  }
  const useBypass =
    process.env.DEV_AUTH_BYPASS?.trim() === "1" ||
    process.env.DEV_AUTH_BYPASS?.trim()?.toLowerCase() === "true";
  if (
    !useBypass &&
    !process.env.CERT_BROWSER_PASSWORD?.trim() &&
    !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()
  ) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
    console.warn("Using default cert browser password — set CERT_BROWSER_PASSWORD for other accounts.");
  }

  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email} at ${BASE_URL}`);
    process.exit(1);
  }

  const viewports: Array<{ label: string; width: number; height: number }> = [
    { label: "desktop-1440", width: 1440, height: 900 },
    { label: "mobile-390", width: 390, height: 844 },
  ];
  const only = process.env.SCHEDULING_SCREENSHOT_VIEWPORT?.trim();
  const activeViewports = only
    ? viewports.filter((v) => v.label.includes(only) || String(v.width) === only)
    : viewports;

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  for (const vp of activeViewports) {
    const vpDir = join(OUT_DIR, vp.label);
    mkdirSync(vpDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      storageState: auth.storageState,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

  const dismissProductSwitcherOnboarding = async () => {
    await page.evaluate(() => {
      try {
        window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
      } catch {
        // ignore
      }
    });
    const gotIt = page.getByRole("button", { name: "Got it" });
    if (await gotIt.isVisible().catch(() => false)) {
      await gotIt.click();
      await page.waitForTimeout(300);
    }
  };

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route.path}`;
      console.log(`Capturing [${vp.label}] ${route.slug} → ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      await dismissProductSwitcherOnboarding();
      await page.waitForTimeout(3000);
      const out = join(vpDir, `${route.slug}.png`);
      await page.screenshot({ path: out, fullPage: true });
      console.log(`  ✓ ${out}`);
    }
    await context.close();
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
