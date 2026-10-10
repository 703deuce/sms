import "server-only";

import { arPlanDefinition } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  arPlanLimitsForWorkspace,
  resolveArWorkspaceCommercial,
} from "@/lib/appointment-reminders/commercial/ar-workspace-plan";
import { workspaceHasAppointmentReminders } from "@/lib/appointment-reminders/entitlement";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";
import { getPrisma } from "@/lib/db";
import { listActivePlatformSubscriptions } from "@/lib/products/platform-subscriptions";

export type ArCommercialEntitlements = {
  arProductActive: boolean;
  paid: boolean;
  paidTier: string | null;
  billingPlan: string;
  planKey: string;
};

export type ArMonthlySmsLimitResolution = {
  limit: number;
  source:
    | "workspace_override"
    | "ar_plan_catalog"
    | "platform_subscription"
    | "unconfigured";
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function resolveArCommercialEntitlements(
  workspaceId: string,
): Promise<ArCommercialEntitlements> {
  const [arProductActive, commercial, subs, ws] = await Promise.all([
    workspaceHasAppointmentReminders(workspaceId),
    resolveArWorkspaceCommercial(workspaceId),
    listActivePlatformSubscriptions(workspaceId),
    getPrisma().workspace.findUnique({
      where: { id: workspaceId },
      select: { billingPlan: true },
    }),
  ]);

  const arSub = subs.find((s) => s.productFamily === AR_PLATFORM_PRODUCT_FAMILY);
  const paid = Boolean(arSub && arSub.tier !== "free") || (commercial.planKey !== "free" && commercial.stripeSubscriptionId);

  return {
    arProductActive,
    paid,
    paidTier: arSub?.tier ?? (paid ? commercial.planKey : null),
    billingPlan: String(ws?.billingPlan || ""),
    planKey: commercial.planKey,
  };
}

export async function resolveArMonthlySmsLimit(
  workspaceId: string,
): Promise<ArMonthlySmsLimitResolution> {
  const prisma = getPrisma();
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(limitsRow?.limits);
  const override = limits.arAppointmentRemindersMonthlySmsLimit;
  if (typeof override === "number" && override >= 0) {
    return { limit: override, source: "workspace_override" };
  }

  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  if (!commercial.hasProductAccess) {
    return { limit: 0, source: "unconfigured" };
  }

  const plan = arPlanLimitsForWorkspace(commercial);
  return { limit: plan.smsSegmentsPerMonth, source: "ar_plan_catalog" };
}

export async function resolveArMonthlyEmailLimit(workspaceId: string): Promise<number> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  if (!commercial.hasProductAccess) return 0;
  return arPlanDefinition(commercial.planKey).emailsPerMonth;
}

export async function resolveArMonthlyAiConversationLimit(workspaceId: string): Promise<number> {
  const commercial = await resolveArWorkspaceCommercial(workspaceId);
  if (!commercial.hasProductAccess) return 0;
  return arPlanDefinition(commercial.planKey).aiConversationsPerMonth;
}
