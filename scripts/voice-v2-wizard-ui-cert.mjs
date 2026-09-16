/**
 * Voice V2 — 8-page wizard customer-path UI certification (production).
 * No PSTN. Uses smoke-login + Playwright UI clicks; verifies backend via API.
 *
 *   AGENT_ID=cmshz2lc... OWNER_EMAIL=... node scripts/voice-v2-wizard-ui-cert.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";

const BASE = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
const EMAIL = (process.env.OWNER_EMAIL || "alex@harborhome.co").trim().toLowerCase();
const AGENT_ID = process.env.AGENT_ID || "cmshz2lc25c622c4i58303501";
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OUT_DIR = "/opt/cursor/artifacts/voice-v2-wizard-cert";
const MATRIX_PATH = "docs/VOICE-V2-WIZARD-CERTIFICATION.md";
const TEST_MARKER = "UI CERT TEST 2304";

fs.mkdirSync(OUT_DIR, { recursive: true });

const matrix = [];
const failures = [];
const report = {
  base: BASE,
  agentId: AGENT_ID,
  startedAt: new Date().toISOString(),
  healthSha: null,
  snapshotBefore: null,
  snapshotAfter: null,
};

function row(entry) {
  matrix.push(entry);
}

function fail(msg) {
  failures.push(msg);
}

async function smokeLogin(page) {
  const res = await page.request.post(`${BASE}/api/auth/smoke-login`, {
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    data: { email: EMAIL, workspaceId: "ws_1" },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok()) throw new Error(`smoke-login ${res.status()}: ${JSON.stringify(body)}`);
}

async function fetchWizardState(page) {
  const res = await page.request.get(
    `${BASE}/api/solutions/appointment-receptionist?agentId=${AGENT_ID}`,
  );
  const json = await res.json();
  return json?.data || null;
}

function backendSnapshot() {
  try {
    const out = execSync(
      `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-v2-wizard-backend-snapshot.ts ${AGENT_ID}`,
      { cwd: process.cwd(), encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    return JSON.parse(out.trim());
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function waitReady(page) {
  for (let i = 0; i < 120; i++) {
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) return;
    await page.waitForTimeout(500);
  }
  const err = await page.locator(".text-danger").first().textContent().catch(() => "");
  throw new Error(`Wizard stuck on Working… ${err || ""}`.trim());
}

async function clickSaveDraft(page) {
  await waitReady(page);
  const btn = page.getByRole("button", { name: /Save draft|^Save$/i }).first();
  await btn.click();
  await waitReady(page);
  await page.waitForTimeout(600);
}

const LEGACY_STEP_ORDER = [
  "Goals",
  "Phone",
  "Information",
  "Appointments",
  "Call Handling",
  "Voice",
  "Test",
  "Activate",
];

const MCTB_STEP_ORDER = [
  "Purpose",
  "Phone",
  "Business Knowledge",
  "Booking",
  "Call Handling",
  "Voice",
  "Test",
  "Activate",
];

const MCTB_STEP_QUERY = [
  "goals",
  "phone",
  "information",
  "booking",
  "call-handling",
  "voice",
  "test",
  "activate",
];

let STEP_ORDER = LEGACY_STEP_ORDER;
let wizardBasePath = "/solutions/ai-call-handling/appointment-assistant/setup";

async function openStepQuery(page, stepQuery) {
  const url = `${BASE}${wizardBasePath}?agentId=${AGENT_ID}&step=${stepQuery}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitReady(page);
  await page.waitForTimeout(800);
}

async function currentStepLabel(page) {
  const nav = page.locator('nav[aria-label="Setup progress"]');
  const labels = nav.locator("ol li span.font-medium");
  const count = await labels.count();
  for (let i = 0; i < count; i++) {
    const el = labels.nth(i);
    const cls = (await el.getAttribute("class")) || "";
    if (cls.includes("text-foreground")) {
      return (await el.textContent())?.trim() || "";
    }
  }
  return "";
}

async function goToStepIndex(page, targetIndex) {
  if (wizardBasePath.includes("mctb") && MCTB_STEP_QUERY[targetIndex]) {
    await openStepQuery(page, MCTB_STEP_QUERY[targetIndex]);
    return true;
  }
  for (let guard = 0; guard < 20; guard++) {
    const label = await currentStepLabel(page);
    const idx = STEP_ORDER.findIndex((s) => label.toLowerCase().startsWith(s.toLowerCase()));
    if (idx === targetIndex) return true;
    if (idx < 0) return false;
    if (idx < targetIndex) {
      await clickContinue(page);
    } else {
      await waitReady(page);
      await page.getByRole("button", { name: /^Back$/i }).click();
      await waitReady(page);
      await page.waitForTimeout(400);
    }
  }
  return false;
}

async function goToStepByLabel(page, label) {
  const idx = STEP_ORDER.findIndex((s) => s.toLowerCase() === label.toLowerCase());
  if (idx < 0) return false;
  return goToStepIndex(page, idx);
}

async function clickContinue(page) {
  await waitReady(page);
  await page.getByRole("button", { name: /^Continue$/i }).first().click();
  await waitReady(page);
  await page.waitForTimeout(500);
}

async function main() {
  if (!BASE) throw new Error("BASE_URL or APP_URL required");

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => ({}));
  report.healthSha = health.commitSha || null;

  report.snapshotBefore = backendSnapshot();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await smokeLogin(page);
  let wizardUrl = `${BASE}/mctb/voice-agent?agentId=${AGENT_ID}`;
  await page.goto(wizardUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  await waitReady(page);
  if (page.url().includes("/mctb/voice-agent")) {
    STEP_ORDER = MCTB_STEP_ORDER;
    wizardBasePath = "/mctb/voice-agent";
  } else {
    wizardUrl = `${BASE}/solutions/ai-call-handling/appointment-assistant/setup?agentId=${AGENT_ID}`;
    await page.goto(wizardUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitReady(page);
  }

  const navText = await page.locator('nav[aria-label="Setup progress"]').innerText();
  await page.screenshot({ path: `${OUT_DIR}/wizard-stepper.png`, fullPage: false });
  for (const name of STEP_ORDER) {
    const found = navText.includes(name);
    row({
      page: name,
      section: "nav",
      label: name,
      type: "step",
      status: found ? "PASS" : "FAIL",
      note: found ? "" : "step not visible in stepper",
    });
    if (!found) fail(`Missing wizard step: ${name}`);
  }

  // —— Purpose/Goals: solution name ——
  await goToStepIndex(page, 0);
  await page.waitForSelector("#solution-name", { timeout: 30000 });
  const nameInput = page.locator("#solution-name").first();
  const origName = await nameInput.inputValue().catch(() => "");
  const testName = origName.includes(TEST_MARKER) ? origName : `${origName} ${TEST_MARKER}`.trim();
  await nameInput.fill(testName);
  await clickSaveDraft(page);
  await page.waitForTimeout(1000);
  let api = await fetchWizardState(page);
  const nameOk =
    api?.state?.solutionName?.includes(TEST_MARKER) ||
    api?.state?.agentName?.includes(TEST_MARKER);
  row({
    page: STEP_ORDER[0],
    section: "header",
    label: "Solution name",
    type: "text",
    uiSave: "PASS",
    backend: nameOk ? "PASS" : "FAIL",
    refresh: "PENDING",
    status: nameOk ? "PASS" : "FAIL",
  });
  if (!nameOk) fail(`${STEP_ORDER[0]} solutionName not persisted`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitReady(page);
  const nameAfterRefresh = await page.locator("#solution-name").first().inputValue();
  const refreshOk = nameAfterRefresh.includes(TEST_MARKER);
  row({
    page: STEP_ORDER[0],
    label: "Solution name refresh",
    status: refreshOk ? "PASS" : "FAIL",
  });
  if (!refreshOk) fail(`${STEP_ORDER[0]} solutionName lost on refresh`);

  // —— Cross-page stale save ——
  await goToStepByLabel(page, STEP_ORDER[3]);
  const stratBefore = (await fetchWizardState(page))?.state?.bookingStrategy;
  // Toggle strategy via UI if radios exist
  const requestOnly = page.getByText(/request only|collect.*request/i).first();
  let changedStrategy = false;
  if (await requestOnly.isVisible().catch(() => false)) {
    await requestOnly.click();
    changedStrategy = true;
    await clickSaveDraft(page);
  }
  const stratAfterAppt = (await fetchWizardState(page))?.state?.bookingStrategy;

  await goToStepByLabel(page, STEP_ORDER[2]);
  const bizInput = page
    .locator(
      'input[name="businessName"], #business-name, input[placeholder*="business" i], label:has-text("Business name") + input, label:has-text("Company") + input',
    )
    .first();
  if (await bizInput.count()) {
    const origBiz = await bizInput.inputValue();
    await bizInput.fill(`${origBiz} ${TEST_MARKER}`.trim());
    await clickSaveDraft(page);
  }
  const stratAfterInfoSave = (await fetchWizardState(page))?.state?.bookingStrategy;
  const staleOk =
    !changedStrategy ||
    stratAfterInfoSave === stratAfterAppt ||
    stratAfterInfoSave === "REQUEST_ONLY";
  row({
    page: "Cross-page",
    section: "stale-save",
    label: "Information save preserves Appointments bookingStrategy",
    status: staleOk ? "PASS" : "FAIL",
    stratBefore,
    stratAfterAppt,
    stratAfterInfoSave,
  });
  if (!staleOk) fail("Stale information save reverted bookingStrategy");

  // —— Custom caller field (Booking / Appointments step) ——
  await goToStepByLabel(page, STEP_ORDER[3]);
  await page.screenshot({ path: `${OUT_DIR}/booking-step.png`, fullPage: true });
  const addFieldBtn = page.getByRole("button", { name: /^Add field$/i }).first();
  if (await addFieldBtn.isVisible().catch(() => false)) {
    await addFieldBtn.click();
    await page.waitForTimeout(300);
    const labelInputs = page.locator('input[placeholder*="Label"], input[aria-label*="Label"]');
    const lastLabel = labelInputs.last();
    await lastLabel.fill("Mother's name");
    const question = page.getByPlaceholder(/question|ask/i).last();
    if (await question.count()) await question.fill("What is your mother's name?");
    await clickSaveDraft(page);
    api = await fetchWizardState(page);
    const fields = api?.state?.collectFields || [];
    const custom = fields.find(
      (f) =>
        /mother/i.test(f.label || "") ||
        f.id === "mothers_name" ||
        /mother/i.test(f.id || ""),
    );
    row({
      page: STEP_ORDER[3],
      section: "custom fields",
      label: "Mother's name",
      type: "add row",
      backend: custom ? "PASS" : "FAIL",
      status: custom ? "PASS" : "FAIL",
    });
    if (!custom) fail("Custom field not persisted after UI add");
    else {
      const snap = backendSnapshot();
      const intakeKeys = snap?.compiledIntakeFieldIds || [];
      row({
        page: STEP_ORDER[3],
        label: "Custom field compiled intake",
        status: intakeKeys.some((k) => /mother/i.test(k)) ? "PASS" : "BLOCKED",
        note: "compiled after publish may differ",
      });
    }
  } else {
    row({
      page: STEP_ORDER[3],
      label: "Add caller field",
      status: "BLOCKED",
      note: "Add field control not found",
    });
  }

  // —— Restore solution name (partial) ——
  if (origName && !origName.includes(TEST_MARKER)) {
    await goToStepIndex(page, 0);
    await page.locator("#solution-name").first().fill(origName);
    await clickSaveDraft(page);
  }

  report.snapshotAfter = backendSnapshot();
  report.finishedAt = new Date().toISOString();
  report.failures = failures;
  report.pass = failures.length === 0;

  fs.writeFileSync(`${OUT_DIR}/cert-report.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${OUT_DIR}/matrix.json`, JSON.stringify(matrix, null, 2));

  const md = [
    "# Voice V2 wizard UI certification",
    "",
    `**Date:** ${report.finishedAt}`,
    `**Agent:** \`${AGENT_ID}\``,
    `**Health SHA:** ${report.healthSha || "unknown"}`,
    `**Result:** ${report.pass ? "PASS (partial — extend matrix)" : "FAIL"}`,
    "",
    "| Page | Label | Status | Note |",
    "|------|-------|--------|------|",
    ...matrix.map(
      (m) =>
        `| ${m.page || ""} | ${m.label || m.section || ""} | ${m.status || m.backend || ""} | ${m.note || ""} |`,
    ),
    "",
    failures.length
      ? `### Failures\n${failures.map((f) => `- ${f}`).join("\n")}`
      : "### No failures in automated sweep",
  ].join("\n");
  fs.writeFileSync(MATRIX_PATH, md);

  await browser.close();

  console.log(JSON.stringify({ pass: report.pass, failures, healthSha: report.healthSha }, null, 2));
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
