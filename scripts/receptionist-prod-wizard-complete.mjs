/**
 * Complete isolated-agent readiness + optional activate on production.
 * Documents DOM → state → API → reload for business name + phone.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "https://transovo.ai";
const AGENT = process.env.RECEPTIONIST_E2E_AGENT_ID || "cmu42zyel1c4x01090c6s335z";
const CERT = "cmshz2lc25c622c4i58303501";
const PHONE_LAST4 = process.env.RECEPTIONIST_TEST_PHONE_LAST4 || "6264";
const ALLOW_ACTIVATE = process.env.RECEPTIONIST_E2E_ALLOW_PUBLISH === "1";
const OUT = "/opt/cursor/artifacts/receptionist-prod-wizard-complete.json";
const SCREEN = "/opt/cursor/artifacts/receptionist-prod-e2e-screens";

const BIZ = `Summit Electric E2E ${Date.now().toString(36).slice(-4)}`;

async function loginWs1(ctx) {
  await ctx.request.get("/api/auth/dev-bypass?next=/voice/receptionist/edit", { maxRedirects: 0 });
  const sw = await ctx.request.post("/api/workspace", { data: { workspaceId: "ws_1" } });
  if (!sw.ok()) throw new Error(`workspace switch ${sw.status()}`);
}

async function saveDraft(page, step) {
  const btn = page
    .getByRole("button", { name: /save draft/i })
    .or(page.getByRole("button", { name: /save & continue/i }))
    .first();
  await btn.click();
  await page.waitForTimeout(6000);
}

async function loadAgent(ctx) {
  const res = await ctx.request.get(`/api/voice/agents/${AGENT}`);
  return res.json();
}

async function main() {
  if (AGENT === CERT) throw new Error("refusing cert agent");
  mkdirSync(SCREEN, { recursive: true });
  const report = {
    agent: AGENT,
    businessNameTest: BIZ,
    phoneLast4: PHONE_LAST4,
    steps: {},
    apiPosts: [],
    uiChanges: [],
    activate: null,
  };

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  await loginWs1(ctx);
  const page = await ctx.newPage();

  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[RECEPTIONIST]")) report.uiChanges.push(t);
  });
  page.on("response", async (res) => {
    if (!res.url().includes("appointment-receptionist") || res.request().method() !== "POST") return;
    const body = await res.json().catch(() => null);
    report.apiPosts.push({
      stepHint: report._currentStep,
      status: res.status(),
      action: body?.data?.state ? res.request().postDataJSON?.()?.action : body?.data?.action,
      traceId: body?.data?.receptionistTraceId,
      businessName: body?.data?.state?.businessName,
      phoneNumberId: body?.data?.state?.phoneNumberId,
      published: body?.data?.published,
      liveSyncPending: body?.data?.liveSyncPending,
      configRevision: body?.data?.configRevision,
      error: body?.error,
      postAction: (() => {
        try {
          return res.request().postDataJSON()?.action;
        } catch {
          return null;
        }
      })(),
    });
  });

  const beforeAgent = await loadAgent(ctx);
  report.before = {
    businessName: beforeAgent?.data?.draftConfig?.advanced?.appointmentReceptionistWizard?.businessName,
    phoneNumberId: beforeAgent?.data?.phoneNumberId,
    publishedVersionId: beforeAgent?.data?.publishedVersionId,
  };

  // Goals — disable transfer_calls to simplify activation
  report._currentStep = "goals";
  await page.goto(`/voice/receptionist/edit?step=goals&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(2500);
  const transferSwitch = page
    .getByRole("switch", { name: /transfer/i })
    .or(page.getByRole("button", { name: /transfer calls/i }))
    .first();
  if (await transferSwitch.isVisible().catch(() => false)) {
    const role = await transferSwitch.getAttribute("role");
    if (role === "switch" && (await transferSwitch.isChecked())) {
      await transferSwitch.click();
    } else if (role !== "switch") {
      await transferSwitch.click();
    }
    await page.waitForTimeout(400);
  }
  await saveDraft(page, "goals");
  report.steps.goals = { transferToggled: true };

  // Information — guided profile + business name
  report._currentStep = "information";
  await page.goto(`/voice/receptionist/edit?step=information&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /guided business profile/i }).first().click();
  await page.waitForTimeout(500);
  const bizInput = page.locator('input[placeholder="Acme Dental"]');
  await bizInput.fill(BIZ);
  await page.waitForTimeout(800);
  const hours = page.locator("textarea").filter({ hasText: /^$/ }).first();
  if (await hours.isVisible().catch(() => false)) {
    await hours.fill("Mon–Fri 9am–5pm");
  }
  await saveDraft(page, "information");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const reloadedBiz =
    (await page.locator('input[placeholder="Acme Dental"]').inputValue().catch(() => "")) || "";
  report.steps.information = {
    filled: BIZ,
    reloadedInput: reloadedBiz,
    reloadMatch: reloadedBiz.includes(BIZ.slice(0, 12)),
  };
  await page.screenshot({ path: path.join(SCREEN, "complete-information.png"), fullPage: true });

  // Phone
  report._currentStep = "phone";
  await page.goto(`/voice/receptionist/edit?step=phone&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /use existing transovo number/i }).click();
  await page.waitForTimeout(500);
  const phoneBtn = page.getByRole("button", { name: new RegExp(PHONE_LAST4) }).first();
  await phoneBtn.click();
  await page.waitForTimeout(500);
  await saveDraft(page, "phone");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const phoneSelected = await page
    .getByRole("button", { name: new RegExp(PHONE_LAST4) })
    .first()
    .getAttribute("class");
  report.steps.phone = {
    phoneBtnSelected: phoneSelected?.includes("primary") || phoneSelected?.includes("bg-primary"),
  };
  await page.screenshot({ path: path.join(SCREEN, "complete-phone.png"), fullPage: true });

  // Appointments — save as-is
  report._currentStep = "appointments";
  await page.goto(`/voice/receptionist/edit?step=appointments&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(2000);
  await saveDraft(page, "appointments");

  report._currentStep = "call-handling";
  await page.goto(`/voice/receptionist/edit?step=call-handling&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(2500);
  const addContact = page.getByRole("button", { name: /add contact/i }).first();
  if (await addContact.isVisible().catch(() => false)) {
    await addContact.click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder("Display name").first().fill("E2E On-call");
    await page.getByPlaceholder("+1 (555) 000-0000").first().fill("+15715550198");
    await page.waitForTimeout(400);
  }
  await saveDraft(page, "call-handling");

  report._currentStep = "voice";
  await page.goto(`/voice/receptionist/edit?step=voice&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(2000);
  await saveDraft(page, "voice");

  const afterSaves = await loadAgent(ctx);
  report.afterSaves = {
    wizardBusinessName:
      afterSaves?.data?.draftConfig?.advanced?.appointmentReceptionistWizard?.businessName,
    phoneNumberId: afterSaves?.data?.phoneNumberId,
    publishedVersionId: afterSaves?.data?.publishedVersionId,
  };

  report._currentStep = "activate";
  await page.goto(`/voice/receptionist/edit?step=activate&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(4000);
  const activateBtn = page.getByTestId("wizard-activate-submit");
  const disabled = await activateBtn.isDisabled();
  const bodyText = await page.locator("main").innerText();
  const blockers = bodyText.match(/Required:[^\n]+/g) || [];
  report.activate = { disabled, blockers: blockers.slice(0, 12) };

  if (ALLOW_ACTIVATE && !disabled) {
    await activateBtn.click();
    await page.waitForTimeout(2500);
    const switchBtn = page.getByRole("button", { name: /switch to ai receptionist/i });
    if (await switchBtn.isVisible().catch(() => false)) {
      await switchBtn.click();
      report.activate.switchDialogConfirmed = true;
    }
    await page.waitForTimeout(75_000);
    const activatePost = report.apiPosts.filter((p) => p.postAction === "activate").pop();
    report.activate.result = activatePost;
    const afterPub = await loadAgent(ctx);
    report.afterActivate = {
      status: afterPub?.data?.status,
      publishedVersionId: afterPub?.data?.publishedVersionId,
    };
  }

  await page.screenshot({ path: path.join(SCREEN, "complete-activate.png"), fullPage: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ out: OUT, activate: report.activate, afterSaves: report.afterSaves }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
