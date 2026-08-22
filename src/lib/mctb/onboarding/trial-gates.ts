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
  /** When true, Telnyx A2P is already approved on the trial number. */
  messagingApproved?: boolean;
  /** TWILIO_TOLL_FREE vs TELNYX_LOCAL_A2P */
  numberClass?: "TWILIO_TOLL_FREE" | "TELNYX_LOCAL_A2P";
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

  const usesA2pPath =
    input.numberClass === "TELNYX_LOCAL_A2P" || input.messagingApproved === true;

  if (usesA2pPath) {
    if (!input.messagingApproved) {
      missing.push("a2p_approved");
    }
  } else if (!isTfvApproved(input.tfvStatus)) {
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
