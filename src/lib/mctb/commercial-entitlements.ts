import "server-only";

import { getPrisma } from "@/lib/db";
import { workspaceHasMctbProductContext } from "@/lib/mctb/ensure-mctb-product-feature";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import {
  getWorkspaceProductFeatures,
  workspaceHasAdminFullEntitlements,
} from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";
import { listActivePlatformSubscriptions } from "@/lib/products/platform-subscriptions";

export const MCTB_PLATFORM_PRODUCT_FAMILY = "mctb";
export const MCTB_AI_RECOVERY_PRODUCT_FAMILY = "mctb_ai_recovery";
export const MCTB_OWN_SENDER_PRODUCT_FAMILY = "mctb_own_sender";

const LIMITS_AI_ENTITLED = "mctbAiRecoveryEntitled";
const LIMITS_OWN_SENDER_ADDON = "mctbOwnSenderAddOnEntitled";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export type MctbCommercialEntitlements = {
  mctbProductActive: boolean;
  /** Text Back paid plan ($9.99) — booking links + 50 recoveries/mo */
  recoveryPaid: boolean;
  paidTier: string | null;
  /** Distinct SKU — may enable conversational AI when config is on */
  aiRecoveryEntitled: boolean;
  /** Own-sender add-on — orthogonal to Recovery vs AI Recovery base */
  ownSenderAddOnEntitled: boolean;
};

async function loadLimitsEntitlementFlags(workspaceId: string): Promise<{
  aiRecovery: boolean;
  ownSenderAddOn: boolean;
}> {
  const prisma = getPrisma();
  const row = await prisma.workspaceLimits.findUnique({
    where: { workspaceId },
    select: { limits: true },
  });
  const limits = asRecord(row?.limits);
  return {
    aiRecovery: limits[LIMITS_AI_ENTITLED] === true,
    ownSenderAddOn: limits[LIMITS_OWN_SENDER_ADDON] === true,
  };
}

function subscriptionActive(productFamily: string, subs: { productFamily: string; status: string }[]): boolean {
  return subs.some((s) => s.productFamily === productFamily);
}

/**
 * Authoritative commercial entitlements for MCTB (billing + add-ons).
 * Stripe/catalog rows map to `platform_product_subscriptions.product_family`.
 */
export async function resolveMctbCommercialEntitlements(
  workspaceId: string,
): Promise<MctbCommercialEntitlements> {
  const [features, recoveryPaidLegacy, subs, limitsFlags, adminFull, mctbContext] =
    await Promise.all([
    getWorkspaceProductFeatures(workspaceId),
    hasActiveMctbPaidEntitlement(workspaceId),
    listActivePlatformSubscriptions(workspaceId),
    loadLimitsEntitlementFlags(workspaceId),
    workspaceHasAdminFullEntitlements(workspaceId),
    workspaceHasMctbProductContext(workspaceId),
  ]);

  const mctbProductActive =
    isActiveEntitlement(features.mctb) || mctbContext || adminFull;
  const mctbSub = subs.find((s) => s.productFamily === MCTB_PLATFORM_PRODUCT_FAMILY);
  const recoveryPaid =
    mctbProductActive && (recoveryPaidLegacy || subscriptionActive(MCTB_PLATFORM_PRODUCT_FAMILY, subs));

  const paidTier = mctbSub?.tier ?? (recoveryPaid ? "text_back" : null);

  const aiRecoveryEntitled =
    adminFull ||
    limitsFlags.aiRecovery ||
    subscriptionActive(MCTB_AI_RECOVERY_PRODUCT_FAMILY, subs);

  const ownSenderAddOnEntitled =
    adminFull ||
    limitsFlags.ownSenderAddOn ||
    subscriptionActive(MCTB_OWN_SENDER_PRODUCT_FAMILY, subs);

  return {
    mctbProductActive,
    recoveryPaid,
    paidTier,
    aiRecoveryEntitled,
    ownSenderAddOnEntitled,
  };
}
