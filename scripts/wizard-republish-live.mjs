/**
 * Re-run wizard Activate for an appointment receptionist / MCTB voice agent.
 * Publishes Telnyx + trigger deployment + MCTB VOICE_AGENT routing from current wizard state.
 *
 *   BASE_URL=https://your-app.example AGENT_ID=... OWNER_EMAIL=... node scripts/wizard-republish-live.mjs
 */
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";

async function main() {
  if (!BASE) throw new Error("BASE_URL or APP_URL required");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: { "content-type": "application/json", "x-smoke-bootstrap": BOOTSTRAP },
    data: { email: EMAIL, workspaceId: "ws_1" },
  });

  const getRes = await page.request.get(
    `${BASE}/api/solutions/appointment-receptionist?agentId=${AGENT_ID}`,
  );
  const loaded = await getRes.json();
  if (!getRes.ok() || !loaded?.data?.state) {
    throw new Error(`load failed: ${getRes.status()} ${JSON.stringify(loaded)}`);
  }

  const state = { ...loaded.data.state, agentId: AGENT_ID, activationMode: "activate_now" };
  console.log("Activating agent", AGENT_ID, "phone", state.phoneNumberE164 || state.phoneNumberId);

  const postRes = await page.request.post(`${BASE}/api/solutions/appointment-receptionist`, {
    headers: { "content-type": "application/json" },
    data: { action: "activate", state, wizardStepId: "activate" },
    timeout: 300000,
  });
  const body = await postRes.json();
  console.log(JSON.stringify(body, null, 2).slice(0, 4000));
  if (!postRes.ok()) process.exit(1);

  const handling = await page.request.get(`${BASE}/api/mctb/inbound-handling`);
  console.log("\nInbound handling:", JSON.stringify(await handling.json(), null, 2).slice(0, 2000));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
