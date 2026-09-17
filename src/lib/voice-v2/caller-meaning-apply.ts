import type { CallerMeaning } from "./caller-meaning";
import type {
  VoiceCallerIntentInterpretation,
  VoiceCallerIntentEntities,
} from "./caller-intent-interpreter";

/** Single conversion boundary: CallerMeaning → legacy merge input. */
export function callerMeaningToIntentInterpretation(
  meaning: CallerMeaning,
): VoiceCallerIntentInterpretation {
  const entities: VoiceCallerIntentEntities = {
    requested_day: meaning.facts.requested_date ?? null,
    requested_daypart: meaning.facts.requested_daypart ?? null,
    requested_time: meaning.facts.requested_time ?? null,
  };

  const explicit =
    meaning.explicit_action_requests.length > 0 ||
    meaning.active_goal === "CALLBACK_REQUEST" ||
    meaning.active_goal === "TRANSFER_TO_HUMAN" ||
    meaning.active_goal === "CANCEL_APPOINTMENT";

  return {
    intent: meaning.active_goal,
    confidence: meaning.confidence,
    explicit,
    evidence: meaning.evidence.slice(0, 240),
    entities,
    digression: meaning.digression,
  };
}
