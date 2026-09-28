import "server-only";

import { getPrisma } from "@/lib/db";
import { hasActiveMctbPaidEntitlement } from "@/lib/mctb/entitlement";
import { isLeadRecoveryAiRepliesEnabled } from "@/lib/mctb/lead-recovery/config";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { validateExistingConsentAttestation } from "@/lib/mctb/capture/attestation";
import { MCTB_FREE_MONTHLY_RECOVERY_LIMIT } from "@/lib/mctb/recovery-usage-constants";
import { getMctbRecoveryUsageSnapshot } from "@/lib/mctb/recovery-usage";
import { getWorkspaceProductFeatures } from "@/lib/products/feature-entitlements";
import { isActiveEntitlement } from "@/lib/products/types";

export type MctbCapabilities = {
  monthlyRecoveryLimit: number | null;
  monthlyRecoveriesUsed: number;
  pressOneConsent: boolean;
  existingConsentCertification: boolean;
  bookingLinks: boolean;
  urgentClassification: boolean;
  urgentBusinessEmail: boolean;
  urgentBusinessSms: boolean;
  aiRecovery: boolean;
  customerOwnedSender: boolean;
  customTemplates: boolean;
  manualTwoWayMessaging: boolean;
  platformSenderActive: boolean;
  recoveryPaid: boolean;
};

export type MctbCapabilityKey = keyof MctbCapabilities;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function customerSenderVerificationApproved(workspaceId: string): Promise<boolean> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const mctb = asRecord(asRecord(ws?.customFieldsConfig).mctb);
  const sender = asRecord(mctb.sender);
  const status = String(sender.verificationStatus || sender.status || "").toUpperCase();
  return status === "APPROVED" || status === "ACTIVE";
}

/**
 * Central MCTB commercial capability resolver — UI, API, and runtime should use this
 * instead of scattering `billingPlan === …` checks.
 */
export async function resolveMctbCapabilities(workspaceId: string): Promise<MctbCapabilities> {
  const [features, recoveryPaid, config, usage, existingConsent, aiRecoveryEnabled, aiBooking] =
    await Promise.all([
      getWorkspaceProductFeatures(workspaceId),
      hasActiveMctbPaidEntitlement(workspaceId),
      loadMissedCallTextConfig(workspaceId),
      getMctbRecoveryUsageSnapshot(workspaceId),
      validateExistingConsentAttestation(workspaceId),
      isLeadRecoveryAiRepliesEnabled(workspaceId),
      hasMctbAiBookingEntitlement(workspaceId),
    ]);

  const mctbProductActive = isActiveEntitlement(features.mctb);
  const senderMode = config.senderMode || "WORKSPACE";
  const platformSenderActive = senderMode === "PLATFORM";
  const ownSenderApproved = await customerSenderVerificationApproved(workspaceId);
  const customerOwnedSender = senderMode === "WORKSPACE" && ownSenderApproved;

  const recoveryPaidTier = recoveryPaid && mctbProductActive;
  const freeTier = mctbProductActive && !recoveryPaid;

  const monthlyRecoveryLimit = freeTier
    ? MCTB_FREE_MONTHLY_RECOVERY_LIMIT
    : recoveryPaidTier
      ? null
      : 0;

  const existingConsentCertification =
    recoveryPaidTier && existingConsent.valid && existingConsent.existingConsentValid;

  const urgentClassification = recoveryPaidTier;
  const urgentBusinessEmail = recoveryPaidTier;
  const urgentBusinessSms = recoveryPaidTier;
  const bookingLinks = recoveryPaidTier;
  const aiRecovery = recoveryPaidTier && (aiRecoveryEnabled || aiBooking);

  const customTemplates = customerOwnedSender;
  const manualTwoWayMessaging = customerOwnedSender;

  return {
    monthlyRecoveryLimit,
    monthlyRecoveriesUsed: usage.usedInPeriod,
    pressOneConsent: mctbProductActive,
    existingConsentCertification,
    bookingLinks,
    urgentClassification,
    urgentBusinessEmail,
    urgentBusinessSms,
    aiRecovery,
    customerOwnedSender,
    customTemplates,
    manualTwoWayMessaging,
    platformSenderActive,
    recoveryPaid: recoveryPaidTier,
  };
}

export async function assertMctbCapability(
  workspaceId: string,
  key: Exclude<
    MctbCapabilityKey,
    "monthlyRecoveryLimit" | "monthlyRecoveriesUsed" | "platformSenderActive" | "recoveryPaid"
  >,
): Promise<{ ok: true; capabilities: MctbCapabilities } | { ok: false; capabilities: MctbCapabilities }> {
  const capabilities = await resolveMctbCapabilities(workspaceId);
  if (!capabilities[key]) {
    return { ok: false, capabilities };
  }
  return { ok: true, capabilities };
}
