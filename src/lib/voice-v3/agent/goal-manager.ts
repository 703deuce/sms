import type { VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import type { CallerMeaning } from "../intake/caller-meaning-schema";
import { mergeActiveGoalFromMeaning } from "../intake/merge-active-goal";
import { invalidateBookingStateForGoalAbandon } from "./goal-invalidation";

export type GoalStatus =
  | "ACTIVE"
  | "WAITING_FOR_CALLER"
  | "WAITING_FOR_BACKEND"
  | "COMPLETED"
  | "ABANDONED"
  | "FAILED";

export type WorkflowGoalType =
  | "BOOK_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "GENERAL_INFORMATION"
  | "CALLBACK"
  | "TRANSFER";

export interface VoiceV3GoalInstance {
  id: string;
  type: WorkflowGoalType;
  status: GoalStatus;
  createdAt: string;
  completedAt?: string;
  abandonedAt?: string;
}

export interface VoiceV3ConversationGoals {
  activeInstanceId: string | null;
  instances: VoiceV3GoalInstance[];
  pendingTypes: WorkflowGoalType[];
}

function workflowGoalFromDialog(goal: VoiceV3Goal): WorkflowGoalType | null {
  switch (goal) {
    case "BOOK_APPOINTMENT":
      return "BOOK_APPOINTMENT";
    case "RESCHEDULE_APPOINTMENT":
      return "RESCHEDULE_APPOINTMENT";
    case "CANCEL_APPOINTMENT":
      return "CANCEL_APPOINTMENT";
    case "REQUEST_CALLBACK":
      return "CALLBACK";
    case "REQUEST_TRANSFER":
      return "TRANSFER";
    case "GENERAL":
      return "GENERAL_INFORMATION";
    default:
      return null;
  }
}

function newGoalId(callId: string, type: WorkflowGoalType, at: string): string {
  return `goal_${callId}_${type}_${Date.parse(at)}`;
}

function isWorkflowType(type: WorkflowGoalType): boolean {
  return (
    type === "BOOK_APPOINTMENT" ||
    type === "RESCHEDULE_APPOINTMENT" ||
    type === "CANCEL_APPOINTMENT"
  );
}

/**
 * Deterministic goal lifecycle — dialog.activeGoal remains the active workflow selector;
 * instances record history for multi-goal and abandonment.
 */
export function applyGoalLifecycleFromMeaning(input: {
  ctx: VoiceV3CallContext;
  meaning: CallerMeaning;
  at: Date;
}): VoiceV3CallContext {
  const atIso = input.at.toISOString();
  const previousGoal = input.ctx.dialog.activeGoal;
  const nextGoal = mergeActiveGoalFromMeaning(previousGoal, input.meaning);
  const goals = input.ctx.conversation?.goals ?? {
    activeInstanceId: null,
    instances: [],
    pendingTypes: [],
  };

  const prevType = workflowGoalFromDialog(previousGoal);
  const nextType = workflowGoalFromDialog(nextGoal);
  let instances = [...goals.instances];
  let pendingTypes = [...goals.pendingTypes];
  let activeInstanceId = goals.activeInstanceId;
  let context = input.ctx;

  const abandonActiveWorkflow = (reason: string) => {
    if (!activeInstanceId) return;
    instances = instances.map((g) =>
      g.id === activeInstanceId && g.status === "ACTIVE"
        ? { ...g, status: "ABANDONED", abandonedAt: atIso }
        : g,
    );
    console.log("GOAL_ABANDONED", {
      call_id: context.callId,
      goal_instance_id: activeInstanceId,
      reason,
      state_version: context.runtime.version,
    });
    activeInstanceId = null;
    context = invalidateBookingStateForGoalAbandon(context);
  };

  if (prevType && nextType && prevType !== nextType && isWorkflowType(prevType)) {
    abandonActiveWorkflow("goal_switch");
  }

  if (input.meaning.active_goal === "GENERAL" && isWorkflowType(prevType ?? "GENERAL_INFORMATION")) {
    // Explicit semantic abandonment handled when Astra sends a competing workflow goal.
  }

  if (nextType && (!activeInstanceId || instances.find((g) => g.id === activeInstanceId)?.type !== nextType)) {
    const existingActive = instances.find((g) => g.type === nextType && g.status === "ACTIVE");
    if (existingActive) {
      activeInstanceId = existingActive.id;
    } else {
      const id = newGoalId(context.callId, nextType, atIso);
      const row: VoiceV3GoalInstance = {
        id,
        type: nextType,
        status: "ACTIVE",
        createdAt: atIso,
      };
      instances.push(row);
      activeInstanceId = id;
      console.log("GOAL_CREATED", {
        call_id: context.callId,
        goal_instance_id: id,
        goal_type: nextType,
        state_version: context.runtime.version,
      });
      console.log("GOAL_ACTIVATED", {
        call_id: context.callId,
        goal_instance_id: id,
        goal_type: nextType,
      });
    }
  }

  return {
    ...context,
    dialog: { activeGoal: nextGoal },
    conversation: {
      goals: {
        activeInstanceId,
        instances,
        pendingTypes,
      },
    },
  };
}

export function queuePendingGoalType(
  goals: VoiceV3ConversationGoals,
  type: WorkflowGoalType,
): VoiceV3ConversationGoals {
  if (goals.pendingTypes.includes(type)) return goals;
  return { ...goals, pendingTypes: [...goals.pendingTypes, type] };
}

export function evaluateGoalStateFromContext(ctx: VoiceV3CallContext): {
  active: VoiceV3Goal;
  status: GoalStatus;
  activeInstance: VoiceV3GoalInstance | null;
  pendingTypes: WorkflowGoalType[];
} {
  const goals = ctx.conversation?.goals;
  const activeGoal = ctx.dialog.activeGoal;
  const activeInstance =
    goals?.instances.find((g) => g.id === goals.activeInstanceId) ?? null;

  let status: GoalStatus = "ACTIVE";
  if (ctx.availability.status === "pending") {
    status = "WAITING_FOR_BACKEND";
  } else if (
    ctx.booking.phase === "BOOKING_CREATING" ||
    ctx.booking.phase === "BOOKING_REVALIDATING" ||
    ctx.booking.phase === "BOOKING_OUTCOME_UNKNOWN"
  ) {
    status = "WAITING_FOR_BACKEND";
  } else if (ctx.recovery.active?.userRecoverable) {
    status = "WAITING_FOR_CALLER";
  } else if (ctx.booking.phase === "BOOKING_CONFIRMED") {
    status = "COMPLETED";
  } else if (activeInstance?.status === "ABANDONED") {
    status = "ABANDONED";
  }

  return {
    active: activeGoal,
    status,
    activeInstance,
    pendingTypes: goals?.pendingTypes ?? [],
  };
}
