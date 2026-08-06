/**
 * Prove Amy lifecycle from hire → Company Brain → wizard deploy → Amy workspace.
 * Skips Stripe; uses smoke-login. Takes screenshots under /opt/cursor/artifacts/amy-lifecycle.
 *
 *   BASE_URL=https://transovo.ai node scripts/amy-lifecycle-browser-e2e.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/amy-lifecycle";
const DID = process.env.AMY_DID || "+18663464256";
const COMPANY = process.env.AMY_COMPANY || "Harbor Drain Pros";
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  runId: RUN_ID,
  startedAt: new Date().toISOString(),
  ok: false,
  steps: [],
  errors: [],
  layers: {
    companyBrain: {},
    amy: {},
    deployment: {},
  },
  agentId: null,
  flowId: null,
  telnyxAssistantId: null,
  published: null,
};

function log(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`→ ${step}`, detail.message || detail.url || JSON.stringify(detail).slice(0, 120));
}

async function shot(page, name) {
  const path = `${OUT}/${RUN_ID}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log("screenshot", { message: path });
  return path;
}

async function waitReady(page) {
  for (let i = 0; i < 90; i++) {
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) return;
    await page.waitForTimeout(500);
  }
  throw new Error("Stuck on Working…");
}

async function clickContinue(page) {
  await waitReady(page);
  const btn = page.getByRole("button", { name: /^Continue$/i }).last();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
  await waitReady(page);
  await page.waitForTimeout(600);
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}`);
  log("smoke-login", { status: res.status() });
}

async function waitForHireDeploy(page, maxTries = 60) {
  for (let i = 1; i <= maxTries; i++) {
    const res = await page.request.get(`${BASE}/hire`);
    const text = await res.text();
    if (
      res.ok() &&
      /Build your communications team|put your first agent|Hire Amy/i.test(text)
    ) {
      log("deploy-ready", { try: i, status: res.status() });
      return true;
    }
    const api = await page.request.get(`${BASE}/api/company-brain`);
    log("deploy-wait", {
      try: i,
      hire: res.status(),
      companyBrain: api.status(),
      message: `waiting for Coolify (${i}/${maxTries})`,
    });
    await page.waitForTimeout(30000);
  }
  return false;
}

async function verifyLayers(page) {
  if (!report.agentId) return;
  const brain = await page.request.get(`${BASE}/api/company-brain`);
  const brainJson = await brain.json().catch(() => ({}));
  report.layers.companyBrain = {
    status: brain.status(),
    businessName: brainJson?.data?.businessName,
    hours: brainJson?.data?.businessHoursSummary,
    facts: (brainJson?.data?.knowledgeFacts || []).length,
  };

  const agent = await page.request.get(`${BASE}/api/agents/${report.agentId}`);
  const agentJson = await agent.json().catch(() => ({}));
  if (agent.ok()) {
    const d = agentJson.data || {};
    report.layers.amy = {
      status: agent.status(),
      name: d.identity?.displayName || d.identity?.name,
      number: d.phoneNumberE164 || d.resources?.numberLabel,
      calendar: d.resources?.calendarLabel,
      services: d.bookingPolicy?.allowedServices,
      notice: d.bookingPolicy?.minimumNoticeMinutes,
      cutoff: d.bookingPolicy?.sameDayCutoff,
      voice: d.profile?.voiceSummary,
      health: d.health?.overall,
      version: d.currentVersionId,
    };
    report.layers.deployment = {
      voiceAgentId: d.voiceAgentId,
      telnyxAssistantId: d.telnyxAssistantId,
      primaryFlowId: d.primaryFlowId,
      drift: d.health?.deploymentDrift?.status,
      published: report.published,
    };
  } else {
    // Fallback older API
    const va = await page.request.get(`${BASE}/api/voice/agents/${report.agentId}`);
    const vj = await va.json().catch(() => ({}));
    report.layers.amy = {
      status: va.status(),
      name: vj?.data?.name || vj?.data?.displayName,
      telnyxAssistantId: vj?.data?.telnyxAssistantId,
    };
    report.layers.deployment.voiceAgentId = report.agentId;
    report.layers.deployment.telnyxAssistantId = vj?.data?.telnyxAssistantId;
  }
  log("layer-verify", {
    message: JSON.stringify({
      brain: report.layers.companyBrain.businessName,
      amy: report.layers.amy.name,
      telnyx: report.layers.deployment.telnyxAssistantId,
    }),
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  page.on("response", async (res) => {
    try {
      if (!res.url().includes("/api/solutions/appointment-receptionist")) return;
      if (res.request().method() !== "POST") return;
      const json = await res.json().catch(() => null);
      if (json?.data?.agentId) report.agentId = json.data.agentId;
      if (json?.data?.primaryFlowId) report.flowId = json.data.primaryFlowId;
      if (json?.data?.published != null) report.published = json.data.published;
      if (json?.data?.publishError) report.publishError = json.data.publishError;
      if (json?.data?.telnyxAssistantId) report.telnyxAssistantId = json.data.telnyxAssistantId;
    } catch {
      /* ignore */
    }
  });

  try {
    await smokeLogin(page);

    const ready = await waitForHireDeploy(page, Number(process.env.DEPLOY_WAIT_TRIES || 60));
    if (!ready) {
      report.errors.push("Production deploy of /hire did not become ready in time");
      throw new Error("Deploy timeout — /hire not live yet");
    }

    // Clear stale wizard draft
    await page.goto(`${BASE}/outcomes`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try {
        localStorage.removeItem("transovo.appointment-receptionist.wizard.v1");
      } catch {
        /* ignore */
      }
    });

    // 1) Hire chooser
    await page.goto(`${BASE}/hire`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await shot(page, "01-hire-chooser");
    const hireText = await page.locator("body").innerText();
    if (!/Amy/i.test(hireText)) report.errors.push("Hire page missing Amy");
    log("hire", { message: "chooser open" });

    await page.getByRole("link", { name: /Hire Amy/i }).first().click();
    await page.waitForTimeout(1500);

    // 2) Company Brain — manual entry for a fresh company profile
    await page.waitForURL(/\/hire\/brain|\/company-brain/, { timeout: 30000 }).catch(() => null);
    if (!/brain/i.test(page.url())) {
      await page.goto(`${BASE}/hire/brain?next=amy`, { waitUntil: "domcontentloaded" });
    }
    await page.waitForTimeout(1000);
    await shot(page, "02-company-brain");
    log("brain", { url: page.url() });

    const manualTab = page.getByRole("button", { name: /Enter manually/i }).first();
    await manualTab.waitFor({ state: "visible", timeout: 15000 });
    await manualTab.click();
    await page.waitForTimeout(500);

    // Manual fields are labeled inputs inside <label>
    const byLabel = async (labelText, value) => {
      const label = page.locator("label").filter({ hasText: labelText }).first();
      await label.waitFor({ state: "visible", timeout: 10000 });
      const field = label.locator("input, textarea").first();
      await field.fill(value);
    };
    await byLabel(/Business name/i, COMPANY);
    await byLabel(/Main location/i, "San Francisco, CA");
    await byLabel(/Business hours/i, "Mon–Fri 8:00 AM–6:00 PM; Sat 9:00 AM–1:00 PM; Sun closed");
    await byLabel(
      /^Services$/i,
      "Drain cleaning, water heater repair, sewer camera inspection, emergency plumbing",
    );

    const saveBtn = page.getByRole("button", { name: /Save company profile/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(1500);
    await shot(page, "02b-brain-saved");

    const approveBtn = page.getByRole("button", { name: /Confirm all for review/i }).first();
    if (
      (await approveBtn.isVisible().catch(() => false)) &&
      !(await approveBtn.isDisabled().catch(() => true))
    ) {
      await approveBtn.click();
      await page.waitForTimeout(800);
    }

    const continueTrain = page.getByRole("button", { name: /Continue to train Amy/i }).first();
    await continueTrain.click();
    await page.waitForTimeout(1500);
    await shot(page, "03-amy-wizard-goals");
    log("wizard-goals", { url: page.url() });

    // Ensure hire=amy
    if (!/hire=amy/i.test(page.url())) {
      await page.goto(
        `${BASE}/solutions/ai-call-handling/appointment-assistant/setup?hire=amy`,
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForTimeout(1200);
    }

    // Clear and set name
    await page.evaluate(() => {
      try {
        localStorage.removeItem("transovo.appointment-receptionist.wizard.v1");
      } catch {
        /* ignore */
      }
    });
    // reload hire mode after clear
    await page.goto(
      `${BASE}/solutions/ai-call-handling/appointment-assistant/setup?hire=amy`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(1200);

    const nameInput = page.locator("#solution-name").first();
    if (await nameInput.count()) {
      await nameInput.fill(`Amy — ${COMPANY} ${RUN_ID.slice(-5)}`);
    }

    const every = page.getByText("Every incoming call", { exact: false }).first();
    if (await every.isVisible().catch(() => false)) await every.click();

    await clickContinue(page);
    await shot(page, "04-phone");
    log("phone");

    const existing = page.getByText(/Use existing Transovo number/i).first();
    if (await existing.isVisible().catch(() => false)) await existing.click();
    await page.waitForTimeout(500);

    const didBtn = page.getByRole("button", { name: /866.*346|346-4256|\(866\)/i }).first();
    if (await didBtn.isVisible().catch(() => false)) {
      await didBtn.click();
      log("phone-selected", { message: DID });
    } else {
      const anyDid = page
        .locator("button")
        .filter({ hasText: /\+1|\(\d{3}\)|\d{3}[-.\s]\d{3}/ })
        .first();
      if (await anyDid.count()) {
        await anyDid.click();
        log("phone-selected", { message: await anyDid.innerText() });
      } else {
        report.errors.push("Could not select phone number");
      }
    }
    const answerEvery = page.getByText(/Answer every incoming call/i).first();
    if (await answerEvery.isVisible().catch(() => false)) await answerEvery.click();

    await clickContinue(page);
    // Hire mode skips Information (Company Brain already done) → Booking rules
    await page.waitForTimeout(2000);
    await shot(page, "05-booking-rules");
    log("booking-rules");

    // Wait for calendar probe
    for (let i = 0; i < 20; i++) {
      const t = await page.locator("body").innerText();
      if (/Calendar|Calendly|Google|Transovo Calendar|Connected|appointment type/i.test(t)) break;
      await page.waitForTimeout(500);
    }
    const apptBody = await page.locator("body").innerText();
    if (!/Connected/i.test(apptBody)) {
      const transovo = page.getByText("Transovo Calendar", { exact: false }).first();
      const calendly = page.getByText("Calendly", { exact: false }).first();
      if (await transovo.isVisible().catch(() => false)) {
        await transovo.click();
        await page.waitForTimeout(1500);
        log("calendar", { message: "Transovo Calendar" });
      } else if (await calendly.isVisible().catch(() => false)) {
        await calendly.click();
        await page.waitForTimeout(800);
        log("calendar", { message: "Calendly card" });
      } else {
        report.errors.push("No live calendar on Booking rules step");
      }
    } else {
      log("calendar", { message: "already Connected" });
    }
    await shot(page, "05b-calendar");

    await clickContinue(page);
    await shot(page, "06-call-handling");
    log("call-handling");
    const transferName = page.getByPlaceholder(/name|Owner|Reception|Desk/i).first();
    if (await transferName.isVisible().catch(() => false)) {
      await transferName.fill("Dispatch — Marina");
    }
    const transferPhone = page.getByPlaceholder(/\+1|555|000-0000/i).first();
    if (await transferPhone.isVisible().catch(() => false)) {
      await transferPhone.fill("+15555550199");
    }

    await clickContinue(page);
    await shot(page, "07-voice");
    log("voice");
    const voiceHeading = page.getByText(/Choose a voice|Voice personality|Selected voice/i).first();
    await voiceHeading.waitFor({ state: "visible", timeout: 45000 }).catch(() => null);
    const allie = page.getByText("Allie", { exact: true }).first();
    const astra = page.getByText("Astra", { exact: true }).first();
    if (await allie.isVisible().catch(() => false)) {
      await allie.scrollIntoViewIfNeeded();
      await allie.click({ force: true });
    } else if (await astra.isVisible().catch(() => false)) {
      await astra.scrollIntoViewIfNeeded();
      await astra.click({ force: true });
    }
    const greeting = page.locator("textarea").first();
    if (await greeting.isVisible().catch(() => false)) {
      await greeting.fill(
        `Thank you for calling ${COMPANY}. This is Amy, your appointment booking agent. How may I help you today?`,
      );
    }
    await shot(page, "07b-voice-selected");

    await clickContinue(page);
    await shot(page, "08-test");
    log("test");
    const bookingScenario = page.getByText(/Appointment booking/i).first();
    if (await bookingScenario.isVisible().catch(() => false)) await bookingScenario.click();

    const buildBtn = page
      .getByRole("button", { name: /Build & ready test|Build & test|Build test/i })
      .first();
    if (await buildBtn.isVisible().catch(() => false)) {
      await buildBtn.click();
      log("build-test-clicked");
      for (let i = 0; i < 90; i++) {
        const t = await page.locator("body").innerText();
        if (/Live assistant[\s\S]{0,60}(Ready|Live|built)/i.test(t)) break;
        if (/error|failed/i.test(t) && i > 15) break;
        await page.waitForTimeout(1000);
      }
      await shot(page, "08b-after-build");
    }

    await clickContinue(page);
    await shot(page, "09-activate");
    log("activate-screen");
    await page.waitForTimeout(2000);

    await waitReady(page);
    const submit =
      (await page.locator('[data-testid="wizard-activate-submit"]').count())
        ? page.locator('[data-testid="wizard-activate-submit"]').first()
        : page.getByRole("button", { name: /^Activate now$/i }).last();

    if (await submit.isDisabled().catch(() => true)) {
      report.errors.push("Activate now disabled");
      await shot(page, "10b-activate-disabled");
    } else {
      await submit.scrollIntoViewIfNeeded();
      await submit.click();
      log("activate-clicked");
    }

    for (let i = 0; i < 120; i++) {
      const url = page.url();
      if (/\/agents\/|\/voice\/agents\//.test(url)) break;
      const working = await page.getByRole("button", { name: /Working/i }).count();
      if (!working && i > 8 && report.published) break;
      if (!working && i > 8 && report.publishError) break;
      await page.waitForTimeout(1000);
    }
    await shot(page, "11-after-activate");
    log("after-activate", {
      url: page.url(),
      agentId: report.agentId,
      published: report.published,
      telnyx: report.telnyxAssistantId,
    });

    if (!report.agentId) {
      const m = page.url().match(/\/(?:voice\/)?agents\/([^/?#]+)/);
      if (m) report.agentId = m[1];
    }

    await verifyLayers(page);

    // Amy workspace (new) or fallback voice agent page
    if (report.agentId) {
      const amyUrl = `${BASE}/agents/${report.agentId}`;
      const amyRes = await page.request.get(amyUrl);
      if (amyRes.ok() || amyRes.status() === 200) {
        await page.goto(amyUrl, { waitUntil: "domcontentloaded" });
      } else {
        await page.goto(`${BASE}/voice/agents/${report.agentId}`, {
          waitUntil: "domcontentloaded",
        });
      }
      await page.waitForTimeout(2000);
      await shot(page, "12-amy-workspace");
      const body = await page.locator("body").innerText();
      report.workspace = {
        hasTalk: /Talk to Amy|Talk to/i.test(body),
        hasHome: /Home/i.test(body),
        hasSettings: /Settings/i.test(body),
        hasWork: /Work/i.test(body),
        hasBuild: /Build/i.test(body),
        url: page.url(),
      };
      log("amy-workspace", report.workspace);

      // Settings → propose notice change if UI present
      const settingsTab = page.getByRole("button", { name: /^Settings$/i }).first();
      if (await settingsTab.isVisible().catch(() => false)) {
        await settingsTab.click();
        await page.waitForTimeout(800);
        const booking = page.getByRole("button", { name: /Booking rules/i }).first();
        if (await booking.isVisible().catch(() => false)) await booking.click();
        await page.waitForTimeout(500);
        const notice = page.locator("input").first();
        if (await notice.isVisible().catch(() => false)) {
          await notice.fill("4");
          const propose = page.getByRole("button", { name: /Propose change/i }).first();
          if (await propose.isVisible().catch(() => false)) {
            await propose.click();
            await page.waitForTimeout(1500);
            report.settingsPropose = true;
          }
        }
        await shot(page, "13-settings-booking");
      }

      // Talk — ask for notice change confirmation path
      const talkTab = page.getByRole("button", { name: /Talk to Amy/i }).first();
      if (await talkTab.isVisible().catch(() => false)) {
        await talkTab.click();
        await page.waitForTimeout(800);
        const input = page.locator("textarea, input[type='text']").last();
        if (await input.isVisible().catch(() => false)) {
          await input.fill("What version are callers currently using?");
          const send = page.getByRole("button", { name: /Send|Ask/i }).first();
          if (await send.isVisible().catch(() => false)) await send.click();
          else await input.press("Enter");
          await page.waitForTimeout(2500);
        }
        await shot(page, "14-talk");
      }
    }

    report.ok =
      Boolean(report.agentId) &&
      Boolean(report.published || report.telnyxAssistantId) &&
      report.errors.length === 0;

    if (!report.published && !report.telnyxAssistantId) {
      report.errors.push("Activate did not publish / no Telnyx assistant id");
      report.ok = false;
    }
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    try {
      await shot(page, "zz-error");
    } catch {
      /* ignore */
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(`${OUT}/lifecycle-report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }

  process.exit(report.ok ? 0 : 1);
}

main();
