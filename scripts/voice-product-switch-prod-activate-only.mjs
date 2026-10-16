/**
 * Production: confirm MCTB → AI Receptionist switch on activate (8077).
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.UI_AGENT_BASE_URL || "https://transovo.ai";
const AGENT = process.env.RECEPTIONIST_E2E_AGENT_ID || "cmu42zyel1c4x01090c6s335z";
const PHONE_ID = process.env.VOICE_SWITCH_PHONE_ID || "cmt7knkhc2j5c1t6x2e3t2t2z";
const OUT = "/opt/cursor/artifacts/voice-product-switch-activate-only.json";

async function loginWs1(ctx) {
  await ctx.request.get("/api/auth/dev-bypass?next=/voice/receptionist/edit", { maxRedirects: 0 });
  await ctx.request.post("/api/workspace", { data: { workspaceId: "ws_1" } });
}

async function main() {
  const report = { posts: [] };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ baseURL: BASE });
  await loginWs1(ctx);
  const page = await ctx.newPage();

  page.on("response", async (res) => {
    if (
      res.url().includes("appointment-receptionist") &&
      res.request().method() === "POST"
    ) {
      const body = await res.json().catch(() => ({}));
      let action;
      try {
        action = res.request().postDataJSON()?.action;
      } catch {
        action = null;
      }
      report.posts.push({
        action,
        status: res.status(),
        published: body?.data?.published,
        error: body?.error,
        code: body?.code,
        confirm: res.request().postDataJSON()?.confirmVoiceProductSwitch,
      });
    }
  });

  await page.goto(`/voice/receptionist/edit?step=phone&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /use existing transovo number/i }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /8077/ }).first().click();
  await page
    .getByRole("button", { name: /save draft/i })
    .or(page.getByRole("button", { name: /save & continue/i }))
    .first()
    .click();
  await page.waitForTimeout(6000);

  await page.goto(`/voice/receptionist/edit?step=activate&agentId=${AGENT}`, {
    waitUntil: "domcontentloaded",
    timeout: 180_000,
  });
  await page.waitForTimeout(5000);
  const activateBtn = page.getByTestId("wizard-activate-submit");
  report.activateDisabled = await activateBtn.isDisabled();
  await activateBtn.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 45_000 });
  await page.getByRole("button", { name: /switch to ai receptionist/i }).click();
  await page.waitForTimeout(120_000);

  const agent = await (await ctx.request.get(`/api/voice/agents/${AGENT}`)).json();
  report.agentAfter = {
    status: agent?.data?.status,
    healthStatus: agent?.data?.healthStatus,
    publishedVersionId: agent?.data?.publishedVersionId,
    phoneNumberId: agent?.data?.phoneNumberId,
  };

  const mctbBack = await ctx.request.post("/api/mctb/numbers", {
    data: {
      action: "select",
      phoneNumberId: PHONE_ID,
      confirmVoiceProductSwitch: true,
    },
  });
  report.mctbSwitchBack = { status: mctbBack.status(), body: await mctbBack.json() };

  const phoneRes = await ctx.request.get("/api/phone/numbers");
  const phones = (await phoneRes.json()).data || [];
  const phone = phones.find((p) => p.id === PHONE_ID);
  report.phoneAfter = {
    voiceIngressProduct: phone?.voiceIngressProduct,
    e164: phone?.e164,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
