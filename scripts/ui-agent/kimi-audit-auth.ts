/**
 * Dev-bypass auth for Kimi UI audits against a local base URL.
 * Avoids following dev-bypass redirects to APP_URL (e.g. production).
 */
import type { BrowserContext, Page } from "playwright";

export async function authenticateKimiAudit(page: Page, base: string) {
  const context = page.context() as BrowserContext;
  const bypass = await context.request.get(`${base}/api/auth/dev-bypass?next=/dashboard`, {
    maxRedirects: 0,
  });
  if (bypass.status() !== 302 && bypass.status() !== 303) {
    throw new Error(`dev-bypass expected redirect, got ${bypass.status()}`);
  }
  await page.goto(`${base}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(300);
}
