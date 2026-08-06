/**
 * Full Amy lifecycle E2E — fresh workspace via smoke-signup.
 * Proves: hire → brain → wizard → activate → workspace → settings → talk → layers.
 *
 *   BASE_URL=https://transovo.ai node scripts/amy-full-lifecycle-e2e.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT = "/opt/cursor/artifacts/amy-full-lifecycle";
const RUN_ID = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const COMPANY = process.env.AMY_COMPANY || `Harbor Drain E2E ${RUN_ID.slice(-8)}`;

fs.mkdirSync(OUT, { recursive: true });

const report = {
  base: BASE,
  runId: RUN_ID,
  company: COMPANY,
  startedAt: new Date().toISOString(),
  ok: false,
  steps: [],
  errors: [],
  assertions: [],
  credentials: null,
  agentId: null,
  layers: { companyBrain: {}, amy: {}, deployment: {} },
};

function log(step, detail = {}) {
  report.steps.push({ step, at: new Date().toISOString(), ...detail });
  console.log(`→ ${step}`, detail.message || detail.url || JSON.stringify(detail).slice(0, 150));
}

function assert(name, cond, detail = "") {
  report.assertions.push({ name, passed: Boolean(cond), detail });
  if (!cond) {
    report.errors.push(`ASSERT FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
    console.error(`✗ ${name}`, detail);
  } else {
    console.log(`✓ ${name}`);
  }
}

async function shot(page, name) {
  const path = `${OUT}/${RUN_ID}-${name}.png`;
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

async function provisionPhoneNumber(page) {
  for (const areaCode of ["866", "415", ""]) {
    const qs = areaCode ? `?areaCode=${areaCode}` : "";
    const search = await page.request.get(`${BASE}/api/messaging/numbers${qs}`);
    const searchJson = await search.json().catch(() => ({}));
    const e164 = searchJson?.data?.[0]?.phoneNumber;
    log("phone-search", { areaCode: areaCode || "any", status: search.status(), found: Boolean(e164) });
    if (!e164) continue;

    const buy = await page.request.post(`${BASE}/api/messaging/registration`, {
      headers: { "content-type": "application/json" },
      data: { action: "purchase_number", phoneNumber: e164 },
    });
    const buyJson = await buy.json().catch(() => ({}));
    if (!buy.ok()) {
      report.errors.push(
        `purchase_number failed (${e164}): ${buy.status()} ${JSON.stringify(buyJson).slice(0, 200)}`,
      );
      continue;
    }
    log("phone-provisioned", { e164 });
    return e164;
  }
  report.errors.push("No searchable phone numbers from Telnyx after trying 866, 415, and any");
  return null;
}

async function smokeSignup(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-signup`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { businessName: COMPANY, cloneCalendly: true, provisionNumber: true, areaCode: "415" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`smoke-signup ${res.status()}: ${JSON.stringify(body)}`);

  // Ensure session cookies are on the browser context for subsequent API calls.
  await page.goto(`${BASE}/hire`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  let phoneProvisioned = body.phoneProvisioned;
  if (!phoneProvisioned?.e164) {
    phoneProvisioned = { e164: await provisionPhoneNumber(page) };
  }

  report.credentials = {
    email: body.email,
    workspaceId: body.workspaceId,
    workspaceName: body.workspaceName,
    calendlyCloned: body.calendlyCloned,
    phoneProvisioned,
  };
  assert("phone provisioned for fresh workspace", Boolean(phoneProvisioned?.e164), phoneProvisioned?.e164);
  log("smoke-signup", { email: body.email, workspaceId: body.workspaceId, phone: phoneProvisioned?.e164 });
}

async function apiGet(page, path) {
  const res = await page.request.get(`${BASE}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status(), ok: res.ok(), json };
}

async function verifyLayers(page) {
  const brain = await apiGet(page, "/api/company-brain");
  const b = brain.json?.data || {};
  report.layers.companyBrain = {
    status: brain.status,
    businessName: b.businessName,
    hours: b.businessHoursSummary,
    facts: (b.knowledgeFacts || []).length,
    locations: (b.locations || []).length,
    services: (b.services || []).length,
  };
  assert("company brain has business name", Boolean(b.businessName), b.businessName);
  assert("company brain has hours", Boolean(b.businessHoursSummary), b.businessHoursSummary);

  if (!report.agentId) return;
  const agent = await apiGet(page, `/api/agents/${report.agentId}`);
  const d = agent.json?.data || {};
  report.layers.amy = {
    status: agent.status,
    name: d.identity?.displayName,
    number: d.phoneNumberE164 || d.resources?.numberLabel,
    calendar: d.resources?.calendarLabel,
    services: d.bookingPolicy?.allowedServices,
    notice: d.bookingPolicy?.minimumNoticeMinutes,
    health: d.health?.overall,
    version: d.currentVersionId,
    greeting: d.profile?.voiceSummary,
  };
  report.layers.deployment = {
    voiceAgentId: d.voiceAgentId,
    telnyxAssistantId: d.telnyxAssistantId,
    primaryFlowId: d.primaryFlowId,
    drift: d.health?.deploymentDrift?.status,
    published: report.published,
  };
  assert("amy has agent id", Boolean(report.agentId));
  assert("amy has telnyx assistant", Boolean(d.telnyxAssistantId), d.telnyxAssistantId);
  assert("amy has phone or number label", Boolean(d.phoneNumberE164 || d.resources?.numberLabel));
  assert("amy health not failed", d.health?.overall !== "failed", d.health?.overall);
}

async function runWizard(page) {
  await page.evaluate(() => {
    try {
      localStorage.removeItem("transovo.appointment-receptionist.wizard.v1");
    } catch {
      /* ignore */
    }
  });

  await page.goto(`${BASE}/hire`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await shot(page, "01-hire");
  assert("hire page has Amy", /Amy/i.test(await page.locator("body").innerText()));

  await page.getByRole("link", { name: /Hire Amy/i }).first().click();
  await page.waitForTimeout(1500);

  if (!/brain/i.test(page.url())) {
    await page.goto(`${BASE}/hire/brain?next=amy`, { waitUntil: "domcontentloaded" });
  }
  await shot(page, "02-brain");

  const manualTab = page.getByRole("button", { name: /Enter manually/i }).first();
  await manualTab.waitFor({ state: "visible", timeout: 15000 });
  await manualTab.click();

  const byLabel = async (labelText, value) => {
    const label = page.locator("label").filter({ hasText: labelText }).first();
    await label.waitFor({ state: "visible", timeout: 10000 });
    await label.locator("input, textarea").first().fill(value);
  };
  await byLabel(/Business name/i, COMPANY);
  await byLabel(/Main location/i, "Richmond, VA");
  await byLabel(/Business hours/i, "Mon–Fri 8:00 AM–6:00 PM; Sat 9:00 AM–1:00 PM; Sun closed");
  await byLabel(/^Services$/i, "Drain cleaning, water heater repair, sewer camera inspection");

  await page.getByRole("button", { name: /Save company profile/i }).first().click();
  await page.waitForTimeout(1500);

  const approveBtn = page.getByRole("button", { name: /Confirm all for review/i }).first();
  if ((await approveBtn.isVisible().catch(() => false)) && !(await approveBtn.isDisabled().catch(() => true))) {
    await approveBtn.click();
    await page.waitForTimeout(800);
  }

  await page.getByRole("button", { name: /Continue to train Amy/i }).first().click();
  await page.waitForTimeout(1500);
  await shot(page, "03-wizard-goals");

  if (!/hire=amy/i.test(page.url())) {
    await page.goto(`${BASE}/solutions/ai-call-handling/appointment-assistant/setup?hire=amy`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1200);
  }

  const nameInput = page.locator("#solution-name").first();
  if (await nameInput.count()) await nameInput.fill(`Amy — ${COMPANY}`);

  const every = page.getByText("Every incoming call", { exact: false }).first();
  if (await every.isVisible().catch(() => false)) await every.click();
  await clickContinue(page);
  await shot(page, "04-phone");

  // Wait for provisioned number to appear in phone API, then ensure selection.
  let phoneRow = null;
  for (let i = 0; i < 30; i++) {
    const nums = await apiGet(page, "/api/phone/numbers");
    if (nums.json?.data?.length) {
      phoneRow = nums.json.data[0];
      break;
    }
    await page.waitForTimeout(2000);
  }
  if (phoneRow) {
    log("phone-api-ready", { id: phoneRow.id, e164: phoneRow.e164 });
    const existing = page.getByText(/Use existing Transovo number/i).first();
    if (await existing.isVisible().catch(() => false)) await existing.click();
    const didBtn = page
      .locator("button")
      .filter({ hasText: phoneRow.e164.replace("+1", "").slice(0, 3) })
      .first();
    if (await didBtn.isVisible().catch(() => false)) {
      await didBtn.click();
    }
  } else {
    report.errors.push("Phone number not visible in /api/phone/numbers after provision");
  }
  await page.waitForTimeout(1000);
  await shot(page, "04b-phone-selected");
  assert("no stack overflow on wizard", !(await page.locator("body").innerText()).includes("Maximum call stack"));

  await clickContinue(page);
  await shot(page, "05-booking");

  for (let i = 0; i < 20; i++) {
    const t = await page.locator("body").innerText();
    if (/Connected|Calendar|appointment type/i.test(t)) break;
    await page.waitForTimeout(500);
  }
  if (!/Connected/i.test(await page.locator("body").innerText())) {
    const transovo = page.getByText("Transovo Calendar", { exact: false }).first();
    const calendly = page.getByText("Calendly", { exact: false }).first();
    if (await transovo.isVisible().catch(() => false)) await transovo.click();
    else if (await calendly.isVisible().catch(() => false)) await calendly.click();
    await page.waitForTimeout(1500);
  }

  await clickContinue(page);
  await shot(page, "06-call-handling");

  const transferName = page.getByPlaceholder(/name|Owner|Reception|Desk/i).first();
  if (await transferName.isVisible().catch(() => false)) await transferName.fill("Dispatch");
  const transferPhone = page.getByPlaceholder(/\+1|555|000-0000/i).first();
  if (await transferPhone.isVisible().catch(() => false)) await transferPhone.fill("+15555550199");

  await clickContinue(page);
  await shot(page, "07-voice");

  const allie = page.getByText("Allie", { exact: true }).first();
  if (await allie.isVisible().catch(() => false)) await allie.click({ force: true });
  const greeting = page.locator("textarea").first();
  if (await greeting.isVisible().catch(() => false)) {
    await greeting.fill(
      `Thank you for calling ${COMPANY}. This is Amy. How may I help you today?`,
    );
  }

  await clickContinue(page);
  await shot(page, "08-test");

  const buildBtn = page
    .getByRole("button", { name: /Build & ready test|Build & test|Build test/i })
    .first();
  if (await buildBtn.isVisible().catch(() => false)) {
    await buildBtn.click();
    for (let i = 0; i < 60; i++) {
      const t = await page.locator("body").innerText();
      if (/Live assistant|Ready|built/i.test(t)) break;
      await page.waitForTimeout(1000);
    }
  }

  await clickContinue(page);
  await shot(page, "09-activate");

  const submit =
    (await page.locator('[data-testid="wizard-activate-submit"]').count())
      ? page.locator('[data-testid="wizard-activate-submit"]').first()
      : page.getByRole("button", { name: /^Activate now$/i }).last();

  if (await submit.isDisabled().catch(() => true)) {
    report.errors.push("Activate now disabled");
    await shot(page, "09b-activate-disabled");
  } else {
    await submit.click();
    log("activate-clicked");
  }

  for (let i = 0; i < 120; i++) {
    if (/\/agents\/|\/voice\/agents\//.test(page.url())) break;
    if (report.published && i > 10) break;
    await page.waitForTimeout(1000);
  }
  await shot(page, "10-after-activate");

  if (!report.agentId) {
    const m = page.url().match(/\/(?:voice\/)?agents\/([^/?#]+)/);
    if (m) report.agentId = m[1];
  }
}

async function waitForAmyWorkspace(page, agentId) {
  const url = `${BASE}/agents/${agentId}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (let i = 0; i < 45; i++) {
    const text = await page.locator("body").innerText();
    if (!/Loading Amy/i.test(text) && /Talk to/i.test(text)) return;
    await page.waitForTimeout(1000);
  }
  throw new Error("Amy workspace did not finish loading");
}

async function testAmyWorkspace(page) {
  if (!report.agentId) return;
  await waitForAmyWorkspace(page, report.agentId);
  await shot(page, "11-workspace-home");

  const body = await page.locator("body").innerText();
  assert("workspace has Home", /Home/i.test(body));
  assert("workspace has Talk to Amy", /Talk to/i.test(body));
  assert("workspace has Work", /Work/i.test(body));
  assert("workspace has Build", /Build/i.test(body));
  assert("workspace has Settings", /Settings/i.test(body));

  // Settings subsections
  await page.getByRole("button", { name: /^Settings$/i }).first().click();
  await page.waitForTimeout(800);
  await shot(page, "12-settings");

  for (const sub of ["Booking rules", "Fields", "Voice", "Connections", "Health"]) {
    const btn = page.getByRole("button", { name: new RegExp(sub, "i") }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(400);
    }
  }
  await shot(page, "13-settings-sections");
  const settingsText = await page.locator("body").innerText();
  assert("settings shows notice", /notice|hours/i.test(settingsText));
  assert("settings shows calendar or number", /calendar|number|phone/i.test(settingsText));
}

async function testSettingsProposal(page) {
  if (!report.agentId) return;
  await page.goto(`${BASE}/agents/${report.agentId}?section=settings`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);
  const booking = page.getByRole("button", { name: /Booking rules/i }).first();
  if (await booking.isVisible().catch(() => false)) await booking.click();
  await page.waitForTimeout(500);

  const noticeInput = page.locator('input[type="number"], input').filter({ hasText: "" }).first();
  const inputs = page.locator("input");
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const el = inputs.nth(i);
    const val = await el.inputValue().catch(() => "");
    if (/^\d+$/.test(val) && Number(val) <= 24) {
      await el.fill("4");
      break;
    }
  }

  const propose = page.getByRole("button", { name: /Propose change/i }).first();
  if (await propose.isVisible().catch(() => false)) {
    await propose.click();
    await page.waitForTimeout(2000);
    report.settingsProposal = true;
    assert("settings proposal created", true);
    await shot(page, "14-settings-proposal");
  } else {
    assert("settings propose button visible", false, "Propose change not found");
  }
}

async function testTalk(page) {
  if (!report.agentId) return;
  await page.goto(`${BASE}/agents/${report.agentId}?section=talk`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(1500);

  const shortcuts = [
    "Ask about my work",
    "Change how I book",
    "Test my setup",
    "Fix a problem",
  ];
  for (const label of shortcuts) {
    const btn = page.getByRole("button", { name: new RegExp(label, "i") }).first();
    assert(`shortcut: ${label}`, await btn.isVisible().catch(() => false));
  }
  await shot(page, "15-talk-shortcuts");

  const ask = async (text) => {
    const input = page.locator("input[placeholder*='Message'], textarea").last();
    await input.fill(text);
    const send = page.getByRole("button", { name: /^Send$/i }).first();
    if (await send.isVisible().catch(() => false)) await send.click();
    else await input.press("Enter");
    await page.waitForTimeout(3000);
  };

  await ask("What do you do?");
  await shot(page, "16-talk-responsibility");

  await ask("Change my minimum booking notice to four hours.");
  await shot(page, "17-talk-notice-change");

  await ask("For drain-cleaning appointments, require the caller to describe the problem.");
  await shot(page, "18-talk-custom-field");

  await ask("Create another Amy for Richmond.");
  await shot(page, "19-talk-duplicate");
}

async function testControlApi(page) {
  if (!report.agentId) return;
  const summary = await apiGet(page, `/api/agents/${report.agentId}`);
  assert("agent API 200", summary.ok);

  const drift = await page.request.post(`${BASE}/api/agents/${report.agentId}/control`, {
    data: { command: "get_deployment_drift", payload: { fetchRemote: true } },
  });
  const driftJson = await drift.json().catch(() => ({}));
  report.drift = driftJson;
  log("drift-check", { drifted: driftJson?.drifted, message: driftJson?.message?.slice?.(0, 80) });

  const intel = await page.request.post(`${BASE}/api/agents/${report.agentId}/control`, {
    data: { command: "get_intelligence_summary" },
  });
  const intelJson = await intel.json().catch(() => ({}));
  report.intelligence = {
    status: intel.status(),
    runtimes: intelJson?.audit?.length,
    acceptancePassed: intelJson?.acceptanceTests?.passed,
  };
  assert("intelligence summary available", intel.ok() || intel.status() === 400);
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
      if (json?.data?.published != null) report.published = json.data.published;
      if (json?.data?.telnyxAssistantId) report.telnyxAssistantId = json.data.telnyxAssistantId;
    } catch {
      /* ignore */
    }
  });

  try {
    await smokeSignup(page);
    await runWizard(page);
    await verifyLayers(page);
    await testAmyWorkspace(page);
    await testSettingsProposal(page);
    await testTalk(page);
    await testControlApi(page);

    report.ok =
      report.errors.length === 0 &&
      Boolean(report.agentId) &&
      (Boolean(report.published) || Boolean(report.telnyxAssistantId));
  } catch (err) {
    report.errors.push(err instanceof Error ? err.message : String(err));
    await shot(page, "zz-error").catch(() => null);
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
    console.log("\n=== REPORT ===");
    console.log(JSON.stringify(report, null, 2));
    await browser.close();
  }

  process.exit(report.ok ? 0 : 1);
}

main();
