import type { VoiceV3CallContext, VoiceV3Goal } from "../state/call-context";
import { evaluateGoalStateFromContext, type GoalStatus } from "./goal-manager";

export interface GoalsEvaluation {
  active: VoiceV3Goal;
  status: GoalStatus;
  pendingTypes: string[];
}

export function evaluateGoals(ctx: VoiceV3CallContext): GoalsEvaluation {
  const g = evaluateGoalStateFromContext(ctx);
  return {
    active: g.active,
    status: g.status,
    pendingTypes: g.pendingTypes,
  };
}
