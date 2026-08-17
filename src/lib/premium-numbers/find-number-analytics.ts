export type FindNumberAiEvent =
  | "ai_search_opened"
  | "ai_prompt_submitted"
  | "ai_search_completed"
  | "ai_followup_sent"
  | "ai_suggestion_clicked"
  | "ai_result_explained"
  | "ai_compare_used"
  | "ai_similar_search"
  | "ai_to_manual_switch"
  | "manual_to_ai_switch"
  | "number_saved_from_ai"
  | "number_reserved_from_ai"
  | "number_purchased_from_ai";

export function trackFindNumberAiEvent(
  event: FindNumberAiEvent,
  props?: Record<string, string | number | boolean | null | undefined>,
) {
  console.info(
    JSON.stringify({
      scope: "find_number_ai",
      event,
      ...props,
    }),
  );
}
