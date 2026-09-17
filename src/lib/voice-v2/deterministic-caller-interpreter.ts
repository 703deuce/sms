import "server-only";

import type {
  CallerInterpreter,
  CallerInterpretationResult,
  CallerMeaning,
  InterpreterContext,
} from "./caller-meaning";
import type { VoiceDialogGoal } from "./dialog-goal";
import { interpretCallerUtterance } from "./caller-intent-interpreter";

function toCallerMeaning(
  utterance: string,
  priorActiveGoal: VoiceDialogGoal,
): CallerMeaning {
  const legacy = interpretCallerUtterance(utterance, { activeGoal: priorActiveGoal });
  return {
    active_goal: legacy.intent,
    facts: {
      requested_date: legacy.entities.requested_day ?? null,
      requested_daypart: legacy.entities.requested_daypart ?? null,
      requested_time: legacy.entities.requested_time ?? null,
    },
    corrections: [],
    explicit_action_requests: legacy.explicit ? [legacy.intent] : [],
    ambiguities: [],
    confidence: legacy.confidence,
    digression: legacy.digression,
    evidence: utterance.trim(),
  };
}

export const deterministicCallerInterpreter: CallerInterpreter = {
  implementationId: "deterministic",

  async interpret(ctx: InterpreterContext): Promise<CallerInterpretationResult> {
    const started = Date.now();
    const utterance = ctx.stable.text.trim();
    const meaning = toCallerMeaning(utterance, ctx.priorActiveGoal);
    return {
      meaning,
      implementationId: this.implementationId,
      latencyMs: Date.now() - started,
    };
  },
};
