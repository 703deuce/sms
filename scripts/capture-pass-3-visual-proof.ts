/**
 * Pass 3 — representative Voice + MCTB screenshots (desktop + 390px mobile).
 *   UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-pass-3-visual-proof.ts --phase after
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const OUT_ROOT = "/opt/cursor/artifacts/screenshots/pass-3-visual-proof";

const ROUTES: Array<{ family: "Voice" | "MCTB"; slug: string; path: string }> = [
  { family: "Voice", slug: "overview", path: "/voice/overview" },
  { family: "Voice", slug: "calls", path: "/voice/calls" },
  { family: "Voice", slug: "receptionist", path: "/voice/receptionist" },
  { family: "Voice", slug: "knowledge", path: "/voice/knowledge" },
  { family: "Voice", slug: "call_handling", path: "/voice/call-handling" },
  { family: "Voice", slug: "analytics", path: "/voice/analytics" },
  { family: "Voice", slug: "needs_attention", path: "/voice/needs-attention" },
  { family: "MCTB", slug: "overview", path: "/mctb" },
  { family: "MCTB", slug: "missed_calls", path: "/mctb/missed-calls" },
  { family: "MCTB", slug: "conversations", path: "/mctb/conversations" },
  { family: "MCTB", slug: "voicemail", path: "/mctb/voicemail" },
  { family: "MCTB", slug: "analytics", path: "/mctb/analytics" },
  { family: "MCTB", slug: "setup", path: "/mctb/setup" },
  { family: "MCTB", slug: "setup_consent", path: "/mctb/setup/consent" },
  { family: "MCTB", slug: "setup_recovery", path: "/mctb/setup/recovery" },
  { family: "MCTB", slug: "compliance_consent", path: "/mctb/compliance/consent" },
  { family: "MCTB", slug: "ai_recovery", path: "/mctb/ai-recovery" },
];

function parsePhase(): "before" | "after" {
  const idx = process.argv.indexOf("--phase");
  const v = idx >= 0 ? process.argv[idx + 1] : "after";
  return v === "before" ? "before" : "after";
}

async function authenticate(page: Page) {
  await page.goto(`${BASE_URL}/api/auth/dev-bypass?next=${encodeURIComponent("/voice/overview")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(800);
}

async function capture(page: Page, family: string, slug: string, path: string, outDir: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  const dir = join(outDir, family);
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(dir, `${slug}_desktop.png`), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, `${slug}_mobile.png`), fullPage: false });
  console.log(`✓ ${family}/${slug}`);
}

async function main() {
  const phase = parsePhase();
  const outDir = join(OUT_ROOT, phase);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await authenticate(page);
  for (const r of ROUTES) {
    try {
      await capture(page, r.family, r.slug, r.path, outDir);
    } catch (e) {
      console.warn(`⚠ skip ${r.path}:`, e instanceof Error ? e.message : e);
    }
  }
  await browser.close();
  console.log(`Done → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
