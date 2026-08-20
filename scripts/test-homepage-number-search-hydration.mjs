import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const configuredChromePath = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const executablePath = existsSync(configuredChromePath)
  ? configuredChromePath
  : chromium.executablePath();
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  let searchRequestBody = null;

  await page.route(/\/_next\/static\/.*\.js/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  });
  await page.route("**/api/public/numbers/search", async (route) => {
    searchRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: `${JSON.stringify({
        type: "complete",
        data: {
          searchStatus: "complete",
          resultCount: 0,
          inventoryScannedCount: 0,
          topPicks: [],
          bestMatches: [],
          memorableAlternatives: [],
        },
      })}\n`,
    });
  });

  await page.goto(`${baseUrl}/?hydration-regression=1`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  const areaCodeInput = page.locator('input[placeholder="571"]');
  const industryInput = page.locator('input[placeholder="electrician"]');
  const submitButton = page.getByRole("button", { name: "Find My Numbers" });
  await submitButton.waitFor({ state: "visible", timeout: 60_000 });

  const hydrationStatus = page.getByText("Preparing number search…");
  await hydrationStatus.waitFor();
  await areaCodeInput.evaluate((input) => {
    input.value = "571";
  });
  await industryInput.evaluate((input) => {
    input.value = "electrician";
  });
  assert.equal(await submitButton.isDisabled(), true, "test must interact before hydration");

  await hydrationStatus.waitFor({
    state: "hidden",
    timeout: 15_000,
  });
  assert.equal(await areaCodeInput.inputValue(), "571");
  assert.equal(await industryInput.inputValue(), "electrician");
  assert.equal(await submitButton.isEnabled(), true);

  await submitButton.click();
  await page.getByText("No numbers matched your search. Try different filters.").waitFor();
  assert.deepEqual(searchRequestBody, {
    mode: "business",
    numberType: "local",
    areaCodes: ["571"],
    industry: "electrician",
    suggestedKeywords: [],
    extraKeywords: [],
  });

  console.log("PASS homepage number search preserves pre-hydration input and submits");
} finally {
  await browser.close();
}
