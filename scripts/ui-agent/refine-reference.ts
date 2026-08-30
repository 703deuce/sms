import { join } from "node:path";
import { chromium } from "playwright";
import { generatedDirForSession } from "./generated-sandbox";
import { log } from "./logger";
import { buildLabeledMedia } from "./reference-media";
import { buildReferenceImplementation } from "./reference-builder";
import type { LabeledMedia, UiVisionProvider } from "./types";

export async function screenshotGeneratedReference(sessionId: string): Promise<string> {
  const generatedDir = generatedDirForSession(sessionId);
  const { startPreviewServer } = await import("./preview");
  const { url, close } = await startPreviewServer(sessionId);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(500);
    const shotPath = join(generatedDir, "screenshot.png");
    await page.screenshot({ path: shotPath, fullPage: true });
    log("captured reference screenshot", shotPath);
    return shotPath;
  } finally {
    await browser.close();
    await close();
  }
}

export async function refineReferenceImplementation(
  provider: UiVisionProvider,
  input: {
    sessionId: string;
    target: string;
    manifest: import("./types").ProjectManifest;
    referenceMedia: LabeledMedia[];
    currentMedia: LabeledMedia[];
    instruction: string;
    originalReferenceMedia: LabeledMedia[];
    pass: number;
    maxPasses: number;
  },
): Promise<{ screenshotPath: string; summary: string }> {
  log("refining reference implementation", `pass ${input.pass}/${input.maxPasses}`);

  const screenshotPath = await screenshotGeneratedReference(input.sessionId);
  const generatedShot = buildLabeledMedia([
    {
      path: screenshotPath,
      label: "GENERATED_REFERENCE",
      purpose: "Current Kimi sandbox implementation screenshot for refinement",
    },
  ]);

  const feedback = `Pass ${input.pass}: Compare GENERATED_REFERENCE against original REFERENCE media and CURRENT_TRANSOVO.
Fix layout, spacing, hierarchy, components, modals, and interactions in the sandbox files.
Output the full updated files JSON again.`;

  const build = await buildReferenceImplementation(provider, {
    sessionId: input.sessionId,
    target: input.target,
    manifest: input.manifest,
    referenceMedia: [...input.originalReferenceMedia, ...generatedShot],
    currentMedia: input.currentMedia,
    instruction: input.instruction,
    feedback,
  });

  const finalShot = await screenshotGeneratedReference(input.sessionId);
  return { screenshotPath: finalShot, summary: build.summary };
}
