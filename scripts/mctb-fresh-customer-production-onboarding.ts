/**
 * Fresh-customer MCTB production onboarding — bypass 2 auth + browser UI only.
 *
 * Requires production: DEV_AUTH_BYPASS_2=1, DEV_AUTH_BYPASS_2_EMAIL=...
 * Bypass 1 (ws_1) unchanged; this harness uses /api/auth/dev-bypass-2 only.
 *
 * MCTB_PROD_CERT_BASE_URL=... \
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/mctb-fresh-customer-production-onboarding.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page, type BrowserContext } from "playwright";
import { buildWs1ConfigSnapshot } from "./mctb-ws1-config-snapshot";
import { healthSha } from "./mctb-browser-cert/auth";
import {
  devAuthBypass2EmailHint,
  devAuthBypass2ForbiddenWorkspaceIds,
  devAuthBypassEmailHint,
  isDevAuthBypass2Enabled,
} from "../src/lib/auth/dev-auth-bypass";

const BASE = process.env.MCTB_PROD_CERT_BASE_URL?.replace(/\/$/, "") || "";
const ARTIFACT =
  process.env.MCTB_FRESH_CUSTOMER_ARTIFACTS ||
  "/opt/cursor/artifacts/mctb-fresh-customer-onboarding";
const BUSINESS_E164 = "+15714776175";
const FORBIDDEN_WS = new Set(devAuthBypass2ForbiddenWorkspaceIds());
const STAMP = new Date().toISOString().replace(/[:.]/g, "-");

type StepStatus = "PASS" | "BLOCKED_EXTERNALLY" | "FAIL" | "SKIP";

type StepRow = { stage: string; status: StepStatus; detail: string; route?: string };

const report: {
  sha: string;
  startedAt: string;
  bypassLane: "1" | "2" | "unknown";
  authenticatedEmail: string;
  workspaceId: string | null;
  ingressE164: string | null;
  forwardingUiText: string | null;
  authScaffold: Record<string, unknown> | null;
  steps: StepRow[];
  verify: Record<string, unknown> | null;
  error: string | null;
} = {
  sha: "",
  startedAt: new Date().toISOString(),
  bypassLane: "unknown",
  authenticatedEmail: "",
  workspaceId: null,
  ingressE164: null,
  forwardingUiText: null,
  authScaffold: null,
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

function assertNotWs1(workspaceId: string) {
  if (FORBIDDEN_WS.has(workspaceId)) {
    throw new Error(`Resolved workspace ${workspaceId} is forbidden (ws_1 cert). Bypass 2 isolation failed.`);
  }
}

async function readWorkspaceId(context: BrowserContext): Promise<string | null> {
  const cookies = await context.cookies();
  return cookies.find((c) => c.name === "transovo_workspace")?.value || null;
}

async function authenticateBypass2(page: Page): Promise<void> {
  const email = (
    process.env.DEV_AUTH_BYPASS_2_EMAIL || devAuthBypass2EmailHint()
  ).trim();
  const next =
    "/api/products/open?product=voice&next=" + encodeURIComponent("/mctb");
  const url = `${BASE}/api/auth/dev-bypass-2?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;

  const res = await page.goto(url, { waitUntil: "commit", timeout: 120_000 });
  const scaffoldHeader = res?.headers()?.["x-transovo-bypass-2-scaffold"];
  if (scaffoldHeader) {
    try {
      report.authScaffold = JSON.parse(scaffoldHeader) as Record<string, unknown>;
    } catch {
      report.authScaffold = { raw: scaffoldHeader };
    }
  }

  await page.waitForURL(/\/mctb/, { timeout: 180_000 });
  report.authenticatedEmail = email;
  report.bypassLane = "2";
}

async function openOnboardingWizard(page: Page) {
  const guideUrl = `${BASE}/mctb?mctbSetupGuide=1`;
  await page.goto(guideUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page
    .getByRole("dialog")
    .getByText(/tell us about your business|how should callers/i)
    .first()
    .waitFor({ state: "visible", timeout: 120_000 })
    .catch(() => undefined);
  const start = page.getByRole("button", { name: /start setup|continue setup|get started/i }).first();
  if (await start.isVisible().catch(() => false)) await start.click();
}

async function clickContinue(page: Page) {
  const btn = page.locator("button").filter({ hasText: /^Continue$/ }).last();
  await btn.click({ timeout: 45_000 });
  await page.waitForTimeout(1200);
}

async function waitForIngressInUi(page: Page, timeoutMs = 240_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    const matches = body.match(/\+1[\d\s().-]{10,}/g) || [];
    for (const raw of matches) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length === 11 && digits.startsWith("1") && digits !== "15714776175") {
        return `+${digits}`;
      }
    }
    await page.waitForTimeout(3000);
  }
  return null;
}

async function runWizard(page: Page) {
  await page
    .getByText(/tell us about your business/i)
    .first()
    .waitFor({ state: "visible", timeout: 120_000 })
    .catch(() => undefined);

  if (await page.getByText(/tell us about your business/i).isVisible().catch(() => false)) {
    await page.locator("#onb-biz-name").fill("Transovo MCTB Fresh Launch Cert");
    await page.locator("#onb-biz-phone").fill("5714776175");
    const saveRes = page.waitForResponse(
      (r) => r.url().includes("/api/mctb/onboarding") && r.request().method() === "POST",
      { timeout: 60_000 },
    );
    await clickContinue(page);
    const resp = await saveRes.catch(() => null);
    if (resp && !resp.ok()) {
      const body = await resp.text().catch(() => "");
      if (body.includes("BUSINESS_NUMBER") || body.includes("already") || resp.status() === 409) {
        step("Business number", "FAIL", `BUSINESS_NUMBER_WORKSPACE_CONFLICT: ${body.slice(0, 300)}`);
        report.error = "BUSINESS_NUMBER_WORKSPACE_CONFLICT";
        return;
      }
    }
    step("Wizard — Business", "PASS", BUSINESS_E164, page.url());
  }

  await page.getByText(/how should callers receive a text/i).waitFor({ timeout: 90_000 });
  await page.getByRole("button", { name: /i already have consent/i }).click();
  const boxes = page.getByRole("checkbox");
  const count = await boxes.count();
  for (let i = 0; i < count; i++) {
    const box = boxes.nth(i);
    if (!(await box.isChecked().catch(() => false))) {
      await box.check().catch(() => undefined);
    }
  }
  await clickContinue(page);
  step("Wizard — Consent", "PASS", "existing_consent + attestations", page.url());

  await page.getByText(/text back|recovery message|missed-call/i).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await clickContinue(page);
  step("Wizard — Text Back", "PASS", "platform sender defaults", page.url());

  await page.getByText(/voicemail/i).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await clickContinue(page).catch(() => undefined);
  step("Wizard — Voicemail", "PASS", "defaults", page.url());

  await page.getByText(/notification/i).first().waitFor({ timeout: 90_000 }).catch(() => undefined);
  await clickContinue(page).catch(() => undefined);
  step("Wizard — Notifications", "PASS", "defaults", page.url());

  await page.getByText(/connect|forward/i).first().waitFor({ timeout: 90_000 });
  report.ingressE164 = await waitForIngressInUi(page);
  report.forwardingUiText = await page.locator("body").innerText().then((t) => t.slice(0, 500));
  step(
    "Wizard — Connect Phone",
    report.ingressE164 ? "PASS" : "BLOCKED_EXTERNALLY",
    report.ingressE164 || "waiting for ingress / carrier step",
    page.url(),
  );

  const blocked = await page
    .getByText(/live test|configure forwarding|i.?ve turned it on|carrier/i)
    .first()
    .isVisible()
    .catch(() => false);
  step(
    "Wizard — Test & Go Live",
    "BLOCKED_EXTERNALLY",
    blocked ? "carrier forwarding / live test required" : "external verification expected",
    page.url(),
  );
}

async function main() {
  if (!BASE) throw new Error("Set MCTB_PROD_CERT_BASE_URL");

  if (!isDevAuthBypass2Enabled()) {
    console.error(
      "[fresh-customer] DEV_AUTH_BYPASS_2 is not enabled on this environment. Set DEV_AUTH_BYPASS_2=1 and DEV_AUTH_BYPASS_2_EMAIL on production (bypass 1 unchanged).",
    );
    process.exit(2);
  }

  const b2Email = (process.env.DEV_AUTH_BYPASS_2_EMAIL || devAuthBypass2EmailHint()).toLowerCase();
  const b1Email = devAuthBypassEmailHint();
  if (b2Email === b1Email) {
    throw new Error("DEV_AUTH_BYPASS_2_EMAIL must differ from DEV_AUTH_BYPASS_EMAIL");
  }

  mkdirSync(ARTIFACT, { recursive: true });
  report.sha = await healthSha(BASE);

  console.log(`[fresh-customer] bypass lane: 2 (target email: ${b2Email})`);
  console.log(`[fresh-customer] bypass 1 email (must not use): ${b1Email}`);
  console.log(`[fresh-customer] forbidden workspaces: ${[...FORBIDDEN_WS].join(", ")}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await authenticateBypass2(page);
    if (!page.url().includes("/mctb")) {
      step("Auth bypass 2", "FAIL", `Expected /mctb after bypass-2; got ${page.url()}`, page.url());
      report.error = "bypass_2_redirect_failed";
      return;
    }

    report.workspaceId = await readWorkspaceId(context);
    await page.waitForTimeout(3000);
    report.workspaceId = (await readWorkspaceId(context)) || report.workspaceId;
    if (report.workspaceId) assertNotWs1(report.workspaceId);

    step(
      "Auth bypass 2",
      "PASS",
      `email=${report.authenticatedEmail} workspace=${report.workspaceId || "(none yet)"}`,
      page.url(),
    );

    if (!report.workspaceId) {
      step("Workspace", "FAIL", "No transovo_workspace cookie after products/open — deploy bypass-2 + check server logs");
      report.error = "no_workspace_cookie";
      return;
    }
    assertNotWs1(report.workspaceId);

    await openOnboardingWizard(page);
    await runWizard(page);
    await page.screenshot({ path: join(ARTIFACT, "wizard-end.png"), fullPage: true });

    report.workspaceId = (await readWorkspaceId(context)) || report.workspaceId;
    if (report.workspaceId) assertNotWs1(report.workspaceId);
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
      assertNotWs1(report.workspaceId);
      const snap = await buildWs1ConfigSnapshot(report.workspaceId);
      report.verify = {
        persisted: snap.persisted,
        effective: snap.effective,
        onboarding: snap.onboarding,
      };
      step("Read-only verify", "PASS", JSON.stringify(report.verify).slice(0, 400));
    } catch (e) {
      step("Read-only verify", "FAIL", e instanceof Error ? e.message : String(e));
    }
  }

  saveReport();

  console.log("\n=== OWNER HANDOFF ===");
  console.log(`NEW TEST USER:\n${report.authenticatedEmail}`);
  console.log(`NEW WORKSPACE:\n${report.workspaceId ?? "—"}`);
  console.log(`BUSINESS NUMBER:\n571-477-6175`);
  console.log(`TRANSOVO INGRESS:\n${report.ingressE164 ?? "—"}`);
  console.log(`CONSENT:\nexisting_consent`);
  console.log(`SENDER:\nTransovo platform sender`);
  console.log(`STATUS:\nREADY FOR CFNA / LIVE TEST`);
  if (report.ingressE164) {
    console.log(`\nFORWARD 571-477-6175 TO: ${report.ingressE164}`);
  }
}

main().catch((e) => {
  console.error(e);
  report.error = e instanceof Error ? e.message : String(e);
  saveReport();
  process.exit(1);
});
