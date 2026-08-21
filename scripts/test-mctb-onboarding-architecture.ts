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
import { MCTB_PLATFORM_DEMO_E164, MCTB_PLATFORM_DEMO_DISPLAY } from "../src/lib/mctb/onboarding/constants";
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
assert.equal(getPlatformDemoNumberE164(), "+18663464256");
assert.equal(MCTB_PLATFORM_DEMO_DISPLAY, "1-866-346-4256");
assert.equal(formatDemoPhoneDisplay("+18663464256"), "1-866-346-4256");
assert.equal(isPlatformDemoNumber(MCTB_PLATFORM_DEMO_E164), true);
assert.equal(isPlatformDemoNumber("+19999999999"), false);

assert.ok(MCTB_CARRIER_GUIDES.length >= 8);
assert.ok(MCTB_CARRIER_GUIDES.some((g) => g.id === "verizon"));

console.log("test-mctb-onboarding-architecture: ok");
