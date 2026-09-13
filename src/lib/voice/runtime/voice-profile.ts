import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";

/** After-hours / MCTB narrow voice agent — not full appointment receptionist. */
export function isAfterHoursVoiceProfile(
  wizard: Pick<
    AppointmentReceptionistWizardState,
    "preset" | "answerWhen" | "ringBehavior"
  >,
): boolean {
  return (
    wizard.preset === "after_hours" ||
    wizard.answerWhen === "after_hours" ||
    wizard.ringBehavior === "after_hours"
  );
}

/** Product V1 capability labels (prompt + docs); runtime maps to LR actions + Telnyx tools. */
export const AFTER_HOURS_V1_CAPABILITY_LABELS = [
  "answer_approved_faqs",
  "message_capture",
  "urgency_identification",
  "callback_requests",
  "booking_link_send",
  "business_notification",
] as const;
