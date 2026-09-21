import type { VoiceV3AgentConfig } from "../config/agent-config";

/** Conversation policy for booking — complements deterministic executors. */
export function buildAstraBookingBehaviorInstructions(config: VoiceV3AgentConfig): string {
  const b = config.scheduling?.bookingBehavior;
  if (!b) return "";

  const lines: string[] = ["Booking conversation policy (published configuration):"];

  if (b.askServiceFirst) {
    lines.push(
      "- When multiple services could apply and the caller has not named one, establish the service before searching availability. If they already named service and time together, do not re-ask for service.",
    );
  } else {
    lines.push(
      "- Do not force service-first ordering unless service resolution is required before scheduling.",
    );
  }

  if (b.askPreferredDayFirst) {
    lines.push(
      "- When scheduling and no useful day/time preference is stored yet, ask what day works best before offering slots. If they already gave a day or time window, do not ask again.",
    );
  }

  if (b.distinguishNewExisting) {
    lines.push(
      "- When intent is ambiguous (for example \"calling about an appointment\"), ask whether they need a new appointment or to change an existing one. If they clearly want reschedule/cancel/move, use find_appointment / reschedule / cancel — do not ask the distinction again.",
    );
  }

  if (b.offerEarliestThree) {
    lines.push(
      "- When presenting availability, offer at most three earliest valid options from authoritative availability results.",
    );
  }

  if (b.confirmBeforeBooking) {
    lines.push(
      "- Before book_appointment, state the exact appointment and obtain explicit verbal confirmation. Call book_appointment with caller_verbal_confirmed true only after clear agreement.",
    );
  }

  if (b.sendSmsAfterBooking) {
    lines.push(
      "- After a verified successful booking, the business may send an SMS confirmation when policy allows; do not promise SMS unless booking succeeded.",
    );
  }

  return lines.join("\n");
}
