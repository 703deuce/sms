/**
 * Capture generic voice wizard + all 8 appointment receptionist setup steps.
 * Run: DEV_AUTH_BYPASS=1 npm run dev
 *      npx tsx scripts/capture-voice-wizard-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { WIZARD_STEPS } from "../src/lib/solutions/appointment-receptionist/types";
import { visibleWizardSteps } from "../src/lib/solutions/appointment-receptionist/wizard-presets";

const base = process.env.BASE_URL || process.env.UI_AGENT_BASE_URL || "http://localhost:3000";
const out = process.env.SCREENSHOT_DIR || "/opt/cursor/artifacts/screenshots";
const STORAGE_KEY = "transovo.appointment-receptionist.wizard.v1";
const SETUP_PATH = "/solutions/ai-call-handling/appointment-assistant/setup";
const MCTB_SETUP_PATH = "/mctb/voice-agent";
const MCTB_STORAGE_KEY = "transovo.mctb.voice-agent.wizard.v1";

async function authAndGoto(page: Page, path: string) {
  await page.goto(`${base}/api/auth/dev-bypass?next=${encodeURIComponent(path)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 120000 });
}

async function shot(page: Page, file: string) {
  await page.waitForTimeout(800);
  const p = join(out, file);
  await page.screenshot({ path: p, fullPage: false });
  console.log("saved", p);
}

async function captureEightStepSetup(page: Page) {
  const state = {
    ...createDefaultWizardState(),
    agentId: "screenshot-demo-agent",
    solutionName: "Main Office Appointment Receptionist",
    websiteUrl: "https://example.com",
  };
  const steps = visibleWizardSteps(state);
  if (steps.length !== WIZARD_STEPS.length) {
    console.warn(
      `Expected ${WIZARD_STEPS.length} visible steps, got ${steps.length}:`,
      steps.map((s) => s.id).join(", "),
    );
  }

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    const slug = String(stepIndex + 1).padStart(2, "0");
    const file = `amy-wizard-step-${slug}-${step.id}.png`;

    await page.evaluate(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: STORAGE_KEY, payload: { stepIndex, state } },
    );

    await page.goto(`${base}${SETUP_PATH}`, { waitUntil: "networkidle", timeout: 120000 });
    const footer = page.getByTestId(
      stepIndex === steps.length - 1 ? "wizard-activate-footer" : "wizard-continue",
    );
    await footer.waitFor({ state: "visible", timeout: 60000 });
    await page
      .locator("nav[aria-label='Setup progress']")
      .getByText(step.label, { exact: true })
      .waitFor({ state: "visible", timeout: 60000 });
    await shot(page, file);
  }
}

async function captureMctbEightStepSetup(page: Page) {
  const state = {
    ...createDefaultWizardState(),
    agentId: "screenshot-demo-agent",
    solutionName: "After-Hours Voice Agent",
    websiteUrl: "https://example.com",
    preset: "after_hours" as const,
    answerWhen: "after_hours" as const,
  };
  const steps = [
    { id: "goals", label: "Purpose", query: "goals" },
    { id: "phone", label: "Phone", query: "phone" },
    { id: "information", label: "Business Knowledge", query: "information" },
    { id: "appointments", label: "Booking", query: "booking" },
    { id: "call-handling", label: "Call Handling", query: "call-handling" },
    { id: "voice", label: "Voice", query: "voice" },
    { id: "test", label: "Test", query: "test" },
    { id: "activate", label: "Activate", query: "activate" },
  ];

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
    const step = steps[stepIndex];
    const slug = String(stepIndex + 1).padStart(2, "0");
    const file = `mctb-voice-agent-step-${slug}-${step.id}.png`;

    await page.evaluate(
      ({ key, payload }) => {
        localStorage.setItem(key, JSON.stringify(payload));
      },
      { key: MCTB_STORAGE_KEY, payload: { stepIndex, state } },
    );

    await page.goto(`${base}${MCTB_SETUP_PATH}?step=${step.query}`, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    const footer = page.getByTestId(
      stepIndex === steps.length - 1 ? "wizard-activate-footer" : "wizard-continue",
    );
    await footer.waitFor({ state: "visible", timeout: 60000 });
    await shot(page, file);
  }
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await authAndGoto(page, "/voice/agents/new");
  await shot(page, "voice-agent-wizard-about.png");

  await authAndGoto(page, SETUP_PATH);
  await captureEightStepSetup(page);

  await authAndGoto(page, MCTB_SETUP_PATH);
  await captureMctbEightStepSetup(page);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
