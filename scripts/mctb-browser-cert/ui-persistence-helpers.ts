import { execSync } from "node:child_process";
import type { Page } from "playwright";
import type { CertRow } from "./matrix";
import { snapshotBackend } from "./snapshot";

export type UiPersistenceHoleResult = {
  hole: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
};

export async function dismissBlockingOnboardingModal(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const overlay = page.locator('[data-slot="dialog-overlay"]');
    const portal = page.locator('[data-slot="dialog-portal"]');
    const blocking = await overlay.isVisible().catch(() => false);
    if (!blocking && !(await portal.isVisible().catch(() => false))) return;
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
    const close = page.getByRole("button", { name: /close|not now|dismiss|skip/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click().catch(() => undefined);
      await page.waitForTimeout(500);
    }
    await overlay.waitFor({ state: "hidden", timeout: 5000 }).catch(() => undefined);
  }
}

export async function gotoMctb(
  page: Page,
  base: string,
  path: string,
  waitMs = 1200,
): Promise<void> {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await dismissBlockingOnboardingModal(page);
  await page.waitForTimeout(waitMs);
}

function isPostTo(r: { url: () => string; request: () => { method: () => string } }, part: string) {
  return r.url().includes(part) && r.request().method() === "POST";
}

export async function clickSaveAndWaitApi(
  page: Page,
  saveName: RegExp = /save/i,
  urlPart: string | string[] = "/api/mctb/setup",
): Promise<number | null> {
  const save = page.getByRole("button", { name: saveName }).first();
  if (!(await save.isVisible().catch(() => false))) return null;
  const parts = Array.isArray(urlPart) ? urlPart : [urlPart];
  const res = await Promise.all([
    page.waitForResponse(
      (r) => parts.some((p) => isPostTo(r, p)),
      { timeout: 60_000 },
    ),
    save.click(),
  ])
    .then(([r]) => r)
    .catch(() => null);
  await page.waitForTimeout(1500);
  return res?.status() ?? null;
}

export async function pollRuntimeField(
  workspaceId: string,
  field: string,
  expected: unknown,
  attempts = 20,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const v = backendRuntime(workspaceId)[field];
    if (v === expected) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return backendRuntime(workspaceId)[field] === expected;
}

export async function pollLeadRecoveryField(
  workspaceId: string,
  field: string,
  expected: unknown,
  attempts = 20,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const v = snapshotBackend(workspaceId).leadRecovery?.[field];
    if (v === expected) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return snapshotBackend(workspaceId).leadRecovery?.[field] === expected;
}

