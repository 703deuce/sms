import type { VoiceV3CallContext } from "../state/call-context";
import { invalidateSelectionForSchedulingChange } from "../calendar/apply-slot-selection";
import { markOperationsStaleForScheduling } from "../operations/registry";
import { deriveSchedulingClarification } from "../time/scheduling-clarification";
import {
  normalizeSchedulingMeaning,
  schedulingMeaningHasSignal,
} from "../time/scheduling-normalizer";
import {
  normalizedSchedulingEquals,
  type SchedulingMeaning,
} from "../time/scheduling-types";

export type MergeSchedulingMeaningResult = {
  context: VoiceV3CallContext;
  schedulingGenerationChanged: boolean;
};

/**
 * Deterministic merge of structured SchedulingMeaning into call context.
 * Shared by legacy CallerMeaning (tests) and set_scheduling_preference (production).
 */
export function mergeSchedulingMeaningIntoContext(
  ctx: VoiceV3CallContext,
  schedMeaning: SchedulingMeaning,
  at: Date = new Date(),
): MergeSchedulingMeaningResult {
  if (!schedulingMeaningHasSignal(schedMeaning)) {
    return { context: ctx, schedulingGenerationChanged: false };
  }

  const scheduling = { ...ctx.scheduling };
  let schedulingGenerationChanged = false;
  let workingCtx = ctx;

  const normStarted = Date.now();
  console.log("SCHEDULING_MEANING_RECEIVED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    timezone: ctx.clock.timezone,
    scheduling_generation: scheduling.generation ?? 0,
    date_relation: schedMeaning.date_relation,
    time_kind: schedMeaning.time_kind,
  });

  const normalized = normalizeSchedulingMeaning(schedMeaning, ctx.clock);
  const latency = Date.now() - normStarted;

  if (normalized.precision === "UNRESOLVED" && schedMeaning.date_relation !== "UNSPECIFIED") {
    console.log("SCHEDULING_AMBIGUOUS", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      timezone: ctx.clock.timezone,
      scheduling_generation: scheduling.generation ?? 0,
      normalization_latency_ms: latency,
    });
  }

  const priorNormalized = scheduling.normalized;
  const changed = !normalizedSchedulingEquals(priorNormalized, normalized);

  scheduling.meaning = schedMeaning;
  scheduling.normalized = normalized;
  scheduling.clarification = deriveSchedulingClarification({
    meaning: schedMeaning,
    normalized,
    clock: ctx.clock,
  });

  if (scheduling.clarification.required) {
    console.log("SCHEDULING_CLARIFICATION_REQUIRED", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      timezone: ctx.clock.timezone,
      scheduling_generation: scheduling.generation ?? 0,
      reason: scheduling.clarification.reason,
      normalization_latency_ms: latency,
    });
  }

  if (changed) {
    scheduling.generation = (scheduling.generation ?? 0) + 1;
    schedulingGenerationChanged = true;
    workingCtx = { ...workingCtx, scheduling: { ...scheduling } };
    workingCtx = invalidateSelectionForSchedulingChange(workingCtx, "scheduling_generation_changed");
    workingCtx = markOperationsStaleForScheduling(workingCtx, workingCtx.scheduling.generation);
    scheduling.generation = workingCtx.scheduling.generation;
    if (priorNormalized) {
      console.log("SCHEDULING_CORRECTED", {
        call_id: ctx.callId,
        live_session_id: ctx.liveSessionId,
        timezone: ctx.clock.timezone,
        scheduling_generation: scheduling.generation,
        normalization_latency_ms: latency,
      });
    }
    console.log("SCHEDULING_GENERATION_CHANGED", {
      call_id: ctx.callId,
      live_session_id: ctx.liveSessionId,
      timezone: ctx.clock.timezone,
      scheduling_generation: scheduling.generation,
      normalization_latency_ms: latency,
    });
  }

  console.log("SCHEDULING_NORMALIZED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    timezone: ctx.clock.timezone,
    scheduling_generation: scheduling.generation ?? 0,
    precision: normalized.precision,
    local_date: normalized.localDate,
    normalization_latency_ms: latency,
  });

  const context: VoiceV3CallContext = {
    ...workingCtx,
    updatedAt: at.toISOString(),
    scheduling,
    runtime: { version: workingCtx.runtime.version + 1 },
  };

  return { context, schedulingGenerationChanged };
}

export function schedulingDisplayPreference(
  meaning: SchedulingMeaning,
  normalized: { localDate: string | null; localStartDateTime: string | null; localEndDateTime: string | null },
): string {
  const expr = [meaning.date_expression, meaning.time_expression].filter((s) => s?.trim()).join(" ").trim();
  if (expr) return expr;
  if (normalized.localStartDateTime) return normalized.localStartDateTime;
  if (normalized.localDate) return normalized.localDate;
  return "scheduling preference";
}
