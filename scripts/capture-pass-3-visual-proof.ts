/**
 * Fast Pass 3 screenshots — one browser session, ~1–2 min for all routes.
 *
 * Prereq (dev must have bypass enabled):
 *   DEV_AUTH_BYPASS=1 DEV_AUTH_BYPASS_EMAIL=you@example.com npm run dev
 *
 *   UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-pass-3-visual-proof.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE_URL =
  process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";
const OUT_ROOT = "/opt/cursor/artifacts/screenshots/pass-3-visual-proof";
const AUTH_EMAIL =
  process.env.DEV_AUTH_BYPASS_EMAIL?.trim() ||
  process.env.UI_AGENT_SMOKE_EMAIL?.trim() ||
  "alex@harborhome.co";

const NAV_MS = Number(process.env.CAPTURE_NAV_TIMEOUT_MS || 20_000);
const SETTLE_MS = Number(process.env.CAPTURE_SETTLE_MS || 250);

const ROUTES: Array<{ family: "Voice" | "MCTB"; slug: string; path: string }> = [
  { family: "Voice", slug: "overview", path: "/voice/overview" },
  { family: "Voice", slug: "calls", path: "/voice/calls" },
  { family: "Voice", slug: "call_detail", path: "/voice/calls/demo-call-1" },
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

async function onLoginPage(page: Page): Promise<boolean> {
  if (page.url().includes("/login")) return true;
  return page.getByRole("heading", { name: /welcome back/i }).isVisible().catch(() => false);
}

async function authenticate(page: Page) {
  const bypassUrl = `${BASE_URL}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent("/voice/overview")}`;
  const res = await page.goto(bypassUrl, { waitUntil: "domcontentloaded", timeout: NAV_MS });
  if (res?.status() === 404) {
    throw new Error(
      `dev-bypass 404 — run dev with DEV_AUTH_BYPASS=1 and DEV_AUTH_BYPASS_EMAIL (e.g. ${AUTH_EMAIL}).`,
    );
  }
  if (await onLoginPage(page)) {
    throw new Error("Still on login after dev-bypass. Enable DEV_AUTH_BYPASS on the dev server.");
  }
}

async function capture(page: Page, family: string, slug: string, path: string, outDir: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded", timeout: NAV_MS });
  if (await onLoginPage(page)) {
    throw new Error("login page");
  }
  if (SETTLE_MS > 0) await page.waitForTimeout(SETTLE_MS);

  const dir = join(outDir, family);
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: join(dir, `${slug}_desktop.png`) });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(dir, `${slug}_mobile.png`) });
  console.log(`✓ ${family}/${slug}`);
}

async function main() {
  const t0 = Date.now();
  const phase = parsePhase();
  const outDir = join(OUT_ROOT, phase);
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await authenticate(page);

  let failed = 0;
  for (const r of ROUTES) {
    try {
      await capture(page, r.family, r.slug, r.path, outDir);
    } catch (e) {
      failed += 1;
      console.warn(`⚠ ${r.path}:`, e instanceof Error ? e.message : e);
    }
  }
  await browser.close();

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (failed === ROUTES.length) {
    console.error(`All ${ROUTES.length} routes failed in ${sec}s`);
    process.exit(1);
  }
  console.log(`Done ${ROUTES.length - failed}/${ROUTES.length} in ${sec}s → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
