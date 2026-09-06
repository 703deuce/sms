#!/usr/bin/env tsx
/**
 * Screenshot Kimi golden-screen sandboxes for visual review.
 *   npx tsx scripts/ui-agent/capture-golden-screenshots.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { startPreviewServer } from "./preview";

const OUT_DIR = "/opt/cursor/artifacts/mode4-golden-screens";

const GOLDEN_SCREENS = [
  { id: "home", label: "01-home", sessionId: "2026-09-06T18-38-34-170Z-b932cd", route: "/appointments/overview" },
  { id: "appointments-calendar", label: "02-calendar", sessionId: "2026-09-06T18-52-01-001Z-ba74e3", route: "/appointments/calendar" },
  { id: "appointments-list", label: "03-list", sessionId: "2026-09-06T18-54-41-090Z-06135d", route: "/appointments" },
  { id: "appointment-detail", label: "04-detail", sessionId: "2026-09-06T18-54-45-911Z-971ae7", route: "/appointments/[id]" },
  { id: "booking-types", label: "05-booking-types", sessionId: "2026-09-06T18-58-57-355Z-0c9426", route: "/appointments/types" },
  { id: "workflow-builder", label: "06-workflow-builder", sessionId: "2026-09-06T18-59-17-104Z-0a52bf", route: "/appointments/workflows" },
];

function previewPort(sessionId: string): number {
  return 5174 + (sessionId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 500);
}

async function captureOne(screen: (typeof GOLDEN_SCREENS)[number]): Promise<string> {
  const port = previewPort(screen.sessionId);
  const { url, close } = await startPreviewServer(screen.sessionId, port);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const out = join(OUT_DIR, `${screen.label}.png`);
    await page.screenshot({ path: out, fullPage: true });
    return out;
  } finally {
    await browser.close();
    await close();
  }
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  const results: Array<{ screen: string; path: string; ok: boolean; error?: string }> = [];

  for (const screen of GOLDEN_SCREENS) {
    process.stdout.write(`Capturing ${screen.label} (${screen.sessionId})… `);
    try {
      const path = await captureOne(screen);
      console.log("ok");
      results.push({ screen: screen.label, path, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAIL: ${message}`);
      results.push({ screen: screen.label, path: "", ok: false, error: message });
    }
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    outDir: OUT_DIR,
    screens: GOLDEN_SCREENS.map((s, i) => ({
      ...s,
      screenshot: results[i]?.ok ? results[i].path : null,
      error: results[i]?.error,
    })),
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nManifest: ${join(OUT_DIR, "manifest.json")}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
