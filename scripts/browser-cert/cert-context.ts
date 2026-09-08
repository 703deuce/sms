/**
 * Shared context for go-live certification groups (one browser session per group).
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, ERROR_PATTERNS, NAV_TIMEOUT, visitRoute } from "./lib";

export class CertContext {
  constructor(readonly page: Page) {}

  async visit(path: string, opts?: { allow404?: boolean }) {
    const v = await visitRoute(this.page, path, opts);
    if (!v.ok) throw new Error(`${path}: ${v.note}`);
    await this.assertNoErrorPage();
  }

  async bodyText() {
    return this.page.locator("body").innerText();
  }

  async assertNoErrorPage() {
    const body = await this.bodyText();
    for (const p of ERROR_PATTERNS) {
      if (p.test(body)) throw new Error(`Error page detected: ${p}`);
    }
  }

  async clickButton(name: RegExp, opts?: { timeout?: number }) {
    const btn = this.page.getByRole("button", { name }).first();
    await btn.waitFor({ state: "visible", timeout: opts?.timeout ?? ACTION_TIMEOUT });
    await btn.click({ timeout: ACTION_TIMEOUT });
  }

  async clickLink(name: RegExp) {
    const link = this.page.getByRole("link", { name }).first();
    if (await link.count()) await link.click({ timeout: ACTION_TIMEOUT });
  }

  async fillFirst(selector: string, value: string) {
    const el = this.page.locator(selector).first();
    if (await el.count()) await el.fill(value);
  }

  async save(saveLabel: RegExp = /save/i) {
    const save = this.page.getByRole("button", { name: saveLabel }).first();
    await save.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
    if (await save.isDisabled()) throw new Error(`Save button disabled: ${saveLabel}`);
    await save.click({ timeout: ACTION_TIMEOUT });
    await this.page.waitForTimeout(1500);
    const saved = this.page.getByText(/saved|all changes saved/i).first();
    if (await saved.count()) {
      await saved.waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {});
    }
  }

  async reload() {
    await this.page.reload({ waitUntil: "domcontentloaded" });
    await this.page.waitForTimeout(800);
    await this.assertNoErrorPage();
  }

  async reloadVerifyText(text: string | RegExp) {
    await this.reload();
    const body = await this.bodyText();
    if (typeof text === "string" && !body.includes(text)) {
      throw new Error(`Expected text after reload: ${text}`);
    }
    if (text instanceof RegExp && !text.test(body)) {
      throw new Error(`Expected pattern after reload: ${text}`);
    }
  }

  async waitForHeading(name: RegExp) {
    await this.page.getByRole("heading", { name }).first().waitFor({
      state: "visible",
      timeout: ACTION_TIMEOUT,
    });
  }

  async searchList(query: string) {
    const search = this.page.locator('input[type="search"], input[placeholder*="Search" i]').first();
    if (await search.count()) {
      await search.fill(query);
      await this.page.waitForTimeout(500);
      await search.fill("");
      await this.page.waitForTimeout(300);
    }
  }

  async goBack() {
    await this.page.goBack({ timeout: ACTION_TIMEOUT });
    await this.page.waitForTimeout(400);
  }

  async setMobileViewport() {
    await this.page.setViewportSize({ width: 390, height: 844 });
  }

  async setDesktopViewport() {
    await this.page.setViewportSize({ width: 1440, height: 900 });
  }
}

export async function configPageSaveReload(
  ctx: CertContext,
  path: string,
  heading: RegExp,
  saveLabel: RegExp,
  mutate?: (ctx: CertContext) => Promise<string | void>,
) {
  await ctx.visit(path);
  await ctx.waitForHeading(heading);
  const marker = await mutate?.(ctx);
  await ctx.save(saveLabel);
  if (marker) await ctx.reloadVerifyText(marker);
  else await ctx.reload();
}
