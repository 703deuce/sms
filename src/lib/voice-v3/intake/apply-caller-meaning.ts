import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { CapturedField, VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import type { CallerMeaning } from "./caller-meaning-schema";
import { deriveSchedulingClarification } from "../time/scheduling-clarification";
import {
  normalizeSchedulingMeaning,
  schedulingMeaningHasSignal,
} from "../time/scheduling-normalizer";
import {
  normalizedSchedulingEquals,
  type SchedulingMeaning,
} from "../time/scheduling-types";

export interface ApplyCallerMeaningResult {
  context: VoiceV3CallContext;
  fieldsChanged: string[];
  correctionCount: number;
  schedulingGenerationChanged: boolean;
}

function isConfiguredKey(config: VoiceV3AgentConfig, key: string): boolean {
  return config.intakeFields.some((f) => f.key === key);
}

function logUnknownIntakeKeyRejected(input: {
  callId: string;
  liveSessionId: string;
  key: string;
  stateVersion: number;
}): void {
  console.log("VOICE_V3_UNKNOWN_INTAKE_KEY_REJECTED", {
    call_id: input.callId,
    live_session_id: input.liveSessionId,
    key: input.key,
    state_version: input.stateVersion,
  });
}

function goalFromMeaning(goal: CallerMeaning["active_goal"]): VoiceV3Goal {
  return goal;
}

function toSchedulingMeaning(sched: CallerMeaning["scheduling"]): SchedulingMeaning {
  return { ...sched };
}

/**
 * Deterministic merge — no tools, no second model pass.
 */
export function applyCallerMeaningToContext(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  meaning: CallerMeaning,
  at: Date = new Date(),
): ApplyCallerMeaningResult {
  const updatedAt = at.toISOString();
  const values = { ...ctx.intake.values };
  const fieldsChanged = new Set<string>();
  let correctionCount = 0;

  for (const row of meaning.captured_fields) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (!key || !value) continue;
    if (!isConfiguredKey(config, key)) {
      logUnknownIntakeKeyRejected({
        callId: ctx.callId,
        liveSessionId: ctx.liveSessionId,
        key,
        stateVersion: ctx.runtime.version,
      });
      continue;
    }
    values[key] = {
      value,
      source: "caller",
      confidence: row.confidence,
      updatedAt,
    };
    fieldsChanged.add(key);
  }

  for (const row of meaning.corrections) {
    const key = row.key.trim();
    const value = row.new_value.trim();
    if (!key || !value) continue;
    if (!isConfiguredKey(config, key)) {
      logUnknownIntakeKeyRejected({
        callId: ctx.callId,
        liveSessionId: ctx.liveSessionId,
        key,
        stateVersion: ctx.runtime.version,
      });
      continue;
    }
    values[key] = {
      value,
      source: "caller",
      confidence: row.confidence,
      updatedAt,
    };
    fieldsChanged.add(key);
    correctionCount += 1;
  }

  const scheduling = { ...ctx.scheduling };
  let schedulingGenerationChanged = false;
  const schedMeaning = toSchedulingMeaning(meaning.scheduling);

  if (schedulingMeaningHasSignal(schedMeaning)) {
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
      if (correctionCount > 0 || priorNormalized) {
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
  }

  const context: VoiceV3CallContext = {
    ...ctx,
    updatedAt,
    dialog: { activeGoal: goalFromMeaning(meaning.active_goal) },
    intake: { values },
    scheduling,
    runtime: { version: ctx.runtime.version + 1 },
  };

  return {
    context,
    fieldsChanged: [...fieldsChanged],
    correctionCount,
    schedulingGenerationChanged,
  };
}
