/**
 * Customer-style browser flow: fill receptionist wizard end-to-end, pick unused
 * ElevenLabs voice, assign +18663464256, Connect and Deploy.
 *
 * Usage:
 *   BASE_URL=$APP_URL OWNER_EMAIL=$ADMIN_EMAILS node scripts/receptionist-customer-deploy-866.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || process.env.ADMIN_EMAILS?.split(",")[0] || "")
  .trim()
  .toLowerCase();
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AGENT_ID = process.env.AGENT_ID || "";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts/receptionist-customer-deploy";
const REPORT = `${OUT_DIR}/report.json`;

/** ElevenLabs catalog voice — not default Jessica */
const VOICE_LABEL = process.env.VOICE_LABEL || "Jade";
const VOICE_ID = process.env.VOICE_ID || "Bmj4Yi69e7b67di5IKVn";

const TEST_DATA = {
  agentName: "Amy",
  businessName: "Harbor Home HVAC",
  industry: "HVAC Services",
  businessDescription:
    "Harbor Home HVAC is a licensed residential heating and cooling company serving Arlington, Fairfax, and Falls Church. We repair furnaces, heat pumps, and central AC, perform seasonal tune-ups, and offer 24/7 no-heat and no-cool emergency dispatch. License VA-HVAC-8842. Standard diagnostic visit is $89; after-hours emergency dispatch starts at $149.",
  agentPersonalityNotes:
    "You are Amy, the receptionist for Harbor Home HVAC. You sound warm, calm, and competent. You never rush callers but keep conversations efficient. You confirm spellings for names and repeat callback numbers clearly, digit by digit.",
  agentJobInstructions:
    "Answer every incoming call for Harbor Home HVAC. For heating or cooling problems, collect full name, callback number, service address, and whether the issue is no-heat, no-cool, weak airflow, strange noise, or routine maintenance. Explain the $89 diagnostic fee for standard visits and $149 after-hours emergency dispatch — never quote exact repair prices without a technician diagnosis. Offer to schedule a technician visit when the caller wants service. Take detailed messages when they prefer a callback.",
  additionalInstructions:
    "No same-day emergency bookings after 5pm. Never promise exact arrival times — say a technician will call back within 30 minutes for emergencies. Do not transfer landlord or condo authorization questions; take a message for the office manager instead.",
  businessHours:
    "Monday–Friday 7:00 AM – 7:00 PM. Saturday 9:00 AM – 3:00 PM emergency only. Closed Sunday.",
  serviceArea: "Arlington County, Fairfax County, Falls Church, and McLean.",
  coreServices:
    "AC repair, furnace repair, heat pump service, seasonal tune-ups, duct cleaning, thermostat installs.",
  pricingNotes:
    "$89 standard diagnostic visit. $149 after-hours emergency dispatch. Repair quotes only after on-site diagnosis.",
  businessAddress: "4201 Wilson Blvd, Arlington, VA 22203",
  greeting:
    "Hi, thanks for calling Harbor Home HVAC. This is Amy — how can I help you today?",
};

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  base: BASE,
  startedAt: new Date().toISOString(),
  ok: false,
  testData: TEST_DATA,
  voice: { label: VOICE_LABEL, id: VOICE_ID },
  phoneE164: PHONE_E164,
  agentId: null,
  steps: [],
  errors: [],
  screenshots: [],
  otherAgentsOn866: [],
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
  for (let i = 0; i < 120; i++) {
    const saving = await page.getByRole("button", { name: /Saving…|Working/i }).count();
    if (!saving) return;
    await page.waitForTimeout(500);
  }
  throw new Error("Page stayed busy too long");
}

async function saveChanges(page) {
  const btn = page.getByRole("button", { name: /^Save Changes$/i });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await waitReady(page);
    await page.waitForTimeout(1500);
  }
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
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
  log("smoke-login", { message: body.email });
}

async function listAgentsOn866(page) {
  const agentsRes = await page.request.get(`${BASE}/api/voice/agents`);
  const agentsJson = await agentsRes.json();
  const numbersRes = await page.request.get(`${BASE}/api/phone/numbers`);
  const numbersJson = await numbersRes.json();
  const phoneRow = (numbersJson.data || []).find((n) => n.e164 === PHONE_E164);
  const phoneId = phoneRow?.id;
  const on866 = (agentsJson.data || []).filter(
    (a) => a.phoneNumberId === phoneId || phoneRow?.aiOwner?.id === a.id,
  );
  report.otherAgentsOn866 = on866.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status || a.rawStatus,
    phoneNumberId: a.phoneNumberId,
  }));
  report.phoneNumberId = phoneId;
  log("agents-on-866-before", { count: on866.length, phoneId });
}

async function fillTextareaNearLabel(page, labelRe, value) {
  const label = page.getByText(labelRe).first();
  if (!(await label.isVisible().catch(() => false))) return false;
  const container = label.locator(
    "xpath=ancestor::div[contains(@class,'grid') or contains(@class,'mt-')][1]",
  );
  const ta = container.locator("textarea").first();
  if (await ta.count()) {
    await ta.fill(value);
    return true;
  }
  const input = container.locator("input").first();
  if (await input.count()) {
    await input.fill(value);
    return true;
  }
  return false;
}

