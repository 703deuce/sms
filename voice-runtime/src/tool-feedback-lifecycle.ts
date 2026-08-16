import type { FrontDeskUserData } from "./frontdesk/userdata";
import type { BookingIntakeResult } from "./frontdesk/booking-intake-task";
import type { ReceptionistFieldCollectionResult } from "./frontdesk/receptionist/field-collection-task";
import { deriveAuthoritativeBookingState } from "./frontdesk/booking-state";
import {
  toolFeedbackRecoverable,
  toolFeedbackSuccess,
  type ToolFeedback,
  type ToolNextAction,
} from "@/lib/voice/tool-feedback";

export function toolFeedbackFromCollectionResult(
  ud: FrontDeskUserData,
  result: ReceptionistFieldCollectionResult,
  tool = "collect_caller_fields",
): ToolFeedback {
  const fields = ud.receptionistFields || {};
  const summary = Object.entries(fields)
    .filter(([, value]) => value?.trim())
    .map(([id, value]) => `${id}=${value.trim()}`)
    .join(", ");

  if (!result.complete) {
    const guidance = summary
      ? `Partial collection: ${summary}. Field task owns speech — do not speak.`
      : "Field collection task owns speech. Do not speak.";
    return toolFeedbackRecoverable({
      tool,
      recovery_class: "OPERATION_IN_PROGRESS",
      reason: "collection_active",
      next_action: "do_not_speak",
      runtime_handled_retry: true,
      guidance,
      context: summary ? { fields_summary: summary } : undefined,
    });
  }

  ud.receptionistFieldCollectionComplete = true;
  ud.receptionistFieldsAcknowledged = true;

  const pendingSlot = ud.pendingSlotId || ud.bookingOperation?.slotId;
  const nextAction: ToolNextAction = pendingSlot ? "schedule_appointment_retry" : "continue_conversation";
  const bookingTail = pendingSlot
    ? ` Call schedule_appointment immediately with slot_id ${pendingSlot}.`
    : "";

  return toolFeedbackSuccess(
    `Collection complete: ${summary || "no fields"}. Fields were captured and acknowledged — do not reconfirm.${bookingTail}`,
    {
      tool,
      next_action: nextAction,
      context: {
        fields_summary: summary || null,
        pending_slot_id: pendingSlot ?? null,
      },
      guidance:
        "Continue with take_message, booking, transfer, or answering. Do not thank again or reconfirm captured fields." +
        bookingTail,
    },
  );
}

export function toolFeedbackFromBookingIntakeResult(
  ud: FrontDeskUserData,
  result: BookingIntakeResult,
  tool = "collect_booking_requirements",
): ToolFeedback {
  const fields = ud.receptionistFields || {};
  const summary = Object.entries(fields)
    .filter(([, value]) => value?.trim())
    .map(([id, value]) => `${id}=${value.trim()}`)
    .join(", ");

  if (!result.complete) {
    const missing =
      result.collected.length > 0
        ? deriveAuthoritativeBookingState(ud).missingFields.map((f) => f.fieldId).join(", ")
        : "unknown";
    const guidance = summary
      ? `Partial intake: ${summary}. Still missing: ${missing}. Intake task owns speech — do not speak.`
      : "Booking intake owns speech. Do not speak.";
    return toolFeedbackRecoverable({
      tool,
      recovery_class: "OPERATION_IN_PROGRESS",
      reason: "intake_active",
      next_action: "do_not_speak",
      runtime_handled_retry: true,
      guidance,
      context: { fields_summary: summary || null, missing },
    });
  }

  ud.receptionistFieldCollectionComplete = true;
  ud.receptionistFieldsAcknowledged = true;

  const slotId = ud.pendingSlotId || ud.bookingOperation?.slotId;
  const nextAction: ToolNextAction = slotId ? "schedule_appointment_retry" : "continue_conversation";

  return toolFeedbackSuccess(
    `Booking intake complete: ${summary || "no fields"}. All requirements satisfied — do not reconfirm captured fields.`,
    {
      tool,
      next_action: nextAction,
      context: { fields_summary: summary || null, slot_id: slotId ?? null },
      guidance:
        "All booking requirements are satisfied in authoritative state. " +
        (slotId
          ? `Call schedule_appointment immediately with slot_id ${slotId}.`
          : "Continue with slot selection or schedule_appointment."),
    },
  );
}
