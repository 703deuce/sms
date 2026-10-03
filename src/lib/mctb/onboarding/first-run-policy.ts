import { MCTB_FIRST_RUN_WIZARD_UNTIL_COMPLETE } from "@/lib/mctb/launch-flags";
import { isMctbDevFirstRunWizardEveryLogin } from "@/lib/mctb/onboarding/first-run-dev-override";
import { isOnboardingComplete } from "@/lib/mctb/onboarding/completion";
import type { MctbOnboardingState } from "@/lib/mctb/onboarding/types";

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

/** Full-page setup editors — first-run modal must not block these (IA spec 07 / recovery hub). */
export const MCTB_DEDICATED_SETUP_PATH_PREFIXES = [
  "/mctb/missed-call-recovery",
  "/mctb/setup",
  "/onboarding/mctb",
  "/mctb/phone",
  "/mctb/text-back",
  "/mctb/notifications",
  "/mctb/ai-recovery",
  "/mctb/voicemail",
] as const;

export function isMctbDedicatedSetupPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return MCTB_DEDICATED_SETUP_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Modal auto-open on operational pages only — inline setup routes stay usable during incomplete onboarding. */
export function shouldShowMctbFirstRunWizardModal(
  policy: MctbFirstRunWizardPolicy,
  pathname: string | null | undefined,
  setupGuideQueryActive: boolean,
): boolean {
  if (!policy.shouldAutoOpen) return false;
  if (setupGuideQueryActive || policy.trigger === "setup_guide") return true;
  if (policy.trigger === "every_login_testing") return true;
  if (isMctbDedicatedSetupPath(pathname)) return false;
  return true;
}

export function resolveMctbFirstRunWizardPolicy(input: {
  onboardingState: MctbOnboardingState;
  setupGuideRequested?: boolean;
  /** True when CFNA forwarding has not been verified yet (post-wizard setup attention). */
  forwardingVerified?: boolean;
}): MctbFirstRunWizardPolicy {
  const onboardingComplete = isOnboardingComplete(input.onboardingState);
  const forwardingVerified = input.forwardingVerified !== false;

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
