import assert from "node:assert/strict";
import {
  inferResumeStep,
  normalizeOnboardingStep,
  wizardStageIndex,
} from "../src/lib/mctb/onboarding/wizard-flow";
import { defaultMctbOnboardingState } from "../src/lib/mctb/onboarding/state";
import { MCTB_WIZARD_PRIMARY_STEPS } from "../src/lib/mctb/onboarding/wizard-flow";

assert.equal(normalizeOnboardingStep("business"), "business_line");
assert.equal(normalizeOnboardingStep("connect"), "connect_calls");
assert.equal(normalizeOnboardingStep("live_test"), "review_test");
assert.equal(normalizeOnboardingStep("complete"), "complete");
assert.equal(MCTB_WIZARD_PRIMARY_STEPS.length, 7);

const fresh = defaultMctbOnboardingState();
assert.equal(fresh.currentStep, "business_line");
assert.equal(wizardStageIndex("consent"), 1);

const partial = {
  ...fresh,
  businessName: "Acme",
  businessNumberE164: "+15715550188",
  completedSteps: ["business_line" as const],
  currentStep: "consent" as const,
};
assert.equal(inferResumeStep(partial), "consent");

console.log("test-mctb-onboarding-wizard-flow: ok");
