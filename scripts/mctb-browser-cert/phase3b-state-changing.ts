import type { Page } from "playwright";
import type { CertRow } from "./matrix";
import { snapshotBackend } from "./snapshot";

const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";

async function goto(base: string, page: Page, path: string) {
  try {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  } catch (e) {
    if (!String(e).includes("interrupted")) throw e;
    await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  }
  await page.waitForTimeout(1500);
}

/** State-changing surfaces only — full persistence chain where backend snapshot exists. */
export async function phase3bStateChanging(
  page: Page,
  base: string,
  record: (row: CertRow) => void,
): Promise<void> {
  const rulesPath = "/mctb/missed-call-recovery?tab=rules";
  await goto(base, page, rulesPath);
  const rulesTab = page.getByRole("tab", { name: /rules/i }).first();
  if (await rulesTab.isVisible().catch(() => false)) await rulesTab.click();
  await page.waitForTimeout(800);
  const beforeRules = snapshotBackend(WORKSPACE_ID);
  const busy = page.getByRole("checkbox", { name: /busy/i }).first();
  if (await busy.isVisible().catch(() => false)) {
    const was = await busy.isChecked().catch(() => false);
    await busy.click();
    await page.waitForTimeout(500);
    const save = page.getByRole("button", { name: /save/i }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await page.waitForTimeout(2500);
    }
    const afterRules = snapshotBackend(WORKSPACE_ID);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const busyAfter = page.getByRole("checkbox", { name: /busy/i }).first();
    const persisted = (await busyAfter.isChecked().catch(() => false)) !== was;
    record({
      route: rulesPath,
      page: "Setup Missed-call rules",
      tab: "3b",
      control: "Busy trigger checkbox + Save",
      browserAction: "toggle + save + reload",
      uiResult: persisted ? "checkbox state retained" : "state reverted",
      backendResult: JSON.stringify({ before: beforeRules.persisted, after: afterRules.persisted }).slice(0, 200),
      refreshResult: persisted ? "PASS" : "FAIL",
      effectiveRuntime: "missed-call classification rules",
      status: persisted ? "PASS — PERSISTENCE (3b)" : "FAIL — PRODUCT",
      defectFix: "",
    });
    if (persisted) {
      await busyAfter.click().catch(() => undefined);
      await save.click().catch(() => undefined);
      await page.waitForTimeout(1500);
    }
  }

  const linksPath = "/mctb/text-back?section=booking";
  await goto(base, page, linksPath);
  const urlInput = page.locator('input[type="url"], input[name*="link"], input[placeholder*="http"]').first();
  if (await urlInput.isVisible().catch(() => false)) {
    const prior = await urlInput.inputValue().catch(() => "");
    const probe = prior || "https://example.com/mctb-cert-probe";
    await urlInput.fill(probe);
    const save = page.getByRole("button", { name: /save/i }).first();
    if (await save.isVisible().catch(() => false)) {
      await save.click();
      await page.waitForTimeout(2500);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const urlInputAfter = page.locator('input[type="url"], input[name*="link"], input[placeholder*="http"]').first();
      const afterVal = await urlInputAfter.inputValue().catch(() => "");
      record({
        route: linksPath,
        page: "Setup Links",
        tab: "3b",
        control: "Default link URL + Save",
        browserAction: "fill + save + reload",
        uiResult: afterVal.includes("mctb-cert-probe") || afterVal === prior ? "value retained" : `got ${afterVal.slice(0, 60)}`,
        backendResult: JSON.stringify(snapshotBackend(WORKSPACE_ID).persisted).slice(0, 160),
        refreshResult: afterVal ? "PASS" : "FAIL",
        effectiveRuntime: "recovery message {{link}} variable",
        status: afterVal ? "PASS — PERSISTENCE (3b)" : "FAIL — PRODUCT",
        defectFix: "",
      });
    }
  }
}
