import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE_URL = "http://localhost:3000";
const BOOTSTRAP_HEADER = "x-smoke-bootstrap";
const BOOTSTRAP_VALUE = "transovo-smoke-bootstrap-b56f-aug2026";
const TEST_EMAIL = "alex@harborhome.co";

mkdirSync("/opt/cursor/artifacts/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: false, executablePath: "/usr/local/bin/google-chrome" });
const context = await browser.newContext();

// Authenticate via smoke-login
console.log("✓ Authenticating...");
const authRes = await context.request.post(`${BASE_URL}/api/auth/smoke-login`, {
  headers: {
    "content-type": "application/json",
    [BOOTSTRAP_HEADER]: BOOTSTRAP_VALUE,
  },
  data: { email: TEST_EMAIL },
});

if (!authRes.ok()) {
  console.error("✗ Authentication failed:", authRes.status(), await authRes.text());
  process.exit(1);
}
console.log("✓ Authenticated as", TEST_EMAIL);

const page = await context.newPage();
const consoleLogs = [];
const networkErrors = [];

// Capture console logs
page.on("console", msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

// Capture network errors
page.on("requestfailed", request => {
  networkErrors.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
});

// Navigate to premium numbers page
console.log("✓ Navigating to /numbers/premium...");
await page.goto(`${BASE_URL}/numbers/premium`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);

// Take first screenshot
console.log("✓ Taking initial screenshot...");
await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/premium-numbers-page.png", fullPage: true });

// Check if already on Business tab
const businessTab = page.locator('button:has-text("Business"), [role="tab"]:has-text("Business")').first();
const personalTab = page.locator('button:has-text("Personal"), [role="tab"]:has-text("Personal")').first();

if (await businessTab.count() > 0) {
  const isBusinessActive = await businessTab.evaluate(el => 
    el.classList.contains('active') || el.getAttribute('aria-selected') === 'true'
  ).catch(() => false);
  
  if (!isBusinessActive && await businessTab.isVisible()) {
    console.log("✓ Clicking Business tab...");
    await businessTab.click();
    await page.waitForTimeout(500);
  } else {
    console.log("✓ Business tab already active");
  }
}

// Find and fill area code input
console.log("✓ Setting area code to 571...");
const areaCodeInput = page.locator('input[name*="area"], input[placeholder*="571"], input[type="text"]').first();
if (await areaCodeInput.count() > 0 && await areaCodeInput.isVisible()) {
  await areaCodeInput.click();
  await areaCodeInput.fill("571");
  console.log("✓ Area code set to 571");
} else {
  console.log("⚠ Could not find area code input");
}

// Click search button
console.log("✓ Clicking search button...");
const searchButton = page.locator('button:has-text("Find Premium Numbers"), button:has-text("Search"), button:has-text("Searching")').first();
if (await searchButton.count() > 0 && await searchButton.isVisible()) {
  await searchButton.click();
  console.log("✓ Search initiated");
  
  // Wait for search to complete (look for results or error messages)
  console.log("⏳ Waiting for search results...");
  try {
    await page.waitForSelector('text=/available number|no numbers|error|failed/i', { timeout: 15000 });
    console.log("✓ Search completed");
  } catch (e) {
    console.log("⏳ Still searching after 15s, continuing...");
  }
  await page.waitForTimeout(5000);
} else {
  console.log("✗ Could not find search button");
}

// Take second screenshot with results
console.log("✓ Taking results screenshot...");
await page.screenshot({ path: "/opt/cursor/artifacts/screenshots/premium-numbers-search-results.png", fullPage: true });

// Get final page state
const bodyText = await page.locator("body").innerText();
const hasResults = bodyText.match(/\(\d{3}\)\s*\d{3}-\d{4}/);  // Phone number pattern
const hasError = bodyText.match(/error|failed|invalid/i);
const isSearching = bodyText.match(/searching|loading/i);

console.log("\n=== Test Results ===");
console.log("✓ Page loaded:", await page.title());
console.log("✓ Business tab:", await businessTab.count() > 0 ? "Found" : "Not found");
console.log("✓ Area code input:", await areaCodeInput.count() > 0 ? "Found" : "Not found");
console.log("✓ Search button:", await searchButton.count() > 0 ? "Found & clickable" : "Not found");
console.log("✓ Phone numbers visible:", hasResults ? "Yes" : "No");
console.log("✓ Still searching:", isSearching ? "Yes" : "No");
console.log("✓ Errors detected:", hasError ? "Yes" : "No");

if (consoleLogs.length > 0) {
  console.log("\n=== Console Logs ===");
  consoleLogs.forEach(log => console.log(log));
}

if (networkErrors.length > 0) {
  console.log("\n=== Network Errors ===");
  networkErrors.forEach(err => console.log("✗", err));
}

console.log("\n=== Screenshots Saved ===");
console.log("  - /opt/cursor/artifacts/screenshots/premium-numbers-page.png");
console.log("  - /opt/cursor/artifacts/screenshots/premium-numbers-search-results.png");

await context.close();
await browser.close();
