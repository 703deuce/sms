import type { FrontDeskUserData } from "../userdata";
import type { ReceptionistFieldCollectionResult } from "./field-collection-task";

export const TOOL_RESULT_COLLECT_ACTIVE_SILENT =
  "COLLECT_ACTIVE_SILENT: Field collection owns speech. Do not speak — questions are handled by the collection task.";

/** Build an operational tool result from runtime state — not conversational replay. */
export function buildReceptionistCollectionToolResult(
  ud: FrontDeskUserData,
  result: ReceptionistFieldCollectionResult,
): string {
  const fields = ud.receptionistFields || {};
  const summary = Object.entries(fields)
    .filter(([, value]) => value?.trim())
    .map(([id, value]) => `${id}=${value.trim()}`)
    .join(", ");

  if (!result.complete) {
    return summary
      ? `COLLECTION_PARTIAL: ${summary}. Field task owns speech — do not speak.`
      : TOOL_RESULT_COLLECT_ACTIVE_SILENT;
  }

  ud.receptionistFieldCollectionComplete = true;
  ud.receptionistFieldsAcknowledged = true;

  const pendingSlot = ud.pendingSlotId || ud.bookingOperation?.slotId;
  const bookingTail = pendingSlot
    ? ` Call schedule_appointment immediately with slot_id ${pendingSlot} to finish booking.`
    : "";

  return (
    `COLLECTION_COMPLETE: ${summary || "no fields"}. ` +
    "These fields were captured during collection and already acknowledged. " +
    "Continue immediately with take_message, booking, transfer, or answering. " +
    "Do not thank again or reconfirm captured fields." +
    bookingTail
  );
}
