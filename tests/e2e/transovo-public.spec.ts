import { test, expect } from "@playwright/test";

test.describe("Transovo public surfaces", () => {
  test("login page loads", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("body")).toContainText(/log in|sign in/i);
  });

  test("callback requests page does not 500", async ({ page }) => {
    const res = await page.goto("/voice/callback-requests");
    expect(res?.status()).toBeLessThan(500);
  });

  test("smart routing analytics page does not 500", async ({ page }) => {
    const res = await page.goto("/smart-routing/analytics");
    expect(res?.status()).toBeLessThan(500);
  });
});
