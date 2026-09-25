import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  ensureEmergencyTransferWizardState,
  transferWizardValidationIssues,
} from "@/lib/solutions/appointment-receptionist/transfer-wizard-state";
import { normalizeWizardTransferPhone } from "@/lib/solutions/appointment-receptionist/transfer-utils";

export type EffectiveTransferState = {
  capabilityEnabled: boolean;
  transferSwitchEnabled: boolean;
  hasValidDestination: boolean;
  validationIssues: ReturnType<typeof transferWizardValidationIssues>;
  /** Matches compileVoiceV3TransferPolicyFromWizard `enabled`. */
  canAmyTransferNow: boolean;
  blockers: string[];
};

/** Customer-facing effective transfer eligibility — mirrors transfer compile policy. */
export function deriveEffectiveTransferState(
  state: AppointmentReceptionistWizardState,
): EffectiveTransferState {
  const normalized = ensureEmergencyTransferWizardState(state);
  const capabilityEnabled = normalized.capabilities.includes("transfer_calls");
  const transferSwitchEnabled = normalized.voiceV2HumanTransferEnabled !== false;
  const destinations = (normalized.transferDestinations ?? []).filter(
    (d) => d.enabled !== false,
  );
  const hasValidDestination = destinations.some((d) =>
    Boolean(normalizeWizardTransferPhone(d.phoneE164)),
  );
  const validationIssues = transferWizardValidationIssues(normalized);

  const blockers: string[] = [];
  if (!capabilityEnabled) {
    blockers.push("Transfer calls is turned off for this agent.");
  }
  if (!transferSwitchEnabled) {
    blockers.push("Emergency & human transfer is disabled.");
  }
  if (!hasValidDestination) {
    blockers.push("Add at least one transfer contact with a valid phone number.");
  }
  for (const issue of validationIssues) {
    blockers.push(issue.message);
  }

  const canAmyTransferNow =
    capabilityEnabled && transferSwitchEnabled && hasValidDestination && validationIssues.length === 0;

  return {
    capabilityEnabled,
    transferSwitchEnabled,
    hasValidDestination,
    validationIssues,
    canAmyTransferNow,
    blockers,
  };
}

export function withTransferCallsCapability(
  state: AppointmentReceptionistWizardState,
  enabled: boolean,
): AppointmentReceptionistWizardState {
  const caps = new Set(state.capabilities);
  if (enabled) caps.add("transfer_calls");
  else caps.delete("transfer_calls");
  return { ...state, capabilities: [...caps] };
}
