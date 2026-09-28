import assert from "node:assert/strict";
import { MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE } from "../src/lib/mctb/launch-flags";
import { defaultMctbOnboardingState } from "../src/lib/mctb/onboarding/state";
import { resolveMctbFirstRunWizardPolicy } from "../src/lib/mctb/onboarding/first-run-policy";
import { listMctbPlatformRecoveryOpenerChoices } from "../src/lib/mctb/platform-recovery-template-choices";
import { MCTB_WIZARD_PRIMARY_STEPS } from "../src/lib/mctb/onboarding/wizard-flow";

const fresh = defaultMctbOnboardingState();

assert.equal(typeof MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE, "boolean");
assert.ok(MCTB_WIZARD_PRIMARY_STEPS.includes("notifications"));

const guide = resolveMctbFirstRunWizardPolicy({
  onboardingState: { ...fresh, currentStep: "ready", trialActivatedAt: new Date().toISOString() },
  setupGuideRequested: true,
});
assert.equal(guide.shouldAutoOpen, true);
assert.equal(guide.trigger, "setup_guide");

const incomplete = resolveMctbFirstRunWizardPolicy({ onboardingState: fresh });
if (MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE) {
  assert.equal(incomplete.shouldAutoOpen, true);
  assert.equal(incomplete.trigger, "incomplete_onboarding");
}

const complete = resolveMctbFirstRunWizardPolicy({
  onboardingState: { ...fresh, currentStep: "ready", trialActivatedAt: new Date().toISOString() },
});
assert.equal(complete.shouldAutoOpen, false);
assert.equal(complete.trigger, "none");

const platformChoices = listMctbPlatformRecoveryOpenerChoices();
assert.ok(platformChoices.length >= 1);
assert.ok(platformChoices[0].body.length > 10);

console.log("MCTB_FIRST_RUN_ONBOARDING policy: PASS");
console.log("MCTB_LOCKED_FEATURE_PRESENTATION (platform templates): PASS");
