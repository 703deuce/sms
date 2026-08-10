import type { CanonicalNextAction } from "@/lib/voice/workflow-runtime/canonical-state";

/** Runtime executes these when preconditions are satisfied — never LLM-chosen. */
export const DETERMINISTIC_NEXT_ACTIONS = new Set<CanonicalNextAction>([
  "validate_eligibility",
  "classify",
  "check_availability",
  "find_appointments",
]);

/** Internal domain tools the executor may invoke. Not exposed on the semantic LLM surface. */
export const RUNTIME_EXECUTED_TOOL_NAMES = new Set([
  "lookup_customer",
  "validate_eligibility",
  "classify_intent",
  "check_availability",
  "find_appointments",
]);

export function isDeterministicNextAction(action: CanonicalNextAction): boolean {
  return DETERMINISTIC_NEXT_ACTIONS.has(action);
}

export function toolNameForDeterministicAction(action: CanonicalNextAction): string | null {
  switch (action) {
    case "validate_eligibility":
      return "validate_eligibility";
    case "classify":
      return "classify_intent";
    case "check_availability":
      return "check_availability";
    case "find_appointments":
      return "find_appointments";
    default:
      return null;
  }
}
