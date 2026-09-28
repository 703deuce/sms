import assert from "node:assert/strict";
import {
  MCTB_FIRST_RUN_WIZARD_EVERY_LOGIN,
  MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE,
} from "../src/lib/mctb/launch-flags";
import { defaultMctbOnboardingState } from "../src/lib/mctb/onboarding/state";
import { resolveMctbFirstRunWizardPolicy } from "../src/lib/mctb/onboarding/first-run-policy";
import { listMctbPlatformRecoveryOpenerChoices } from "../src/lib/mctb/platform-recovery-template-choices";

const fresh = defaultMctbOnboardingState();

assert.equal(typeof MCTB_FIRST_RUN_WIZARD_EVERY_LOGIN, "boolean");
assert.equal(typeof MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE, "boolean");

const guide = resolveMctbFirstRunWizardPolicy({
  onboardingState: { ...fresh, currentStep: "ready", trialActivatedAt: new Date().toISOString() },
  setupGuideRequested: true,
});
assert.equal(guide.shouldAutoOpen, true);
assert.equal(guide.trigger, "setup_guide");

if (MCTB_FIRST_RUN_WIZARD_EVERY_LOGIN) {
  const every = resolveMctbFirstRunWizardPolicy({ onboardingState: fresh });
  assert.equal(every.shouldAutoOpen, true);
  assert.equal(every.trigger, "every_login_testing");
}

const complete = resolveMctbFirstRunWizardPolicy({
  onboardingState: { ...fresh, currentStep: "ready", trialActivatedAt: new Date().toISOString() },
});
if (!MCTB_FIRST_RUN_WIZARD_EVERY_LOGIN && MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE) {
  assert.equal(complete.shouldAutoOpen, false);
}

const platformChoices = listMctbPlatformRecoveryOpenerChoices();
assert.ok(platformChoices.length >= 1);
assert.ok(platformChoices[0].body.length > 10);

console.log("MCTB_FIRST_RUN_ONBOARDING policy: PASS");
console.log("MCTB_LOCKED_FEATURE_PRESENTATION (platform templates): PASS");
