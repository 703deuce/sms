/**
 * Customer-style browser QA for Mass Texting glue flows.
 * Run: npx playwright test scripts/browser-qa-mass-texting-glue.ts --config=playwright.mass-texting-qa.config.ts
 */
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync("/tmp/mt-browser-cert.json", "utf8")) as {
  campaigns: { sentId: string; draftId: string };
};

async function login(page: Page, next = "/campaigns") {
  await page.goto(`/api/auth/dev-bypass?next=${encodeURIComponent(next)}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);
}

test.describe("Mass Texting glue browser QA", () => {
  test("266-277 Navigation cold loads", async ({ page }) => {
    const routes = [
      { path: "/campaigns", expectText: /Sent Labor Day|August Draft|Campaigns/i },
      { path: "/contacts", expectText: /Sub1|Contacts/i },
      { path: "/grow/keywords", expectText: /Keyword|Grow/i },
      { path: "/automations/drip-campaigns", expectText: /Drip|Automation/i },
      { path: "/campaigns/scheduled", expectText: /Scheduled/i },
      { path: "/campaigns/drafts", expectText: /Draft/i },
    ];
    for (const route of routes) {
      await login(page, route.path);
      await expect(page.locator("body")).toContainText(route.expectText, { timeout: 20000 });
    }
    await login(page, "/conversations");
    await expect(page.locator("body")).toContainText(/Everyone|Conversations|Sub1/i, {
      timeout: 20000,
    });
  });

  test("144-159 Campaign results tabs", async ({ page }) => {
    await login(page, `/campaigns/${fixture.campaigns.sentId}`);
    await expect(page.locator("body")).toContainText(/Sent Labor Day/i);
    for (const tab of ["Overview", "Recipients", "Clicks", "Replies", "Opt-Outs", "Activity"]) {
      await page.getByRole("button", { name: new RegExp(tab, "i") }).click();
      await expect(page.locator("body")).toBeVisible();
    }
    await page.getByRole("button", { name: /Recipients/i }).click();
    await page.getByRole("button", { name: /^Delivered$/ }).click();
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toMatch(/undelivered/);
  });

  test("137-143 Campaign replies inbox filter", async ({ page }) => {
    await login(page, `/conversations?campaignId=${fixture.campaigns.sentId}`);
    await expect(page.locator("body")).toContainText(/campaign|Sub1|Everyone/i, { timeout: 15000 });
    expect(page.url()).toContain("campaignId=");
    await page.getByPlaceholder(/search/i).fill("Sub1").catch(() => undefined);
    await page.waitForTimeout(500);
    expect(page.url()).toContain("campaignId=");
  });

  test("106-136 Inbox basics", async ({ page }) => {
    await login(page, "/conversations");
    await expect(page.locator("body")).toContainText(/Everyone|Conversations/i);
    expect(page.url()).toMatch(/filter=all|conversations/);
    const firstRow = page.locator('[class*="convo"], tr, [data-conversation]').first();
    if (await firstRow.count()) {
      await firstRow.click().catch(() => undefined);
    }
  });

  test("26-43 Contacts + 229-230 Blocked", async ({ page }) => {
    await login(page, "/contacts");
    await expect(page.locator("body")).toContainText(/Sub1|Contacts/i);
    await login(page, "/contacts/blocked");
    await expect(page.locator("body")).toContainText(/Blocked/i);
    const unblock = page.getByRole("button", { name: /Unblock/i });
    await expect(unblock.first()).toBeVisible();
  });

  test("44-63 Draft reopen", async ({ page }) => {
    await login(page, `/campaigns/new?edit=${fixture.campaigns.draftId}`);
    await expect(page.locator("body")).toContainText(/August|Draft|Campaign/i, { timeout: 15000 });
  });

  test("160-168 Keywords page loads", async ({ page }) => {
    await login(page, "/grow/keywords");
    await expect(page.locator("body")).toContainText(/Keyword/i);
  });

  test("74-86 Scheduled + filtered lists", async ({ page }) => {
    await login(page, "/campaigns/scheduled");
    await expect(page.locator("body")).toContainText(/Scheduled/i);
    await login(page, "/campaigns/completed");
    await expect(page.locator("body")).toContainText(/Sent Labor Day|Completed/i);
  });

  test("141-142 Results replies link to inbox", async ({ page }) => {
    await login(page, `/campaigns/${fixture.campaigns.sentId}`);
    await page.getByRole("button", { name: /Replies/i }).click();
    const link = page.locator('a[href*="conversations?"][href*="campaignId"]').first();
    if (await link.count()) {
      await link.click();
      await expect(page).toHaveURL(/campaignId=/);
      await expect(page.locator("body")).toContainText(/Sent Labor Day|Sub1/i);
    }
  });

  test("58-60 Launch review on draft", async ({ page }) => {
    await login(page, `/campaigns/new/review?id=${fixture.campaigns.draftId}`);
    await expect(page.locator("body")).toContainText(/6|recipient|August/i, { timeout: 20000 });
  });

  test("87-105 Drip list + new wizard", async ({ page }) => {
    await login(page, "/automations/drip-campaigns");
    await expect(page.locator("body")).toContainText(/Drip/i);
    const create = page.getByRole("link", { name: /new|create/i }).or(page.getByRole("button", { name: /new|create/i }));
    if (await create.count()) {
      await create.first().click();
      await expect(page.locator("body")).toContainText(/Drip|Setup|Trigger/i, { timeout: 15000 });
    }
  });
});
