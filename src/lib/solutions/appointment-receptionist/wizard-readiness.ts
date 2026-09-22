import type { AppointmentReceptionistWizardState } from "./types";
import {
  deriveBookingStrategyFromWizard,
  voiceV2StrategyAllowsFindBook,
} from "@/lib/voice-receptionist-wizard/booking-strategy";

/** Live FIND/BOOK on Microsoft/Google — not Calendly, link, or request-only. */
export function wizardBookingRequiresCalendarConnection(
  state: AppointmentReceptionistWizardState,
): boolean {
  if (!state.capabilities.includes("book_appointments")) return false;
  const strategy = deriveBookingStrategyFromWizard(state);
  if (!voiceV2StrategyAllowsFindBook(strategy)) return false;
  // Calendly live booking is not a supported Voice V3 product path.
  if (strategy === "CALENDLY") return false;
  return true;
}

export function wizardRequiresOutboundSms(
  state: AppointmentReceptionistWizardState,
): boolean {
  const strategy = deriveBookingStrategyFromWizard(state);
  if (strategy === "SEND_LINK") return true;
  if (state.aiCallRecoveryEnabled === true) return true;
  return false;
}

export function wizardRequiresBookingLinkUrl(
  state: AppointmentReceptionistWizardState,
): boolean {
  return deriveBookingStrategyFromWizard(state) === "SEND_LINK";
}

/** Minimum business identity for activation — name only; knowledge paths are conditional. */
export function wizardHasBusinessName(state: AppointmentReceptionistWizardState): boolean {
  return Boolean(state.businessName?.trim());
}

/** Extra requirements for the knowledge source the customer actually chose. */
export function wizardKnowledgeSourceActivationIssues(
  state: AppointmentReceptionistWizardState,
): Array<{ id: string; severity: "blocking" | "warning"; message: string }> {
  const issues: Array<{ id: string; severity: "blocking" | "warning"; message: string }> =
    [];
  const src = state.knowledgeSource;

  if (src === "website" && !state.websiteUrl?.trim()) {
    issues.push({
      id: "website_url",
      severity: "blocking",
      message:
        "Add a website URL on Business Knowledge, or switch to guided profile / manual entries.",
    });
  }

  if (src === "guided_profile") {
    const hasProfile = state.knowledgeItems.some(
      (k) => k.status === "complete" || Boolean(k.summary?.trim()),
    );
    if (!hasProfile) {
      issues.push({
        id: "guided_profile",
        severity: "blocking",
        message: "Save your business profile to knowledge before activating.",
      });
    }
  }

  if (src === "upload_docs" || src === "connect_data") {
    const hasLinked = Boolean(state.linkedKnowledgeBaseId?.trim());
    const hasItems = state.knowledgeItems.some(
      (k) => k.status === "complete" || Boolean(k.summary?.trim()),
    );
    if (!hasLinked && !hasItems) {
      issues.push({
        id: "knowledge_upload_connect",
        severity: "blocking",
        message:
          "Connect or upload knowledge sources you selected, or change the knowledge method.",
      });
    }
  }

  return issues;
}

export function wizardKnowledgeRetrievalSelected(
  state: AppointmentReceptionistWizardState,
): boolean {
  if (state.knowledgeBaseEnabled === false) return false;
  const src = state.knowledgeSource;
  return (
    src === "upload_docs" ||
    src === "website" ||
    src === "connect_data" ||
    Boolean(state.linkedKnowledgeBaseId?.trim())
  );
}

export type ReadinessRow = {
  id: string;
  label: string;
  status: "ready" | "needs_setup" | "optional" | "not_enabled";
  detail: string;
  blocksActivation: boolean;
};

