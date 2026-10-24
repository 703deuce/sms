import type { VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import type { CallerMeaning } from "../intake/caller-meaning-schema";
import type { CallerGoalMeaning } from "../intake/caller-goal-meaning";
import { normalizeCallerGoals } from "../intake/normalize-caller-goals";
import { mergeActiveGoalFromMeaning } from "../intake/merge-active-goal";
import { invalidateBookingStateForGoalAbandon } from "./goal-invalidation";
import { cancelRunningOperationsForGoal } from "../operations/registry";

export type GoalStatus =
  | "ACTIVE"
  | "WAITING_FOR_CALLER"
  | "WAITING_FOR_BACKEND"
  | "COMPLETED"
  | "ABANDONED"
  | "FAILED";

export type WorkflowGoalType = CallerGoalMeaning["type"];

export interface VoiceV3GoalInstance {
  id: string;
  type: WorkflowGoalType;
  status: GoalStatus;
  createdAt: string;
  completedAt?: string;
  abandonedAt?: string;
}

export interface GoalManagerState {
  activeGoalId: string | null;
  pendingGoalIds: string[];
  completedGoalIds: string[];
  abandonedGoalIds: string[];
  goals: Record<string, VoiceV3GoalInstance>;
}

const WORKFLOW_EXECUTION_ORDER: WorkflowGoalType[] = [
  "CANCEL_APPOINTMENT",
  "RESCHEDULE_APPOINTMENT",
  "BOOK_APPOINTMENT",
  "CALLBACK",
  "TRANSFER",
  "GENERAL_INFORMATION",
];

function emptyGoalManager(): GoalManagerState {
  return {
    activeGoalId: null,
    pendingGoalIds: [],
    completedGoalIds: [],
    abandonedGoalIds: [],
    goals: {},
  };
}

function goalManagerFromCtx(ctx: VoiceV3CallContext): GoalManagerState {
  return ctx.conversation?.goalManager ?? emptyGoalManager();
}

function newGoalId(callId: string, type: WorkflowGoalType, at: string): string {
  return `goal_${callId}_${type}_${Date.parse(at)}`;
}

function dialogGoalToWorkflowType(goal: VoiceV3Goal): WorkflowGoalType | null {
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

function callerGoalToDialog(type: WorkflowGoalType): VoiceV3Goal {
  switch (type) {
    case "BOOK_APPOINTMENT":
      return "BOOK_APPOINTMENT";
    case "RESCHEDULE_APPOINTMENT":
      return "RESCHEDULE_APPOINTMENT";
    case "CANCEL_APPOINTMENT":
      return "CANCEL_APPOINTMENT";
    case "CALLBACK":
      return "REQUEST_CALLBACK";
    case "TRANSFER":
      return "REQUEST_TRANSFER";
    case "GENERAL_INFORMATION":
      return "GENERAL";
  }
}

function sortGoalsForRuntime(goals: CallerGoalMeaning[]): CallerGoalMeaning[] {
  return [...goals].sort(
    (a, b) => WORKFLOW_EXECUTION_ORDER.indexOf(a.type) - WORKFLOW_EXECUTION_ORDER.indexOf(b.type),
  );
}

function isDestructiveWorkflow(type: WorkflowGoalType): boolean {
  return (
    type === "BOOK_APPOINTMENT" ||
    type === "RESCHEDULE_APPOINTMENT" ||
    type === "CANCEL_APPOINTMENT"
  );
}

export function completeActiveGoal(ctx: VoiceV3CallContext, at: Date = new Date()): VoiceV3CallContext {
  const gm = goalManagerFromCtx(ctx);
  if (!gm.activeGoalId) return ctx;
  const atIso = at.toISOString();
  const goals = { ...gm.goals };
  const active = goals[gm.activeGoalId];
  if (!active || active.status !== "ACTIVE") return ctx;
  goals[gm.activeGoalId] = { ...active, status: "COMPLETED", completedAt: atIso };
  const completedGoalIds = [...gm.completedGoalIds, gm.activeGoalId];
  let activeGoalId: string | null = null;
  const pendingGoalIds = [...gm.pendingGoalIds];
  if (pendingGoalIds.length > 0) {
    activeGoalId = pendingGoalIds.shift()!;
    const next = goals[activeGoalId];
    if (next) {
      goals[activeGoalId] = { ...next, status: "ACTIVE" };
      console.log("GOAL_ACTIVATED", {
        call_id: ctx.callId,
        goal_instance_id: activeGoalId,
        goal_type: next.type,
        source: "pending_queue",
      });
    }
  }
  const dialogGoal = activeGoalId ? callerGoalToDialog(goals[activeGoalId]!.type) : ctx.dialog.activeGoal;
  console.log("GOAL_COMPLETED", {
    call_id: ctx.callId,
    goal_instance_id: gm.activeGoalId,
    next_active: activeGoalId,
  });
  return {
    ...ctx,
    dialog: { activeGoal: dialogGoal },
    conversation: {
      ...ctx.conversation,
      goalManager: {
        ...gm,
        goals,
        activeGoalId,
        pendingGoalIds,
        completedGoalIds,
      },
      closingOffered: false,
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export function applyGoalLifecycleFromMeaning(input: {
  ctx: VoiceV3CallContext;
  meaning: CallerMeaning;
  at: Date;
}): VoiceV3CallContext {
  const atIso = input.at.toISOString();
  let context = input.ctx;
  const dialogGoal = mergeActiveGoalFromMeaning(context.dialog.activeGoal, input.meaning);
  const semanticGoals = sortGoalsForRuntime(normalizeCallerGoals(input.meaning));
  let gm = goalManagerFromCtx(context);

  const abandonGoal = (goalId: string, reason: string) => {
    const g = gm.goals[goalId];
    if (!g || g.status === "ABANDONED" || g.status === "COMPLETED") return;
    gm.goals[goalId] = { ...g, status: "ABANDONED", abandonedAt: atIso };
    gm.abandonedGoalIds = [...gm.abandonedGoalIds, goalId];
    gm.pendingGoalIds = gm.pendingGoalIds.filter((id) => id !== goalId);
    if (gm.activeGoalId === goalId) {
      gm.activeGoalId = null;
      if (isDestructiveWorkflow(g.type)) {
        context = invalidateBookingStateForGoalAbandon(context);
        context = cancelRunningOperationsForGoal(context, goalId);
      }
    }
    console.log("GOAL_ABANDONED", { call_id: context.callId, goal_instance_id: goalId, reason });
  };

  const startGoals = semanticGoals.filter(
    (g) => g.disposition === "START" || g.disposition === "CHANGE",
  );
  const multiGoalTurn = startGoals.length > 1;

  const prevW = dialogGoalToWorkflowType(context.dialog.activeGoal);
  const nextW = dialogGoalToWorkflowType(dialogGoal);
  if (!multiGoalTurn && gm.activeGoalId && prevW && nextW && prevW !== nextW) {
    abandonGoal(gm.activeGoalId, "dialog_goal_switch");
  }

  for (const row of semanticGoals) {
    if (row.disposition === "ABANDON") {
      const existing = Object.values(gm.goals).find((g) => g.type === row.type && g.status === "ACTIVE");
      if (existing) abandonGoal(existing.id, "semantic_abandon");
      continue;
    }
    if (row.disposition !== "START" && row.disposition !== "CHANGE" && row.disposition !== "CONTINUE") {
      continue;
    }

    const existingActive = Object.values(gm.goals).find(
      (g) => g.type === row.type && (g.status === "ACTIVE" || g.status === "WAITING_FOR_CALLER"),
    );
    if (existingActive) {
      if (!gm.activeGoalId) gm.activeGoalId = existingActive.id;
      continue;
    }

    if (gm.activeGoalId && row.disposition === "CHANGE") {
      const active = gm.goals[gm.activeGoalId];
      if (active && active.type !== row.type && isDestructiveWorkflow(active.type)) {
        abandonGoal(gm.activeGoalId, "goal_change");
      }
    }

    if (!multiGoalTurn && gm.activeGoalId) {
      const active = gm.goals[gm.activeGoalId];
      if (active && active.type !== row.type) {
        abandonGoal(gm.activeGoalId, "goal_switch");
      }
    }

    const id = newGoalId(context.callId, row.type, atIso);
    gm.goals[id] = { id, type: row.type, status: "ACTIVE", createdAt: atIso };
    console.log("GOAL_CREATED", { call_id: context.callId, goal_instance_id: id, goal_type: row.type });

    if (!gm.activeGoalId) {
      gm.activeGoalId = id;
      console.log("GOAL_ACTIVATED", { call_id: context.callId, goal_instance_id: id, goal_type: row.type });
    } else if (!gm.pendingGoalIds.includes(id)) {
      gm.pendingGoalIds.push(id);
      gm.goals[id] = { ...gm.goals[id], status: "WAITING_FOR_CALLER" };
      console.log("GOAL_QUEUED", { call_id: context.callId, goal_instance_id: id, goal_type: row.type });
    }
  }

  const activeType = gm.activeGoalId ? gm.goals[gm.activeGoalId]?.type : null;
  const resolvedDialog =
    activeType != null ? callerGoalToDialog(activeType) : dialogGoal;

  return {
    ...context,
    dialog: { activeGoal: resolvedDialog },
    conversation: {
      ...context.conversation,
      goalManager: gm,
      closingOffered: context.conversation?.closingOffered ?? false,
    },
  };
}

export function evaluateGoalStateFromContext(ctx: VoiceV3CallContext): {
  active: VoiceV3Goal;
  status: GoalStatus;
  activeInstance: VoiceV3GoalInstance | null;
  pendingTypes: WorkflowGoalType[];
} {
  const gm = goalManagerFromCtx(ctx);
  const activeInstance = gm.activeGoalId ? gm.goals[gm.activeGoalId] ?? null : null;
  const pendingTypes = gm.pendingGoalIds.map((id) => gm.goals[id]?.type).filter(Boolean) as WorkflowGoalType[];

  let status: GoalStatus = activeInstance?.status ?? "ACTIVE";
  if (ctx.availability.status === "pending") status = "WAITING_FOR_BACKEND";
  else if (
    ctx.booking.phase === "BOOKING_CREATING" ||
    ctx.booking.phase === "BOOKING_REVALIDATING" ||
    ctx.booking.phase === "BOOKING_OUTCOME_UNKNOWN"
  ) {
    status = "WAITING_FOR_BACKEND";
  } else if (ctx.recovery.active?.userRecoverable) status = "WAITING_FOR_CALLER";
  else if (activeInstance?.status === "COMPLETED") status = "COMPLETED";
  else if (activeInstance?.status === "ABANDONED") status = "ABANDONED";

  return {
    active: ctx.dialog.activeGoal,
    status,
    activeInstance,
    pendingTypes,
  };
}
