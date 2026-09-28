#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { resolveMctbFirstRunWizardPolicy } from "../src/lib/mctb/onboarding/first-run-policy";
import type { MctbOnboardingState } from "../src/lib/mctb/onboarding/types";

const readyState = {
  version: 2,
  currentStep: "ready",
  completedSteps: ["ready"],
  trialActivatedAt: new Date().toISOString(),
} as MctbOnboardingState;

const incomplete = {
  version: 2,
  currentStep: "business_line",
  completedSteps: [],
} as MctbOnboardingState;

const incompletePolicy = resolveMctbFirstRunWizardPolicy({ onboardingState: incomplete });
assert.equal(incompletePolicy.shouldAutoOpen, true);
assert.equal(incompletePolicy.trigger, "incomplete_onboarding");

const forwardingPolicy = resolveMctbFirstRunWizardPolicy({
  onboardingState: readyState,
  forwardingVerified: false,
});
assert.equal(forwardingPolicy.shouldAutoOpen, true);
assert.equal(forwardingPolicy.trigger, "setup_guide");

const donePolicy = resolveMctbFirstRunWizardPolicy({
  onboardingState: readyState,
  forwardingVerified: true,
});
assert.equal(donePolicy.shouldAutoOpen, false);

console.log("test-mctb-first-run-wizard-policy: OK");
