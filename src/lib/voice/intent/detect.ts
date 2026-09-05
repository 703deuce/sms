export type CallerIntent =
  | "book_service"
  | "reschedule"
  | "cancel"
  | "emergency"
  | "general_question"
  | "unknown";

export function detectCallerIntent(input: {
  utterance?: string | null;
  collectedFields?: Record<string, string>;
}): { intent: CallerIntent; confidence: "high" | "medium" | "low"; reason: string } {
  const text = [
    input.utterance || "",
    ...Object.values(input.collectedFields || {}),
  ]
    .join(" ")
    .toLowerCase();

  if (/\b(gas smell|gas leak|carbon monoxide|smell gas)\b/.test(text)) {
    return { intent: "emergency", confidence: "high", reason: "safety_keywords" };
  }

  if (
    /\b(cancel|cancellation|don't need (the )?appointment|not coming|call off)\b/.test(text) &&
    /\b(appointment|booking|visit)\b/.test(text)
  ) {
    return { intent: "cancel", confidence: "high", reason: "cancel_phrase" };
  }

  if (
    /\b(reschedule|re-?schedule|move (my )?appointment|change (my )?(appointment|time)|different (day|time)|push (it )?back)\b/.test(
      text,
    )
  ) {
    return { intent: "reschedule", confidence: "high", reason: "reschedule_phrase" };
  }

  if (/\b(how much|pricing|price|cost|service call fee|what do you charge)\b/.test(text)) {
    return { intent: "general_question", confidence: "medium", reason: "pricing_question" };
  }

  if (
    /\b(book|schedule|appointment|come out|send someone|need (a )?tech|repair|fix|not working|no heat|furnace|ac |hvac)\b/.test(
      text,
    )
  ) {
    return { intent: "book_service", confidence: "medium", reason: "service_request" };
  }

  return { intent: "unknown", confidence: "low", reason: "unclassified" };
}

export function intentToWorkflowNode(intent: CallerIntent): string {
  switch (intent) {
    case "reschedule":
      return "reschedule_lookup";
    case "cancel":
      return "cancel_lookup";
    case "emergency":
      return "emergency_handoff";
    case "general_question":
      return "collect_fields";
    default:
      return "collect_fields";
  }
}
