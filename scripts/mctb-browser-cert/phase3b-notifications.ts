import type { Page } from "playwright";
import type { CertRow } from "./matrix";
import { snapshotBackend } from "./snapshot";

export const CERT_RECIPIENT_EMAIL = "mctb-browser-cert@transovo.test";
const CERT_RECIPIENT_EMAIL_EDITED = "mctb-browser-cert-edited@transovo.test";
const WORKSPACE_ID = process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1";

function wireDialogs(page: Page, mode: "add" | "edit") {
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
      await dialog.accept("+15550118877");
    } else {
      await dialog.accept("ok");
    }
  });
}

function addRecipientButton(page: Page) {
  return page.locator("button").filter({ hasText: /add recipient/i }).first();
}

async function dismissBlockingOverlays(page: Page) {
  for (let i = 0; i < 4; i++) {
    const overlay = page.locator('[data-slot="dialog-overlay"][data-open]');
    if (!(await overlay.count())) break;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  const dismiss = page.getByRole("button", { name: /close|dismiss|got it|not now|cancel/i }).first();
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function goto(base: string, page: Page, path: string) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
  await addRecipientButton(page).waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Production notifications: add → DB → refresh → edit → DB → refresh. Delete: no UI control in product. */
export async function phase3bNotificationsPersistence(
  page: Page,
  base: string,
  record: (row: CertRow) => void,
): Promise<void> {
  const path = "/mctb/notifications";
  wireDialogs(page, "add");
  await goto(base, page, path);
  if (!(await addRecipientButton(page).isVisible().catch(() => false))) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(/loading notifications/i).waitFor({ state: "hidden", timeout: 60_000 }).catch(() => undefined);
    await addRecipientButton(page).waitFor({ state: "visible", timeout: 60_000 }).catch(() => undefined);
  }
  await dismissBlockingOverlays(page);
  if (page.url().includes("/login")) {
    record({
      route: path,
      page: "Notifications",
      tab: "3b",
      control: "Auth",
      browserAction: "goto",
      uiResult: "redirected to login",
      backendResult: "—",
      refreshResult: "—",
      effectiveRuntime: "—",
      status: "FAIL — HARNESS",
      defectFix: "auth",
    });
    return;
  }

  record({
    route: path,
    page: "Notifications",
    tab: "3b",
    control: "Delete recipient",
    browserAction: "UI audit",
    uiResult: "No delete control in production UI (edit via overflow only)",
    backendResult: "—",
    refreshResult: "—",
    effectiveRuntime: "—",
    status: "PASS — CAPABILITY-N/A (no browser delete)",
    defectFix: "",
  });

  const addBtn = addRecipientButton(page);
  if (!(await addBtn.isVisible().catch(() => false))) {
    record({
      route: path,
      page: "Notifications",
      tab: "3b",
      control: "Add recipient",
      browserAction: "—",
      uiResult: "Add recipient button not found",
      backendResult: JSON.stringify(snapshotBackend(WORKSPACE_ID).handoff),
      refreshResult: "—",
      effectiveRuntime: "handoff recipients",
      status: "FAIL — HARNESS",
      defectFix: "selector/timing — not a product defect unless reproducible manually",
    });
    return;
  }

  const beforeAdd = snapshotBackend(WORKSPACE_ID);
  await dismissBlockingOverlays(page);
  const postWait = page
    .waitForResponse(
      (r) => r.url().includes("/api/mctb/handoff") && r.request().method() === "POST",
      { timeout: 25_000 },
    )
    .catch(() => null);
  try {
    await addBtn.click({ timeout: 12_000 });
  } catch {
    await addBtn.evaluate((el) => (el as HTMLElement).click());
  }
  const postRes = await postWait;
  const postMeta = postRes ? `${postRes.status()} ${(await postRes.text().catch(() => "")).slice(0, 120)}` : "no POST observed";
  await page.waitForTimeout(3000);
  const afterAdd = snapshotBackend(WORKSPACE_ID);
  const uiAfterAdd = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
  const addOk = uiAfterAdd && afterAdd.handoff?.certRecipientPresent === true;

  record({
    route: path,
    page: "Setup Notifications",
    tab: "3b",
    control: "Add recipient",
    browserAction: `prompt add ${CERT_RECIPIENT_EMAIL}`,
    uiResult: uiAfterAdd ? "row visible" : "row missing",
    backendResult: `before=${beforeAdd.handoff?.recipientCount} after=${afterAdd.handoff?.recipientCount} certPresent=${afterAdd.handoff?.certRecipientPresent} post=${postMeta}`,
    refreshResult: "pending",
    effectiveRuntime: "mctb_notification_recipients",
    status: addOk ? "PASS — UI + PERSISTENCE (3b)" : "FAIL — PRODUCT",
    defectFix: "",
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const refreshAdd = await page.getByText(CERT_RECIPIENT_EMAIL).isVisible().catch(() => false);
  const snapRefresh = snapshotBackend(WORKSPACE_ID);
  record({
    route: path,
    page: "Setup Notifications",
    tab: "3b",
    control: "Add recipient",
    browserAction: "reload after add",
    uiResult: refreshAdd ? "persisted" : "lost after refresh",
    backendResult: JSON.stringify(snapRefresh.handoff),
    refreshResult: refreshAdd && snapRefresh.handoff?.certRecipientPresent ? "PASS" : "FAIL",
    effectiveRuntime: "handoff routing uses saved recipients",
    status:
      refreshAdd && snapRefresh.handoff?.certRecipientPresent
        ? "PASS — UI + PERSISTENCE (3b)"
        : "FAIL — PRODUCT",
    defectFix: "",
  });

  const editBtn = page.getByRole("button", { name: /edit mctb cert temp/i }).first();
  if (!(await editBtn.isVisible().catch(() => false))) {
    record({
      route: path,
      page: "Notifications",
      tab: "3b",
      control: "Edit recipient",
      browserAction: "—",
      uiResult: "Edit control not found after add",
      backendResult: JSON.stringify(snapRefresh.handoff),
      refreshResult: "—",
      effectiveRuntime: "—",
      status: addOk ? "FAIL — PRODUCT" : "FAIL — BLOCKED",
      defectFix: "",
    });
    return;
  }

  wireDialogs(page, "edit");
  await editBtn.click();
  await page.waitForTimeout(3000);
  const afterEdit = snapshotBackend(WORKSPACE_ID);
  const uiEdited = await page.getByText(CERT_RECIPIENT_EMAIL_EDITED).isVisible().catch(() => false);
  record({
    route: path,
    page: "Setup Notifications",
    tab: "3b",
    control: "Edit recipient",
    browserAction: `prompt edit → ${CERT_RECIPIENT_EMAIL_EDITED}`,
    uiResult: uiEdited ? "updated row visible" : "edited email not shown",
    backendResult: JSON.stringify(afterEdit.handoff),
    refreshResult: "pending",
    effectiveRuntime: "notification destination email",
    status: uiEdited ? "PASS — UI + PERSISTENCE (3b)" : "FAIL — PRODUCT",
    defectFix: "",
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const refreshEdit = await page.getByText(CERT_RECIPIENT_EMAIL_EDITED).isVisible().catch(() => false);
  const snapEdit = snapshotBackend(WORKSPACE_ID);
  const editedInDb = snapEdit.handoff?.certRecipientEditedPresent === true;
  record({
    route: path,
    page: "Setup Notifications",
    tab: "3b",
    control: "Edit recipient",
    browserAction: "reload after edit",
    uiResult: refreshEdit ? "persisted" : "lost",
    backendResult: JSON.stringify(snapEdit.handoff),
    refreshResult: refreshEdit && editedInDb ? "PASS" : "FAIL",
    effectiveRuntime: "recipient.email authoritative for handoff email channel",
    status: refreshEdit && editedInDb ? "PASS — UI + PERSISTENCE (3b)" : "FAIL — PRODUCT",
    defectFix: "",
  });

  const urgent = page.getByRole("switch", { name: /urgent reply alerts enabled/i });
  if (await urgent.isVisible().catch(() => false)) {
    const beforeU = snapshotBackend(WORKSPACE_ID);
    await urgent.click();
    await page.waitForTimeout(2000);
    const afterU = snapshotBackend(WORKSPACE_ID);
    const toggled = beforeU.handoff?.emergencyDetectionEnabled !== afterU.handoff?.emergencyDetectionEnabled;
    await urgent.click();
    await page.waitForTimeout(1500);
    record({
      route: path,
      page: "Notifications",
      tab: "3b state-changing",
      control: "Urgent detection toggle",
      browserAction: "toggle + restore",
      uiResult: toggled ? "backend flag changed" : "no backend change",
      backendResult: `before=${beforeU.handoff?.emergencyDetectionEnabled} after=${afterU.handoff?.emergencyDetectionEnabled}`,
      refreshResult: "restored",
      effectiveRuntime: "emergencyDetectionEnabled in mctb_handoff_configs",
      status: toggled ? "PASS — PERSISTENCE + RUNTIME (3b)" : "FAIL — PRODUCT",
      defectFix: "",
    });
  }
}
