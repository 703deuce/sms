/**
 * Browser E2E: act like a user — create answering + booking agents through
 * every wizard page, save, open flow builder, verify blocks & diagnostics.
 *
 * Usage:
 *   BASE_URL=https://transovo.ai node scripts/wizard-browser-e2e.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import { randomBytes } from "crypto";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts/wizard-qa";
const REPORT = `${OUT_DIR}/browser-e2e.json`;

fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  base: BASE,
  startedAt: new Date().toISOString(),
  ok: false,
  steps: [],
  errors: [],
};

function log(step, detail = {}) {
  const row = { step, at: new Date().toISOString(), ...detail };
  report.steps.push(row);
  console.log(`→ ${step}`, detail.message || detail.url || "");
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) {
    throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
  }
  log("smoke-login", { status: res.status() });
}

async function shot(page, name) {
  const path = `${OUT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function waitReady(page) {
  // Wait out create_draft / save_draft (can take ~8s on production).
  for (let i = 0; i < 60; i++) {
    const working = await page
      .getByRole("button", { name: /Working/i })
      .count();
    if (!working) return;
    await page.waitForTimeout(500);
  }
  throw new Error("Wizard stayed in Working… too long");
}

async function clickContinue(page) {
  await waitReady(page);
  const btn = page.getByRole("button", { name: /^Continue$/i }).first();
  await btn.click();
  await waitReady(page);
  await page.waitForTimeout(400);
}

async function saveDraft(page) {
  await waitReady(page);
  const btn = page.getByRole("button", { name: /^Save draft$/i }).first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await waitReady(page);
    await page.waitForTimeout(800);
  }
}

async function walkWizard(page, { preset, label }) {
  // Isolate drafts so answering/booking runs do not pollute each other.
  await page.goto(`${BASE}/outcomes`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    try {
      localStorage.removeItem("transovo.appointment-receptionist.wizard.v1");
    } catch {
      /* ignore */
    }
  });

  const url =
    preset === null
      ? `${BASE}/solutions/ai-call-handling/appointment-assistant/setup`
      : `${BASE}/solutions/ai-call-handling/appointment-assistant/setup?preset=${preset}`;

  // Capture agentId from create_draft / save_draft API.
  page.on("response", async (res) => {
    try {
      if (!res.url().includes("/api/solutions/appointment-receptionist")) return;
      if (res.request().method() !== "POST") return;
      const json = await res.json().catch(() => null);
      const id = json?.data?.agentId;
      if (id) report[`lastAgentId_${label}`] = id;
      const flow = json?.data?.primaryFlowId;
      if (flow) report[`lastFlowId_${label}`] = flow;
    } catch {
      /* ignore */
    }
  });

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, `${label}-00-goals`);

  const bodyText = await page.locator("body").innerText();
  const hasBookingCard = /Book new appointments/i.test(bodyText);
  const expectBooking = preset === null;
  if (expectBooking !== hasBookingCard) {
    report.errors.push({
      label,
      issue: `booking capability card visible=${hasBookingCard}, expected=${expectBooking}`,
    });
  }
  log(`${label}:goals`, {
    message: `bookingCard=${hasBookingCard} title=${/Create Appointment Receptionist|Create AI Answering/i.exec(bodyText)?.[0]}`,
    url: page.url(),
  });

  // Goals — name the agent uniquely
  const nameInput = page.locator("#solution-name, input[placeholder*='Front Desk']").first();
  if (await nameInput.count()) {
    const unique = `${label} ${randomBytes(2).toString("hex")} ${new Date()
      .toISOString()
      .slice(11, 16)}`;
    await nameInput.fill(unique);
  }

  // Toggle a capability that should exist
  const answerQ = page.getByText("Answer common questions", { exact: false }).first();
  if (await answerQ.isVisible().catch(() => false)) {
    await answerQ.click();
    await page.waitForTimeout(200);
    await answerQ.click(); // ensure selected
  }

  await clickContinue(page);
  await shot(page, `${label}-01-phone`);
  log(`${label}:phone`, { url: page.url() });

  // Phone — pick existing number if select exists
  const phoneSelect = page.locator("select").first();
  if (await phoneSelect.count()) {
    const options = await phoneSelect.locator("option").allTextContents();
    if (options.length > 1) {
      await phoneSelect.selectOption({ index: 1 });
    }
  }
  // Try play greeting if present
  const play = page.getByRole("button", { name: /Play|Preview/i }).first();
  if (await play.isVisible().catch(() => false)) {
    await play.click().catch(() => null);
  }

  await clickContinue(page);
  await shot(page, `${label}-02-information`);
  log(`${label}:information`, { url: page.url() });

  // Information — guided profile
  const guided = page.getByText(/guided business profile/i).first();
  if (await guided.isVisible().catch(() => false)) {
    await guided.click();
    await page.waitForTimeout(400);
    const biz = page.getByPlaceholder(/Acme Dental|Business/i).first();
    if (await biz.isVisible().catch(() => false)) {
      await biz.fill("Acme Browser Dental");
    }
    const hours = page.getByPlaceholder(/Mon|hours|9/i).first();
    if (await hours.isVisible().catch(() => false)) {
      await hours.fill("Mon-Fri 9am-5pm");
    }
    const saveProfile = page.getByRole("button", {
      name: /Save profile to knowledge/i,
    });
    if (await saveProfile.isVisible().catch(() => false)) {
      await saveProfile.click();
      await page.waitForTimeout(500);
    }
  }

  // Upload path exists
  const uploadCard = page.getByText(/Upload documents/i).first();
  if (await uploadCard.isVisible().catch(() => false)) {
    await uploadCard.click();
    await page.waitForTimeout(300);
    const uploadBtn = page.getByText(/Upload knowledge files/i).first();
    if (!(await uploadBtn.isVisible().catch(() => false))) {
      report.errors.push({ label, issue: "Upload documents UI missing click target" });
    }
  }

  await clickContinue(page);
  await page.waitForTimeout(1000);

  // Appointments (booking only) — detect by stepper / headline, not loose "Calendar" text.
  const stepper = await page.locator("body").innerText();
  const onAppointments =
    /Appointments/i.test(stepper) &&
    (/appointment type|Booking hours|What can callers book/i.test(stepper) ||
      page.url().includes("setup"));
  const appointmentsHeadline = await page
    .getByRole("heading", { name: /appointment|book/i })
    .count();
  if (expectBooking) {
    if (!appointmentsHeadline && !/Booking hours|appointment type/i.test(stepper)) {
      report.errors.push({ label, issue: "Expected Appointments step for booking wizard" });
    } else {
      await shot(page, `${label}-03-appointments`);
      log(`${label}:appointments`);
      await clickContinue(page);
    }
  } else if (/Booking hours|appointment type|What can callers book/i.test(stepper)) {
    report.errors.push({
      label,
      issue: "Appointments step shown for non-booking agent",
    });
  }

  await shot(page, `${label}-04-call-handling`);
  log(`${label}:call-handling`);

  // Transfer destination
  const transferPhone = page.getByPlaceholder(/\+1|555|000-0000/i).first();
  if (await transferPhone.isVisible().catch(() => false)) {
    await transferPhone.fill("+15555550123");
  }
  const transferName = page.getByPlaceholder(/name|Owner|Reception/i).first();
  if (await transferName.isVisible().catch(() => false)) {
    await transferName.fill("Front Desk");
  }

  await clickContinue(page);
  await shot(page, `${label}-05-voice`);
  log(`${label}:voice`);

  // Pick a voice card
  const voiceCard = page.getByText(/Astra|Allie|Luna/i).first();
  if (await voiceCard.isVisible().catch(() => false)) {
    await voiceCard.click();
  }

  await clickContinue(page);
  await shot(page, `${label}-06-test`);
  log(`${label}:test`);

  // Ensure booking scenario NOT present for answering
  const testBody = await page.locator("body").innerText();
  if (!expectBooking && /Appointment booking/i.test(testBody)) {
    report.errors.push({
      label,
      issue: "Appointment booking test scenario shown for answering agent",
    });
  }

  await clickContinue(page);
  await shot(page, `${label}-07-activate`);
  log(`${label}:activate`);

  await saveDraft(page);
  await page.waitForTimeout(2000);

  // Capture agent id from URL after save/activate navigation or stay
  let agentId = report[`lastAgentId_${label}`] || null;
  const current = page.url();
  const m = current.match(/\/voice\/agents\/([^/?#]+)/);
  if (m) agentId = m[1];

  // If still on wizard, try Activate now (may fail without number — capture)
  if (!agentId) {
    const activate = page.getByRole("button", { name: /Activate now/i }).first();
    if (await activate.isVisible().catch(() => false)) {
      await activate.click();
      await waitReady(page);
      await page.waitForTimeout(2000);
      await shot(page, `${label}-08-after-activate`);
      const after = page.url();
      const m2 = after.match(/\/voice\/agents\/([^/?#]+)/);
      if (m2) agentId = m2[1];
      agentId = agentId || report[`lastAgentId_${label}`] || null;
      log(`${label}:activate-click`, { url: after, agentId });
    }
  }

  return {
    agentId,
    flowId: report[`lastFlowId_${label}`] || null,
    url: page.url(),
  };
}

async function openAutomationsAndBuilder(page, preferredFlowId) {
  if (preferredFlowId) {
    await page.goto(`${BASE}/automations/${preferredFlowId}/edit`, {
      waitUntil: "domcontentloaded",
    });
  } else {
    await page.goto(`${BASE}/automations`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await shot(page, "automations-list");
    const listText = await page.locator("body").innerText();
    const hasUntitled = /Untitled automation/i.test(listText);
    log("automations-list", { hasUntitled, message: listText.slice(0, 200) });

    const editLink = page.locator('a[href*="/automations/"][href$="/edit"]').first();
    if (await editLink.count()) {
      await editLink.click();
    } else {
      await page.goto(`${BASE}/automations/new`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);
    }
  }

  await page.waitForTimeout(2000);
  await shot(page, "flow-builder");
  const builderText = await page.locator("body").innerText();
  const hasInbound = /Inbound Call/i.test(builderText);
  const hasRunVoice = /Run Voice Agent/i.test(builderText);
  const hasOutcome = /Call Outcome/i.test(builderText);
  const hasDiag = /Deployment diagnostics|Failure layer|flowGeneration/i.test(
    builderText,
  );
  const hasSearch = await page.locator("#block-search, input[placeholder*='Search']").count();
  log("flow-builder", {
    hasInbound,
    hasRunVoice,
    hasOutcome,
    hasDiag,
    hasSearch: Boolean(hasSearch),
    url: page.url(),
  });
  if (!hasInbound || !hasRunVoice || !hasOutcome) {
    report.errors.push({
      issue: `Builder missing nodes inbound=${hasInbound} voice=${hasRunVoice} outcome=${hasOutcome}`,
    });
  }
  if (!hasDiag) {
    report.errors.push({ issue: "Deployment diagnostics not at top of builder" });
  }

  if (hasSearch) {
    const search = page.locator("#block-search, input[placeholder*='Search']").first();
    await search.fill("inbound");
    await page.waitForTimeout(500);
    await shot(page, "flow-builder-search-inbound");
    const after = await page.locator("body").innerText();
    if (!/Inbound Call/i.test(after)) {
      report.errors.push({ issue: "Search for inbound did not show Inbound Call block" });
    }
    await search.fill("call outcome");
    await page.waitForTimeout(500);
    await shot(page, "flow-builder-search-outcome");
    await search.fill("run voice");
    await page.waitForTimeout(500);
    await shot(page, "flow-builder-search-voice");
  }

  await page.goto(`${BASE}/systems`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await shot(page, "my-agents");
  const nav = await page.locator("nav, aside").first().innerText().catch(() => "");
  const agentsIdx = nav.indexOf("My Agents");
  const autoIdx = nav.indexOf("Automations");
  const numbersIdx = nav.indexOf("My Numbers");
  if (agentsIdx >= 0 && autoIdx >= 0 && numbersIdx >= 0) {
    if (!(agentsIdx < autoIdx && autoIdx < numbersIdx)) {
      report.errors.push({
        issue: `Nav order wrong: Agents@${agentsIdx} Automations@${autoIdx} Numbers@${numbersIdx}`,
      });
    } else {
      log("nav-order", { message: "My Agents → Automations → My Numbers" });
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME || "/usr/local/bin/google-chrome",
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  try {
    await smokeLogin(page);

    // Wait until deploy has our answering preset copy
    let deployReady = false;
    for (let i = 0; i < 40; i++) {
      await page.goto(
        `${BASE}/solutions/ai-call-handling/appointment-assistant/setup?preset=every_call`,
        { waitUntil: "domcontentloaded", timeout: 60000 },
      );
      await page.waitForTimeout(1200);
      const t = await page.locator("body").innerText();
      const answeringTitle = /Create AI Answering Agent/i.test(t);
      const noBook = !/Book new appointments/i.test(t);
      log("deploy-probe", {
        message: `try=${i + 1} answeringTitle=${answeringTitle} noBook=${noBook}`,
      });
      if (answeringTitle && noBook) {
        deployReady = true;
        break;
      }
      // Still login-walled?
      if (/Sign in|Log in|Create account/i.test(t) && !/What should this agent do/i.test(t)) {
        await smokeLogin(page);
      }
      await page.waitForTimeout(15000);
    }
    report.deployReady = deployReady;
    if (!deployReady) {
      report.errors.push({
        issue: "Deploy not ready: answering wizard still shows booking caps or old title",
      });
    }

    const answering = await walkWizard(page, {
      preset: "every_call",
      label: "answering",
    });
    report.answering = answering;

    const booking = await walkWizard(page, {
      preset: null,
      label: "booking",
    });
    report.booking = booking;

    // Prefer flow from API-created agent if wizard UI didn't navigate.
    let flowId = null;
    const flowsRes = await page.request.get(`${BASE}/api/automations`);
    const flowsJson = await flowsRes.json().catch(() => ({}));
    const flows = flowsJson?.data || [];
    if (answering.agentId) {
      flowId =
        flows.find((f) => f.ownerAgentId === answering.agentId)?.id || null;
    }
    if (!flowId && flows[0]?.id) flowId = flows[0].id;
    report.flowId = flowId;

    await openAutomationsAndBuilder(page, flowId);

    report.ok = report.errors.length === 0;
  } catch (err) {
    report.errors.push({ issue: err instanceof Error ? err.message : String(err) });
    report.ok = false;
    await shot(page, "fatal-error").catch(() => null);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
    await browser.close();
  }

  console.log(JSON.stringify({ ok: report.ok, errors: report.errors }, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
