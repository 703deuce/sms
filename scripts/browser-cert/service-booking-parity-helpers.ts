/**
 * User-journey helpers for service-booking parity browser UAT (production / transovo.ai).
 * Each helper: navigate → click/type → verify visible outcome (no backend-only assertions).
 */
import type { Page } from "playwright";
import { ACTION_TIMEOUT, visitRoute } from "./lib";
import { switchToAppointments } from "./flow-helpers";
import { ensureCertWorkspaceReadyViaApi } from "./behavioral-flow-helpers";
import { APPT_CANONICAL } from "./canonical-appointments-routes";

export async function ensureAppointmentsShell(page: Page) {
  await switchToAppointments(page);
  await visitRoute(page, "/appointments/overview");
}

export async function fetchWorkspaceSlug(page: Page): Promise<string> {
  const res = await page.request.get("/api/appointments/settings");
  if (!res.ok()) return "";
  const json = await res.json();
  return String(json.workspace?.slug || "");
}

export async function overviewPilotAndSearch(page: Page) {
  await ensureAppointmentsShell(page);
  const body = await page.locator("body").innerText();
  if (!/overview|appointments|home/i.test(body)) {
    throw new Error("Overview page did not load");
  }
  const search = page.locator("#appt-global-search, input[placeholder*='Search' i]").first();
  await search.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await search.fill("cert");
  await page.waitForTimeout(1200);
  const after = await page.locator("body").innerText();
  if (/loading/i.test(after) && after.length < 60) {
    throw new Error("Overview search stuck loading");
  }
}

export async function typesArchetypePickerVisible(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/types");
  await page.waitForTimeout(1500);
  const newBtn = page.getByRole("button", { name: /new type|add type|create/i }).first();
  if (await newBtn.count()) await newBtn.click({ timeout: ACTION_TIMEOUT });
  const body = await page.locator("body").innerText();
  if (!/Meeting|Service|Class/i.test(body)) {
    throw new Error("Booking type archetype picker (Meeting / Service / Class) not visible");
  }
}

export async function typeEditorSectionsVisible(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/types");
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  const required = [/Categories/i, /Resources/i, /Add-ons|Add-ons/i, /Intake/i, /phase/i];
  for (const pattern of required) {
    if (!pattern.test(body)) {
      throw new Error(`Type editor missing section matching ${pattern}`);
    }
  }
}

async function createViaBrowserPrompt(
  page: Page,
  namePrefix: string,
  triggerCreate: () => Promise<void>,
) {
  const unique = `${namePrefix} ${Date.now().toString().slice(-6)}`;
  page.once("dialog", async (dialog) => {
    await dialog.accept(unique);
  });
  await triggerCreate();
  await page.waitForTimeout(2500);
  const body = await page.locator("body").innerText();
  if (!body.includes(unique)) {
    throw new Error(`Create failed — "${unique}" not listed after prompt flow`);
  }
}

