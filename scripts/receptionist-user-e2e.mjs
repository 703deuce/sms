/**
 * Browser E2E: create generic receptionist agent like a user.
 * Usage: BASE_URL=$APP_URL OWNER_EMAIL=... node scripts/receptionist-user-e2e.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_E164 = process.env.PHONE_E164 || "+15715550198";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts/receptionist-e2e";
const REPORT = `${OUT_DIR}/report.json`;

fs.mkdirSync(OUT_DIR, { recursive: true });

const TEST_DATA = {
  agentName: "Sarah",
  businessName: "Summit Electric Services",
  businessDescription:
    "Summit Electric provides residential electrical repair, panel upgrades, and 24/7 emergency service in Denver. Regular hours are Monday through Friday 8am to 6pm. We charge a $95 diagnostic fee; emergency after-hours calls start at $175.",
  greeting:
    "Hi, thanks for calling Summit Electric Services. This is Sarah, how can I help you today?",
  voiceLabel: "Lily",
  voiceId: "maya-energetic-us",
};

const report = {
  base: BASE,
  startedAt: new Date().toISOString(),
  ok: false,
  testData: TEST_DATA,
  phoneE164: PHONE_E164,
  steps: [],
  errors: [],
  agentId: null,
  screenshots: [],
};

function log(step, detail = {}) {
  const row = { step, at: new Date().toISOString(), ...detail };
  report.steps.push(row);
  console.log(`→ ${step}`, detail.message || detail.url || "");
}

async function shot(page, name) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
  return path;
}

async function waitReady(page) {
  for (let i = 0; i < 90; i++) {
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) return;
    await page.waitForTimeout(500);
  }
  throw new Error("Page stayed in Working… too long");
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: WORKSPACE_ID },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
  }
  log("smoke-login", { message: body.email, workspaceId: body.workspaceId });
}

async function main() {
  if (!BASE) throw new Error("BASE_URL or APP_URL required");
  if (!EMAIL) throw new Error("OWNER_EMAIL or ADMIN_EMAILS required");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  page.on("response", async (res) => {
    try {
      if (!res.url().includes("/api/voice/agents")) return;
      if (res.request().method() !== "POST" && res.request().method() !== "PATCH") return;
      const json = await res.json().catch(() => null);
      const id = json?.data?.id;
      if (id && res.url().endsWith("/api/voice/agents") && res.request().method() === "POST") {
        report.agentId = id;
      }
    } catch {
      /* ignore */
    }
  });

  try {
    await smokeLogin(page);

    await page.goto(`${BASE}/voice/agents`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(1500);
    await shot(page, "01-agents-list");
    log("agents-list", { url: page.url() });

    await page.getByRole("link", { name: /Create New Agent/i }).first().click();
    await page.waitForURL(/\/voice\/agents\/new/, { timeout: 60000 });
    await waitReady(page);
    await shot(page, "02-about-empty");
    log("about-page", { url: page.url() });

    await page.locator("#agent-name").fill(TEST_DATA.agentName);
    await page.locator("#business-name").fill(TEST_DATA.businessName);
    await page.locator("#business-desc").fill(TEST_DATA.businessDescription);

    const greeting = page.locator("textarea").filter({ hasNot: page.locator("#business-desc") }).first();
    if (await greeting.count()) {
      await greeting.fill(TEST_DATA.greeting);
    }

    await waitReady(page);
    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.waitForURL(/\/capabilities/, { timeout: 120000 });
    await waitReady(page);
    await shot(page, "03-capabilities");
    log("capabilities", { url: page.url(), agentId: report.agentId });

    const match = page.url().match(/\/voice\/agents\/([^/]+)\/capabilities/);
    if (match) report.agentId = match[1];

    await page.getByRole("button", { name: /^Continue$/i }).click();
    await page.waitForURL(/\/voice-test/, { timeout: 120000 });
    await waitReady(page);
    await shot(page, "04-voice-test");
    log("voice-test", { url: page.url() });

    const lilyCard = page.getByText(TEST_DATA.voiceLabel, { exact: true }).first();
    await lilyCard.click();
    await page.waitForTimeout(500);
    await shot(page, "05-voice-selected");

    const phoneSelect = page.locator("select").first();
    if (await phoneSelect.count()) {
      const options = await phoneSelect.locator("option").all();
      let picked = false;
      for (const opt of options) {
        const text = (await opt.textContent()) || "";
        const val = await opt.getAttribute("value");
        if (val && text.includes(PHONE_E164)) {
          await phoneSelect.selectOption(val);
          picked = true;
          break;
        }
      }
      if (!picked && options.length > 1) {
        const val = await options[1].getAttribute("value");
        if (val) await phoneSelect.selectOption(val);
      }
    }
    await page.waitForTimeout(1000);
    await shot(page, "06-phone-selected");

    await waitReady(page);
    await page.getByRole("button", { name: /Activate Receptionist/i }).click();
    await waitReady(page);
    await page.waitForTimeout(3000);
    await shot(page, "07-activated");

    const bodyText = await page.locator("body").innerText();
    const hasError = /failed|error/i.test(bodyText) && /Save failed|Build failed|Publish failed/i.test(bodyText);
    if (hasError) {
      report.errors.push({ issue: "activation_error", body: bodyText.slice(0, 500) });
    }

    if (report.agentId) {
      const agentRes = await page.request.get(`${BASE}/api/voice/agents/${report.agentId}`);
      const agentJson = await agentRes.json();
      report.agentStatus = agentJson?.data?.status || agentJson?.data?.rawStatus;
      report.agentPhone = agentJson?.data?.phoneNumberId;
      const cfg = agentJson?.data?.draftConfig || agentJson?.data?.publishedConfig;
      report.compiledVoice = cfg?.voiceLanguage?.voiceId;
      report.compiledBusiness = cfg?.advanced?.receptionistCompiled?.businessName;
    }

    report.ok = report.errors.length === 0 && report.agentStatus === "ACTIVE";
    log("done", {
      message: `ok=${report.ok} agentId=${report.agentId} status=${report.agentStatus}`,
    });
  } catch (err) {
    report.errors.push({ issue: "fatal", message: err instanceof Error ? err.message : String(err) });
    await shot(page, "99-error").catch(() => undefined);
    console.error(err);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    await browser.close();
  }

  if (!report.ok) {
    console.error("RECEPTIONIST E2E FAILED", report.errors);
    process.exit(1);
  }
  console.log("RECEPTIONIST E2E OK", report.agentId);
}

main();
