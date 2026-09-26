/**
 * Minimal Stage 2 OFF check — server must be started with NEXT_PUBLIC_NEWUI_STAGE2=0.
 */
import { chromium } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL || "http://localhost:3001";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const bypassRes = await page.request.get(`${BASE}/api/auth/dev-bypass`, { maxRedirects: 0 });
  if (bypassRes.status() !== 302 && bypassRes.status() !== 307) {
    throw new Error(`dev-bypass failed: ${bypassRes.status()}`);
  }

  const checks = [];

  for (const path of ["/voice/calls", "/mctb/missed-calls"]) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(2000);
    const body = await page.content();
    const transplantHeader = body.includes("Track and manage calls handled by the AI receptionist");
    const legacyHint =
      body.includes("MOCK_CALL_ROWS") ||
      body.includes("calls-legacy") ||
      !transplantHeader;
    checks.push({
      path,
      http: res?.status(),
      stage2TransplantHeader: transplantHeader,
      likelyLegacy: path === "/voice/calls" ? !transplantHeader : legacyHint,
    });
  }

  await browser.close();
  console.log(JSON.stringify({ base: BASE, stage2Off: true, checks }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
