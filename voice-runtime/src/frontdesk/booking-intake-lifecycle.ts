import type { FrontDeskUserData } from "./userdata";
import type { BookingIntakeResult } from "./booking-intake-task";
import { formatToolFeedbackForModel } from "@/lib/voice/tool-feedback";
import { toolFeedbackFromBookingIntakeResult } from "../tool-feedback-lifecycle";

export const TOOL_RESULT_BOOKING_INTAKE_SILENT =
  "BOOKING_INTAKE_ACTIVE_SILENT: Booking intake owns speech. Do not speak — questions are handled by the intake task.";

export function buildBookingIntakeToolResult(
  ud: FrontDeskUserData,
  result: BookingIntakeResult,
): string {
  return formatToolFeedbackForModel(toolFeedbackFromBookingIntakeResult(ud, result));
}
