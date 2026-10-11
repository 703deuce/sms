import { chromium } from "playwright";
import { authenticate } from "./browser-cert/lib";

function cookieHeader(storageState: { cookies: Array<{ name: string; value: string }> }) {
  return storageState.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function main() {
  process.env.CERT_BROWSER_PASSWORD = process.env.CERT_BROWSER_PASSWORD || "ApptMctbBrowserCert_v1!";
  const auth = await authenticate("https://transovo.ai");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    storageState: auth.storageState,
  });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("console.error", msg.text());
  });
  await page.goto("https://transovo.ai/appointment-reminders?view=week", {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  const count = await page.locator("div.min-w-\\[640px\\] button.absolute.inset-x-1").count();
  console.log("absolute buttons", count);
  const firstBtn = page.locator("div.min-w-\\[640px\\] button.absolute.inset-x-1").first();
  const firstLabel = await firstBtn.evaluate((el) => el.innerText);
  const box = await firstBtn.boundingBox();
  console.log("first block label", firstLabel?.replace(/\s+/g, " ").trim(), "box", box);
  const amButtons = await page.locator("button").filter({ hasText: /AM|PM/ }).count();
  console.log("buttons with AM/PM", amButtons);
  const from = new Date("2026-10-10").toISOString();
  const to = new Date("2026-10-17").toISOString();
  const evRes = await fetch(
    `https://transovo.ai/api/appointment-reminders/calendar/events?from=${from}&to=${to}`,
    { headers: { cookie: cookieHeader(auth.storageState) } },
  );
  const evJson = await evRes.json();
  console.log(
    "api events",
    (evJson.data || []).map((e: { id: string; serviceName: string }) => `${e.id.slice(0, 8)}… ${e.serviceName}`),
  );
  if (count > 0) {
    await page
      .locator("div.min-w-\\[640px\\] button.absolute.inset-x-1")
      .first()
      .click({ force: true });
    await page.waitForTimeout(3000);
    const tabsAfterGrid = await page.getByRole("tab").allTextContents().catch(() => []);
    console.log("tabs after dispatch click", tabsAfterGrid);
  }
  await page
    .locator("aside[aria-label='Appointment context'] button")
    .filter({ hasText: "Live AR test" })
    .first()
    .click();
  await page.waitForTimeout(3000);
  const tabs = await page.getByRole("tab").allTextContents().catch(() => []);
  console.log("tabs", tabs);
  const asideText = await page.locator("aside[aria-label='Appointment context']").innerText();
  console.log("aside snippet", asideText.slice(0, 400));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
