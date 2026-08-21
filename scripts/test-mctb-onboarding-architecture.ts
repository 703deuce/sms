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
  isPlatformDemoNumber,
} from "../src/lib/mctb/onboarding/demo";
import { MCTB_ONBOARDING_STEP_ORDER } from "../src/lib/mctb/onboarding/types";
import { MCTB_CARRIER_GUIDES } from "../src/lib/mctb/onboarding/carriers";

assert.equal(MCTB_ONBOARDING_STEP_ORDER[0], "business");
assert.equal(MCTB_ONBOARDING_STEP_ORDER[3], "demo");
assert.equal(MCTB_ONBOARDING_STEP_ORDER.at(-1), "complete");

const defaults = defaultMctbOnboardingState();
assert.equal(defaults.currentStep, "business");
assert.equal(defaults.consentMode, "press_1");

const parsed = parseMctbOnboardingState({
  mctbOnboarding: { ...defaults, businessName: "Acme" },
});
assert.equal(parsed.businessName, "Acme");

const afterBusiness = markStepComplete(defaults, "business");
assert.ok(afterBusiness.completedSteps.includes("business"));
assert.equal(afterBusiness.currentStep, "configure");

assert.match(getDemoMessageBody(), /Transovo Demo/i);
assert.equal(formatDemoPhoneDisplay("+18005551234"), "1-800-555-1234");
assert.equal(isPlatformDemoNumber("+19999999999"), false);

assert.ok(MCTB_CARRIER_GUIDES.length >= 8);
assert.ok(MCTB_CARRIER_GUIDES.some((g) => g.id === "verizon"));

console.log("test-mctb-onboarding-architecture: ok");
