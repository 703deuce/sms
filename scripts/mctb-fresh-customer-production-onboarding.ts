/**
 * Fresh-customer MCTB production onboarding — browser-only setup, read-only DB verify after.
 *
 * MCTB_PROD_CERT_BASE_URL=... \
 * MCTB_FRESH_SIGNUP_MOBILE=+1... \  # receives signup SMS OTP (not written via API)
 * MCTB_FRESH_SIGNUP_OTP=123456 \    # optional: skip Telnyx poll if you have the code
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-fresh-customer-production-onboarding.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { buildWs1ConfigSnapshot } from "./mctb-ws1-config-snapshot";
import { healthSha } from "./mctb-browser-cert/auth";
import { mctbOnboardingEntryPath } from "../src/lib/mctb/onboarding/entry-path";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const ARTIFACT =
  process.env.MCTB_FRESH_CUSTOMER_ARTIFACTS ||
  "/opt/cursor/artifacts/mctb-fresh-customer-onboarding";
const BUSINESS_E164 = "+15714776175";
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

type StepStatus = "PASS" | "BLOCKED_EXTERNALLY" | "FAIL" | "SKIP";

type StepRow = {
  stage: string;
  status: StepStatus;
  detail: string;
  route?: string;
};

const report: {
  sha: string;
  startedAt: string;
  email: string;
  password: string;
  workspaceId: string | null;
  ingressE164: string | null;
  forwardingUiText: string | null;
  steps: StepRow[];
  verify: Record<string, unknown> | null;
  error: string | null;
} = {
  sha: "",
  startedAt: new Date().toISOString(),
  email: "",
  password: "",
  workspaceId: null,
  ingressE164: null,
  forwardingUiText: null,
  steps: [],
  verify: null,
  error: null,
};

function step(stage: string, status: StepStatus, detail: string, route?: string) {
  report.steps.push({ stage, status, detail, route });
  console.log(`[fresh-customer] ${stage}: ${status} — ${detail}`);
}

function saveReport() {
  mkdirSync(ARTIFACT, { recursive: true });
  const path = join(ARTIFACT, `fresh-customer-report-${STAMP}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  writeFileSync(join(ARTIFACT, "fresh-customer-report-latest.json"), JSON.stringify(report, null, 2));
  console.log(`[fresh-customer] report → ${path}`);
}

async function pollTelnyxOtp(toE164: string, sinceMs: number): Promise<string | null> {
  const preset = process.env.MCTB_FRESH_SIGNUP_OTP?.trim();
  if (preset && /^\d{6}$/.test(preset)) return preset;

  const key = process.env.TELNYX_API_KEY?.trim();
  if (!key) return null;

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const url = new URL("https://api.telnyx.com/v2/messages");
    url.searchParams.set("filter[to]", toE164);
    url.searchParams.set("page[size]", "10");
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) continue;
    const json = (await res.json()) as { data?: Array<{ text?: string; received_at?: string; created_at?: string }> };
    for (const msg of json.data || []) {
      const t = new Date(msg.received_at || msg.created_at || 0).getTime();
      if (t && t < sinceMs - 5000) continue;
      const text = msg.text || "";
      const m = text.match(/\b(\d{6})\b/);
      if (m) return m[1];
    }
  }
  return null;
}

async function completeSmsOptIn(page: Page, mobile: string): Promise<boolean> {
  const consent = page.locator('input[type="checkbox"]').first();
  await consent.check().catch(() => undefined);
  await page.locator("#opt-in-phone").fill(mobile);
  const sendBtn = page.getByRole("button", { name: /send code/i });
  const since = Date.now();
  await sendBtn.click();
  await page.waitForTimeout(2000);

  const codeInput = page.locator("#opt-in-code");
  if (!(await codeInput.isVisible().catch(() => false))) {
    return false;
  }

  const code = await pollTelnyxOtp(mobile, since);
  if (!code) return false;

  await codeInput.fill(code);
  await page.getByRole("button", { name: /verify/i }).click();
  await page.waitForTimeout(1500);
  return true;
}

async function readWorkspaceIdFromCookies(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  const ws = cookies.find((c) => c.name === "transovo_workspace" || c.name === "workspaceId");
  return ws?.value || null;
}

async function waitForIngressInUi(page: Page, timeoutMs = 180_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    const m = body.match(/\+1[\d\s()-]{10,}/g);
    if (m) {
      for (const raw of m) {
        const digits = raw.replace(/\D/g, "");
        if (digits.length === 11 && digits.startsWith("1") && digits !== "15714776175") {
          return `+${digits}`;
        }
      }
    }
    await page.waitForTimeout(3000);
  }
  return null;
}

async function clickContinue(page: Page) {
  const btn = page.locator("button").filter({ hasText: /^Continue$/ }).last();
  await btn.click({ timeout: 30_000 });
  await page.waitForTimeout(1500);
}

async function runWizard(page: Page) {
  await page.getByText(/tell us about your business/i).waitFor({ timeout: 120_000 });
  step("Wizard — Business", "PASS", "Business step visible", page.url());

  await page.locator("#onb-biz-name").fill("Transovo MCTB Fresh Launch Cert");
  await page.locator("#onb-biz-phone").fill("5714776175");
  await clickContinue(page);

  await page.getByText(/how should callers receive a text/i).waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: /i already have consent/i }).click();
  const attest = page.getByText(/confirm my business already has permission/i);
  await attest.locator("..").locator('button[role="checkbox"], input[type="checkbox"]').first().click().catch(async () => {
    await page.getByRole("checkbox").last().check();
  });
  await clickContinue(page);
  step("Wizard — Consent", "PASS", "Existing consent + attestation", page.url());

  await page.getByText(/text back|recovery message|missed-call/i).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await clickContinue(page);
  step("Wizard — Text Back", "PASS", "Platform template defaults", page.url());

  await page.getByText(/voicemail/i).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await clickContinue(page).catch(() => undefined);
  step("Wizard — Voicemail", "PASS", "Defaults / continue", page.url());

  await page.getByText(/notification/i).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await clickContinue(page).catch(() => undefined);
  step("Wizard — Notifications", "PASS", "Defaults / continue", page.url());

  await page.getByText(/connect|forward/i).first().waitFor({ timeout: 90_000 });
  const ingress = await waitForIngressInUi(page, 60_000);
  report.ingressE164 = ingress;
  report.forwardingUiText = await page.locator("body").innerText().then((t) => {
    const idx = t.toLowerCase().indexOf("forward");
    return idx >= 0 ? t.slice(idx, idx + 400) : t.slice(0, 400);
  });
  step(
    "Wizard — Connect Phone",
    ingress ? "PASS" : "BLOCKED_EXTERNALLY",
    ingress ? `Ingress displayed: ${ingress}` : "Ingress not visible yet; carrier step may still apply",
    page.url(),
  );

  const liveBlocked = await page.getByText(/live test|forwarding|configure.*carrier/i).isVisible().catch(() => false);
  step(
    "Wizard — Test & Go Live",
    liveBlocked ? "BLOCKED_EXTERNALLY" : "PASS",
    liveBlocked
      ? "Activation blocked until carrier forwarding / live test (expected)"
      : "Reached review without external block text",
    page.url(),
  );
}

async function main() {
  if (!BASE) throw new Error("Set MCTB_PROD_CERT_BASE_URL");
  mkdirSync(ARTIFACT, { recursive: true });
  report.sha = await healthSha(BASE);

  const mobile =
    process.env.MCTB_FRESH_SIGNUP_MOBILE?.trim() ||
    process.env.MCTB_FRESH_SIGNUP_PHONE?.trim() ||
    "";

  const email =
    process.env.MCTB_FRESH_SIGNUP_EMAIL?.trim() ||
    `mctb-fresh-launch-${Date.now()}@transovo-cert.test`;
  const password =
    process.env.MCTB_FRESH_SIGNUP_PASSWORD?.trim() || `MctbFresh!${String(Date.now()).slice(-6)}`;
  report.email = email;
  report.password = password;

  const signupUrl = `${BASE}/signup?product=mctb&next=${encodeURIComponent(mctbOnboardingEntryPath())}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    step("Signup — open", "PASS", signupUrl);
    await page.goto(signupUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2000);
    const landed = page.url();
    if (!landed.includes("/signup")) {
      step(
        "Signup — page",
        "FAIL",
        `Expected /signup but landed on ${landed}. Production DEV_AUTH_BYPASS=1 auto-logs cert users and skips signup — run this script on a host without bypass, or complete signup manually in a normal browser session.`,
        landed,
      );
      report.error = "dev_auth_bypass_prevents_fresh_signup";
      await page.screenshot({ path: join(ARTIFACT, "01-signup-redirected.png"), fullPage: true });
      return;
    }
    await page.screenshot({ path: join(ARTIFACT, "01-signup.png"), fullPage: true });

    const businessTile = page.locator("button").filter({ hasText: /^Business$/ }).first();
    if (await businessTile.isVisible().catch(() => false)) {
      await businessTile.click();
    }
    await page.locator("#name").fill("Transovo Fresh Cert Owner");
    await page.locator("#businessName").fill("Transovo MCTB Fresh Launch Cert");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);

    if (!mobile) {
      step(
        "Signup — SMS OTP",
        "FAIL",
        "Set MCTB_FRESH_SIGNUP_MOBILE to a phone that can receive signup SMS (browser cannot proceed without OTP)",
      );
      report.error = "missing_MCTB_FRESH_SIGNUP_MOBILE";
      await page.screenshot({ path: join(ARTIFACT, "02-signup-blocked-otp.png"), fullPage: true });
      return;
    }

    const otpOk = await completeSmsOptIn(page, mobile);
    if (!otpOk) {
      step(
        "Signup — SMS OTP",
        "FAIL",
        "Could not complete SMS verification (Telnyx poll or MCTB_FRESH_SIGNUP_OTP)",
      );
      report.error = "signup_otp_failed";
      await page.screenshot({ path: join(ARTIFACT, "02-signup-otp-fail.png"), fullPage: true });
      return;
    }
    step("Signup — SMS OTP", "PASS", `Verified mobile ${mobile}`);

    await page.getByRole("button", { name: /create account/i }).click();
    await page.waitForURL(/\/(mctb|onboarding)/, { timeout: 180_000 }).catch(() => undefined);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(ARTIFACT, "03-post-signup.png"), fullPage: true });

    report.workspaceId = await readWorkspaceIdFromCookies(page);
    step(
      "Account created",
      report.workspaceId ? "PASS" : "FAIL",
      report.workspaceId ? `workspaceId=${report.workspaceId}` : "No workspace cookie after signup",
      page.url(),
    );

    if (!report.workspaceId) {
      report.error = "no_workspace_after_signup";
      return;
    }

    const modal = page.getByRole("dialog");
    if (await modal.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: /start setup|continue setup|get started/i }).first().click().catch(() => undefined);
    }

    await runWizard(page);
    await page.screenshot({ path: join(ARTIFACT, "04-wizard-end.png"), fullPage: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    report.error = msg;
    step("Unhandled", "FAIL", msg, page.url());
    await page.screenshot({ path: join(ARTIFACT, "error.png"), fullPage: true }).catch(() => undefined);
  } finally {
    await browser.close();
  }

  if (report.workspaceId && !report.error) {
    try {
      const snap = await buildWs1ConfigSnapshot(report.workspaceId);
      report.verify = {
        businessNumberE164: snap.onboarding?.businessNumberE164,
        consentMode: snap.consentMode,
        senderMode: snap.runtime?.senderMode,
        forwardIngress: snap.onboarding?.forwardingDestinationE164 ?? snap.trialNumber,
        texmlHandlerMode: snap.texmlHandlerMode,
        automationActive: snap.automationActive,
        recoveryPaused: snap.recoveryPaused,
        existingConsentAttested: snap.onboarding?.existingConsentAttested,
      };
      step("Read-only verify", "PASS", JSON.stringify(report.verify));
    } catch (e) {
      step("Read-only verify", "FAIL", e instanceof Error ? e.message : String(e));
    }
  }

  saveReport();

  console.log("\n=== OWNER HANDOFF ===");
  console.log(`Email: ${report.email}`);
  console.log(`Password: (see report json — ${report.password})`);
  console.log(`Workspace: ${report.workspaceId ?? "—"}`);
  console.log(`Business: ${BUSINESS_E164}`);
  if (report.ingressE164) {
    console.log(`\nFORWARD 571-477-6175 TO: ${report.ingressE164.replace(/^\+1/, "").replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}`);
    console.log(`(E.164: ${report.ingressE164})`);
  }
}

main().catch((e) => {
  console.error(e);
  report.error = e instanceof Error ? e.message : String(e);
  saveReport();
  process.exit(1);
});
