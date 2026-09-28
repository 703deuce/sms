import { MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE } from "@/lib/mctb/launch-flags";
import { isMctbDevFirstRunWizardEveryLogin } from "@/lib/mctb/onboarding/first-run-dev-override";
import { isOnboardingComplete, type MctbOnboardingState } from "@/lib/mctb/onboarding/state";

function everyLoginTestingActive(): boolean {
  return isMctbDevFirstRunWizardEveryLogin();
}

export type MctbFirstRunWizardTrigger =
  | "every_login_testing"
  | "incomplete_onboarding"
  | "setup_guide"
  | "none";

export type MctbFirstRunWizardPolicy = {
  shouldAutoOpen: boolean;
  trigger: MctbFirstRunWizardTrigger;
  everyLoginTesting: boolean;
  onboardingComplete: boolean;
};

export function resolveMctbFirstRunWizardPolicy(input: {
  onboardingState: MctbOnboardingState;
  setupGuideRequested?: boolean;
}): MctbFirstRunWizardPolicy {
  const onboardingComplete = isOnboardingComplete(input.onboardingState);

  if (input.setupGuideRequested) {
    return {
      shouldAutoOpen: true,
      trigger: "setup_guide",
      everyLoginTesting: everyLoginTestingActive(),
      onboardingComplete,
    };
  }

  if (everyLoginTestingActive()) {
    return {
      shouldAutoOpen: true,
      trigger: "every_login_testing",
      everyLoginTesting: true,
      onboardingComplete,
    };
  }

  if (MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE && !onboardingComplete) {
    return {
      shouldAutoOpen: true,
      trigger: "incomplete_onboarding",
      everyLoginTesting: false,
      onboardingComplete,
    };
  }

  return {
    shouldAutoOpen: false,
    trigger: "none",
    everyLoginTesting: false,
    onboardingComplete,
  };
}
