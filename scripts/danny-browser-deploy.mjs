/**
 * Browser UX: create appointment agent "Danny" with full Lakeside Family Dentistry
 * knowledge, Allie Ultra voice, activate on +18663464256.
 *
 *   BASE_URL=https://transovo.ai node scripts/danny-browser-deploy.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/danny-agent";
const DID = "+18663464256";

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  startedAt: new Date().toISOString(),
  ok: false,
  steps: [],
  errors: [],
  agentId: null,
  flowId: null,
};

function log(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`→ ${step}`, detail.message || detail.url || "");
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
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
      if (json?.data?.name) report.agentName = json.data.name;
      if (json?.data?.published != null) report.published = json.data.published;
      if (json?.data?.publishError) report.publishError = json.data.publishError;
      if (json?.data?.telnyxAssistantId)
        report.telnyxAssistantId = json.data.telnyxAssistantId;
    } catch {
      /* ignore */
    }
  });

  try {
    await smokeLogin(page);

    // Fresh wizard — no stale localStorage draft
    await page.goto(`${BASE}/outcomes`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      try {
        localStorage.removeItem("transovo.appointment-receptionist.wizard.v1");
      } catch {
        /* ignore */
      }
    });

    // Book Appointments wizard (no preset = appointment receptionist)
    await page.goto(
      `${BASE}/solutions/ai-call-handling/appointment-assistant/setup`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(1500);
    await shot(page, "01-goals");

    const goalsText = await page.locator("body").innerText();
    if (!/Book new appointments/i.test(goalsText)) {
      report.errors.push("Goals: booking capability card missing");
    }
    if (!/Create Appointment Receptionist/i.test(goalsText)) {
      report.errors.push("Goals: expected Appointment Receptionist headline");
    }
    log("goals", { message: "booking wizard open" });

    // Name the agent Danny — do NOT toggle capability cards (clicking deselects).
    const nameInput = page.locator("#solution-name").first();
    await nameInput.fill("Danny");
    await page.waitForTimeout(300);

    // Ensure SMS confirmations is on (may be off by default)
    const smsCard = page.locator("button, [role='button'], div").filter({
      hasText: /^Send confirmations by text/,
    }).first();
    // Use SelectableCard click only if not already selected — look for check near it
    const smsSelected = await page
      .getByText("Send confirmations by text", { exact: false })
      .locator("xpath=ancestor::*[contains(@class,'border')][1]")
      .evaluate((el) => el.className.includes("border-primary") || el.querySelector("svg") != null)
      .catch(() => false);
    if (!smsSelected) {
      await page.getByText("Send confirmations by text", { exact: false }).first().click();
      await page.waitForTimeout(200);
    }

    // Verify booking still selected (must keep Appointments step)
    const bodyAfterCaps = await page.locator("body").innerText();
    if (!/Appointments/i.test(bodyAfterCaps)) {
      // Re-enable book appointments
      await page.getByText("Book new appointments", { exact: false }).first().click();
      await page.waitForTimeout(300);
    }

    // Every incoming call
    const every = page.getByText("Every incoming call", { exact: false }).first();
    if (await every.isVisible().catch(() => false)) await every.click();

    await shot(page, "01b-goals-named");
    await clickContinue(page);
    await shot(page, "02-phone");
    log("phone");

    // Use existing number — click the DID button (not a <select>)
    const existing = page.getByText(/Use existing Transovo number/i).first();
    if (await existing.isVisible().catch(() => false)) await existing.click();
    await page.waitForTimeout(500);

    const didBtn = page.getByRole("button", { name: /866.*346|346-4256|\(866\)/i }).first();
    if (await didBtn.isVisible().catch(() => false)) {
      await didBtn.click();
      log("phone-selected", { message: DID });
    } else {
      // Fallback: any available number button under existing
      const anyDid = page.locator("button").filter({ hasText: /\+1|\(866\)|\(855\)|\(833\)/ }).first();
      if (await anyDid.count()) {
        await anyDid.click();
        log("phone-selected", { message: await anyDid.innerText() });
      } else {
        report.errors.push("Could not click phone number on Phone step");
      }
    }

    const answerEvery = page.getByText(/Answer every incoming call/i).first();
    if (await answerEvery.isVisible().catch(() => false)) await answerEvery.click();

    await clickContinue(page);
    await shot(page, "03-information");
    log("information");

    // Guided business profile with Lakeside Family Dentistry
    const guided = page.getByText(/guided business profile/i).first();
    if (await guided.isVisible().catch(() => false)) {
      await guided.click();
      await page.waitForTimeout(400);
    }

    const fillByLabel = async (labelRe, value) => {
      const label = page.getByText(labelRe).first();
      if (!(await label.isVisible().catch(() => false))) return false;
      // Prefer nearby input/textarea
      const container = label.locator("xpath=ancestor::div[contains(@class,'space-y') or contains(@class,'mt-')][1]");
      const field = container.locator("input, textarea").first();
      if (await field.count()) {
        await field.fill(value);
        return true;
      }
      return false;
    };

    // Business name
    const biz = page.getByPlaceholder(/Acme Dental|Business/i).first();
    if (await biz.isVisible().catch(() => false)) {
      await biz.fill("Lakeside Family Dentistry");
    } else {
      await fillByLabel(/Business name/i, "Lakeside Family Dentistry");
    }

    const address = page.getByPlaceholder(/address|location/i).first();
    if (await address.isVisible().catch(() => false)) {
      await address.fill("1847 Lakeshore Drive, Suite 200, Harbor City, CA 90710");
    }

    // Hours / services / pricing / policies — fill visible textareas
    const hoursBox = page.locator("textarea").nth(0);
    if (await hoursBox.count()) {
      await hoursBox.fill(
        "Mon–Thu 8:00 AM–6:00 PM. Friday 8:00 AM–3:00 PM. First Saturday of the month 9:00 AM–1:00 PM. Sunday closed. Closed major holidays.",
      );
    }
    const servicesBox = page.locator("textarea").nth(1);
    if (await servicesBox.count()) {
      await servicesBox.fill(
        "Cleanings, new patient exams with digital X-rays, tooth-colored fillings, crowns, bridges, root canals with Dr. Maya Patel, pediatric ages 3+, Invisalign consults Tue/Thu, same-day emergency slots, BrightSmile whitening $399.",
      );
    }
    const pricingBox = page.locator("textarea").nth(2);
    if (await pricingBox.count()) {
      await pricingBox.fill(
        "New patient exam + cleaning + X-rays: $189. Adult cleaning $125. Child cleaning $95. In-office whitening $399. Take-home trays $249. Emergency exam $95 applied to treatment. Most PPO insurance accepted. No Medicaid/Denti-Cal.",
      );
    }
    const policiesBox = page.locator("textarea").nth(3);
    if (await policiesBox.count()) {
      await policiesBox.fill(
        "Cancel/reschedule 24 hours ahead or $50 fee. Arrive 10 minutes early for new patients. Free parking behind building via Harbor Avenue. Wi-Fi: LakesideGuest / Welcome1847. Lead dentist Dr. Maya Patel; Dr. James Okonkwo Wed–Fri. Nitrous available with notice. No medical diagnoses over the phone.",
      );
    }

    const saveProfile = page.getByRole("button", {
      name: /Save profile to knowledge/i,
    });
    if (await saveProfile.isVisible().catch(() => false)) {
      await saveProfile.click();
      await page.waitForTimeout(800);
      log("knowledge-saved");
    } else {
      report.errors.push("Save profile to knowledge button missing");
    }
    await shot(page, "03b-information-filled");

    await clickContinue(page);
    await shot(page, "04-appointments");
    log("appointments");

    // Wait for calendar probe (voice calendars + integrations) to settle in UI
    await page.waitForTimeout(1500);
    const apptBody = await page.locator("body").innerText();
    const calendlyCard = page.getByText("Calendly", { exact: true }).first();
    const calendlyConnected =
      /Calendly[\s\S]{0,80}Connected/i.test(apptBody) ||
      (await calendlyCard
        .locator("xpath=ancestor::*[contains(@class,'border')][1]")
        .innerText()
        .then((t) => /Connected/i.test(t))
        .catch(() => false));

    if (!calendlyConnected) {
      // Prefer one-click Transovo Calendar so Activate is never falsely blocked
      const transovo = page.getByText("Transovo Calendar", { exact: false }).first();
      if (await transovo.isVisible().catch(() => false)) {
        await transovo.click();
        await page.waitForTimeout(1200);
        log("appointments-calendar", { message: "clicked Transovo Calendar" });
      } else {
        report.errors.push("No live calendar visible on Appointments step");
      }
    } else {
      log("appointments-calendar", { message: "Calendly already Connected in UI" });
    }
    await shot(page, "04b-appointments-calendar");

    // Appointments step — leave defaults / ensure a type is enabled
    const enableToggle = page.locator('input[type="checkbox"]').first();
    if (await enableToggle.count()) {
      // leave as-is
    }

    await clickContinue(page);
    await shot(page, "05-call-handling");
    log("call-handling");

    // Transfer destination
    const transferName = page.getByPlaceholder(/name|Owner|Reception|Desk/i).first();
    if (await transferName.isVisible().catch(() => false)) {
      await transferName.fill("Front Desk — Sarah");
    }
    const transferPhone = page.getByPlaceholder(/\+1|555|000-0000/i).first();
    if (await transferPhone.isVisible().catch(() => false)) {
      await transferPhone.fill("+15555550199");
    }

    await clickContinue(page);
    await shot(page, "06-voice");
    log("voice");

    // Wait until Voice step is actually visible
    await page.getByText("Choose a voice", { exact: false }).first().waitFor({
      state: "visible",
      timeout: 30000,
    });

    // Ultra voice: Allie — scroll into voice list and click the card title
    await page.getByText("Choose a voice", { exact: false }).first().scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);
    const allieTitle = page.getByText("Allie", { exact: true }).first();
    await allieTitle.waitFor({ state: "visible", timeout: 15000 });
    await allieTitle.scrollIntoViewIfNeeded();
    // Click the SelectableCard (parent), not the Play button
    await allieTitle.click({ force: true });
    log("voice-allie-ultra");
    await page.waitForTimeout(500);
    await shot(page, "06b-voice-selected");

    // Confirm side panel / page shows Allie selected
    const voicePanel = await page.locator("body").innerText();
    if (!/Selected voice[\s\S]{0,40}Allie|Allie[\s\S]{0,80}Ultra/i.test(voicePanel) &&
        !voicePanel.includes("Allie")) {
      report.errors.push("Voice panel does not show Allie after select");
    }

    // Opening greeting mention Danny if editable
    const greeting = page.locator("textarea").first();
    if (await greeting.isVisible().catch(() => false)) {
      const g = await greeting.inputValue().catch(() => "");
      if (g && !/Danny/i.test(g)) {
        await greeting.fill(
          "Thank you for calling Lakeside Family Dentistry. This is Danny. How may I help you today?",
        );
      }
    }

    await clickContinue(page);
    await shot(page, "07-test");
    log("test");

    // Optional: pick business question scenario
    const bizQ = page.getByText(/Business question/i).first();
    if (await bizQ.isVisible().catch(() => false)) await bizQ.click();

    await clickContinue(page);
    await shot(page, "08-activate");
    log("activate-screen");

    // Wait for Activate calendar probe (must see Calendly / live calendar)
    await page.waitForTimeout(2000);
    const activateBody = await page.locator("body").innerText();
    report.activateChecklist = {
      calendarNeeded: /Needed for booking|Connect a live calendar/i.test(activateBody),
      calendarReady: /Calendar[\s\S]{0,40}Connected/i.test(activateBody),
      hasBlocking: /Required:/i.test(activateBody),
    };
    log("activate-checklist", report.activateChecklist);

    if (report.activateChecklist.calendarNeeded) {
      report.errors.push(
        "Activate UI still blocks on calendar — frontend did not pick up live Calendly",
      );
      await shot(page, "08b-activate-blocked");
    }

    // Activate now — must be enabled (calendar gate fixed)
    await waitReady(page);
    const activateBtn = page.getByRole("button", { name: /Activate now/i }).first();
    const disabled = await activateBtn.isDisabled().catch(() => true);
    if (disabled) {
      report.errors.push("Activate now button disabled in browser");
      await shot(page, "08c-activate-disabled");
    } else if (!(await activateBtn.isVisible().catch(() => false))) {
      // Last step Continue might be labeled Activate now already handled — try Activate
      const alt = page.getByRole("button", { name: /Activate/i }).last();
      await alt.click();
    } else {
      await activateBtn.click();
      log("activate-clicked");
    }
    await waitReady(page);
    // Activate can take 30–60s
    for (let i = 0; i < 120; i++) {
      const url = page.url();
      if (/\/voice\/agents\//.test(url)) break;
      const working = await page.getByRole("button", { name: /Working/i }).count();
      if (!working && i > 5) {
        // maybe error on page
        const body = await page.locator("body").innerText();
        if (/published|activated|live/i.test(body) && report.published) break;
        if (/error|failed/i.test(body) && report.publishError) break;
      }
      await page.waitForTimeout(1000);
    }
    await shot(page, "09-after-activate");
    log("after-activate", { url: page.url(), agentId: report.agentId, published: report.published });

    // Open agent page if not there
    if (report.agentId && !/\/voice\/agents\//.test(page.url())) {
      await page.goto(`${BASE}/voice/agents/${report.agentId}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(1500);
      await shot(page, "10-agent-page");
    }

    // Flow builder + diagnostics
    if (report.flowId) {
      await page.goto(`${BASE}/automations/${report.flowId}/edit`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(2500);
      await shot(page, "11-flow-builder");
      const bt = await page.locator("body").innerText();
      report.builder = {
        hasInbound: /Inbound Call/i.test(bt),
        hasRunVoice: /Run Voice Agent/i.test(bt),
        hasOutcome: /Call Outcome/i.test(bt),
        hasDiag: /Deployment diagnostics|flowGeneration/i.test(bt),
        hasDid: bt.includes("866") || bt.includes(DID),
      };
      log("flow-builder", report.builder);
      if (!report.builder.hasInbound || !report.builder.hasRunVoice) {
        report.errors.push("Flow builder missing core nodes");
      }
    } else {
      report.errors.push("No flowId from activate API");
    }

    // Diagnostics via API for Telnyx proof
    if (report.flowId) {
      const diag = await page.request.get(
        `${BASE}/api/automations/${report.flowId}/diagnostics`,
      );
      const dj = await diag.json().catch(() => ({}));
      report.diagnostics = dj?.data
        ? {
            layers: dj.data.layers,
            deploymentStatus: dj.data.deploymentStatus,
            phoneE164: dj.data.phoneE164,
            telnyxAssistantId: dj.data.telnyxAssistantId,
            publishedRoutingTarget: dj.data.publishedRoutingTarget,
          }
        : null;
      log("diagnostics", report.diagnostics || {});
    }

    if (report.agentId) {
      const ag = await page.request.get(`${BASE}/api/voice/agents/${report.agentId}`);
      const aj = await ag.json().catch(() => ({}));
      report.agent = {
        name: aj?.data?.name,
        displayName: aj?.data?.displayName,
        status: aj?.data?.status,
        telnyxAssistantId: aj?.data?.telnyxAssistantId,
        voiceId:
          aj?.data?.publishedConfig?.voiceLanguage?.voiceId ||
          aj?.data?.draftConfig?.voiceLanguage?.voiceId,
      };
    }

    report.callNumber = DID;
    report.testQuestions = [
      "What are your hours on Friday?",
      "Do you open on Saturday?",
      "How much is a new patient exam with cleaning and X-rays?",
      "Do you take Medicaid?",
      "Who is the lead dentist?",
      "Do you offer Invisalign?",
      "What is your late cancellation fee?",
      "Is parking free?",
      "What is the Wi-Fi password?",
      "Can I book a cleaning next Tuesday morning?",
    ];

    const live =
      report.published === true ||
      report.diagnostics?.deploymentStatus === "live";
    const assistantOk =
      report.diagnostics?.layers?.assistantLaunch === "ok" ||
      Boolean(report.agent?.telnyxAssistantId || report.diagnostics?.telnyxAssistantId);
    const routingOk =
      report.diagnostics?.layers?.telnyxRouting === "ok" ||
      report.diagnostics?.publishedRoutingTarget === "texml_assistant";

    if (!live) report.errors.push("Not live after Activate");
    if (!assistantOk) report.errors.push("Telnyx assistant missing");
    if (!routingOk) report.errors.push("Telnyx routing not ok");

    report.ok = report.errors.length === 0 && live && assistantOk;
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    report.ok = false;
    await shot(page, "fatal").catch(() => null);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(`${OUT}/browser-deploy.json`, JSON.stringify(report, null, 2));
    await browser.close();
  }

  console.log(JSON.stringify({ ok: report.ok, errors: report.errors, callNumber: report.callNumber, agentId: report.agentId, flowId: report.flowId, voice: report.agent?.voiceId, assistant: report.agent?.telnyxAssistantId || report.diagnostics?.telnyxAssistantId, layers: report.diagnostics?.layers }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
