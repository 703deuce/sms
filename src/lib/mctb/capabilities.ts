import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { validateExistingConsentAttestation } from "@/lib/mctb/capture/attestation";
import { resolveMctbCommercialEntitlements } from "@/lib/mctb/commercial-entitlements";
import { getMctbRecoveryUsageSnapshot } from "@/lib/mctb/recovery-usage";
import { resolveMctbMonthlyRecoveryLimit } from "@/lib/mctb/recovery-usage-constants";

export type MctbCapabilities = {
  monthlyRecoveryLimit: number;
  monthlyRecoveriesUsed: number;
  pressOneConsent: boolean;
  existingConsentCertification: boolean;
  bookingLinks: boolean;
  urgentClassification: boolean;
  urgentBusinessEmail: boolean;
  urgentBusinessSms: boolean;
  /** Purchased AI Recovery SKU — not the same as Recovery paid */
  aiRecoveryEntitled: boolean;
  /** @deprecated alias — use aiRecoveryEntitled for gates */
  aiRecovery: boolean;
  /** Purchased own-sender add-on (carrier approval may still be pending) */
  ownSenderAddOnEntitled: boolean;
  /** Active when add-on + WORKSPACE mode + carrier verification approved */
  customerOwnedSender: boolean;
  customTemplates: boolean;
  manualTwoWayMessaging: boolean;
  platformSenderActive: boolean;
  recoveryPaid: boolean;
};

export type MctbCapabilityKey = keyof MctbCapabilities;

export class MctbCapabilityDeniedError extends Error {
  readonly capability: MctbCapabilityKey;
  constructor(capability: MctbCapabilityKey, message?: string) {
    super(message ?? `MCTB capability not entitled: ${capability}`);
    this.name = "MctbCapabilityDeniedError";
    this.capability = capability;
  }
}

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
  const [commercial, config, usage, existingConsent, ownSenderApproved] = await Promise.all([
    resolveMctbCommercialEntitlements(workspaceId),
    loadMissedCallTextConfig(workspaceId),
    getMctbRecoveryUsageSnapshot(workspaceId),
    validateExistingConsentAttestation(workspaceId),
    customerSenderVerificationApproved(workspaceId),
  ]);

  const { mctbProductActive, recoveryPaid, aiRecoveryEntitled, ownSenderAddOnEntitled, paidTier } =
    commercial;

  const senderMode = config.senderMode || "WORKSPACE";
  const platformSenderActive =
    senderMode === "PLATFORM" || (ownSenderAddOnEntitled && !ownSenderApproved);
  const customerOwnedSender =
    ownSenderAddOnEntitled && senderMode === "WORKSPACE" && ownSenderApproved;

  const monthlyRecoveryLimit = resolveMctbMonthlyRecoveryLimit({
    mctbProductActive,
    recoveryPaid,
    aiRecoveryEntitled,
    paidTier,
  });

  const existingConsentCertification =
    recoveryPaid && existingConsent.valid && existingConsent.existingConsentValid;

  const bookingLinks = recoveryPaid || aiRecoveryEntitled;
  const urgentClassification = aiRecoveryEntitled;
  const urgentBusinessEmail = aiRecoveryEntitled;
  const urgentBusinessSms = aiRecoveryEntitled;

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
    aiRecoveryEntitled,
    aiRecovery: aiRecoveryEntitled,
    ownSenderAddOnEntitled,
    customerOwnedSender,
    customTemplates,
    manualTwoWayMessaging,
    platformSenderActive,
    recoveryPaid,
  };
}

export async function assertMctbCapability(
  workspaceId: string,
  key: Exclude<
    MctbCapabilityKey,
    | "monthlyRecoveryLimit"
    | "monthlyRecoveriesUsed"
    | "platformSenderActive"
    | "recoveryPaid"
    | "aiRecovery"
  >,
): Promise<{ ok: true; capabilities: MctbCapabilities } | { ok: false; capabilities: MctbCapabilities }> {
  const capabilities = await resolveMctbCapabilities(workspaceId);
  if (!capabilities[key]) {
    return { ok: false, capabilities };
  }
  return { ok: true, capabilities };
}

export async function requireMctbCapability(
  workspaceId: string,
  key: Exclude<
    MctbCapabilityKey,
    | "monthlyRecoveryLimit"
    | "monthlyRecoveriesUsed"
    | "platformSenderActive"
    | "recoveryPaid"
    | "aiRecovery"
  >,
): Promise<MctbCapabilities> {
  const gate = await assertMctbCapability(workspaceId, key);
  if (!gate.ok) {
    throw new MctbCapabilityDeniedError(key);
  }
  return gate.capabilities;
}
