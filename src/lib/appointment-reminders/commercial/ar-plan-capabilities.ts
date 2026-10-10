import "server-only";

import {
  arPlanDefinition,
  type ArPlanKey,
} from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  arPlanLimitsForWorkspace,
  resolveArWorkspaceCommercial,
} from "@/lib/appointment-reminders/commercial/ar-workspace-plan";

export type ArPlanCapabilities = {
  planKey: ArPlanKey;
  hasProductAccess: boolean;
  smsConfirmationsAndResponses: boolean;
  staffNotifiedRescheduleCancel: boolean;
  aiReschedulerModes: ReturnType<typeof arPlanDefinition>["aiReschedulerModes"];
  aiConversationsPerMonth: number;
  aiInsights: boolean;
};

export async function resolveArPlanCapabilities(
  workspaceId: string,
): Promise<ArPlanCapabilities> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanLimitsForWorkspace(commercial);
  return {
    planKey: commercial.planKey,
    hasProductAccess: commercial.hasProductAccess,
    smsConfirmationsAndResponses: plan.smsConfirmationsAndResponses,
    staffNotifiedRescheduleCancel: plan.staffNotifiedRescheduleCancel,
    aiReschedulerModes: plan.aiReschedulerModes,
    aiConversationsPerMonth: plan.aiConversationsPerMonth,
    aiInsights: plan.aiInsights,
  };
}
