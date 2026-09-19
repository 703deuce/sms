import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { CapturedField, VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import { deriveSchedulingClarification } from "../time/scheduling-clarification";
import {
  normalizeSchedulingMeaning,
  schedulingMeaningHasSignal,
} from "../time/scheduling-normalizer";
import { parseSchedulingExpressionsToMeaning } from "../time/parse-scheduling-expressions";
import {
  normalizedSchedulingEquals,
  type SchedulingMeaning,
} from "../time/scheduling-types";
import { invalidateSelectionForSchedulingChange } from "../calendar/apply-slot-selection";
import { markOperationsStaleForScheduling } from "../operations/registry";

export type IntakeMergeResult = {
  context: VoiceV3CallContext;
  fieldsChanged: string[];
  schedulingGenerationChanged: boolean;
};

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

const TOOL_GOAL_MAP: Record<string, VoiceV3Goal> = {
  UNKNOWN: "UNKNOWN",
  GENERAL: "GENERAL",
  BOOK_APPOINTMENT: "BOOK_APPOINTMENT",
  RESCHEDULE_APPOINTMENT: "RESCHEDULE_APPOINTMENT",
  CANCEL_APPOINTMENT: "CANCEL_APPOINTMENT",
  REQUEST_CALLBACK: "REQUEST_CALLBACK",
  REQUEST_TRANSFER: "REQUEST_TRANSFER",
};

export function mergeDialogActiveGoalFromTool(
  ctx: VoiceV3CallContext,
  activeGoal: string | null | undefined,
): VoiceV3CallContext {
  if (!activeGoal || activeGoal === "UNKNOWN") return ctx;
  const mapped = TOOL_GOAL_MAP[activeGoal];
  if (!mapped || mapped === ctx.dialog.activeGoal) return ctx;
  return {
    ...ctx,
    updatedAt: new Date().toISOString(),
    dialog: { activeGoal: mapped },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

function schedulingMeaningFromExpressions(
  dateExpression: string | null | undefined,
  timeExpression: string | null | undefined,
): SchedulingMeaning {
  return parseSchedulingExpressionsToMeaning({
    dateExpression,
    timeExpression,
  });
}

export function mergeSchedulingNaturalLanguage(
  ctx: VoiceV3CallContext,
  input: { dateExpression?: string | null; timeExpression?: string | null },
  at: Date = new Date(),
): { context: VoiceV3CallContext; schedulingGenerationChanged: boolean } {
  const schedMeaning = schedulingMeaningFromExpressions(input.dateExpression, input.timeExpression);
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

export function mergeIntakeFieldValues(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  fields: Array<Pick<CapturedField, "key" | "value">>,
  at: Date = new Date(),
): { context: VoiceV3CallContext; fieldsChanged: string[] } {
  const updatedAt = at.toISOString();
  const values = { ...ctx.intake.values };
  const fieldsChanged: string[] = [];

  for (const row of fields) {
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
      confidence: 1,
      updatedAt,
    };
    fieldsChanged.push(key);
  }

  if (fieldsChanged.length === 0) {
    return { context: ctx, fieldsChanged };
  }

  return {
    context: {
      ...ctx,
      updatedAt,
      intake: { values },
      runtime: { version: ctx.runtime.version + 1 },
    },
    fieldsChanged,
  };
}

/**
 * @deprecated Tests/legacy only — production uses intake-objective mergeIntakeUpdate via update_intake tool.
 */
export function applyIntakeToolPatch(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
  args: {
    active_goal?: string | null;
    date_expression?: string | null;
    time_expression?: string | null;
    fieldValues: Array<Pick<CapturedField, "key" | "value">>;
  },
  at: Date = new Date(),
): IntakeMergeResult {
  let working = ctx;
  const mergedFields = mergeIntakeFieldValues(working, config, args.fieldValues, at);
  working = mergedFields.context;

  working = mergeDialogActiveGoalFromTool(working, args.active_goal ?? null);

  const sched = mergeSchedulingNaturalLanguage(working, {
    dateExpression: args.date_expression,
    timeExpression: args.time_expression,
  }, at);
  working = sched.context;

  return {
    context: working,
    fieldsChanged: mergedFields.fieldsChanged,
    schedulingGenerationChanged: sched.schedulingGenerationChanged,
  };
}
