import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("response", async (r) => {
  if (r.url().includes("/api/auth")) {
    const t = await r.text().catch(() => "");
    console.log("API", r.status(), r.url(), t.slice(0, 500));
  }
});
await page.goto("https://transovo.ai/signup", { waitUntil: "networkidle" });
console.log("inputs", await page.locator("input").evaluateAll(els => els.map(e => ({name:e.name, type:e.type, id:e.id}))));
const email = `smoke${Date.now()}@gmail.com`;
await page.fill('input[name="name"]', "Smoke Tester");
await page.fill('input[name="businessName"]', "Smoke Test Co");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "SmokeTest123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
console.log("FINAL URL", page.url());
console.log("BODY", (await page.locator("body").innerText()).slice(0, 600));
await browser.close();
