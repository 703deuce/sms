import type { VoiceV3Goal } from "../state/call-context";
import type { CallerMeaning } from "./caller-meaning-schema";
import type { CallerGoalMeaning } from "./caller-goal-meaning";

function dialogGoalToCallerGoal(goal: VoiceV3Goal): CallerGoalMeaning["type"] | null {
  switch (goal) {
    case "BOOK_APPOINTMENT":
      return "BOOK_APPOINTMENT";
    case "RESCHEDULE_APPOINTMENT":
      return "RESCHEDULE_APPOINTMENT";
    case "CANCEL_APPOINTMENT":
      return "CANCEL_APPOINTMENT";
    case "REQUEST_CALLBACK":
      return "CALLBACK";
    case "REQUEST_TRANSFER":
      return "TRANSFER";
    case "GENERAL":
      return "GENERAL_INFORMATION";
    default:
      return null;
  }
}

/** Canonical semantic goals for one turn — backward compatible with active_goal only. */
export function normalizeCallerGoals(meaning: CallerMeaning): CallerGoalMeaning[] {
  const fromArray = meaning.goals ?? [];
  if (fromArray.length > 0) return fromArray;
  const mapped = dialogGoalToCallerGoal(meaning.active_goal);
  if (!mapped) return [];
  const disposition =
    meaning.active_goal === "UNKNOWN" || meaning.active_goal === "GENERAL"
      ? "CONTINUE"
      : "START";
  return [{ type: mapped, disposition }];
}
