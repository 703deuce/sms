/** Fast desktop-only shots. CAPTURE_ROUTES=slug1,slug2 npx tsx scripts/capture-quick-desktop.ts */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || "alex@harborhome.co";
const OUT = process.env.CAPTURE_OUT || "/opt/cursor/artifacts/screenshots/revert-check";
const NAV = 18_000;
const SETTLE = Number(process.env.CAPTURE_SETTLE_MS || 400);

const ALL: { slug: string; path: string }[] = [
  { slug: "calls", path: "/voice/calls" },
  { slug: "call_detail", path: "/voice/calls/__ID__" },
  { slug: "receptionist", path: "/voice/receptionist" },
  { slug: "knowledge", path: "/voice/knowledge" },
  { slug: "call_handling", path: "/voice/call-handling" },
  { slug: "mctb_overview", path: "/mctb" },
  { slug: "mctb_setup", path: "/mctb/setup" },
];

async function main() {
  const pick = process.env.CAPTURE_ROUTES?.split(",").map((s) => s.trim()).filter(Boolean);
  const routes = pick?.length ? ALL.filter((r) => pick.includes(r.slug)) : ALL;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(
    `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(EMAIL)}&next=/voice/calls`,
    { waitUntil: "domcontentloaded", timeout: NAV },
  );

  let callId = "demo-call-1";
  try {
    const res = await page.request.get(`${BASE}/api/voice/calls?limit=1`);
    if (res.ok()) {
      const j = await res.json();
      const id = Array.isArray(j.data) ? j.data[0]?.id : undefined;
      if (id) callId = id;
    }
  } catch {
    /* keep fallback */
  }

  mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  for (const r of routes) {
    const path = r.path.replace("__ID__", callId);
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: NAV });
    if (SETTLE) await page.waitForTimeout(SETTLE);
    await page.setViewportSize({ width: 1440, height: 900 });
    const file = join(OUT, `${r.slug}_desktop.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main();
