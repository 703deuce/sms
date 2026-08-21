/**
 * MCTB service entitlement — separates user configuration from billing/service state.
 * `missedCallTextConfig.enabled` = customer wants MCTB configured on.
 * `mctbServiceStatus` = whether entitlement allows automatic recovery sends.
 */
import { getPrisma } from "@/lib/db";
import { getTrialLimits } from "@/lib/platform-flags";

export type MctbServiceStatus =
  | "ACTIVE"
  | "SUSPENDED_TRIAL_EXPIRED"
  | "SUSPENDED_PAST_DUE"
  | "SUSPENDED_ADMIN"
  | "ONBOARDING";

const PAID_MCTB_PLANS = new Set([
  "growth",
  "pro",
  "enterprise",
  "starter",
  "business",
  "scale",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function hasActiveMctbPaidEntitlement(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { billingPlan: true, stripeSubscriptionId: true },
  });
  if (!ws) return false;
  const plan = String(ws.billingPlan || "").toLowerCase();
  if (PAID_MCTB_PLANS.has(plan)) return true;
  if (ws.stripeSubscriptionId && plan !== "canceled" && plan !== "suspended" && plan !== "expired") {
    return true;
  }
  return false;
}

export type MctbEntitlementSnapshot = {
  serviceStatus: MctbServiceStatus;
  canSendAutomaticRecovery: boolean;
  canDetectCalls: boolean;
  trialSmsSegmentsUsed: number;
  trialSmsSegmentLimit: number | null;
  trialDaysRemaining: number | null;
  reason: string | null;
};

export async function getMctbEntitlement(workspaceId: string): Promise<MctbEntitlementSnapshot> {
  const prisma = getPrisma();
  const [ws, limitsRow] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { billingPlan: true, stripeSubscriptionId: true },
    }),
    prisma.workspaceLimits.findUnique({
      where: { workspaceId },
      select: { limits: true },
    }),
  ]);

  const limits = asRecord(limitsRow?.limits);
  const plan = String(ws?.billingPlan || "").toLowerCase();
  const storedStatus = String(limits.mctbServiceStatus || "").toUpperCase() as MctbServiceStatus;

  const trial = await getTrialLimits();
  const trialSmsSegmentLimit =
    plan === "trial" || plan === "trial_pending_card" ? trial.messages || 100 : null;
  const trialSmsSegmentsUsed = Number(limits.trialSmsSegmentsUsed || 0);

  let serviceStatus: MctbServiceStatus = "ACTIVE";
  if (plan === "onboarding") serviceStatus = "ONBOARDING";
  else if (storedStatus.startsWith("SUSPENDED_")) serviceStatus = storedStatus;
  else if (plan === "expired" || plan === "canceled") serviceStatus = "SUSPENDED_TRIAL_EXPIRED";
  else if (plan === "suspended" || plan === "past_due") serviceStatus = "SUSPENDED_PAST_DUE";

  const paid = await hasActiveMctbPaidEntitlement(workspaceId);
  if (paid) serviceStatus = "ACTIVE";

  const trialEndsAt = limits.trialEndsAt as string | undefined;
  let trialDaysRemaining: number | null = null;
  if (trialEndsAt) {
    const ms = new Date(trialEndsAt).getTime() - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  let canSendAutomaticRecovery = serviceStatus === "ACTIVE";
  let reason: string | null = null;

  if (serviceStatus === "ONBOARDING") {
    canSendAutomaticRecovery = false;
    reason = "onboarding";
  } else if (serviceStatus !== "ACTIVE") {
    canSendAutomaticRecovery = false;
    reason = serviceStatus.toLowerCase();
  } else if (
    trialSmsSegmentLimit != null &&
    trialSmsSegmentsUsed >= trialSmsSegmentLimit
  ) {
    canSendAutomaticRecovery = false;
    reason = "trial_sms_limit_reached";
  }

  return {
    serviceStatus,
    canSendAutomaticRecovery,
    canDetectCalls: true,
    trialSmsSegmentsUsed,
    trialSmsSegmentLimit,
    trialDaysRemaining,
    reason,
  };
}

export async function setMctbServiceStatus(
  workspaceId: string,
  status: MctbServiceStatus,
): Promise<void> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: { workspaceId, limits: { mctbServiceStatus: status } },
    update: { limits: { ...limits, mctbServiceStatus: status } },
  });
}

export async function clearMctbServiceSuspension(workspaceId: string): Promise<void> {
  await setMctbServiceStatus(workspaceId, "ACTIVE");
}

export async function recordTrialSmsSegmentUsage(
  workspaceId: string,
  segments: number,
): Promise<void> {
  if (segments <= 0) return;
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  const used = Number(limits.trialSmsSegmentsUsed || 0) + segments;
  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: { workspaceId, limits: { trialSmsSegmentsUsed: used } },
    update: { limits: { ...limits, trialSmsSegmentsUsed: used } },
  });
}
