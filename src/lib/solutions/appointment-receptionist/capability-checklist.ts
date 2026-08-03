import type { AppointmentReceptionistWizardState } from "./types";
import { normalizeWizardTransferPhone } from "./transfer-utils";

export type ActivationIssue = {
  id: string;
  severity: "blocking" | "warning";
  message: string;
};

/**
 * Wizard activation wiring status for appointment receptionist capabilities.
 * Mirrors receptionist-checklist tiers that the Activate step depends on.
 * Values: live | wizard_wired (DONE) — keep in sync with voice/capabilities/receptionist-checklist.
 */
export const APPOINTMENT_RECEPTIONIST_WIRING = {
  phone_connection: "wizard_wired",
  call_opening: "live",
  voice: "wizard_wired",
  recording_disclosure: "live",
  human_transfer: "live",
  warm_transfer: "wizard_wired",
  voicemail_detection: "wizard_wired",
  long_term_memory: "wizard_wired",
  crm_connection: "wizard_wired",
  calendar_connection: "wizard_wired",
  booking_tools: "live",
  message_taking: "live",
  activation_modes: "wizard_wired",
  live_webrtc_test_gate: "wizard_wired",
} as const;

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
