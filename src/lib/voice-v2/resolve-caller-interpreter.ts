import "server-only";

import type {
  CallerInterpretationResult,
  CallerInterpreter,
  InterpreterContext,
} from "./caller-meaning";
import { astraCallerInterpreter, isVoiceV2AstraInterpreterEnabled } from "./astra-caller-interpreter";
import { deterministicCallerInterpreter } from "./deterministic-caller-interpreter";

/**
 * Primary interpreter: Astra when enabled, always falls back to deterministic on failure.
 * Returns canonical CallerMeaning — no downstream branching by implementation.
 */
export async function interpretStableCallerUtterance(
  ctx: InterpreterContext,
): Promise<CallerInterpretationResult> {
  if (isVoiceV2AstraInterpreterEnabled()) {
    const astra = await astraCallerInterpreter.interpret(ctx);
    if (astra?.meaning) {
      return astra;
    }
    const deterministic = await deterministicCallerInterpreter.interpret(ctx);
    return {
      ...deterministic,
      fallbackReason: "astra_unavailable_or_invalid",
    };
  }
  return deterministicCallerInterpreter.interpret(ctx);
}

export function getConfiguredCallerInterpreters(): CallerInterpreter[] {
  if (isVoiceV2AstraInterpreterEnabled()) {
    return [astraCallerInterpreter, deterministicCallerInterpreter];
  }
  return [deterministicCallerInterpreter];
}
