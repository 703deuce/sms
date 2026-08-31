import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { VIEWPORT_PRESETS } from "./config";
import { log } from "./logger";
import type { WalkthroughStep } from "./polish-targets";
import type { ViewportPreset } from "./types";

export type WalkthroughCaptureOptions = {
  baseUrl: string;
  outputDir: string;
  steps: WalkthroughStep[];
  viewports?: ViewportPreset[];
  email?: string;
  password?: string;
  useDevBypass?: boolean;
};

async function authenticate(
  page: Page,
  baseUrl: string,
  nextPath: string,
  email?: string,
  password?: string,
  useDevBypass?: boolean,
): Promise<void> {
  if (useDevBypass && !email && !password) {
    const bypass = `${baseUrl}/api/auth/dev-bypass?next=${encodeURIComponent(nextPath)}`;
    log("auth", `dev-bypass → ${nextPath}`);
    await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    return;
  }

  if (!email || !password) return;

  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
}

async function runActions(page: Page, step: WalkthroughStep): Promise<void> {
  for (const action of step.actions || []) {
    if (action.type === "wait") {
      await page.waitForTimeout(action.ms);
      continue;
    }
    if (action.type === "scroll") {
      await page.evaluate((y) => window.scrollTo(0, y), action.y);
      await page.waitForTimeout(300);
      continue;
    }
    if (action.type === "click") {
      const selectors = action.selector.split(",").map((s) => s.trim());
      for (const sel of selectors) {
        const loc = page.locator(sel).first();
        if (await loc.count()) {
          await loc.click({ timeout: 8000 });
          break;
        }
      }
      await page.waitForTimeout(500);
    }
  }
}

export async function captureWalkthrough(options: WalkthroughCaptureOptions): Promise<string[]> {
  mkdirSync(options.outputDir, { recursive: true });
  const outputs: string[] = [];
  const viewports = options.viewports?.length ? options.viewports : (["desktop"] as ViewportPreset[]);
  const browser = await chromium.launch({ headless: true });

  try {
    for (const viewportName of viewports) {
      const vp = VIEWPORT_PRESETS[viewportName];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      const firstPath = options.steps[0]?.path || "/dashboard";
      await authenticate(
        page,
        options.baseUrl,
        firstPath,
        options.email,
        options.password,
        options.useDevBypass,
      );

      for (const step of options.steps) {
        const url = `${options.baseUrl}${step.path.startsWith("/") ? step.path : `/${step.path}`}`;
        log("walkthrough capture", `${step.id} ${url}`);
        await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
        await page.waitForTimeout(600);
        await runActions(page, step);

        const file = join(options.outputDir, `${step.id}-${viewportName}.png`);
        await page.screenshot({ path: file, fullPage: step.fullPage !== false });
        outputs.push(file);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  writeFileSync(
    join(options.outputDir, "walkthrough-manifest.json"),
    JSON.stringify({ outputs, capturedAt: new Date().toISOString(), steps: options.steps.map((s) => s.id) }, null, 2),
  );
  return outputs;
}
