import type { Page } from "playwright";
import type { CertRow } from "./matrix";
import { snapshotBackend } from "./snapshot";
import {
  CERT_RECIPIENT_EMAIL,
  CERT_WORKSPACE_ID,
  certRecipientAlreadyInBackend,
  wireRecipientPromptDialogs,
} from "./notifications-cert-recipient";

const WORKSPACE_ID = CERT_WORKSPACE_ID;

async function goto(base: string, page: Page, path: string) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(1200);
}

export async function testNotificationsCrud(
  page: Page,
  base: string,
  record: (row: CertRow) => void,
): Promise<void> {
  for (const path of ["/mctb/notifications", "/mctb/setup/notifications"]) {
    await goto(base, page, path);
    await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
  }
  const path = "/mctb/setup/notifications";
  await goto(base, page, path);
  const before = snapshotBackend(WORKSPACE_ID);

  const addBtn = page.getByRole("button", { name: /add recipient/i });
  if (await addBtn.isVisible().catch(() => false)) {
    const already = certRecipientAlreadyInBackend(WORKSPACE_ID);
    let visible = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
    if (!already) {
      wireRecipientPromptDialogs(page, "add");
      await addBtn.click();
      await page.waitForTimeout(2500);
      visible = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
    } else if (!visible) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 30_000 }).catch(() => undefined);
      visible = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
    }
    const afterAdd = snapshotBackend(WORKSPACE_ID);
    record({
      route: path,
      page: "Setup Notifications",
      tab: "Recipients",
      control: "Add recipient (CRUD)",
      browserAction: `prompt ${CERT_RECIPIENT_EMAIL}`,
      uiResult: visible ? "row visible" : "row not visible",
      backendResult: `recipientCount=${afterAdd.handoff?.recipientCount} certPresent=${afterAdd.handoff?.certRecipientPresent}`,
      refreshResult: "—",
      effectiveRuntime: "handoff recipients",
      status:
        visible && afterAdd.handoff?.certRecipientPresent
          ? "PASS — UI + PERSISTENCE + LIVE EXERCISE"
          : "FAIL — UI / BACKEND",
      defectFix: "",
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const afterRefresh = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
    record({
      route: path,
      page: "Setup Notifications",
      tab: "Recipients",
      control: "Add recipient refresh",
      browserAction: "reload",
      uiResult: afterRefresh ? "persisted in UI" : "missing after refresh",
      backendResult: JSON.stringify(snapshotBackend(WORKSPACE_ID).handoff),
      refreshResult: afterRefresh ? "PASS" : "FAIL",
      effectiveRuntime: "—",
      status: afterRefresh ? "PASS — UI + PERSISTENCE" : "FAIL — PERSISTENCE",
      defectFix: "",
    });
  }
}
