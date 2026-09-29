/**
 * Desktop screenshots of each MCTB onboarding wizard step.
 *
 * Visual regression only — mocks GET /api/mctb/onboarding unless you opt out.
 * Do not use mocked output as proof of real workspace provisioning.
 *
 *   MCTB_ONBOARDING_SCREENSHOT_MOCKS=1 CERT_BROWSER_PASSWORD='…' UI_AGENT_BASE_URL=<host> \
 *     npx tsx scripts/capture-mctb-onboarding-wizard-screenshots.ts
 *
 * Real workspace (no API mocks):
 *   UI_AGENT_BASE_URL=<host> npx tsx scripts/capture-mctb-onboarding-wizard-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { authenticate as certAuthenticate } from "./browser-cert/lib";
import { MCTB_CARRIER_GUIDES } from "../src/lib/mctb/onboarding/carriers";
import { defaultHandoffConfig } from "../src/lib/mctb/handoff/defaults";
import { MCTB_WIZARD_PRIMARY_STEPS } from "../src/lib/mctb/onboarding/wizard-flow";
import type { MctbOnboardingStep } from "../src/lib/mctb/onboarding/types";

const BASE_URL = process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim();
const OUT_DIR =
  process.env.MCTB_ONBOARDING_SCREENSHOT_DIR ||
  "/opt/cursor/artifacts/screenshots/mctb-onboarding-wizard";

const STEP_WAIT: Partial<Record<MctbOnboardingStep, RegExp>> = {
  business_line: /Tell us about your business/i,
  consent: /How should callers receive a text/i,
  recovery: /Choose your missed-call text/i,
  voicemail: /Choose your voicemail greeting/i,
  notifications: /Where should we notify you/i,
  connect_calls: /Connect your business phone/i,
  review_test: /Let's make sure everything works|You're ready/i,
  ready: /You're ready/i,
};

/** Production GET /api/mctb/onboarding can 500 (schema drift); mock so each step renders. */
function buildMockOnboardingGet(step: MctbOnboardingStep) {
  const forward = "+18885550100";
  const business = "+15715550188";
  const livePassed = step === "ready";
  return {
    state: {
      version: 2,
      currentStep: step,
      businessName: "Appt MCTB Browser Cert",
      businessNumberE164: business,
      consentMode: "press_1",
      messageTemplate: "Sorry we missed your call! Reply here and we'll get back to you shortly.",
      completedSteps: [],
      forwardingCarrier: "verizon",
      voicemailConfiguredAt:
        step === "notifications" ||
        step === "connect_calls" ||
        step === "review_test" ||
        step === "ready"
          ? new Date().toISOString()
          : null,
      trialActivatedAt: step === "ready" ? new Date().toISOString() : null,
    },
    steps: [],
    stepLabels: {},
    wizardPrimarySteps: MCTB_WIZARD_PRIMARY_STEPS,
    wizardPrimaryLabels: {},
    trialNumber: {
      provisioned: true,
      display: "(888) 555-0100",
      phoneNumberId: "cert-screenshot-phone",
      messagingVerificationStatus: "approved",
      tfvStatusLabel: "Approved",
      messagingApproved: true,
      numberClass: "TOLL_FREE",
    },
    liveTest: {
      started: step === "review_test",
      passed: livePassed,
      checks: livePassed ? { call: true, text: true, reply: true } : {},
      forwardTargetE164: forward,
      businessNumberE164: business,
    },
    tfv: { status: "approved", approved: true, messagingApproved: true },
    carriers: MCTB_CARRIER_GUIDES,
    forwardingVerification: {
      testStarted: false,
      verified: step === "review_test" || step === "ready",
    },
    demo: {
      demoNumberE164: "+18885550101",
      demoNumberDisplay: "(888) 555-0101",
      checks: {},
      consentMode: "press_1",
    },
    productionForwardE164: forward,
    forwardTargetE164: forward,
    defaultBusinessLineE164: business,
    capabilities: {
      platformSenderActive: true,
      recoveryPaid: true,
      aiRecoveryEntitled: false,
    },
    senderPresentation: {
      title: "Transovo Platform",
      description: "Pre-approved sender for onboarding",
    },
    firstRun: {
      shouldAutoOpen: step !== "ready",
      trigger: step !== "ready" ? "incomplete_onboarding" : "none",
      everyLoginTesting: false,
      onboardingComplete: step === "ready",
    },
    onboardingComplete: step === "ready",
  };
}