export async function commerceCreateItem(
  page: Page,
  route: string,
  tabLabel: RegExp,
  namePrefix: string,
) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, route);
  await page.waitForTimeout(800);

  const unique = `${namePrefix} ${Date.now().toString().slice(-6)}`;

  if (route.startsWith(APPT_CANONICAL.packages)) {
    await createViaBrowserPrompt(page, namePrefix, async () => {
      await page.getByRole("button", { name: /^Create$/i }).click({ timeout: ACTION_TIMEOUT });
    });
    return;
  }

  if (route.startsWith(APPT_CANONICAL.memberships)) {
    await createViaBrowserPrompt(page, namePrefix, async () => {
      await page.getByRole("button", { name: /^Create$/i }).click({ timeout: ACTION_TIMEOUT });
    });
    return;
  }

  if (route.startsWith(APPT_CANONICAL.giftCards)) {
    await createViaBrowserPrompt(page, namePrefix, async () => {
      await page.getByRole("button", { name: /^Create$/i }).click({ timeout: ACTION_TIMEOUT });
    });
    return;
  }

  if (route.startsWith(APPT_CANONICAL.discounts)) {
    await createViaBrowserPrompt(page, namePrefix, async () => {
      await page.getByRole("button", { name: /^Create$/i }).click({ timeout: ACTION_TIMEOUT });
    });
    return;
  }

  if (route.startsWith(APPT_CANONICAL.pos)) {
    const newCart = page.getByRole("button", { name: /new cart/i }).first();
    await newCart.click({ timeout: ACTION_TIMEOUT });
    const desc = page.locator('input[class*="rounded"]').first();
    await desc.fill(unique);
    await page.getByRole("button", { name: /add item/i }).click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    if (!body.includes(unique)) throw new Error(`POS product line "${unique}" not listed`);
    return;
  }

  const tab = page.getByRole("button", { name: tabLabel }).first();
  if (await tab.count()) await tab.click({ timeout: ACTION_TIMEOUT });
  const nameInput = page
    .locator('[data-testid="commerce-name-input"], input[aria-label="Name"], input[placeholder*="name" i]')
    .first();
  await nameInput.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  await nameInput.fill(unique);
  const addRes = page.waitForResponse(
    (res) => res.request().method() === "POST" && res.url().includes("/api/appointments/service-booking"),
    { timeout: ACTION_TIMEOUT },
  );
  await page.getByRole("button", { name: /^Add$/i }).click({ timeout: ACTION_TIMEOUT });
  const response = await addRes.catch(() => null);
  if (response && !response.ok()) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Commerce create API failed — ${err.error || response.status()}`);
  }
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  if (!body.includes(unique)) {
    throw new Error(`Commerce create failed — "${unique}" not listed`);
  }
}

export async function commerceTabReadOnly(page: Page, route: string, tabLabel: RegExp, expectPattern: RegExp) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, route);
  const tab = page.getByRole("button", { name: tabLabel }).first();
  if (await tab.count()) await tab.click({ timeout: ACTION_TIMEOUT });
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  if (!expectPattern.test(body)) {
    throw new Error(`Commerce tab ${tabLabel} missing expected content`);
  }
}

export async function shareEmbedHubUserAction(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, APPT_CANONICAL.share);
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  if (!/Share booking|Public booking link|QR code|Embed/i.test(body)) {
    throw new Error("Share & embed hub missing expected sections");
  }
  const copyBtn = page.getByRole("button", { name: /copy link/i }).first();
  if (await copyBtn.count()) await copyBtn.click({ timeout: ACTION_TIMEOUT });
  const qrImg = page.locator('img[alt*="QR" i]').first();
  await qrImg.waitFor({ state: "visible", timeout: ACTION_TIMEOUT }).catch(() => {
    throw new Error("QR code image did not render");
  });
}

export async function segmentsPageUserAction(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, APPT_CANONICAL.segments);
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  if (!/segment|appointment/i.test(body)) {
    throw new Error("Segments page did not load");
  }
}

export async function publicSurfaceLoads(page: Page, path: string, expectPattern: RegExp) {
  const v = await visitRoute(page, path, { allow404: true });
  if (!v.ok && v.note?.includes("404")) {
    throw new Error(`Public route 404: ${path}`);
  }
  await page.waitForTimeout(1200);
  const body = await page.locator("body").innerText();
  if (!expectPattern.test(body)) {
    throw new Error(`Public page ${path} missing expected content`);
  }
}

export async function publicSurfacesWithSlug(page: Page) {
  await ensureAppointmentsShell(page);
  await ensureCertWorkspaceReadyViaApi(page).catch(() => {});
  const slug = (await fetchWorkspaceSlug(page)) || "appt-mctb-browser-cert";
  await publicSurfaceLoads(page, `/book/${slug}`, /book|service|appointment|unavailable/i);
  await publicSurfaceLoads(page, `/book/${slug}/classes`, /class|enroll|book|unavailable/i);
  await publicSurfaceLoads(page, `/book/${slug}/store`, /store|product|catalog|unavailable/i);
  await publicSurfaceLoads(page, `/embed/book/${slug}`, /book|service|embed|unavailable/i);
}

export async function invalidPublicTokenSurfaces(page: Page) {
  await publicSurfaceLoads(
    page,
    "/manage/invalid-uat-token-xyz",
    /invalid|not found|unavailable|expired|error/i,
  );
  await publicSurfaceLoads(
    page,
    "/portal/invalid-uat-token-xyz",
    /invalid|not found|unavailable|expired|error/i,
  );
}

export async function remindersPreviewUserAction(page: Page) {
  await ensureAppointmentsShell(page);
  await visitRoute(page, "/appointments/reminders");
  await page.waitForTimeout(1000);
  const previewBtn = page.getByRole("button", { name: /preview|test/i }).first();
  if (await previewBtn.count()) {
    await previewBtn.click({ timeout: ACTION_TIMEOUT });
    await page.waitForTimeout(800);
  }
  const body = await page.locator("body").innerText();
  if (!/reminder|template|confirmation|24/i.test(body)) {
    throw new Error("Reminders settings page missing expected content");
  }
}
