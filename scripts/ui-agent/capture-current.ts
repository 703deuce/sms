import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { VIEWPORT_PRESETS } from "./config";
import { log } from "./logger";
import type { ViewportPreset } from "./types";

export type CaptureOptions = {
  baseUrl: string;
  targetPath: string;
  outputDir: string;
  viewports: ViewportPreset[];
  screenshots: boolean;
  video: boolean;
  email?: string;
  password?: string;
};

async function authenticate(page: import("playwright").Page, baseUrl: string, email?: string, password?: string) {
  if (!email || !password) return;
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"], input[type="email"]', email);
  await page.fill('input[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30000 });
}

export async function captureCurrentSite(options: CaptureOptions): Promise<string[]> {
  mkdirSync(options.outputDir, { recursive: true });
  const outputs: string[] = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  try {
    const page = await context.newPage();
    await authenticate(page, options.baseUrl, options.email, options.password);

    for (const viewportName of options.viewports) {
      const vp = VIEWPORT_PRESETS[viewportName];
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const url = `${options.baseUrl}${options.targetPath.startsWith("/") ? options.targetPath : `/${options.targetPath}`}`;
      log("capturing current UI", `${viewportName} ${url}`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

      if (options.screenshots) {
        const shotPath = join(options.outputDir, `current-${viewportName}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        outputs.push(shotPath);
      }

      if (options.video && viewportName === "desktop") {
        // Playwright records per context — use a dedicated context for walkthrough video.
        continue;
      }
    }

    if (options.video) {
      const videoContext = await browser.newContext({
        recordVideo: { dir: options.outputDir, size: { width: 1440, height: 900 } },
        viewport: { width: 1440, height: 900 },
      });
      const videoPage = await videoContext.newPage();
      await authenticate(videoPage, options.baseUrl, options.email, options.password);
      const url = `${options.baseUrl}${options.targetPath.startsWith("/") ? options.targetPath : `/${options.targetPath}`}`;
      await videoPage.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await videoPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
      await videoPage.waitForTimeout(800);
      await videoPage.evaluate(() => window.scrollTo(0, 0));
      await videoPage.waitForTimeout(500);
      const video = videoPage.video();
      await videoPage.close();
      await videoContext.close();
      if (video) {
        const videoPath = join(options.outputDir, "current-walkthrough.webm");
        await video.saveAs(videoPath);
        outputs.push(videoPath);
        log("captured walkthrough video", videoPath);
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  writeFileSync(join(options.outputDir, "capture-manifest.json"), JSON.stringify({ outputs, capturedAt: new Date().toISOString() }, null, 2));
  return outputs;
}

export async function captureReferenceUrl(input: {
  url: string;
  outputDir: string;
  depth: "page" | "flow";
  screenshots: boolean;
  video: boolean;
}): Promise<string[]> {
  mkdirSync(input.outputDir, { recursive: true });
  const outputs: string[] = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    log("capturing reference URL", input.url);
    await page.goto(input.url, { waitUntil: "networkidle", timeout: 60000 });

    if (input.screenshots) {
      const desktop = join(input.outputDir, "reference-desktop.png");
      await page.screenshot({ path: desktop, fullPage: true });
      outputs.push(desktop);
      await page.setViewportSize({ width: 390, height: 844 });
      const mobile = join(input.outputDir, "reference-mobile.png");
      await page.screenshot({ path: mobile, fullPage: true });
      outputs.push(mobile);
    }

    if (input.depth === "flow" && input.video) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
      await page.waitForTimeout(600);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return outputs;
}
