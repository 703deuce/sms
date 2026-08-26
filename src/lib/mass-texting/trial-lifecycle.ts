import "server-only";

import { getPrisma } from "@/lib/db";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import {
  getOrCreateMassTextingBillingAccount,
  updateMassTextingLifecycle,
} from "@/lib/mass-texting/billing-account";
import { MASS_TEXT_TRIAL } from "@/lib/mass-texting/pricing";
import { emitMassTextOpsEvent } from "@/lib/mass-texting/ops-events";

export async function activateMassTextingTrial(workspaceId: string): Promise<{
  ok: boolean;
  reason?: string;
  trialEndsAt?: string;
}> {
  const prisma = getPrisma();
  const reg = await prisma.messagingProductRegistration.findUnique({
    where: {
      workspaceId_productUseCase: {
        workspaceId,
        productUseCase: "MASS_TEXT_MARKETING",
      },
    },
  });

  if (!reg?.messagingEnabled || !reg.phoneAttached) {
    return { ok: false, reason: "messaging_not_ready" };
  }
  if (reg.overallStatus !== "approved" && reg.overallStatus !== "certified") {
    return { ok: false, reason: "a2p_not_approved" };
  }

  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  if (account.lifecycleState === "TRIAL_ACTIVE" && account.trialStartedAt) {
    return { ok: true, trialEndsAt: account.trialEndsAt?.toISOString() };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + MASS_TEXT_TRIAL.durationDays * 86400000);

  await prisma.messagingProductRegistration.update({
    where: { id: reg.id },
    data: { trialStartedAt: now, trialEndsAt },
  });

  await updateMassTextingLifecycle(workspaceId, "TRIAL_ACTIVE", {
    trialStartedAt: now,
    trialEndsAt,
    trialSegmentsUsed: 0,
  });

  await grantWorkspaceProductFeature(workspaceId, "mass_texting", "trial");

  await emitMassTextOpsEvent({
    workspaceId,
    eventType: "mass_text.trial_activated",
    payload: { trialEndsAt: trialEndsAt.toISOString() },
  });

  return { ok: true, trialEndsAt: trialEndsAt.toISOString() };
}

export async function refreshMassTextingTrialState(workspaceId: string) {
  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  if (account.lifecycleState !== "TRIAL_ACTIVE") return account;

  const now = Date.now();
  if (account.trialEndsAt && account.trialEndsAt.getTime() <= now) {
    return updateMassTextingLifecycle(workspaceId, "TRIAL_EXPIRED");
  }
  if (account.trialSegmentsUsed >= MASS_TEXT_TRIAL.includedSegments) {
    return updateMassTextingLifecycle(workspaceId, "TRIAL_LIMIT_REACHED");
  }
  return account;
}

export async function applyMonthlyPlanFromCheckout(input: {
  workspaceId: string;
  tier: string;
  stripeSubscriptionId: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  a2pWaived: boolean;
}) {
  const { MASS_TEXT_MONTHLY_PLANS } = await import("@/lib/mass-texting/pricing");
  const plan = MASS_TEXT_MONTHLY_PLANS[input.tier as keyof typeof MASS_TEXT_MONTHLY_PLANS];
  if (!plan) throw new Error(`Unknown monthly tier: ${input.tier}`);

  await getOrCreateMassTextingBillingAccount(input.workspaceId);
  await updateMassTextingLifecycle(input.workspaceId, "PRODUCTION_ACTIVE", {
    billingModel: "monthly",
    monthlyPlanTier: input.tier,
    monthlySegmentsIncluded: plan.includedSegments,
    monthlySegmentsUsed: 0,
    stripeSubscriptionId: input.stripeSubscriptionId,
    billingPeriodStart: input.periodStart ?? undefined,
    billingPeriodEnd: input.periodEnd ?? undefined,
    a2pFeeStatus: input.a2pWaived ? "WAIVED" : "PAID",
    paygLineActive: false,
  });
  await grantWorkspaceProductFeature(input.workspaceId, "mass_texting", "active");
}

export async function applyPaygLineFromCheckout(input: {
  workspaceId: string;
  stripeSubscriptionId: string;
}) {
  await getOrCreateMassTextingBillingAccount(input.workspaceId);
  await updateMassTextingLifecycle(input.workspaceId, "PRODUCTION_ACTIVE", {
    billingModel: "payg",
    paygLineActive: true,
    stripeSubscriptionId: input.stripeSubscriptionId,
    monthlySegmentsIncluded: 0,
    monthlySegmentsUsed: 0,
  });
  await grantWorkspaceProductFeature(input.workspaceId, "mass_texting", "active");
}

export async function applyPaygPackPurchase(input: {
  workspaceId: string;
  packKey: string;
  a2pWaived: boolean;
}) {
  const { MASS_TEXT_PAYG_PACKS } = await import("@/lib/mass-texting/pricing");
  const pack = MASS_TEXT_PAYG_PACKS[input.packKey as keyof typeof MASS_TEXT_PAYG_PACKS];
  if (!pack) throw new Error(`Unknown PAYG pack: ${input.packKey}`);

  const account = await getOrCreateMassTextingBillingAccount(input.workspaceId);
  await updateMassTextingLifecycle(input.workspaceId, account.lifecycleState, {
    paygCreditsSegments: account.paygCreditsSegments + pack.segments,
    ...(pack.includesA2pRegistration || input.a2pWaived
      ? { a2pFeeStatus: "WAIVED" }
      : {}),
  });
}
