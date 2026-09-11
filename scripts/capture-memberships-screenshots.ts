/**
 * Memberships page screenshots.
 * Usage: DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npx tsx scripts/capture-memberships-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

const BASE = process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000";
const OUT = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
const AUTH_EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || "appt-mctb-browser@transovo.test";
const MEMBERSHIP_API = "/api/appointments/service-booking/memberships";
const TYPES_API = "/api/appointments/types";

async function dismissOverlays(page: Page) {
  const gotIt = page.getByRole("button", { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) {
    await gotIt.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
}

async function authenticate(page: Page) {
  const bypass = `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent("/appointments/memberships")}`;
  const res = await page.goto(bypass, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (res && res.status() >= 400) throw new Error(`dev-bypass failed HTTP ${res.status()}`);
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
}

async function readApiData<T>(page: Page, url: string): Promise<T> {
  const res = await page.request.get(`${BASE}${url}`);
  const json = (await res.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!res.ok()) throw new Error(json.error || `GET ${url} failed HTTP ${res.status()}`);
  return json.data as T;
}

async function ensureMembershipId(page: Page): Promise<string> {
  const list = await readApiData<Array<{ id: string }>>(page, MEMBERSHIP_API);
  if (list.length > 0) return list[0].id;

  const types = await readApiData<
    Array<{ id: string; config?: { bookingKind?: string } | null }>
  >(page, TYPES_API);
  const service = types.find((row) => row.config?.bookingKind !== "MEETING") ?? types[0];
  const benefits = service ? { memberOnlyTypeIds: [service.id] } : {};

  const res = await page.request.post(`${BASE}${MEMBERSHIP_API}`, {
    data: {
      name: "Unlimited Yoga",
      description: "Monthly access to eligible bookings",
      priceCents: 7900,
      billingInterval: "month",
      benefits,
      active: true,
      metadata: { purchaseAvailability: "public", cancelPolicy: "end_of_period" },
    },
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { id: string }; error?: string };
  if (!res.ok()) throw new Error(json.error || `Create membership failed HTTP ${res.status()}`);
  if (!json.data?.id) throw new Error("Create membership returned no id");
  return json.data.id;
}

async function waitForEditor(page: Page) {
  await page.waitForSelector(".ws-section-tabs", { timeout: 60000 });
  await page.waitForFunction(() => !document.body.textContent?.includes("Membership not found"), undefined, {
    timeout: 60000,
  });
  await page.waitForTimeout(1200);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await authenticate(page);
    const membershipId = await ensureMembershipId(page);

    await page.goto(`${BASE}/appointments/memberships`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForSelector("h1", { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, "memberships-catalog-populated.png") });
    console.log("saved memberships-catalog-populated.png");

    const editorSections = [
      { section: "overview", file: "memberships-editor-overview.png" },
      { section: "access", file: "memberships-editor-access.png" },
      { section: "pricing", file: "memberships-editor-pricing.png" },
      { section: "members", file: "memberships-editor-members.png" },
      { section: "lifecycle", file: "memberships-editor-lifecycle.png" },
      { section: "activity", file: "memberships-editor-activity.png" },
    ] as const;

    for (const { section, file } of editorSections) {
      const query = section === "overview" ? "" : `?section=${section}`;
      await page.goto(`${BASE}/appointments/memberships/${membershipId}${query}`, {
        waitUntil: "networkidle",
        timeout: 120000,
      });
      await waitForEditor(page);
      await page.screenshot({ path: join(OUT, file) });
      console.log(`saved ${file}`);
    }

    await page.goto(`${BASE}/appointments/memberships/new`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 60000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(OUT, "memberships-wizard-basics.png") });
    console.log("saved memberships-wizard-basics.png");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
