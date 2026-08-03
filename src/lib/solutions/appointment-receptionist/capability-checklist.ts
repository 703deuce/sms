import type { AppointmentReceptionistWizardState } from "./types";
import { normalizeWizardTransferPhone } from "./sync-transfer";

export type ActivationIssue = {
  id: string;
  severity: "blocking" | "warning";
  message: string;
};

/**
 * Minimum activation checklist for Appointment Receptionist.
 * Blocking issues prevent Activate; warnings surface but allow go-live.
 */
export function getWizardActivationIssues(
  state: AppointmentReceptionistWizardState,
  ctx?: {
    hasCalendarConnection?: boolean;
    hasKnowledgeText?: boolean;
  },
): ActivationIssue[] {
  const issues: ActivationIssue[] = [];

  if (!state.phoneNumberId) {
    issues.push({
      id: "phone",
      severity: "blocking",
      message: "Connect a phone number before activating.",
    });
  }
  if (!state.agentName?.trim()) {
    issues.push({
      id: "agent_name",
      severity: "blocking",
      message: "Set a receptionist name.",
    });
  }
  if (!state.voiceId?.trim()) {
    issues.push({
      id: "voice",
      severity: "blocking",
      message: "Select a voice.",
    });
  }
  if (!state.openingGreeting?.trim()) {
    issues.push({
      id: "greeting",
      severity: "blocking",
      message: "Configure an opening greeting.",
    });
  }

  const hasKnowledge =
    ctx?.hasKnowledgeText ||
    Boolean(state.businessName?.trim()) ||
    state.knowledgeItems.some((k) => k.status === "complete" || Boolean(k.summary?.trim())) ||
    Boolean(state.websiteUrl?.trim());
  if (!hasKnowledge) {
    issues.push({
      id: "knowledge",
      severity: "blocking",
      message:
        "Add a business name or other business information (hours, services, or FAQ) so the agent can answer questions.",
    });
  } else if (!state.businessName?.trim()) {
    issues.push({
      id: "business_name",
      severity: "warning",
      message: "Add a business name so callers hear who they’re calling.",
    });
  }

  if (state.capabilities.includes("transfer_calls")) {
    const phone = normalizeWizardTransferPhone(state.transferDestinationPhone);
    if (!phone) {
      issues.push({
        id: "transfer",
        severity: "blocking",
        message: "Add a valid transfer phone number, or turn off Transfer calls.",
      });
    }
  }

  if (state.capabilities.includes("book_appointments")) {
    const enabledTypes = state.appointmentTypes.filter((t) => t.enabled);
    if (!enabledTypes.length) {
      issues.push({
        id: "appointment_types",
        severity: "blocking",
        message: "Enable at least one appointment type for booking.",
      });
    }
    if (!ctx?.hasCalendarConnection && !state.calendarConnected) {
      issues.push({
        id: "calendar",
        severity: "blocking",
        message:
          "Connect a live calendar before activating booking — link Google, Microsoft, or Transovo Calendar under Appointments.",
      });
    }
  }

  if (state.lastTestPassed === false) {
    issues.push({
      id: "test",
      severity: "blocking",
      message: "Last test did not pass — retest before going live.",
    });
  } else if (state.lastTestPassed === null) {
    issues.push({
      id: "test",
      severity: "warning",
      message: "No successful test recorded yet — consider running a test before going live.",
    });
  }

  if (state.callRecording !== "off") {
    issues.push({
      id: "recording_disclosure",
      severity: "warning",
      message:
        "Call recording is on — ensure callers hear a recording disclosure at the start of the call.",
    });
  }

  return issues;
}

export function hasBlockingActivationIssues(issues: ActivationIssue[]) {
  return issues.some((i) => i.severity === "blocking");
}
