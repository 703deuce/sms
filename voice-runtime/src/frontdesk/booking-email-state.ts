import {
  formatToolFeedbackForModel,
  toolFeedbackInvalidEmail,
  toolFeedbackSuccess,
} from "@/lib/voice/tool-feedback";
import { isValidEmail, normalizeSpokenEmail } from "./email-utils";
import type { FrontDeskUserData } from "./userdata";

export type PersistBookingEmailResult =
  | { ok: true; email: string; unchanged: boolean }
  | { ok: false; reason: "invalid"; rejected: string };

/** Canonical booking email write — mirrors receptionistFields.email and confirmedEmail. */
export function persistConfirmedBookingEmail(
  ud: FrontDeskUserData,
  rawEmail: string,
): PersistBookingEmailResult {
  const trimmed = rawEmail?.trim() || "";
  const normalized = normalizeSpokenEmail(trimmed);
  if (!isValidEmail(normalized)) {
    return { ok: false, reason: "invalid", rejected: trimmed };
  }

  const priorConfirmed = ud.confirmedEmail?.trim().toLowerCase();
  const priorField = ud.receptionistFields?.email?.trim().toLowerCase();
  const unchanged =
    priorConfirmed === normalized.toLowerCase() && priorField === normalized.toLowerCase();

  ud.confirmedEmail = normalized;
  ud.draftEmail = undefined;
  if (!ud.receptionistFields) ud.receptionistFields = {};
  ud.receptionistFields.email = normalized;

  return { ok: true, email: normalized, unchanged };
}

export function formatBookingEmailSavedFeedback(
  ud: FrontDeskUserData,
  tool: string,
  result: PersistBookingEmailResult,
): string {
  if (!result.ok) {
    return formatToolFeedbackForModel(toolFeedbackInvalidEmail(result.rejected));
  }

  const slotId = ud.pendingSlotId || ud.bookingOperation?.slotId;
  const scheduleTail = slotId
    ? ` Call schedule_appointment with slot_id ${slotId} to complete booking.`
    : "";

  if (result.unchanged) {
    return formatToolFeedbackForModel(
      toolFeedbackSuccess(
        `Email is already ${result.email}. Do NOT call record_booking_email or record email again.${scheduleTail}`,
        {
          tool,
          next_action: slotId ? "schedule_appointment_retry" : "none",
        },
      ),
    );
  }

  return formatToolFeedbackForModel(
    toolFeedbackSuccess(`Email saved as ${result.email}.${scheduleTail}`, {
      tool,
      next_action: slotId ? "schedule_appointment_retry" : "none",
      context: slotId ? { slot_id: slotId } : undefined,
    }),
  );
}