function installOnboardingMocks(page: import("playwright").Page, getStep: () => MctbOnboardingStep) {
  void page.route("**/api/mctb/onboarding", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildMockOnboardingGet(getStep())),
      });
      return;
    }
    await route.continue();
  });

  void page.route("**/api/mctb/handoff", async (route) => {
    if (route.request().method() === "GET") {
      const config = defaultHandoffConfig();
      config.routingMatrix.caller_replied = {
        ...(config.routingMatrix.caller_replied || {}),
        email: true,
        sms: false,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            config,
            recipients: [
              {
                id: "onb-primary",
                name: "Primary contact",
                email: "appt-mctb-browser@transovo.test",
                mobileE164: "+15555550198",
                enabled: true,
                eventChannels: {},
                sortOrder: 0,
                roleDescription: null,
              },
            ],
            launch: { aiRepliesEnabled: false, urgentBusinessSmsEntitled: true },
          },
        }),
      });
      return;
    }
    await route.continue();
  });

  void page.route("**/api/phone/voicemail**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          greetingText: "",
          greetingUrl: null,
          greetingActive: true,
          greetingCustomActive: false,
        }),
      });
      return;
    }
    await route.continue();
  });
}

async function waitForStep(page: import("playwright").Page, step: MctbOnboardingStep) {
  const pattern = STEP_WAIT[step] ?? /Set up Missed Call Text Back/i;
  await page
    .getByText(pattern)
    .first()
    .waitFor({ state: "visible", timeout: 90000 })
    .catch(() => undefined);
  await page
    .waitForFunction(
      () => !document.body.innerText.includes("Loading notifications"),
      { timeout: 30000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(1200);
}

async function main() {
  if (!BASE_URL) {
    console.error("Set UI_AGENT_BASE_URL or BASE_URL.");
    process.exit(1);
  }
  if (!process.env.CERT_BROWSER_PASSWORD?.trim() && !process.env.UI_AGENT_SMOKE_PASSWORD?.trim()) {
    process.env.CERT_BROWSER_PASSWORD = "ApptMctbBrowserCert_v1!";
  }

  const auth = await certAuthenticate(BASE_URL);
  if (!auth.ok) {
    console.error(`Login failed for ${auth.email}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    storageState: auth.storageState,
  });
  const page = await context.newPage();

  const useMocks =
    process.env.MCTB_ONBOARDING_SCREENSHOT_MOCKS?.trim() === "1" ||
    process.env.MCTB_ONBOARDING_SCREENSHOT_MOCKS?.trim()?.toLowerCase() === "true";

  const steps: MctbOnboardingStep[] = [...MCTB_WIZARD_PRIMARY_STEPS, "ready"];
  let mockStep: MctbOnboardingStep = "business_line";
  if (useMocks) {
    console.log("Using mocked onboarding API (fixture data). Set MCTB_ONBOARDING_SCREENSHOT_MOCKS=0 for real workspace.");
    installOnboardingMocks(page, () => mockStep);
  } else {
    console.log("Real onboarding API — workspace must have incomplete onboarding for modal steps.");
  }

  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      mockStep = step;
      const slug = `${String(i + 1).padStart(2, "0")}_${step}`;
      console.log(`Step ${slug}`);

      await page.goto(`${BASE_URL}/mctb`, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined);
      await page
        .locator('[data-slot="dialog-content"]')
        .waitFor({ state: "visible", timeout: 60000 })
        .catch(() => undefined);
      const crashed = await page
        .getByText(/This page couldn't load/i)
        .isVisible()
        .catch(() => false);
      if (crashed) {
        await page.getByRole("button", { name: /^Reload$/i }).click();
        await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => undefined);
      }

      await waitForStep(page, step);
      const out = join(OUT_DIR, `onboarding_${slug}.png`);
      await page.screenshot({ path: out, fullPage: false });
      console.log(`  ✓ ${out}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\nDone. ${OUT_DIR}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
