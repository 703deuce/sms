/**
 *   UI_AGENT_BASE_URL=https://transovo.ai npx tsx scripts/verify-mctb-primary-prod-nav.ts
 */
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";

async function main() {
  const auth = await authenticate(BASE);
  if (!auth.ok) {
    console.error("AUTH_FAIL");
    process.exit(1);
  }
  mkdirSync("/opt/cursor/artifacts", { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });
  await page.goto(`${BASE}/mctb`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);
  const navText = await page.locator("nav").innerText().catch(() => "");
  await page.screenshot({ path: "/opt/cursor/artifacts/mctb-restore-prod-nav.png", fullPage: true });
  await browser.close();

  const checks = {
    onMctb: page.url().includes("/mctb"),
    missedCalls: /Missed Calls/i.test(navText),
    conversations: /Conversations/i.test(navText),
    aiVoiceAgent: /AI Voice Agent/i.test(navText),
    appointmentRemindersNav: /Appointment Reminders/i.test(navText),
    productSwitcher: /Appointments|Reminders/i.test(navText) && /Missed Call Text Back/i.test(navText),
  };
  const pass =
    checks.onMctb &&
    checks.missedCalls &&
    checks.conversations &&
    checks.aiVoiceAgent &&
    !checks.appointmentRemindersNav;
  console.log(JSON.stringify({ pass, checks, url: page.url() }, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
