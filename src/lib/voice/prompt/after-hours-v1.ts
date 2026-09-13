import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import {
  AFTER_HOURS_V1_CAPABILITY_LABELS,
  isAfterHoursVoiceProfile,
} from "@/lib/voice/runtime/voice-profile";

function wizardHasBookingLink(wizard: AppointmentReceptionistWizardState): boolean {
  return wizard.appointmentTypes.some(
    (t) => t.enabled && t.bookingPermission === "send_booking_link",
  );
}

/** Narrow after-hours V1 outcomes — complements workspace LR policy. */
export function buildAfterHoursV1WorkflowSection(
  wizard: AppointmentReceptionistWizardState,
): string {
  if (!isAfterHoursVoiceProfile(wizard)) return "";

  const lines: string[] = [
    `V1 capability set: ${AFTER_HOURS_V1_CAPABILITY_LABELS.join(", ")}.`,
    "- Answer approved business questions from Business Context without tools when possible.",
    "- Capture messages and callback requests; collect only fields the business requires.",
    "- Classify urgency; escalate or notify per emergency policy.",
    "- Never look up calendar availability, offer time slots, or create appointments on this call.",
    '- Never say a specific day or time is "available" or "booked" unless runtime confirmed it from a calendar tool (after-hours agents do not use calendar tools).',
  ];

  if (wizard.capabilities.includes("book_appointments") && wizardHasBookingLink(wizard)) {
    lines.push(
      "",
      "BOOKING LINK (not live scheduling):",
      "- When the caller wants to schedule or asks for a visit, respond naturally and gather any minimum details the business needs.",
      '- Offer: "I can text you the booking link so you can choose a time that works for you. Is it okay if I send that by text? Message and data rates may apply."',
      "- Only call send_resource with resource_type booking after clear verbal yes to text the link.",
      "- Pass verbal_sms_consent: true on send_resource when the caller agreed.",
      "- Confirm the text only after send_resource returns success; if it fails, take a callback request.",
      "- Do not end the call after sending the link — continue FAQs and message capture as needed.",
      "- Never repeat the same sentence twice in a row — if booking, move to consent, link send, or callback capture.",
    );
  } else if (wizard.capabilities.includes("book_appointments")) {
    lines.push(
      "",
      "Scheduling: no booking link is configured — capture appointment preference and create a callback request; notify the business.",
    );
  } else {
    lines.push(
      "",
      "Scheduling: capture appointment preference and callback details; do not promise live booking on this call.",
    );
  }

  return lines.join("\n");
}
