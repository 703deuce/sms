import type { VoiceV3Goal } from "../state/call-context";
import type { CallerMeaning } from "./caller-meaning-schema";
import { schedulingMeaningHasSignal } from "../time/scheduling-normalizer";

/**
 * Merge dialog goal from Astra — order-independent; never downgrade an established booking goal
 * to UNKNOWN because a later turn only supplied intake fields.
 */
export function mergeActiveGoalFromMeaning(
  previous: VoiceV3Goal,
  meaning: CallerMeaning,
): VoiceV3Goal {
  const incoming = meaning.active_goal;

  if (
    incoming === "BOOK_APPOINTMENT" ||
    incoming === "RESCHEDULE_APPOINTMENT" ||
    incoming === "CANCEL_APPOINTMENT" ||
    incoming === "REQUEST_CALLBACK" ||
    incoming === "REQUEST_TRANSFER"
  ) {
    return incoming;
  }

  if (schedulingMeaningHasSignal(meaning.scheduling)) {
    if (previous === "RESCHEDULE_APPOINTMENT" || previous === "CANCEL_APPOINTMENT") {
      return previous;
    }
    if (previous === "UNKNOWN" || previous === "GENERAL") {
      return "BOOK_APPOINTMENT";
    }
    return previous;
  }

  if (incoming === "GENERAL" && previous !== "UNKNOWN") {
    return previous;
  }

  if (incoming === "UNKNOWN") {
    return previous;
  }

  return incoming;
}
