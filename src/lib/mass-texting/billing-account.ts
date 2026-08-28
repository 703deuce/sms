import "server-only";

import { isAdminUnlimitedWorkspace } from "@/lib/billing/admin-unlimited-workspace";
import { getPrisma } from "@/lib/db";
import { MASS_TEXT_PRICING_VERSION } from "@/lib/mass-texting/pricing";

export type MassTextingLifecycleState =
  | "TRIAL_PENDING_A2P"
  | "TRIAL_ACTIVE"
  | "TRIAL_LIMIT_REACHED"
  | "TRIAL_EXPIRED"
  | "CONVERSION_SELECTED"
  | "PAYMENT_REQUIRED"
  | "PRODUCTION_A2P_PENDING"
  | "PRODUCTION_ACTIVE"
  | "CANCELED";

export async function getOrCreateMassTextingBillingAccount(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.massTextingBillingAccount.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing;

  return prisma.massTextingBillingAccount.create({
    data: {
      workspaceId,
      lifecycleState: "TRIAL_PENDING_A2P",
      pricingVersion: MASS_TEXT_PRICING_VERSION,
    },
  });
}

export async function updateMassTextingLifecycle(
  workspaceId: string,
  lifecycleState: MassTextingLifecycleState,
  patch?: Record<string, unknown>,
) {
  const prisma = getPrisma();
  await getOrCreateMassTextingBillingAccount(workspaceId);
  return prisma.massTextingBillingAccount.update({
    where: { workspaceId },
    data: {
      lifecycleState,
      ...(patch || {}),
    },
  });
}

export type MassTextingBillingSummary = {
  lifecycleState: string;
  billingModel: string | null;
  monthlyPlanTier: string | null;
  monthlySegmentsIncluded: number;
  monthlySegmentsRemaining: number;
  monthlySegmentsUsed: number;
  paygCreditsSegments: number;
  paygLineActive: boolean;
  a2pFeeStatus: string;
  trialSegmentsUsed: number;
  trialSegmentsRemaining: number;
  trialEndsAt: string | null;
  canSend: boolean;
  blockReason: string | null;
};

export async function getMassTextingBillingSummary(
  workspaceId: string,
): Promise<MassTextingBillingSummary> {
  const { MASS_TEXT_TRIAL: trialConfig } = await import("@/lib/mass-texting/pricing");
  const account = await getOrCreateMassTextingBillingAccount(workspaceId);
  const adminUnlimited = await isAdminUnlimitedWorkspace(workspaceId);
  const monthlyRemaining = Math.max(
    0,
    account.monthlySegmentsIncluded - account.monthlySegmentsUsed,
  );
  const trialRemaining = Math.max(
    0,
    trialConfig.includedSegments - account.trialSegmentsUsed,
  );

  if (adminUnlimited) {
    return {
      lifecycleState: account.lifecycleState === "TRIAL_PENDING_A2P" ? "TRIAL_ACTIVE" : account.lifecycleState,
      billingModel: account.billingModel,
      monthlyPlanTier: account.monthlyPlanTier,
      monthlySegmentsIncluded: account.monthlySegmentsIncluded,
      monthlySegmentsRemaining: monthlyRemaining,
      monthlySegmentsUsed: account.monthlySegmentsUsed,
      paygCreditsSegments: account.paygCreditsSegments,
      paygLineActive: account.paygLineActive,
      a2pFeeStatus: account.a2pFeeStatus,
      trialSegmentsUsed: account.trialSegmentsUsed,
      trialSegmentsRemaining: trialConfig.includedSegments,
      trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
      canSend: true,
      blockReason: null,
    };
  }

  let canSend = false;
  let blockReason: string | null = null;

  switch (account.lifecycleState) {
    case "TRIAL_ACTIVE":
      canSend = trialRemaining > 0;
      if (!canSend) blockReason = "Trial segment limit reached";
      break;
    case "PRODUCTION_ACTIVE":
      canSend =
        monthlyRemaining + account.paygCreditsSegments > 0 &&
        (account.billingModel !== "payg" || account.paygLineActive);
      if (!canSend) {
        blockReason =
          account.billingModel === "payg" && !account.paygLineActive
            ? "PAYG Messaging Line inactive"
            : "Insufficient segments";
      }
      break;
    case "TRIAL_PENDING_A2P":
    case "PRODUCTION_A2P_PENDING":
      blockReason = "Messaging approval pending";
      break;
    case "TRIAL_EXPIRED":
    case "TRIAL_LIMIT_REACHED":
      blockReason = "Trial ended — upgrade required";
      break;
    case "PAYMENT_REQUIRED":
      blockReason = "Payment required — update billing to keep sending";
      break;
    case "CANCELED":
      blockReason = "Account canceled";
      break;
    default:
      blockReason = "Billing setup incomplete";
  }

  return {
    lifecycleState: account.lifecycleState,
    billingModel: account.billingModel,
    monthlyPlanTier: account.monthlyPlanTier,
    monthlySegmentsIncluded: account.monthlySegmentsIncluded,
    monthlySegmentsRemaining: monthlyRemaining,
    monthlySegmentsUsed: account.monthlySegmentsUsed,
    paygCreditsSegments: account.paygCreditsSegments,
    paygLineActive: account.paygLineActive,
    a2pFeeStatus: account.a2pFeeStatus,
    trialSegmentsUsed: account.trialSegmentsUsed,
    trialSegmentsRemaining: trialRemaining,
    trialEndsAt: account.trialEndsAt?.toISOString() ?? null,
    canSend,
    blockReason,
  };
}
