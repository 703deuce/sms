import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { CapturedField, VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import type { VoiceOperationName } from "../intake-objective/operation-requirements";
import { mergeSchedulingMeaningIntoContext } from "./merge-scheduling-meaning";
import type { SchedulingMeaning } from "../time/scheduling-types";

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

/** Map an explicit tool operation to dialog.activeGoal (intent routing for intake + planner). */
export function mergeDialogActiveGoalFromOperation(
  ctx: VoiceV3CallContext,
  operation: VoiceOperationName,
): VoiceV3CallContext {
  switch (operation) {
    case "send_booking_link":
    case "book_appointment":
    case "find_availability":
      return mergeDialogActiveGoalFromTool(ctx, "BOOK_APPOINTMENT");
    case "request_callback":
      return mergeDialogActiveGoalFromTool(ctx, "REQUEST_CALLBACK");
    case "transfer_call":
      return mergeDialogActiveGoalFromTool(ctx, "REQUEST_TRANSFER");
    case "reschedule_appointment":
      return mergeDialogActiveGoalFromTool(ctx, "RESCHEDULE_APPOINTMENT");
    case "cancel_appointment":
      return mergeDialogActiveGoalFromTool(ctx, "CANCEL_APPOINTMENT");
    default:
      return ctx;
  }
}

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

/** @deprecated Use mergeSchedulingMeaningIntoContext with structured SchedulingMeaning. */
export function mergeSchedulingNaturalLanguage(
  ctx: VoiceV3CallContext,
  _input: { dateExpression?: string | null; timeExpression?: string | null },
  _at: Date = new Date(),
): { context: VoiceV3CallContext; schedulingGenerationChanged: boolean } {
  return { context: ctx, schedulingGenerationChanged: false };
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
    scheduling?: SchedulingMeaning | null;
    fieldValues: Array<Pick<CapturedField, "key" | "value">>;
  },
  at: Date = new Date(),
): IntakeMergeResult {
  let working = ctx;
  const mergedFields = mergeIntakeFieldValues(working, config, args.fieldValues, at);
  working = mergedFields.context;

  working = mergeDialogActiveGoalFromTool(working, args.active_goal ?? null);

  if (args.scheduling) {
    const sched = mergeSchedulingMeaningIntoContext(working, args.scheduling, at);
    working = sched.context;
    return {
      context: working,
      fieldsChanged: mergedFields.fieldsChanged,
      schedulingGenerationChanged: sched.schedulingGenerationChanged,
    };
  }

  return {
    context: working,
    fieldsChanged: mergedFields.fieldsChanged,
    schedulingGenerationChanged: false,
  };
}
