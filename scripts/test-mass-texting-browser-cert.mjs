/**
 * Authenticated Mass Texting browser certification.
 * Uses smoke-login (no Transovo.ai password) then walks customer surfaces.
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:3000 node scripts/test-mass-texting-browser-cert.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const EMAIL = (process.env.CERT_BROWSER_EMAIL || "mt-cert-browser@transovo.test").toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts";
const FIXTURE_PATH = "/tmp/mt-browser-cert.json";
const REPORT_PATH = path.join(OUT_DIR, "mass_texting_browser_cert.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  ok: false,
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  failures: [],
};

function log(step, detail = {}) {
  const row = { step, at: new Date().toISOString(), ...detail };
  report.steps.push(row);
  console.log(`→ ${step}`, detail.message || detail.url || JSON.stringify(detail));
}

function fail(step, message) {
  report.failures.push({ step, message });
  log(step, { ok: false, message });
}

async function shot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

function cardValue(text, label) {
  const re = new RegExp(`${label}\\s+([\\d,]+%?|[A-Z_]+|\\+1[^\\n]+|Not assigned)`, "i");
  const match = text.match(re);
  return match ? match[1].replace(/,/g, "") : null;
}

async function smokeLogin(page) {
  const loginUrl = `${BASE}/__cert_login?token=${encodeURIComponent(BOOTSTRAP)}&email=${encodeURIComponent(EMAIL)}&next=/sms`;
  const open = await page.goto(loginUrl, { waitUntil: "networkidle" });
  log("cert-login", { status: open?.status(), url: page.url() });
  if (page.url().includes("/login")) {
    const res = await page.request.post(`${BASE.replace(/:3001$/, ":3000")}/api/auth/smoke-login`, {
      headers: {
        "content-type": "application/json",
        "x-smoke-bootstrap": BOOTSTRAP,
      },
      data: { email: EMAIL },
    });
    const body = await res.json().catch(() => ({}));
    log("smoke-login-fallback", { status: res.status(), workspaceId: body.workspaceId });
    await page.goto(`${BASE}/api/products/open?product=mass_texting&next=/sms`, {
      waitUntil: "networkidle",
    });
  }
}

async function assertContains(page, step, needles) {
  const text = await page.locator("body").innerText();
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(step, `missing "${needle}" on ${page.url()}`);
    }
  }
  return text;
}

async function main() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error("Run seed-mass-texting-browser-cert.ts first");
  }
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await smokeLogin(page);
    if (!page.url().includes("/sms")) {
      fail("overview-url", `expected /sms, got ${page.url()}`);
    }
    await page.waitForTimeout(800);
    const overview = await assertContains(page, "overview", [
      "Mass Texting",
      "Sent this month",
      "Credits remaining",
      "A2P status",
    ]);
    await shot(page, "mt_overview_authenticated");

    const sentMonth = cardValue(overview, "Sent this month");
    const delivered = cardValue(overview, "Delivered");
    const credits = cardValue(overview, "Credits remaining");
    if (sentMonth !== String(fixture.metrics.messagesSentMonth)) {
      fail(
        "overview-sent-month",
        `UI ${sentMonth} vs DB ${fixture.metrics.messagesSentMonth}`,
      );
    }
    if (delivered !== String(fixture.metrics.delivered)) {
      fail("overview-delivered", `UI ${delivered} vs DB ${fixture.metrics.delivered}`);
    }
    if (credits !== String(fixture.metrics.creditsRemaining)) {
      fail("overview-credits", `UI ${credits} vs DB ${fixture.metrics.creditsRemaining}`);
    }
    if (overview.includes("999")) {
      fail("overview-decoy", "MCTB decoy counts leaked into Mass Texting overview");
    }
    if (!overview.includes("Approved") && !overview.toLowerCase().includes("approved")) {
      fail("overview-a2p", "A2P approved chip missing");
    }
    log("overview-counts", { sentMonth, delivered, credits });

    await page.goto(`${BASE}/contacts`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const contactsText = await page.locator("body").innerText();
    await shot(page, "mt_contacts");
    if (!contactsText.includes("Sub1") && !contactsText.toLowerCase().includes("contact")) {
      fail("contacts", "contacts page did not render expected names");
    }

    await page.goto(`${BASE}/contacts/lists`, { waitUntil: "networkidle" });
    await assertContains(page, "lists", ["August Promo", "Overlap List"]);
    await shot(page, "mt_lists");

    await page.goto(`${BASE}/contacts/imports`, { waitUntil: "networkidle" });
    const importText = await assertContains(page, "import", [
      "I confirm that the recipients in this list have provided the required consent",
    ]);
    if (/MMS|attach image|media file/i.test(importText) === false) {
      log("import-no-mms-control", { ok: true });
    }
    await shot(page, "mt_import_attestation");

    await page.goto(`${BASE}/templates`, { waitUntil: "networkidle" });
    await assertContains(page, "templates", ["Labor Day Promo"]);
    await shot(page, "mt_templates");

    await page.goto(`${BASE}/campaigns`, { waitUntil: "networkidle" });
    const campaignsText = await page.locator("body").innerText();
    if (/Recurring/i.test(campaignsText) && /href="\/campaigns\/recurring"/.test(await page.content())) {
      fail("campaign-tabs", "Recurring tab is visible on Mass Texting campaigns");
    }
    await shot(page, "mt_campaigns");

    await page.goto(`${BASE}/campaigns/new/promotion`, { waitUntil: "networkidle" });
    const composer = await assertContains(page, "composer", ["August Promo", "SMS segment"]);
    if (/MMS|attach image|Add media/i.test(composer)) {
      fail("composer-mms", "MMS controls visible on Mass Texting composer");
    }
    await shot(page, "mt_composer");

    await page.goto(`${BASE}/campaigns/${fixture.campaigns.draftId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const draftText = await page.locator("body").innerText();
    await shot(page, "mt_pre_send_review");
    const expectedRaw = String(fixture.draftReview?.rawContactCount ?? "");
    const expectedFinal = String(fixture.draftReview?.finalRecipientCount ?? "");
    if (expectedRaw && !draftText.includes(expectedRaw)) {
      fail("draft-raw-count", `preflight missing raw count ${expectedRaw}`);
    }
    if (expectedFinal && !draftText.includes(expectedFinal)) {
      fail("draft-final-count", `preflight missing final count ${expectedFinal}`);
    }
    if ((fixture.draftReview?.duplicateRemoved || 0) >= 1) {
      const dup = String(fixture.draftReview.duplicateRemoved);
      if (!draftText.includes(dup)) {
        fail("draft-dupes", `preflight missing duplicateRemoved ${dup}`);
      }
    }
    log("draft-review", {
      raw: fixture.draftReview?.rawContactCount,
      final: fixture.draftReview?.finalRecipientCount,
      dupes: fixture.draftReview?.duplicateRemoved,
    });

    await page.goto(`${BASE}/campaigns/${fixture.campaigns.shortageId}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1200);
    const shortageText = await page.locator("body").innerText();
    await shot(page, "mt_credit_shortage");
    if (fixture.shortageReview && fixture.shortageReview.canSend !== false) {
      fail("shortage-cansend", "expected shortage campaign canSend=false");
    }
    if (
      shortageText.toLowerCase().includes("not enough") ||
      shortageText.toLowerCase().includes("shortage") ||
      shortageText.toLowerCase().includes("credits") ||
      shortageText.toLowerCase().includes("insufficient")
    ) {
      log("shortage-copy", { ok: true });
    } else if (fixture.shortageReview?.blockReason && shortageText.includes(fixture.shortageReview.blockReason)) {
      log("shortage-block-reason", { ok: true, reason: fixture.shortageReview.blockReason });
    } else {
      fail("shortage-ui", "credit shortage campaign did not show a blocking reason");
    }

    await page.goto(`${BASE}/inbox?product=mass_text`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const mtInbox = await page.locator("body").innerText();
    await shot(page, "mt_inbox_mass_text_filter");
    if (!mtInbox.includes("Is the sale still on?") && !mtInbox.includes("Sub1")) {
      fail("inbox-mass-text", "mass text conversation missing from filtered inbox");
    }
    if (mtInbox.includes("Missed your call, thanks for the text back")) {
      fail("inbox-mass-text-leak", "MCTB conversation leaked into mass_text filter");
    }

    await page.goto(`${BASE}/inbox?product=mctb`, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    const mctbInbox = await page.locator("body").innerText();
    await shot(page, "mt_inbox_mctb_filter");
    if (mctbInbox.includes("Is the sale still on?")) {
      fail("inbox-mctb-leak", "mass text conversation leaked into mctb filter");
    }

    await page.goto(`${BASE}/sms/analytics`, { waitUntil: "networkidle" });
    const analytics = await page.locator("body").innerText();
    await shot(page, "mt_analytics");
    const analyticsSent = cardValue(analytics, "Sent this month");
    if (analyticsSent !== String(fixture.metrics.messagesSentMonth)) {
      fail(
        "analytics-sent",
        `UI ${analyticsSent} vs DB ${fixture.metrics.messagesSentMonth}`,
      );
    }
    if (analytics.includes("999")) {
      fail("analytics-decoy", "MCTB decoy counts leaked into analytics");
    }

    await page.goto(`${BASE}/sms/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const billing = await assertContains(page, "billing", ["TRIAL_ACTIVE"]);
    await shot(page, "mt_settings_billing");
    if (!billing.includes(String(fixture.metrics.creditsRemaining)) && !billing.includes("Trial segments remaining")) {
      fail("billing-trial", "trial credits not shown on settings");
    }

    await page.goto(`${BASE}/campaigns/recurring`, { waitUntil: "networkidle" });
    await assertContains(page, "recurring-hidden", ["Not available for Mass Texting V1"]);
    await shot(page, "mt_recurring_hidden");

    await page.goto(`${BASE}/sms/compliance`, { waitUntil: "networkidle" });
    await shot(page, "mt_compliance");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/sms`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await shot(page, "mt_overview_mobile");
    await page.goto(`${BASE}/campaigns/new/promotion`, { waitUntil: "networkidle" });
    await shot(page, "mt_composer_mobile");

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    log("logged-in-login-redirect", { url: page.url() });
  } finally {
    await browser.close();
  }

  report.finishedAt = new Date().toISOString();
  report.ok = report.failures.length === 0;
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, failures: report.failures }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  report.failures.push({ step: "fatal", message: err instanceof Error ? err.message : String(err) });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.error(err);
  process.exit(1);
});
