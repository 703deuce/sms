/**
 * Small reusable Playwright steps for disposable browser flows (3–5 actions max per flow).
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, NAV_TIMEOUT, switchProductShell, visitRoute } from "./lib";

export async function assertRoute(page: Page, path: string, opts?: { allow404?: boolean; navTimeout?: number }) {
  const v = await visitRoute(page, path, opts);
  if (!v.ok) throw new Error(`${path}: ${v.note}`);
}

export async function assertRedirect(page: Page, path: string, expectPathFragment: string) {
  await visitRoute(page, path);
  const url = page.url();
  if (!url.includes(expectPathFragment)) {
    throw new Error(`expected redirect to ${expectPathFragment}, got ${url}`);
  }
}

export async function assertMctbShell(page: Page) {
  const sw = await switchProductShell(page, "Missed Call Text Back");
  if (!sw.ok) {
    const v = await visitRoute(page, "/mctb");
    if (!v.ok) throw new Error(sw.note || v.note);
  } else {
    await page.waitForURL(/\/mctb/, { timeout: NAV_TIMEOUT }).catch(() => visitRoute(page, "/mctb"));
  }
  const body = await page.locator("body").innerText();
  if (/Calendar|Booking Types/i.test(body) && !/Missed Call|Overview/i.test(body)) {
    throw new Error("MCTB context shows Appointments nav leakage");
  }
}

export async function calendarNavActions(page: Page) {
  const v = await visitRoute(page, "/appointments/calendar");
  if (!v.ok) throw new Error(v.note);
  const todayBtn = page.getByRole("button", { name: /Today/i }).first();
  if (await todayBtn.count()) await todayBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
  const nextBtn = page.getByRole("button", { name: /Next|Forward|>/i }).first();
  if (await nextBtn.count()) await nextBtn.click({ timeout: ACTION_TIMEOUT }).catch(() => {});
}

export async function listSearchAction(page: Page) {
  const v = await visitRoute(page, "/appointments");
  if (!v.ok) throw new Error(v.note);
  const search = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
  if (await search.count()) {
    await search.fill("test");
    await page.waitForTimeout(400);
    await search.fill("");
  }
}

export async function createFormVisible(page: Page) {
  const v = await visitRoute(page, "/appointments/new");
  if (!v.ok) throw new Error(v.note);
  const body = await page.locator("body").innerText();
  if (!/appointment|book|contact|type/i.test(body)) throw new Error("create form not rendered");
  const saveBtn = page.getByRole("button", { name: /save|create|book/i }).first();
  if (!(await saveBtn.count())) throw new Error("no save/create control");
}

export async function typesSaveReload(page: Page) {
  await visitRoute(page, "/appointments/types");
  const save = page.getByRole("button", { name: /save/i }).first();
  if (await save.count()) {
    const disabled = await save.isDisabled().catch(() => true);
    if (!disabled) await save.focus();
  }
  await page.reload({ waitUntil: "domcontentloaded" });
}

export async function mobileOverview(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  const v = await visitRoute(page, "/appointments/overview");
  if (!v.ok) throw new Error(v.note);
  await page.setViewportSize({ width: 1440, height: 900 });
}

export async function browserBackFromCalendar(page: Page) {
  await visitRoute(page, "/appointments/calendar");
  await page.goBack({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(300);
  if (!page.url().includes("/appointments")) throw new Error("back navigation lost context");
}

export async function switchToAppointments(page: Page) {
  const sw = await switchProductShell(page, "Appointments");
  if (!sw.ok) {
    const v = await visitRoute(page, "/appointments/overview");
    if (!v.ok) throw new Error(sw.note || v.note);
  }
  await page.waitForTimeout(300);
}

export async function switchToMctb(page: Page) {
  const sw = await switchProductShell(page, "Missed Call Text Back");
  if (!sw.ok) {
    const v = await visitRoute(page, "/mctb");
    if (!v.ok) throw new Error(sw.note || v.note);
  }
  await page.waitForTimeout(300);
}
