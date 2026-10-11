/**
 * Diagnose production /appointment-reminders load (console + network).
 */
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "https://transovo.ai";

async function main() {
  if (!process.env.CERT_BROWSER_PASSWORD?.trim()) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }
  const auth = await certAuthenticate(BASE);
  if (!auth.ok) throw new Error("auth failed");

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });

  const logs: string[] = [];
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

  const failed: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 400) {
      failed.push(`${r.status()} ${r.url()}`);
    }
  });

  await page.goto(`${BASE}/appointment-reminders?view=week`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator("body").innerText();
  console.log("--- body excerpt ---");
  console.log(bodyText.slice(0, 800));
  console.log("--- failed api ---");
  console.log(failed.slice(0, 30).join("\n") || "(none)");
  console.log("--- console ---");
  console.log(logs.slice(-40).join("\n") || "(none)");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
