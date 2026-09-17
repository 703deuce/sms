import type { CallerMeaning } from "./caller-meaning";
import type {
  VoiceCallerIntentInterpretation,
  VoiceCallerIntentEntities,
} from "./caller-intent-interpreter";
import type { VoiceV2CallContext } from "./intake/types";
import type { InterpreterMergePolicy } from "./caller-meaning";
import {
  applyCallerIntentToCallContext,
  type ApplyCallerIntentResult,
} from "./caller-intent-interpreter";
import {
  applyValidatedIntakeFieldsToContext,
  mergeUtteranceIntakeFactsIntoContext,
} from "./intake/apply-intake-facts";
import { validateIntakeFieldPayload } from "./intake/validate-fields";
import { mergeCallerFactsIntoCallContext } from "./merge-caller-facts";
import { dialogFromContext } from "./dialog-goal";

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

export async function applyCallerMeaningToCallContext(
  ctx: VoiceV2CallContext,
  meaning: CallerMeaning,
  policy: InterpreterMergePolicy,
  opts?: { turnId?: string },
): Promise<ApplyCallerIntentResult> {
  const utterance = meaning.evidence.trim();
  const previousActiveGoal = dialogFromContext(ctx).activeGoal;

  if (policy === "none") {
    return {
      ctx,
      interpretation: callerMeaningToIntentInterpretation(meaning),
      previousActiveGoal,
      resultingActiveGoal: previousActiveGoal,
      schedulingChanged: false,
    };
  }

  if (policy === "literal_facts_only") {
    let next = { ...ctx };
    if (meaning.literal_intake_fields) {
      for (const [key, value] of Object.entries(meaning.literal_intake_fields)) {
        if (!value?.trim()) continue;
        const merge = mergeUtteranceIntakeFactsIntoContext(next, `${key}: ${value}`, opts?.turnId);
        next = merge.ctx;
      }
    }
    const merge = mergeUtteranceIntakeFactsIntoContext(next, utterance, opts?.turnId);
    next = merge.ctx;

    const interpretation = callerMeaningToIntentInterpretation({
      ...meaning,
      active_goal: previousActiveGoal,
    });
    const factMerge = await mergeCallerFactsIntoCallContext(next, {
      utterance,
      interpretation,
      turnId: opts?.turnId,
      meaningFacts: meaning.facts,
    });
    return {
      ctx: factMerge.ctx,
      interpretation,
      previousActiveGoal,
      resultingActiveGoal: dialogFromContext(factMerge.ctx).activeGoal,
      schedulingChanged: factMerge.schedulingChanged,
    };
  }

  const interpretation = callerMeaningToIntentInterpretation(meaning);
  const applied = await applyCallerIntentToCallContext(ctx, interpretation, utterance, {
    turnId: opts?.turnId,
  });
  const slotMerge = await mergeCallerFactsIntoCallContext(applied.ctx, {
    utterance,
    interpretation,
    turnId: opts?.turnId,
    meaningFacts: meaning.facts,
  });
  let mergedCtx = slotMerge.ctx;
  if (meaning.literal_intake_fields && Object.keys(meaning.literal_intake_fields).length > 0) {
    const validation = validateIntakeFieldPayload(
      mergedCtx.intakeSchema,
      meaning.literal_intake_fields,
    );
    if (validation.ok || Object.keys(validation.normalized).length > 0) {
      const intakeApplied = applyValidatedIntakeFieldsToContext(mergedCtx, validation.normalized);
      mergedCtx = intakeApplied.ctx;
    }
  }
  return {
    ...applied,
    ctx: mergedCtx,
    schedulingChanged: applied.schedulingChanged || slotMerge.schedulingChanged,
  };
}
