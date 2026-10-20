import type { AppointmentReceptionistWizardState } from "./types";
import { normalizeWizardTransferPhone } from "./transfer-utils";
import { transferWizardValidationIssues } from "./transfer-wizard-state";
import { deriveBookingStrategyFromWizard } from "@/lib/voice-receptionist-wizard/booking-strategy";
import {
  wizardBookingRequiresCalendarConnection,
  wizardHasBusinessName,
  wizardKnowledgeSourceActivationIssues,
  wizardRequiresBookingLinkUrl,
  wizardRequiresOutboundSms,
} from "./wizard-readiness";

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

  if (!wizardHasBusinessName(state)) {
    issues.push({
      id: "business_name",
      severity: "blocking",
      message: "Add your business name on Business Knowledge.",
    });
  }
  for (const issue of wizardKnowledgeSourceActivationIssues(state)) {
    issues.push(issue);
  }

  if (state.capabilities.includes("transfer_calls") || state.voiceV2HumanTransferEnabled) {
    const hasDestRow = (state.transferDestinations ?? []).some(
      (d) => d.enabled !== false && Boolean(d.phoneE164?.trim()),
    );
    const legacyPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
    if (!hasDestRow && !legacyPhone) {
      issues.push({
        id: "transfer",
        severity: "blocking",
        message: "Add at least one valid transfer destination, or turn off Transfer calls.",
      });
    }
    for (const issue of transferWizardValidationIssues(state)) {
      issues.push({
        id: issue.id,
        severity: issue.id === "transfer_ui_warm_requires_platform" ? "warning" : "blocking",
        message: issue.message,
      });
    }
  }

  if (state.capabilities.includes("book_appointments")) {
    const strategy = deriveBookingStrategyFromWizard(state);
    const enabledTypes = state.appointmentTypes.filter((t) => t.enabled);
    if (!enabledTypes.length) {
      issues.push({
        id: "appointment_types",
        severity: "blocking",
        message: "Enable at least one appointment type for booking.",
      });
    }
    if (strategy === "CALENDLY") {
      issues.push({
        id: "booking_strategy_calendly",
        severity: "blocking",
        message:
          "Calendly live booking is not supported on Voice V3 — choose Microsoft/Google calendar booking, send a link, or request-only.",
      });
    }
    if (
      wizardBookingRequiresCalendarConnection(state) &&
      !ctx?.hasCalendarConnection &&
      !state.calendarConnected
    ) {
      issues.push({
        id: "calendar",
        severity: "blocking",
        message:
          "Connect Google or Microsoft calendar before activating live booking (Appointments step).",
      });
    }
    if (wizardRequiresBookingLinkUrl(state) && !state.bookingLinkUrl?.trim()) {
      issues.push({
        id: "booking_link",
        severity: "blocking",
        message: "Add your booking page URL for the send-link strategy.",
      });
    }
  }

  if (wizardRequiresOutboundSms(state)) {
    const sender =
      state.outboundSmsMode === "platform" ||
      state.outboundSmsPhoneNumberId ||
      state.aiCallRecoverySendingPhoneNumberId ||
      state.outboundSmsE164?.trim();
    if (!sender) {
      issues.push({
        id: "sms_sender",
        severity: "blocking",
        message:
          "Assign an outbound SMS number for booking links or AI call recovery (Numbers / Appointments).",
      });
    }
  }

  return issues;
}

export function hasBlockingActivationIssues(issues: ActivationIssue[]) {
  return issues.some((i) => i.severity === "blocking");
}
