/**
 * Production: confirm voice switch + activate receptionist (no MCTB switch-back).
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const BASE = process.env.UI_AGENT_BASE_URL || "https://transovo.ai";
const AGENT = process.env.RECEPTIONIST_E2E_AGENT_ID || "cmu42zyel1c4x01090c6s335z";
const PHONE_LAST4 = process.env.RECEPTIONIST_TEST_PHONE_LAST4 || "3615";
const OUT =
  process.env.OUT ||
  "/opt/cursor/artifacts/receptionist-activate-prod-only.json";

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

  const activate = await ctx.request.post("/api/solutions/appointment-receptionist", {
    data: {
      action: "activate",
      agentId: AGENT,
      state,
      confirmVoiceProductSwitch: true,
    },
    timeout: 300_000,
  });
  const body = await activate.json();
  report.steps.push({
    phase: "activate_with_confirm",
    status: activate.status(),
    published: body?.data?.published,
    publishError: body?.data?.publishError || body?.error,
    code: body?.code,
  });

  const agent = await (await ctx.request.get(`/api/voice/agents/${AGENT}`)).json();
  report.steps.push({
    phase: "agent",
    status: agent?.data?.status,
    publishedVersionId: agent?.data?.publishedVersionId,
    healthStatus: agent?.data?.healthStatus,
  });

  const phonesAfter = (await (await ctx.request.get("/api/phone/numbers")).json()).data || [];
  const phoneAfter = phonesAfter.find((p) => p.id === phone.id);
  report.steps.push({
    phase: "phone",
    voiceIngressProduct: phoneAfter?.voiceIngressProduct,
    telnyxVoiceConfigurable: phoneAfter?.telnyxVoiceConfigurable,
  });

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!body?.data?.published) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
