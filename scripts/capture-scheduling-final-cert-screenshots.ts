/**
 * Extended scheduling UI certification captures (connected app).
 *
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/capture-scheduling-final-cert-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";
const OUT_DIR = process.env.SCHEDULING_SCREENSHOT_DIR || "/opt/cursor/artifacts/scheduling-final-cert";
const PUBLIC_SLUG = process.env.SCHEDULING_PUBLIC_SLUG?.trim() || "harbor-home";

type Shot = { slug: string; path: string; setup?: (page: Page) => Promise<void> };

const STATIC: Shot[] = [
  { slug: "01-scheduling-overview", path: "/appointments/scheduling" },
  { slug: "02-sell-menu", path: "/appointments/sell" },
  { slug: "03-packages-catalog", path: "/appointments/packages" },
  { slug: "04-classes-catalog", path: "/appointments/classes" },
  { slug: "05-services-catalog", path: "/appointments/services" },
  { slug: "06-workshops-catalog", path: "/appointments/workshops" },
  { slug: "07-memberships-catalog", path: "/appointments/memberships" },
  { slug: "08-package-wizard-step-1", path: "/appointments/packages/new" },
  { slug: "12-class-wizard-step-1", path: "/appointments/classes/new" },
  { slug: "16-service-wizard", path: "/appointments/services/new" },
  { slug: "17-workshop-wizard", path: "/appointments/workshops/new" },
  { slug: "18-membership-wizard", path: "/appointments/memberships/new" },
  { slug: "19-public-storefront", path: `/book/${PUBLIC_SLUG}/store` },
  { slug: "20-public-classes", path: `/book/${PUBLIC_SLUG}/classes` },
];

async function dismissOnboarding(page: Page) {
  await page.evaluate(() => {
    try {
      window.localStorage.setItem("transovo.productSwitcherOnboarding.v3", "1");
    } catch {
      /* ignore */
    }
  });
  const gotIt = page.getByRole("button", { name: "Got it" });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click();
    await page.waitForTimeout(200);
  }
}

async function capture(page: Page, vpDir: string, shot: Shot) {
  const url = `${BASE_URL}${shot.path}`;
  console.log(`→ ${shot.slug}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dismissOnboarding(page);
  if (shot.setup) await shot.setup(page);
  await page.waitForTimeout(2500);
  const out = join(vpDir, `${shot.slug}.png`);
  await page.screenshot({ path: out, fullPage: true });
  console.log(`  ✓ ${out}`);
}

async function packageWizardSteps(page: Page, vpDir: string) {
  await page.goto(`${BASE_URL}/appointments/packages/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dismissOnboarding(page);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "08-package-wizard-step-1.png"), fullPage: true });

  await page.locator("#pkg-name").fill("IT Career Starter");
  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  await continueBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "09-package-wizard-step-2.png"), fullPage: true });

  await continueBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "10-package-wizard-step-3.png"), fullPage: true });

  await continueBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "11-package-wizard-step-4.png"), fullPage: true });
}

async function classWizardSteps(page: Page, vpDir: string) {
  await page.goto(`${BASE_URL}/appointments/classes/new`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await dismissOnboarding(page);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "12-class-wizard-step-1.png"), fullPage: true });

  const continueBtn = page.getByRole("button", { name: /^Continue$/ });
  await continueBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "13-class-wizard-schedule.png"), fullPage: true });

  await continueBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "14-class-wizard-capacity.png"), fullPage: true });

  await continueBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(vpDir, "15-class-wizard-review.png"), fullPage: true });
}

async function main() {
  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email}`);
    process.exit(1);
  }

  const viewports = [
    { label: "desktop-1440", width: 1440, height: 900 },
    { label: "mobile-390", width: 390, height: 844 },
  ];

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });

  for (const vp of viewports) {
    const vpDir = join(OUT_DIR, vp.label);
    mkdirSync(vpDir, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      storageState: auth.storageState,
    });
    const page = await context.newPage();

    for (const shot of STATIC) {
      await capture(page, vpDir, shot);
    }
    if (vp.label.startsWith("desktop")) {
      await packageWizardSteps(page, vpDir);
      await classWizardSteps(page, vpDir);
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
