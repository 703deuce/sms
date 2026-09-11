import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

/**
 * Regression cover for the Meetings workspace (`/appointments/meetings`).
 *
 * The suite drives a meeting that already exists in the workspace and restores
 * its stored config afterwards, so it can be re-run without leaving rows behind.
 * It needs an authenticated session; run the app with DEV_AUTH_BYPASS=1 against a
 * workspace that has at least one meeting, then:
 *
 *   PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://localhost:3000 \
 *     npx playwright test tests/e2e/appointments-meetings.spec.ts
 */

type ApiType = {
  id: string;
  name: string;
  durationMinutes?: number;
  config?: Record<string, unknown>;
};

let meetingId = "";
let snapshot: { name: string; config: Record<string, unknown> } | null = null;

async function listTypes(request: APIRequestContext): Promise<ApiType[] | null> {
  const res = await request.get("/api/appointments/types");
  if (!res.ok()) return null;
  const json = (await res.json()) as { data?: ApiType[] };
  return json.data || [];
}

/** Waits for the workspace shell rather than networkidle, which never settles here. */
async function open(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".ws-object-header, .ws-empty-state, .ws-wizard-steps", {
    timeout: 40_000,
  });
  await page.waitForTimeout(800);
}

async function save(page: Page) {
  await page.getByRole("button", { name: /^(Save changes|Retry save)$/ }).click();
  await expect(page.getByRole("status")).toContainText("Saved", { timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Appointments — Meetings workspace", () => {
  test.beforeAll(async ({ request }) => {
    const types = await listTypes(request);
    test.skip(types === null, "No authenticated session — run with DEV_AUTH_BYPASS=1");
    const meeting = (types || []).find(
      (t) => (t.config as { bookingTypeKind?: string } | undefined)?.bookingTypeKind === "MEETING",
    );
    test.skip(!meeting, "Workspace has no meeting to exercise");
    meetingId = meeting!.id;
    snapshot = { name: meeting!.name, config: { ...(meeting!.config || {}) } };
  });

  test.afterAll(async ({ request }) => {
    if (!meetingId || !snapshot) return;
    await request.patch(`/api/appointments/types/${meetingId}`, {
      data: { name: snapshot.name, config: snapshot.config },
    });
  });

  test("Booking Types is gone from the Booking nav", async ({ page }) => {
    await open(page, "/appointments/meetings");
    const nav = (await page.locator("nav").allInnerTexts()).join("\n");
    expect(nav).not.toMatch(/Booking Types/i);
    expect(nav).toMatch(/Meetings/);
  });

  test("desktop shows one section nav, and the section lives in the URL", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await open(page, `/appointments/meetings/${meetingId}`);

    // Both presentations live in the DOM; only one is ever visible.
    await expect(page.locator("nav.ws-local-nav")).toBeVisible();
    await expect(page.locator("#meeting-section-select")).toBeHidden();

    await page.locator("nav.ws-local-nav").getByRole("button", { name: "Questions" }).click();
    await expect(page).toHaveURL(/section=questions/);

    await open(page, `/appointments/meetings/${meetingId}?section=booking-rules`);
    await expect(page.locator(".ws-section-scroll")).toContainText("Booking rules");
  });

  test("mobile shows the dropdown instead, with no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, `/appointments/meetings/${meetingId}`);

    await expect(page.locator("nav.ws-local-nav")).toBeHidden();
    await expect(page.locator("#meeting-section-select")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    const columns = await page.locator(".ws-kpi-strip").evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(2);
  });

  test("meeting method persists and the card reports its real state", async ({ page, request }) => {
    const joinUrl = `https://us02web.zoom.us/j/${Date.now().toString().slice(-9)}`;
    await open(page, `/appointments/meetings/${meetingId}?section=hosts-method`);

    await page.getByRole("button", { name: /^Zoom/ }).click();
    await page.locator("#method-link").fill(joinUrl);
    await save(page);

    await open(page, `/appointments/meetings/${meetingId}?section=hosts-method`);
    await expect(page.locator("#method-link")).toHaveValue(joinUrl);
    await expect(page.locator('.ws-choice-card[aria-pressed="true"]').last()).toContainText(
      "Link set",
    );

    const types = await listTypes(request);
    const row = (types || []).find((t) => t.id === meetingId);
    expect((row?.config as { meetingLink?: string })?.meetingLink).toBe(joinUrl);
  });

  test("setup health reaches 5/5 once the method is configured", async ({ page }) => {
    await open(page, `/appointments/meetings/${meetingId}`);
    await expect(page.locator(".ws-side-card").filter({ hasText: "Setup" })).toContainText("5/5");
  });

  test("questions can be added, reordered and deleted", async ({ page }) => {
    const label = `What should we cover ${Date.now().toString().slice(-6)}?`;
    await open(page, `/appointments/meetings/${meetingId}?section=questions`);
    const before = await page.locator(".ws-question-row").count();

    await page.locator(".ws-section-scroll").getByRole("button", { name: "Add question" }).first().click();
    await expect(page.locator(".ws-modal")).toBeVisible();
    await page.locator("#q-label").fill(label);
    await page.locator("#q-type").selectOption("textarea");
    await page.getByRole("dialog").getByRole("button", { name: "Add question" }).click();
    await expect(page.locator(".ws-question-row")).toHaveCount(before + 1);

    await save(page);
    await open(page, `/appointments/meetings/${meetingId}?section=questions`);
    await expect(page.locator(".ws-question-row", { hasText: label })).toHaveCount(1);

    if (before > 0) {
      const order = await page.locator(".ws-question-label").allInnerTexts();
      await page.locator(".ws-question-row").last().getByRole("button", { name: /Move .* up/ }).click();
      await expect
        .poll(() => page.locator(".ws-question-label").allInnerTexts())
        .not.toEqual(order);
    }

    await page.locator(".ws-question-row", { hasText: label }).getByRole("button", { name: /^Delete/ }).click();
    await save(page);
    await open(page, `/appointments/meetings/${meetingId}?section=questions`);
    await expect(page.locator(".ws-question-row", { hasText: label })).toHaveCount(0);
  });

  test("the question modal is a dialog that traps focus and closes on Escape", async ({ page }) => {
    await open(page, `/appointments/meetings/${meetingId}?section=questions`);
    await page.locator(".ws-section-scroll").getByRole("button", { name: "Add question" }).first().click();

    const modal = page.locator('.ws-modal[aria-modal="true"]');
    await expect(modal).toBeVisible();
    expect(
      await page.evaluate(() => !!document.querySelector(".ws-modal")?.contains(document.activeElement)),
    ).toBe(true);

    await page.keyboard.press("Escape");
    await expect(modal).toHaveCount(0);
  });

  test("booking rules expand in place and the cancellation cutoff persists", async ({ page, request }) => {
    await open(page, `/appointments/meetings/${meetingId}?section=booking-rules`);
    await page.locator(".ws-section-scroll").getByRole("button", { name: /Cancellation & rescheduling/ }).click();
    await page.locator("#rule-cancel").selectOption("until_hours_before");

    const current = await page.locator("#rule-cancel-hours").inputValue();
    const cutoff = Number(current) === 6 ? "7" : "6";
    await page.locator("#rule-cancel-hours").fill(cutoff);
    await save(page);

    await open(page, `/appointments/meetings/${meetingId}?section=booking-rules`);
    await expect(page.locator(".ws-section-scroll")).toContainText(`until ${cutoff}h before`);

    const types = await listTypes(request);
    const row = (types || []).find((t) => t.id === meetingId);
    expect((row?.config as { cancellationPolicy?: { cutoffHours?: number } })?.cancellationPolicy?.cutoffHours).toBe(
      Number(cutoff),
    );
  });

  test("advanced modules expand in place without duplicating their forms", async ({ page }) => {
    await open(page, `/appointments/meetings/${meetingId}?section=advanced`);
    await expect(page.locator("#adv-pay-mode")).toHaveCount(0);

    await page.locator(".ws-section-scroll").getByRole("button", { name: /^Payment/ }).first().click();
    await expect(page.locator("#adv-pay-mode")).toHaveCount(1);
  });

  test("a host can be added without leaving the meeting", async ({ page }) => {
    const hostName = `Test Host ${Date.now().toString().slice(-6)}`;
    await open(page, `/appointments/meetings/${meetingId}?section=hosts-method`);
    await page.getByRole("button", { name: /^Specific hosts/ }).click();

    await page.getByRole("button", { name: /^Add host$/ }).click();
    await page.locator("#hosts-add").fill(hostName);
    await page.getByRole("button", { name: /^Add$/ }).click();

    await expect(page).toHaveURL(/section=hosts-method/);
    const chip = page.locator(".ws-host-chip", { hasText: hostName });
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    // Leave workspace settings as they were found.
    await page.evaluate(async (name) => {
      const res = await fetch("/api/appointments/settings");
      const json = await res.json();
      const staff = (json.data?.staff || []).filter((s: { name: string }) => s.name !== name);
      await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff }),
      });
    }, hostName);
  });

  test("the create wizard validates each step and never dead-ends on hosts", async ({ page }) => {
    await open(page, "/appointments/meetings/new");
    await expect(page.locator("body")).not.toContainText("Add a host in Staff first");

    await page.getByRole("button", { name: /^Continue$/ }).click();
    await expect(page.locator(".ws-inline-error")).toBeVisible();

    await page.locator("#wiz-name").fill("Playwright Strategy Session");
    await page.locator("#wiz-duration").fill("45");
    await expect(page.locator(".ws-wizard-summary")).toContainText("45 min");

    await page.getByRole("button", { name: /^Continue$/ }).click();
    await page.getByRole("button", { name: /^Zoom/ }).click();
    await page.getByRole("button", { name: /^Continue$/ }).click();
    await expect(page.locator(".ws-inline-error")).toBeVisible();
  });

  test("the wizard offers an inline add when the workspace has no hosts", async ({ page }) => {
    await page.route("**/api/appointments/settings", async (route) => {
      const res = await route.fetch();
      const json = await res.json();
      if (json.data) json.data.staff = [];
      await route.fulfill({ response: res, body: JSON.stringify(json) });
    });

    await open(page, "/appointments/meetings/new");
    await page.locator("#wiz-name").fill("Playwright Strategy Session");
    await page.getByRole("button", { name: /^Continue$/ }).click();

    await expect(page.locator(".ws-nudge")).toContainText("No bookable hosts yet");
    await expect(page.locator("#hosts-add, #wiz-host-add")).toBeVisible();
  });

  test("the public booking page renders the meeting", async ({ page, request }) => {
    const res = await request.get("/api/appointments/settings");
    const slug = ((await res.json()) as { workspace?: { slug?: string } }).workspace?.slug;
    test.skip(!slug, "Workspace has no public slug");

    await page.goto(`/book/${slug}/${meetingId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".booking-shell", { timeout: 40_000 });
    await expect(page.locator(".booking-shell")).toContainText("Zoom");
  });
});
