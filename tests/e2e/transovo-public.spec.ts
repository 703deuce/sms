import { test, expect } from "@playwright/test";

test.describe("Transovo public surfaces", () => {
  test("login page loads", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("body")).toContainText(/log in|sign in/i);
  });

  test("MCTB request form route returns form or error shell", async ({ page }) => {
    const res = await page.goto("/f/mctb/invalid-token-test");
    expect(res?.status()).toBeLessThan(500);
  });
});
