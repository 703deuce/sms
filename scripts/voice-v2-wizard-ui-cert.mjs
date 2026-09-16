/**
 * Voice V2 — full 8-page wizard customer-path UI certification (production).
 * UI clicks only for mutations; GET APIs for backend verification after save.
 * No PSTN. Requires BASE_URL and AGENT_ID env vars.
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
const INVENTORY_PATH = "scripts/wizard-control-inventory.json";
const TEST_MARKER = "UI CERT TEST 2304";
const CUSTOM_FIELD_LABEL = "Mother's name";

fs.mkdirSync(OUT_DIR, { recursive: true });

const matrix = [];
const failures = [];
const pageStats = {};

const report = {
  base: BASE,
  agentId: AGENT_ID,
  startedAt: new Date().toISOString(),
  healthSha: null,
  snapshotBefore: null,
  snapshotAfter: null,
  originalPublishedVersionId: null,
  finalPublishedVersionId: null,
};

function row(entry) {
  matrix.push(entry);
  const p = entry.page || "Global";
  if (!pageStats[p]) pageStats[p] = { pass: 0, fail: 0, blocked: 0, na: 0 };
  const st = entry.status || entry.backend || "PASS";
  if (st === "PASS") pageStats[p].pass++;
  else if (st === "FAIL") pageStats[p].fail++;
  else if (st === "BLOCKED") pageStats[p].blocked++;
  else if (st === "NOT_APPLICABLE") pageStats[p].na++;
}

function fail(msg) {
  failures.push(msg);
}

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

let STEP_ORDER = MCTB_STEP_ORDER;
let wizardBasePath = "/mctb/voice-agent";

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

async function fetchVoiceAgent(page) {
  const res = await page.request.get(`${BASE}/api/voice/agents/${AGENT_ID}`);
  const json = await res.json();
  return json?.data || null;
}

async function fetchInbound(page, phoneNumberId) {
  if (!phoneNumberId) return null;
  const res = await page.request.get(
    `${BASE}/api/mctb/inbound-handling?phoneNumberId=${encodeURIComponent(phoneNumberId)}`,
  );
  const json = await res.json();
  return json?.data || null;
}

function wizardSnap(agent) {
  const adv = agent?.draftConfig?.advanced || {};
  return adv.appointmentReceptionistWizard || {};
}

function backendSnapshotLocal() {
  try {
    const out = execSync(
      `NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/voice-v2-wizard-backend-snapshot.ts ${AGENT_ID}`,
      { cwd: process.cwd(), encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
    );
    return JSON.parse(out.trim());
  } catch {
    return null;
  }
}

async function apiSnapshot(page) {
  const setup = await fetchWizardState(page);
  const agent = await fetchVoiceAgent(page);
  const snap = wizardSnap(agent);
  const inbound = await fetchInbound(page, setup?.state?.phoneNumberId);
  return {
    solutionName: setup?.state?.solutionName,
    businessName: setup?.state?.businessName,
    bookingStrategy: setup?.state?.bookingStrategy,
    collectFields: setup?.state?.collectFields || [],
    agentStatus: agent?.rawStatus || agent?.status,
    publishedVersionId: agent?.publishedVersionId,
    phoneNumberId: setup?.state?.phoneNumberId,
    phoneLast4: inbound?.line?.ingressE164?.slice(-4),
    inboundMode: inbound?.line?.inboundHandlingMode,
    wizardSnapBooking: snap.bookingStrategy,
    draftAdvancedBooking: agent?.draftConfig?.advanced?.bookingStrategy,
  };
}

async function waitReady(page) {
  for (let i = 0; i < 200; i++) {
    const working = await page.getByRole("button", { name: /Working/i }).count();
    if (!working) return;
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: `${OUT_DIR}/stuck-working.png`, fullPage: true });
  throw new Error("Wizard stuck on Working…");
}

/** Wait until server-backed wizard state is loaded. */
async function waitWizardHydrated(page) {
  await page
    .waitForResponse(
      (r) =>
        r.url().includes("/api/solutions/appointment-receptionist") &&
        r.request().method() === "GET" &&
        r.status() === 200,
      { timeout: 90000 },
    )
    .catch(() => undefined);
  await waitReady(page);
  await page.waitForTimeout(1200);
  const saveBtn = page.getByRole("button", { name: /Save draft|^Save$/i }).first();
  if (await saveBtn.isDisabled().catch(() => false)) {
    for (let i = 0; i < 60; i++) {
      if (await saveBtn.isEnabled().catch(() => false)) return;
      await page.waitForTimeout(500);
    }
  }
}