export async function pollHandoffEmail(
  workspaceId: string,
  email: string,
  attempts = 20,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const emails = (snapshotBackend(workspaceId).handoff?.emails as string[]) ?? [];
    if (emails.includes(email)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return ((snapshotBackend(workspaceId).handoff?.emails as string[]) ?? []).includes(email);
}

export async function pollHandoffField(
  workspaceId: string,
  field: string,
  expected: unknown,
  attempts = 20,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const v = snapshotBackend(workspaceId).handoff?.[field];
    if (v === expected) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return snapshotBackend(workspaceId).handoff?.[field] === expected;
}

export async function pollPersistedField(
  workspaceId: string,
  field: string,
  expected: unknown,
  attempts = 20,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const v = snapshotBackend(workspaceId).persisted?.[field];
    if (v === expected) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return snapshotBackend(workspaceId).persisted?.[field] === expected;
}

export async function pollOnboardingField(
  workspaceId: string,
  field: string,
  expected: unknown,
  attempts = 20,
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const v = snapshotBackend(workspaceId).onboarding?.[field];
    if (v === expected) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return snapshotBackend(workspaceId).onboarding?.[field] === expected;
}

export function minutesFromCooldownLabel(label: string): number {
  if (label === "30 minutes") return 30;
  if (label === "1 hour") return 60;
  if (label === "3 hours") return 180;
  if (label === "6 hours") return 360;
  if (label === "12 hours") return 720;
  if (label === "24 hours") return 1440;
  if (label === "7 days") return 10080;
  const m = /^(\d+)\s*minutes?$/i.exec(label.trim());
  if (m) return Math.max(1, Number(m[1]));
  return 1440;
}

export function cooldownLabelFromMinutes(min: number): string {
  if (min === 30) return "30 minutes";
  if (min === 60) return "1 hour";
  if (min === 180) return "3 hours";
  if (min === 360) return "6 hours";
  if (min === 720) return "12 hours";
  if (min === 1440) return "24 hours";
  if (min === 10080) return "7 days";
  return `${min} minutes`;
}

export type CertWorkspaceBaseline = {
  phoneNumberId: string | null;
  runtime: Record<string, unknown>;
  onboarding: Record<string, unknown>;
  voicemailGreeting: string | null;
};

export function captureCertBaseline(workspaceId: string): CertWorkspaceBaseline {
  const snap = snapshotBackend(workspaceId);
  return {
    phoneNumberId: (snap.effective?.runtimePhoneNumberId as string) ?? null,
    runtime: { ...(snap.runtime ?? {}) },
    onboarding: { ...(snap.onboarding ?? {}) },
    voicemailGreeting: (snap.voicemail?.greetingText as string) ?? null,
  };
}

export function restoreCertWorkspaceBaseline(baseline: CertWorkspaceBaseline): void {
  execSync("npx tsx scripts/mctb-browser-cert/apply-cert-baseline.ts", {
    cwd: process.cwd(),
    env: {
      ...process.env,
      WORKSPACE_ID: process.env.MCTB_PROD_CERT_WORKSPACE_ID?.trim() || "ws_1",
      CERT_BASELINE_JSON: JSON.stringify(baseline),
      NODE_OPTIONS: "--import ./scripts/preload-server-only.mjs",
    },
    stdio: "inherit",
    timeout: 120_000,
  });
}

function recordMatrixPersist(
  record: (row: CertRow) => void,
  matrix: "G" | "H",
  hole: string,
  row: Omit<CertRow, "tab"> & { tab?: string },
  result: UiPersistenceHoleResult,
): void {
  const tag = matrix === "G" ? "G — UI persistence" : "H — remaining settings";
  const passLabel = matrix === "G" ? "PASS — UI PERSISTENCE (G)" : "PASS — UI PERSISTENCE (H)";
  const failLabel = matrix === "G" ? "FAIL — UI PERSISTENCE (G)" : "FAIL — UI PERSISTENCE (H)";
  record({
    route: row.route,
    page: row.page,
    tab: row.tab ?? tag,
    control: `[${hole}] ${row.control}`,
    browserAction: row.browserAction,
    uiResult: row.uiResult,
    backendResult: row.backendResult,
    refreshResult: row.refreshResult,
    effectiveRuntime: row.effectiveRuntime,
    status:
      result.status === "PASS"
        ? passLabel
        : result.status === "SKIP"
          ? "SKIP — CAPABILITY"
          : failLabel,
    defectFix: result.detail,
  });
}

export function recordMatrixG(
  record: (row: CertRow) => void,
  hole: string,
  row: Omit<CertRow, "tab"> & { tab?: string },
  result: UiPersistenceHoleResult,
): void {
  recordMatrixPersist(record, "G", hole, row, result);
}

export function recordMatrixH(
  record: (row: CertRow) => void,
  hole: string,
  row: Omit<CertRow, "tab"> & { tab?: string },
  result: UiPersistenceHoleResult,
): void {
  recordMatrixPersist(record, "H", hole, row, result);
}

export function backendRuntime(workspaceId: string): Record<string, unknown> {
  return snapshotBackend(workspaceId).runtime ?? {};
}

export async function hardReload(page: Page): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await dismissBlockingOnboardingModal(page);
  await page.waitForTimeout(1500);
}

/** Radix-style combobox (role=combobox), not native &lt;select&gt;. */
export async function selectComboboxOption(
  page: Page,
  triggerLocator: ReturnType<Page["locator"]>,
  optionPattern: RegExp,
): Promise<void> {
  await triggerLocator.click();
  await page.getByRole("option", { name: optionPattern }).first().click();
}
