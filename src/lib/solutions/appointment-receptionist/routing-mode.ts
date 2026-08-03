import type { AnswerWhen, AppointmentReceptionistWizardState } from "./types";

type RingBehavior = AppointmentReceptionistWizardState["ringBehavior"];

export type WizardRoutingMode =
  | "ai_answer"
  | "human_first"
  | "ai_after_hours"
  | "overflow"
  | "custom_schedule";

/**
 * Resolve routing mode from wizard answerWhen / ringBehavior.
 * Client-safe (no DB). answerWhen wins when both are set.
 */
export function resolveWizardRoutingMode(input: {
  answerWhen: AnswerWhen;
  ringBehavior: RingBehavior;
}): WizardRoutingMode {
  const { answerWhen, ringBehavior } = input;

  // answerWhen is the source of truth; ringBehavior only fills gaps.
  if (answerWhen === "nobody_answers") {
    return "human_first";
  }
  if (answerWhen === "line_busy") {
    // Intended for DIDs that only receive busy/overflow forwards from another system.
    return "overflow";
  }
  if (answerWhen === "custom_schedule") {
    return "custom_schedule";
  }
  if (answerWhen === "after_hours") {
    return "ai_after_hours";
  }
  if (answerWhen === "every_call") {
    return "ai_answer";
  }
  // Legacy: ringBehavior alone (if answerWhen somehow unset)
  if (ringBehavior === "ring_team_first") return "human_first";
  if (ringBehavior === "custom") return "custom_schedule";
  if (ringBehavior === "after_hours") return "ai_after_hours";
  if (ringBehavior === "line_busy") return "overflow";
  return "ai_answer";
}
