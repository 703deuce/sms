import type { Page } from "playwright";
import { snapshotBackend } from "./snapshot";

export const CERT_RECIPIENT_EMAIL = "mctb-browser-cert@transovo.test";
export const CERT_RECIPIENT_EMAIL_EDITED = "mctb-browser-cert-edited@transovo.test";
export const CERT_RECIPIENT_MOBILE = "+15550118877";
export const CERT_WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";

export function certRecipientAlreadyInBackend(workspaceId = CERT_WORKSPACE_ID): boolean {
  const snap = snapshotBackend(workspaceId);
  return snap.handoff?.certRecipientPresent === true;
}

export function wireRecipientPromptDialogs(page: Page, mode: "add" | "edit") {
  page.on("dialog", async (dialog) => {
    if (dialog.type() !== "prompt") {
      await dialog.dismiss();
      return;
    }
    const msg = dialog.message().toLowerCase();
    if (msg.includes("name")) {
      await dialog.accept(mode === "add" ? "MCTB Cert Temp" : "MCTB Cert Edited");
    } else if (msg.includes("email")) {
      await dialog.accept(mode === "add" ? CERT_RECIPIENT_EMAIL : CERT_RECIPIENT_EMAIL_EDITED);
    } else if (msg.includes("mobile")) {
      await dialog.accept(CERT_RECIPIENT_MOBILE);
    } else {
      await dialog.accept("ok");
    }
  });
}

export async function waitForNotificationsEditor(page: Page) {
  await page
    .getByText(/loading notifications/i)
    .waitFor({ state: "hidden", timeout: 60_000 })
    .catch(() => undefined);
  await page
    .locator("button")
    .filter({ hasText: /add recipient/i })
    .first()
    .waitFor({ state: "visible", timeout: 60_000 })
    .catch(() => undefined);
}

export async function ensureCertRecipientVisibleInUi(
  page: Page,
  base: string,
  path = "/mctb/notifications",
): Promise<{ usedExisting: boolean; uiVisible: boolean }> {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitForNotificationsEditor(page);

  const existing = certRecipientAlreadyInBackend();
  let uiVisible = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);

  if (existing && uiVisible) {
    return { usedExisting: true, uiVisible: true };
  }

  if (existing && !uiVisible) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForNotificationsEditor(page);
    uiVisible = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
    if (uiVisible) {
      return { usedExisting: true, uiVisible: true };
    }
  }

  if (existing) {
    return { usedExisting: true, uiVisible: false };
  }

  wireRecipientPromptDialogs(page, "add");
  const addBtn = page.locator("button").filter({ hasText: /add recipient/i }).first();
  await addBtn.click({ timeout: 12_000 }).catch(() => addBtn.evaluate((el) => (el as HTMLElement).click()));
  await page.waitForTimeout(2500);
  uiVisible = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
  return { usedExisting: false, uiVisible };
}
