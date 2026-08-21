/**
 * Smoke checks for MCTB demo-first onboarding architecture.
 * Run: npx tsx scripts/test-mctb-onboarding-architecture.ts
 */
import assert from "node:assert/strict";
import {
  defaultMctbOnboardingState,
  markStepComplete,
  parseMctbOnboardingState,
} from "../src/lib/mctb/onboarding/state";
import {
  formatDemoPhoneDisplay,
  getDemoMessageBody,
  getPlatformDemoNumberE164,
  isPlatformDemoNumber,
} from "../src/lib/mctb/onboarding/demo";
import {
  MCTB_ONBOARDING_STEP_ORDER,
  MCTB_ONBOARDING_STEP_LABELS,
} from "../src/lib/mctb/onboarding/types";
import {
  MCTB_PLATFORM_DEMO_E164,
  MCTB_PLATFORM_DEMO_DISPLAY,
  MCTB_PLATFORM_DEMO_LABEL,
} from "../src/lib/mctb/onboarding/constants";
import { MCTB_FUNNEL_EVENTS } from "../src/lib/mctb/onboarding/funnel";
import { MCTB_CARRIER_GUIDES } from "../src/lib/mctb/onboarding/carriers";
import { tfvStatusLabel } from "../src/lib/mctb/onboarding/trial-number";

assert.equal(MCTB_ONBOARDING_STEP_ORDER[0], "business");
assert.equal(MCTB_ONBOARDING_STEP_ORDER[1], "trial_number");
assert.equal(MCTB_ONBOARDING_STEP_ORDER[4], "demo");
assert.equal(MCTB_ONBOARDING_STEP_ORDER[5], "tfv");
assert.equal(MCTB_ONBOARDING_STEP_ORDER.at(-1), "complete");
assert.equal(MCTB_ONBOARDING_STEP_LABELS.trial_number, "Your Transovo number");

const defaults = defaultMctbOnboardingState();
assert.equal(defaults.version, 2);
assert.equal(defaults.currentStep, "business");
assert.equal(defaults.consentMode, "press_1");
assert.equal(defaults.trialNumber, null);

const parsed = parseMctbOnboardingState({
  mctbOnboarding: { ...defaults, businessName: "Acme", currentStep: "compliance" },
});
assert.equal(parsed.businessName, "Acme");
assert.equal(parsed.currentStep, "tfv");

const afterBusiness = markStepComplete(defaults, "business");
assert.ok(afterBusiness.completedSteps.includes("business"));
assert.equal(afterBusiness.currentStep, "trial_number");

assert.match(getDemoMessageBody(), /Transovo Demo/i);
assert.equal(getPlatformDemoNumberE164(), "+18663464256");
assert.equal(MCTB_PLATFORM_DEMO_DISPLAY, "1-866-346-4256");
assert.equal(MCTB_PLATFORM_DEMO_LABEL, "Approved Transovo Demo Number");
assert.equal(formatDemoPhoneDisplay("+18663464256"), "1-866-346-4256");
assert.equal(isPlatformDemoNumber(MCTB_PLATFORM_DEMO_E164), true);
assert.equal(isPlatformDemoNumber("+19999999999"), false);

assert.ok(MCTB_CARRIER_GUIDES.length >= 8);
assert.equal(tfvStatusLabel("in_review"), "In review");
assert.ok(MCTB_FUNNEL_EVENTS.includes("MCTB_TRIAL_NUMBER_PROVISIONED"));
assert.ok(MCTB_FUNNEL_EVENTS.includes("MCTB_TFV_APPROVED"));

console.log("test-mctb-onboarding-architecture: ok");
