import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
const isProductionTarget = /transovo\.ai/i.test(baseUrl);
const configuredChromePath = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";
const executablePath = existsSync(configuredChromePath)
  ? configuredChromePath
  : chromium.executablePath();
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--no-sandbox"],
});

const expectedRequestBody = {
  mode: "business",
  numberType: "local",
  areaCodes: ["571"],
  industry: "electrician",
  suggestedKeywords: [],
  extraKeywords: [],
};

function attachRuntimeGuards(page, label) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`${label}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(`${label}: ${error.message}`);
  });

  return () => {
    assert.equal(
      consoleErrors.length,
      0,
      `unexpected console errors:\n${consoleErrors.join("\n")}`,
    );
    assert.equal(pageErrors.length, 0, `unexpected page errors:\n${pageErrors.join("\n")}`);
  };
}

async function mockSearch(page, responseDelayMs = 0) {
  let requestBody = null;
  await page.route("**/api/public/numbers/search", async (route) => {
    requestBody = route.request().postDataJSON();
    if (responseDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    }
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
  return () => requestBody;
}

async function assertProductionHomepageSurface(page) {
  const html = await page.content();
  assert.match(html, /\$4\.99|Starting at \$4\.99/i, "homepage should surface personal pricing anchor");
  assert.match(html, /Top Picks|Near You|Get This Number/i, "homepage should render Top Picks section");
  assert.match(html, /30-day portability guarantee|30-Day Portability Guarantee/i);
}

try {
  if (!isProductionTarget) {
    const delayedPage = await browser.newPage();
    const assertDelayedRuntime = attachRuntimeGuards(delayedPage, "delayed-hydration");
    let delayedStaticChunks = 0;
    await delayedPage.route(/\/_next\/static\/.*\.js/, async (route) => {
      if (delayedStaticChunks < 4) {
        delayedStaticChunks += 1;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.continue();
    });
    const getDelayedRequestBody = await mockSearch(delayedPage);

    await delayedPage.goto(`${baseUrl}/?hydration-regression=delayed`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const delayedAreaCodeInput = delayedPage.locator('input[placeholder="571"]');
    const delayedIndustryInput = delayedPage.locator('input[placeholder="electrician"]');
    const delayedSubmitButton = delayedPage.getByRole("button", { name: "Find My Numbers" });
    const delayedHydrationStatus = delayedPage.getByText("Preparing number search…");

    await delayedHydrationStatus.waitFor();
    await delayedAreaCodeInput.evaluate((input) => {
      input.value = "571";
    });
    await delayedIndustryInput.evaluate((input) => {
      input.value = "electrician";
    });
    assert.equal(await delayedSubmitButton.isDisabled(), true, "test must interact before hydration");

    await delayedHydrationStatus.waitFor({
      state: "hidden",
      timeout: 15_000,
    });
    assert.equal(await delayedAreaCodeInput.inputValue(), "571");
    assert.equal(await delayedIndustryInput.inputValue(), "electrician");
    assert.equal(await delayedSubmitButton.isEnabled(), true);
    await delayedSubmitButton.click();
    await delayedPage.getByText("No numbers matched your search. Try different filters.").waitFor();
    assert.deepEqual(getDelayedRequestBody(), expectedRequestBody);
    assertDelayedRuntime();
    await delayedPage.close();
  }

  const browserPage = await browser.newPage();
  const assertBrowserRuntime = attachRuntimeGuards(browserPage, "trusted-input");
  await browserPage.addInitScript(() => {
    window.__numberSearchInputEvents = [];
    document.addEventListener(
      "input",
      (event) => {
        const input = event.target;
        if (input instanceof HTMLInputElement) {
          window.__numberSearchInputEvents.push({
            placeholder: input.placeholder,
            value: input.value,
            trusted: event.isTrusted,
          });
        }
      },
      true,
    );
  });
  const getBrowserRequestBody = await mockSearch(browserPage, 500);

  await browserPage.goto(`${baseUrl}/?hydration-regression=browser`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });

  const areaCodeInput = browserPage.locator('input[placeholder="571"]');
  const industryInput = browserPage.locator('input[placeholder="electrician"]');
  const submitButton = browserPage.getByRole("button", { name: "Find My Numbers" });
  await browserPage.getByText("Preparing number search…").waitFor({
    state: "hidden",
    timeout: 15_000,
  });

  await areaCodeInput.click();
  await areaCodeInput.pressSequentially("571");
  await industryInput.click();
  await industryInput.pressSequentially("electrician");

  assert.equal(await submitButton.isEnabled(), true, "trusted typing must update React state");
  const inputEvents = await browserPage.evaluate(() => window.__numberSearchInputEvents);
  assert.equal(inputEvents.length, 14);
  assert.equal(inputEvents.every((event) => event.trusted), true, "typing events must be trusted");
  assert.equal(inputEvents.at(-1)?.value, "electrician");

  const buttonReceivesCenterClick = await submitButton.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return target === button || Boolean(target && button.contains(target));
  });
  assert.equal(buttonReceivesCenterClick, true, "another element must not cover the submit button");

  const searchRequest = browserPage.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/public/numbers/search",
  );
  await submitButton.click();
  await searchRequest;
  await browserPage.getByRole("button", { name: "Searching…" }).waitFor();
  await browserPage.getByText("No numbers matched your search. Try different filters.").waitFor();
  assert.deepEqual(getBrowserRequestBody(), expectedRequestBody);
  assertBrowserRuntime();
  await browserPage.close();

  if (isProductionTarget) {
    const surfacePage = await browser.newPage();
    const assertSurfaceRuntime = attachRuntimeGuards(surfacePage, "production-surface");
    await surfacePage.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
    await assertProductionHomepageSurface(surfacePage);
    assertSurfaceRuntime();
    await surfacePage.close();
  }

  console.log(
    `PASS homepage number search handles delayed hydration and trusted post-hydration interaction (${baseUrl})`,
  );
} finally {
  await browser.close();
}
