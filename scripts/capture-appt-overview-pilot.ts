/**
 * Appointments pilot screenshots — overview + four-object booking pages.
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-appt-overview-pilot.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
const AUTH_EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || "appt-mctb-browser@transovo.test";

type Shot = {
  file: string;
  path: string;
  viewport?: { width: number; height: number };
  waitFor?: string;
  heading?: string;
};

const SHOTS: Shot[] = [
  {
    file: "appointments-overview-art-direction.png",
    path: "/appointments/overview",
    waitFor: ".appt-overview-pilot .ref-deco-kpi",
    heading: "Overview",
  },
  {
    file: "services-desktop.png",
    path: "/appointments/services",
    waitFor: ".reference-root",
    heading: "Services",
  },
  {
    file: "meetings-desktop.png",
    path: "/appointments/meetings",
    waitFor: ".reference-root",
    heading: "Meetings",
  },
  {
    file: "classes-desktop.png",
    path: "/appointments/classes",
    waitFor: ".reference-root, [class*='class-series']",
    heading: "Classes",
  },
  {
    file: "workshops-desktop.png",
    path: "/appointments/workshops",
    waitFor: ".reference-root, [class*='class-series']",
    heading: "Workshops",
  },
];

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function authenticate(page: Page) {
  const bypass = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent("/appointments/overview")}`;
  const res = await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (res && res.status() >= 400) {
    throw new Error(`dev-bypass failed with HTTP ${res.status()}`);
  }
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
}

async function waitForPageReady(page: Page, shot: Shot) {
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), undefined, {
    timeout: 90000,
  }).catch(() => undefined);

  if (shot.waitFor) {
    await page.waitForSelector(shot.waitFor, { timeout: 90000 });
  }

  if (shot.heading) {
    await page.getByRole("heading", { name: shot.heading }).first().waitFor({
      state: "visible",
      timeout: 90000,
    }).catch(() => undefined);
  }

  await page.waitForTimeout(1200);
}

async function captureShot(page: Page, shot: Shot) {
  if (shot.viewport) {
    await page.setViewportSize(shot.viewport);
  } else {
    await page.setViewportSize({ width: 1440, height: 900 });
  }

  const response = await page.goto(`${BASE}${shot.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  if (response && response.status() >= 400) {
    throw new Error(`${shot.path} returned HTTP ${response.status()}`);
  }

  await waitForPageReady(page, shot);
  await page.reload({ waitUntil: "networkidle", timeout: 120000 }).catch(() => undefined);
  await waitForPageReady(page, shot);
  await dismissOverlays(page);

  const accentRgb = await page.evaluate(() => {
    const el = document.querySelector(".appt-pilot-primary-btn, .appt-overview-pilot .ref-deco-kpi:first-child::before");
    if (!el) return null;
    return getComputedStyle(el as Element).backgroundColor;
  });
  if (accentRgb) {
    console.log(`  accent computed: ${accentRgb}`);
  }

  const file = join(OUT, shot.file);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`saved ${file}`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    bypassCSP: true,
  });
  // Force fresh CSS — dev server HMR can lag behind file writes during batch captures.
  await context.route("**/*", async (route) => {
    const headers = { ...route.request().headers(), "cache-control": "no-cache" };
    await route.continue({ headers });
  });
  const page = await context.newPage();

  try {
    await authenticate(page);
    for (const shot of SHOTS) {
      console.log(`capturing ${shot.path} → ${shot.file}`);
      await captureShot(page, shot);
    }
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
