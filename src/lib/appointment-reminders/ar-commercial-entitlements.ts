import "server-only";

import { getPrisma } from "@/lib/db";
import { getPlatformSettingsCached, getTrialLimits } from "@/lib/platform-flags";
import { listActivePlatformSubscriptions } from "@/lib/products/platform-subscriptions";
import { workspaceHasAppointmentReminders } from "@/lib/appointment-reminders/entitlement";
import {
  AR_PAID_SMS_LIMIT_BY_TIER,
  AR_PLATFORM_PRODUCT_FAMILY,
  LIMITS_OVERRIDE_KEY,
} from "@/lib/appointment-reminders/ar-sms-usage-constants";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type ArCommercialEntitlements = {
  arProductActive: boolean;
  paid: boolean;
  paidTier: string | null;
  billingPlan: string;
};

export type ArMonthlySmsLimitResolution = {
  limit: number;
  source:
    | "workspace_override"
    | "platform_subscription"
    | "workspace_billing_plan"
    | "platform_trial_config"
    | "unconfigured";
};

function normalizeBillingPlanId(plan: string): string {
  const p = plan.trim().toLowerCase();
  if (!p) return "";
  if (p.startsWith("plan_")) return p;
  return `plan_${p}`;
}

function isPaidBillingPlan(plan: string): boolean {
  const p = plan.trim().toLowerCase();
  if (!p || p === "trial" || p === "trial_pending_card" || p === "free" || p === "onboarding") {
    return false;
  }
  return !["canceled", "cancelled", "suspended", "expired"].includes(p);
}

export async function resolveArCommercialEntitlements(
  workspaceId: string,
): Promise<ArCommercialEntitlements> {
  const [arProductActive, subs, ws] = await Promise.all([
    workspaceHasAppointmentReminders(workspaceId),
    listActivePlatformSubscriptions(workspaceId),
    getPrisma().workspace.findUnique({
      where: { id: workspaceId },
      select: { billingPlan: true },
    }),
  ]);

  const arSub = subs.find((s) => s.productFamily === AR_PLATFORM_PRODUCT_FAMILY);
  const billingPlan = String(ws?.billingPlan || "");
  const paid =
    Boolean(arSub) ||
    (isPaidBillingPlan(billingPlan) && arProductActive);

  return {
    arProductActive,
    paid,
    paidTier: arSub?.tier ?? null,
    billingPlan,
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
  const override = limits[LIMITS_OVERRIDE_KEY];
  if (typeof override === "number" && override >= 0) {
    return { limit: override, source: "workspace_override" };
  }

  const commercial = await resolveArCommercialEntitlements(workspaceId);

  if (commercial.paidTier) {
    const tierLimit = AR_PAID_SMS_LIMIT_BY_TIER[commercial.paidTier];
    if (typeof tierLimit === "number" && tierLimit > 0) {
      return { limit: tierLimit, source: "platform_subscription" };
    }
  }

  if (commercial.paid && isPaidBillingPlan(commercial.billingPlan)) {
    const settings = await getPlatformSettingsCached();
    const planId = normalizeBillingPlanId(commercial.billingPlan);
    const planRow = settings.plans.find(
      (p) => p.id === planId || p.id === commercial.billingPlan || p.name.toLowerCase() === commercial.billingPlan.toLowerCase(),
    );
    if (planRow && planRow.messages > 0) {
      return { limit: planRow.messages, source: "workspace_billing_plan" };
    }
  }

  const trial = await getTrialLimits();
  if (trial.messages > 0) {
    return { limit: trial.messages, source: "platform_trial_config" };
  }

  return { limit: 0, source: "unconfigured" };
}
