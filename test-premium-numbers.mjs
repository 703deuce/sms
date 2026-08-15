import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "fs";

const BASE_URL = "http://localhost:3000";
const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";
const TEST_EMAIL = "alex@harborhome.co";

mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: false, executablePath: "/usr/local/bin/google-chrome" });
const context = await browser.newContext();

// Authenticate via smoke-login
console.log("Authenticating...");
const authRes = await context.request.post(`${BASE_URL}/api/auth/smoke-login`, {
  headers: {
    "content-type": "application/json",
    [BOOTSTRAP_HEADER]: BOOTSTRAP_VALUE,
  },
  data: { email: TEST_EMAIL },
});

console.log("Auth response:", authRes.status(), await authRes.text());

const page = await context.newPage();

// Navigate to premium numbers page
console.log("Navigating to premium numbers page...");
await page.goto(`${BASE_URL}/numbers/premium`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);

// Take first screenshot
console.log("Taking first screenshot...");
await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/premium-numbers-page.png", fullPage: true });

// Check for Business tab and click if needed
const businessTab = page.locator('text=/Business/i').first();
if (await businessTab.count() > 0) {
  console.log("Clicking Business tab...");
  await businessTab.click();
  await page.waitForTimeout(500);
}

// Set area code to 571
console.log("Setting area code to 571...");
const areaCodeInput = page.locator('input[placeholder*="area" i], input[name*="area" i], input[id*="area" i]').first();
if (await areaCodeInput.count() > 0) {
  await areaCodeInput.fill("571");
} else {
  console.log("Could not find area code input, trying alternative selectors...");
  const allInputs = await page.locator('input[type="text"], input[type="number"]').all();
  console.log(`Found ${allInputs.length} text/number inputs`);
  if (allInputs.length > 0) {
    await allInputs[0].fill("571");
  }
}

// Click search button
console.log("Clicking search button...");
const searchButton = page.locator('button:has-text("Find Premium Numbers"), button:has-text("Search")').first();
if (await searchButton.count() > 0) {
  await searchButton.click();
  console.log("Search button clicked, waiting for results...");
  await page.waitForTimeout(3000);
} else {
  console.log("Could not find search button");
}

// Take second screenshot with results
console.log("Taking second screenshot...");
await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/premium-numbers-search-results.png", fullPage: true });

// Check for errors in console
const logs = [];
page.on("console", msg => logs.push(`[${msg.type()}] ${msg.text()}`));

// Get page content for analysis
const bodyText = await page.locator("body").innerText();
console.log("\n=== Page content sample ===");
console.log(bodyText.slice(0, 500));

// Check for error messages
const hasError = bodyText.match(/error|failed|invalid/i);
if (hasError) {
  console.log("\n⚠️  Possible error detected in page content");
}

console.log("\n=== Test Complete ===");
console.log("Screenshots saved to:");
console.log("  - /opt/cursor/artifacts/screenshots/premium-numbers-page.png");
console.log("  - /opt/cursor/artifacts/screenshots/premium-numbers-search-results.png");

await context.close();
await browser.close();
