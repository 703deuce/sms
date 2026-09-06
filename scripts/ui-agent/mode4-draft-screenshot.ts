/**
 * Capture a rendered screenshot of a Kimi sandbox for Completion & Polish passes.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { UI_AGENT_DIR } from "./config";
import { generatedDirForSession } from "./generated-sandbox";
import { log } from "./logger";
import { startPreviewServer } from "./preview";

export type DraftScreenshotResult = {
  path: string;
  sessionId: string;
  capturedAt: string;
  failed: boolean;
  error?: string;
};

/**
 * Capture latest rendered screenshot for a sandbox session.
 * Saves to sandbox dir and .ui-agent/mode4/completion-screenshots/.
 */
export async function captureDraftScreenshot(
  sessionId: string,
  manifestId?: string,
): Promise<DraftScreenshotResult> {
  const capturedAt = new Date().toISOString();
  if (process.env.KIMI_SKIP_PREVIEW === "1" || process.env.KIMI_SKIP_PREVIEW === "true") {
    return {
      path: "",
      sessionId,
      capturedAt,
      failed: true,
      error: "KIMI_SKIP_PREVIEW is set",
    };
  }

  const outDir = join(UI_AGENT_DIR, "mode4", "completion-screenshots");
  mkdirSync(outDir, { recursive: true });
  const sandboxDir = generatedDirForSession(sessionId);
  mkdirSync(sandboxDir, { recursive: true });

  const fileName = manifestId
    ? `${manifestId}-${sessionId}.png`
    : `${sessionId}.png`;
  const artifactPath = join(outDir, fileName);
  const sandboxPath = join(sandboxDir, "screenshot-before-completion.png");

  const { url, close } = await startPreviewServer(sessionId);
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: artifactPath, fullPage: true });
    await page.screenshot({ path: sandboxPath, fullPage: true });
    log("completion screenshot", artifactPath);
    return { path: artifactPath, sessionId, capturedAt, failed: false };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log("completion screenshot failed", error);
    return { path: "", sessionId, capturedAt, failed: true, error };
  } finally {
    await browser.close();
    await close();
  }
}
