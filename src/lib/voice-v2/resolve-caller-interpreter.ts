import "server-only";

import type { CallerInterpretationResult, InterpreterContext } from "./caller-meaning";
import { astraCallerInterpreter, isVoiceV2AstraInterpreterEnabled } from "./astra-caller-interpreter";
import { deterministicCallerInterpreter } from "./deterministic-caller-interpreter";
import {
  classifyInterpreterSafeFallback,
  preserveStateCallerMeaning,
  tryExplicitIntentFallback,
} from "./interpreter-safe-fallback";

/**
 * Primary interpreter entry. Returns canonical CallerMeaning + merge policy.
 * When Astra is enabled, ambiguous failures preserve durable state (no full deterministic rewrite).
 */
export async function interpretStableCallerUtterance(
  ctx: InterpreterContext,
): Promise<CallerInterpretationResult> {
  if (isVoiceV2AstraInterpreterEnabled()) {
    const astra = await astraCallerInterpreter.interpret(ctx);
    if (astra?.meaning) {
      return { ...astra, mergePolicy: "full" };
    }

    const safe = classifyInterpreterSafeFallback(ctx);
    if (safe.mergePolicy === "literal_facts_only" && safe.meaning) {
      return {
        meaning: safe.meaning,
        implementationId: "safe_literal_fallback",
        latencyMs: 0,
        fallbackReason: safe.reason,
        mergePolicy: "literal_facts_only",
      };
    }

    const explicit = tryExplicitIntentFallback(ctx);
    if (explicit) {
      return {
        meaning: explicit,
        implementationId: "explicit_intent_fallback",
        latencyMs: 0,
        fallbackReason: `astra_failed_${safe.reason}`,
        mergePolicy: "full",
      };
    }

    return {
      meaning: preserveStateCallerMeaning(ctx),
      implementationId: "preserve_state",
      latencyMs: 0,
      fallbackReason: safe.reason,
      mergePolicy: "none",
    };
  }

  const deterministic = await deterministicCallerInterpreter.interpret(ctx);
  if (!deterministic) {
    return {
      meaning: preserveStateCallerMeaning(ctx),
      implementationId: "preserve_state",
      latencyMs: 0,
      fallbackReason: "deterministic_unavailable",
      mergePolicy: "none",
    };
  }
  return { ...deterministic, mergePolicy: "full" };
}