async function main() {
  if (!BASE) throw new Error("BASE_URL or APP_URL required");
  if (!EMAIL) throw new Error("OWNER_EMAIL or ADMIN_EMAILS required");

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(120000);

  try {
    await smokeLogin(page);
    await listAgentsOn866(page);

    const startUrl = AGENT_ID
      ? `${BASE}/voice/agents/${AGENT_ID}/about`
      : `${BASE}/voice/agents/new`;
    await page.goto(startUrl, { waitUntil: "domcontentloaded" });
    await waitReady(page);
    await shot(page, "01-about-empty");
    log("about-page", { url: page.url() });

    await page.locator("#agent-name").fill(TEST_DATA.agentName);

    const businessInput = page.locator("#business-name");
    if (await businessInput.count()) {
      await businessInput.fill(TEST_DATA.businessName);
    } else {
      await page
        .locator("input")
        .filter({ has: page.locator("text=Business Name") })
        .first()
        .fill(TEST_DATA.businessName);
    }

    await page.locator("#industry").selectOption(TEST_DATA.industry);
    await page.locator("#business-desc").click({ clickCount: 3 });
    await page.locator("#business-desc").fill(TEST_DATA.businessDescription);

    // Verify required fields before continue
    const businessVal = await page.locator("#business-name").inputValue();
    if (!businessVal.trim()) {
      throw new Error("Business name field empty after fill");
    }

    const block2 = page.locator(".wizard-question-block").filter({ hasText: "What should it know?" });
    const block2Textareas = block2.locator(".wizard-textarea-shell textarea");
    if (await block2Textareas.count() >= 1) {
      await block2Textareas.nth(0).fill(TEST_DATA.agentPersonalityNotes);
    }
    if (await block2Textareas.count() >= 2) {
      await block2Textareas.nth(1).fill(TEST_DATA.agentJobInstructions);
    }

    const block3 = page.locator(".wizard-question-block").filter({
      hasText: "Anything else it should know?",
    });
    const block3Ta = block3.locator(".wizard-textarea-shell textarea").first();
    if (await block3Ta.count()) await block3Ta.fill(TEST_DATA.additionalInstructions);

    const details = page.locator("details").filter({
      has: page.locator("summary", { hasText: /Structured business details/i }),
    });
    if (await details.count()) {
      await details.locator("summary").click();
      await page.waitForTimeout(300);
      const structured = details.first();
      const structuredTextareas = structured.locator("textarea");
      if ((await structuredTextareas.count()) >= 4) {
        await structuredTextareas.nth(0).fill(TEST_DATA.businessHours);
        await structuredTextareas.nth(1).fill(TEST_DATA.serviceArea);
        await structuredTextareas.nth(2).fill(TEST_DATA.coreServices);
        await structuredTextareas.nth(3).fill(TEST_DATA.pricingNotes);
      }
      const addressInput = structured.locator("input").first();
      if (await addressInput.count()) await addressInput.fill(TEST_DATA.businessAddress);
    }

    await waitReady(page);
    await shot(page, "02-about-filled");
    await saveChanges(page);

    if (!AGENT_ID) {
      await page.getByRole("button", { name: /^Continue$/i }).click();
      await waitReady(page);
      const errBanner = page.locator("text=Business name is required");
      if (await errBanner.isVisible().catch(() => false)) {
        await page.locator("#business-name").click();
        await page.locator("#business-name").fill(TEST_DATA.businessName);
        await page.getByRole("button", { name: /^Continue$/i }).click();
        await waitReady(page);
      }
      await page.waitForURL(/\/capabilities/, { timeout: 180000 });
    } else {
      await page.goto(`${BASE}/voice/agents/${AGENT_ID}/capabilities`, {
        waitUntil: "domcontentloaded",
      });
      await waitReady(page);
    }
    await waitReady(page);

    const capMatch = page.url().match(/\/voice\/agents\/([^/]+)\/capabilities/);
    if (capMatch) report.agentId = capMatch[1];
    await shot(page, "03-capabilities");
    log("capabilities", { agentId: report.agentId });

    // Enable optional collection fields
    for (const label of ["Email", "Service address"]) {
      const chip = page.getByRole("button", { name: new RegExp(label, "i") }).first();
      if (await chip.isVisible().catch(() => false)) {
        const selected = await chip.evaluate((el) =>
          el.className.includes("6366f1") || el.className.includes("bg-[#6366f1]"),
        );
        if (!selected) await chip.click();
      }
    }

    await waitReady(page);
    await saveChanges(page);
    if (!AGENT_ID) {
      await page.getByRole("button", { name: /^Continue$/i }).click();
      await page.waitForURL(/\/voice-test/, { timeout: 120000 });
    } else {
      await page.goto(`${BASE}/voice/agents/${report.agentId || AGENT_ID}/voice-test`, {
        waitUntil: "domcontentloaded",
      });
    }
    await waitReady(page);
    await shot(page, "04-voice-test");
    log("voice-test", { url: page.url() });

    const voiceBtn = page.getByRole("button", { name: VOICE_LABEL, exact: true }).first();
    if (await voiceBtn.isVisible().catch(() => false)) {
      await voiceBtn.click();
    } else {
      await page.getByText(VOICE_LABEL, { exact: true }).first().click();
    }
    await page.waitForTimeout(500);
    await shot(page, "05-voice-selected");

    const greetingDetails = page.locator("details").filter({ hasText: /^1\. Greeting|^2\. Greeting/ });
    if (await greetingDetails.count()) {
      const open = greetingDetails.first();
      if (!(await open.getAttribute("open"))) {
        await open.locator("summary").click();
        await page.waitForTimeout(200);
      }
      const greetingTa = open.locator("textarea").first();
      if (await greetingTa.count()) await greetingTa.fill(TEST_DATA.greeting);
    }

    const callHandling = page.locator("details").filter({ hasText: /Call handling/i });
    if (await callHandling.count()) {
      const section = callHandling.first();
      if (!(await section.getAttribute("open"))) {
        await section.locator("summary").click();
        await page.waitForTimeout(300);
      }
      const phoneSelect = section.locator("select").first();
      if (await phoneSelect.count()) {
        const options = await phoneSelect.locator("option").all();
        let picked = false;
        for (const opt of options) {
          const text = (await opt.textContent()) || "";
          const val = await opt.getAttribute("value");
          if (val && text.includes("8663464256")) {
            await phoneSelect.selectOption(val);
            picked = true;
            log("phone-selected", { message: PHONE_E164, phoneId: val });
            break;
          }
        }
        if (!picked) {
          for (const opt of options) {
            const val = await opt.getAttribute("value");
            const text = (await opt.textContent()) || "";
            if (val && text.includes(PHONE_E164.replace("+1", ""))) {
              await phoneSelect.selectOption(val);
              picked = true;
              log("phone-selected", { message: text, phoneId: val });
              break;
            }
          }
        }
        if (!picked) report.errors.push({ issue: "phone_not_found", message: PHONE_E164 });
      }
    }

    await page.waitForTimeout(1500);
    await shot(page, "06-phone-selected");
    await waitReady(page);

    await page.getByRole("button", { name: /Connect and Deploy/i }).click();
    await waitReady(page);
    await page.waitForTimeout(8000);
    await shot(page, "07-deployed");

    const bodyText = await page.locator("body").innerText();
    if (/Publish failed|Build failed|Save failed|activation_error/i.test(bodyText)) {
      report.errors.push({ issue: "deploy_ui_error", snippet: bodyText.slice(0, 800) });
    }

    if (report.agentId) {
      const agentRes = await page.request.get(`${BASE}/api/voice/agents/${report.agentId}`);
      const agentJson = await agentRes.json();
      const data = agentJson.data || {};
      report.agentStatus = data.status || data.rawStatus;
      report.agentPhoneNumberId = data.phoneNumberId;
      const pub = data.publishedConfig || data.draftConfig || {};
      const wizard = pub.advanced?.receptionistWizard || {};
      const compiled = pub.advanced?.receptionistCompiled || {};
      const instructions = pub.instructions?.system || "";
      report.compiled = {
        businessName: compiled.businessName || wizard.businessName,
        voiceId: pub.voiceLanguage?.voiceId || wizard.voiceId || compiled.voiceId,
        voiceLabel: wizard.voiceLabel,
        greeting: wizard.greeting || compiled.greeting,
        capabilities: wizard.capabilities || compiled.capabilities,
        hasConstitution: instructions.includes("TRANSOVO SYSTEM"),
        hasHarbor: instructions.includes("Harbor Home"),
      };
      report.promptPreview = {
        businessDescription: wizard.businessDescription,
        personality: wizard.agentPersonalityNotes,
        jobInstructions: wizard.agentJobInstructions,
        additional: wizard.additionalInstructions,
        hours: wizard.businessHours,
        serviceArea: wizard.serviceArea,
      };
    }

    await listAgentsOn866(page);
    const stillOthers = report.otherAgentsOn866.filter((a) => a.id !== report.agentId);
    if (stillOthers.length) {
      report.errors.push({
        issue: "other_agents_still_on_866",
        agents: stillOthers,
      });
    }

    report.ok =
      report.errors.length === 0 &&
      String(report.agentStatus).toLowerCase() === "active" &&
      report.agentPhoneNumberId === report.phoneNumberId &&
      report.compiled?.hasConstitution &&
      report.compiled?.hasHarbor;

    log("done", {
      message: `ok=${report.ok} agent=${report.agentId} status=${report.agentStatus}`,
    });
  } catch (err) {
    report.errors.push({
      issue: "fatal",
      message: err instanceof Error ? err.message : String(err),
    });
    await shot(page, "99-error").catch(() => undefined);
    console.error(err);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    await browser.close();
  }

  if (!report.ok) {
    console.error("CUSTOMER DEPLOY FAILED", JSON.stringify(report.errors, null, 2));
    process.exit(1);
  }
  console.log("CUSTOMER DEPLOY OK", report.agentId);
}

main();
