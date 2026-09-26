/**
 * Pass 2 representative proof screenshots (before/after folders).
 *   UI_AGENT_BASE_URL=<url> npx tsx scripts/capture-pass-2-visual-proof.ts --phase after
 *   UI_AGENT_BASE_URL=<url> npx tsx scripts/capture-pass-2-visual-proof.ts --phase before
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const OUT_ROOT = "/opt/cursor/artifacts/screenshots/pass-2-visual-proof";

const PROOF_ROUTES: Array<{ slug: string; path: string }> = [
  { slug: "01_mctb_missed_calls", path: "/mctb/missed-calls" },
  { slug: "02_mctb_setup_consent", path: "/mctb/setup/consent" },
  { slug: "03_voice_calls", path: "/voice/calls" },
  { slug: "04_voice_receptionist", path: "/voice/receptionist" },
  { slug: "05_conversations", path: "/conversations" },
];

function parsePhase(): "before" | "pass-2" | "pass-2a" {
  const idx = process.argv.indexOf("--phase");
  const v = idx >= 0 ? process.argv[idx + 1] : "pass-2a";
  if (v === "before" || v === "pass-2" || v === "pass-2a") return v;
  return "pass-2a";
}

async function authenticate(page: Page, nextPath: string) {
  await page.goto(`${BASE_URL}/api/auth/dev-bypass?next=${encodeURIComponent(nextPath)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(800);
}

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
  }
}

async function capture(page: Page, slug: string, path: string, outDir: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined);
  await dismissOverlays(page);
  await page.waitForTimeout(1500);
  const desktop = join(outDir, `${slug}_desktop.png`);
  await page.screenshot({ path: desktop, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const mobile = join(outDir, `${slug}_mobile.png`);
  await page.screenshot({ path: mobile, fullPage: false });
  await page.setViewportSize({ width: 1280, height: 800 });
  console.log(`✓ ${slug} → ${outDir}`);
}

async function main() {
  const phase = parsePhase();
  const outDir = join(OUT_ROOT, phase);
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await authenticate(page, PROOF_ROUTES[0]!.path);
  for (const route of PROOF_ROUTES) {
    await capture(page, route.slug, route.path, outDir);
  }
  await browser.close();
  console.log(`Done (${phase}) → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
