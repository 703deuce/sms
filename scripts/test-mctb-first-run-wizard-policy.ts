#!/usr/bin/env tsx
import assert from "node:assert/strict";
import {
  resolveMctbFirstRunWizardPolicy,
  shouldShowMctbFirstRunWizardModal,
} from "../src/lib/mctb/onboarding/first-run-policy";
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

const completeUnverifiedForwarding = resolveMctbFirstRunWizardPolicy({
  onboardingState: readyState,
  forwardingVerified: false,
});
assert.equal(completeUnverifiedForwarding.shouldAutoOpen, false);
assert.equal(completeUnverifiedForwarding.trigger, "none");

const forwardingPolicy = resolveMctbFirstRunWizardPolicy({
  onboardingState: readyState,
  forwardingVerified: false,
  setupGuideRequested: true,
});
assert.equal(forwardingPolicy.shouldAutoOpen, true);
assert.equal(forwardingPolicy.trigger, "setup_guide");

const donePolicy = resolveMctbFirstRunWizardPolicy({
  onboardingState: readyState,
  forwardingVerified: true,
});
assert.equal(donePolicy.shouldAutoOpen, false);

assert.equal(
  shouldShowMctbFirstRunWizardModal(incompletePolicy, "/mctb", false),
  true,
);
assert.equal(
  shouldShowMctbFirstRunWizardModal(incompletePolicy, "/mctb/missed-call-recovery", false),
  false,
);
assert.equal(
  shouldShowMctbFirstRunWizardModal(incompletePolicy, "/mctb/missed-calls", false),
  true,
);
assert.equal(
  shouldShowMctbFirstRunWizardModal(forwardingPolicy, "/mctb/missed-call-recovery", true),
  true,
);

console.log("test-mctb-first-run-wizard-policy: OK");