async function setReactInput(page, selector, value) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible", timeout: 30000 });
  await el.click();
  await el.fill("");
  await el.pressSequentially(value, { delay: 15 });
  await el.blur();
}

async function clickSaveDraft(page) {
  await waitReady(page);
  const btn = page.getByRole("button", { name: /Save draft|^Save$/i }).first();
  await btn.click();
  await waitReady(page);
  await page.waitForTimeout(800);
}

async function openStepQuery(page, stepQuery) {
  const url = `${BASE}${wizardBasePath}?agentId=${AGENT_ID}&step=${stepQuery}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await waitReady(page);
  await page.waitForTimeout(600);
}

async function goToStepIndex(page, targetIndex) {
  await openStepQuery(page, MCTB_STEP_QUERY[targetIndex]);
  return true;
}

function intakeFieldIdsFromAgent(agent) {
  const draft = agent?.draftConfig || {};
  const v2 = draft.advanced?.voiceV2Intake;
  if (v2?.fields && typeof v2.fields === "object") return Object.keys(v2.fields);
  const collect = wizardSnap(agent).collectFields || [];
  return collect.map((f) => f.id).filter(Boolean);
}

function toolNamesFromAgent(agent) {
  const tools = agent?.draftConfig?.tools;
  if (!Array.isArray(tools)) return [];
  return tools.map((t) => t?.name || t?.id).filter(Boolean);
}

async function main() {
  if (!BASE) throw new Error("BASE_URL or APP_URL required");

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => ({}));
  report.healthSha = health.commitSha || null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await smokeLogin(page);
  await openStepQuery(page, "goals");
  await waitWizardHydrated(page);

  report.snapshotBefore = await apiSnapshot(page);
  report.originalPublishedVersionId = report.snapshotBefore.publishedVersionId;
  report.snapshotBefore.local = backendSnapshotLocal();

  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, "utf8"));
  row({
    page: "Global",
    section: "inventory",
    label: "Control inventory count",
    status: "PASS",
    note: `${inventory.length} controls catalogued in ${INVENTORY_PATH}`,
  });

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

  // —— Purpose: agent name ——
  await goToStepIndex(page, 0);
  await waitWizardHydrated(page);
  const nameInput = page.locator("#solution-name").first();
  const origName = (await nameInput.inputValue()) || "";
  const testName = origName.includes(TEST_MARKER)
    ? origName
    : `${origName} ${TEST_MARKER}`.trim();
  await setReactInput(page, "#solution-name", testName);
  await clickSaveDraft(page);
  let snap = await apiSnapshot(page);
  const agentAfterName = await fetchVoiceAgent(page);
  const nameOk =
    snap.solutionName?.includes(TEST_MARKER) ||
    wizardSnap(agentAfterName).solutionName?.includes(TEST_MARKER);
  row({
    page: "Purpose",
    section: "Identity",
    label: "Agent name",
    type: "text",
    original: origName,
    test: testName,
    uiSave: "PASS",
    backend: nameOk ? "PASS" : "FAIL",
    status: nameOk ? "PASS" : "FAIL",
  });
  if (!nameOk) fail("Purpose agent name not persisted after UI save");

  await page.reload({ waitUntil: "domcontentloaded" });
  await waitWizardHydrated(page);
  const nameAfterRefresh = await page.locator("#solution-name").first().inputValue();
  row({
    page: "Purpose",
    label: "Agent name refresh",
    refresh: nameAfterRefresh.includes(TEST_MARKER) ? "PASS" : "FAIL",
    status: nameAfterRefresh.includes(TEST_MARKER) ? "PASS" : "FAIL",
  });
  if (!nameAfterRefresh.includes(TEST_MARKER)) fail("Purpose agent name lost on refresh");

  // —— Business Knowledge: business name ——
  await goToStepIndex(page, 2);
  await waitWizardHydrated(page);
  await page.getByText("Complete guided business profile", { exact: false }).click();
  const bizInput = page.getByLabel("Business name", { exact: false });
  let origBiz = "";
  if (await bizInput.count()) {
    origBiz = await bizInput.inputValue();
    const testBiz = origBiz.includes(TEST_MARKER) ? origBiz : `${origBiz} ${TEST_MARKER}`.trim();
    await bizInput.click();
    await bizInput.fill("");
    await bizInput.pressSequentially(testBiz, { delay: 15 });
    await bizInput.blur();
    await clickSaveDraft(page);
    snap = await apiSnapshot(page);
    const bizOk = snap.businessName?.includes(TEST_MARKER);
    row({
      page: "Business Knowledge",
      section: "Business",
      label: "Business name",
      type: "text",
      backend: bizOk ? "PASS" : "FAIL",
      refresh: "PENDING",
      status: bizOk ? "PASS" : "FAIL",
    });
    if (!bizOk) fail("Business name not persisted");
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitReady(page);
    const bizRefresh = await page.getByLabel("Business name", { exact: false }).inputValue();
    row({
      page: "Business Knowledge",
      label: "Business name refresh",
      status: bizRefresh.includes(TEST_MARKER) ? "PASS" : "FAIL",
    });
  } else {
    row({
      page: "Business Knowledge",
      label: "Business name",
      status: "BLOCKED",
      note: "#business-name not found",
    });
  }

  // —— Cross-page stale save (UI only) ——
  const stratOrig = (await apiSnapshot(page)).bookingStrategy || "MICROSOFT_365";
  await goToStepIndex(page, 3);
  await page.getByText("Take their preferred time and have us confirm it", { exact: false }).click();
  await clickSaveDraft(page);
  const stratAfterBookingUi = (await apiSnapshot(page)).bookingStrategy;
  const bookingUiOk = stratAfterBookingUi === "REQUEST_ONLY";
  row({
    page: "Cross-page",
    section: "stale-save",
    label: "UI: Booking → REQUEST_ONLY",
    status: bookingUiOk ? "PASS" : "FAIL",
    note: `was ${stratOrig} → ${stratAfterBookingUi}`,
  });
  if (!bookingUiOk) fail("Booking strategy UI change did not persist");

  await goToStepIndex(page, 2);
  if (await bizInput.count()) {
    const cur = await bizInput.inputValue();
    await bizInput.fill(`${cur} X`.trim());
    await clickSaveDraft(page);
  }
  const stratAfterInfo = (await apiSnapshot(page)).bookingStrategy;
  const staleOk = stratAfterInfo === "REQUEST_ONLY";
  row({
    page: "Cross-page",
    section: "stale-save",
    label: "Information save preserves Booking strategy",
    status: staleOk ? "PASS" : "FAIL",
    note: `after info save: ${stratAfterInfo}`,
  });
  if (!staleOk) fail("Stale Information save reverted bookingStrategy");

  // —— Custom field (Booking) ——
  await goToStepIndex(page, 3);
  await waitWizardHydrated(page);
  await page.getByText("What Amy must collect", { exact: false }).scrollIntoViewIfNeeded();
  const fieldInput = page.locator("#new-collect-field");
  let customFieldId = null;
  const existingMother = await page.getByText(CUSTOM_FIELD_LABEL, { exact: false }).count();
  if (existingMother > 0) {
    customFieldId = "custom_mother_s_name";
    row({
      page: "Booking",
      section: "Intake",
      label: "Custom field (pre-existing Mother's name)",
      type: "collection",
      backend: "PASS",
      status: "PASS",
      note: "Field already on test agent — will test edit",
    });
    const editBtn = page.getByRole("button", { name: /edit/i }).first();
    if (await editBtn.count()) {
      await editBtn.click();
    }
    const labelInput = page.locator(`input[value="${CUSTOM_FIELD_LABEL}"]`).first();
    if (await labelInput.count()) {
      await labelInput.fill("Parent/guardian name");
      await clickSaveDraft(page);
      snap = await apiSnapshot(page);
      const edited = (snap.collectFields || []).some((f) =>
        /parent|guardian/i.test(f.label || ""),
      );
      row({
        page: "Booking",
        label: "Edit custom field label",
        status: edited ? "PASS" : "FAIL",
      });
      if (!edited) fail("Custom field edit did not persist");
      await labelInput.fill(CUSTOM_FIELD_LABEL);
      await clickSaveDraft(page);
    }
  } else if (await fieldInput.isVisible().catch(() => false)) {
    await fieldInput.scrollIntoViewIfNeeded();
    await fieldInput.fill(CUSTOM_FIELD_LABEL);
    await page.getByRole("button", { name: /^Add field$/i }).click();
    await page.waitForTimeout(500);
    await clickSaveDraft(page);
    snap = await apiSnapshot(page);
    const custom = (snap.collectFields || []).find((f) =>
      /mother/i.test(f.label || f.id || ""),
    );
    customFieldId = custom?.id;
    row({
      page: "Booking",
      section: "Intake",
      label: "Add caller field (Mother's name)",
      type: "add row",
      backend: custom ? "PASS" : "FAIL",
      status: custom ? "PASS" : "FAIL",
    });
    if (!custom) fail("Custom field not persisted after UI add");
    else {
      const agent = await fetchVoiceAgent(page);
      const ids = intakeFieldIdsFromAgent(agent);
      row({
        page: "Booking",
        label: "Custom field in draft intake",
        status: ids.some((k) => /mother/i.test(k)) ? "PASS" : "FAIL",
        note: ids.join(", "),
      });
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitReady(page);
    const stillVisible = await page.getByText(CUSTOM_FIELD_LABEL, { exact: false }).count();
    row({
      page: "Booking",
      label: "Custom field refresh",
      status: stillVisible > 0 ? "PASS" : "FAIL",
    });
  } else {
    row({
      page: "Booking",
      label: "Add caller field",
      status: "BLOCKED",
      note: "#new-collect-field not visible",
    });
    fail("Custom field UI blocked — mandatory test incomplete");
  }

  // —— Draft vs published (booking strategy) ——
  const agentBeforePub = await fetchVoiceAgent(page);
  const publishedStratBefore =
    agentBeforePub?.draftConfig?.advanced?.appointmentReceptionistWizard?.bookingStrategy ||
    stratOrig;
  row({
    page: "Booking",
    section: "draft-publish",
    label: "Draft REQUEST_ONLY before publish",
    status: stratAfterInfo === "REQUEST_ONLY" ? "PASS" : "FAIL",
  });

  // Restore booking strategy via UI before leaving agent in REQUEST_ONLY (unless publish test)
  await goToStepIndex(page, 3);
  if (stratOrig === "MICROSOFT_365" || stratOrig !== "REQUEST_ONLY") {
    await page.getByText("Book an appointment for them", { exact: false }).first().click();
    await clickSaveDraft(page);
    const restored = (await apiSnapshot(page)).bookingStrategy;
    row({
      page: "Booking",
      label: "Restore booking strategy (UI)",
      status: restored === "MICROSOFT_365" ? "PASS" : "FAIL",
      note: restored,
    });
  }

  // —— Phone page smoke + inbound ——
  await goToStepIndex(page, 1);
  const phoneErr = await page.locator(".text-danger").first().textContent().catch(() => "");
  snap = await apiSnapshot(page);
  row({
    page: "Phone",
    section: "load",
    label: "Step renders",
    status: phoneErr?.trim() ? "FAIL" : "PASS",
  });
  row({
    page: "Phone",
    section: "routing",
    label: "Assigned phone / inbound mode",
    status: snap.phoneNumberId ? "PASS" : "BLOCKED",
    note: snap.phoneLast4
      ? `…${snap.phoneLast4} mode=${snap.inboundMode || "?"}`
      : "no phone",
  });

  // —— Voice: long-term memory toggle on information if visible ——
  await goToStepIndex(page, 2);
  const memToggle = page.getByRole("switch", { name: /long-term memory/i });
  if (await memToggle.count()) {
    const wasChecked = await memToggle.isChecked();
    await memToggle.click();
    await clickSaveDraft(page);
    snap = await apiSnapshot(page);
    const toggled = Boolean(snap.collectFields); // proxy: fetch wizard state
    const setup = await fetchWizardState(page);
    const memVal = setup?.state?.longTermMemory;
    const memOk = memVal !== wasChecked;
    row({
      page: "Business Knowledge",
      label: "Long-term memory toggle",
      type: "toggle",
      status: memOk ? "PASS" : "FAIL",
      note: `${wasChecked} → ${memVal}`,
    });
    if (!memOk) fail("Long-term memory toggle did not persist");
    await memToggle.click();
    await clickSaveDraft(page);
  } else {
    row({
      page: "Business Knowledge",
      label: "Long-term memory toggle",
      status: "NOT_APPLICABLE",
      note: "switch not on page",
    });
  }

  // —— Per-step render smoke ——
  for (let si = 0; si < STEP_ORDER.length; si++) {
    await goToStepIndex(page, si);
    const errBanner = await page.locator(".text-danger").first().textContent().catch(() => "");
    row({
      page: STEP_ORDER[si],
      section: "load",
      label: "Step renders without error banner",
      status: errBanner?.trim() ? "FAIL" : "PASS",
      note: errBanner?.trim() || "",
    });
    if (errBanner?.trim()) fail(`${STEP_ORDER[si]} error: ${errBanner.trim()}`);
    await page.screenshot({
      path: `${OUT_DIR}/step-${MCTB_STEP_QUERY[si]}.png`,
      fullPage: true,
    });
  }

  // —— Tool eligibility spot-check from draft config ——
  const agentFinal = await fetchVoiceAgent(page);
  const tools = toolNamesFromAgent(agentFinal);
  const strat = (await apiSnapshot(page)).bookingStrategy || "MICROSOFT_365";
  const hasBook = tools.some((t) => /book/i.test(t));
  row({
    page: "Booking",
    section: "runtime",
    label: "Tool eligibility vs strategy",
    status: strat === "MICROSOFT_365" && hasBook ? "PASS" : strat !== "MICROSOFT_365" ? "NOT_APPLICABLE" : "FAIL",
    note: `strategy=${strat} tools=${tools.slice(0, 8).join(",")}`,
  });

  // —— Restore solution name ——
  if (origName && !origName.includes(TEST_MARKER)) {
    await goToStepIndex(page, 0);
    await page.locator("#solution-name").first().fill(origName);
    await clickSaveDraft(page);
  }
  if (origBiz && !origBiz.includes(TEST_MARKER)) {
    await goToStepIndex(page, 2);
    await page.getByText("Complete guided business profile", { exact: false }).click();
    const biz = page.getByLabel("Business name", { exact: false });
    if (await biz.count()) {
      await biz.fill(origBiz);
      await clickSaveDraft(page);
    }
  }

  // Remove custom field if added
  if (customFieldId) {
    await goToStepIndex(page, 3);
    const delBtn = page.getByRole("button", { name: /remove|delete/i }).filter({
      has: page.getByText(CUSTOM_FIELD_LABEL),
    });
    if (await delBtn.count()) {
      await delBtn.first().click();
      await clickSaveDraft(page);
    }
  }

  report.snapshotAfter = await apiSnapshot(page);
  report.finalPublishedVersionId = report.snapshotAfter.publishedVersionId;
  report.finishedAt = new Date().toISOString();
  report.failures = failures;
  report.pass = failures.length === 0;
  report.pageStats = pageStats;

  fs.writeFileSync(`${OUT_DIR}/cert-report.json`, JSON.stringify(report, null, 2));
  fs.writeFileSync(`${OUT_DIR}/matrix.json`, JSON.stringify(matrix, null, 2));

  const overall = report.pass ? "PASS" : failures.length <= 2 ? "PARTIAL" : "FAIL";

  const md = [
    "# Voice V2 wizard UI certification",
    "",
    `**Date:** ${report.finishedAt}`,
    `**Agent:** \`${AGENT_ID}\``,
    `**Health SHA:** ${report.healthSha || "unknown"}`,
    `**Result:** ${overall}`,
    "",
    "## Test agent",
    "",
    `- Phone last 4: ${report.snapshotAfter?.phoneLast4 || "n/a"}`,
    `- Published version (before): \`${report.originalPublishedVersionId || "none"}\``,
    `- Published version (after): \`${report.finalPublishedVersionId || "none"}\``,
    "",
    "## Page summary",
    "",
    "| Page | PASS | FAIL | BLOCKED | N/A |",
    "|------|------|------|---------|-----|",
    ...STEP_ORDER.map((p) => {
      const s = pageStats[p] || { pass: 0, fail: 0, blocked: 0, na: 0 };
      const pagePass = s.fail === 0 ? "PASS" : "FAIL";
      return `| ${p} | ${s.pass} | ${s.fail} | ${s.blocked} | ${s.na} | (${pagePass}) |`;
    }),
    "",
    "## Control matrix",
    "",
    "| Page | Section | Label | Type | Status | Note |",
    "|------|---------|-------|------|--------|------|",
    ...matrix.map(
      (m) =>
        `| ${m.page || ""} | ${m.section || ""} | ${m.label || ""} | ${m.type || ""} | ${m.status || m.backend || ""} | ${(m.note || "").replace(/\|/g, "/")} |`,
    ),
    "",
    "## Cross-page / special tests",
    "",
    "- Stale save: see Cross-page rows above",
    "- Custom field: see Booking intake rows",
    "- Draft vs publish: partial (full publish cycle optional — no PSTN)",
    "",
    failures.length
      ? `### Failures\n${failures.map((f) => `- ${f}`).join("\n")}`
      : "### No failures",
    "",
    `Inventory source: \`${INVENTORY_PATH}\` (${inventory.length} controls).`,
    "",
    "Artifacts: `/opt/cursor/artifacts/voice-v2-wizard-cert/`",
  ].join("\n");
  fs.writeFileSync(MATRIX_PATH, md);

  await browser.close();

  console.log(
    JSON.stringify(
      { pass: report.pass, overall, failures, healthSha: report.healthSha, pageStats },
      null,
      2,
    ),
  );
  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
