import { isTfvApproved, type TollFreeVerificationStatus } from "@/lib/messaging/compliance/messaging-compliance";
import { isPlatformDemoNumber } from "./demo";

export type TrialActivationGateInput = {
  trialPhoneE164: string | null;
  trialPhoneNumberId: string | null;
  tfvPhoneNumberId: string | null;
  tfvStatus: TollFreeVerificationStatus;
  forwardingConnected: boolean;
  liveTestPassed: boolean;
  trialAlreadyStarted: boolean;
};

export type TrialActivationGateResult = {
  canActivate: boolean;
  missing: string[];
};

/** Pure gate evaluation — used by activateMctbTrial and automated tests. */
export function evaluateTrialActivationGates(
  input: TrialActivationGateInput,
): TrialActivationGateResult {
  const missing: string[] = [];

  if (!input.trialPhoneNumberId || !input.trialPhoneE164) {
    missing.push("trial_number_assigned");
  } else if (isPlatformDemoNumber(input.trialPhoneE164)) {
    missing.push("demo_number_not_allowed");
  }

  if (!input.tfvPhoneNumberId || input.tfvPhoneNumberId !== input.trialPhoneNumberId) {
    missing.push("tfv_workspace_isolation");
  }

  if (!isTfvApproved(input.tfvStatus)) {
    missing.push("tfv_approved");
  }

  if (!input.forwardingConnected) {
    missing.push("forwarding_connected");
  }

  if (!input.liveTestPassed) {
    missing.push("live_test_passed");
  }

  return {
    canActivate: missing.length === 0,
    missing,
  };
}

export function canActivateTrialFromGates(
  input: TrialActivationGateInput,
): boolean {
  if (input.trialAlreadyStarted) return true;
  return evaluateTrialActivationGates(input).canActivate;
}