export function buildWizardReadinessRows(
  state: AppointmentReceptionistWizardState,
  ctx: {
    hasCalendarConnection?: boolean;
  },
): ReadinessRow[] {
  const rows: ReadinessRow[] = [];
  const hasCalendar = Boolean(ctx.hasCalendarConnection || state.calendarConnected);

  rows.push({
    id: "phone",
    label: "Phone number",
    status: state.phoneNumberId ? "ready" : "needs_setup",
    detail: state.phoneNumberId ? "Assigned" : "Assign a number",
    blocksActivation: !state.phoneNumberId,
  });

  rows.push({
    id: "agent_name",
    label: "Receptionist name",
    status: state.agentName?.trim() ? "ready" : "needs_setup",
    detail: state.agentName?.trim() || "Set on Voice step",
    blocksActivation: !state.agentName?.trim(),
  });

  rows.push({
    id: "business_name",
    label: "Business name",
    status: wizardHasBusinessName(state) ? "ready" : "needs_setup",
    detail: state.businessName?.trim() || "Set on Business Knowledge",
    blocksActivation: !wizardHasBusinessName(state),
  });

  for (const issue of wizardKnowledgeSourceActivationIssues(state)) {
    rows.push({
      id: issue.id,
      label: "Knowledge setup",
      status: "needs_setup",
      detail: issue.message,
      blocksActivation: issue.severity === "blocking",
    });
  }

  rows.push({
    id: "voice",
    label: "Voice",
    status: state.voiceId?.trim() ? "ready" : "needs_setup",
    detail: state.voiceLabel || (state.voiceId ? "Selected" : "Choose a voice"),
    blocksActivation: !state.voiceId?.trim(),
  });

  rows.push({
    id: "greeting",
    label: "Opening greeting",
    status: state.openingGreeting?.trim() ? "ready" : "needs_setup",
    detail: state.openingGreeting?.trim() ? "Ready" : "Add greeting copy",
    blocksActivation: !state.openingGreeting?.trim(),
  });

  if (state.capabilities.includes("book_appointments")) {
    const strategy = deriveBookingStrategyFromWizard(state);
    if (strategy === "CALENDLY") {
      rows.push({
        id: "booking_strategy",
        label: "Booking strategy",
        status: "needs_setup",
        detail: "Calendly live booking is not supported — choose Microsoft, link, or request-only",
        blocksActivation: true,
      });
    } else if (wizardBookingRequiresCalendarConnection(state)) {
      rows.push({
        id: "calendar",
        label: "Calendar",
        status: hasCalendar ? "ready" : "needs_setup",
        detail: hasCalendar ? "Connected" : "Connect Google or Microsoft",
        blocksActivation: !hasCalendar,
      });
    }
    const enabledTypes = state.appointmentTypes.filter((t) => t.enabled);
    rows.push({
      id: "appointment_types",
      label: "Appointment types",
      status: enabledTypes.length ? "ready" : "needs_setup",
      detail: enabledTypes.length ? `${enabledTypes.length} enabled` : "Enable at least one",
      blocksActivation: !enabledTypes.length,
    });
    if (wizardRequiresBookingLinkUrl(state)) {
      const url = state.bookingLinkUrl?.trim();
      rows.push({
        id: "booking_link",
        label: "Booking link URL",
        status: url ? "ready" : "needs_setup",
        detail: url ? "Set" : "Add your scheduling page URL",
        blocksActivation: !url,
      });
    }
  }

  if (state.capabilities.includes("transfer_calls") || state.voiceV2HumanTransferEnabled) {
    const hasDestRow = (state.transferDestinations ?? []).some(
      (d) => d.enabled !== false && Boolean(d.phoneE164?.trim()),
    );
    const legacy = Boolean(state.transferDestinationPhone?.trim());
    rows.push({
      id: "transfer",
      label: "Transfer destination",
      status: hasDestRow || legacy ? "ready" : "needs_setup",
      detail: hasDestRow || legacy ? "Configured" : "Add a phone number",
      blocksActivation: !(hasDestRow || legacy),
    });
  }

  if (wizardRequiresOutboundSms(state)) {
    const sender =
      state.outboundSmsPhoneNumberId ||
      state.aiCallRecoverySendingPhoneNumberId ||
      state.outboundSmsE164?.trim();
    rows.push({
      id: "sms_sender",
      label: "Outbound SMS sender",
      status: sender ? "ready" : "needs_setup",
      detail: sender ? "Ready" : "Assign a text-back / SMS number",
      blocksActivation: !sender,
    });
  }

  if (wizardKnowledgeRetrievalSelected(state)) {
    const hasKb =
      Boolean(state.linkedKnowledgeBaseId?.trim()) ||
      state.knowledgeItems.some((k) => k.status === "complete" || Boolean(k.summary?.trim()));
    rows.push({
      id: "knowledge_index",
      label: "Document knowledge",
      status: hasKb ? "ready" : "optional",
      detail: hasKb
        ? "Sources linked — indexing may continue after activate"
        : "Add or link sources (optional until content exists)",
      blocksActivation: false,
    });
  }

  rows.push({
    id: "recording",
    label: "Call recording",
    status: state.callRecording === "off" ? "ready" : "optional",
    detail:
      state.callRecording === "off"
        ? "Off"
        : "On — disclose recording to callers",
    blocksActivation: false,
  });

  rows.push({
    id: "browser_test",
    label: "Browser test",
    status: "optional",
    detail: "Try your draft on the Test step before go-live (recommended)",
    blocksActivation: false,
  });

  return rows;
}
