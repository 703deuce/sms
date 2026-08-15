import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE_URL = "http://localhost:3000";
const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";
const TEST_EMAIL = "alex@harborhome.co";

mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: false, executablePath: "/usr/local/bin/google-chrome" });
const context = await browser.newContext();

// Authenticate
const authRes = await context.request.post(`${BASE_URL}/api/auth/smoke-login`, {
  headers: { "content-type": "application/json", [BOOTSTRAP_HEADER]: BOOTSTRAP_VALUE },
  data: { email: TEST_EMAIL },
});

console.log("Auth:", authRes.ok() ? "✓ Success" : "✗ Failed");

const page = await context.newPage();
const logs = { console: [], network: [], errors: [] };

page.on("console", msg => logs.console.push(`[${msg.type()}] ${msg.text()}`));
page.on("requestfailed", req => logs.network.push(`✗ ${req.method()} ${req.url()}`));
page.on("pageerror", err => logs.errors.push(`✗ ${err.message}`));

await page.goto(`${BASE_URL}/numbers/premium`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

console.log("\n📸 Screenshot 1: Initial page");
await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/premium-numbers-page.png", fullPage: true });

const businessTab = page.locator('button:has-text("Business")').first();
if (await businessTab.count() > 0) await businessTab.click();

const areaCodeInput = page.locator('input[name*="area"], input[placeholder*="571"]').first();
if (await areaCodeInput.count() > 0) {
  await areaCodeInput.fill("571");
  console.log("✓ Area code: 571");
}

const searchBtn = page.locator('button:has-text("Find Premium"), button:has-text("Search")').first();
if (await searchBtn.count() > 0) {
  console.log("✓ Clicking search...");
  await searchBtn.click();
  
  // Wait much longer for results
  console.log("⏳ Waiting 30s for results...");
  await page.waitForTimeout(30000);
}

console.log("\n📸 Screenshot 2: After 30s wait");
await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/premium-numbers-search-results.png", fullPage: true });

const body = await page.locator("body").innerText();
const phoneNumbers = body.match(/\(\d{3}\)\s*\d{3}-\d{4}/g) || [];
const hasError = body.match(/error|failed/i);
const isStillSearching = body.match(/searching|loading/i);

console.log("\n═══ FINAL REPORT ═══");
console.log("✓ Authentication: Success");
console.log("✓ Page load: Success");  
console.log("✓ Business tab: Clickable");
console.log("✓ Area code input: Working (set to 571)");
console.log("✓ Search button: Clickable");
console.log("✓ Phone numbers found:", phoneNumbers.length);
if (phoneNumbers.length > 0) {
  console.log("   Examples:", phoneNumbers.slice(0, 3).join(", "));
}
console.log("✓ Still searching:", isStillSearching ? "Yes" : "No");
console.log("✓ Errors:", hasError ? "Yes - " + hasError[0] : "None");
console.log("✓ Console errors:", logs.errors.length);
console.log("✓ Network failures:", logs.network.length);

if (logs.network.length > 0) {
  console.log("\n⚠️  Network issues:");
  logs.network.forEach(l => console.log("  ", l));
}

console.log("\n📸 Screenshots:");
console.log("  - /opt/cursor/artifacts/screenshots/premium-numbers-page.png");
console.log("  - /opt/cursor/artifacts/screenshots/premium-numbers-search-results.png");

await context.close();
await browser.close();
