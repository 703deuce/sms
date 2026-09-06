#!/usr/bin/env tsx
/**
 * Screenshot Kimi golden-screen sandboxes for visual review (post-completion drafts).
 * Seeds sandbox from src/kimi-drafts before capture so screenshots reflect latest code.
 *
 *   npx tsx scripts/ui-agent/capture-golden-screenshots.ts
 *   npx tsx scripts/ui-agent/capture-golden-screenshots.ts --out /opt/cursor/artifacts/golden-post-completion
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { UI_AGENT_DIR } from "./config";
import { draftDirForSession, seedSandboxFromDraft } from "./kimi-persist";
import { startPreviewServer } from "./preview";

const DEFAULT_OUT_DIR = "/opt/cursor/artifacts/golden-post-completion";

const GOLDEN_SCREENS = [
  { id: "home", label: "01-home", sessionId: "2026-09-06T18-38-34-170Z-b932cd", route: "/appointments/overview" },
  { id: "appointments-calendar", label: "02-calendar", sessionId: "2026-09-06T18-52-01-001Z-ba74e3", route: "/appointments/calendar" },
  { id: "appointments-list", label: "03-list", sessionId: "2026-09-06T18-54-41-090Z-06135d", route: "/appointments" },
  { id: "appointment-detail", label: "04-detail", sessionId: "2026-09-06T18-54-45-911Z-971ae7", route: "/appointments/[id]" },
  { id: "booking-types", label: "05-booking-types", sessionId: "2026-09-06T18-58-57-355Z-0c9426", route: "/appointments/types" },
  { id: "workflow-builder", label: "06-workflow-builder", sessionId: "2026-09-06T18-59-17-104Z-0a52bf", route: "/appointments/workflows" },
];

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function resolveDraftPath(screen: (typeof GOLDEN_SCREENS)[number]): string {
  const statePath = join(UI_AGENT_DIR, "mode4", "batch-state.json");
  if (existsSync(statePath)) {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as {
      jobs?: Array<{ id: string; sessionId?: string; draftPath?: string; route?: string }>;
    };
    const job = state.jobs?.find((j) => j.id === screen.id);
    if (job?.draftPath && existsSync(job.draftPath)) return job.draftPath;
    if (job?.sessionId && job.route) {
      const draft = draftDirForSession(job.sessionId, job.route);
      if (existsSync(draft)) return draft;
    }
  }
  const fallback = draftDirForSession(screen.sessionId, screen.route);
  if (existsSync(fallback)) return fallback;
  throw new Error(`No draft found for ${screen.id}`);
}


async function captureOne(
  screen: (typeof GOLDEN_SCREENS)[number],
  outDir: string,
): Promise<string> {
  const draftPath = resolveDraftPath(screen);
  seedSandboxFromDraft(screen.sessionId, draftPath);
  const { url, close } = await startPreviewServer(screen.sessionId);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(1500);
    const out = join(outDir, `${screen.label}.png`);
    await page.screenshot({ path: out, fullPage: true });
    return out;
  } finally {
    await browser.close();
    await close();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outDir = parseArg(args, "--out") || DEFAULT_OUT_DIR;
  const only = parseArg(args, "--only");
  const screens = only
    ? GOLDEN_SCREENS.filter((s) => s.id === only || s.label.includes(only))
    : GOLDEN_SCREENS;

  mkdirSync(outDir, { recursive: true });
  const results: Array<{ screen: string; path: string; ok: boolean; error?: string }> = [];

  for (const screen of screens) {
    process.stdout.write(`Capturing ${screen.label} (${screen.sessionId})… `);
    try {
      const path = await captureOne(screen, outDir);
      console.log(`ok → ${path}`);
      results.push({ screen: screen.label, path, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAIL: ${message}`);
      results.push({ screen: screen.label, path: "", ok: false, error: message });
    }
  }

  const manifest = {
    capturedAt: new Date().toISOString(),
    outDir,
    note: "Seeded from src/kimi-drafts post-completion before capture",
    screens: screens.map((s, i) => ({
      ...s,
      draftPath: existsSync(resolveDraftPath(s)) ? resolveDraftPath(s) : null,
      screenshot: results[i]?.ok ? results[i].path : null,
      error: results[i]?.error,
    })),
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(`\nManifest: ${join(outDir, "manifest.json")}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
