/**
 * Production E2E: MCTB ↔ AI Receptionist confirm-and-switch (PR #673).
 *
 * Env:
 *   UI_AGENT_BASE_URL (default https://transovo.ai)
 *   RECEPTIONIST_E2E_AGENT_ID — isolated test agent (not cert agent)
 *   RECEPTIONIST_TEST_PHONE_LAST4 — default 8077 (often MCTB-backed on ws_1)
 *   VOICE_SWITCH_E2E_ALLOW_LIVE=1 — perform confirm switches + optional activate
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.UI_AGENT_BASE_URL || "https://transovo.ai";
const AGENT = process.env.RECEPTIONIST_E2E_AGENT_ID || "cmu42zyel1c4x01090c6s335z";
const CERT = "cmshz2lc25c622c4i58303501";
const PHONE_LAST4 = process.env.RECEPTIONIST_TEST_PHONE_LAST4 || "8077";
const ALLOW_LIVE = process.env.VOICE_SWITCH_E2E_ALLOW_LIVE === "1";
const OUT = "/opt/cursor/artifacts/voice-product-switch-prod-e2e.json";
const SCREEN = "/opt/cursor/artifacts/voice-product-switch-prod-e2e";

async function loginWs1(ctx) {
  await ctx.request.get("/api/auth/dev-bypass?next=/voice/receptionist/edit", { maxRedirects: 0 });
  const sw = await ctx.request.post("/api/workspace", { data: { workspaceId: "ws_1" } });
  if (!sw.ok()) throw new Error(`workspace switch ${sw.status()}`);
}

async function resolvePhoneId(ctx) {
  const res = await ctx.request.get("/api/phone/numbers");
  const json = await res.json();
  const rows = json.data || [];
  const match = rows.find((r) => String(r.e164 || "").includes(PHONE_LAST4));
  if (!match) throw new Error(`no phone ending in ${PHONE_LAST4}`);
  return match;
}

async function main() {
  if (AGENT === CERT) throw new Error("refusing cert agent");
  mkdirSync(SCREEN, { recursive: true });

  const report = {
    base: BASE,
    agent: AGENT,
    phoneLast4: PHONE_LAST4,
    allowLive: ALLOW_LIVE,
    health: null,
    phoneBefore: null,
    conflictProbe: null,
    activate: null,
    mctbSwitchBack: null,
    errors: [],
  };

  const healthRes = await fetch(`${BASE}/api/health`);
  report.health = await healthRes.json();

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  await loginWs1(ctx);

  const phone = await resolvePhoneId(ctx);
  report.phoneBefore = {
    id: phone.id,
    e164: phone.e164,
    voiceIngressProduct: phone.voiceIngressProduct,
    mctbTexmlLocked: phone.mctbTexmlLocked,
  };

  // Probe: activate without confirm should 409 when number is on MCTB
  if (phone.voiceIngressProduct === "mctb" || phone.mctbTexmlLocked) {
    const probe = await ctx.request.post("/api/solutions/appointment-receptionist", {
      data: {
        action: "activate",
        agentId: AGENT,
        confirmVoiceProductSwitch: false,
      },
    });
    const probeBody = await probe.json().catch(() => ({}));
    report.conflictProbe = {
      status: probe.status(),
      code: probeBody.code,
      hasVoiceProductSwitch: Boolean(probeBody.voiceProductSwitch),
      message: probeBody.error || probeBody.voiceProductSwitch?.message,
    };
  }

  if (ALLOW_LIVE) {
    const page = await ctx.newPage();
    await page.goto(`/voice/receptionist/edit?step=phone&agentId=${AGENT}`, {
      waitUntil: "domcontentloaded",
      timeout: 180_000,
    });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: /use existing transovo number/i }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: new RegExp(PHONE_LAST4) }).first().click();
    await page.waitForTimeout(500);
    const saveBtn = page
      .getByRole("button", { name: /save draft/i })
      .or(page.getByRole("button", { name: /save & continue/i }))
      .first();
    await saveBtn.click();
    await page.waitForTimeout(5000);

    await page.goto(`/voice/receptionist/edit?step=activate&agentId=${AGENT}`, {
      waitUntil: "domcontentloaded",
      timeout: 180_000,
    });
    await page.waitForTimeout(4000);
    const activateBtn = page.getByTestId("wizard-activate-submit");
    const disabled = await activateBtn.isDisabled();
    report.activate = { disabledBeforeClick: disabled };

    if (!disabled) {
      await activateBtn.click();
      await page.waitForTimeout(2000);
      const dialog = page.getByRole("dialog");
      const dialogVisible = await dialog.isVisible().catch(() => false);
      if (dialogVisible) {
        const switchBtn = page.getByRole("button", { name: /switch to ai receptionist/i });
        await switchBtn.click();
        await page.waitForTimeout(60_000);
        report.activate.dialogConfirmed = true;
      } else {
        report.activate.dialogConfirmed = false;
      }
      const agentRes = await ctx.request.get(`/api/voice/agents/${AGENT}`);
      const agentJson = await agentRes.json();
      report.activate.after = {
        status: agentJson?.data?.status,
        healthStatus: agentJson?.data?.healthStatus,
        publishedVersionId: agentJson?.data?.publishedVersionId,
        phoneNumberId: agentJson?.data?.phoneNumberId,
      };
      await page.screenshot({
        path: path.join(SCREEN, "after-receptionist-activate.png"),
        fullPage: true,
      });
    }

    // Switch back to MCTB with confirm
    const mctbRes = await ctx.request.post("/api/mctb/numbers", {
      data: {
        action: "select",
        phoneNumberId: phone.id,
        confirmVoiceProductSwitch: true,
      },
    });
    const mctbJson = await mctbRes.json().catch(() => ({}));
    report.mctbSwitchBack = {
      status: mctbRes.status(),
      ok: mctbJson.ok,
      error: mctbJson.error,
    };
    const phoneAfter = await resolvePhoneId(ctx);
    report.mctbSwitchBack.voiceIngressProductAfter = phoneAfter.voiceIngressProduct;
  }

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  const ok =
    report.health?.ok &&
    (report.conflictProbe?.status === 409 || report.phoneBefore?.voiceIngressProduct !== "mctb") &&
    (!ALLOW_LIVE ||
      (report.activate?.after?.publishedVersionId && report.mctbSwitchBack?.ok === true));
  if (!ok && ALLOW_LIVE) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
