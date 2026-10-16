/**
 * Production API path: MCTB DID → AI Receptionist (confirm) → MCTB (confirm).
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.UI_AGENT_BASE_URL || "https://transovo.ai";
const AGENT = process.env.RECEPTIONIST_E2E_AGENT_ID || "cmu42zyel1c4x01090c6s335z";
const PHONE_LAST4 = process.env.RECEPTIONIST_TEST_PHONE_LAST4 || "3615";
const OUT = "/opt/cursor/artifacts/voice-product-switch-prod-api.json";

async function loginWs1(ctx) {
  await ctx.request.get("/api/auth/dev-bypass?next=/", { maxRedirects: 0 });
  await ctx.request.post("/api/workspace", { data: { workspaceId: "ws_1" } });
}

async function main() {
  const report = { steps: [] };
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ baseURL: BASE });
  await loginWs1(ctx);

  const phones = (await (await ctx.request.get("/api/phone/numbers")).json()).data || [];
  const phone = phones.find((p) => String(p.e164).includes(PHONE_LAST4));
  if (!phone) throw new Error("phone not found");

  const setup = await (
    await ctx.request.get(`/api/solutions/appointment-receptionist?agentId=${AGENT}`)
  ).json();
  const state = { ...setup.data.state, phoneNumberId: phone.id, phoneNumberE164: phone.e164 };

  report.steps.push({
    phase: "before",
    voiceIngressProduct: phone.voiceIngressProduct,
    agentStatus: (await (await ctx.request.get(`/api/voice/agents/${AGENT}`)).json())?.data
      ?.status,
  });

  const conflict = await ctx.request.post("/api/solutions/appointment-receptionist", {
    data: { action: "activate", agentId: AGENT, state, confirmVoiceProductSwitch: false },
    timeout: 120_000,
  });
  const conflictBody = await conflict.json();
  report.steps.push({
    phase: "activate_without_confirm",
    status: conflict.status(),
    code: conflictBody.code,
    published: conflictBody?.data?.published,
  });

  const activate = await ctx.request.post("/api/solutions/appointment-receptionist", {
    data: {
      action: "activate",
      agentId: AGENT,
      state,
      confirmVoiceProductSwitch: true,
    },
    timeout: 300_000,
  });
  const activateBody = await activate.json();
  report.steps.push({
    phase: "activate_with_confirm",
    status: activate.status(),
    published: activateBody?.data?.published,
    publishError: activateBody?.data?.publishError || activateBody?.error,
    livekit: activateBody?.data?.livekitProvision,
  });

  const agentAfter = await (await ctx.request.get(`/api/voice/agents/${AGENT}`)).json();
  report.steps.push({
    phase: "agent_after_receptionist",
    status: agentAfter?.data?.status,
    healthStatus: agentAfter?.data?.healthStatus,
    publishedVersionId: agentAfter?.data?.publishedVersionId,
  });

  const mctb = await ctx.request.post("/api/mctb/numbers", {
    data: {
      action: "select",
      phoneNumberId: phone.id,
      confirmVoiceProductSwitch: true,
    },
    timeout: 180_000,
  });
  report.steps.push({
    phase: "mctb_switch_back",
    status: mctb.status(),
    body: await mctb.json(),
  });

  const phoneAfter = (
    await (await ctx.request.get("/api/phone/numbers")).json()
  ).data.find((p) => p.id === phone.id);
  report.steps.push({
    phase: "phone_after_mctb",
    voiceIngressProduct: phoneAfter?.voiceIngressProduct,
  });

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
