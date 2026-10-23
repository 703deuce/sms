import { getPrisma } from "@/lib/server/db";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import {
  normalizeDialingMode,
  parseAdvancedDialEntitlements,
  parseDialModeSettings,
} from "./dial-modes";
import { readAttemptMetadata } from "./attempt-metadata";

export type PowerDialerAmdDetectionMode =
  | "none"
  | "standard"
  | "premium"
  | "premium_ios_call_screening";

export type PowerDialerAmdStartPlan = {
  shouldStart: boolean;
  detectionMode: PowerDialerAmdDetectionMode;
  /** Stored on attempt for billing / support visibility */
  billingTier: "none" | "standard" | "premium";
  iosScreeningRequested: boolean;
  /**
   * Telnyx documents iOS screening on POST /v2/calls. WebRTC legs use AMD-start;
   * we request PremiumCallScreening on AMD-start when enabled (live validation required).
   */
  amdStartDetectionMode: "Premium" | "PremiumCallScreening" | "Detect" | null;
  promptEndTimeoutMillis?: number;
  reason: string;
};

export async function resolvePowerDialerAmdStartPlan(input: {
  workspaceId: string;
  powerDialerAttemptId?: string | null;
}): Promise<PowerDialerAmdStartPlan> {
  const prisma = getPrisma();
  const limitsRow = await prisma.workspaceLimits.findUnique({
    where: { workspaceId: input.workspaceId },
    select: { limits: true },
  });
  const entitlements = parseAdvancedDialEntitlements(limitsRow?.limits);

  let dialMode = "power";
  let amdFilter = false;
  if (input.powerDialerAttemptId) {
    const attempt = await prisma.powerDialerAttempt.findFirst({
      where: { id: input.powerDialerAttemptId, workspaceId: input.workspaceId },
      include: { session: { include: { campaign: true } } },
    });
    if (attempt?.session?.campaign) {
      dialMode = normalizeDialingMode(attempt.session.campaign.dialingMode);
      const meta = readAttemptMetadata(attempt.metadataJson);
      amdFilter = meta.amdFilter === true;
    }
  }

  const wsRow = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const pd = mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );

  const needsPremium =
    dialMode === "parallel_amd" ||
    amdFilter ||
    entitlements.premiumAmdEnabled ||
    Boolean(pd.callScreeningEnabled);

  if (!needsPremium && dialMode !== "parallel" && dialMode !== "predictive") {
    return {
      shouldStart: true,
      detectionMode: "standard",
      billingTier: "standard",
      iosScreeningRequested: false,
      amdStartDetectionMode: "Detect",
      reason: "default_standard_amd",
    };
  }

  if (!entitlements.premiumAmdEnabled && dialMode === "parallel_amd") {
    return {
      shouldStart: false,
      detectionMode: "none",
      billingTier: "none",
      iosScreeningRequested: false,
      amdStartDetectionMode: null,
      reason: "parallel_amd_requires_premium_entitlement",
    };
  }

  const iosScreeningRequested =
    Boolean(pd.callScreeningEnabled) && entitlements.premiumAmdEnabled;

  if (iosScreeningRequested) {
    const settings = input.powerDialerAttemptId
      ? await prisma.powerDialerAttempt.findFirst({
          where: { id: input.powerDialerAttemptId, workspaceId: input.workspaceId },
          include: { session: { include: { campaign: true } } },
        })
      : null;
    const dialSettings = parseDialModeSettings(settings?.session?.campaign?.configJson);
    const promptEnd = Math.min(
      120_000,
      Math.max(1_000, (dialSettings.ringTimeoutSeconds || 30) * 1000),
    );
    return {
      shouldStart: true,
      detectionMode: "premium_ios_call_screening",
      billingTier: "premium",
      iosScreeningRequested: true,
      amdStartDetectionMode: "PremiumCallScreening",
      promptEndTimeoutMillis: promptEnd,
      reason: "ios_screening_amd_start",
    };
  }

  if (needsPremium && entitlements.premiumAmdEnabled) {
    return {
      shouldStart: true,
      detectionMode: "premium",
      billingTier: "premium",
      iosScreeningRequested: false,
      amdStartDetectionMode: "Premium",
      reason: "premium_amd",
    };
  }

  return {
    shouldStart: true,
    detectionMode: "standard",
    billingTier: "standard",
    iosScreeningRequested: false,
    amdStartDetectionMode: "Detect",
    reason: "premium_unavailable_standard_fallback",
  };
}
